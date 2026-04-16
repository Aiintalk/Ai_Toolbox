'use client'

import { useState, useEffect, useRef } from 'react'

const BASE = '/seeding-writer'

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
  const [shareUrl, setShareUrl] = useState('')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [transcript, setTranscript] = useState('')
  const [transcriptConfirmed, setTranscriptConfirmed] = useState(false)
  const [editingTranscript, setEditingTranscript] = useState(false)
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
  const [refType, setRefType] = useState('种草文案')
  const [refContent, setRefContent] = useState('')
  const [manualTranscript, setManualTranscript] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [rawProductText, setRawProductText] = useState('')
  const [spChat, setSpChat] = useState<ChatMsg[]>([])
  const [spInput, setSpInput] = useState('')
  const [spLoading, setSpLoading] = useState(false)
  const [spApplied, setSpApplied] = useState(false)
  const spChatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

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

  function handleSelectPersona(name: string) {
    const persona = personas.find(p => p.name === name) || null
    setSelectedPersona(persona)
  }

  async function handleUploadProductPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setPendingFiles(prev => [...prev, ...Array.from(files)])
    if (fileInputRef.current) fileInputRef.current.value = ''
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
        // Auto-start selling points discussion
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

  const spSystemPrompt = `你是一个消费者心理洞察专家，帮助团队从产品资料中提炼出最能打动消费者购买的卖点。

你的任务：基于产品原始资料，站在普通消费者的角度，找出最能让人掏钱的3个卖点。

## 核心原则：不卖成分卖身份落差，不按成分组织卖点按焦虑组织卖点，数据只留最炸的一颗子弹。

## 卖点提炼三条铁律

### 铁律一：价格锚定 > 成分罗列
不说"我们用了重组胶原蛋白"，要说"和128000一支的院线注射同厂同源"。消费者不懂成分但懂价格，用价格差建立价值认知——卖的是"你本来够不到的东西，现在够得到了"。
- 操作方法：识别产品的核心功效，在医美院线中找指向同一效果的高价项目（单次1万-2万+），用这个价格差作为第一卖点。
- 如果产品资料中提供了医美锚定信息（medicalAestheticAnchor），优先使用。
- 找不到合理锚定时跳过，不强行编造。

### 铁律二：按消费者的焦虑重组，不按成分分类
产品资料通常按成分讲（A成分做什么、B成分做什么）。你必须完全打散，按消费者的问题/焦虑重新组织：每个问题下面挂对应成分。消费者的感受要从"这成分很厉害"变成"我的问题都能解决"。

### 铁律三：数据只挑最炸的，不堆量
从资料中所有实验数据里，只挑1-2个数字最大、冲击最强的。消费者记不住五个数据，但能记住"将近两倍"。

## 卖点排序规则（按消费者情绪冲击力降序）
1. 价格锚定/身份落差 → 制造"我也配"的冲动（决策触发器）
2. 问题全覆盖/场景穿透 → 给"一管搞定"的安全感（消除犹豫）
3. 数据炸弹 → 用具体数字消除"真的假的？"（临门一脚）
4. 性价比/规格优势 → 加分项彩蛋（不是决策驱动，有就提，没有不硬凑）

## 语言要求
- 用消费者能听懂的话，不用说明书语言
- "四型胶原填基底膜空洞" > "维持基底膜完整性"
- "玻色因绷带往上拽" > "强韧真表皮连接"
- 卖点要具体、可感知、有画面感

## 输出格式
先给出你推荐的3个核心卖点（按上述排序规则排列），然后说明选择理由。
用户可能会讨论、调整、替换，你要配合迭代。

当用户确认满意后，输出最终版3个卖点，格式：
【最终卖点】
1. xxx
2. xxx
3. xxx`

  async function startSellingPointsChat(rawText: string, info: any) {
    const userMsg: ChatMsg = {
      role: 'user',
      content: `以下是产品资料原文：\n\n${rawText.slice(0, 4000)}\n\nAI 初步提取的产品信息：\n产品名：${info.name}\n品类：${info.category}\n价格：${info.price}\n目标人群：${info.targetAudience}\n\n请站在消费者角度，帮我找出最能打动人购买的3个核心卖点。`
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
    // Extract final selling points from last assistant message
    const lastMsg = [...spChat].reverse().find(m => m.role === 'assistant')
    if (!lastMsg) return
    const content = lastMsg.content
    // Try to find 【最终卖点】 section
    const finalMatch = content.match(/【最终卖点】([\s\S]*?)$/m)
    if (finalMatch) {
      setProduct(prev => ({ ...prev, sellingPoints: finalMatch[1].trim() }))
    } else {
      // Fallback: extract numbered items
      const lines = content.split('\n').filter(l => /^\d+[\.\、]/.test(l.trim()))
      if (lines.length > 0) {
        setProduct(prev => ({ ...prev, sellingPoints: lines.join('\n') }))
      }
    }
    setSpApplied(true)
    showToast('卖点已更新到表单')
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

  // Step 3: Fetch video
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

  // Step 3→4: Analyze structure
  async function handleAnalyzeStructure() {
    setLoading('拆解对标结构...')
    try {
      const result = await streamChatWithUpdate(
        [{ role: 'user', content: transcript }],
        `你是一个种草短视频脚本结构分析专家。快速拆解以下种草脚本的骨架结构。格式：
1. 开头钩子（完整引用原文前2-3句，标注钩子类型：痛点型/好奇型/场景型/效果型）
2. 产品引出方式（如何从内容过渡到产品）
3. 主体段落：逐段列出功能和大约字数（区分「体验描述」「功效说明」「使用场景」「对比」等）
4. 种草力分析：产品出现位置、提及次数、植入自然度评分(1-5)
5. 收束方式（是否有行动引导/购买暗示）
6. 原文总字数
7. 预估时长
不要添加评论，只输出结构拆解。`,
        (text) => setStructureAnalysis(text)
      )
      setStructureAnalysis(result)
      setLoading('')
    } catch (e: any) {
      setError(e.message)
      setLoading('')
    }
  }

  // Step 4: AI recommend topics
  async function handleAiRecommend() {
    if (!selectedPersona) return
    setLoading('AI 推荐种草角度...')
    try {
      const productDesc = `产品：${product.name}（${product.category}）\n价格：${product.price}\n核心卖点：${product.sellingPoints}\n目标人群：${product.targetAudience}\n使用场景：${product.scenario}`

      const result = await streamChatWithUpdate(
        [{ role: 'user', content: `对标文案：\n${transcript}\n\n达人档案：\n${selectedPersona.soul}\n\n达人内容规划：\n${selectedPersona.contentPlan}\n\n待种草产品信息：\n${productDesc}${selectedPersona.references.length > 0 ? `\n\n达人优质内容参考：\n${selectedPersona.references.join('\n\n---\n\n')}` : ''}` }],
        `你是一个种草短视频选题推荐专家。你的核心能力是：从对标种草视频中提取「种草逻辑」，然后用同样的逻辑来种草一个新产品。

## 重要：核心卖点已确认
产品信息中的「核心卖点」是团队已经确认的最终版卖点，按重要性降序排列。你必须：
- 直接使用这些卖点作为种草弹药，不要自己重新提炼或替换
- 第一个卖点是最核心的种草弹药，每个角度都应该以它为主打或重要支撑
- 后续卖点作为辅助弹药分配到不同角度

## 你的工作步骤

第一步：提炼对标的种草逻辑链条（不是主题，是如何让人想买的逻辑）。
例如：「痛点共鸣→亲测体验→效果对比→自然推荐」或「场景带入→问题暴露→产品解决→效果验证」

第二步：找到对标中最有杀伤力的种草手法——是「使用前后对比」「真实翻车再逆转」「日常场景植入」还是「专业成分拆解」？

第三步：把这个种草手法应用到新产品上。直接使用产品信息中已确认的核心卖点，不要重新提炼。

第四步：推荐3个种草角度。每个角度保留对标的种草逻辑，但场景和卖点全部换成新产品。

## 输出格式

先输出：
- 对标种草逻辑（一句话）
- 核心种草手法（一个短语）
- 产品种草弹药（直接引用产品信息中已确认的核心卖点，不要修改）

再输出3个种草角度：
1. 角度标题（短、有冲突、有钩子）
   种草逻辑：对标的XX手法 → 用在产品的YY场景
   切入场景：达人生活中的什么场景自然引出产品
   种草重点：主打哪个已确认的卖点

## 重要原则
- 种草的核心是「真实感」——像在分享生活，不像在打广告
- 产品出现要自然，不能硬切
- 3个角度应该是同一种草逻辑的不同场景切入，不是3个完全不同的逻辑
- 切入场景必须来自达人的真实生活（从达人档案中找）`,
        (text) => setAiTopics(text)
      )
      setAiTopics(result)
      setLoading('')
    } catch (e: any) {
      setError(e.message)
      setLoading('')
    }
  }

  // Step 4: Write seeding script
  async function handleWrite(topic: string) {
    if (!selectedPersona) return
    const productDesc = `产品名称：${product.name}\n产品品类：${product.category}\n价格：${product.price}\n核心卖点：${product.sellingPoints}\n目标人群：${product.targetAudience}\n使用场景：${product.scenario}`

    const systemPrompt = `你是一个专业的种草内容仿写助手。你的任务是根据对标种草脚本的结构，用指定达人的风格和真实生活素材，为指定产品创作一条让人想买的种草短视频脚本。

## 最高优先级：已确认的核心卖点（必须严格按序逐条写入脚本）

产品信息中的「核心卖点」是团队已经确认的最终版，按重要性降序排列（1=最重要）。
这些卖点已经按照消费者心理视角提炼过——它们不是成分参数，而是消费者能听懂、能被打动的表述。

### 卖点写入铁律（违反任何一条视为不合格）

1. **逐条对应，不合并不省略**：已确认卖点有几条，脚本中就必须有几个可辨识的段落/片段分别承载。不允许把多个卖点塞进同一段一笔带过。
2. **严格按序**：第1个卖点放在脚本最核心的位置、占最大篇幅；后续卖点按编号顺序出现，篇幅依次递减但每个都有实质内容。
3. **原话优先，禁止退回成分语言**：卖点怎么写的，脚本里就怎么用。
   - 如果卖点写的是"和12800一支的院线注射同厂同源"，脚本里必须出现价格对比和院线关联，严禁改写成"采用3+4+17型重组胶原蛋白"这种成分介绍。
   - 如果卖点写的是数据（如"提升192%"），脚本里必须出现这个具体数字，不能改成"大幅提升"之类的模糊表述。
   - 简单来说：卖点是消费者语言就用消费者语言写，卖点是价格锚定就用价格锚定写，不要自作主张翻译回技术语言。
4. **不要从brief原文中自行提取额外卖点**：只用已确认的卖点，不要因为看到brief里有成分数据就自己加戏。

## 结构仿写铁律（每版脚本必须满足）
1. 开头完全一致：仿写的开头结构必须和对标原文完全一致——同样的句式、同样的钩子手法、同样的节奏。只替换主题关键词和产品相关信息，不改句型。
2. 结构完全一致：对标原文有几段、每段什么功能、段与段之间什么逻辑关系，仿写必须一一对应。不能加段、不能删段、不能调换顺序。
3. 字数基本一致：仿写总字数与对标原文偏差不超过10%。

## 种草写作规则
- 「真实体验感」是第一优先级——读者看完要觉得「这是她真的在用」，不是「这是广告」
- 产品植入要自然：从生活场景/痛点自然过渡到产品，不要硬切"给大家推荐一个好东西"
- 体验描述要具体：用五感（看到、摸到、闻到、感觉到）描写使用体验，不要说"效果很好"这种空话
- 达人视角：用达人的身份、生活方式、审美偏好来包装产品体验
- 适度克制：不要每句都在夸产品，穿插真实的生活内容，种草力反而更强
- 留购买钩子：结尾自然留一个让人想下单的触发点，但不要喊"快去买"

## 禁止事项
- 不要出现「推荐给大家」「安利一下」等明显广告用语
- 不要从brief原文中额外提取未经确认的卖点塞进脚本；已确认的核心卖点必须全部覆盖
- 不要编造使用体验，没有的体验标注 [待填：需要达人提供XX方面的真实使用感受]
- 不要说教，保持分享口吻
- **严禁把已确认的消费者语言卖点改写成成分/技术语言**——这是最常见的错误

## SOUL.md 风格要求
${selectedPersona.soul}

## 达人内容规划
${selectedPersona.contentPlan}
${selectedPersona.references.length > 0 ? `
## 达人优质内容参考
以下是达人已有的优质内容，仿写时参考其风格、节奏和表达习惯：
${selectedPersona.references.join('\n\n---\n\n')}
` : ''}
## 待种草产品信息
${productDesc}

## 对标文案
${transcript}

## 对标结构分析
${structureAnalysis}

## 种草角度
${topic}

每次输出完整脚本，不给零散片段。输出后附上：
1. 三条铁律自检表（markdown表格）
2. 卖点对齐自检：逐条列出已确认的核心卖点，标注每个卖点在脚本中对应哪些段落、占多少篇幅。如果有卖点未体现，必须说明原因
3. 种草力自检：产品出现次数、植入自然度(1-5分)、是否有购买钩子`

    const userMsg = `请根据对标结构和种草角度「${topic}」，用${selectedPersona.name}的风格为「${product.name}」写第一版种草脚本。`
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

  // Step 4: Send chat message for iteration
  async function handleSendChat() {
    if (!chatInput.trim() || !selectedPersona) return
    const userMsg: ChatMsg = { role: 'user', content: chatInput }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setLoading('AI 修改中...')

    const productDesc = `产品名称：${product.name}\n产品品类：${product.category}\n价格：${product.price}\n核心卖点：${product.sellingPoints}\n目标人群：${product.targetAudience}\n使用场景：${product.scenario}`

    const systemPrompt = `你是一个专业的种草内容仿写助手，正在帮员工迭代种草脚本。

## 不可动摇的规则（每次迭代都必须满足）

### 卖点写入铁律
1. 已确认的核心卖点必须全部覆盖，每个卖点有独立段落，不允许合并或省略
2. 第1个卖点篇幅最大，放在最核心位置
3. **严禁把已确认卖点改写成成分/技术语言**——卖点写的是价格锚定就用价格锚定，写的是具体数字就用具体数字，原话怎么写脚本里就怎么用
4. 不要从brief原文中额外提取未确认的卖点

### 结构铁律
1. 开头结构与对标一致
2. 整体结构与对标一致
3. 字数偏差≤10%

### 种草写作规则
真实体验感、自然植入、五感描写、达人视角、适度克制

## 达人档案
${selectedPersona.soul}

## 待种草产品信息
${productDesc}

## 对标文案
${transcript}

## 对标结构分析
${structureAnalysis}

规则：员工说哪里不对就改哪里，不动没问题的部分。每次输出完整脚本+自检表+种草力自检。`

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
      <header className="bg-white border-b px-6 py-4 flex items-center gap-3">
        <a href="/" className="text-gray-400 hover:text-gray-600 transition-colors" title="返回首页">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        </a>
        <div>
          <h1 className="text-xl font-bold text-gray-900">种草内容仿写助手</h1>
          <p className="text-sm text-gray-500 mt-1">四步完成种草带货内容仿写 · 写出让人想买的内容</p>
        </div>
      </header>

      {/* Step indicator */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-2 text-sm">
          {[
            { n: 1, label: '选达人' },
            { n: 2, label: '产品信息' },
            { n: 3, label: '对标验证' },
            { n: 4, label: '种草仿写' },
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
        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
            <button className="ml-2 underline" onClick={() => setError('')}>关闭</button>
          </div>
        )}

        {/* Loading display */}
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
                <h3 className="font-medium text-gray-900">日常素材库维护 <span className="text-sm font-normal text-gray-400">({selectedPersona.references.length} 条)</span></h3>
                <p className="text-sm text-gray-500">上传达人的种草类优质内容，AI 越了解风格，写出来越像。</p>

                {!showRefForm ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      className="p-4 rounded-lg border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50 text-left transition"
                      onClick={() => { setRefType('种草爆款'); setShowRefForm(true) }}
                    >
                      <p className="font-medium text-gray-900">上传种草爆款文案</p>
                      <p className="text-xs text-gray-500 mt-1">{selectedPersona.name}数据好的种草视频文案</p>
                    </button>
                    <button
                      className="p-4 rounded-lg border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50 text-left transition"
                      onClick={() => { setRefType('对标种草'); setShowRefForm(true) }}
                    >
                      <p className="font-medium text-gray-900">上传对标种草内容</p>
                      <p className="text-xs text-gray-500 mt-1">觉得好的别人的种草内容</p>
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
                  <p className="text-sm text-gray-400">选择上方类型，上传达人的优质种草内容</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========== STEP 2: 产品信息 ========== */}
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
                  <h3 className="font-medium text-gray-900">填写待种草产品信息</h3>
                  <p className="text-sm text-gray-500 mt-1">产品信息越详细，AI 写出来的种草内容越精准。带 * 的为必填。</p>
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.docx,.xlsx,.xls,.pptx"
                    multiple
                    className="hidden"
                    onChange={handleUploadProductPdf}
                  />
                  <button
                    className="bg-white border-2 border-orange-500 text-orange-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-50 disabled:opacity-50"
                    disabled={uploadingPdf}
                    onClick={() => fileInputRef.current?.click()}
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
                        className="text-xs text-gray-500 hover:text-gray-700"
                        onClick={() => fileInputRef.current?.click()}
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
                        <button className="ml-1 text-gray-400 hover:text-red-500" onClick={() => handleRemovePendingFile(i)}>×</button>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">核心卖点 *</label>
                <textarea
                  className="w-full border rounded-lg p-3 text-sm h-28"
                  placeholder={"产品最打动人的点是什么？写2-3个核心卖点。\n例如：\n1. 敏感肌专用，零刺激配方\n2. 上脸30秒就能感觉到水润\n3. 一瓶顶三瓶，性价比极高"}
                  value={product.sellingPoints}
                  onChange={e => setProduct({ ...product, sellingPoints: e.target.value })}
                />
                {spChat.length > 0 && (
                  <div className="mt-3 border border-orange-200 rounded-lg overflow-hidden">
                    <div className="bg-orange-50 px-4 py-2 flex items-center justify-between border-b border-orange-200">
                      <span className="text-sm font-medium text-orange-800">AI 卖点讨论</span>
                      <button
                        className="text-xs bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600"
                        onClick={handleApplySellingPoints}
                      >
                        采用卖点到表单
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-3 space-y-3 bg-white">
                      {spChat.filter(m => m.role === 'assistant').length > 0 && spChat.map((m, i) => (
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
                        placeholder="讨论卖点，例如：第2个卖点换成性价比方向"
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
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">使用场景</label>
                <textarea
                  className="w-full border rounded-lg p-3 text-sm h-20"
                  placeholder={"什么时候用？在哪用？配合什么用？\n例如：晚上洗完脸直接涂，早上起来皮肤状态很好"}
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
                下一步：对标验证 →
              </button>
            </div>
          </div>
        )}

        {/* ========== STEP 3: 对标验证 ========== */}
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

            {/* Input method choice */}
            <div className="bg-white rounded-lg border p-4 space-y-3">
              <h3 className="font-medium text-gray-900">上传对标种草视频</h3>
              <p className="text-sm text-gray-500">找一条你觉得「种草力很强」的对标视频，不限点赞数</p>
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

            {/* Option A: URL input */}
            {!manualTranscript && (
              <div className="bg-white rounded-lg border p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">对标视频链接</label>
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

            {/* Option B: Manual transcript */}
            {manualTranscript && !transcriptConfirmed && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <label className="block text-sm font-medium text-gray-700">粘贴对标文案</label>
                <textarea
                  className="w-full border rounded-lg p-3 text-sm h-48"
                  placeholder="把对标种草视频的文案粘贴到这里..."
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                />
                <button
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                  disabled={!transcript.trim()}
                  onClick={() => setTranscriptConfirmed(true)}
                >
                  确认文案 →
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
                    onClick={() => setTranscriptConfirmed(true)}
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

            {/* Confirmed → go to step 4 */}
            {transcriptConfirmed && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <p className="text-green-600 font-medium">{'\u2705'} 对标文案已确认</p>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {transcript.slice(0, 200)}{transcript.length > 200 ? '...' : ''}
                </div>
                <button
                  className="bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-700"
                  onClick={() => { setStep(4); handleAnalyzeStructure() }}
                >
                  进入种草仿写 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========== STEP 4: 种草仿写 ========== */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Structure analysis */}
            {structureAnalysis && !chosenTopic && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <h3 className="font-medium text-gray-900">对标种草结构拆解</h3>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {structureAnalysis}
                </div>
              </div>
            )}

            {/* Topic selection */}
            {structureAnalysis && !loading && !chosenTopic && (
              <div className="bg-white rounded-lg border p-4 space-y-4">
                <h3 className="font-medium text-gray-900">选择种草角度</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    className={`p-4 rounded-lg border-2 text-left text-sm ${topicMode === 'same' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => setTopicMode('same')}
                  >
                    <p className="font-medium">沿用原文角度</p>
                    <p className="text-gray-500 mt-1">用同样的种草逻辑，换成{product.name}</p>
                  </button>
                  <button
                    className={`p-4 rounded-lg border-2 text-left text-sm ${topicMode === 'custom' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => setTopicMode('custom')}
                  >
                    <p className="font-medium">自定义角度</p>
                    <p className="text-gray-500 mt-1">你来定种草的切入场景和重点</p>
                  </button>
                  <button
                    className={`p-4 rounded-lg border-2 text-left text-sm ${topicMode === 'ai' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => { setTopicMode('ai'); if (!aiTopics) handleAiRecommend() }}
                  >
                    <p className="font-medium">AI 推荐角度</p>
                    <p className="text-gray-500 mt-1">根据产品卖点和达人风格推荐</p>
                  </button>
                </div>

                {topicMode === 'same' && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">将沿用对标的种草逻辑，把产品换成{product.name}，用{selectedPersona?.name}的风格重写。</p>
                    <button
                      className="bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-700"
                      onClick={() => {
                        const t = `沿用对标种草逻辑，为「${product.name}」种草，用${selectedPersona?.name}的视角`
                        setChosenTopic(t)
                        handleWrite(t)
                      }}
                    >
                      确认，开始种草仿写 →
                    </button>
                  </div>
                )}

                {topicMode === 'custom' && (
                  <div className="space-y-2">
                    <textarea
                      className="w-full border rounded-lg p-3 text-sm h-24"
                      placeholder={"描述你的种草角度，包括切入场景、主打卖点...\n例如：从早晨护肤场景切入，主打上脸即吸收的体验感"}
                      value={customTopic}
                      onChange={e => setCustomTopic(e.target.value)}
                    />
                    <button
                      className="bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                      disabled={!customTopic.trim()}
                      onClick={() => {
                        setChosenTopic(customTopic)
                        handleWrite(customTopic)
                      }}
                    >
                      确认，开始种草仿写 →
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
                        placeholder="输入你选的种草角度（或直接粘贴上面的标题）..."
                        value={customTopic}
                        onChange={e => setCustomTopic(e.target.value)}
                      />
                      <button
                        className="bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                        disabled={!customTopic.trim()}
                        onClick={() => {
                          setChosenTopic(customTopic)
                          handleWrite(customTopic)
                        }}
                      >
                        开始种草仿写 →
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
                    <span className="ml-3 font-medium">产品：</span>{product.name}
                    <span className="ml-3 font-medium">角度：</span>{chosenTopic.slice(0, 30)}{chosenTopic.length > 30 ? '...' : ''}
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
                      placeholder="告诉 AI 哪里需要修改... 如：产品植入太硬了，再自然一点"
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
                  <p className="text-xs text-gray-400 mt-2">常用修改指令：「产品植入再自然一点」「开头钩子不够强」「卖点说得太直白了」「体验描述再具体一点」</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
