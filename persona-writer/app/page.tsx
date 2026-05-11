'use client'

import { useState, useEffect, useRef } from 'react'

const BASE = '/persona-writer'

interface Persona { name: string; soul: string; contentPlan: string; references: string[] }
interface VideoInfo { title: string; diggCount: number; awemeId: string; isSubtitled: boolean; playUrl: string }
interface ChatMsg { role: 'user' | 'assistant'; content: string; images?: string[] }

function SimpleMarkdown({ text }: { text: string }) {
  const cleaned = text.replace(/===脚本开始===\n?/g, '').replace(/\n?===脚本结束===/g, '')
  const html = cleaned
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
  const [scriptOpening, setScriptOpening] = useState('')
  const [showOpeningConfirm, setShowOpeningConfirm] = useState(false)
  const [editableOpening, setEditableOpening] = useState('')
  const [scriptBody, setScriptBody] = useState('')
  const [showFinalPreview, setShowFinalPreview] = useState(false)
  const [finalScript, setFinalScript] = useState('')
  const [exporting, setExporting] = useState(false)
  const [chatImages, setChatImages] = useState<string[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatImageRef = useRef<HTMLInputElement>(null)

  // 开头锁定
  const [lockedOpening, setLockedOpening] = useState('')
  const [openingLocked, setOpeningLocked] = useState(false)
  const [bodyText, setBodyText] = useState('')
  const [finalBody, setFinalBody] = useState('')

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
    messages: { role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }[],
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

    const isCustomTopic = topicMode === 'custom'

    const systemPrompt = `你是一个专业的人设内容仿写助手。直接输出，不要提问，不要确认。

## 三条铁律（硬性，必须满足）
1. 写完整脚本：从开头到结尾完整输出，系统后续会让员工替换开头。
2. 结构参考对标原文：对标原文的段落结构、节奏、逻辑关系作为骨架参考。${isCustomTopic ? '但员工的选题想法是核心，结构为想法服务，可以根据想法适当调整段落。' : '仿写必须一一对应，不能加段、不能删段、不能调换顺序。'}
3. 字数只少不多：对标原文多少字，仿写就不能超过这个字数。宁可少10%，绝不多1%。

## 优先级（从高到低）
${isCustomTopic ? `1. 员工的选题想法——员工写的内容、观点、素材是第一位的，必须100%忠实呈现，不能改写员工的核心意思
2. 对标结构——借鉴对标文案的段落结构和节奏，但为员工的想法服务
3. 达人风格——用达人的语气和调性来包装员工的想法` : `1. 原文结构——对标文案的段落结构、节奏、逻辑链条是第一位的，必须极致一致
2. 分析结果——对标结构分析揭示了为什么这篇爆，仿写要保住这些爆点
3. 人格档案——辅助参考，了解达人调性即可，不要被它框住`}

## 创作指南
${isCustomTopic ? `员工的选题想法是你的创作核心。你的任务是用达人的风格和对标文案的结构，把员工的想法写成一篇完整的短视频口播稿。员工写了什么就用什么，不要自作主张改变员工的观点、素材或表达方向。` : `铁律之外，放开写。你的首要任务是写出有信息差、有金句、让人想看完的内容。`}
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
先输出 ===脚本开始=== 标记，然后输出完整脚本（从开头到结尾），然后输出 ===脚本结束=== 标记。
标记之后再附上：
- 总字数 | 对标原文字数 | 是否达标
- 三条铁律自检表（markdown表格）${topicMode === 'custom' ? '' : `
- 原创度自检：逐段对比对标原文和你的仿写，列出相似度高的句子。如果整体文字重复率超过50%，标红提醒。`}`

    // 不再自动提取开头——导出时由用户确认
    setScriptOpening('')

    const msgs: ChatMsg[] = [{ role: 'user', content: isCustomTopic
      ? `请根据我的选题想法写脚本，用${selectedPersona.name}的风格，参考对标文案的结构。我的想法是核心，必须忠实呈现：\n\n${topic}`
      : `请根据对标结构和选题「${topic}」，用${selectedPersona.name}的风格写第一版脚本。写完整脚本，从开头到结尾。` }]
    setChatMessages(msgs)
    setLoading('AI 创作中...')
    try {
      let assistantMsg = ''
      await streamChatWithUpdate(
        msgs.map(m => ({ role: m.role, content: m.content })),
        systemPrompt,
        (text) => {
          assistantMsg = text
          setChatMessages([...msgs, { role: 'assistant', content: text }])
        }
      )
      setChatMessages([...msgs, { role: 'assistant', content: assistantMsg }])
      setLoading('')
    } catch (e: any) {
      setError(e.message)
      setLoading('')
    }
  }

  // ===== 图片处理 =====
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result as string
        setChatImages(prev => [...prev, base64])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData.items
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        const reader = new FileReader()
        reader.onload = () => setChatImages(prev => [...prev, reader.result as string])
        reader.readAsDataURL(file)
      }
    }
  }

  // ===== 迭代修改 =====
  async function handleChatSend() {
    if ((!chatInput.trim() && chatImages.length === 0) || !selectedPersona) return
    const newMsg: ChatMsg = { role: 'user', content: chatInput, images: chatImages.length > 0 ? [...chatImages] : undefined }
    const newMsgs: ChatMsg[] = [...chatMessages, newMsg]
    setChatMessages(newMsgs)
    setChatInput('')
    setChatImages([])
    setLoading('AI 修改中...')

    const systemPrompt = `你是一个专业的人设内容仿写助手，正在帮员工迭代脚本。

## 铁律（硬性）
1. 写完整脚本——从开头到结尾完整输出
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

员工说哪里不对就改哪里，不动没问题的部分。每次输出时用 ===脚本开始=== 和 ===脚本结束=== 包裹完整脚本正文，标记之后再附自检表。不要提问，直接改。`

    try {
      let assistantMsg = ''
      const apiMsgs = newMsgs.map(m => {
        if (m.images && m.images.length > 0) {
          return {
            role: m.role,
            content: [
              ...m.images.map(img => ({ type: 'image_url' as const, image_url: { url: img } })),
              { type: 'text' as const, text: m.content || '请看图片' },
            ],
          }
        }
        return { role: m.role, content: m.content }
      })
      await streamChatWithUpdate(
        apiMsgs,
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
    // 找包含脚本的AI消息（有标记的优先，否则找最长的）
    const assistantMsgs = [...chatMessages].filter(m => m.role === 'assistant')
    const withMarker = [...assistantMsgs].reverse().find(m => m.content.includes('===脚本开始==='))
    const longest = [...assistantMsgs].sort((a, b) => b.content.length - a.content.length)[0]
    const scriptMsg = withMarker || longest
    if (!scriptMsg) return
    let body = scriptMsg.content

    // 用标记精确提取脚本
    const startMark = body.indexOf('===脚本开始===')
    const endMark = body.indexOf('===脚本结束===')
    if (startMark !== -1 && endMark !== -1) {
      body = body.slice(startMark + '===脚本开始==='.length, endMark).trim()
    } else if (startMark !== -1) {
      body = body.slice(startMark + '===脚本开始==='.length).trim()
    } else {
      body = body.split(/\n[-·]\s*总字数/)[0]
      body = body.split(/\n\|/)[0]
      body = body.trim()
    }

    // 直接进入终稿编辑，用户可以自由修改（包括替换开头）
    setFinalScript(body)
    setShowFinalPreview(true)
  }

  async function handleDownloadWord() {
    setExporting(true)
    try {
      const res = await fetch('/persona-writer/api/export-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaName: selectedPersona?.name || '达人',
          topic: chosenTopic,
          content: finalScript,
        }),
      })
      if (!res.ok) { showToast('导出失败'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const name = selectedPersona?.name || '达人'
      const dateStr = new Date().toISOString().slice(0, 10)
      a.download = `人设脚本_${name}_${dateStr}.docx`
      a.click()
      URL.revokeObjectURL(url)
      showToast('已下载到电脑')
    } catch {
      showToast('导出失败，请重试')
    } finally {
      setExporting(false)
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
        <h1 className="text-2xl font-bold text-gray-900">人设内容仿写助手</h1>
        <p className="text-base text-gray-500 mt-1">三步完成人设内容仿写</p>
      </header>

      {/* 步骤条 */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-2 text-base">
          {[{ n: 1, label: '加载风格' }, { n: 2, label: '对标验证' }, { n: 3, label: '仿写创作' }].map((s, idx) => (
            <div key={s.n} className="flex items-center gap-2">
              {idx > 0 && <span className="text-gray-300">→</span>}
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-base font-medium ${step === s.n ? 'bg-blue-100 text-blue-700' : step > s.n ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {step > s.n ? '✓' : s.n}. {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-6">
        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-base">
            {error}
            <button className="ml-2 underline" onClick={() => setError('')}>关闭</button>
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-base flex items-center gap-2">
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
            <div className="bg-white rounded-lg border p-4">
              <label className="block text-base font-medium text-gray-700 mb-2">选择达人</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-base"
                value={selectedPersona?.name || ''}
                onChange={e => handleSelectPersona(e.target.value)}
              >
                <option value="">请选择...</option>
                {personas.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>

            {selectedPersona && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <p className="text-green-600 font-medium">✅ {selectedPersona.name}的风格已加载</p>
                <div className="bg-gray-50 rounded-lg p-3 text-base text-gray-700 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  <p className="font-medium text-gray-900 mb-1">人设定位</p>
                  {selectedPersona.contentPlan.split('\n').slice(0, 8).join('\n')}
                </div>
                <button
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg text-base font-medium hover:bg-blue-700"
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
              <p className="text-base text-gray-600">
                <span className="text-green-600 font-medium">✅ {selectedPersona?.name}</span>
                <span className="ml-2 text-gray-400">风格已加载</span>
              </p>
              <button className="text-base text-blue-600 hover:underline" onClick={() => setStep(1)}>换达人</button>
            </div>

            {/* 点赞门槛提示 */}
            {!transcript && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
              <p className="text-lg font-bold text-amber-800">请上传一条点赞量 ≥ 10万 的对标视频</p>
              <p className="text-base text-amber-600 mt-1">未达到点赞门槛的内容，系统不予通过</p>
            </div>
            )}

            {/* 输入区域 */}
            {!transcript && (
              <div className="space-y-4">
                {/* 第一步：解析抖音链接验证对标 */}
                <div className="bg-white rounded-lg border p-4 space-y-3">
                  <h3 className="font-medium text-gray-900">第一步：粘贴抖音链接验证对标</h3>
                  <p className="text-base text-gray-500">粘贴抖音分享链接，自动解析视频信息并验证点赞量</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 border rounded-lg px-3 py-2 text-base"
                      placeholder="粘贴抖音分享链接..."
                      value={shareUrl}
                      onChange={e => setShareUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleFetchVideo()}
                    />
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-base font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                      onClick={handleFetchVideo}
                      disabled={!shareUrl.trim() || !!loading}
                    >
                      解析
                    </button>
                  </div>
                  {videoInfo && (
                    <div className="text-base text-gray-600 pt-2 border-t">
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
                  <p className="text-base text-gray-500">
                    用 <a href="https://aihaoji.com/zh/dashboard/tasks" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">AI好记</a> 等工具转好文案后粘贴到下方
                  </p>
                  <textarea
                    className="w-full border rounded-lg p-4 text-base leading-relaxed h-64 resize-y"
                    placeholder="粘贴视频口播文案..."
                    id="manual-transcript"
                  />
                  <button
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-base font-medium hover:bg-green-700 w-full"
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
                    className="w-full border rounded-lg p-4 text-base leading-relaxed h-64 resize-y"
                    value={transcript}
                    onChange={e => setTranscript(e.target.value)}
                  />
                ) : (
                  <div className="bg-gray-50 rounded-lg p-3 text-base text-gray-700 max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {transcript}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-base font-medium hover:bg-green-700"
                    onClick={() => { setTranscriptConfirmed(true); checkOpening() }}
                  >
                    文案准确
                  </button>
                  <button
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-base font-medium hover:bg-gray-300"
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
                  className="text-base text-blue-600 underline hover:text-blue-800"
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
                <div className="bg-gray-50 rounded-lg p-3 text-base text-gray-700 whitespace-pre-wrap">
                  {openingCheck}
                </div>
                <div className="flex gap-2">
                  <button
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-base font-medium hover:bg-green-700"
                    onClick={() => setUserAgree(true)}
                  >
                    同意
                  </button>
                  <button
                    className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-base font-medium hover:bg-red-200"
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
                <div className="text-base space-y-1">
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
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg text-base font-medium hover:bg-blue-700"
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
                <div className="bg-gray-50 rounded-lg p-3 text-base text-gray-700 whitespace-pre-wrap">
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
                      className="p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-left text-base"
                      onClick={() => setTopicMode('custom')}
                    >
                      <p className="font-medium">💡 我有想法</p>
                      <p className="text-gray-500 mt-1">先说说我的思路，再让 AI 写</p>
                    </button>
                    <button
                      className="p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-left text-base"
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
                    <p className="text-base text-gray-600">说说你的想法：想写什么主题？怎么写？想加什么案例或经历？</p>
                    <textarea
                      className="w-full border rounded-lg p-3 text-base h-28 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="比如：我想写关于独立女性在感情中的底线，可以加一个闺蜜的故事，结尾要有力量感..."
                      value={customTopic}
                      onChange={e => setCustomTopic(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg text-base font-medium hover:bg-blue-700 disabled:opacity-50"
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
                        className="text-base text-gray-500 hover:text-gray-700 px-4 py-2"
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
            {chosenTopic && !showFinalPreview && !showOpeningConfirm && (
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base text-gray-600 min-w-0">
                    <span className="font-medium">达人：</span>{selectedPersona?.name}
                    <span className="ml-3 font-medium">选题：</span>
                    <span className="truncate">{chosenTopic.length > 30 ? chosenTopic.slice(0, 30) + '…' : chosenTopic}</span>
                  </div>
                  <button
                    className="shrink-0 bg-green-600 text-white px-4 py-1.5 rounded-lg text-base font-medium hover:bg-green-700"
                    onClick={handleExport}
                  >
                    预览终稿
                  </button>
                </div>
              </div>
            )}

            {/* 对话区域 — Claude 风格 */}
            {chosenTopic && !showFinalPreview && !showOpeningConfirm && (
              <div className="flex flex-col" style={{ height: 'calc(100vh - 240px)' }}>
                {/* 消息列表 */}
                <div className="flex-1 overflow-y-auto">
                  <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx}>
                        {msg.role === 'user' ? (
                          <div className="flex justify-end">
                            <div className="max-w-[85%]">
                              {msg.images && msg.images.length > 0 && (
                                <div className="flex gap-2 mb-2 flex-wrap justify-end">
                                  {msg.images.map((img, i) => (
                                    <img key={i} src={img} alt="" className="max-h-48 rounded-xl object-cover" />
                                  ))}
                                </div>
                              )}
                              {msg.content && (
                                <div className="bg-gray-100 rounded-3xl px-5 py-3 text-base text-gray-900 leading-relaxed">
                                  {msg.content}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-base text-gray-800 leading-relaxed">
                            <SimpleMarkdown text={msg.content} />
                          </div>
                        )}
                      </div>
                    ))}
                    {loading === 'AI 修改中...' && chatMessages[chatMessages.length - 1]?.role === 'user' && (
                      <div className="flex gap-1.5 py-2">
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </div>

                {/* 底部输入区 */}
                <div className="border-t bg-white px-4 py-3">
                  <div className="max-w-3xl mx-auto">
                    {/* 图片预览 */}
                    {chatImages.length > 0 && (
                      <div className="flex gap-2 flex-wrap mb-2">
                        {chatImages.map((img, i) => (
                          <div key={i} className="relative group">
                            <img src={img} alt="" className="h-20 rounded-xl object-cover" />
                            <button
                              className="absolute -top-2 -right-2 w-5 h-5 bg-gray-800 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setChatImages(prev => prev.filter((_, j) => j !== i))}
                            >x</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="relative border rounded-2xl bg-white shadow-sm focus-within:shadow-md focus-within:border-gray-300 transition-all">
                      <textarea
                        className="w-full bg-transparent border-none outline-none text-base resize-none px-4 pt-3 pb-10 leading-relaxed"
                        placeholder="给 AI 发消息，可粘贴图片..."
                        rows={2}
                        style={{ maxHeight: '200px', minHeight: '80px' }}
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend() } }}
                        onPaste={handlePaste}
                        onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 160) + 'px' }}
                        disabled={!!loading}
                      />
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                        <div className="flex gap-1">
                          <input ref={chatImageRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
                          <button
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            onClick={() => chatImageRef.current?.click()}
                            title="上传图片"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                          </button>
                        </div>
                        <button
                          className="p-1.5 rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-20 disabled:bg-gray-300 transition-colors"
                          onClick={handleChatSend}
                          disabled={(!chatInput.trim() && chatImages.length === 0) || !!loading}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 确认开头 - 已移除，直接进终稿编辑 */}

            {/* 终稿预览（可编辑） */}
            {showFinalPreview && (
              <div className="bg-white rounded-lg border">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">终稿编辑</h3>
                  <button className="text-base text-gray-500 hover:text-gray-700" onClick={() => setShowFinalPreview(false)}>
                    ← 返回修改
                  </button>
                </div>
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                  <p className="text-sm text-gray-500 mb-2">💡 开头替换：选中文本框最上面 AI 写的开头，删掉，从下方对标原文里复制原版开头粘贴上去。</p>
                  <textarea
                    className="w-full bg-gray-50 rounded-lg p-4 text-base text-gray-800 leading-relaxed border resize-y"
                    style={{ minHeight: '40vh' }}
                    value={finalScript}
                    onChange={e => setFinalScript(e.target.value)}
                  />
                  <details className="mt-3 group">
                    <summary className="text-base font-medium text-gray-700 cursor-pointer select-none hover:text-blue-600">
                      📄 展开对标原文（复制开头）
                    </summary>
                    <div className="mt-2 bg-gray-50 rounded-lg p-4 text-base text-gray-700 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto border">
                      {transcript}
                    </div>
                  </details>
                  <p className="text-sm text-gray-400 mt-2">文本框里的内容就是最终稿。下载的 Word 与这里完全一致。</p>
                </div>
                <div className="p-4 border-t flex gap-3">
                  <button
                    className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-base font-medium hover:bg-green-700 disabled:opacity-50"
                    onClick={handleDownloadWord}
                    disabled={exporting}
                  >
                    {exporting ? '导出中...' : '确认，下载 Word 文档'}
                  </button>
                  <button
                    className="px-6 py-2.5 border rounded-lg text-base text-gray-600 hover:bg-gray-50"
                    onClick={() => setShowFinalPreview(false)}
                  >
                    继续修改
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
