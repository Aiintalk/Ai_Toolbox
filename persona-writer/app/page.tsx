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
  const [userRole, setUserRole] = useState<'admin' | 'employee' | 'kol' | null>(null)
  const [userName, setUserName] = useState<string>('')

  // Step 2: 对标验证
  const [shareUrl, setShareUrl] = useState('')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [transcript, setTranscript] = useState('')
  const [transcriptConfirmed, setTranscriptConfirmed] = useState(false)
  const [editingTranscript, setEditingTranscript] = useState(false)
  const [manualTranscript, setManualTranscript] = useState(false)
  const [openingCheck, setOpeningCheck] = useState('')
  const [userAgree, setUserAgree] = useState<boolean | null>(null)

  // Step 3: 仿写创作
  const [structureAnalysis, setStructureAnalysis] = useState('')
  const [topicMode, setTopicMode] = useState<'same' | 'custom' | 'ai' | null>(null)
  const [customTopic, setCustomTopic] = useState('')
  const [aiTopics, setAiTopics] = useState('')
  const [chosenTopic, setChosenTopic] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // UI
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // 素材库
  const [showRefForm, setShowRefForm] = useState(false)
  const [refTitle, setRefTitle] = useState('')
  const [refLikes, setRefLikes] = useState('')
  const [refType, setRefType] = useState('人格档案')
  const [refContent, setRefContent] = useState('')

  useEffect(() => {
    fetch(`/material-library/api/personas`).then(r => r.json()).then(d => {
      const list = d.personas || []
      setPersonas(list)
      // KOL 自动锁定为自己的人格
      fetch(`/auth/api/me`).then(r => r.ok ? r.json() : null).then(me => {
        if (!me) return
        setUserRole(me.role)
        setUserName(me.username || '')
        if (me.role === 'kol' && me.username) {
          const own = list.find((p: Persona) => p.name === me.username)
          if (own) setSelectedPersona(own)
        }
      }).catch(() => {})
    })
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  async function reloadPersonas() {
    const d = await fetch(`/material-library/api/personas`).then(r => r.json())
    const list = d.personas || []
    setPersonas(list)
    if (selectedPersona) {
      const updated = list.find((p: Persona) => p.name === selectedPersona.name)
      if (updated) setSelectedPersona(updated)
    }
  }

  async function handleAddReference() {
    if (!selectedPersona || !refTitle.trim() || !refContent.trim()) return
    setLoading('保存素材...')
    try {
      const res = await fetch(`/material-library/api/personas/references`, {
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

  function handleSelectPersona(name: string) {
    const persona = personas.find(p => p.name === name) || null
    setSelectedPersona(persona)
  }

  async function streamChat(messages: { role: string; content: string }[], systemPrompt: string, model?: string): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, systemPrompt, model }),
      })
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 3000))
        continue
      }
      if (!res.ok) throw new Error('AI 服务暂时不可用，请稍后重试')
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
    throw new Error('AI 服务繁忙，请稍后重试')
  }

  async function streamChatWithUpdate(
    messages: { role: string; content: string }[],
    systemPrompt: string,
    onUpdate: (text: string) => void,
    model?: string
  ): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, systemPrompt, model }),
      })
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 3000))
        continue
      }
      if (!res.ok) throw new Error('AI 服务暂时不可用，请稍后重试')
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
    throw new Error('AI 服务繁忙，请稍后重试')
  }

  // ===== 解析视频 =====
  async function handleFetchVideo() {
    if (!shareUrl.trim()) return
    const url = shareUrl.trim()
    if (/douyin\.com\/user\//.test(url)) {
      setError('这是用户主页链接，请粘贴具体视频的分享链接（从抖音 app 点"分享"→"复制链接"获取）')
      return
    }
    setError('')
    setLoading('解析视频中...')
    setVideoInfo(null)
    setTranscript('')
    setTranscriptConfirmed(false)
    setOpeningCheck('')
    setUserAgree(null)
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
    } catch (e: any) {
      setError(e.message || '解析失败')
      setLoading('')
    }
  }

  // ===== 开头吸引力评估 =====
  async function checkOpening() {
    setLoading('AI 评估开头吸引力...')
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: transcript }],
          systemPrompt: '你是一个短视频内容质量评估专家。评估以下短视频文案的开头（前3-5句）是否有足够的吸引力让普通人停下来观看。评估标准：1.前3句是否制造了好奇心、冲突感或情感共鸣 2.一个完全无关的普通人刷到会不会停下来 3.如果需要特定背景知识才能被吸引则不通过。给出"通过"或"不通过"判断和一句话理由。格式：判断：通过/不通过\n理由：xxx',
          model: 'qwen-flash',
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) throw new Error('评估超时')
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
      }
      setOpeningCheck(full)
      setLoading('')
    } catch {
      // 超时或失败，自动跳过评估
      setOpeningCheck('评估超时，已自动跳过。你可以直接选择是否继续。')
      setLoading('')
    }
  }

  // ===== 对标结构拆解 =====
  async function analyzeStructure() {
    setLoading('拆解对标结构...')
    try {
      const result = await streamChatWithUpdate(
        [{ role: 'user', content: transcript }],
        '你是一个短视频脚本结构分析专家。快速拆解以下脚本的骨架结构。格式：\n1. 开头（完整引用原文前2-3句）\n2. 主体段落：逐段列出功能和大约字数\n3. 收束方式\n4. 原文总字数\n5. 预估时长\n不要添加评论，只输出结构拆解。',
        (text) => setStructureAnalysis(text),
        'qwen-flash'
      )
      setStructureAnalysis(result)
      setLoading('')
    } catch (e: any) {
      setError(e.message)
      setLoading('')
    }
  }

  // ===== AI 推荐选题 =====
  async function recommendTopics() {
    if (!selectedPersona) return
    setLoading('AI 推荐选题...')
    try {
      const userContent = `对标文案：\n${transcript}\n\n达人档案：\n${selectedPersona.soul}\n\n达人内容规划：\n${selectedPersona.contentPlan}${selectedPersona.references.length > 0 ? `\n\n达人优质内容参考：\n${selectedPersona.references.join('\n\n---\n\n')}` : ''}`

      const result = await streamChatWithUpdate(
        [{ role: 'user', content: userContent }],
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
        'qwen-flash'
      )
      setAiTopics(result)
      setLoading('')
    } catch (e: any) {
      setError(e.message)
      setLoading('')
    }
  }

  // ===== 仿写 =====
  async function handleWrite(topic: string) {
    if (!selectedPersona) return

    const systemPrompt = `你是一个专业的人设内容仿写助手。直接输出，不要提问，不要确认。

## 三条铁律（硬性，必须满足）
1. 不要写开头：开头由系统自动拼接对标原文的开头，你只负责从第二段开始写。绝不输出开头部分。
2. 结构完全一致：对标原文除开头外有几段、每段什么功能、段与段之间什么逻辑关系，仿写必须一一对应。不能加段、不能删段、不能调换顺序。
3. 字数只少不多：对标原文多少字，仿写就不能超过这个字数。宁可少10%，绝不多1%。短视频每多一个字观众就多一秒划走的理由。

## 优先级（从高到低）
1. 原文结构——对标文案的段落结构、节奏、逻辑链条是第一位的，必须极致一致
2. 分析结果——对标结构分析揭示了为什么这篇爆，仿写要保住这些爆点
3. 人格档案——辅助参考，了解达人调性即可，不要被它框住

## 创作指南
铁律之外，放开写。你的首要任务是写出有信息差、有金句、让人想看完的内容。
- 口语化：短视频口播稿，像说话不像写作
- 素材来源不限于达人本人经历——可以用达人朋友的故事、最近的热点事件、明星案例、社会现象，只要能支撑论点就行
- 不是每篇都需要个人经历，有信息差和洞察比硬塞经历更重要
- 纯内容绝不出现产品/品牌名
- 结尾笃定收束
- 不说教："我想明白了"可以，"你应该明白"不行

## 参考材料（辅助，不是束缚）
以下材料帮你了解这个达人是谁、她的调性是什么。写作时可以参考，但不要被它们框住——金句、信息差、打动人的表达才是第一位的。

### 达人档案
${selectedPersona.soul}

### 达人内容规划
${selectedPersona.contentPlan}
${selectedPersona.references.length > 0 ? `\n### 达人优质内容参考\n${selectedPersona.references.join('\n\n---\n\n')}\n` : ''}
## 对标文案
${transcript}

## 对标结构分析
${structureAnalysis}

## 选题
${topic}

## 输出格式
直接输出完整脚本正文（不含开头），然后附上：
- 总字数 | 对标原文字数 | 是否达标
- 三条铁律自检表（markdown表格）
- 原创度自检：逐段对比对标原文和你的仿写，列出相似度高的句子。如果整体文字重复率超过50%，标红提醒。`

    // 提取对标文案开头（前3句）
    const sentences = transcript.split(/(?<=[。！？\n])/).filter(s => s.trim())
    const opening = sentences.slice(0, 3).join('').trim()

    const msgs: ChatMsg[] = [{ role: 'user', content: `请根据对标结构和选题「${topic}」，用${selectedPersona.name}的风格写第一版脚本。注意：不要写开头，直接从正文开始。` }]
    setChatMessages(msgs)
    setLoading('AI 创作中...')
    try {
      let assistantMsg = ''
      const prefix = `${opening}\n\n`
      await streamChatWithUpdate(
        msgs.map(m => ({ role: m.role, content: m.content })),
        systemPrompt,
        (text) => {
          assistantMsg = text
          setChatMessages([...msgs, { role: 'assistant', content: prefix + text }])
        }
      )
      setChatMessages([...msgs, { role: 'assistant', content: prefix + assistantMsg }])
      setLoading('')
    } catch (e: any) {
      setError(e.message)
      setLoading('')
    }
  }

  // ===== 迭代修改 =====
  async function handleChatSend() {
    if (!chatInput.trim() || !selectedPersona) return
    const newMsgs: ChatMsg[] = [...chatMessages, { role: 'user', content: chatInput }]
    setChatMessages(newMsgs)
    setChatInput('')
    setLoading('AI 修改中...')

    const systemPrompt = `你是一个专业的人设内容仿写助手，正在帮员工迭代脚本。

## 铁律（硬性）
1. 不要写开头——开头由系统自动拼接，你从正文第二段写起
2. 结构完全一致——保持对标原文的段落结构
3. 字数只少不多——不能超过对标原文字数

## 优先级
原文结构 > 分析结果 > 人格档案（辅助参考）

铁律之外放开写，写出有信息差、有金句、让人想看完的内容。素材不限于达人本人——朋友的故事、热点事件、明星案例都可以用。

## 参考材料（辅助）
### 达人档案
${selectedPersona.soul}

### 对标文案
${transcript}

### 对标结构分析
${structureAnalysis}

员工说哪里不对就改哪里，不动没问题的部分。每次输出完整脚本+自检表+原创度自检。不要提问，直接改。`

    try {
      let assistantMsg = ''
      await streamChatWithUpdate(
        newMsgs.map(m => ({ role: m.role, content: m.content })),
        systemPrompt,
        (text) => {
          assistantMsg = text
          setChatMessages([...newMsgs, { role: 'assistant', content: text }])
        }
      )
      setChatMessages([...newMsgs, { role: 'assistant', content: assistantMsg }])
      setLoading('')
    } catch (e: any) {
      setError(e.message)
      setLoading('')
    }
  }

  function handleExport() {
    const lastMsg = [...chatMessages].reverse().find(m => m.role === 'assistant')
    if (lastMsg) {
      navigator.clipboard.writeText(lastMsg.content)
      showToast('终稿已复制到剪贴板')
    }
  }

  const likesPass = videoInfo ? videoInfo.diggCount >= 100000 : !!transcript
  const openingPass = openingCheck.includes('通过') && !openingCheck.includes('不通过')

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">
          {toast}
        </div>
      )}

      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">人设内容仿写助手</h1>
        <p className="text-sm text-gray-500 mt-1">三步完成人设内容仿写</p>
      </header>

      {/* 步骤条 */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-2 text-sm">
          {[{ n: 1, label: '加载风格' }, { n: 2, label: '对标验证' }, { n: 3, label: '仿写创作' }].map((s, idx) => (
            <div key={s.n} className="flex items-center gap-2">
              {idx > 0 && <span className="text-gray-300">→</span>}
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${step === s.n ? 'bg-blue-100 text-blue-700' : step > s.n ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {step > s.n ? '✓' : s.n}. {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-6">
        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
            <button className="ml-2 underline" onClick={() => setError('')}>关闭</button>
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {loading}
          </div>
        )}

        {/* ========== STEP 1: 加载风格 ========== */}
        {step === 1 && (
          <div className="space-y-4">
            {userRole !== 'kol' && (
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
            )}

            {selectedPersona && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <p className="text-green-600 font-medium">✅ {selectedPersona.name}的风格已加载</p>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  <p className="font-medium text-gray-900 mb-1">人设定位</p>
                  {selectedPersona.contentPlan.split('\n').slice(0, 8).join('\n')}
                </div>
                <button
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                  onClick={() => setStep(2)}
                >
                  下一步：验证对标 →
                </button>
              </div>
            )}

          </div>
        )}

        {/* ========== STEP 2: 对标验证 ========== */}
        {step === 2 && (
          <div className="space-y-4">
            {/* 达人信息条 */}
            <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <span className="text-green-600 font-medium">✅ {selectedPersona?.name}</span>
                <span className="ml-2 text-gray-400">风格已加载</span>
              </p>
              <button className="text-sm text-blue-600 hover:underline" onClick={() => setStep(1)}>换达人</button>
            </div>

            {/* 点赞门槛提示 */}
            {!transcript && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
              <p className="text-lg font-bold text-amber-800">请上传一条点赞量 ≥ 10万 的对标视频</p>
              <p className="text-sm text-amber-600 mt-1">未达到点赞门槛的内容，系统不予通过</p>
            </div>
            )}

            {/* 输入区域 */}
            {!transcript && (
              <div className="space-y-4">
                {/* 第一步：解析抖音链接验证对标 */}
                <div className="bg-white rounded-lg border p-4 space-y-3">
                  <h3 className="font-medium text-gray-900">第一步：粘贴抖音链接验证对标</h3>
                  <p className="text-sm text-gray-500">粘贴抖音分享链接，自动解析视频信息并验证点赞量</p>
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
                  {videoInfo && (
                    <div className="text-sm text-gray-600 pt-2 border-t">
                      <p><span className="font-medium">标题：</span>{videoInfo.title}</p>
                      <p className="mt-1">
                        <span className="font-medium">点赞：</span>{(videoInfo.diggCount / 10000).toFixed(1)}万
                        {likesPass
                          ? <span className="ml-2 text-green-600">✅ 超过10万</span>
                          : <span className="ml-2 text-red-600">❌ 未达10万</span>
                        }
                      </p>
                      {!likesPass && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700">
                          建议换一条点赞更高的对标。
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 第二步：粘贴文案 */}
                <div className="bg-white rounded-lg border p-4 space-y-3">
                  <h3 className="font-medium text-gray-900">第二步：粘贴对标文案</h3>
                  <p className="text-sm text-gray-500">
                    用 <a href="https://aihaoji.com/zh/dashboard/tasks" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">AI好记</a> 等工具转好文案后粘贴到下方
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
                        setTranscript(el.value.trim())
                      }
                    }}
                  >
                    确认使用此文案
                  </button>
                </div>
              </div>
            )}

            {/* 文案确认 */}
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
                    onClick={() => { setTranscriptConfirmed(true); checkOpening() }}
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

            {/* 跳过评估按钮 */}
            {transcriptConfirmed && !openingCheck && loading === 'AI 评估开头吸引力...' && (
              <div className="flex justify-center">
                <button
                  className="text-sm text-blue-600 underline hover:text-blue-800"
                  onClick={() => { setOpeningCheck('已跳过评估'); setLoading(''); setUserAgree(true) }}
                >
                  评估太慢？跳过直接进入下一步
                </button>
              </div>
            )}

            {/* 开头吸引力评估 */}
            {transcriptConfirmed && openingCheck && userAgree === null && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <h3 className="font-medium text-gray-900">开头吸引力评估</h3>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                  {openingCheck}
                </div>
                <div className="flex gap-2">
                  <button
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                    onClick={() => setUserAgree(true)}
                  >
                    同意
                  </button>
                  <button
                    className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200"
                    onClick={() => setUserAgree(false)}
                  >
                    不同意
                  </button>
                </div>
              </div>
            )}

            {/* 质量门判定 */}
            {userAgree !== null && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <h3 className="font-medium text-gray-900">质量门判定</h3>
                <div className="text-sm space-y-1">
                  <p>
                    点赞量≥10万：
                    {likesPass
                      ? <span className="text-green-600 font-medium">✅ 通过</span>
                      : <span className="text-red-600 font-medium">❌ 未通过</span>
                    }
                  </p>
                  <p>
                    开头吸引力：
                    {openingPass && userAgree
                      ? <span className="text-green-600 font-medium">✅ 通过</span>
                      : <span className="text-red-600 font-medium">❌ 未通过</span>
                    }
                  </p>
                </div>
                <button
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                  onClick={() => { setStep(3); analyzeStructure() }}
                >
                  进入仿写创作 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========== STEP 3: 仿写创作 ========== */}
        {step === 3 && (
          <div className="space-y-4">
            {/* 结构拆解 */}
            {structureAnalysis && !chosenTopic && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <h3 className="font-medium text-gray-900">对标结构拆解</h3>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                  {structureAnalysis}
                </div>
              </div>
            )}

            {/* 选择仿写方向 */}
            {structureAnalysis && !loading && !chosenTopic && (
              <div className="bg-white rounded-lg border p-4 space-y-4">
                <h3 className="font-medium text-gray-900">选择仿写方向</h3>
                {!topicMode && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      className="p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-left text-sm"
                      onClick={() => setTopicMode('custom')}
                    >
                      <p className="font-medium">💡 我有想法</p>
                      <p className="text-gray-500 mt-1">先说说我的思路，再让 AI 写</p>
                    </button>
                    <button
                      className="p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-left text-sm"
                      onClick={() => {
                        const title = videoInfo?.title || transcript.split(/[。\n]/)[0].slice(0, 50)
                        const topic = `沿用原文主题「${title}」，换成${selectedPersona?.name}的视角和经历，由AI自由发挥`
                        setChosenTopic(topic)
                        handleWrite(topic)
                      }}
                    >
                      <p className="font-medium">🤖 我没想法</p>
                      <p className="text-gray-500 mt-1">AI 直接替我写</p>
                    </button>
                  </div>
                )}
                {topicMode === 'custom' && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">说说你的想法：想写什么主题？怎么写？想加什么案例或经历？</p>
                    <textarea
                      className="w-full border rounded-lg p-3 text-sm h-28 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="比如：我想写关于独立女性在感情中的底线，可以加一个闺蜜的故事，结尾要有力量感..."
                      value={customTopic}
                      onChange={e => setCustomTopic(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        disabled={!customTopic.trim()}
                        onClick={() => {
                          const topic = customTopic.trim()
                          setChosenTopic(topic)
                          handleWrite(topic)
                        }}
                      >
                        开始写 →
                      </button>
                      <button
                        className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
                        onClick={() => { setTopicMode(null); setCustomTopic('') }}
                      >
                        返回
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 选题信息条 */}
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

            {/* 对话区域 */}
            {chosenTopic && (
              <div className="bg-white rounded-lg border">
                <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg p-3 text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-800'}`}>
                        {msg.role === 'assistant' ? <SimpleMarkdown text={msg.content} /> : msg.content}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="border-t p-3">
                  <div className="flex gap-2 items-end">
                    <textarea
                      className="flex-1 border rounded-lg px-3 py-2 text-sm resize-none overflow-y-auto"
                      placeholder="输入修改意见..."
                      rows={2}
                      style={{ maxHeight: '120px' }}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend() } }}
                      onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px' }}
                      disabled={!!loading}
                    />
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      onClick={handleChatSend}
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
