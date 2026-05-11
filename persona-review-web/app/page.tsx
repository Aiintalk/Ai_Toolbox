'use client'

import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'

/* ── Types ── */

interface ScriptEntry {
  id: string
  title: string
  content: string
  source: string // 'paste' | filename
}

interface ExcelRow {
  date: string
  liveTheme: string
  videoTheme: string
  videoType: string
  totalPlays: string
  completionRate: string
  fiveSecRate: string
  likes: string
  comments: string
  adSpend: string
}

interface MergedItem {
  title: string
  content: string
  // from excel
  videoType?: string
  totalPlays?: string
  completionRate?: string
  fiveSecRate?: string
  likes?: string
  comments?: string
  adSpend?: string
  date?: string
  liveTheme?: string
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

function parseTransposedExcel(wb: XLSX.WorkBook): ExcelRow[] {
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
  if (raw.length < 2) return []

  const knownLabels: [string[], keyof ExcelRow][] = [
    [['发布时间'], 'date'],
    [['直播主题'], 'liveTheme'],
    [['视频主题'], 'videoTheme'],
    [['视频类型'], 'videoType'],
    [['总播放量', '播放量'], 'totalPlays'],
    [['完播率'], 'completionRate'],
    [['5s完播率', '5秒完播率'], 'fiveSecRate'],
    [['点赞'], 'likes'],
    [['评论'], 'comments'],
    [['投放金额', '投放'], 'adSpend'],
  ]

  const rowMapping: { rowIdx: number; key: keyof ExcelRow }[] = []
  for (let r = 0; r < raw.length; r++) {
    const cellVal = String(raw[r]?.[0] ?? '').trim()
    for (const [aliases, key] of knownLabels) {
      if (aliases.some(a => cellVal.includes(a))) {
        rowMapping.push({ rowIdx: r, key })
        break
      }
    }
  }
  if (rowMapping.length === 0) return []

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
    if (hasData && (entry.videoTheme || entry.date)) results.push(entry as ExcelRow)
  }
  return results
}

/** Extract title from script content — first non-empty line, truncated */
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

    // Split by separator line (===, ---, or just double newline with number prefix)
    const separator = /\n(?:={3,}|-{3,})\n/
    let segments: string[]

    if (separator.test(text)) {
      segments = text.split(separator).map(s => s.trim()).filter(s => s.length > 0)
    } else {
      // Single script
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

  async function handleScriptFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const text = await file.text()
      if (text.trim()) {
        setScripts(prev => [...prev, {
          id: genId(),
          title: extractTitle(text),
          content: text.trim(),
          source: file.name,
        }])
      }
    }
    // Reset input so same file can be uploaded again
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
        if (parsed.length === 0) { setError('未能解析Excel数据，请检查格式'); return }
        setExcelData(parsed)
        setError('')
      } catch { setError('Excel解析失败') }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  /* ── Step 2 -> Step 3: Merge & Generate Report ── */

  async function handleGenerate() {
    if (scripts.length === 0) { setError('请先上传脚本'); return }

    // Merge scripts with excel data
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
        videoType: excelMatch?.videoType,
        totalPlays: excelMatch?.totalPlays,
        completionRate: excelMatch?.completionRate,
        fiveSecRate: excelMatch?.fiveSecRate,
        likes: excelMatch?.likes,
        comments: excelMatch?.comments,
        adSpend: excelMatch?.adSpend,
        date: excelMatch?.date,
        liveTheme: excelMatch?.liveTheme,
      }
    })

    // Add excel rows that didn't match
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
            videoType: e.videoType,
            totalPlays: e.totalPlays,
            completionRate: e.completionRate,
            fiveSecRate: e.fiveSecRate,
            likes: e.likes,
            comments: e.comments,
            adSpend: e.adSpend,
            date: e.date,
            liveTheme: e.liveTheme,
          })
        }
      }
    }

    // Sort by likes descending if available
    mergedList.sort((a, b) => (parseInt(b.likes || '0') || 0) - (parseInt(a.likes || '0') || 0))
    setMerged(mergedList)
    setStep(3)
    setReportLoading(true)
    setReport('')

    const hasExcel = mergedList.some(m => m.completionRate || m.adSpend || m.likes)

    // Build the input for AI
    const videoDescriptions = mergedList.map((v, i) => {
      let desc = `### 视频 ${i + 1}：${v.title}`
      if (v.date) desc += `\n发布日期: ${v.date}`
      if (v.videoType) desc += ` | 类型: ${v.videoType}`
      if (v.likes) desc += ` | 点赞: ${v.likes}`
      if (v.comments) desc += ` | 评论: ${v.comments}`
      if (v.totalPlays) desc += ` | 播放量: ${v.totalPlays}万`
      if (v.completionRate) desc += ` | 完播率: ${v.completionRate}`
      if (v.fiveSecRate) desc += ` | 5s完播率: ${v.fiveSecRate}`
      if (v.adSpend) desc += ` | 投放金额: ${v.adSpend}`
      if (v.liveTheme) desc += ` | 所属直播场: ${v.liveTheme}`
      if (v.content) {
        // Truncate very long scripts
        const truncated = v.content.length > 2000 ? v.content.slice(0, 2000) + '\n...(已截断)' : v.content
        desc += `\n\n【完整脚本】\n${truncated}`
      }
      return desc
    }).join('\n\n---\n\n')

    const systemPrompt = `你是抖音顶级内容操盘大师。你研究过抖音上所有头部IP的内容策略，深谙什么样的短视频能涨粉、什么样的内容能建立IP信任度。你对内容结构、选题策略、开头hook、完播率优化、人设表达有极深的实战理解。

你现在要帮运营团队做一期人设内容的复盘分析。

用户会给你本期所有视频的**完整脚本文案**${hasExcel ? '以及运营数据（点赞、完播率、5s完播率、投放金额等）' : ''}。你需要深入分析每条脚本的内容质量。

请你根据脚本内容${hasExcel ? '和数据' : ''}，输出一份**实战导向**的复盘报告。以下是你可以输出的内容模块，**不是每个都必须写，根据实际情况判断哪些有必要**：

1. **最好的内容**：哪几条是本期最好的？从脚本内容层面拆解：
   - 开头hook怎么抓人的（前3秒/前5秒做了什么）
   - 内容结构（怎么展开、怎么递进、怎么收尾）
   - 情绪钩子和人设共鸣点在哪里
   - 接下来怎么基于这套方法论继续出内容，给出具体可执行的下一步

2. **建议淘汰的内容**：哪些脚本${hasExcel ? '数据差且' : ''}内容质量不行？
   - 选题偏离人设？开头没吸引力？结构散？表达不对？
   - 直接说该砍就砍，给理由

3. **值得新增的内容方向**：基于表现好的脚本的共性规律，推荐新选题方向
   - 要具体到"什么角度、什么情绪、什么结构"
   - 不是泛泛说"可以多做XXX类"

${hasExcel ? `4. **投放效率分析**：哪些投了效果好，哪些投了但数据差，帮团队判断投放策略

