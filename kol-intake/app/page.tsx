'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { questions, type Question } from '@/lib/questions'

interface Message {
  role: 'ai' | 'user'
  text: string
  type?: 'section' | 'question' | 'hint' | 'report' | 'typing'
}

export default function KolIntakePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [currentQ, setCurrentQ] = useState(-1)
  const [input, setInput] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [reportText, setReportText] = useState('')
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [started, setStarted] = useState(false)

  // multi-collect state
  const [collectCount, setCollectCount] = useState(0)
  const [collectItems, setCollectItems] = useState<string[]>([])

  // 已有提交记录提示（覆盖式修改）
  const [existingSubmittedAt, setExistingSubmittedAt] = useState<string | null>(null)

  // Use refs to avoid stale closures in async functions
  const currentQRef = useRef(currentQ)
  const collectCountRef = useRef(collectCount)
  const collectItemsRef = useRef(collectItems)
  useEffect(() => { currentQRef.current = currentQ }, [currentQ])
  useEffect(() => { collectCountRef.current = collectCount }, [collectCount])
  useEffect(() => { collectItemsRef.current = collectItems }, [collectItems])

  const scroll = () => { setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100) }

  useEffect(() => {
    if (!started) {
      setMessages([
        { role: 'ai', text: '你好呀！我是团队里专门负责了解新伙伴的，接下来我们就轻松聊聊，我想听听你的故事和想法，这样团队才能更懂你，帮你找到最适合你的内容方向。' },
        { role: 'ai', text: '不用紧张，就当跟朋友聊天就好，大概十来分钟。有些问题如果不想答可以跳过。准备好了就点下面的按钮～' },
      ])
      setStarted(true)
    }
  }, [started])

  // 进入页面时拉取自己的填写进度，已有提交则提示
  useEffect(() => {
    let cancelled = false
    fetch('/kol-intake/api/progress', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data) return
        if (data.submittedAt) {
          setExistingSubmittedAt(data.submittedAt)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => { scroll() }, [messages])
  useEffect(() => { if (currentQ >= 0 && !thinking) inputRef.current?.focus() }, [currentQ, thinking])

  const pushMsg = useCallback((...msgs: Message[]) => {
    setMessages(prev => [...prev, ...msgs])
  }, [])

  // Call AI bridge to get empathetic response
  const callBridge = async (params: {
    userAnswer: string
    questionText: string
    nextQuestionText?: string
    nextQuestionHint?: string
    isMultiCollect?: boolean
    collectCount?: number
    isLastQuestion?: boolean
    isSectionChange?: boolean
    nextSection?: string
  }): Promise<string> => {
    try {
      const res = await fetch('/kol-intake/api/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const data = await res.json()
      return data.reply || ''
    } catch {
      return ''
    }
  }

  const showQuestionOnly = (idx: number) => {
    const q = questions[idx]
    setCurrentQ(idx)
    if (q.type === 'multi-collect') {
      setCollectCount(0)
      setCollectItems([])
    }
  }

  const startQuestions = async () => {
    pushMsg({ role: 'user', text: '准备好了！' })
    setThinking(true)

    // Show first question via AI bridge
    const firstQ = questions[0]
    const reqLabel = firstQ.required ? '（必填）' : '（选填）'

    setTimeout(() => {
      pushMsg(
        { role: 'ai', text: `好，那我们开始吧！先来认识一下你——${firstQ.question}` },
      )
      if (firstQ.hint) {
        pushMsg({ role: 'ai', text: firstQ.hint, type: 'hint' })
      }
      showQuestionOnly(0)
      setThinking(false)
    }, 500)
  }

  const isDoneKeyword = (val: string) => {
    const lower = val.trim().toLowerCase()
    return ['没了', '没有了', '就这些', '没有', '没', '无', '就这样', 'no', '算了'].includes(lower)
  }

  const handleSubmitAnswer = async () => {
    const val = input.trim()
    if (!val || thinking) return

    const qIdx = currentQRef.current
    const q = questions[qIdx]
    const isSkip = val === '跳过' || val === '跳'

    if (q.required && isSkip) {
      pushMsg({ role: 'ai', text: '这道题挺重要的，尽量填一下吧～' })
      return
    }

    pushMsg({ role: 'user', text: val })
    setInput('')
    setThinking(true)

    // Handle multi-collect
    if (q.type === 'multi-collect' && !isSkip) {
      const isDone = isDoneKeyword(val)
      const curCollectCount = collectCountRef.current
      const curCollectItems = collectItemsRef.current

      if (isDone && curCollectCount === 0 && q.required) {
        pushMsg({ role: 'ai', text: '这道题挺重要的，至少说一个吧～' })
        setThinking(false)
        return
      }

      if (isDone) {
        // Save collected items and move on
        if (curCollectItems.length > 0) {
          const combined = curCollectItems.join('\n---\n')
          setAnswers(prev => ({ ...prev, [q.id]: combined }))
        }
        setCollectCount(0)
        setCollectItems([])
        await transitionToNext(qIdx, val)
        return
      }

      // Collect new item
      const newCount = curCollectCount + 1
      const newItems = [...curCollectItems, val]
      setCollectCount(newCount)
      setCollectItems(newItems)

      if (newCount >= (q.collectMax || 3)) {
        // Reached max
        const combined = newItems.join('\n---\n')
        setAnswers(prev => ({ ...prev, [q.id]: combined }))
        setCollectCount(0)
        setCollectItems([])
        await transitionToNext(qIdx, val)
      } else {
        // Ask for more via AI
        const reply = await callBridge({
          userAnswer: val,
          questionText: q.question,
          isMultiCollect: true,
          collectCount: newCount,
        })
        if (reply) {
          pushMsg({ role: 'ai', text: reply })
        } else {
          pushMsg({ role: 'ai', text: '还有没有其他的？没有的话输入"没了"就行。' })
        }
        setThinking(false)
      }
      return
    }

    // Normal question - save answer and transition
    if (!isSkip) {
      setAnswers(prev => ({ ...prev, [q.id]: val }))
    }

    await transitionToNext(qIdx, isSkip ? '' : val)
  }

  const transitionToNext = async (qIdx: number, userAnswer: string) => {
    const q = questions[qIdx]
    const nextIdx = qIdx + 1
    const isLast = nextIdx >= questions.length

    if (isLast) {
      // Last question - finish
      const reply = await callBridge({
        userAnswer,
        questionText: q.question,
        isLastQuestion: true,
      })
      if (reply) {
        pushMsg({ role: 'ai', text: reply })
      } else {
        pushMsg({ role: 'ai', text: '所有问题都聊完了，辛苦了！点击下方按钮提交，我来帮你生成一份分析报告。' })
      }
      setDone(true)
      setThinking(false)
      return
    }

    const nextQ = questions[nextIdx]
    const isSectionChange = nextQ.section !== q.section

    // Call AI bridge for empathetic response + natural transition
    const reply = await callBridge({
      userAnswer,
      questionText: q.question,
      nextQuestionText: nextQ.question,
      nextQuestionHint: nextQ.hint,
      isSectionChange,
      nextSection: isSectionChange ? nextQ.section : undefined,
    })

    if (reply) {
      pushMsg({ role: 'ai', text: reply })
      // Show hint if exists (AI already asked the question in its own words)
      if (nextQ.hint) {
        setTimeout(() => {
          pushMsg({ role: 'ai', text: nextQ.hint, type: 'hint' })
        }, 300)
      }
    } else {
      // Fallback if AI bridge fails
      const reqLabel = nextQ.required ? '（必填）' : '（选填，可输入"跳过"）'
      pushMsg({ role: 'ai', text: `${nextQ.question} ${reqLabel}` })
      if (nextQ.hint) pushMsg({ role: 'ai', text: nextQ.hint, type: 'hint' })
    }

    showQuestionOnly(nextIdx)
    setThinking(false)
  }

  const handleFinalSubmit = async () => {
    setSubmitting(true)
    pushMsg({ role: 'ai', text: '正在帮你生成分析报告，需要一点时间，请稍等...' })
    try {
      const res = await fetch('/kol-intake/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (res.ok) {
        setSubmitted(true)
        if (data.report) {
          setReportText(data.report)
          pushMsg(
            { role: 'ai', text: '报告出来了，你看看：' },
            { role: 'ai', text: data.report, type: 'report' },
            { role: 'ai', text: '这份报告已经保存了，团队会参考这些信息来帮你做人格档案和内容规划。感谢你花时间跟我聊这些！' },
          )
        } else {
          pushMsg({ role: 'ai', text: '提交成功了！你的信息已经保存，团队会尽快看。感谢你花时间跟我聊这些！' })
        }
      } else {
        pushMsg({ role: 'ai', text: '提交出了点问题，稍后再试试？' })
      }
    } catch {
      pushMsg({ role: 'ai', text: '网络好像不太好，检查一下网络再试试？' })
    }
    setSubmitting(false)
  }

  const handleSkip = () => {
    const q = questions[currentQ]
    pushMsg({ role: 'user', text: '跳过' })

    if (q.type === 'multi-collect' && collectItems.length > 0) {
      const combined = collectItems.join('\n---\n')
      setAnswers(prev => ({ ...prev, [q.id]: combined }))
      setCollectCount(0)
      setCollectItems([])
    }

    setThinking(true)
    transitionToNext(currentQ, '')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmitAnswer()
    }
  }

  const progress = currentQ >= 0 ? Math.round(((currentQ + (done ? 1 : 0)) / questions.length) * 100) : 0

  const currentPlaceholder = (() => {
    if (currentQ < 0) return '输入...'
    const q = questions[currentQ]
    if (q.type === 'multi-collect' && collectCount > 0) {
      return `第 ${collectCount + 1} 条...（输入"没了"跳过）`
    }
    return q.placeholder || '输入...'
  })()

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">AI</div>
        <div className="flex-1">
          <div className="font-semibold text-sm">红人信息采集助手</div>
          <div className="text-xs text-gray-400">{thinking ? '正在输入...' : '在线'}</div>
        </div>
        {currentQ >= 0 && (
          <div className="text-xs text-gray-400 flex items-center gap-2">
            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            {progress}%
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-2xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-purple-600 text-white rounded-br-md'
                : msg.type === 'hint'
                ? 'bg-purple-50 text-gray-500 text-xs rounded-bl-md border border-purple-100'
                : msg.type === 'section'
                ? 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 font-medium rounded-bl-md border border-purple-100'
                : msg.type === 'report'
                ? 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-purple-200 text-xs leading-relaxed'
                : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-400 rounded-2xl rounded-bl-md shadow-sm px-4 py-2.5 text-sm">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>·</span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 max-w-2xl mx-auto w-full">
        {!started ? null : currentQ < 0 && !done ? (
          <>
            {existingSubmittedAt && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-purple-50 border border-purple-100 text-xs text-purple-700">
                你之前已经填过（{existingSubmittedAt}）。重新填写会在原有答案上覆盖（没答的题保留之前的答案）。
              </div>
            )}
            <button onClick={startQuestions}
              className="w-full py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition">
              {existingSubmittedAt ? '重新填写' : '开始聊吧'}
            </button>
          </>
        ) : done && !submitted ? (
          <button onClick={handleFinalSubmit} disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50">
            {submitting ? '正在生成分析报告...' : '提交并生成分析报告'}
          </button>
        ) : submitted ? (
          <div className="text-center py-2 space-y-2">
            <div className="text-gray-400 text-sm">聊完了，感谢！</div>
            {reportText && (
              <button
                onClick={() => {
                  const nickname = answers.nickname || '未命名'
                  const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${nickname}-分析报告.txt`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-50 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-100 transition"
              >
                下载分析报告
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentPlaceholder}
              rows={1}
              disabled={thinking}
              className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200 max-h-32 overflow-y-auto disabled:opacity-50"
              style={{ minHeight: '40px' }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 128) + 'px'
              }}
            />
            <button onClick={handleSubmitAnswer} disabled={!input.trim() || thinking}
              className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center hover:bg-purple-700 transition disabled:opacity-30 shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
            </button>
          </div>
        )}
        {currentQ >= 0 && !done && !thinking && !questions[currentQ]?.required && (
          <button onClick={handleSkip}
            className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600 transition">
            跳过这道题 →
          </button>
        )}
      </div>
    </div>
  )
}
