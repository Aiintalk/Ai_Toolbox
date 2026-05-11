'use client'

import { useState, useEffect, useRef } from 'react'

const BASE = '/tiktok-writer'

interface Persona { name: string; soul: string; contentPlan: string; references: string[] }
interface ChatMsg { role: 'user' | 'assistant'; content: string }

/* ── helpers ── */
function SimpleMarkdown({ text }: { text: string }) {
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n- /g, '</p><li>')
    .replace(/\n(\d+)\. /g, '</p><li>')
    .replace(/\n/g, '<br/>')
  return <div className="prose max-w-none text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/* ── main ── */
export default function Home() {
  const [step, setStep] = useState(1)

  // Step 1: TikTok link + transcript
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [transcript, setTranscript] = useState('')
  const [likesCount, setLikesCount] = useState('')

  // Step 2: Opening validation + persona
  const [openingCheck, setOpeningCheck] = useState('')
  const [openingPass, setOpeningPass] = useState(false)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null)

  // Step 3: Structure analysis + opening lock
  const [structureAnalysis, setStructureAnalysis] = useState('')
  const [lockedOpening, setLockedOpening] = useState('')
  const [bodyText, setBodyText] = useState('') // original body (without opening)
  const [openingLocked, setOpeningLocked] = useState(false)

  // Step 4: Rewriting
  const [writeMode, setWriteMode] = useState<'ideas' | 'ai' | null>(null)
  const [userIdeas, setUserIdeas] = useState('')
  const [aiBody, setAiBody] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Step 5: Preview + export
  const [finalOpening, setFinalOpening] = useState('')
  const [finalBody, setFinalBody] = useState('')
  const [exporting, setExporting] = useState(false)

  // UI state
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetch('/material-library/api/personas').then(r => r.json()).then(d => {
      setPersonas(d.personas || [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  /* ── streaming helper ── */
  async function streamChat(
    msgs: { role: string; content: string }[],
    sysPrompt: string,
    onUpdate: (t: string) => void
  ): Promise<string> {
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs, systemPrompt: sysPrompt }),
    })
    if (!res.ok) throw new Error('AI request failed')
    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')
    const decoder = new TextDecoder()
    let full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      full += decoder.decode(value, { stream: true })
      onUpdate(full)
    }
    return full
  }

  /* ── Step 2: Evaluate opening ── */
  async function handleEvaluateOpening() {
    if (!transcript.trim()) { setError('Please paste the transcript first'); return }
    setLoading('Evaluating opening hook...')
    setError('')
    try {
      const sysPrompt = `You are a TikTok content strategist. Evaluate the opening hook of this TikTok script.

The "opening" is the first 1-3 sentences that grab attention.

Your task:
1. Identify the exact opening (first 1-3 sentences)
2. Rate if this opening would make a general audience stop scrolling and keep watching
3. Answer with PASS or FAIL

Format your response EXACTLY like this:
OPENING: [copy the exact opening sentences here]
---
VERDICT: [PASS or FAIL]
REASON: [1-2 sentences explaining why]`

      const result = await streamChat(
        [{ role: 'user', content: transcript }],
        sysPrompt,
        (t) => setOpeningCheck(t)
      )
      setOpeningCheck(result)
      setOpeningPass(result.toUpperCase().includes('VERDICT: PASS') || result.toUpperCase().includes('PASS'))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading('')
    }
  }

  /* ── Step 3: Analyze structure + split opening ── */
  async function handleAnalyzeStructure() {
    setLoading('Analyzing structure...')
    setError('')
    try {
      const sysPrompt = `You are a TikTok script structure analyst. Analyze this TikTok script and break it into clear structural sections.

CRITICAL TASK: You must clearly separate the OPENING (hook) from the BODY.

Format your response EXACTLY like this:

===OPENING_START===
[paste the exact opening sentences here, word for word, no changes]
===OPENING_END===

===STRUCTURE===
1. Opening hook: [describe the technique used]
2. [Section name]: [describe what happens]
3. [Section name]: [describe what happens]
...
===STRUCTURE_END===

===NOTES===
- Key storytelling techniques used
- Tone and pacing observations
===NOTES_END===`

      const result = await streamChat(
        [{ role: 'user', content: transcript }],
        sysPrompt,
        (t) => setStructureAnalysis(t)
      )
      setStructureAnalysis(result)

      // Auto-extract opening from markers
      const openStart = result.indexOf('===OPENING_START===')
      const openEnd = result.indexOf('===OPENING_END===')
      if (openStart !== -1 && openEnd !== -1) {
        const extracted = result.slice(openStart + '===OPENING_START==='.length, openEnd).trim()
        setLockedOpening(extracted)

        // Compute body = transcript minus opening
        const openingIndex = transcript.indexOf(extracted)
        if (openingIndex !== -1) {
          setBodyText(transcript.slice(openingIndex + extracted.length).trim())
        } else {
          // Fuzzy: opening is roughly the first N chars
          const words = extracted.split(/\s+/).length
          const transcriptWords = transcript.split(/\s+/)
          setBodyText(transcriptWords.slice(words).join(' '))
        }
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading('')
    }
  }

  /* ── Step 4: Generate rewrite ── */
  async function handleGenerate() {
    if (!lockedOpening || !bodyText) { setError('Structure not analyzed yet'); return }
    setLoading('Writing...')
    setError('')

    const personaContext = selectedPersona
      ? `\n\nCreator persona (light reference only):\nName: ${selectedPersona.name}\nStyle: ${selectedPersona.soul?.slice(0, 500)}`
      : ''

    const originalWordCount = wordCount(transcript)

    let sysPrompt = ''

    if (writeMode === 'ai') {
      sysPrompt = `You are a TikTok script rewriter. Your job is to rewrite ONLY the body of a TikTok script.

IRON RULES — VIOLATING ANY OF THESE IS A FAILURE:
1. DO NOT output the opening. The opening is handled separately and must not appear in your output.
2. Your output word count MUST be LESS than or equal to ${originalWordCount} words total (opening + your body combined). The opening is ${wordCount(lockedOpening)} words, so your body must be ≤ ${originalWordCount - wordCount(lockedOpening)} words.
3. The content must be DIFFERENTIATED — not a paraphrase, not a synonym swap. Bring fresh angles, new examples, or unique perspective.
4. Maintain the SAME structure and flow as the original body.
5. The tone should feel natural, engaging, and native-level English for TikTok.
6. Do NOT be generic or mediocre. Every sentence should earn its place.

Output ONLY the rewritten body text. No headers, no labels, no explanations.${personaContext}

ORIGINAL STRUCTURE FOR REFERENCE:
${structureAnalysis}`
    } else {
      sysPrompt = `You are a TikTok script rewriter. Your job is to rewrite ONLY the body of a TikTok script, incorporating the user's creative direction.

IRON RULES — VIOLATING ANY OF THESE IS A FAILURE:
1. DO NOT output the opening. The opening is handled separately and must not appear in your output.
2. Your output word count MUST be LESS than or equal to ${originalWordCount} words total (opening + your body combined). The opening is ${wordCount(lockedOpening)} words, so your body must be ≤ ${originalWordCount - wordCount(lockedOpening)} words.
3. The USER'S IDEAS take priority. The reference script is secondary.
4. Maintain the SAME structure and flow as the original body.
5. The tone should feel natural, engaging, and native-level English for TikTok.

Output ONLY the rewritten body text. No headers, no labels, no explanations.${personaContext}

ORIGINAL STRUCTURE FOR REFERENCE:
${structureAnalysis}

USER'S CREATIVE DIRECTION:
${userIdeas}`
    }

    try {
      const userMsg = writeMode === 'ai'
        ? `Here is the original body (without opening):\n\n${bodyText}`
        : `Here is the original body (without opening):\n\n${bodyText}\n\nMy ideas:\n${userIdeas}`

      const result = await streamChat(
        [{ role: 'user', content: userMsg }],
        sysPrompt,
        (t) => setAiBody(t)
      )
      setAiBody(result)

      // Prepare final preview
      setFinalOpening(lockedOpening)
      setFinalBody(result)
      setStep(5)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading('')
    }
  }

  /* ── Step 4 chat: iterative refinement ── */
  async function handleChatSend() {
    if (!chatInput.trim()) return
    const newMsgs: ChatMsg[] = [...chatMessages, { role: 'user', content: chatInput }]
    setChatMessages(newMsgs)
    setChatInput('')
    setLoading('Revising...')

    const originalWordCount = wordCount(transcript)
    const sysPrompt = `You are revising a TikTok script body based on user feedback.

IRON RULES:
1. DO NOT include the opening in your output. Opening is: "${lockedOpening}"
2. Word count of your body must be ≤ ${originalWordCount - wordCount(lockedOpening)} words.
3. Apply the user's feedback precisely.
4. Output ONLY the revised body text, nothing else.

Current body being revised:
${aiBody}`

    try {
      let assistantMsg = ''
      const apiMsgs = newMsgs.map(m => ({ role: m.role, content: m.content }))
      await streamChat(apiMsgs, sysPrompt, (t) => {
        assistantMsg = t
        setChatMessages([...newMsgs, { role: 'assistant', content: t }])
      })
      setChatMessages([...newMsgs, { role: 'assistant', content: assistantMsg }])
      setAiBody(assistantMsg)
      setFinalBody(assistantMsg)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading('')
    }
  }

  /* ── Step 5: Export ── */
  async function handleExport() {
    setExporting(true)
    const fullScript = finalOpening + '\n\n' + finalBody
    try {
      const res = await fetch(`${BASE}/api/export-word`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaName: selectedPersona?.name || 'TikTok',
          topic: tiktokUrl,
          content: fullScript,
        }),
      })
      if (!res.ok) { showToast('Export failed'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const name = selectedPersona?.name || 'TikTok'
      const dateStr = new Date().toISOString().slice(0, 10)
      a.download = `TikTok_Script_${name}_${dateStr}.docx`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Downloaded to your computer!')
    } catch {
      showToast('Export failed, please retry')
    } finally {
      setExporting(false)
    }
  }

  /* ── likes validation ── */
  const likesNum = parseInt(likesCount.replace(/,/g, ''), 10)
  const likesPass = !isNaN(likesNum) && likesNum >= 100000

  /* ════════════════════ RENDER ════════════════════ */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-5 py-2.5 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">TikTok Content Writer</h1>
          <p className="text-sm text-gray-500 mt-1">Reference → Validate → Rewrite → Export</p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          {[
            { n: 1, label: 'Source' },
            { n: 2, label: 'Validate' },
            { n: 3, label: 'Structure' },
            { n: 4, label: 'Rewrite' },
            { n: 5, label: 'Export' },
          ].map(s => (
            <button
              key={s.n}
              onClick={() => s.n <= step && setStep(s.n)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                s.n === step ? 'bg-blue-600 text-white' :
                s.n < step ? 'bg-blue-100 text-blue-700 cursor-pointer hover:bg-blue-200' :
                'bg-gray-100 text-gray-400'
              }`}
            >
              {s.n}. {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-3xl mx-auto px-6 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
            <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">✕</button>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">

        {/* ════ STEP 1: Source ════ */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h2 className="text-lg font-semibold">Step 1 · Paste TikTok Link & Transcript</h2>

            {/* TikTok URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">TikTok Video Link</label>
              <input
                type="text"
                value={tiktokUrl}
                onChange={e => setTiktokUrl(e.target.value)}
                placeholder="https://www.tiktok.com/@username/video/..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Go to TokScribe button */}
            {tiktokUrl && (
              <a
                href="https://getthescript.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#fe2c55] to-[#25f4ee] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <span>🔗</span>
                Go to GetTheScript to extract transcript
                <span className="text-xs opacity-80">↗</span>
              </a>
            )}

            {/* Transcript paste area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Paste Transcript Here
              </label>
              <textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                rows={10}
                placeholder="Paste the transcript from TokScribe here..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              />
              {transcript && (
                <p className="text-xs text-gray-500 mt-1">{wordCount(transcript)} words</p>
              )}
            </div>

            {/* Likes count */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Likes Count</label>
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  value={likesCount}
                  onChange={e => setLikesCount(e.target.value)}
                  placeholder="e.g. 150000"
                  className="w-48 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {likesCount && (
                  <span className={`text-sm font-medium ${likesPass ? 'text-green-600' : 'text-red-500'}`}>
                    {likesPass ? '✓ Qualified (≥100K)' : '✕ Below 100K threshold'}
                  </span>
                )}
              </div>
            </div>

            {/* Next */}
            <button
              onClick={() => {
                if (!transcript.trim()) { setError('Please paste the transcript first'); return }
                if (!likesPass) { setError('Likes must be ≥ 100K to qualify'); return }
                setError('')
                setStep(2)
              }}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Next →
            </button>
            {(!transcript.trim() || !likesPass) && (
              <p className="text-xs text-gray-400 mt-1">
                {!transcript.trim() ? '↑ Paste transcript to continue' : !likesPass ? '↑ Enter likes count (≥100K)' : ''}
              </p>
            )}
          </div>
        )}

        {/* ════ STEP 2: Validate Opening + Select Persona ════ */}
        {step === 2 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h2 className="text-lg font-semibold">Step 2 · Validate Opening & Select Creator</h2>

            {/* Opening evaluation */}
            {!openingCheck && !loading && (
              <button
                onClick={handleEvaluateOpening}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Evaluate Opening Hook
              </button>
            )}

            {loading === 'Evaluating opening hook...' && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                {loading}
              </div>
            )}

            {openingCheck && (
              <div className={`p-4 rounded-lg border text-sm ${openingPass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <SimpleMarkdown text={openingCheck} />
              </div>
            )}

            {openingCheck && !openingPass && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                ⚠️ Opening didn't pass. Consider choosing a different reference video with a stronger hook.
                <button onClick={() => { setStep(1); setOpeningCheck('') }} className="ml-2 underline">Go back</button>
              </div>
            )}

            {/* Persona selection */}
            {openingPass && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Creator Profile</label>
                {personas.length === 0 ? (
                  <p className="text-sm text-gray-500">No creator profiles found. You can skip this step.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {personas.map(p => (
                      <button
                        key={p.name}
                        onClick={() => setSelectedPersona(p)}
                        className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                          selectedPersona?.name === p.name
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium">{p.name}</div>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setStep(3)}
                  className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Next → Analyze Structure
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════ STEP 3: Structure Analysis + Lock Opening ════ */}
        {step === 3 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h2 className="text-lg font-semibold">Step 3 · Structure Breakdown & Lock Opening</h2>

            {!structureAnalysis && !loading && (
              <button
                onClick={handleAnalyzeStructure}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Analyze Structure
              </button>
            )}

            {loading === 'Analyzing structure...' && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                {loading}
              </div>
            )}

            {structureAnalysis && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                <SimpleMarkdown text={structureAnalysis} />
              </div>
            )}

            {/* Locked opening display + edit */}
            {lockedOpening && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  🔒 Locked Opening <span className="text-gray-400 font-normal">(this will NOT be changed)</span>
                </label>
                <div className="relative">
                  <textarea
                    value={lockedOpening}
                    onChange={e => !openingLocked && setLockedOpening(e.target.value)}
                    rows={3}
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm font-mono ${
                      openingLocked
                        ? 'bg-gray-100 border-gray-300 text-gray-700 cursor-not-allowed'
                        : 'border-blue-300 bg-blue-50'
                    }`}
                    readOnly={openingLocked}
                  />
                  <button
                    onClick={() => setOpeningLocked(!openingLocked)}
                    className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-white border border-gray-300 hover:bg-gray-50"
                  >
                    {openingLocked ? '🔓 Unlock to adjust' : '🔒 Lock opening'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {openingLocked
                    ? 'Opening is locked. It will be preserved exactly as-is in the final script.'
                    : 'Adjust the opening boundary if needed, then lock it.'}
                </p>
              </div>
            )}

            {/* Body preview */}
            {bodyText && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Body (to be rewritten)</label>
                <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 max-h-48 overflow-y-auto font-mono">
                  {bodyText}
                </div>
                <p className="text-xs text-gray-500 mt-1">{wordCount(bodyText)} words</p>
              </div>
            )}

            {lockedOpening && openingLocked && (
              <button
                onClick={() => setStep(4)}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Next → Rewrite
              </button>
            )}

            {lockedOpening && !openingLocked && (
              <button
                onClick={() => { setOpeningLocked(true); setStep(4) }}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Lock Opening & Continue →
              </button>
            )}
          </div>
        )}

        {/* ════ STEP 4: Rewrite ════ */}
        {step === 4 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h2 className="text-lg font-semibold">Step 4 · Rewrite</h2>

            {/* Locked opening reminder */}
            <div className="p-3 bg-gray-100 rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-500 mb-1">🔒 LOCKED OPENING (will not change)</p>
              <p className="text-sm text-gray-700 font-mono">{lockedOpening}</p>
            </div>

            {/* Mode selection */}
            {!writeMode && (
              <div className="flex gap-3">
                <button
                  onClick={() => setWriteMode('ideas')}
                  className="flex-1 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 text-left transition-colors"
                >
                  <div className="font-medium text-sm">💡 I have ideas</div>
                  <p className="text-xs text-gray-500 mt-1">You provide creative direction, AI follows your lead</p>
                </button>
                <button
                  onClick={() => setWriteMode('ai')}
                  className="flex-1 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 text-left transition-colors"
                >
                  <div className="font-medium text-sm">🤖 AI writes directly</div>
                  <p className="text-xs text-gray-500 mt-1">AI creates differentiated content following the same structure</p>
                </button>
              </div>
            )}

            {/* Ideas input */}
            {writeMode === 'ideas' && !aiBody && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Your Ideas & Direction</label>
                <textarea
                  value={userIdeas}
                  onChange={e => setUserIdeas(e.target.value)}
                  rows={5}
                  placeholder="Describe what angle you want, what to change, your key message..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleGenerate}
                  disabled={!userIdeas.trim()}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700"
                >
                  Generate Body
                </button>
              </div>
            )}

            {/* AI direct mode */}
            {writeMode === 'ai' && !aiBody && !loading && (
              <button
                onClick={handleGenerate}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Generate Body
              </button>
            )}

            {(loading === 'Writing...' || loading === 'Revising...') && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                {loading}
              </div>
            )}

            {/* AI output */}
            {aiBody && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Generated Body</label>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm">
                    <SimpleMarkdown text={aiBody} />
                  </div>
                  <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
                    <span>Original: {wordCount(transcript)} words</span>
                    <span>Opening: {wordCount(lockedOpening)} words</span>
                    <span className={wordCount(lockedOpening) + wordCount(aiBody) > wordCount(transcript) ? 'text-red-500 font-medium' : 'text-green-600'}>
                      Total now: {wordCount(lockedOpening) + wordCount(aiBody)} words
                      {wordCount(lockedOpening) + wordCount(aiBody) > wordCount(transcript) ? ' ⚠️ OVER LIMIT' : ' ✓'}
                    </span>
                  </div>
                </div>

                {/* Chat for refinement */}
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Need changes? Tell AI what to revise:</p>

                  {chatMessages.length > 0 && (
                    <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
                      {chatMessages.map((m, i) => (
                        <div key={i} className={`p-3 rounded-lg text-sm ${m.role === 'user' ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'}`}>
                          <span className="text-xs font-medium text-gray-400">{m.role === 'user' ? 'You' : 'AI'}</span>
                          <div className="mt-1"><SimpleMarkdown text={m.content} /></div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
                      placeholder="e.g. Make the ending more punchy..."
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleChatSend}
                      disabled={!chatInput.trim() || !!loading}
                      className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-900"
                    >
                      Send
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => { setFinalOpening(lockedOpening); setFinalBody(aiBody); setStep(5) }}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Looks good → Preview & Export
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════ STEP 5: Preview + Export ════ */}
        {step === 5 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h2 className="text-lg font-semibold">Step 5 · Final Preview & Export</h2>

            {/* Full script preview */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Opening - locked section */}
              <div className="bg-gray-100 p-4 border-b border-gray-200">
                <p className="text-xs font-medium text-gray-500 mb-1.5">🔒 OPENING (locked, unchanged)</p>
                <div className="text-sm text-gray-800 font-mono whitespace-pre-wrap">{finalOpening}</div>
              </div>

              {/* Body - editable */}
              <div className="p-4">
                <p className="text-xs font-medium text-gray-500 mb-1.5">✏️ BODY (editable)</p>
                <textarea
                  value={finalBody}
                  onChange={e => setFinalBody(e.target.value)}
                  rows={12}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Word count comparison */}
            <div className="flex gap-6 text-sm">
              <span className="text-gray-500">Original: <strong>{wordCount(transcript)}</strong> words</span>
              <span className={`font-medium ${
                wordCount(finalOpening) + wordCount(finalBody) > wordCount(transcript)
                  ? 'text-red-500'
                  : 'text-green-600'
              }`}>
                Final: <strong>{wordCount(finalOpening) + wordCount(finalBody)}</strong> words
                {wordCount(finalOpening) + wordCount(finalBody) > wordCount(transcript) ? ' ⚠️ Over limit!' : ' ✓'}
              </span>
            </div>

            {/* Export buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700 flex items-center gap-2"
              >
                {exporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>📄 Export Word Document</>
                )}
              </button>
              <button
                onClick={() => {
                  const full = finalOpening + '\n\n' + finalBody
                  navigator.clipboard.writeText(full)
                  showToast('Copied to clipboard!')
                }}
                className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                📋 Copy to Clipboard
              </button>
            </div>

            {/* Start over */}
            <button
              onClick={() => {
                setStep(1); setTiktokUrl(''); setTranscript(''); setLikesCount('')
                setOpeningCheck(''); setOpeningPass(false); setSelectedPersona(null)
                setStructureAnalysis(''); setLockedOpening(''); setBodyText('')
                setOpeningLocked(false); setWriteMode(null); setUserIdeas('')
                setAiBody(''); setChatMessages([]); setChatInput('')
                setFinalOpening(''); setFinalBody('')
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Start new script →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
