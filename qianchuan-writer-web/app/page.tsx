'use client'

import { useState, useEffect, useRef } from 'react'

const BASE = '/qianchuan-writer'

interface Persona { name: string; soul: string; contentPlan: string; references: string[] }
interface VideoInfo { title: string; diggCount: number; awemeId: string; isSubtitled: boolean; playUrl: string }
interface ChatMsg { role: 'user' | 'assistant'; content: string }
interface ProductInfo {
  name: string
  category: string
  price: string
  sellingPoints: string
  targetAudience: string
  scenario: string
}

function SimpleMarkdown({ text }: { text: string }) {
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n- /g, '</p><li>')
    .replace(/\n(\d+)\. /g, '</p><li>')
    .replace(/\n/g, '<br/>')
  return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />
}

const emptyProduct: ProductInfo = {
  name: '',
  category: '',
  price: '',
  sellingPoints: '',
  targetAudience: '',
  scenario: '',
}

export default function Home() {
  const [step, setStep] = useState(1)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null)
  const [product, setProduct] = useState<ProductInfo>(emptyProduct)

  // Step 2: Selling points
  const [spChat, setSpChat] = useState<ChatMsg[]>([])
  const [spInput, setSpInput] = useState('')
  const [spLoading, setSpLoading] = useState(false)
  const [spApplied, setSpApplied] = useState(false)
  const [spOrder, setSpOrder] = useState<'背书-机制-种草' | '机制-背书-种草' | '背书-种草-机制'>('背书-机制-种草')
  const spChatEndRef = useRef<HTMLDivElement>(null)

  // Step 2: File upload
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [rawProductText, setRawProductText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 3: Viral opening
  const [shareUrl, setShareUrl] = useState('')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [transcript, setTranscript] = useState('')
  const [transcriptConfirmed, setTranscriptConfirmed] = useState(false)
  const [editingTranscript, setEditingTranscript] = useState(false)
  const [manualTranscript, setManualTranscript] = useState(false)
  const [viralOpening, setViralOpening] = useState('')
  const [openingConfirmed, setOpeningConfirmed] = useState(false)
  const [extractingOpening, setExtractingOpening] = useState(false)

  // Step 4: Final script
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // UI
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // Material library
  const [showRefForm, setShowRefForm] = useState(false)
  const [refTitle, setRefTitle] = useState('')
  const [refLikes, setRefLikes] = useState('')
  const [refType, setRefType] = useState('千川爆款')
  const [refContent, setRefContent] = useState('')

  useEffect(() => {
    fetch(`${BASE}/api/personas`).then(r => r.json()).then(d => {
      setPersonas(d.personas || [])
    })
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    spChatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [spChat])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  async function reloadPersonas() {
    const d = await fetch(`${BASE}/api/personas`).then(r => r.json())
    const list = d.personas || []
    setPersonas(list)
    if (selectedPersona) {
      const updated = list.find((p: Persona) => p.name === selectedPersona.name)
      if (updated) setSelectedPersona(updated)
    }
  }

  async function streamChat(messages: { role: string; content: string }[], systemPrompt: string): Promise<string> {
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, systemPrompt }),
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
    onUpdate: (text: string) => void
  ): Promise<string> {
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, systemPrompt }),
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

  // ===== Step 1: Persona =====

  function handleSelectPersona(name: string) {
    const persona = personas.find(p => p.name === name) || null
    setSelectedPersona(persona)
  }

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

  // ===== Step 2: Product + Selling Points =====

  function openProductFilePicker() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.txt,.md,.docx,.xlsx,.xls,.pptx'
    input.multiple = true
    input.onchange = () => {
      const files = input.files
      if (!files || files.length === 0) return
      setPendingFiles(prev => [...prev, ...Array.from(files)])
    }
    input.click()
  }

  function handleRemovePendingFile(index: number) {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function handleParseProductFiles() {
    if (pendingFiles.length === 0) return
    setUploadingPdf(true)
    setError('')
    setLoading(`正在解析 ${pendingFiles.length} 个产品文档...`)
    try {
      const formData = new FormData()
      for (const file of pendingFiles) {
        formData.append('file', file)
      }
      const res = await fetch(`${BASE}/api/parse-product`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '解析失败')
      }
      const info = await res.json()
      setProduct({
        name: info.name || '',
        category: info.category || '',
        price: info.price || '',
        sellingPoints: info.sellingPoints || '',
        targetAudience: info.targetAudience || '',
        scenario: info.scenario || '',
      })
      if (info._rawText) {
        setRawProductText(info._rawText)
        startSellingPointsChat(info._rawText, info)
      }
      setPendingFiles([])
      showToast(`已从 ${pendingFiles.length} 个文档提取产品信息，请检查确认`)
    } catch (e: any) {
      setError(e.message || '文档解析失败')
    } finally {
      setUploadingPdf(false)
      setLoading('')
    }
  }

  const spSystemPrompt = `你是一个千川投流素材的卖点提炼专家，帮助团队从产品资料中提炼出最适合千川投放的3个核心卖点。

## 千川卖点的特殊性

千川是付费投流素材，目标是直接转化。和种草内容不同，千川卖点更硬、更直接、更有冲击力。
卖点必须在3-5秒内让用户产生"我要买"的冲动。

## 三类卖点（按优先级排序）

### 第一类：背书类（最优先）
建立信任门槛的卖点。消费者的潜意识判断："这个东西有来头，不是杂牌。"
- 韩国进口、跨境正品
- 中科院/知名机构研发
- 明星同款、院线同源
- 百年品牌、专利技术
- 销量数据（全网卖了XXX万瓶）

### 第二类：机制类（促成下单）
让消费者觉得"现在不买就亏了"的卖点。机制类**必须涉及价格或促销**，不是产品技术或功效。
- 价格破：原价 vs 现价的巨大落差（如：原价1067，直播间598）
- 赠品机制：买一送一、买一送三、加赠XX
- 限时限量：仅限今天、最后XXX件、倒计时
- 规格优势：比专柜大瓶、加量不加价

⚠️ 注意区分：「先调后补的技术逻辑」「29种营养成分」这些是背书或种草，不是机制。机制一定和"钱""数量""时间紧迫"有关。
如果产品资料中没有明确的价格/促销信息，机制卖点必须标注 [需补充：价格机制/促销信息]，不要用技术特点充当机制。

### 第三类：种草类（补充说服）
产品本身的功效/体验卖点，作为前两类的补充。
- 核心成分和功效
- 使用体验（肤感、效果）
- 解决的具体问题

## 输出规则
1. 必须按「背书→机制→种草」的顺序排列
2. 每个卖点一句话，简短有力，像口播能直接说出来
3. 如果产品资料中某类卖点信息不足，标注 [需补充：XXX信息]
4. 用消费者能秒懂的语言，不用专业术语

## 输出格式
先给出推荐的3个卖点及选择理由，用户可以讨论调整。
确认后输出最终版：
【最终卖点】
1. [背书] xxx
2. [机制] xxx
3. [种草] xxx`

  async function startSellingPointsChat(rawText: string, info: any) {
    const userMsg: ChatMsg = {
      role: 'user',
      content: `以下是产品资料原文：\n\n${rawText.slice(0, 4000)}\n\nAI 初步提取的产品信息：\n产品名：${info.name}\n品类：${info.category}\n价格：${info.price}\n目标人群：${info.targetAudience}\n\n请按「背书→机制→种草」的优先级，帮我提炼3个最适合千川投放的核心卖点。`
    }
    const msgs: ChatMsg[] = [userMsg]
    setSpChat(msgs)
    setSpApplied(false)
    setSpLoading(true)
    try {
      let assistantMsg = ''
      await streamChatWithUpdate(
        msgs.map(m => ({ role: m.role, content: m.content })),
        spSystemPrompt,
        (text) => {
          assistantMsg = text
          setSpChat([...msgs, { role: 'assistant', content: text }])
        }
      )
      setSpChat([...msgs, { role: 'assistant', content: assistantMsg }])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSpLoading(false)
    }
  }

  async function handleSpSend() {
    if (!spInput.trim()) return
    const userMsg: ChatMsg = { role: 'user', content: spInput }
    const newMsgs = [...spChat, userMsg]
    setSpChat(newMsgs)
    setSpInput('')
    setSpLoading(true)
    try {
      let assistantMsg = ''
      await streamChatWithUpdate(
        newMsgs.map(m => ({ role: m.role, content: m.content })),
        spSystemPrompt,
        (text) => {
          assistantMsg = text
          setSpChat([...newMsgs, { role: 'assistant', content: text }])
        }
      )
      setSpChat([...newMsgs, { role: 'assistant', content: assistantMsg }])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSpLoading(false)
    }
  }

  function handleApplySellingPoints() {
    const lastMsg = [...spChat].reverse().find(m => m.role === 'assistant')
    if (!lastMsg) return
    const content = lastMsg.content
    const finalMatch = content.match(/【最终卖点】([\s\S]*?)$/m)
    if (finalMatch) {
      setProduct(prev => ({ ...prev, sellingPoints: finalMatch[1].trim() }))
    } else {
      const lines = content.split('\n').filter(l => /^\d+[\.\、]/.test(l.trim()))
      if (lines.length > 0) {
        setProduct(prev => ({ ...prev, sellingPoints: lines.join('\n') }))
      }
    }
    setSpApplied(true)
    showToast('卖点已更新到表单')
  }

  // ===== Step 3: Viral Opening =====

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
    setViralOpening('')
    setOpeningConfirmed(false)
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
      setLoading('上传视频并提交转录...')
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

  async function handleExtractOpening() {
    if (!transcript.trim()) return
    setExtractingOpening(true)
    setLoading('AI 提取爆款开头...')
    try {
      const result = await streamChatWithUpdate(
        [{ role: 'user', content: transcript }],
        `你是一个千川投流素材分析专家。从以下千川视频文案中提取「开头部分」。

## 什么是千川开头
千川开头是视频最前面的1-3句话，作用是在前3秒抓住用户注意力，阻止划走。
典型特征：
- 制造好奇/悬念（"你知道为什么XXX吗？"）
- 痛点直击（"脸上长斑的姐妹看过来"）
- 反常识/冲突（"千万别再用XXX了"）
- 利益诱惑（"今天这个价格说出来你别不信"）
- 身份筛选（"30岁以上的女生一定要看"）

## 你的任务
1. 找到文案中的开头部分（通常是前1-3句，到第一个卖点/产品介绍之前结束）
2. 100% 原封不动地提取出来，一个字都不改
3. 标注开头类型（好奇型/痛点型/反常识型/利益型/身份筛选型/其他）
4. 简短说明为什么这个开头有效（一句话）

## 输出格式
【爆款开头】
（原文，一字不改）

【开头类型】xx型
【有效原因】一句话说明`,
        (text) => setViralOpening(text)
      )
      setViralOpening(result)
      setLoading('')
    } catch (e: any) {
      setError(e.message)
      setLoading('')
    } finally {
      setExtractingOpening(false)
    }
  }

  // ===== Step 4: Combine Script =====

  async function handleGenerateScript() {
    if (!selectedPersona || !openingConfirmed) return

    // Extract the raw opening text
    const openingMatch = viralOpening.match(/【爆款开头】\s*([\s\S]*?)(?=\n【|$)/)
    const rawOpening = openingMatch ? openingMatch[1].trim() : viralOpening.split('\n').filter(l => l.trim() && !l.startsWith('【'))[0] || viralOpening

    const productDesc = `产品名称：${product.name}\n产品品类：${product.category}\n价格：${product.price}\n核心卖点（按顺序：${spOrder.replace(/-/g, '→')}）：\n${product.sellingPoints}\n目标人群：${product.targetAudience}\n使用场景：${product.scenario}`

    const transcriptLength = transcript ? transcript.replace(/\s/g, '').length : 0

    // Pass selling points as-is, let AI classify
    const orderLabels = spOrder.split('-') // e.g. ['背书','机制','种草']

    const structureDesc = orderLabels.map((l, i) => `${i+2}. 【卖点${i+1}-${l}】${l}卖点的口播段落`).join('\n')

    const systemPrompt = `你是一个千川投流脚本仿写机器。你的唯一任务：把「爆款开头」+「三个卖点」+「行动号召」拼成一条完整脚本。不要提问，不要确认，直接输出脚本。

## 已确认的素材（直接使用，不要追问）

### 爆款开头
「${rawOpening}」
规则：原封不动抄上去。唯一例外：如果开头中出现其他品牌名，替换成「${product.name}」，其余一字不改。

### 员工提供的卖点素材
${product.sellingPoints}

### 三类卖点的定义（你必须根据内容自动归类）
- **背书**：建立信任和权威感的内容。如：品牌来源、明星同款、机构认证、销量数据、专利技术、行业资质等
- **机制**：涉及价格/促销/赠品/限时的内容。如：原价vs现价、买赠、限时优惠、独家价、破价等。⚠️ 产品技术原理（如"先调后补""29种营养"）不是机制，是背书或种草
- **种草**：产品功效/体验/成分的内容。如：核心成分、使用体验、解决什么问题、效果数据等

### 你的任务
1. 从上面的卖点素材中，识别哪些内容属于背书、哪些属于机制、哪些属于种草
2. 按「${orderLabels.join('→')}」的顺序排列，每类写成一个独立的口播段落
3. 如果素材中缺少某类（尤其是机制类的价格/促销信息），在该段落标注 [需补充]
4. 语言精简成消费者爱听的大白话，像对着镜头说话
5. 不要加入卖点素材里没提到的信息，不要自己编数据

### 原视频文案字数：${transcriptLength > 0 ? transcriptLength + '字' : '未知'}

## 脚本结构（严格按此顺序）
1. 【开头】爆款开头原文
${structureDesc}
${orderLabels.length + 2}. 【行动号召】简短下单引导

## 字数控制
${transcriptLength > 0 ? `原视频文案 ${transcriptLength} 字，你的脚本总字数要和它基本一致（上下浮动10%以内）。` : '千川常规长度 250-350 字。'}

## 达人风格参考
${selectedPersona.soul}

## 产品信息
${productDesc}

## 输出格式
直接输出完整脚本（带【开头】【卖点1-背书】【卖点2-机制】【卖点3-种草】【行动号召】标注），然后附上：
- 总字数 | 语速参考 | 预估时长
- 自检表（开头是否原文？卖点是否按序？字数是否达标？）

不要提问，不要说"我需要确认"，直接写。`

    const userMsg = `直接输出脚本，不要提问。

爆款开头：${rawOpening}
卖点素材：
${product.sellingPoints}
卖点顺序：${orderLabels.join('→')}（根据内容自动归类后按此顺序排列）
${transcriptLength > 0 ? `原视频文案字数：${transcriptLength}字，脚本总字数要基本一致。` : ''}
达人风格：${selectedPersona.name}

请直接拼合输出完整脚本。`
    const newMessages: ChatMsg[] = [{ role: 'user', content: userMsg }]
    setChatMessages(newMessages)
    setLoading('AI 生成千川脚本...')

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

  async function handleSendChat() {
    if (!chatInput.trim() || !selectedPersona) return
    const userMsg: ChatMsg = { role: 'user', content: chatInput }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setLoading('AI 修改中...')

    const openingMatch = viralOpening.match(/【爆款开头】\s*([\s\S]*?)(?=\n【|$)/)
    const rawOpening = openingMatch ? openingMatch[1].trim() : viralOpening

    const productDesc = `产品名称：${product.name}\n产品品类：${product.category}\n价格：${product.price}\n核心卖点（按顺序：${spOrder.replace(/-/g, '→')}）：\n${product.sellingPoints}\n目标人群：${product.targetAudience}\n使用场景：${product.scenario}`

    const transcriptLen = transcript ? transcript.replace(/\s/g, '').length : 0
    const iterOrderLabels = spOrder.split('-')

    const systemPrompt = `你是一个千川投流脚本仿写助手，正在帮员工迭代千川脚本。

## 不可动摇的规则
1. **开头只允许替换品牌名**——爆款开头「${rawOpening}」除品牌名可替换为「${product.name}」外，其余一字不改
2. **三个卖点按序覆盖**——${iterOrderLabels.join('→')}，每个写一个独立口播段落，不能少
3. **语言精简口语化**——把卖点核心意思用消费者爱听的大白话说出来
4. **字数控制**——${transcriptLen > 0 ? `原视频 ${transcriptLen} 字，脚本总字数与之基本一致` : '千川常规 250-350 字'}

## 达人风格
${selectedPersona.soul}

## 产品信息
${productDesc}

规则：员工说哪里不对就改哪里，不动没问题的部分。每次输出完整脚本+自检表。不要提问，直接改。`

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

  const productValid = product.name.trim() && product.sellingPoints.trim()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">千川脚本仿写助手</h1>
        <p className="text-sm text-gray-500 mt-1">四步完成千川投流素材仿写 · 爆款开头 + 卖点拼合</p>
      </header>

      {/* Step indicator */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-2 text-sm">
          {[
            { n: 1, label: '选达人' },
            { n: 2, label: '提炼卖点' },
            { n: 3, label: '爆款开头' },
            { n: 4, label: '拼合脚本' },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-300">{'\u2192'}</span>}
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                step === s.n ? 'bg-orange-100 text-orange-700' :
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
        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
            <button className="ml-2 underline" onClick={() => setError('')}>关闭</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            {loading}
          </div>
        )}

        {/* ========== STEP 1: 选达人 ========== */}
        {step === 1 && (
          <div className="space-y-4">
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

            {selectedPersona && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <p className="text-green-600 font-medium">{'\u2705'} {selectedPersona.name}的风格已加载</p>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  <p className="font-medium text-gray-900 mb-1">人设定位</p>
                  {selectedPersona.contentPlan.split('\n').slice(0, 8).join('\n')}
                </div>
                <button
                  className="bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-700"
                  onClick={() => setStep(2)}
                >
                  下一步：填写产品信息 →
                </button>
              </div>
            )}

            {/* 素材库 */}
            {selectedPersona && (
              <div className="bg-white rounded-lg border p-4 space-y-4">
                <h3 className="font-medium text-gray-900">千川素材库维护 <span className="text-sm font-normal text-gray-400">({selectedPersona.references.length} 条)</span></h3>
                <p className="text-sm text-gray-500">上传千川类优质素材，AI 越了解风格和套路，写出来越精准。</p>

                {!showRefForm ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      className="p-4 rounded-lg border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50 text-left transition"
                      onClick={() => { setRefType('千川爆款'); setShowRefForm(true) }}
                    >
                      <p className="font-medium text-gray-900">上传千川爆款文案</p>
                      <p className="text-xs text-gray-500 mt-1">跑量好的千川素材脚本</p>
                    </button>
                    <button
                      className="p-4 rounded-lg border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50 text-left transition"
                      onClick={() => { setRefType('对标千川'); setShowRefForm(true) }}
                    >
                      <p className="font-medium text-gray-900">上传对标千川素材</p>
                      <p className="text-xs text-gray-500 mt-1">竞品跑得好的千川素材</p>
                    </button>
                    <button
                      className="p-4 rounded-lg border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 text-left transition"
                      onClick={() => { setRefType('爆款开头'); setShowRefForm(true) }}
                    >
                      <p className="font-medium text-gray-900">上传爆款开头</p>
                      <p className="text-xs text-gray-500 mt-1">验证过有效的千川开头话术</p>
                    </button>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded">{refType}</span>
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
                      className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                      disabled={!refTitle.trim() || !refContent.trim() || !!loading}
                      onClick={handleAddReference}
                    >
                      保存
                    </button>
                  </div>
                )}

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
                            {type && <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{type}</span>}
                            {likes && <span className="ml-2 text-xs text-gray-400">{(Number(likes) / 10000).toFixed(1)}万赞</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {selectedPersona.references.length === 0 && !showRefForm && (
                  <p className="text-sm text-gray-400">选择上方类型，上传千川优质素材</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========== STEP 2: 产品信息 + 卖点 ========== */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <span className="text-green-600 font-medium">{'\u2705'} {selectedPersona?.name}</span>
                <span className="ml-2 text-gray-400">风格已加载</span>
              </p>
              <button className="text-sm text-orange-600 hover:underline" onClick={() => setStep(1)}>换达人</button>
            </div>

            <div className="bg-white rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">填写产品信息 + 提炼卖点</h3>
                  <p className="text-sm text-gray-500 mt-1">千川卖点按「背书→机制→种草」优先级排列。带 * 的为必填。</p>
                </div>
                <div>
                  <button
                    onClick={openProductFilePicker}
                    disabled={uploadingPdf}
                    className={`bg-white border-2 border-orange-500 text-orange-600 px-4 py-2 rounded-lg text-sm font-medium ${uploadingPdf ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-50 cursor-pointer'}`}
                  >
                    {uploadingPdf ? '解析中...' : '+ 添加产品文档'}
                  </button>
                  <p className="text-xs text-gray-400 mt-1 text-right">支持 PDF / Word / Excel / PPT / TXT</p>
                </div>
              </div>

              {pendingFiles.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-orange-800">已选 {pendingFiles.length} 个文档</span>
                    <div className="flex gap-2">
                      <button
                        onClick={openProductFilePicker}
                        className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                      >
                        继续添加
                      </button>
                      <button
                        className="bg-orange-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                        disabled={uploadingPdf}
                        onClick={handleParseProductFiles}
                      >
                        {uploadingPdf ? '解析中...' : '开始解析'}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pendingFiles.map((f, i) => (
                      <span key={i} className="inline-flex items-center bg-white border border-orange-200 rounded px-2 py-1 text-xs text-gray-700">
                        {f.name.length > 20 ? f.name.slice(0, 10) + '...' + f.name.slice(-8) : f.name}
                        <button className="ml-1 text-gray-400 hover:text-red-500" onClick={() => handleRemovePendingFile(i)}>x</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">产品名称 *</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="如：某某精华液、某某面膜"
                    value={product.name}
                    onChange={e => setProduct({ ...product, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">产品品类</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="如：护肤品/零食/家居用品"
                    value={product.category}
                    onChange={e => setProduct({ ...product, category: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">价格区间</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="如：199元、99-199元"
                    value={product.price}
                    onChange={e => setProduct({ ...product, price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">目标人群</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="如：25-35岁女性、敏感肌人群"
                    value={product.targetAudience}
                    onChange={e => setProduct({ ...product, targetAudience: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">卖点顺序</label>
                <div className="flex gap-2 mb-3">
                  <button
                    className={`flex-1 text-xs py-2 px-3 rounded-lg border ${spOrder === '背书-机制-种草' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-300 hover:border-orange-300'}`}
                    onClick={() => setSpOrder('背书-机制-种草')}
                  >
                    默认：背书→机制→种草
                  </button>
                  <button
                    className={`flex-1 text-xs py-2 px-3 rounded-lg border ${spOrder === '机制-背书-种草' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-300 hover:border-orange-300'}`}
                    onClick={() => setSpOrder('机制-背书-种草')}
                  >
                    炸裂机制：机制→背书→种草
                  </button>
                  <button
                    className={`flex-1 text-xs py-2 px-3 rounded-lg border ${spOrder === '背书-种草-机制' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-300 hover:border-orange-300'}`}
                    onClick={() => setSpOrder('背书-种草-机制')}
                  >
                    弱机制：背书→种草→机制
                  </button>
                </div>
                <label className="block text-sm font-medium text-gray-700 mb-1">核心卖点 *（{spOrder.replace(/-/g, '→')}）</label>
                <textarea
                  className="w-full border rounded-lg p-3 text-sm h-28"
                  placeholder={spOrder === '机制-背书-种草'
                    ? "按顺序填3个卖点：\n1. [机制] 如：独家最低价199，买一送三，仅限今天\n2. [背书] 如：韩国原装进口，跨境正品\n3. [种草] 如：涂上脸30秒就吸收，不黏不腻"
                    : spOrder === '背书-种草-机制'
                    ? "按顺序填3个卖点：\n1. [背书] 如：韩国原装进口，跨境正品\n2. [种草] 如：涂上脸30秒就吸收，不黏不腻\n3. [机制] 如：原价299，今天直播间99，买一发三"
                    : "按顺序填3个卖点：\n1. [背书] 如：韩国原装进口，跨境正品\n2. [机制] 如：原价299，今天直播间99，买一发三\n3. [种草] 如：涂上脸30秒就吸收，不黏不腻"}
                  value={product.sellingPoints}
                  onChange={e => setProduct({ ...product, sellingPoints: e.target.value })}
                />
                {spChat.length > 0 && (
                  <div className="mt-3 border border-orange-200 rounded-lg overflow-hidden">
                    <div className="bg-orange-50 px-4 py-2 border-b border-orange-200">
                      <span className="text-sm font-medium text-orange-800">AI 千川卖点讨论</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-3 space-y-3 bg-white">
                      {spLoading && spChat.filter(m => m.role === 'assistant').length === 0 && (
                        <div className="text-sm text-gray-400 text-center py-4">AI 正在分析产品卖点...</div>
                      )}
                      {spChat.map((m, i) => (
                        m.role === 'assistant' ? (
                          <div key={i} className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{m.content}</div>
                        ) : i > 0 ? (
                          <div key={i} className="text-sm text-orange-700 bg-orange-50 rounded-lg p-2 text-right">{m.content}</div>
                        ) : null
                      ))}
                      <div ref={spChatEndRef} />
                    </div>
                    <div className="border-t border-orange-200 p-2 flex gap-2">
                      <input
                        className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                        placeholder="讨论卖点，如：背书不够强，有没有更有冲击力的？"
                        value={spInput}
                        onChange={e => setSpInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSpSend())}
                        disabled={spLoading}
                      />
                      <button
                        className="bg-orange-500 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50"
                        disabled={spLoading || !spInput.trim()}
                        onClick={handleSpSend}
                      >
                        {spLoading ? '...' : '发送'}
                      </button>
                    </div>
                    {!spApplied && (
                      <div className="border-t border-orange-200 p-3 bg-orange-50">
                        <button
                          className="w-full bg-orange-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600"
                          onClick={handleApplySellingPoints}
                        >
                          ✅ 采用卖点到表单
                        </button>
                        <p className="text-xs text-orange-600 text-center mt-1.5">确认卖点后才能进入下一步</p>
                      </div>
                    )}
                    {spApplied && (
                      <div className="border-t border-orange-200 p-3 bg-green-50 text-center">
                        <span className="text-sm text-green-700 font-medium">✅ 卖点已采用到表单</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">使用场景</label>
                <textarea
                  className="w-full border rounded-lg p-3 text-sm h-20"
                  placeholder={"什么时候用？在哪用？\n例如：晚上洗完脸直接涂，早上起来皮肤状态很好"}
                  value={product.scenario}
                  onChange={e => setProduct({ ...product, scenario: e.target.value })}
                />
              </div>

              {spChat.filter(m => m.role === 'assistant').length > 0 && !spApplied && (
                <p className="text-sm text-red-500">请先点击「采用卖点到表单」确认最终卖点，才能进入下一步</p>
              )}
              <button
                className="bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                disabled={!productValid || (spChat.filter(m => m.role === 'assistant').length > 0 && !spApplied)}
                onClick={() => setStep(3)}
              >
                下一步：找爆款开头 →
              </button>
            </div>
          </div>
        )}

        {/* ========== STEP 3: 爆款开头 ========== */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Context bar */}
            <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <span className="text-green-600 font-medium">{'\u2705'} {selectedPersona?.name}</span>
                <span className="mx-2 text-gray-300">|</span>
                <span className="text-orange-600 font-medium">{'\uD83D\uDCE6'} {product.name}</span>
              </div>
              <div className="flex gap-2">
                <button className="text-sm text-orange-600 hover:underline" onClick={() => setStep(1)}>换达人</button>
                <button className="text-sm text-orange-600 hover:underline" onClick={() => setStep(2)}>改产品</button>
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4 space-y-3">
              <h3 className="font-medium text-gray-900">找一条千川爆款视频的开头</h3>
              <p className="text-sm text-gray-500">找跑量好的千川素材，提取它的开头。开头会100%原封不动用在最终脚本里。</p>
              <div className="flex gap-2">
                <button
                  className={`px-4 py-2 rounded-lg text-sm font-medium border-2 ${!manualTranscript ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  onClick={() => setManualTranscript(false)}
                >
                  粘贴视频链接（自动提取）
                </button>
                <button
                  className={`px-4 py-2 rounded-lg text-sm font-medium border-2 ${manualTranscript ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  onClick={() => setManualTranscript(true)}
                >
                  直接粘贴文案
                </button>
              </div>
            </div>

            {/* URL input */}
            {!manualTranscript && (
              <div className="bg-white rounded-lg border p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">千川爆款视频链接</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    placeholder="从抖音 app 点分享→复制链接，粘贴到这里..."
                    value={shareUrl}
                    onChange={e => setShareUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleFetchVideo()}
                  />
                  <button
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                    onClick={handleFetchVideo}
                    disabled={!shareUrl.trim() || !!loading}
                  >
                    解析
                  </button>
                </div>
              </div>
            )}

            {/* Manual transcript */}
            {manualTranscript && !transcriptConfirmed && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <label className="block text-sm font-medium text-gray-700">粘贴千川视频文案</label>
                <textarea
                  className="w-full border rounded-lg p-3 text-sm h-48"
                  placeholder="把千川爆款视频的完整文案粘贴到这里..."
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                />
                <button
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                  disabled={!transcript.trim()}
                  onClick={() => { setTranscriptConfirmed(true); handleExtractOpening() }}
                >
                  确认文案，提取开头 →
                </button>
              </div>
            )}

            {/* Video info */}
            {videoInfo && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <h3 className="font-medium text-gray-900">视频信息</h3>
                <div className="text-sm text-gray-600">
                  <p><span className="font-medium">标题：</span>{videoInfo.title}</p>
                  <p className="mt-1">
                    <span className="font-medium">点赞：</span>
                    {(videoInfo.diggCount / 10000).toFixed(1)}万
                  </p>
                </div>
              </div>
            )}

            {/* Transcript from URL */}
            {!manualTranscript && transcript && !transcriptConfirmed && (
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
                    onClick={() => { setTranscriptConfirmed(true); handleExtractOpening() }}
                  >
                    文案准确，提取开头 →
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

            {/* Viral opening extraction result */}
            {transcriptConfirmed && viralOpening && !openingConfirmed && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <h3 className="font-medium text-gray-900">AI 提取的爆款开头</h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                  <SimpleMarkdown text={viralOpening} />
                </div>
                <p className="text-xs text-gray-500">确认后，这个开头会100%原封不动地用在最终脚本里。</p>
                <div className="flex gap-2">
                  <button
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                    onClick={() => setOpeningConfirmed(true)}
                  >
                    确认开头
                  </button>
                  <button
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300"
                    onClick={() => { setTranscriptConfirmed(false); setViralOpening('') }}
                  >
                    重新选择视频
                  </button>
                </div>
              </div>
            )}

            {/* Opening confirmed → go to step 4 */}
            {openingConfirmed && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <p className="text-green-600 font-medium">{'\u2705'} 爆款开头已锁定</p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                  <SimpleMarkdown text={viralOpening} />
                </div>
                <button
                  className="bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-700"
                  onClick={() => { setStep(4); handleGenerateScript() }}
                >
                  生成千川脚本 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========== STEP 4: 拼合脚本 ========== */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Context bar */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">达人：</span>{selectedPersona?.name}
                  <span className="ml-3 font-medium">产品：</span>{product.name}
                  <span className="ml-3 font-medium">卖点：</span>{product.sellingPoints.split('\n')[0]?.slice(0, 20)}...
                </div>
                <button
                  className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700"
                  onClick={handleExport}
                >
                  导出终稿
                </button>
              </div>
            </div>

            {/* Chat messages */}
            <div className="bg-white rounded-lg border">
              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                      msg.role === 'user'
                        ? 'bg-orange-600 text-white'
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

              {/* Chat input */}
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    placeholder="告诉 AI 哪里需要修改... 如：卖点1说服力不够，背书再强一点"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                    disabled={!!loading}
                  />
                  <button
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                    onClick={handleSendChat}
                    disabled={!chatInput.trim() || !!loading}
                  >
                    发送
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">常用修改指令：「开头被改了，必须还原」「机制部分紧迫感不够」「整体太长了，压缩到200字」「语气再口语化一点」</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
