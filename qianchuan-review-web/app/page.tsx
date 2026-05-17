'use client'

import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'

/* ── Types ── */

interface ScriptEntry {
  id: string
  title: string
  content: string
  source: string
}

interface ExcelRow {
  videoTheme: string
  spend: string
  impressions: string
  ctr: string
  threeSecRate: string
  conversions: string
  costPerConversion: string
  roi: string
  cpm: string
  timeRange: string
}

interface MergedItem {
  title: string
  content: string
  spend?: string
  impressions?: string
  ctr?: string
  threeSecRate?: string
  conversions?: string
  costPerConversion?: string
  roi?: string
  cpm?: string
  timeRange?: string
}

/* ── Helpers ── */

function SimpleMarkdown({ text }: { text: string }) {
  const html = text
    .replace(/### (.+)/g, '<h3 class="text-base font-bold mt-4 mb-2">$1</h3>')
    .replace(/## (.+)/g, '<h2 class="text-lg font-bold mt-5 mb-2">$1</h2>')
    .replace(/# (.+)/g, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n- /g, '<br/>• ')
    .replace(/\n\d+\. /g, (m) => '<br/>' + m.trim() + ' ')
    .replace(/\n/g, '<br/>')
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

function matchHeader(header: string, aliases: string[]): boolean {
  const h = header.trim()
  // Exact match first
  if (aliases.some(a => a === h)) return true
  // Then prefix/suffix match for compound headers like "整体消耗" matching "消耗"
  if (aliases.some(a => h === a || h.endsWith(a))) return true
  return false
}

function parseTransposedExcel(wb: XLSX.WorkBook): ExcelRow[] {
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
  if (raw.length < 2) return []

  const knownLabels: [string[], keyof ExcelRow][] = [
    [['素材名称', '视频主题', '素材标题', '视频名称'], 'videoTheme'],
    [['整体消耗', '消耗', '花费', '总消耗'], 'spend'],
    [['展示次数', '展示', '曝光', '曝光次数'], 'impressions'],
    [['点击率', 'CTR', 'ctr', '整体点击率'], 'ctr'],
    [['3s完播率', '3秒完播率', '3s完播', '3秒播放率'], 'threeSecRate'],
    [['转化数', '成交数', '订单数'], 'conversions'],
    [['转化成本', '成交成本', '单次转化成本'], 'costPerConversion'],
    [['ROI', 'roi', '投产比', '投产', '整体支付ROI', '支付ROI'], 'roi'],
    [['千次展示成本', 'CPM', 'cpm', '千展成本', '千次展现费用', '整体千次展现费用'], 'cpm'],
    [['投放时段', '时段', '投放时间'], 'timeRange'],
  ]

  // Try transposed format first (labels in column A, data across columns)
  const rowMapping: { rowIdx: number; key: keyof ExcelRow }[] = []
  for (let r = 0; r < raw.length; r++) {
    const cellVal = String(raw[r]?.[0] ?? '').trim()
    for (const [aliases, key] of knownLabels) {
      if (matchHeader(cellVal, aliases)) {
        rowMapping.push({ rowIdx: r, key })
        break
      }
    }
  }

  // Transposed: require at least 2 DISTINCT keys matched
  const distinctKeys = new Set(rowMapping.map(m => m.key))
  if (distinctKeys.size >= 3 && rowMapping.length >= 3) {
    const numCols = Math.max(...raw.map(r => r?.length ?? 0))
    const results: ExcelRow[] = []
    for (let c = 1; c < numCols; c++) {
      const entry: any = {}
      let hasData = false
      for (const { rowIdx, key } of rowMapping) {
        const val = raw[rowIdx]?.[c]
        if (val !== undefined && val !== null && val !== '') {
          entry[key] = String(val).trim()
          hasData = true
        }
      }
      if (hasData && entry.videoTheme) results.push(entry as ExcelRow)
    }
    if (results.length > 0) return results
  }

  // Try standard format (headers in row 1, data in rows)
  const headers = raw[0]?.map((h: any) => String(h ?? '').trim()) || []
  const usedKeys = new Set<string>()
  const usedCols = new Set<number>()
  const colMapping: { colIdx: number; key: keyof ExcelRow }[] = []

  // Pass 1: exact match (header is in aliases list)
  for (let c = 0; c < headers.length; c++) {
    for (const [aliases, key] of knownLabels) {
      if (usedKeys.has(key) || usedCols.has(c)) continue
      if (aliases.some(a => a === headers[c])) {
        colMapping.push({ colIdx: c, key })
        usedKeys.add(key)
        usedCols.add(c)
        break
      }
    }
  }
  // Pass 2: endsWith match for remaining keys
  for (let c = 0; c < headers.length; c++) {
    if (usedCols.has(c)) continue
    for (const [aliases, key] of knownLabels) {
      if (usedKeys.has(key)) continue
      if (aliases.some(a => headers[c].endsWith(a))) {
        colMapping.push({ colIdx: c, key })
        usedKeys.add(key)
        usedCols.add(c)
        break
      }
    }
  }

  if (colMapping.length >= 2) {
    const results: ExcelRow[] = []
    for (let r = 1; r < raw.length; r++) {
      const entry: any = {}
      let hasData = false
      for (const { colIdx, key } of colMapping) {
        const val = raw[r]?.[colIdx]
        if (val !== undefined && val !== null && val !== '') {
          entry[key] = String(val).trim()
          hasData = true
        }
      }
      if (hasData && entry.videoTheme) results.push(entry as ExcelRow)
    }
    return results
  }

  return []
}

function extractTitle(text: string): string {
  const firstLine = text.split('\n').map(l => l.trim()).find(l => l.length > 0)
  if (!firstLine) return '(无标题)'
  return firstLine.length > 60 ? firstLine.slice(0, 60) + '...' : firstLine
}

let nextId = 0
function genId() { return `script-${++nextId}` }

/* ── Main Component ── */

export default function Home() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [error, setError] = useState('')

  // Step 1: scripts
  const [scripts, setScripts] = useState<ScriptEntry[]>([])
  const [pasteInput, setPasteInput] = useState('')
  const scriptFileRef = useRef<HTMLInputElement>(null)

  // Step 2: excel
  const [excelData, setExcelData] = useState<ExcelRow[]>([])
  const [excelFileName, setExcelFileName] = useState('')
  const excelFileRef = useRef<HTMLInputElement>(null)

  // Step 3: report
  const [merged, setMerged] = useState<MergedItem[]>([])
  const [report, setReport] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  /* ── Step 1: Add scripts ── */

  function handleAddPaste() {
    const text = pasteInput.trim()
    if (!text) { setError('请先粘贴脚本内容'); return }

    const separator = /\n(?:={3,}|-{3,})\n/
    let segments: string[]

    if (separator.test(text)) {
      segments = text.split(separator).map(s => s.trim()).filter(s => s.length > 0)
    } else {
      segments = [text]
    }

    const newEntries: ScriptEntry[] = segments.map(s => ({
      id: genId(),
      title: extractTitle(s),
      content: s,
      source: 'paste',
    }))

    setScripts(prev => [...prev, ...newEntries])
    setPasteInput('')
    setError('')
  }

  async function parseFileToText(file: File): Promise<string> {
    const name = file.name.toLowerCase()
    if (name.endsWith('.txt') || name.endsWith('.md') || !name.includes('.')) {
      return file.text()
    }
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/qianchuan-review/api/parse-file', { method: 'POST', body: formData })
    if (!res.ok) throw new Error('文件解析失败')
    const data = await res.json()
    return data.text || ''
  }

  async function handleScriptFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const text = await parseFileToText(file)
        if (text.trim()) {
          setScripts(prev => [...prev, {
            id: genId(),
            title: extractTitle(text),
            content: text.trim(),
            source: file.name,
          }])
        }
      } catch {
        setError(`文件 ${file.name} 解析失败`)
      }
    }
    e.target.value = ''
  }

  function removeScript(id: string) {
    setScripts(prev => prev.filter(s => s.id !== id))
  }

  /* ── Step 2: Parse Excel ── */

  const handleExcelUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setExcelFileName(file.name)
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const parsed = parseTransposedExcel(wb)
        if (parsed.length === 0) { setError('未能解析Excel数据，请检查格式（需包含"素材名称"列 + 消耗/ROI等数据列）'); return }
        setExcelData(parsed)
        setError('')
      } catch { setError('Excel解析失败') }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  /* ── Step 2 -> Step 3: Merge & Generate Report ── */

  async function handleGenerate() {
    if (scripts.length === 0) { setError('请先上传脚本'); return }

    const mergedList: MergedItem[] = scripts.map(s => {
      let excelMatch: ExcelRow | undefined
      if (excelData.length > 0) {
        excelMatch = excelData.find(e => {
          if (!e.videoTheme) return false
          const et = e.videoTheme.replace(/[，。！？、\s]/g, '').slice(0, 12)
          const st = s.title.replace(/[，。！？、#@\s]/g, '').slice(0, 12)
          return et.includes(st.slice(0, 6)) || st.includes(et.slice(0, 6))
        })
      }
      return {
        title: excelMatch?.videoTheme || s.title,
        content: s.content,
        spend: excelMatch?.spend,
        impressions: excelMatch?.impressions,
        ctr: excelMatch?.ctr,
        threeSecRate: excelMatch?.threeSecRate,
        conversions: excelMatch?.conversions,
        costPerConversion: excelMatch?.costPerConversion,
        roi: excelMatch?.roi,
        cpm: excelMatch?.cpm,
        timeRange: excelMatch?.timeRange,
      }
    })

    // Add excel rows that didn't match any script
    if (excelData.length > 0) {
      for (const e of excelData) {
        if (!e.videoTheme) continue
        const matched = mergedList.some(m => {
          const et = e.videoTheme.replace(/[，。！？、\s]/g, '').slice(0, 12)
          const mt = m.title.replace(/[，。！？、#@\s]/g, '').slice(0, 12)
          return et.includes(mt.slice(0, 6)) || mt.includes(et.slice(0, 6))
        })
        if (!matched) {
          mergedList.push({
            title: e.videoTheme,
            content: '',
            spend: e.spend,
            impressions: e.impressions,
            ctr: e.ctr,
            threeSecRate: e.threeSecRate,
            conversions: e.conversions,
            costPerConversion: e.costPerConversion,
            roi: e.roi,
            cpm: e.cpm,
            timeRange: e.timeRange,
          })
        }
      }
    }

    // Sort by spend descending (消耗高 = 平台给量多)
    mergedList.sort((a, b) => (parseFloat(b.spend || '0') || 0) - (parseFloat(a.spend || '0') || 0))
    setMerged(mergedList)
    setStep(3)
    setReportLoading(true)
    setReport('')

    const hasExcel = mergedList.some(m => m.spend || m.roi || m.conversions)

    // Build the input for AI
    const videoDescriptions = mergedList.map((v, i) => {
      let desc = `### 素材 ${i + 1}：${v.title}`
      const metaParts: string[] = []
      if (v.spend) metaParts.push(`消耗: ${v.spend}元`)
      if (v.roi) metaParts.push(`ROI: ${v.roi}`)
      if (v.conversions) metaParts.push(`转化数: ${v.conversions}`)
      if (v.costPerConversion) metaParts.push(`转化成本: ${v.costPerConversion}元`)
      if (v.ctr) metaParts.push(`点击率: ${v.ctr}`)
      if (v.threeSecRate) metaParts.push(`3s完播率: ${v.threeSecRate}`)
      if (v.impressions) metaParts.push(`展示次数: ${v.impressions}`)
      if (v.cpm) metaParts.push(`CPM: ${v.cpm}元`)
      if (v.timeRange) metaParts.push(`投放时段: ${v.timeRange}`)
      if (metaParts.length > 0) desc += '\n' + metaParts.join(' | ')
      if (v.content) {
        const truncated = v.content.length > 2000 ? v.content.slice(0, 2000) + '\n...(已截断)' : v.content
        desc += `\n\n【完整脚本】\n${truncated}`
      }
      return desc
    }).join('\n\n---\n\n')

    const systemPrompt = `你是千川投流素材复盘专家。你研究过大量千川跑量素材的共性规律，深谙什么样的千川脚本能跑量、什么样的结构能转化。你对开头hook、卖点结构、行动号召、投放效率有极深的实战理解。

你现在要帮投放团队做一期千川素材的复盘分析。

用户会给你本期所有千川素材的**完整脚本文案**${hasExcel ? '以及投放数据（消耗、ROI、转化数、转化成本、3s完播率、点击率、CPM等）' : ''}。你需要从「花钱效率」视角做深度复盘。

请输出以下模块（**不是每个都必须写，根据数据情况判断哪些有必要**）：

${hasExcel ? `1. **跑量素材拆解**（消耗高 = 平台认可）
   - 哪几条素材消耗最高？
   - 从脚本层面拆解：开头用了什么hook、卖点怎么排的、行动号召怎么设计的
   - 跑量素材之间有没有共性规律（开头类型、结构、节奏）
   - 这套规律怎么复用到下一批素材，给出具体方向

2. **高ROI素材分析**（花钱少但转化好）
   - 哪些素材 ROI 最高？
   - 对比跑量素材，高ROI素材在脚本层面有什么不同
   - 是开头更精准筛人？还是卖点更打痛点？还是行动号召更强？

3. **开头效率分析**（3s完播率是核心）
   - 3s完播率 Top 3 和 Bottom 3，对照脚本开头原文分析
   - 3s高但转化低 = 开头吸引了错误人群，分析原因
   - 3s低 = 开头就劝退了，分析哪里出了问题
   - 给出下一批素材的开头方向建议

4. **亏损素材诊断**（消耗高但ROI差）
   - 哪些素材花了钱但没转化？
   - 是人群不对（开头筛人不精准）？还是卖点没打到（内容和产品脱节）？还是行动号召太弱？
   - 直接说该停就停，给理由

5. **卖点结构洞察**
   - 不同卖点顺序的表现差异
   - 哪类卖点放在前面转化更好
   - 下一批素材推荐的卖点排列

6. **投放效率建议**
   - 整体 CPM 趋势，成本是在涨还是降
   - 建议追投哪些素材、停投哪些
   - 下一批素材的产量和方向建议` : `1. **最好的素材**：哪几条脚本写得最好？
   - 开头hook怎么抓人的（前3秒做了什么）
   - 卖点怎么排的、行动号召怎么设计的
   - 跑量潜力判断

2. **建议淘汰的素材**：哪些脚本质量不行？
   - 开头没吸引力？卖点散？行动号召弱？
   - 直接说该砍就砍，给理由

3. **卖点结构分析**
   - 不同卖点排列方式的优劣
   - 推荐的卖点结构

4. **开头类型分析**
   - 各素材开头分别用了什么类型的hook
   - 哪种开头类型在千川场景下效率更高
   - 下一批素材的开头方向建议

5. **新素材方向**：基于好素材的共性规律，推荐新方向
   - 具体到什么角度、什么开头、什么结构`}

要求：
- 你有完整脚本，分析必须引用具体文案细节，不是只看标题
- ${hasExcel ? '所有判断必须有数据支撑，不说"感觉"' : '分析要深入到具体的文案句子和段落'}
- 语言直接，像一个花自己钱投流的操盘手在复盘
- 每条建议都能直接执行
- 如果某个模块没有足够${hasExcel ? '数据' : '内容'}支撑，跳过，不凑字数`

    try {
      const res = await fetch('/qianchuan-review/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          messages: [{
            role: 'user',
            content: `以下是本期千川投放素材（共${mergedList.length}条）：\n\n${videoDescriptions}\n\n请输出复盘报告。`,
          }],
        }),
      })

      if (!res.ok) throw new Error(`AI请求失败: ${res.status}`)
      const reader = res.body?.getReader()
      if (!reader) throw new Error('无响应流')

      const decoder = new TextDecoder()
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setReport(text)
        if (reportRef.current) reportRef.current.scrollTop = reportRef.current.scrollHeight
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成报告失败')
    } finally {
      setReportLoading(false)
    }
  }

  const STEPS = [
    { n: 1, label: '上传脚本' },
    { n: 2, label: '上传投放数据' },
    { n: 3, label: '复盘报告' },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">千川脚本复盘助手</h1>
          <p className="text-gray-500 mt-1">上传脚本 → 上传投放数据 → AI复盘报告</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        {STEPS.map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
              step >= n ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > n ? '✓' : n}
            </div>
            <span className={`text-sm ${step >= n ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{label}</span>
            {n < 3 && <div className={`w-10 h-0.5 ${step > n ? 'bg-blue-500' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between items-center">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-4 shrink-0">✕</button>
        </div>
      )}

      {/* ──────── Step 1: 上传脚本 ──────── */}
      {step === 1 && (
        <div className="space-y-4">
          {/* 上传区域 */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-1">上传千川脚本</h2>
            <p className="text-gray-400 text-sm mb-4">每个文件 = 一条脚本，支持批量上传</p>

            <div
              className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
              onClick={() => scriptFileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50/30') }}
              onDragLeave={e => { e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50/30') }}
              onDrop={async e => {
                e.preventDefault()
                e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50/30')
                const files = e.dataTransfer.files
                for (let i = 0; i < files.length; i++) {
                  try {
                    const text = await parseFileToText(files[i])
                    if (text.trim()) {
                      setScripts(prev => [...prev, {
                        id: genId(),
                        title: extractTitle(text),
                        content: text.trim(),
                        source: files[i].name,
                      }])
                    }
                  } catch {
                    setError(`文件 ${files[i].name} 解析失败`)
                  }
                }
              }}
            >
              <input
                ref={scriptFileRef}
                type="file"
                accept=".txt,.text,.md,.docx,.pages"
                multiple
                onChange={handleScriptFiles}
                className="hidden"
              />
              <div className="text-4xl mb-3">📄</div>
              <p className="text-sm font-medium text-gray-700">点击选择文件 或 拖拽文件到这里</p>
              <p className="text-xs text-gray-400 mt-1">支持 .txt / .md / .docx / .pages，可多选</p>
            </div>

            {/* 粘贴折叠区 */}
            <details className="mt-4">
              <summary className="text-sm text-blue-500 cursor-pointer hover:text-blue-600">或者手动粘贴文案</summary>
              <div className="mt-3">
                <textarea
                  className="w-full h-36 p-4 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
                  placeholder={"粘贴千川脚本文案...\n多条脚本用 === 分隔"}
                  value={pasteInput}
                  onChange={e => setPasteInput(e.target.value)}
                />
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={handleAddPaste}
                    disabled={!pasteInput.trim()}
                    className="px-5 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    添加脚本
                  </button>
                </div>
              </div>
            </details>
          </div>

          {/* 已添加列表 */}
          {scripts.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="text-sm font-medium text-gray-700 mb-3">已添加 {scripts.length} 条脚本</div>
              <div className="space-y-2">
                {scripts.map((s, i) => (
                  <div key={s.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xs text-gray-400 mt-0.5 shrink-0 w-5">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 font-medium truncate">{s.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {s.source === 'paste' ? '手动粘贴' : s.source} · {s.content.length} 字
                      </div>
                    </div>
                    <button
                      onClick={() => removeScript(s.id)}
                      className="text-gray-300 hover:text-red-400 shrink-0 text-sm"
                    >✕</button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                >
                  下一步：上传投放数据
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────── Step 2: 上传投放数据 ──────── */}
      {step === 2 && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => setStep(1)} className="text-sm text-blue-500 hover:text-blue-600">← 返回编辑脚本</button>
            <span className="text-sm text-gray-500">已添加 {scripts.length} 条脚本</span>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-1">上传千川投放数据</h2>
            <p className="text-gray-400 text-sm mb-4">
              上传千川后台导出的Excel数据（消耗、ROI、转化数、3s完播率等）。<strong className="text-gray-500">可选步骤</strong>，跳过也能基于脚本内容生成复盘报告。
            </p>

            <div
              onClick={() => excelFileRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
            >
              <input ref={excelFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} className="hidden" />
              {excelFileName ? (
                <div>
                  <div className="text-3xl mb-2">📊</div>
                  <div className="text-sm font-medium text-gray-900">{excelFileName}</div>
                  <div className="text-xs text-green-600 mt-1">已解析 {excelData.length} 条数据</div>
                  <div className="text-xs text-gray-400 mt-2">点击更换文件</div>
                </div>
              ) : (
                <div>
                  <div className="text-3xl mb-2">📄</div>
                  <div className="text-sm text-gray-500">点击上传千川投放数据 Excel</div>
                  <div className="text-xs text-gray-400 mt-1">支持 .xlsx / .xls / .csv</div>
                </div>
              )}
            </div>

            {excelData.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <div className="text-sm font-medium text-gray-700 mb-2">解析预览</div>
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="px-3 py-2 text-left">素材名称</th>
                      <th className="px-3 py-2 text-right">消耗</th>
                      <th className="px-3 py-2 text-right">ROI</th>
                      <th className="px-3 py-2 text-right">转化数</th>
                      <th className="px-3 py-2 text-right">转化成本</th>
                      <th className="px-3 py-2 text-right">3s完播率</th>
                      <th className="px-3 py-2 text-right">点击率</th>
                      <th className="px-3 py-2 text-right">CPM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelData.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5 text-gray-900 max-w-[200px] truncate">{row.videoTheme || '—'}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{row.spend ? row.spend + '元' : '—'}</td>
                        <td className="px-3 py-1.5 text-right">{row.roi || '—'}</td>
                        <td className="px-3 py-1.5 text-right">{row.conversions || '—'}</td>
                        <td className="px-3 py-1.5 text-right">{row.costPerConversion ? row.costPerConversion + '元' : '—'}</td>
                        <td className="px-3 py-1.5 text-right">{row.threeSecRate || '—'}</td>
                        <td className="px-3 py-1.5 text-right">{row.ctr || '—'}</td>
                        <td className="px-3 py-1.5 text-right">{row.cpm ? row.cpm + '元' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setExcelData([]); setExcelFileName(''); handleGenerate() }}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                跳过，直接生成报告
              </button>
              {excelData.length > 0 && (
                <button
                  onClick={handleGenerate}
                  className="px-6 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                >
                  生成复盘报告
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────── Step 3: 复盘报告 ──────── */}
      {step === 3 && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => setStep(2)} className="text-sm text-blue-500 hover:text-blue-600">← 返回</button>
            <span className="text-sm text-gray-500">
              {merged.length} 条素材
              {merged.some(m => m.spend) && ' · 含投放数据'}
            </span>
          </div>

          {/* Data overview table */}
          {merged.some(m => m.spend) && (
            <div className="bg-white rounded-xl shadow-sm border overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-500 border-b text-xs">
                    <th className="px-4 py-2 w-8">#</th>
                    <th className="px-4 py-2">素材</th>
                    <th className="px-4 py-2 text-right">消耗</th>
                    {merged.some(m => m.roi) && <th className="px-4 py-2 text-right">ROI</th>}
                    {merged.some(m => m.conversions) && <th className="px-4 py-2 text-right">转化数</th>}
                    {merged.some(m => m.costPerConversion) && <th className="px-4 py-2 text-right">转化成本</th>}
                    {merged.some(m => m.threeSecRate) && <th className="px-4 py-2 text-right">3s完播率</th>}
                    {merged.some(m => m.ctr) && <th className="px-4 py-2 text-right">点击率</th>}
                  </tr>
                </thead>
                <tbody>
                  {merged.map((v, i) => (
                    <tr key={i} className={`border-b last:border-0 text-xs ${i < 3 ? 'bg-blue-50/50' : ''}`}>
                      <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2 text-gray-900 truncate max-w-[250px]">{v.title}</td>
                      <td className="px-4 py-2 text-right font-medium text-gray-700">{v.spend ? v.spend + '元' : '—'}</td>
                      {merged.some(m => m.roi) && <td className="px-4 py-2 text-right text-gray-600">{v.roi || '—'}</td>}
                      {merged.some(m => m.conversions) && <td className="px-4 py-2 text-right text-gray-600">{v.conversions || '—'}</td>}
                      {merged.some(m => m.costPerConversion) && <td className="px-4 py-2 text-right text-gray-600">{v.costPerConversion ? v.costPerConversion + '元' : '—'}</td>}
                      {merged.some(m => m.threeSecRate) && <td className="px-4 py-2 text-right text-gray-600">{v.threeSecRate || '—'}</td>}
                      {merged.some(m => m.ctr) && <td className="px-4 py-2 text-right text-gray-600">{v.ctr || '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div
            ref={reportRef}
            className="bg-white rounded-xl shadow-sm border p-6 min-h-[400px] max-h-[70vh] overflow-y-auto"
          >
            {reportLoading && !report && (
              <div className="flex items-center gap-2 text-gray-400">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                千川复盘专家正在深度分析素材数据...
              </div>
            )}
            {report && (
              <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                <SimpleMarkdown text={report} />
              </div>
            )}
            {reportLoading && report && (
              <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-1" />
            )}
          </div>

          {!reportLoading && report && (
            <div className="mt-4 flex justify-end gap-3">
              {savedId ? (
                <span className="px-5 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  已保存
                </span>
              ) : (
                <button
                  onClick={async () => {
                    setSaving(true)
                    try {
                      const res = await fetch('/qianchuan-review/api/reports', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          report,
                          scripts: scripts.map(s => ({ title: s.title, content: s.content })),
                          excelData,
                          createdAt: new Date().toISOString(),
                        }),
                      })
                      if (!res.ok) throw new Error('保存失败')
                      const data = await res.json()
                      setSavedId(data.id)
                    } catch (err) {
                      setError(err instanceof Error ? err.message : '保存失败')
                    } finally { setSaving(false) }
                  }}
                  disabled={saving}
                  className="px-5 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                >
                  {saving ? '保存中...' : '保存在线'}
                </button>
              )}
              <button
                onClick={() => {
                  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  const dateStr = new Date().toISOString().slice(0, 10)
                  a.href = url
                  a.download = `千川脚本复盘_${dateStr}.md`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                导出下载
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(report)
                  alert('已复制到剪贴板')
                }}
                className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                复制报告
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