5. **完播率洞察**：5s完播率和完播率的异常分析（5s高但完播低=开头好内容没撑住；5s低=开头就劝退），对照脚本内容给出优化建议` : ''}

要求：
- 你有完整脚本，分析要深入到具体的文案细节，不是只看标题
- 引用脚本中的具体句子和段落来支撑你的判断
- 语言直接，不客气，像一个严格但靠谱的操盘手给团队开复盘会
- 不说正确的废话，每一条建议都要能直接执行
- 如果某个模块没什么可说的，就跳过，不要凑字数`

    try {
      const res = await fetch('/persona-review/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          messages: [{
            role: 'user',
            content: `以下是本期发布的人设内容视频（共${mergedList.length}条）：\n\n${videoDescriptions}\n\n请输出复盘报告。`,
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
    { n: 2, label: '上传复盘表' },
    { n: 3, label: '复盘报告' },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">人设脚本复盘助手</h1>
          <p className="text-gray-500 mt-1">上传脚本 → 上传复盘表 → AI复盘报告</p>
        </div>
        <a href="/persona-review/report" className="text-sm text-orange-500 hover:text-orange-600 mt-1">
          历史报告 →
        </a>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        {STEPS.map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
              step >= n ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > n ? '✓' : n}
            </div>
            <span className={`text-sm ${step >= n ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{label}</span>
            {n < 3 && <div className={`w-10 h-0.5 ${step > n ? 'bg-orange-500' : 'bg-gray-200'}`} />}
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
          {/* 已添加的脚本列表 */}
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
            </div>
          )}

          {/* 粘贴区域 */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-1">粘贴脚本文案</h2>
            <p className="text-gray-400 text-sm mb-4">
              粘贴一条视频的完整脚本。多条脚本可以用 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">===</code> 或 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">---</code> 分隔，也可以一条一条添加。
            </p>
            <textarea
              className="w-full h-48 p-4 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300"
              placeholder={"粘贴视频脚本文案...\n\n如果有多条脚本，可以用 === 分隔：\n\n第一条脚本内容...\n===\n第二条脚本内容...\n===\n第三条脚本内容..."}
              value={pasteInput}
              onChange={e => setPasteInput(e.target.value)}
            />
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* 上传文件按钮 */}
                <button
                  onClick={() => scriptFileRef.current?.click()}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  上传 .txt 文件
                </button>
                <input
                  ref={scriptFileRef}
                  type="file"
                  accept=".txt,.text"
                  multiple
                  onChange={handleScriptFiles}
                  className="hidden"
                />
                <span className="text-xs text-gray-400">支持多选</span>
              </div>
              <button
                onClick={handleAddPaste}
                disabled={!pasteInput.trim()}
                className="px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                添加脚本
              </button>
            </div>
          </div>

          {/* 下一步 */}
          {scripts.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
              >
                下一步：上传复盘表
              </button>
            </div>
          )}
        </div>
      )}

      {/* ──────── Step 2: 上传复盘表 ──────── */}
      {step === 2 && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => setStep(1)} className="text-sm text-orange-500 hover:text-orange-600">← 返回编辑脚本</button>
            <span className="text-sm text-gray-500">已添加 {scripts.length} 条脚本</span>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-1">上传运营复盘表</h2>
            <p className="text-gray-400 text-sm mb-4">
              上传Excel复盘表，提取播放量、完播率、投放金额等运营数据。<strong className="text-gray-500">可选步骤</strong>，跳过也能基于脚本内容生成报告。
            </p>

            <div
              onClick={() => excelFileRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-colors"
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
                  <div className="text-sm text-gray-500">点击上传 Excel 复盘表</div>
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
                      <th className="px-3 py-2 text-left">日期</th>
                      <th className="px-3 py-2 text-left">视频主题</th>
                      <th className="px-3 py-2">类型</th>
                      <th className="px-3 py-2 text-right">播放量</th>
                      <th className="px-3 py-2 text-right">完播率</th>
                      <th className="px-3 py-2 text-right">5s完播率</th>
                      <th className="px-3 py-2 text-right">点赞</th>
                      <th className="px-3 py-2 text-right">投放金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelData.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5 text-gray-500">{row.date || '—'}</td>
                        <td className="px-3 py-1.5 text-gray-900 max-w-[200px] truncate">{row.videoTheme || '—'}</td>
                        <td className="px-3 py-1.5 text-center text-gray-500">{row.videoType || '—'}</td>
                        <td className="px-3 py-1.5 text-right">{row.totalPlays ? row.totalPlays + '万' : '—'}</td>
                        <td className="px-3 py-1.5 text-right">{row.completionRate || '—'}</td>
                        <td className="px-3 py-1.5 text-right">{row.fiveSecRate || '—'}</td>
                        <td className="px-3 py-1.5 text-right">{row.likes || '—'}</td>
                        <td className="px-3 py-1.5 text-right">{row.adSpend || '—'}</td>
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
                  className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
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
            <button onClick={() => setStep(2)} className="text-sm text-orange-500 hover:text-orange-600">← 返回</button>
            <span className="text-sm text-gray-500">
              {merged.length} 条内容
              {merged.some(m => m.likes) && ' · 含运营数据'}
            </span>
          </div>

          {/* Brief data overview if excel data present */}
          {merged.some(m => m.likes) && (
            <div className="bg-white rounded-xl shadow-sm border overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-500 border-b text-xs">
                    <th className="px-4 py-2 w-8">#</th>
                    <th className="px-4 py-2">标题</th>
                    <th className="px-4 py-2 text-right">点赞</th>
                    {merged.some(m => m.totalPlays) && <th className="px-4 py-2 text-right">播放量</th>}
                    {merged.some(m => m.completionRate) && <th className="px-4 py-2 text-right">完播率</th>}
                    {merged.some(m => m.fiveSecRate) && <th className="px-4 py-2 text-right">5s完播率</th>}
                    {merged.some(m => m.adSpend) && <th className="px-4 py-2 text-right">投放</th>}
                  </tr>
                </thead>
                <tbody>
                  {merged.map((v, i) => (
                    <tr key={i} className={`border-b last:border-0 text-xs ${i < 3 ? 'bg-orange-50/50' : ''}`}>
                      <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2 text-gray-900 truncate max-w-[250px]">{v.title}</td>
                      <td className="px-4 py-2 text-right font-medium text-gray-700">{v.likes || '—'}</td>
                      {merged.some(m => m.totalPlays) && <td className="px-4 py-2 text-right text-gray-600">{v.totalPlays ? v.totalPlays + '万' : '—'}</td>}
                      {merged.some(m => m.completionRate) && <td className="px-4 py-2 text-right text-gray-600">{v.completionRate || '—'}</td>}
                      {merged.some(m => m.fiveSecRate) && <td className="px-4 py-2 text-right text-gray-600">{v.fiveSecRate || '—'}</td>}
                      {merged.some(m => m.adSpend) && <td className="px-4 py-2 text-right text-gray-600">{v.adSpend || '—'}</td>}
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
                操盘大师正在深度分析脚本内容...
              </div>
            )}
            {report && (
              <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                <SimpleMarkdown text={report} />
              </div>
            )}
            {reportLoading && report && (
              <span className="inline-block w-2 h-4 bg-orange-400 animate-pulse ml-1" />
            )}
          </div>

          {!reportLoading && report && (
            <div className="mt-4 flex justify-end gap-3">
              {/* 保存在线 */}
              {savedId ? (
                <a
                  href={`/persona-review/report?id=${savedId}`}
                  target="_blank"
                  className="px-5 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 hover:bg-green-100 transition-colors"
                >
                  已保存 — 点击查看
                </a>
              ) : (
                <button
                  onClick={async () => {
                    setSaving(true)
                    try {
                      const res = await fetch('/persona-review/api/reports', {
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
                  className="px-5 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors"
                >
                  {saving ? '保存中...' : '保存在线'}
                </button>
              )}
              {/* 导出Word */}
              <button
                onClick={() => {
                  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  const dateStr = new Date().toISOString().slice(0, 10)
                  a.href = url
                  a.download = `人设脚本复盘_${dateStr}.md`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                导出下载
              </button>
              {/* 复制 */}
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
