'use client'

import { useState, useRef, useEffect } from 'react'

const BASE = '/selling-point-extractor'

const SYSTEM_PROMPT = `你是一个专业的产品卖点提取专家，专门为短视频带货场景提炼产品卖点。

用户会提供以下资料（部分可选）：
1. **产品Brief**：品牌方提供的产品介绍资料（可能有多份文档）
2. **达人文案脚本**：头部达人讲解该产品的视频文案（可能有多份文案）

---

## 你的工作流程（严格按顺序执行）

你必须按照以下 **固定的四个维度** 逐一分析产品，不能跳过任何维度，不能合并维度，不能自由发挥顺序。每个维度都要给出明确结论。

---

## 输出格式（严格遵守，不要改变结构）

### 📋 资料概览
用2-3句话概括：这是什么产品、什么品牌、核心定位。

---

### 一、机制分析（价格/促销力度）

逐项检查以下要素，有就写，没有就明确写"无"：

- **破价**：是否有破价？（史低价、全网最低、比专柜便宜多少）→ 有/无，具体描述
- **赠品**：是否有赠品？（买一送一、赠小样、赠周边）→ 有/无，具体描述
- **试用支持**：是否支持试用？（赠送试用装、小样体验、支持退换）→ 有/无，具体描述
- **限时限量**：是否有紧迫感？（前100名、仅今天、限量版）→ 有/无，具体描述
- **组合优惠**：是否有组合价？（套装价、满减、叠加券）→ 有/无，具体描述

**机制综合评价**：⭐⭐⭐⭐⭐（1-5星打分）
- 5星 = 极具竞争力（破价+赠品+限时，杀伤力极强）
- 3星 = 中规中矩（有一些优惠但不突出）
- 1星 = 无竞争力（价格一般，无特别机制）

**结论**：
- 如果≥4星：这是核心卖点，写出具体的话术建议（一句口语化的短视频话术）
- 如果≤2星：明确写「⚠️ 该产品价格机制竞争力弱，建议弱化价格话术，重点打其他维度」
- 如果3星：写出现有机制的话术，但标注"机制力度一般，不建议作为主打"

---

### 二、背书分析（信任状）

逐项检查以下要素：

- **明星代言/推荐**：有谁代言或推荐？→ 有/无，具体描述
- **权威认证**：有没有高门槛认证？（美白特证、FDA、专利号）→ 有/无，具体描述
- **专业机构背书**：有没有权威机构背书？（三甲医院、SGS、实验室检测）→ 有/无，具体描述
- **行业荣誉**：有没有排名或奖项？（天猫第一、抖音爆款榜）→ 有/无，具体描述
- **大牌同源/同厂**：是否和大牌有关联？（同工厂、同配方师、同原料）→ 有/无，具体描述

**背书综合评价**：⭐⭐⭐⭐⭐（1-5星打分）
- 5星 = 背书极强（多重权威认证+明星背书）
- 3星 = 有一定背书但门槛不高
- 1星 = 几乎无背书

**结论**：
- 如果≥4星：这是核心卖点，写出具体话术
- 如果≤2星：明确写「⚠️ 该产品缺少高门槛背书，建议通过真实体验、用户口碑、数据报告来弥补信任感」
- 如果3星：列出现有背书，标注门槛高低

---

### 三、可视化分析（视觉冲击力）

逐项检查以下要素：

- **包装颜值**：包装好不好看？有没有辨识度？适不适合出镜？→ 具体描述
- **使用效果可视化**：上脸/上手后有没有肉眼可见的变化？（搓出黑头、即时提亮、前后对比）→ 具体描述
- **产品视觉特点**：产品本身颜色、质地有没有特别之处？（粉色/绿色/透明啫喱/绵密泡沫）→ 具体描述
- **体感描述**：使用时有没有独特体感？（刺刺的、冰冰凉、热热的、滑滑的）→ 具体描述
- **使用过程看点**：使用过程有没有视觉冲击？（变色、起泡、拉丝、融化）→ 具体描述

**可视化综合评价**：⭐⭐⭐⭐⭐（1-5星打分）
- 5星 = 极强视觉冲击（天然适合短视频展示）
- 3星 = 有一些可展示的点
- 1星 = 视觉平平，不太适合视频展示

**结论**：
- 如果≥4星：这是核心卖点，写出展示建议和话术
- 如果≤2星：明确写「⚠️ 该产品视觉冲击力不足，建议通过以下方式创造视觉点：」然后给出2-3个具体建议（比如对比实验、特定拍摄角度等）
- 如果3星：列出可展示的点，给出拍摄建议

---

### 四、种草卖点分析（理性说服）

逐项检查以下要素：

- **数据报告**：有没有实验数据、检测报告、用户调研数据？→ 有/无，具体描述
- **独家成分**：有没有专利成分、独家技术、核心原料？→ 有/无，具体描述
- **配方逻辑**：产品为什么好用？底层原理是什么？→ 具体描述
- **使用场景**：适合谁？什么场景？解决什么痛点？→ 具体描述
- **口碑数据**：复购率、好评率、销量？→ 有/无，具体描述

**种草综合评价**：⭐⭐⭐⭐⭐（1-5星打分）

**结论**：
- 如果≥4星：这是核心卖点，写出话术
- 如果≤2星：标注不足并给建议
- 如果3星：列出现有种草点

---

### 🔥 极致卖点卡

以上四维分析是你的拆解依据。现在，请基于分析结果，输出一张**极致卖点卡**。
这张卡是下一步脚本创作的唯一输入，必须是一个完整的说服链，让写脚本的人拿到就知道怎么讲。

**输出格式（严格按以下顺序）**：

**🎯 一句话总结**
用一句消费者听得懂的大白话，概括这个产品最核心的吸引力。像朋友推荐一样，不要像广告文案。
（例：你夏天还想化妆出门的天菜搭子来了！）

**👀 第一击：可视化冲击**（来自可视化维度）
这个产品最直观、最能"看到效果"的卖点是什么？
- 用一句话把最震撼的数据/效果抛出来
- 说清楚用户能"看到"什么变化（上脸效果、对比数据、体感变化）
- 如果可视化维度≤2星，写"⚠️ 可视化素材不足，建议补充实测/对比内容"

**🏅 第二击：背书堆叠**（来自背书维度）
把所有权威背书逐条列出，每条要展开说：
- 这个认证/奖项/合作具体是什么
- 有多难拿到 / 代表什么水平 / 相当于什么（让人理解分量）
- 不要只罗列名称，要说清楚"为什么这个背书能让人信"
- 如果背书维度≤2星，写"⚠️ 背书较弱，建议补充权威认证"

**🌱 第三击：种草体验**（来自种草维度）
展示产品的使用体验和生活场景：
- 上手多简单（傻瓜化程度）、适合什么场景
- 口碑数据（复购率、好评率、销量等，有的话写具体数字）
- 用户使用后的真实感受/效果数据
- 如果种草维度≤2星，写"⚠️ 种草素材不足，建议补充用户体验内容"

**💰 收尾：机制临门一脚**（来自机制维度）
让消费者现在就下单的理由：
- 价格优势（破价、买赠、限时）
- 试用/退换保障（降低决策门槛）
- 稀缺性（限量、限时、独家）
- 如果机制维度≤2星，写"⚠️ 机制偏弱，建议强化促销力度"

**要求**：
- 每个板块都要有具体内容，从Brief和文案中提取真实信息，不要编造
- 语言风格：像在跟同事讲"这个品为什么能卖"，专业但不生硬
- 不要写脚本话术、不要写短视频文案、不要加语气词
- 这是给写脚本的人看的参考卡，不是给消费者看的广告

---

### 💡 AI补充建议

如果你觉得还有资料里没提到但值得挖掘的角度，简短列1-2条。没有就不写。

---

## 重要规则

1. **四维分析必须按 机制→背书→可视化→种草 的固定顺序逐维度输出**，不能跳过，不能合并
2. 每个维度的每个子项都要明确写"有"或"无"，不能含糊
3. 每个维度必须给出1-5星评分
4. 评分低的维度（≤2星）必须明确标注 ⚠️ 警告
5. **极致卖点卡是核心产出**，必须按 一句话总结→可视化冲击→背书堆叠→种草体验→机制收尾 的叙事顺序输出
6. 极致卖点卡的每个板块都要展开写，不是一句话带过，要给够下一步写脚本需要的信息量
7. **绝对不要写脚本、不要写话术模板、不要假装在写短视频文案**
8. 分析要具体，引用Brief和文案中的原文作为证据，不要泛泛而谈
9. 如果只有Brief没有文案，提示「建议补充达人文案」；反之亦然
10. 多份文档请综合分析，不要只看第一份`

