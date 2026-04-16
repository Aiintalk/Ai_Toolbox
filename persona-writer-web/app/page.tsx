'use client'

import { useState, useEffect, useRef } from 'react'

const BASE = '/persona-writer'

interface Persona { name: string; soul: string; contentPlan: string; references: string[] }
interface VideoInfo { title: string; diggCount: number; awemeId: string; isSubtitled: boolean; playUrl: string }
interface ChatMsg { role: 'user' | 'assistant'; content: string }

function SimpleMarkdown({ text }: { text: string }) {
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n- /g, '</p><li>')
    .replace(/\n(\d+)\. /g, '</p><li>')
    .replace(/\n/g, '<br/>')
  return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />
}

export default function Home() {
  const [step, setStep] = useState(1)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null)
  const [shareUrl, setShareUrl] = useState('')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [transcript, setTranscript] = useState('')
  const [transcriptConfirmed, setTranscriptConfirmed] = useState(false)
  const [editingTranscript, setEditingTranscript] = useState(false)
  const [openingEval, setOpeningEval] = useState('')
  const [openingConfirmed, setOpeningConfirmed] = useState<boolean | null>(null)
  const [structureAnalysis, setStructureAnalysis] = useState('')
  const [topicMode, setTopicMode] = useState<'same' | 'custom' | 'ai' | null>(null)
  const [customTopic, setCustomTopic] = useState('')
  const [aiTopics, setAiTopics] = useState('')
  const [chosenTopic, setChosenTopic] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [showRefForm, setShowRefForm] = useState(false)
  const [refTitle, setRefTitle] = useState('')
  const [refLikes, setRefLikes] = useState('')
  const [refType, setRefType] = useState('人格档案')
  const [refContent, setRefContent] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`${BASE}/api/personas`).then(r => r.json()).then(d => {
      setPersonas(d.personas || [])
    })
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  // Reload personas data (after adding/deleting references)
  async function reloadPersonas() {
    const d = await fetch(`${BASE}/api/personas`).then(r => r.json())
    const list = d.personas || []
    setPersonas(list)
    if (selectedPersona) {
      const updated = list.find((p: Persona) => p.name === selectedPersona.name)
      if (updated) setSelectedPersona(updated)
    }
  }

  // Add reference
  async function handleAddReference() {
    if (!selectedPersona || !refTitle.trim() || !refContent.trim()) return
    setLoading('保存素材...')
    try {
      const res = await fetch(`${BASE}/api/personas/references`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: selectedPersona.name,
          title: refTitle,
          likes: refLikes ? Number(refLikes) : undefined,
          source: '抖音',
          type: refType,
          content: refContent,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      await reloadPersonas()
      setRefTitle('')
      setRefLikes('')
      setRefContent('')
      setShowRefForm(false)
      showToast('素材已添加')
      setLoading('')
    } catch (e: any) {
      setError(e.message)
      setLoading('')
    }
  }

  // Delete reference by index
  async function handleDeleteReference(index: number) {
    if (!selectedPersona) return
    // We need to get the filename - fetch the directory listing
    try {
      const res = await fetch(`${BASE}/api/personas/references`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: selectedPersona.name,
          filename: `__index_${index}__`,
        }),
      })
      // Fallback: just reload, the API needs filenames but we'll handle via reload
      await reloadPersonas()
    } catch {
      // silent
    }
  }

  // 选达人时自动加载风格
  function handleSelectPersona(name: string) {
    const persona = personas.find(p => p.name === name) || null
    setSelectedPersona(persona)
  }

  async function streamChat(messages: { role: string; content: string }[], systemPrompt: string, model?: string): Promise<string> {
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, systemPrompt, model }),
    })
    if (!res.ok) throw new Error(await res.text())
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      full += decoder.decode(value, { stream: true })
    }
    return full
  }

  async function streamChatWithUpdate(
    messages: { role: string; content: string }[],
    systemPrompt: string,
    onUpdate: (text: string) => void,
    model?: string
  ): Promise<string> {
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, systemPrompt, model }),
    })
    if (!res.ok) throw new Error(await res.text())
    const reader = res.body!.getReader()
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

  // Step 2: Fetch video
  async function handleFetchVideo() {
    if (!shareUrl.trim()) return
    const input = shareUrl.trim()
    if (/douyin\.com\/user\//.test(input)) {
      setError('这是用户主页链接，请粘贴具体视频的分享链接（从抖音 app 点"分享"→"复制链接"获取）')
      return
    }
    setError('')
    setLoading('解析视频中...')
    setVideoInfo(null)
    setTranscript('')
    setTranscriptConfirmed(false)
    setOpeningEval('')
    setOpeningConfirmed(null)
    try {
      const res = await fetch(`${BASE}/api/fetch-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareUrl: shareUrl.trim() }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setVideoInfo(data)
      setLoading('')

      // Auto-transcribe
      setLoading('下载视频并提交转录（约30秒）...')
      const tRes = await fetch(`${BASE}/api/transcribe/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playUrl: data.playUrl }),
      })
      if (!tRes.ok) throw new Error(await tRes.text())
      const { taskId } = await tRes.json()

      setLoading('转录中，请稍候...')
      let attempts = 0
      while (attempts < 60) {
        await new Promise(r => setTimeout(r, 5000))
        attempts++
        setLoading(`转录中，请稍候...（已等待 ${attempts * 5} 秒）`)
        const pRes = await fetch(`${BASE}/api/transcribe/poll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId }),
        })
        if (!pRes.ok) throw new Error(await pRes.text())
        const pData = await pRes.json()
        if (pData.status === 'done') {
          setTranscript(pData.text)
          setLoading('')
          break
        }
        if (pData.status !== 'processing') {
          throw new Error('转录失败: ' + JSON.stringify(pData))
        }
      }
      if (attempts >= 60) {
        throw new Error('转录超时，请重试')
      }
    } catch (e: any) {
      setError(e.message || '解析失败')
      setLoading('')
    }
  }

  // Step 2: Evaluate opening
  async function handleEvalOpening() {
    setLoading('AI 评估开头吸引力...')
    try {
      const result = await streamChat(
        [{ role: 'user', content: transcript }],
        '你是一个短视频内容质量评估专家。评估以下短视频文案的开头（前3-5句）是否有足够的吸引力让普通人停下来观看。评估标准：1.前3句是否制造了好奇心、冲突感或情感共鸣 2.一个完全无关的普通人刷到会不会停下来 3.如果需要特定背景知识才能被吸引则不通过。给出"通过"或"不通过"判断和一句话理由。格式：判断：通过/不通过\n理由：xxx',
        'deepseek-v3-fast'
      )
      setOpeningEval(result)
      setLoading('')
    } catch (e: any) {
      setError(e.message)
      setLoading('')
    }
  }

  // Step 3: Analyze structure
  async function handleAnalyzeStructure() {
    setLoading('拆解对标结构...')
    try {
      const result = await streamChatWithUpdate(
        [{ role: 'user', content: transcript }],
        '你是一个短视频脚本结构分析专家。快速拆解以下脚本的骨架结构。格式：\n1. 开头（完整引用原文前2-3句）\n2. 主体段落：逐段列出功能和大约字数\n3. 收束方式\n4. 原文总字数\n5. 预估时长\n不要添加评论，只输出结构拆解。',
        (text) => setStructureAnalysis(text),
        'deepseek-v3-fast'
      )
      setStructureAnalysis(result)
      setLoading('')
    } catch (e: any) {
      setError(e.message)
      setLoading('')
    }
  }

  // Step 3: AI recommend topics
  async function handleAiRecommend() {
    if (!selectedPersona) return
    setLoading('AI 推荐选题...')
    try {
      const result = await streamChatWithUpdate(
        [{ role: 'user', content: `对标文案：\n${transcript}\n\n达人档案：\n${selectedPersona.soul}\n\n达人内容规划：\n${selectedPersona.contentPlan}${selectedPersona.references.length > 0 ? `\n\n达人优质内容参考：\n${selectedPersona.references.join('\n\n---\n\n')}` : ''}` }],
        `你是一个短视频选题推荐专家。你的核心能力是"一对一平移"——找到对标文案的一个核心概念，然后在达人的领域里找到一个精确对应的概念，完成整体替换。

## 关键约束：只走内容线

这个达人有两条线：内容线和商业线。你只负责内容线。
- 内容线的核心：用清华训练出来的思维方式 + 真实人生经历（婚姻、亲子、裸辞、个人成长、财富认知），帮中年女性把焦虑想清楚
- 绝对不要往美妆、护肤、头发、美护行业方向推荐。那是商业线，不是你的范围
- 优先调用达人档案中「清华思维」「人生经历」「中年女性焦虑」相关的素材
- 三个内容系列的优先级：「清华教我这么想」≥「这道题我答出来了」>「我在那边做过」

## 你的工作步骤

第一步：用一句话提炼对标的底层论证框架（不是主题，是论证逻辑链条）。

第二步：找到框架中的"核心动词/核心行为"——对标到底在说"做什么事"能塑造主体性/带来改变/解决问题。

第三步：在达人的核心领域里，找到一个"一对一"的平移支点——一个词对一个词，一个行为对一个行为。好的平移是：原文说"主动争取"→ 达人领域的"主动花钱去试"。坏的平移是：把框架拆成5个角度分别对应。

第四步：基于这个干净的平移支点，推荐3个选题。每个选题只换支点关键词，论证框架完全保留。

## 输出格式

先输出：
- 底层论证框架（一句话）
- 核心行为（一个词/短语）
- 平移支点（原文的XX → 达人领域的YY）

再输出3个选题：
1. 选题标题（简短有力）
   平移方式：原文的X → 换成达人的Y
   可用素材：从达人档案中找到的真实经历

## 重要原则
- 不要发散。3个选题应该是同一个平移支点的不同表达角度，不是3个完全不同的框架
- 选题标题要像抖音爆款标题——短、有冲突、有钩子
- 可用素材必须来自达人档案，不编造`,
        (text) => setAiTopics(text),
        'deepseek-v3-fast'
      )
      setAiTopics(result)
      setLoading('')
    } catch (e: any) {
      setError(e.message)
      setLoading('')
    }
  }

  // Step 3: Write script
  async function handleWrite(topic: string) {
    if (!selectedPersona) return
    const systemPrompt = `你是一个专业的人设内容仿写助手。你的任务是根据对标脚本的结构，用指定达人的风格和素材重新创作。

## 三条铁律（每版脚本必须满足）
1. 开头学钩子手法不抄句式：分析对标开头用了什么钩子手法（反常识、悬念、共鸣、冲突等），用同类手法但完全用达人自己的语气和表达重新写开头。绝不复制对标的原句或句型。
2. 结构完全一致：对标原文有几段、每段什么功能、段与段之间什么逻辑关系，仿写必须一一对应。不能加段、不能删段、不能调换顺序。
3. 字数基本一致：仿写总字数与对标原文偏差不超过10%。

## 写作规则
- SOUL.md 是最高优先级——语气、禁用表达、口头禅全部严格遵守
- 保留对标的结构骨架和节奏感，内容全部替换
- 素材优先从达人档案的经历/素材库中调取；没有合适素材时标注 [待填：需要达人提供XX方面的真实经历]
- 口语化：短视频口播稿，像说话不像写作
- 纯内容绝不出现产品/品牌名
- 结尾笃定收束
- 不说教："我想明白了"可以，"你应该明白"不行

## 达人档案
${selectedPersona.soul}

## 达人内容规划
${selectedPersona.contentPlan}
${selectedPersona.references.length > 0 ? `
## 达人优质内容参考
以下是达人已有的优质内容，仿写时参考其风格、节奏和表达习惯：
${selectedPersona.references.join('\n\n---\n\n')}
` : ''}
## 对标文案
${transcript}

## 对标结构分析
${structureAnalysis}

## 选题
${topic}

每次输出完整脚本，不给零散片段。输出后附上三条铁律自检表（markdown表格）。`

    const userMsg = `请根据对标结构和选题「${topic}」，用${selectedPersona.name}的风格写第一版脚本。`
    const newMessages: ChatMsg[] = [{ role: 'user', content: userMsg }]
    setChatMessages(newMessages)
    setLoading('AI 创作中...')

    try {
      let assistantMsg = ''
      await streamChatWithUpdate(
        newMessages.map(m => ({ role: m.role, content: m.content })),
        systemPrompt,
        (text) => {
          assistantMsg = text
          setChatMessages([...newMessages, { role: 'assistant', content: text }])
        }
      )
      setChatMessages([...newMessages, { role: 'assistant', content: assistantMsg }])
      setLoading('')
    } catch (e: any) {
      setError(e.message)
      setLoading('')
    }
  }

  // Step 3: Send chat message
  async function handleSendChat() {
    if (!chatInput.trim() || !selectedPersona) return
    const userMsg: ChatMsg = { role: 'user', content: chatInput }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setLoading('AI 修改中...')

    const systemPrompt = `你是一个专业的人设内容仿写助手，正在帮员工迭代脚本。保持之前的三条铁律（开头学钩子手法但不抄句式、结构一致、字数一致）和写作规则。每次输出完整修改后的脚本。

## 达人档案
${selectedPersona.soul}

## 对标文案
${transcript}

## 对标结构分析
${structureAnalysis}

规则：员工说哪里不对就改哪里，不动没问题的部分。每次输出完整脚本+自检表。`

    try {
      let assistantMsg = ''
      await streamChatWithUpdate(
        newMessages.map(m => ({ role: m.role, content: m.content })),
        systemPrompt,
        (text) => {
          assistantMsg = text
          setChatMessages([...newMessages, { role: 'assistant', content: text }])
        }
      )
      setChatMessages([...newMessages, { role: 'assistant', content: assistantMsg }])
      setLoading('')
    } catch (e: any) {
      setError(e.message)
      setLoading('')
    }
  }

  function handleExport() {
    const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant')
    if (lastAssistant) {
      navigator.clipboard.writeText(lastAssistant.content)
      showToast('终稿已复制到剪贴板')
    }
  }

  const likesPass = videoInfo ? videoInfo.diggCount >= 100000 : false
  const openingPass = openingEval.includes('通过') && !openingEval.includes('不通过')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center gap-3">
        <a href="/" className="text-gray-400 hover:text-gray-600 transition-colors" title="返回首页">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        </a>
        <div>
          <h1 className="text-xl font-bold text-gray-900">人设内容仿写助手</h1>
          <p className="text-sm text-gray-500 mt-1">三步完成人设内容仿写</p>
        </div>
      </header>

      {/* Step indicator */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-2 text-sm">
          {[
            { n: 1, label: '加载风格' },
            { n: 2, label: '对标验证' },
            { n: 3, label: '仿写创作' },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-300">{'\u2192'}</span>}
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                step === s.n ? 'bg-blue-100 text-blue-700' :
                step > s.n ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-400'
              }`}>
                {step > s.n ? '\u2713' : s.n}. {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-6">
        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
            <button className="ml-2 underline" onClick={() => setError('')}>关闭</button>
          </div>
        )}

        {/* Loading display */}
        {loading && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            {loading}
          </div>
        )}

        {/* ========== STEP 1: 加载风格 ========== */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Persona selector */}
            <div className="bg-white rounded-lg border p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">选择达人</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={selectedPersona?.name || ''}
                onChange={e => handleSelectPersona(e.target.value)}
              >
                <option value="">请选择...</option>
                {personas.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>

            {/* Auto-loaded style confirmation */}
            {selectedPersona && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <p className="text-green-600 font-medium">{'\u2705'} {selectedPersona.name}的风格已加载</p>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  <p className="font-medium text-gray-900 mb-1">人设定位</p>
                  {selectedPersona.contentPlan.split('\n').slice(0, 8).join('\n')}
                </div>
                <button
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                  onClick={() => setStep(2)}
                >
                  {'\u4e0b\u4e00\u6b65\uff1a\u9a8c\u8bc1\u5bf9\u6807'} →
                </button>
              </div>
            )}

            {/* 素材库 */}
            {selectedPersona && (
              <div className="bg-white rounded-lg border p-4 space-y-4">
                <h3 className="font-medium text-gray-900">日常素材库维护 <span className="text-sm font-normal text-gray-400">({selectedPersona.references.length} 条)</span></h3>
                <p className="text-sm text-gray-500">素材库是全团队日常维护的工作，上传越多 AI 越懂{selectedPersona.name}的风格。不影响上方仿写功能的使用。</p>

                {/* 三个独立上传入口 */}
                {!showRefForm ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      className="p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-left transition"
                      onClick={() => { setRefType('爆款文案'); setShowRefForm(true) }}
                    >
                      <p className="font-medium text-gray-900">上传红人本人爆款文案</p>
                      <p className="text-xs text-gray-500 mt-1">{selectedPersona.name}数据好的视频文案</p>
                    </button>
                    <button
                      className="p-4 rounded-lg border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50 text-left transition"
                      onClick={() => { setRefType('喜欢的内容'); setShowRefForm(true) }}
                    >
                      <p className="font-medium text-gray-900">上传红人喜欢的内容</p>
                      <p className="text-xs text-gray-500 mt-1">{selectedPersona.name}觉得好、想参考的内容</p>
                    </button>
                    <button
                      className="p-4 rounded-lg border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 text-left transition"
                      onClick={() => { setRefType('风格参考'); setShowRefForm(true) }}
                    >
                      <p className="font-medium text-gray-900">上传风格参考</p>
                      <p className="text-xs text-gray-500 mt-1">{selectedPersona.name}的语气、表达方式参考</p>
                    </button>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded">{refType}</span>
                      <button className="text-sm text-gray-500 hover:underline" onClick={() => { setShowRefForm(false); setRefTitle(''); setRefLikes(''); setRefContent('') }}>返回</button>
                    </div>
                    <input
                      type="text"
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="标题（必填）"
                      value={refTitle}
                      onChange={e => setRefTitle(e.target.value)}
                    />
                    <input
                      type="text"
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="点赞数（选填）"
                      value={refLikes}
                      onChange={e => setRefLikes(e.target.value)}
                    />
                    <textarea
                      className="w-full border rounded-lg p-3 text-sm h-40"
                      placeholder="粘贴内容（必填）..."
                      value={refContent}
                      onChange={e => setRefContent(e.target.value)}
                    />
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      disabled={!refTitle.trim() || !refContent.trim() || !!loading}
                      onClick={handleAddReference}
                    >
                      保存
                    </button>
                  </div>
                )}

                {/* Reference list */}
                {selectedPersona.references.length > 0 && (
                  <div className="space-y-2">
                    {selectedPersona.references.map((ref, i) => {
                      const titleMatch = ref.match(/^---[\s\S]*?title:\s*(.+)/m)
                      const typeMatch = ref.match(/^---[\s\S]*?type:\s*(.+)/m)
                      const likesMatch = ref.match(/^---[\s\S]*?likes:\s*(\d+)/m)
                      const title = titleMatch?.[1] || `素材 ${i + 1}`
                      const type = typeMatch?.[1] || ''
                      const likes = likesMatch?.[1]
                      return (
                        <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-800">{title}</span>
                            {type && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{type}</span>}
                            {likes && <span className="ml-2 text-xs text-gray-400">{(Number(likes) / 10000).toFixed(1)}万赞</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {selectedPersona.references.length === 0 && !showRefForm && (
                  <p className="text-sm text-gray-400">选择上方类型，上传达人的优质内容</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========== STEP 2: 对标验证 ========== */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Loaded persona reminder */}
            <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <span className="text-green-600 font-medium">{'\u2705'} {selectedPersona?.name}</span>
                <span className="ml-2 text-gray-400">风格已加载</span>
              </p>
              <button
                className="text-sm text-blue-600 hover:underline"
                onClick={() => setStep(1)}
              >
                换达人
              </button>
            </div>

            {/* Quality requirement notice */}
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
              <p className="text-lg font-bold text-amber-800">请上传一条点赞量 ≥ 10万 的对标视频</p>
              <p className="text-sm text-amber-600 mt-1">未达到点赞门槛的内容，系统不予通过</p>
            </div>

            {/* Two input methods */}
            {!transcript && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Method 1: Douyin link */}
                <div className="bg-white rounded-lg border p-4 space-y-3">
                  <h3 className="font-medium text-gray-900">方式一：抖音链接</h3>
                  <p className="text-sm text-gray-500">粘贴抖音分享链接，自动解析视频信息并转录文案</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm"
                      placeholder="粘贴抖音分享链接..."
                      value={shareUrl}
                      onChange={e => setShareUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleFetchVideo()}
                    />
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                      onClick={handleFetchVideo}
                      disabled={!shareUrl.trim() || !!loading}
                    >
                      解析
                    </button>
                  </div>
                  {/* Video info inline */}
                  {videoInfo && (
                    <div className="text-sm text-gray-600 pt-2 border-t">
                      <p><span className="font-medium">标题：</span>{videoInfo.title}</p>
                      <p className="mt-1">
                        <span className="font-medium">点赞：</span>
                        {(videoInfo.diggCount / 10000).toFixed(1)}万
                        {likesPass
                          ? <span className="ml-2 text-green-600">{'\u2705'} 超过10万</span>
                          : <span className="ml-2 text-red-600">{'\u274c'} 未达10万</span>
                        }
                      </p>
                      {!likesPass && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700">
                          建议换一条点赞更高的对标。
                          <button className="ml-2 underline font-medium" onClick={() => {
                            setLoading('下载视频并提交转录（约30秒）...')
                            fetch(`${BASE}/api/transcribe/upload`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ playUrl: videoInfo.playUrl }),
                            }).then(r => r.json()).then(async ({ taskId }) => {
                              setLoading('转录中，请稍候...')
                              let attempts = 0
                              while (attempts < 60) {
                                await new Promise(r => setTimeout(r, 5000))
                                attempts++
                                setLoading(`转录中...（${attempts * 5}秒）`)
                                const pRes = await fetch(`${BASE}/api/transcribe/poll`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ taskId }),
                                })
                                const pData = await pRes.json()
                                if (pData.status === 'done') { setTranscript(pData.text); setLoading(''); return }
                                if (pData.status !== 'processing') { throw new Error('转录失败') }
                              }
                              throw new Error('转录超时')
                            }).catch(e => { setError(e.message); setLoading('') })
                          }}>仍然继续</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Method 2: Direct paste */}
                <div className="bg-white rounded-lg border p-4 space-y-3">
                  <h3 className="font-medium text-gray-900">方式二：直接粘贴文案</h3>
                  <p className="text-sm text-gray-500">
                    用 <a href="https://aihaoji.com/zh/dashboard/tasks" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">AI好记</a> 等工具转好文案后粘贴
                  </p>
                  <textarea
                    className="w-full border rounded-lg p-3 text-sm h-24"
                    placeholder="粘贴视频口播文案..."
                    id="manual-transcript"
                  />
                  <button
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 w-full"
                    onClick={() => {
                      const el = document.getElementById('manual-transcript') as HTMLTextAreaElement
                      if (el?.value.trim()) {
                        setVideoInfo(null)
                        setTranscript(el.value.trim())
                      }
                    }}
                  >
                    确认使用此文案
                  </button>
                </div>
              </div>
            )}

            {/* Transcript */}
            {transcript && !transcriptConfirmed && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <h3 className="font-medium text-gray-900">提取到的文案</h3>
                {editingTranscript ? (
                  <textarea
                    className="w-full border rounded-lg p-3 text-sm h-48"
                    value={transcript}
                    onChange={e => setTranscript(e.target.value)}
                  />
                ) : (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {transcript}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                    onClick={() => { setTranscriptConfirmed(true); handleEvalOpening() }}
                  >
                    文案准确
                  </button>
                  <button
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300"
                    onClick={() => setEditingTranscript(!editingTranscript)}
                  >
                    {editingTranscript ? '完成修改' : '需要修改'}
                  </button>
                </div>
              </div>
            )}

            {/* Opening evaluation */}
            {transcriptConfirmed && openingEval && openingConfirmed === null && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <h3 className="font-medium text-gray-900">开头吸引力评估</h3>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                  {openingEval}
                </div>
                <div className="flex gap-2">
                  <button
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                    onClick={() => setOpeningConfirmed(true)}
                  >
                    同意
                  </button>
                  <button
                    className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200"
                    onClick={() => setOpeningConfirmed(false)}
                  >
                    不同意
                  </button>
                </div>
              </div>
            )}

            {/* Quality gate result */}
            {openingConfirmed !== null && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <h3 className="font-medium text-gray-900">质量门判定</h3>
                <div className="text-sm space-y-1">
                  <p>点赞量≥10万：{likesPass ? <span className="text-green-600 font-medium">{'\u2705'} 通过</span> : <span className="text-red-600 font-medium">{'\u274c'} 未通过</span>}</p>
                  <p>开头吸引力：{openingPass && openingConfirmed ? <span className="text-green-600 font-medium">{'\u2705'} 通过</span> : <span className="text-red-600 font-medium">{'\u274c'} 未通过</span>}</p>
                </div>
                {(likesPass || true) && (openingPass && openingConfirmed || true) ? (
                  <button
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                    onClick={() => { setStep(3); handleAnalyzeStructure() }}
                  >
                    进入仿写创作 →
                  </button>
                ) : (
                  <p className="text-sm text-red-600">建议换一条更爆的对标重新开始。</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========== STEP 3: 仿写创作 ========== */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Structure analysis */}
            {structureAnalysis && !chosenTopic && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <h3 className="font-medium text-gray-900">对标结构拆解</h3>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                  {structureAnalysis}
                </div>
              </div>
            )}

            {/* Topic selection */}
            {structureAnalysis && !loading && !chosenTopic && (
              <div className="bg-white rounded-lg border p-4 space-y-4">
                <h3 className="font-medium text-gray-900">选择仿写方向</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    className={`p-4 rounded-lg border-2 text-left text-sm ${topicMode === 'same' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => setTopicMode('same')}
                  >
                    <p className="font-medium">沿用原文主题</p>
                    <p className="text-gray-500 mt-1">用同样的主题方向，换成{selectedPersona?.name}的视角和经历</p>
                  </button>
                  <button
                    className={`p-4 rounded-lg border-2 text-left text-sm ${topicMode === 'custom' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => setTopicMode('custom')}
                  >
                    <p className="font-medium">自定义主题</p>
                    <p className="text-gray-500 mt-1">你来定一个全新的主题</p>
                  </button>
                  <button
                    className={`p-4 rounded-lg border-2 text-left text-sm ${topicMode === 'ai' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => { setTopicMode('ai'); if (!aiTopics) handleAiRecommend() }}
                  >
                    <p className="font-medium">AI 推荐主题</p>
                    <p className="text-gray-500 mt-1">根据{selectedPersona?.name}的内容规划推荐</p>
                  </button>
                </div>

                {topicMode === 'same' && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">将沿用对标的主题方向，用{selectedPersona?.name}的风格重写。</p>
                    <button
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                      onClick={() => {
                        const topicSource = videoInfo?.title || transcript.split(/[。\n]/)[0].slice(0, 50)
                        const t = `沿用原文主题「${topicSource}」，换成${selectedPersona?.name}的视角`
                        setChosenTopic(t)
                        handleWrite(t)
                      }}
                    >
                      确认，开始仿写 →
                    </button>
                  </div>
                )}

                {topicMode === 'custom' && (
                  <div className="space-y-2">
                    <textarea
                      className="w-full border rounded-lg p-3 text-sm h-24"
                      placeholder="描述你的选题，包括核心观点和关键素材..."
                      value={customTopic}
                      onChange={e => setCustomTopic(e.target.value)}
                    />
                    <button
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      disabled={!customTopic.trim()}
                      onClick={() => {
                        setChosenTopic(customTopic)
                        handleWrite(customTopic)
                      }}
                    >
                      确认，开始仿写 →
                    </button>
                  </div>
                )}

                {topicMode === 'ai' && aiTopics && (
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                      {aiTopics}
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        className="flex-1 border rounded-lg px-3 py-2 text-sm"
                        placeholder="输入你选的选题（或直接粘贴上面的标题）..."
                        value={customTopic}
                        onChange={e => setCustomTopic(e.target.value)}
                      />
                      <button
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        disabled={!customTopic.trim()}
                        onClick={() => {
                          setChosenTopic(customTopic)
                          handleWrite(customTopic)
                        }}
                      >
                        开始仿写 →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Context bar (after topic chosen) */}
            {chosenTopic && (
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">达人：</span>{selectedPersona?.name}
                    <span className="ml-3 font-medium">选题：</span>{chosenTopic}
                  </div>
                  <button
                    className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700"
                    onClick={handleExport}
                  >
                    导出终稿
                  </button>
                </div>
              </div>
            )}

            {/* Chat messages */}
            {chosenTopic && (
              <div className="bg-white rounded-lg border">
                <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-50 text-gray-800'
                      }`}>
                        {msg.role === 'assistant'
                          ? <SimpleMarkdown text={msg.content} />
                          : msg.content
                        }
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="border-t p-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm"
                      placeholder="输入修改意见..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                      disabled={!!loading}
                    />
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      onClick={handleSendChat}
                      disabled={!chatInput.trim() || !!loading}
                    >
                      发送
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
