'use client'

import { useState, useEffect, useRef } from 'react'

const BASE = '/livestream-writer'

interface Persona { name: string; soul: string; contentPlan: string; references: string[] }
interface ChatMsg { role: 'user' | 'assistant'; content: string }
interface ProductInfo {
  name: string
  sellingPoints: string
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
  sellingPoints: '',
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

  // Step 3: Reference script
  const [refScript, setRefScript] = useState('')
  const [refConfirmed, setRefConfirmed] = useState(false)
  const [showRefPasteMode, setShowRefPasteMode] = useState(false)
  const [refPasteText, setRefPasteText] = useState('')

  // Step 4: Final script
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // UI
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetch(`/material-library/api/personas`).then(r => r.json()).then(d => {
      setPersonas(d.personas || [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
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
      if (trimmed.startsWith('|') || trimmed.startsWith('---') || trimmed.startsWith('自检') || trimmed.startsWith('铁律') || trimmed.startsWith('总字数') || trimmed.startsWith('- 总字数') || trimmed.startsWith('- 语速') || trimmed.startsWith('- 预估') || trimmed.startsWith('- 自检') || trimmed.startsWith('原创度')) {
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

  function handleSelectPersona(name: string) {
    const persona = personas.find(p => p.name === name) || null
    setSelectedPersona(persona)
  }

  async function parseFileToText(file: File): Promise<string> {
    const name = file.name.toLowerCase()
    if (name.endsWith('.txt') || name.endsWith('.md') || !name.includes('.')) {
      return file.text()
    }
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${BASE}/api/parse-file`, { method: 'POST', body: formData })
    if (!res.ok) throw new Error('文件解析失败')
    const data = await res.json()
    return data.text || ''
  }

  function extractProductName(text: string): string {
    const summaryMatch = text.match(/一句话总结[：:]?\s*(.+)/m)
    if (summaryMatch) return summaryMatch[1].trim().slice(0, 20)
    const titleMatch = text.match(/^#+ .+极致卖点卡[：:]\s*(.+)/m)
    if (titleMatch) return titleMatch[1].trim().slice(0, 20)
    return ''
  }

  // ===== Step 4: 生成脚本 =====

  async function handleGenerateScript() {
    if (!selectedPersona || !refConfirmed) return

    const refLength = refScript.replace(/\s/g, '').length
    const orderLabels = spOrder.split('-')

    const systemPrompt = `你是一个直播间讲解脚本写手，正在基于对标直播间的讲解结构，为达人仿写一段直播间讲解脚本。直接输出，不要提问，不要确认。

## 铁律（硬性，必须满足）
1. 脚本结构参考对标，但用达人风格说话、用新产品的卖点填充
2. 三个卖点按「${orderLabels.join('→')}」顺序穿插在讲解中，不要生硬分段
3. 字数控制——对标文案约 ${refLength} 字，仿写脚本不能超过这个数。宁可少10%，绝不多1%
4. 不要加入卖点素材里没提到的信息，不要自己编数据

## 直播间脚本的特征（和千川短视频不一样）
- **讲解有节奏**：引入 → 权威背书 → 产品讲解 → 机制推销 → 促单催单
- **必有互动话术**：「家人们」「姐妹们」「听我说」「扣1扣1」「左上角点小黄车」「数量不多抓紧下单」
- **节奏更慢、更从容**：不是30秒抓人，是3-5分钟完整讲明白一个品
- **有紧迫感营造**：「最后XX单」「错过这次没有下次」「仅此一场」
- **口语化 + 重复强调**：重要信息反复说、用短句、语气词多

## 创作指南
铁律之外，放开写。仿写不是照搬——学对标的**讲解结构和节奏**，不是抄对标的词句。卖点和品牌信息必须用新产品的，达人的口头禅和说话习惯必须保留。

如果素材中缺少某类卖点（尤其是机制类的价格/促销信息），在对应段落标注 [需补充]。

## 卖点素材
${product.sellingPoints}

### 卖点分类参考
- **背书**：建立信任和权威感。如：品牌来源、明星同款、机构认证、销量数据、专利技术等
- **机制**：涉及价格/促销/赠品/限时。如：原价vs现价、买赠、限时优惠等
- **种草**：产品功效/体验/成分。如：核心成分、使用体验、效果数据等

## 对标直播间文案（学结构和节奏，不是抄词句）
${refScript}

## 达人风格（必须保留）
${selectedPersona.soul}

## 输出格式
直接输出完整的直播间讲解脚本（用【引入】【背书】【讲解】【机制】【促单】等段落标注），然后附上：
- 总字数 | 预估讲解时长
- 自检表（卖点是否按序？字数是否达标？有没有互动话术？有没有紧迫感？）
- 原创度自检：逐段对比对标原文和你的仿写，列出相似度高的句子（直接搬用或仅替换个别词的算高相似）。如果整体文字重复率超过50%，明确标红提醒"需要进一步改写以避免抄袭风险"。`

    const userMsg = `直接输出直播间讲解脚本，不要提问。

产品：${product.name}
卖点顺序：${orderLabels.join('→')}
对标字数：${refLength}字，脚本不能超过
达人风格：${selectedPersona.name}

请按对标的结构和节奏，用${selectedPersona.name}的风格讲解这个新产品。`

    const newMessages: ChatMsg[] = [{ role: 'user', content: userMsg }]
    setChatMessages(newMessages)
    setLoading('AI 生成直播间脚本...')

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
      const msgsAfterFirst = [...newMessages, { role: 'assistant' as const, content: assistantMsg }]
      setChatMessages(msgsAfterFirst)

      const targetMax = refLength > 0 ? refLength : 2000
      setLoading('校验字数...')
      const trimmed = await autoTrimIfTooLong(assistantMsg, targetMax, msgsAfterFirst, systemPrompt, setChatMessages)
      if (trimmed !== assistantMsg) {
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

    const refLen = refScript.replace(/\s/g, '').length
    const iterOrderLabels = spOrder.split('-')

    const systemPrompt = `你是一个直播间讲解脚本写手，正在帮员工迭代脚本。

## 铁律（硬性）
1. 脚本结构参考对标直播间，用达人风格说话
2. 三个卖点按「${iterOrderLabels.join('→')}」顺序穿插
3. 字数控制——对标 ${refLen} 字，不能超过，宁短勿长
4. 必须保留直播间互动话术（「家人们」「扣1」「小黄车」等）和紧迫感

铁律之外放开写，大白话，像对着直播间观众说话。

## 卖点素材
${product.sellingPoints}

## 对标
${refScript}

## 达人风格
${selectedPersona.soul}

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

      const iterTargetMax = refLen > 0 ? refLen : 2000
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
    a.download = `直播间脚本_${product.name || '终稿'}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('终稿已下载')
  }

  const productValid = product.name.trim() && product.sellingPoints.trim()

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">
          {toast}
        </div>
      )}

      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">直播间脚本仿写助手</h1>
        <p className="text-sm text-gray-500 mt-1">四步完成直播间讲解脚本仿写 · 对标结构 + 达人风格</p>
      </header>

      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-2 text-sm">
          {[
            { n: 1, label: '选达人' },
            { n: 2, label: '粘贴卖点' },
            { n: 3, label: '粘贴对标' },
            { n: 4, label: '仿写脚本' },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-300">{'\u2192'}</span>}
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                step === s.n ? 'bg-teal-100 text-teal-700' :
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
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
            <button className="ml-2 underline" onClick={() => setError('')}>关闭</button>
          </div>
        )}

        {loading && (
          <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg text-teal-700 text-sm flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            {loading}
          </div>
        )}

        {/* STEP 1: 选达人 */}
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
              {personas.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">未加载到达人列表，请先在「素材库」添加达人档案。</p>
              )}
            </div>

            {selectedPersona && (
              <div className="bg-white rounded-lg border p-4 space-y-3">
                <p className="text-green-600 font-medium">{'\u2705'} {selectedPersona.name}的风格已加载</p>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  <p className="font-medium text-gray-900 mb-1">人设定位</p>
                  {selectedPersona.contentPlan.split('\n').slice(0, 8).join('\n')}
                </div>
                <button
                  className="bg-teal-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-teal-700"
                  onClick={() => setStep(2)}
                >
                  下一步：粘贴卖点 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: 上传卖点卡 */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <span className="text-green-600 font-medium">{'\u2705'} {selectedPersona?.name}</span>
                <span className="ml-2 text-gray-400">风格已加载</span>
              </p>
              <button className="text-sm text-teal-600 hover:underline" onClick={() => setStep(1)}>换达人</button>
            </div>

            <div className="bg-white rounded-lg border p-4 space-y-4">
              <div>
                <h3 className="font-medium text-gray-900">上传极致卖点卡</h3>
                <p className="text-sm text-gray-500 mt-1">
                  先用
                  <a href="/selling-point-extractor" target="_blank" className="text-teal-600 hover:underline mx-1 font-medium">卖点提取器</a>
                  提炼产品卖点，然后把生成的「极致卖点卡」上传到这里。
                </p>
              </div>

              {!product.sellingPoints && !showPasteMode && (
                <div
                  className="border-2 border-dashed border-teal-300 rounded-lg p-8 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors"
                  onClick={() => document.getElementById('sp-file-input')?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-teal-500', 'bg-teal-50') }}
                  onDragLeave={e => { e.currentTarget.classList.remove('border-teal-500', 'bg-teal-50') }}
                  onDrop={e => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('border-teal-500', 'bg-teal-50')
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
                  <p className="text-xs text-gray-400 mt-1">支持 .md / .txt / .pages / .docx 等格式</p>
                  <p className="text-xs text-gray-400 mt-3">—— 或者 ——</p>
                  <button
                    className="mt-2 text-sm text-teal-600 hover:underline font-medium"
                    onClick={e => {
                      e.stopPropagation()
                      setShowPasteMode(true)
                    }}
                  >
                    直接粘贴文本
                  </button>
                </div>
              )}

              {!product.sellingPoints && showPasteMode && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">粘贴卖点卡内容</label>
                    <button className="text-xs text-gray-400 hover:text-teal-500" onClick={() => { setShowPasteMode(false); setPasteText('') }}>返回上传</button>
                  </div>
                  <textarea
                    className="w-full border rounded-lg p-3 text-sm h-48"
                    placeholder={"把「卖点提取器」输出的极致卖点卡粘贴到这里..."}
                    autoFocus
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                  />
                  <button
                    className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
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
                        className={`flex-1 text-xs py-2 px-3 rounded-lg border ${spOrder === '背书-机制-种草' ? 'bg-teal-500 text-white border-teal-500' : 'bg-white text-gray-600 border-gray-300 hover:border-teal-300'}`}
                        onClick={() => setSpOrder('背书-机制-种草')}
                      >
                        默认：背书→机制→种草
                      </button>
                      <button
                        className={`flex-1 text-xs py-2 px-3 rounded-lg border ${spOrder === '机制-背书-种草' ? 'bg-teal-500 text-white border-teal-500' : 'bg-white text-gray-600 border-gray-300 hover:border-teal-300'}`}
                        onClick={() => setSpOrder('机制-背书-种草')}
                      >
                        炸裂机制：机制→背书→种草
                      </button>
                      <button
                        className={`flex-1 text-xs py-2 px-3 rounded-lg border ${spOrder === '背书-种草-机制' ? 'bg-teal-500 text-white border-teal-500' : 'bg-white text-gray-600 border-gray-300 hover:border-teal-300'}`}
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
                      value={product.sellingPoints}
                      onChange={e => setProduct({ ...product, sellingPoints: e.target.value })}
                    />
                  </div>
                </>
              )}

              <button
                className="bg-teal-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                disabled={!productValid}
                onClick={() => setStep(3)}
              >
                下一步：粘贴对标 →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: 粘贴对标直播间文案 */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <span className="text-green-600 font-medium">{'\u2705'} {selectedPersona?.name}</span>
                <span className="mx-2 text-gray-300">|</span>
                <span className="text-teal-600 font-medium">{'\uD83D\uDCE6'} {product.name}</span>
              </div>
              <div className="flex gap-2">
                <button className="text-sm text-teal-600 hover:underline" onClick={() => setStep(1)}>换达人</button>
                <button className="text-sm text-teal-600 hover:underline" onClick={() => setStep(2)}>改卖点</button>
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4 space-y-4">
              <div>
                <h3 className="font-medium text-gray-900">粘贴对标直播间讲解文案</h3>
                <p className="text-sm text-gray-500 mt-1">
                  找一段跑量好的对标直播间录屏转录文案（完整的讲解段落，从引入到促单）。AI 会学习对标的<span className="font-medium text-gray-700">讲解结构和节奏</span>，用达人风格和新产品卖点重新填充。
                </p>
              </div>

              {!refConfirmed && !refScript && !showRefPasteMode && (
                <div
                  className="border-2 border-dashed border-teal-300 rounded-lg p-8 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors"
                  onClick={() => document.getElementById('ref-file-input')?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-teal-500', 'bg-teal-50') }}
                  onDragLeave={e => { e.currentTarget.classList.remove('border-teal-500', 'bg-teal-50') }}
                  onDrop={e => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('border-teal-500', 'bg-teal-50')
                    const file = e.dataTransfer.files[0]
                    if (file) {
                      parseFileToText(file).then(text => setRefScript(text)).catch(() => setError('文件解析失败'))
                    }
                  }}
                >
                  <input
                    id="ref-file-input"
                    type="file"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) {
                        parseFileToText(file).then(text => setRefScript(text)).catch(() => setError('文件解析失败'))
                      }
                    }}
                  />
                  <div className="text-4xl mb-3">{'\uD83C\uDFA5'}</div>
                  <p className="text-sm font-medium text-gray-700">点击上传或拖拽文件到这里</p>
                  <p className="text-xs text-gray-400 mt-1">支持 .md / .txt / .pages / .docx 等格式</p>
                  <p className="text-xs text-gray-400 mt-3">—— 或者 ——</p>
                  <button
                    className="mt-2 text-sm text-teal-600 hover:underline font-medium"
                    onClick={e => {
                      e.stopPropagation()
                      setShowRefPasteMode(true)
                    }}
                  >
                    直接粘贴文本
                  </button>
                </div>
              )}

              {!refConfirmed && !refScript && showRefPasteMode && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">粘贴对标直播间文案</label>
                    <button className="text-xs text-gray-400 hover:text-teal-500" onClick={() => { setShowRefPasteMode(false); setRefPasteText('') }}>返回上传</button>
                  </div>
                  <textarea
                    className="w-full border rounded-lg p-3 text-sm h-64"
                    placeholder={"粘贴对标直播间的完整讲解文案（从引入到促单的全过程）..."}
                    autoFocus
                    value={refPasteText}
                    onChange={e => setRefPasteText(e.target.value)}
                  />
                  <button
                    className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                    disabled={!refPasteText.trim()}
                    onClick={() => {
                      setRefScript(refPasteText.trim())
                      setShowRefPasteMode(false)
                      setRefPasteText('')
                    }}
                  >
                    确认
                  </button>
                </div>
              )}

              {!refConfirmed && refScript && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                      对标文案（{refScript.replace(/\s/g, '').length} 字）
                    </label>
                    <button className="text-xs text-gray-400 hover:text-red-500" onClick={() => { setRefScript(''); setRefPasteText('') }}>清空重来</button>
                  </div>
                  <textarea
                    className="w-full border rounded-lg p-3 text-sm h-64"
                    value={refScript}
                    onChange={e => setRefScript(e.target.value)}
                  />
                  <button
                    className="bg-teal-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-teal-700"
                    onClick={() => setRefConfirmed(true)}
                  >
                    确认对标，生成脚本 →
                  </button>
                </div>
              )}

              {refConfirmed && (
                <div className="space-y-3">
                  <p className="text-green-600 font-medium">{'\u2705'} 对标文案已锁定（{refScript.replace(/\s/g, '').length} 字）</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {refScript}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="bg-teal-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-teal-700"
                      onClick={() => { setStep(4); handleGenerateScript() }}
                    >
                      生成直播间脚本 →
                    </button>
                    <button
                      className="text-sm text-gray-500 hover:text-teal-600 px-4"
                      onClick={() => setRefConfirmed(false)}
                    >
                      修改对标
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: 仿写脚本 */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">达人：</span>{selectedPersona?.name}
                  <span className="ml-3 font-medium">产品：</span>{product.name}
                  <span className="ml-3 font-medium">对标：</span>{refScript.replace(/\s/g, '').length} 字
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

            <div className="bg-white rounded-lg border">
              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                      msg.role === 'user'
                        ? 'bg-teal-600 text-white'
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

              <div className="border-t p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    placeholder="告诉 AI 哪里需要修改... 如：促单部分紧迫感不够，再加点催单话术"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                    disabled={!!loading}
                  />
                  <button
                    className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                    onClick={handleSendChat}
                    disabled={!chatInput.trim() || !!loading}
                  >
                    发送
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">常用修改指令：「引入部分再抓人一点」「机制讲得太快，展开说」「互动话术太少，多加扣1」「最后促单紧迫感不够」</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