interface UploadedFile {
  name: string
  text: string
}

function SimpleMarkdown({ text }: { text: string }) {
  const html = text
    .replace(/### (.*)/g, '<h3 class="text-xl font-bold mt-8 mb-3 text-gray-800">$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p class="mb-3">')
    .replace(/\n- /g, '<br/>• ')
    .replace(/\n/g, '<br/>')
  return <div className="prose max-w-none text-[15px] leading-relaxed text-gray-700" dangerouslySetInnerHTML={{ __html: `<p class="mb-3">${html}</p>` }} />
}

export default function Home() {
  const [step, setStep] = useState(1)
  const [briefFiles, setBriefFiles] = useState<UploadedFile[]>([])
  const [scriptFiles, setScriptFiles] = useState<UploadedFile[]>([])
  const [briefExtra, setBriefExtra] = useState('')
  const [scriptExtra, setScriptExtra] = useState('')
  const [uploadingBrief, setUploadingBrief] = useState(false)
  const [uploadingScript, setUploadingScript] = useState(false)

  // Step 3: Result
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string }>>([])
  const [followUpResult, setFollowUpResult] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const briefRef = useRef<HTMLInputElement>(null)
  const scriptRef = useRef<HTMLInputElement>(null)

  async function handleFilesUpload(files: FileList, type: 'brief' | 'script') {
    const setter = type === 'brief' ? setBriefFiles : setScriptFiles
    const setUploading = type === 'brief' ? setUploadingBrief : setUploadingScript
    setUploading(true)
    setError('')

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      try {
        const res = await fetch(`${BASE}/api/parse-file`, { method: 'POST', body: formData })
        const data = await res.json()
        if (data.error) {
          setError(`文件 ${file.name} 解析失败: ${data.error}`)
          continue
        }
        setter(prev => [...prev, { name: data.filename, text: data.text }])
      } catch (e) {
        setError(`文件 ${file.name} 上传失败`)
      }
    }
    setUploading(false)
    if (type === 'brief' && briefRef.current) briefRef.current.value = ''
    if (type === 'script' && scriptRef.current) scriptRef.current.value = ''
  }

  function removeFile(type: 'brief' | 'script', index: number) {
    if (type === 'brief') setBriefFiles(prev => prev.filter((_, i) => i !== index))
    else setScriptFiles(prev => prev.filter((_, i) => i !== index))
  }

  const hasBrief = briefFiles.length > 0 || briefExtra.trim()
  const hasScript = scriptFiles.length > 0 || scriptExtra.trim()

  async function handleAnalyze() {
    setLoading(true)
    setError('')
    setResult('')
    setFollowUpResult('')
    setChatHistory([])
    setStep(3)

    let userMsg = ''
    if (hasBrief) {
      const parts: string[] = []
      briefFiles.forEach((f, i) => parts.push(`【文档${i + 1}：${f.name}】\n${f.text}`))
      if (briefExtra.trim()) parts.push(`【补充内容】\n${briefExtra.trim()}`)
      userMsg += `## 产品Brief（共${briefFiles.length}份文档${briefExtra.trim() ? ' + 补充内容' : ''}）\n\n${parts.join('\n\n---\n\n')}\n\n`
    }
    if (hasScript) {
      const parts: string[] = []
      scriptFiles.forEach((f, i) => parts.push(`【文案${i + 1}：${f.name}】\n${f.text}`))
      if (scriptExtra.trim()) parts.push(`【补充内容】\n${scriptExtra.trim()}`)
      userMsg += `## 达人文案脚本（共${scriptFiles.length}份文案${scriptExtra.trim() ? ' + 补充内容' : ''}）\n\n${parts.join('\n\n---\n\n')}\n\n`
    }
    userMsg += '请综合以上所有资料，严格按照 机制→背书→可视化→种草 的顺序逐维度分析，提炼卖点并排序。'

    const messages = [{ role: 'user', content: userMsg }]

    try {
      const res = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, systemPrompt: SYSTEM_PROMPT }),
      })
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setResult(full)
      }
      setChatHistory([{ role: 'user', content: userMsg }, { role: 'assistant', content: full }])
    } catch (e) {
      setError('分析失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  async function handleFollowUp() {
    if (!followUp.trim() || !chatHistory.length) return
    setFollowUpLoading(true)
    setFollowUpResult('')
    const messages = [...chatHistory, { role: 'user', content: followUp }]
    try {
      const res = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, systemPrompt: SYSTEM_PROMPT }),
      })
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setFollowUpResult(full)
      }
      setChatHistory([...messages, { role: 'assistant', content: full }])
      setFollowUp('')
    } catch (e) {
      setError('追问失败，请重试')
    } finally {
      setFollowUpLoading(false)
    }
  }

  function handleReset() {
    setStep(1)
    setBriefFiles([])
    setScriptFiles([])
    setBriefExtra('')
    setScriptExtra('')
    setResult('')
    setError('')
    setFollowUp('')
    setFollowUpResult('')
    setChatHistory([])
  }

  const stepLabels = ['上传Brief', '达人文案', '卖点分析']

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">🎯</span>
            <h1 className="text-3xl font-bold tracking-tight">产品卖点提取器</h1>
          </div>
          <p className="text-orange-100 text-base">上传产品Brief + 达人文案，AI帮你提炼最炸裂的三大卖点</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="max-w-3xl mx-auto px-6 pt-8 pb-2">
        <div className="flex items-center justify-between mb-8">
          {stepLabels.map((label, i) => {
            const num = i + 1
            const isActive = step === num
            const isDone = step > num
            return (
              <div key={num} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isActive ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' :
                    isDone ? 'bg-orange-500 text-white' :
                    'bg-gray-200 text-gray-400'
                  }`}>
                    {isDone ? '✓' : num}
                  </div>
                  <span className={`mt-2 text-xs font-medium ${isActive ? 'text-orange-600' : isDone ? 'text-orange-400' : 'text-gray-400'}`}>{label}</span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div className={`h-[2px] w-full mx-2 mt-[-18px] ${step > num ? 'bg-orange-400' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-16">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-sm text-red-600 mb-6">
            {error}
          </div>
        )}

        {/* ====== Step 1: Upload Brief ====== */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-orange-100 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-2xl">📄</span>
              <div>
                <h2 className="text-xl font-bold text-gray-800">上传产品Brief</h2>
                <p className="text-sm text-gray-400 mt-0.5">支持 PDF、Word、TXT 格式，可上传多个文件</p>
              </div>
            </div>

            <input ref={briefRef} type="file" accept=".pdf,.docx,.doc,.txt,.md" multiple className="hidden"
              onChange={e => { if (e.target.files?.length) handleFilesUpload(e.target.files, 'brief') }} />

            {briefFiles.length > 0 && (
              <div className="mb-4 space-y-2">
                {briefFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                    <span className="text-green-500 text-lg">✅</span>
                    <span className="text-sm text-green-700 truncate flex-1">{f.name}</span>
                    <button className="text-gray-400 hover:text-red-500 transition text-lg" onClick={() => removeFile('brief', i)}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => briefRef.current?.click()} disabled={uploadingBrief}
              className="w-full border-2 border-dashed border-orange-200 rounded-xl py-8 text-base text-orange-400 hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50/50 transition disabled:opacity-50 mb-5">
              {uploadingBrief ? '正在解析文件...' : briefFiles.length > 0 ? '+ 继续添加文件' : '点击上传文件（可多选）'}
            </button>

            <div className="mb-6">
              <label className="block text-sm text-gray-500 mb-2">也可以直接粘贴补充内容</label>
              <textarea className="w-full border border-gray-200 rounded-xl px-5 py-4 text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent leading-relaxed"
                rows={6} placeholder="粘贴产品Brief内容..." value={briefExtra} onChange={e => setBriefExtra(e.target.value)} />
            </div>

            <button onClick={() => setStep(2)}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold py-4 rounded-xl text-base hover:from-orange-600 hover:to-amber-600 transition shadow-lg shadow-orange-200">
              {hasBrief ? '下一步：上传达人文案' : '跳过，直接上传达人文案'}
            </button>
          </div>
        )}

        {/* ====== Step 2: Upload Script ====== */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-orange-100 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl">🎬</span>
              <div>
                <h2 className="text-xl font-bold text-gray-800">上传达人文案脚本</h2>
                <p className="text-sm text-gray-400 mt-0.5">头部达人的讲解文案，可上传多个文件</p>
              </div>
            </div>

            {hasBrief && (
              <div className="flex items-center gap-1.5 mb-4 text-xs text-gray-400">
                <span>✓</span>
                <span>Brief已就绪（{briefFiles.length}份{briefExtra.trim() ? ' + 补充' : ''}）</span>
              </div>
            )}

            {!hasScript && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6">
                <p className="text-amber-700 text-sm font-medium">👇 请在下方上传达人文案脚本，AI 需要对照分析</p>
                <p className="text-amber-500 text-xs mt-1">上传头部达人的讲解文案，AI 会结合 Brief 提取最有力的卖点</p>
              </div>
            )}

            <input ref={scriptRef} type="file" accept=".pdf,.docx,.doc,.txt,.md" multiple className="hidden"
              onChange={e => { if (e.target.files?.length) handleFilesUpload(e.target.files, 'script') }} />

            {scriptFiles.length > 0 && (
              <div className="mb-4 space-y-2">
                {scriptFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                    <span className="text-green-500 text-lg">✅</span>
                    <span className="text-sm text-green-700 truncate flex-1">{f.name}</span>
                    <button className="text-gray-400 hover:text-red-500 transition text-lg" onClick={() => removeFile('script', i)}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => scriptRef.current?.click()} disabled={uploadingScript}
              className={`w-full border-2 border-dashed rounded-xl py-8 text-base transition disabled:opacity-50 mb-5 ${hasScript ? 'border-amber-200 text-amber-400 hover:border-amber-400 hover:text-amber-500 hover:bg-amber-50/50' : 'border-amber-300 text-amber-500 bg-amber-50/30 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50'}`}>
              {uploadingScript ? '正在解析文件...' : scriptFiles.length > 0 ? '+ 继续添加文件' : '📎 点击上传达人文案（可多选）'}
            </button>

            <div className="mb-6">
              <label className="block text-sm text-gray-500 mb-2">也可以直接粘贴补充内容</label>
              <textarea className="w-full border border-gray-200 rounded-xl px-5 py-4 text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent leading-relaxed"
                rows={6} placeholder="粘贴达人文案脚本..." value={scriptExtra} onChange={e => setScriptExtra(e.target.value)} />
            </div>

            <div className="flex items-center gap-4">
              <button onClick={() => setStep(1)} className="px-6 py-4 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition">上一步</button>
              <button onClick={handleAnalyze} disabled={loading || (!hasBrief && !hasScript)}
                className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold py-4 rounded-xl text-base hover:from-orange-600 hover:to-amber-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-200">
                {hasScript ? '开始提取卖点' : '请先上传达人文案 ↑'}
              </button>
            </div>
          </div>
        )}

        {/* ====== Step 3: Result ====== */}
        {step === 3 && (
          <div>
            {loading && !result && (
              <div className="bg-white rounded-2xl border border-orange-100 p-12 shadow-sm text-center">
                <svg className="animate-spin h-10 w-10 mx-auto mb-4 text-orange-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-gray-500 text-base">AI 正在分析你的产品资料...</p>
                <p className="text-gray-300 text-sm mt-2">
                  共 {briefFiles.length + scriptFiles.length} 份文档，请稍候
                </p>
              </div>
            )}

            {(result || loading) && (
              <div className="flex gap-3 mb-6 flex-wrap">
                {briefFiles.length > 0 && (
                  <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <span className="text-orange-400">📄</span>
                    <span className="text-sm text-orange-600">{briefFiles.length} 份Brief</span>
                  </div>
                )}
                {scriptFiles.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <span className="text-amber-400">🎬</span>
                    <span className="text-sm text-amber-600">{scriptFiles.length} 份文案</span>
                  </div>
                )}
              </div>
            )}

            {result && (
              <div className="bg-white rounded-2xl border border-orange-100 p-8 shadow-sm mb-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <span>📊</span> 卖点分析报告
                  </h2>
                  <button onClick={() => navigator.clipboard.writeText(result)}
                    className="text-sm text-orange-500 hover:text-orange-600 border border-orange-200 rounded-lg px-4 py-2 hover:bg-orange-50 transition">
                    复制全文
                  </button>
                </div>
                <SimpleMarkdown text={result} />
              </div>
            )}

            {followUpResult && (
              <div className="bg-white rounded-2xl border border-amber-100 p-8 shadow-sm mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
                  <span>💬</span> 追问回复
                </h2>
                <SimpleMarkdown text={followUpResult} />
              </div>
            )}

            {result && !loading && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-4">继续追问</h3>
                <div className="flex gap-3">
                  <input type="text"
                    className="flex-1 border border-gray-200 rounded-xl px-5 py-3.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
                    placeholder="比如：帮我把卖点一的话术再优化一下..."
                    value={followUp} onChange={e => setFollowUp(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleFollowUp() } }} />
                  <button onClick={handleFollowUp} disabled={followUpLoading || !followUp.trim()}
                    className="bg-orange-500 text-white px-6 py-3.5 rounded-xl text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed">
                    {followUpLoading ? '思考中...' : '发送'}
                  </button>
                </div>
                <div className="flex gap-2 mt-4 flex-wrap">
                  {['帮我把三个卖点的话术优化成更口语化的版本', '这个产品的竞品通常怎么打？差异化角度？', '帮我基于卖点写一个30秒短视频脚本框架'].map(q => (
                    <button key={q} onClick={() => setFollowUp(q)}
                      className="text-xs text-gray-500 bg-gray-50 hover:bg-orange-50 hover:text-orange-500 rounded-lg px-3 py-2 transition border border-gray-100">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="text-center">
                <button onClick={handleReset} className="text-sm text-gray-400 hover:text-orange-500 transition">
                  重新开始分析新产品
                </button>
              </div>
            )}
          </div>
        )}

        <div className="text-center text-xs text-gray-300 mt-12">
          提取框架：机制（价格力度）→ 背书（信任状）→ 可视化（视觉冲击）→ 种草（理性说服）
        </div>
      </div>
    </div>
  )
}
