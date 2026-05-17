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
  liveTheme: string         // 直播主题/场次
  liveDate: string          // 直播日期
  duration: string          // 直播时长（分钟）
  peakViewers: string       // 峰值在线人数
  avgViewers: string        // 平均在线
  totalUV: string           // 总UV
  avgStayTime: string       // 平均停留时长（秒）
  likes: string             // 点赞
  comments: string          // 评论
  followsGained: string     // 新增粉丝
  conversions: string       // 成交单数
  gmv: string               // GMV（元）
  gpm: string               // GPM
  adSpend: string           // 投放金额（元）
}

interface MergedItem {
  title: string
  content: string
  liveDate?: string
  duration?: string
  peakViewers?: string
  avgViewers?: string
  totalUV?: string
  avgStayTime?: string
  likes?: string
  comments?: string
  followsGained?: string
  conversions?: string
  gmv?: string
  gpm?: string
  adSpend?: string
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
  if (aliases.some(a => a === h)) return true
  if (aliases.some(a => h.endsWith(a))) return true
  return false
}

function parseTransposedExcel(wb: XLSX.WorkBook): ExcelRow[] {
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
  if (raw.length < 2) return []

  const knownLabels: [string[], keyof ExcelRow][] = [
    [['直播主题', '场次', '场次名称', '直播名称', '主题'], 'liveTheme'],
    [['直播日期', '日期', '开播日期', '开播时间'], 'liveDate'],
    [['直播时长', '时长', '开播时长'], 'duration'],
    [['峰值在线', '最高在线', '峰值人数', '在线峰值'], 'peakViewers'],
    [['平均在线', '在线均值', '人均在线'], 'avgViewers'],
    [['总UV', 'UV', '观看人数', '观看用户数', '观看人数(UV)'], 'totalUV'],
    [['平均停留时长', '停留时长', '人均停留', '平均观看时长'], 'avgStayTime'],
    [['点赞', '点赞数', '点赞数量'], 'likes'],
    [['评论', '评论数', '评论数量'], 'comments'],
    [['新增粉丝', '涨粉', '粉丝增量', '关注数', '新增关注'], 'followsGained'],
    [['成交单数', '订单数', '成交数', '订单量'], 'conversions'],
    [['GMV', '销售额', '成交金额', '直播间GMV'], 'gmv'],
    [['GPM', '千次曝光价值', '千次观看价值'], 'gpm'],
    [['投放金额', '消耗', '广告消耗', '投放消耗'], 'adSpend'],
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

  // Transposed: require at least 3 DISTINCT keys matched
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
      if (hasData && (entry.liveTheme || entry.liveDate)) results.push(entry as ExcelRow)
    }
    if (results.length > 0) return results
  }

  // Try standard format (headers in row 1, data in rows)
  const headers = raw[0]?.map((h: any) => String(h ?? '').trim()) || []
  const usedKeys = new Set<string>()
  const usedCols = new Set<number>()
  const colMapping: { colIdx: number; key: keyof ExcelRow }[] = []

  // Pass 1: exact match
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
      if (hasData && (entry.liveTheme || entry.liveDate)) results.push(entry as ExcelRow)
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
    const res = await fetch('/livestream-review/api/parse-file', { method: 'POST', body: formData })
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
        if (parsed.length === 0) { setError('未能解析Excel数据，请检查格式（需包含"直播主题"列 + GMV/在线人数等数据列）'); return }
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
          const fields = [e.liveTheme, e.liveDate].filter(Boolean)
          if (fields.length === 0) return false
          const st = s.title.replace(/[，。！？、#@\s]/g, '').slice(0, 12)
          return fields.some(f => {
            const ft = f.replace(/[，。！？、\s]/g, '').slice(0, 12)
            return ft.includes(st.slice(0, 6)) || st.includes(ft.slice(0, 6))
          })
        })
      }
      return {
        title: excelMatch?.liveTheme || s.title,
        content: s.content,
        liveDate: excelMatch?.liveDate,
        duration: excelMatch?.duration,
        peakViewers: excelMatch?.peakViewers,
        avgViewers: excelMatch?.avgViewers,
        totalUV: excelMatch?.totalUV,
        avgStayTime: excelMatch?.avgStayTime,
        likes: excelMatch?.likes,
        comments: excelMatch?.comments,
        followsGained: excelMatch?.followsGained,
        conversions: excelMatch?.conversions,
        gmv: excelMatch?.gmv,
        gpm: excelMatch?.gpm,
        adSpend: excelMatch?.adSpend,
      }
    })

    // Add excel rows that didn't match any script
    if (excelData.length > 0) {
      for (const e of excelData) {
        const title = e.liveTheme || e.liveDate
        if (!title) continue
        const matched = mergedList.some(m => {
          const et = title.replace(/[，。！？、\s]/g, '').slice(0, 12)
          const mt = m.title.replace(/[，。！？、#@\s]/g, '').slice(0, 12)
          return et.includes(mt.slice(0, 6)) || mt.includes(et.slice(0, 6))
        })
        if (!matched) {
          mergedList.push({
            title,
            content: '',
            liveDate: e.liveDate,
            duration: e.duration,
            peakViewers: e.peakViewers,
            avgViewers: e.avgViewers,
            totalUV: e.totalUV,
            avgStayTime: e.avgStayTime,
            likes: e.likes,
            comments: e.comments,
            followsGained: e.followsGained,
            conversions: e.conversions,
            gmv: e.gmv,
            gpm: e.gpm,
            adSpend: e.adSpend,
          })
        }
      }
    }

    // Sort by GMV descending (有钱挣的优先分析)
    mergedList.sort((a, b) => (parseFloat(b.gmv || '0') || 0) - (parseFloat(a.gmv || '0') || 0))
    setMerged(mergedList)
    setStep(3)
    setReportLoading(true)
    setReport('')

    const hasExcel = mergedList.some(m => m.gmv || m.peakViewers || m.conversions)

    // Build the input for AI
    const liveDescriptions = mergedList.map((v, i) => {
      let desc = `### 场次 ${i + 1}：${v.title}`
      const metaParts: string[] = []
      if (v.liveDate) metaParts.push(`日期: ${v.liveDate}`)
      if (v.duration) metaParts.push(`时长: ${v.duration}分钟`)
      if (v.gmv) metaParts.push(`GMV: ${v.gmv}元`)
      if (v.gpm) metaParts.push(`GPM: ${v.gpm}`)
      if (v.conversions) metaParts.push(`成交单数: ${v.conversions}`)
      if (v.peakViewers) metaParts.push(`峰值在线: ${v.peakViewers}`)
      if (v.avgViewers) metaParts.push(`平均在线: ${v.avgViewers}`)
      if (v.totalUV) metaParts.push(`总UV: ${v.totalUV}`)
      if (v.avgStayTime) metaParts.push(`平均停留: ${v.avgStayTime}秒`)
      if (v.likes) metaParts.push(`点赞: ${v.likes}`)
      if (v.comments) metaParts.push(`评论: ${v.comments}`)
      if (v.followsGained) metaParts.push(`涨粉: ${v.followsGained}`)
      if (v.adSpend) metaParts.push(`投放金额: ${v.adSpend}元`)
      if (metaParts.length > 0) desc += '\n' + metaParts.join(' | ')
      if (v.content) {
        const truncated = v.content.length > 3000 ? v.content.slice(0, 3000) + '\n...(已截断)' : v.content
        desc += `\n\n【完整直播脚本】\n${truncated}`
      }
      return desc
    }).join('\n\n---\n\n')

    const systemPrompt = `你是直播间运营复盘专家。你研究过头部主播的直播脚本逻辑，深谙什么样的开场能快速聚人、什么样的互动能提升留存、什么样的转化话术能成交。你对直播间的"人货场"配合有极深的实战理解。

你现在要帮直播运营团队做一期直播复盘分析。

用户会给你本期所有直播间的**完整脚本文案**${hasExcel ? '以及直播数据（GMV、峰值在线、平均停留时长、成交单数、互动数据等）' : ''}。你需要从「话术效果 + 留人转化」视角做深度复盘。

请输出以下模块（**不是每个都必须写，根据数据情况判断哪些有必要**）：

${hasExcel ? `1. **开场留人分析**（峰值在线 = 开场吸引力）
   - 哪几场峰值在线人数最高？开场前3分钟的脚本做了什么
   - 从脚本层面拆解：开场用了什么钩子、福利预告、话题选择
   - 峰值高的场次开场有什么共性
   - 这套规律怎么复用到下次直播

2. **留存诊断**（平均停留时长 = 内容吸引力）
   - 平均停留时长 Top/Bottom 场次对照脚本分析
   - 停留长的场次脚本节奏怎么样？讲解-互动-逼单的配比
   - 停留短的场次哪里出了问题？是节奏太慢？还是话术单调？
   - 给出下次直播的脚本节奏建议

3. **互动设计拆解**（点赞、评论、扣1）
   - 互动数据 Top 场次的脚本里互动话术怎么设计的
   - 哪些"扣1"、"扣想要"、"姐妹们点赞"等话术最有效
   - 互动密度多少合适，过密或过疏的问题

4. **转化话术效率**（GMV/GPM/成交单数）
   - GMV 最高的场次脚本里转化部分怎么讲的
   - 逼单话术（机制、紧迫感、稀缺感）的设计是否到位
   - GPM 高低对比，找出转化效率最高的脚本段落
   - 哪些场次"流量好但 GMV 差" = 讲解和逼单没接住流量

5. **亏损场次诊断**（投放金额高但 GMV 差）
   - 哪些场次花了钱但没产出？
   - 是开场没接住流量？还是讲解段太弱？还是逼单太软？
   - 直接说该改就改，给理由

6. **人设一致性**
   - 各场次脚本的人设表现是否一致
   - 有没有跑偏的话术（比如人设是"温柔姐姐"但讲解很硬销）
   - 哪些场次最贴合人设

7. **下场优化建议**
   - 基于整体数据，下次直播脚本应该怎么调
   - 开场、互动、讲解、逼单四个段落分别的优化方向
   - 具体到话术示例` : `1. **最好的脚本段落**：哪场脚本写得最好？
   - 开场怎么抓人的（前3分钟做了什么）
   - 互动设计、转化话术、节奏控制
   - 跑量潜力判断

2. **建议重写的段落**：哪些脚本质量不行？
   - 开场没吸引力？讲解段太散？逼单太软？
   - 直接说哪段砍掉哪段重写，给理由

3. **互动话术分析**
   - 各场次脚本里的互动话术密度和类型
   - 哪种互动设计更有效
   - 推荐的互动节奏

4. **转化逻辑分析**
   - 转化段的铺垫-逼单-解决异议结构是否完整
   - 推荐的逼单话术结构

5. **新脚本方向**：基于好脚本的共性规律，推荐改进方向
   - 具体到什么开场、什么节奏、什么逼单话术`}

要求：
- 你有完整脚本，分析必须引用具体话术原文，不是只看标题
- ${hasExcel ? '所有判断必须有数据支撑，不说"感觉"' : '分析要深入到具体的话术句子和段落'}
- 语言直接，像一个跟主播一起复盘的操盘手在开会
- 每条建议都能直接执行，主播下次就能改
- 如果某个模块没有足够${hasExcel ? '数据' : '内容'}支撑，跳过，不凑字数`

    try {
      const res = await fetch('/livestream-review/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          messages: [{
            role: 'user',
            content: `以下是本期直播间脚本（共${mergedList.length}场）：\n\n${liveDescriptions}\n\n请输出复盘报告。`,
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
    { n: 2, label: '上传直播数据' },
    { n: 3, label: '复盘报告' },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">直播间脚本复盘助手</h1>
          <p className="text-gray-500 mt-1">上传脚本 → 上传直播数据 → AI复盘报告</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        {STEPS.map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
              step >= n ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > n ? '✓' : n}
            </div>
            <span className={`text-sm ${step >= n ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{label}</span>
            {n < 3 && <div className={`w-10 h-0.5 ${step > n ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
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
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-1">上传直播脚本</h2>
            <p className="text-gray-400 text-sm mb-4">每个文件 = 一场直播的脚本，支持批量上传</p>

            <div
              className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors"
              onClick={() => scriptFileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-emerald-400', 'bg-emerald-50/30') }}
              onDragLeave={e => { e.currentTarget.classList.remove('border-emerald-400', 'bg-emerald-50/30') }}
              onDrop={async e => {
                e.preventDefault()
                e.currentTarget.classList.remove('border-emerald-400', 'bg-emerald-50/30')
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
              <div className="text-4xl mb-3">🎙️</div>
              <p className="text-sm font-medium text-gray-700">点击选择文件 或 拖拽文件到这里</p>
              <p className="text-xs text-gray-400 mt-1">支持 .txt / .md / .docx / .pages，可多选</p>
            </div>

            <details className="mt-4">
              <summary className="text-sm text-emerald-600 cursor-pointer hover:text-emerald-700">或者手动粘贴文案</summary>
              <div className="mt-3">
                <textarea
                  className="w-full h-36 p-4 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
                  placeholder={"粘贴直播间脚本文案...\n多场脚本用 === 分隔"}
                  value={pasteInput}
                  onChange={e => setPasteInput(e.target.value)}
                />
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={handleAddPaste}
                    disabled={!pasteInput.trim()}
                    className="px-5 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    添加脚本
                  </button>
                </div>
              </div>
            </details>
          </div>

          {scripts.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="text-sm font-medium text-gray-700 mb-3">已添加 {scripts.length} 场脚本</div>
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
                  className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
                >
                  下一步：上传直播数据
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────── Step 2: 上传直播数据 ──────── */}
      {step === 2 && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => setStep(1)} className="text-sm text-emerald-600 hover:text-emerald-700">← 返回编辑脚本</button>
            <span className="text-sm text-gray-500">已添加 {scripts.length} 场脚本</span>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-1">上传直播数据</h2>
            <p className="text-gray-400 text-sm mb-4">
              上传抖音/百应等后台导出的直播数据 Excel（GMV、峰值在线、平均停留、互动数据等）。<strong className="text-gray-500">可选步骤</strong>，跳过也能基于脚本内容生成复盘报告。
            </p>

            <div
              onClick={() => excelFileRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
            >
              <input ref={excelFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} className="hidden" />
              {excelFileName ? (
                <div>
                  <div className="text-3xl mb-2">📊</div>
                  <div className="text-sm font-medium text-gray-900">{excelFileName}</div>
                  <div className="text-xs text-emerald-600 mt-1">已解析 {excelData.length} 场数据</div>
                  <div className="text-xs text-gray-400 mt-2">点击更换文件</div>
                </div>
              ) : (
                <div>
                  <div className="text-3xl mb-2">📄</div>
                  <div className="text-sm text-gray-500">点击上传直播数据 Excel</div>
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
                      <th className="px-3 py-2 text-left">场次</th>
                      <th className="px-3 py-2 text-right">GMV</th>
                      <th className="px-3 py-2 text-right">GPM</th>
                      <th className="px-3 py-2 text-right">峰值在线</th>
                      <th className="px-3 py-2 text-right">平均停留</th>
                      <th className="px-3 py-2 text-right">成交单数</th>
                      <th className="px-3 py-2 text-right">点赞</th>
                      <th className="px-3 py-2 text-right">涨粉</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelData.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5 text-gray-900 max-w-[200px] truncate">{row.liveTheme || row.liveDate || '—'}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{row.gmv ? row.gmv + '元' : '—'}</td>
                        <td className="px-3 py-1.5 text-right">{row.gpm || '—'}</td>
                        <td className="px-3 py-1.5 text-right">{row.peakViewers || '—'}</td>
                        <td className="px-3 py-1.5 text-right">{row.avgStayTime ? row.avgStayTime + '秒' : '—'}</td>
                        <td className="px-3 py-1.5 text-right">{row.conversions || '—'}</td>
                        <td className="px-3 py-1.5 text-right">{row.likes || '—'}</td>
                        <td className="px-3 py-1.5 text-right">{row.followsGained || '—'}</td>
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
                  className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
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
            <button onClick={() => setStep(2)} className="text-sm text-emerald-600 hover:text-emerald-700">← 返回</button>
            <span className="text-sm text-gray-500">
              {merged.length} 场直播
              {merged.some(m => m.gmv) && ' · 含直播数据'}
            </span>
          </div>

          {merged.some(m => m.gmv || m.peakViewers) && (
            <div className="bg-white rounded-xl shadow-sm border overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-500 border-b text-xs">
                    <th className="px-4 py-2 w-8">#</th>
                    <th className="px-4 py-2">场次</th>
                    {merged.some(m => m.gmv) && <th className="px-4 py-2 text-right">GMV</th>}
                    {merged.some(m => m.gpm) && <th className="px-4 py-2 text-right">GPM</th>}
                    {merged.some(m => m.conversions) && <th className="px-4 py-2 text-right">成交单数</th>}
                    {merged.some(m => m.peakViewers) && <th className="px-4 py-2 text-right">峰值在线</th>}
                    {merged.some(m => m.avgStayTime) && <th className="px-4 py-2 text-right">平均停留</th>}
                    {merged.some(m => m.likes) && <th className="px-4 py-2 text-right">点赞</th>}
                  </tr>
                </thead>
                <tbody>
                  {merged.map((v, i) => (
                    <tr key={i} className={`border-b last:border-0 text-xs ${i < 3 ? 'bg-emerald-50/50' : ''}`}>
                      <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2 text-gray-900 truncate max-w-[250px]">{v.title}</td>
                      {merged.some(m => m.gmv) && <td className="px-4 py-2 text-right font-medium text-gray-700">{v.gmv ? v.gmv + '元' : '—'}</td>}
                      {merged.some(m => m.gpm) && <td className="px-4 py-2 text-right text-gray-600">{v.gpm || '—'}</td>}
                      {merged.some(m => m.conversions) && <td className="px-4 py-2 text-right text-gray-600">{v.conversions || '—'}</td>}
                      {merged.some(m => m.peakViewers) && <td className="px-4 py-2 text-right text-gray-600">{v.peakViewers || '—'}</td>}
                      {merged.some(m => m.avgStayTime) && <td className="px-4 py-2 text-right text-gray-600">{v.avgStayTime ? v.avgStayTime + '秒' : '—'}</td>}
                      {merged.some(m => m.likes) && <td className="px-4 py-2 text-right text-gray-600">{v.likes || '—'}</td>}
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
                直播复盘专家正在深度分析话术和数据...
              </div>
            )}
            {report && (
              <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                <SimpleMarkdown text={report} />
              </div>
            )}
            {reportLoading && report && (
              <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-1" />
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
                      const res = await fetch('/livestream-review/api/reports', {
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
                  className="px-5 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
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
                  a.download = `直播间脚本复盘_${dateStr}.md`
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
