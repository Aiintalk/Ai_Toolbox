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
  const [spOrder, setSpOrder] = useState<'背书-机制-种草' | '机制-背书-种草' | '背书-种草-机制'>('背书-机制-种草')
  const [showPasteMode, setShowPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')

  // Step 3: Viral opening
  const [step3Tab, setStep3Tab] = useState<'paste' | 'video'>('paste')
  const [showFullTranscript, setShowFullTranscript] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [transcript, setTranscript] = useState('')
  const [transcriptConfirmed, setTranscriptConfirmed] = useState(false)
  const [editingTranscript, setEditingTranscript] = useState(false)
  const [manualTranscript, setManualTranscript] = useState(false)
  const [directOpening, setDirectOpening] = useState(false)
  const [directOpeningText, setDirectOpeningText] = useState('')
  const [showOpeningPaste, setShowOpeningPaste] = useState(false)
  const [openingPasteText, setOpeningPasteText] = useState('')
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

  // ===== 字数校验 =====

  function extractScriptText(aiOutput: string): string {
    const lines = aiOutput.split('\n')
    const scriptLines: string[] = []
    let inTable = false
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('|') || trimmed.startsWith('---') || trimmed.startsWith('自检') || trimmed.startsWith('铁律') || trimmed.startsWith('总字数') || trimmed.startsWith('- 总字数') || trimmed.startsWith('- 语速') || trimmed.startsWith('- 预估') || trimmed.startsWith('- 自检')) {
        inTable = true
        continue
      }
      if (inTable && trimmed === '') { inTable = false; continue }
      if (!inTable) scriptLines.push(trimmed)
    }
    return scriptLines.join('').replace(/\s/g, '')
  }

  function countChineseChars(text: string): number {
    return extractScriptText(text).length
  }

  async function autoTrimIfTooLong(
    assistantText: string,
    targetMax: number,
    allMessages: ChatMsg[],
    systemPrompt: string,
    onUpdate: (msgs: ChatMsg[]) => void
  ): Promise<string> {
    const actual = countChineseChars(assistantText)
    if (actual <= targetMax || targetMax <= 0) return assistantText

    const trimMsg: ChatMsg = {
      role: 'user',
      content: `脚本超字数了。当前约${actual}字，上限${targetMax}字，需要砍掉${actual - targetMax}字以上。请精简内容，删减冗余表达，压到${targetMax}字以内。直接输出压缩后的完整脚本+自检表，不要解释。`
    }
    const trimMessages = [...allMessages, trimMsg]
    onUpdate(trimMessages)

    let trimmedText = ''
    await streamChatWithUpdate(
      trimMessages.map(m => ({ role: m.role, content: m.content })),
      systemPrompt,
      (text) => {
        trimmedText = text
        onUpdate([...trimMessages, { role: 'assistant', content: text }])
      }
    )
    return trimmedText
  }

  // ===== Step 1: Persona =====

  function handleSelectPersona(name: string) {
    const persona = personas.find(p => p.name === name) || null
    setSelectedPersona(persona)
  }

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

    const systemPrompt = `你是一个千川投流脚本写手。直接输出，不要提问，不要确认。

## 铁律（硬性，必须满足）
1. 不要写开头——开头由系统自动拼接，你从卖点段落开始写，到行动号召结束
2. 三个卖点按「${orderLabels.join('→')}」顺序排列，每类一个独立口播段落
3. 字数控制——${transcriptLength > 0 ? `原视频 ${transcriptLength} 字，不能超过这个数。宁可少10%，绝不多1%` : '千川常规不超过 1000 字'}
4. 不要加入卖点素材里没提到的信息，不要自己编数据

## 创作指南
铁律之外，放开写。你的首要任务是写出让人停下来看完、想下单的内容。语言精简成消费者爱听的大白话，像对着镜头说话，不像念稿。

如果素材中缺少某类卖点（尤其是机制类的价格/促销信息），在该段落标注 [需补充]。

## 卖点素材
${product.sellingPoints}

### 卖点分类参考
- **背书**：建立信任和权威感。如：品牌来源、明星同款、机构认证、销量数据、专利技术等
- **机制**：涉及价格/促销/赠品/限时。如：原价vs现价、买赠、限时优惠等。产品技术原理不是机制，是背书或种草
- **种草**：产品功效/体验/成分。如：核心成分、使用体验、效果数据等

## 脚本结构（不写开头）
${structureDesc}
${orderLabels.length + 2}. 【行动号召】简短下单引导

## 参考材料（辅助，不是束缚）
### 达人风格
${selectedPersona.soul}

### 产品信息
${productDesc}

## 输出格式
直接输出脚本正文（带【卖点1-背书】【卖点2-机制】【卖点3-种草】【行动号召】标注，不要写【开头】），然后附上：
- 总字数 | 语速参考 | 预估时长
- 自检表（卖点是否按序？字数是否达标？）
- 原创度自检：逐段对比对标原文和你的仿写，列出相似度高的句子（直接搬用或仅替换个别词的算高相似）。如果整体文字重复率超过50%，明确标红提醒"需要进一步改写以避免抄袭风险"。`

    const userMsg = `直接输出脚本正文（不写开头，从卖点开始），不要提问。

卖点素材：
${product.sellingPoints}
卖点顺序：${orderLabels.join('→')}（根据内容自动归类后按此顺序排列）
${transcriptLength > 0 ? `原视频文案字数：${transcriptLength}字，脚本总字数不能超过这个数。` : ''}
达人风格：${selectedPersona.name}

从【卖点1】开始写，不要写【开头】。`
    const newMessages: ChatMsg[] = [{ role: 'user', content: userMsg }]
    setChatMessages(newMessages)
    setLoading('AI 生成千川脚本...')

    // 开头前缀：系统自动拼接，AI 不写
    const openingPrefix = `【开头】\n${rawOpening}\n\n`

    try {
      let assistantMsg = ''
      await streamChatWithUpdate(
        newMessages.map(m => ({ role: m.role, content: m.content })),
        systemPrompt,
        (text) => {
          assistantMsg = text
          setChatMessages([...newMessages, { role: 'assistant', content: openingPrefix + text }])
        }
      )
      // 拼接开头到最终输出
      const finalMsg = openingPrefix + assistantMsg
      const msgsAfterFirst = [...newMessages, { role: 'assistant' as const, content: finalMsg }]
      setChatMessages(msgsAfterFirst)

      // 后置字数校验
      const targetMax = transcriptLength > 0 ? transcriptLength : 1000
      setLoading('校验字数...')
      const trimmed = await autoTrimIfTooLong(finalMsg, targetMax, msgsAfterFirst, systemPrompt, setChatMessages)
      if (trimmed !== finalMsg) {
        setChatMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: trimmed }])
      }
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

    const systemPrompt = `你是一个千川投流脚本写手，正在帮员工迭代千川脚本。

## 铁律（硬性）
1. 不要写开头——开头由系统自动拼接，你从卖点段落写到行动号召
2. 三个卖点按序覆盖——${iterOrderLabels.join('→')}，每个一个独立口播段落
3. 字数控制——${transcriptLen > 0 ? `原视频 ${transcriptLen} 字，不能超过，宁短勿长` : '千川常规不超过 1000 字'}

铁律之外放开写，写出让人停下来看完、想下单的内容。大白话，像对着镜头说话。

## 参考材料（辅助）
### 达人风格
${selectedPersona.soul}

### 产品信息
${productDesc}

员工说哪里不对就改哪里，不动没问题的部分。每次输出完整脚本+自检表+原创度自检。不要提问，直接改。`

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
      const msgsAfterIter = [...newMessages, { role: 'assistant' as const, content: assistantMsg }]
      setChatMessages(msgsAfterIter)

      // 后置字数校验
      const iterTargetMax = transcriptLen > 0 ? transcriptLen : 1000
      setLoading('校验字数...')
      const trimmed = await autoTrimIfTooLong(assistantMsg, iterTargetMax, msgsAfterIter, systemPrompt, setChatMessages)
      if (trimmed !== assistantMsg) {
        setChatMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: trimmed }])
      }
      setLoading('')
    } catch (e: any) {
      setError(e.message)
      setLoading('')
    }
  }

  function handleExport() {
    const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant')
    if (!lastAssistant) return
    const text = lastAssistant.content
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `千川脚本_${product.name || '终稿'}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('终稿已下载')
  }

  async function parseFileToText(file: File): Promise<string> {
    const name = file.name.toLowerCase()
    if (name.endsWith('.txt') || name.endsWith('.md') || !name.includes('.')) {
      return file.text()
    }
    // 其他格式发到后端解析
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${BASE}/api/parse-file`, { method: 'POST', body: formData })
    if (!res.ok) throw new Error('文件解析失败')
    const data = await res.json()
    return data.text || ''
  }

  function extractProductName(text: string): string {
    // 尝试从卖点卡中提取产品名称
    // 常见格式：「一句话总结」后面跟产品描述
    const summaryMatch = text.match(/一句话总结[：:]?\s*(.+)/m)
    if (summaryMatch) {
      // 取前20个字作为产品名
      return summaryMatch[1].trim().slice(0, 20)
    }
    // 尝试从标题提取
    const titleMatch = text.match(/^#+ .+极致卖点卡[：:]\s*(.+)/m)
    if (titleMatch) return titleMatch[1].trim().slice(0, 20)
    return ''
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
            { n: 2, label: '粘贴卖点' },
            { n: 3, label: '获取开头' },
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
                  下一步：粘贴卖点 →
                </button>
              </div>
            )}

          </div>
        )}

        {/* ========== STEP 2: 上传卖点卡 ========== */}
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
              <div>
                <h3 className="font-medium text-gray-900">上传极致卖点卡</h3>
                <p className="text-sm text-gray-500 mt-1">
                  先用
                  <a href="/selling-point-extractor" target="_blank" className="text-orange-600 hover:underline mx-1 font-medium">卖点提取器</a>
                  提炼产品卖点，然后把生成的「极致卖点卡」上传到这里。
                </p>
              </div>

              {/* 上传区域 */}
              {!product.sellingPoints && !showPasteMode && (
                <div
                  className="border-2 border-dashed border-orange-300 rounded-lg p-8 text-center cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-colors"
                  onClick={() => document.getElementById('sp-file-input')?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-orange-500', 'bg-orange-50') }}
                  onDragLeave={e => { e.currentTarget.classList.remove('border-orange-500', 'bg-orange-50') }}
                  onDrop={e => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('border-orange-500', 'bg-orange-50')
                    const file = e.dataTransfer.files[0]
                    if (file) {
                      parseFileToText(file).then(text => {
                        setProduct({ ...product, sellingPoints: text, name: extractProductName(text) })
                      }).catch(() => setError('文件解析失败'))
                    }
                  }}
                >
                  <input
                    id="sp-file-input"
                    type="file"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) {
                        parseFileToText(file).then(text => {
                          setProduct({ ...product, sellingPoints: text, name: extractProductName(text) })
                        }).catch(() => setError('文件解析失败'))
                      }
                    }}
                  />
                  <div className="text-4xl mb-3">{'\uD83D\uDCC4'}</div>
                  <p className="text-sm font-medium text-gray-700">点击上传或拖拽文件到这里</p>
                  <p className="text-xs text-gray-400 mt-1">支持 .md / .txt / .pages / .docx / .pdf 等格式</p>
                  <p className="text-xs text-gray-400 mt-3">—— 或者 ——</p>
                  <button
                    className="mt-2 text-sm text-orange-600 hover:underline font-medium"
                    onClick={e => {
                      e.stopPropagation()
                      setShowPasteMode(true)
                    }}
                  >
                    直接粘贴文本
                  </button>
                </div>
              )}

              {/* 粘贴模式 */}
              {!product.sellingPoints && showPasteMode && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">粘贴卖点卡内容</label>
                    <button className="text-xs text-gray-400 hover:text-orange-500" onClick={() => { setShowPasteMode(false); setPasteText('') }}>返回上传</button>
                  </div>
                  <textarea
                    className="w-full border rounded-lg p-3 text-sm h-48"
                    placeholder={"把「卖点提取器」输出的极致卖点卡粘贴到这里..."}
                    autoFocus
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                  />
                  <button
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                    disabled={!pasteText.trim()}
                    onClick={() => {
                      setProduct({ ...product, sellingPoints: pasteText.trim(), name: extractProductName(pasteText) })
                      setShowPasteMode(false)
                      setPasteText('')
                    }}
                  >
                    确认
                  </button>
                </div>
              )}

              {/* 已上传/粘贴内容 */}
              {product.sellingPoints && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">产品名称</label>
                      <button
                        className="text-xs text-gray-400 hover:text-red-500"
                        onClick={() => { setProduct({ ...emptyProduct }); setShowPasteMode(false) }}
                      >
                        清空重来
                      </button>
                    </div>
                    <input
                      type="text"
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="从卖点卡自动识别，也可手动修改"
                      value={product.name}
                      onChange={e => setProduct({ ...product, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">卖点顺序</label>
                    <div className="flex gap-2">
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
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">卖点卡内容</label>
                    <textarea
                      className="w-full border rounded-lg p-3 text-sm h-48"
                      placeholder={"把「卖点提取器」输出的极致卖点卡粘贴到这里..."}
                      value={product.sellingPoints}
                      onChange={e => setProduct({ ...product, sellingPoints: e.target.value })}
                    />
                  </div>
                </>
              )}

              <button
                className="bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                disabled={!productValid}
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
                <button className="text-sm text-orange-600 hover:underline" onClick={() => setStep(2)}>改卖点</button>
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4 space-y-4">
              <div>
                <h3 className="font-medium text-gray-900">获取爆款开头</h3>
                <p className="text-sm text-gray-500 mt-1">找到跑量好的千川素材，获取它的开头文案。开头会100%原封不动用在最终脚本里。注意：只需要前1-3句话的开头，不要全文。</p>
              </div>

              {!openingConfirmed && (
                <>
                  {/* Tab 切换 */}
                  <div className="flex gap-0">
                    <button
                      className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${
                        step3Tab === 'paste'
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setStep3Tab('paste')}
                    >
                      直接粘贴
                    </button>
                    <button
                      className={`px-4 py-2 text-sm font-medium rounded-r-lg border border-l-0 ${
                        step3Tab === 'video'
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setStep3Tab('video')}
                    >
                      从视频链接提取
                    </button>
                  </div>

                  {/* Tab: 直接粘贴 */}
                  {step3Tab === 'paste' && (
                    <>
                      {!directOpeningText && (
                        <div className="space-y-3">
                          <textarea
                            className="w-full border-2 border-dashed border-orange-300 rounded-lg p-4 text-sm h-32 focus:border-orange-500 focus:outline-none"
                            placeholder="粘贴爆款开头文案（前1-3句话）..."
                            value={openingPasteText}
                            onChange={e => setOpeningPasteText(e.target.value)}
                          />
                          <button
                            className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                            disabled={!openingPasteText.trim()}
                            onClick={() => setDirectOpeningText(openingPasteText.trim())}
                          >
                            确认
                          </button>
                        </div>
                      )}

                      {directOpeningText && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-gray-700">开头内容</label>
                            <button className="text-xs text-gray-400 hover:text-red-500" onClick={() => { setDirectOpeningText(''); setOpeningPasteText('') }}>清空重来</button>
                          </div>
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                            {directOpeningText}
                          </div>
                          <button
                            className="bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-700"
                            onClick={() => {
                              setViralOpening(`【爆款开头】\n${directOpeningText.trim()}`)
                              setOpeningConfirmed(true)
                            }}
                          >
                            确认开头，生成脚本 →
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Tab: 从视频链接提取 */}
                  {step3Tab === 'video' && (
                    <>
                      {/* 输入链接 + 提取按钮 */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 border rounded-lg px-3 py-2 text-sm"
                          placeholder="粘贴抖音视频分享链接"
                          value={shareUrl}
                          onChange={e => setShareUrl(e.target.value)}
                          disabled={!!loading}
                        />
                        <button
                          className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap"
                          disabled={!shareUrl.trim() || !!loading}
                          onClick={handleFetchVideo}
                        >
                          提取开头
                        </button>
                      </div>

                      {/* 转录完成后：显示完整转录文本（可折叠） */}
                      {transcript && (
                        <div className="space-y-3">
                          <div>
                            <button
                              className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
                              onClick={() => setShowFullTranscript(!showFullTranscript)}
                            >
                              <span className="text-xs">{showFullTranscript ? '\u25BC' : '\u25B6'}</span>
                              完整转录文本（{transcript.replace(/\s/g, '').length}字）
                            </button>
                            {showFullTranscript && (
                              <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                {transcript}
                              </div>
                            )}
                          </div>

                          {/* AI 提取开头：自动触发或显示结果 */}
                          {!viralOpening && !extractingOpening && (
                            <button
                              className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700"
                              onClick={handleExtractOpening}
                            >
                              AI 提取开头
                            </button>
                          )}

                          {extractingOpening && (
                            <div className="text-sm text-orange-600">AI 正在提取开头...</div>
                          )}

                          {viralOpening && (
                            <div className="space-y-3">
                              <label className="block text-sm font-medium text-gray-700">AI 提取的开头</label>
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                                {viralOpening}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  className="bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-700"
                                  onClick={() => {
                                    // 从 AI 输出中提取纯开头文本
                                    const match = viralOpening.match(/【爆款开头】\s*([\s\S]*?)(?=\n【|$)/)
                                    const extracted = match ? match[1].trim() : viralOpening
                                    setDirectOpeningText(extracted)
                                    setOpeningConfirmed(true)
                                  }}
                                >
                                  确认开头，生成脚本 →
                                </button>
                                <button
                                  className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
                                  onClick={() => { setViralOpening(''); handleExtractOpening() }}
                                >
                                  重新提取
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Opening confirmed */}
              {openingConfirmed && (
                <div className="space-y-3">
                  <p className="text-green-600 font-medium">{'\u2705'} 爆款开头已锁定</p>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                    {directOpeningText}
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
                  className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleExport}
                  disabled={!!loading}
                >
                  {loading ? '生成中...' : '导出终稿'}
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
