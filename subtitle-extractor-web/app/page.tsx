'use client'

import { useState, useEffect, useRef } from 'react'

const BASE = '/subtitle-extractor'

interface VideoInfo {
  awemeId: string
  title: string
  diggCount: number
  playUrl: string
  audioUrl: string
  coverUrl: string
  authorNickname: string
  isSubtitled: number
}

interface MindmapBranch {
  title: string
  children: string[]
}

interface MindmapResult {
  rootTitle: string
  summary: string
  branches: MindmapBranch[]
}

type AsrStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error'
type BatchStatus = 'idle' | 'processing' | 'completed' | 'failed'

interface ActiveBatch {
  jobId: string
  accessCode: string
  total: number
  status: BatchStatus
}

const BATCH_STORAGE_KEY = 'subtitle_active_batch'

function saveActiveBatch(data: ActiveBatch | null) {
  if (data) localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(data))
  else localStorage.removeItem(BATCH_STORAGE_KEY)
}

function loadActiveBatch(): ActiveBatch | null {
  try {
    const raw = localStorage.getItem(BATCH_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ActiveBatch) : null
  } catch {
    return null
  }
}

function formatCount(n: number) {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : n.toLocaleString()
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 inline-block" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export default function Home() {
  const [shareText, setShareText] = useState('')

  const [videoInfo, setVideoInfo]           = useState<VideoInfo | null>(null)
  const [asrStatus, setAsrStatus]           = useState<AsrStatus>('idle')
  const [transcript, setTranscript]         = useState('')
  const [viewMode, setViewMode]             = useState<'subtitle' | 'mindmap'>('subtitle')
  const [mindmap, setMindmap]               = useState<MindmapResult | null>(null)
  const [mindmapLoading, setMindmapLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging]         = useState(false)
  const [autoDownload, setAutoDownload]     = useState(false)
  const [batchJobId, setBatchJobId]         = useState('')
  const [batchAccessCode, setBatchAccessCode] = useState('')
  const [batchTotal, setBatchTotal]         = useState(0)
  const [batchSuccess, setBatchSuccess]     = useState(0)
  const [batchFailed, setBatchFailed]       = useState(0)
  const [batchStatus, setBatchStatus]       = useState<BatchStatus>('idle')
  const [batchPhase, setBatchPhase]         = useState('')

  const [queryCode, setQueryCode]           = useState('')
  const [queryLoading, setQueryLoading]     = useState(false)
  const [queryResult, setQueryResult]       = useState<{
    status: string; total: number; success: number; failed: number; phase: string; accessCode: string
  } | null>(null)

  const [loading, setLoading] = useState('')
  const [error, setError]     = useState('')
  const [toast, setToast]     = useState('')

  const asrPollRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const batchPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const batchCodeRef  = useRef('')
  const batchTotalRef = useRef(0)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    const saved = loadActiveBatch()
    if (saved && saved.status === 'processing') {
      setBatchJobId(saved.jobId)
      setBatchAccessCode(saved.accessCode)
      setBatchTotal(saved.total)
      setBatchStatus('processing')
      batchCodeRef.current  = saved.accessCode
      batchTotalRef.current = saved.total
      startBatchPoll(saved.jobId)
    } else if (saved && (saved.status === 'completed' || saved.status === 'failed')) {
      setBatchJobId(saved.jobId)
      setBatchAccessCode(saved.accessCode)
      setBatchTotal(saved.total)
      setBatchStatus(saved.status)
    }
    return () => {
      if (asrPollRef.current)   clearInterval(asrPollRef.current)
      if (batchPollRef.current) clearInterval(batchPollRef.current)
    }
  }, [])

  // ── Single extraction ──────────────────────────────────────────

  async function handleExtract() {
    if (!shareText.trim()) return
    setError(''); setVideoInfo(null); setTranscript(''); setAsrStatus('idle')
    setViewMode('subtitle'); setMindmap(null)
    if (asrPollRef.current) clearInterval(asrPollRef.current)
    setLoading('parsing')
    try {
      const res  = await fetch(`${BASE}/api/parse-video`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareText: shareText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '解析失败')
      setVideoInfo(data as VideoInfo)
      setLoading('')
      await startTranscribe((data as VideoInfo).audioUrl)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '解析失败')
      setLoading('')
    }
  }

  async function startTranscribe(audioUrl: string) {
    setAsrStatus('uploading')
    try {
      const res  = await fetch(`${BASE}/api/transcribe/upload`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '提交转写失败')
      setAsrStatus('processing')
      startAsrPoll(data.taskId as string)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '提交转写失败')
      setAsrStatus('error')
    }
  }

  function startAsrPoll(id: string) {
    if (asrPollRef.current) clearInterval(asrPollRef.current)
    asrPollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`${BASE}/api/transcribe/poll?taskId=${encodeURIComponent(id)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '轮询失败')
        if (data.status === 'done') {
          clearInterval(asrPollRef.current!); asrPollRef.current = null
          setTranscript(data.text ?? ''); setAsrStatus('done')
        }
      } catch (e: unknown) {
        clearInterval(asrPollRef.current!); asrPollRef.current = null
        setError(e instanceof Error ? e.message : '转写失败'); setAsrStatus('error')
      }
    }, 3000)
  }

  async function handleToggleMindmap() {
    if (viewMode === 'mindmap') { setViewMode('subtitle'); return }
    if (mindmap) { setViewMode('mindmap'); return }
    if (!transcript) return
    setMindmapLoading(true)
    try {
      const res  = await fetch(`${BASE}/api/mindmap`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成失败')
      setMindmap(data as MindmapResult); setViewMode('mindmap')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '思维导图生成失败')
    } finally { setMindmapLoading(false) }
  }

  function handleCopy() {
    if (!transcript) return
    navigator.clipboard.writeText(transcript).then(() => showToast('已复制到剪贴板'))
  }

  // ── Batch import ───────────────────────────────────────────────

  async function handleBatchImport(file: File) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) { setError('请上传 .xlsx 或 .xls 格式的文件'); return }
    if (batchPollRef.current) clearInterval(batchPollRef.current)
    setBatchJobId(''); setBatchAccessCode(''); setBatchStatus('idle'); setBatchPhase('')
    setBatchSuccess(0); setBatchFailed(0); setBatchTotal(0); setError('')

    const formData = new FormData()
    formData.append('file', file)
    setLoading('batch')
    try {
      const res  = await fetch(`${BASE}/api/batch/import`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '上传失败')
      const { jobId, accessCode, total } = data as { jobId: string; accessCode: string; total: number }
      setBatchJobId(jobId); setBatchAccessCode(accessCode); setBatchTotal(total)
      setBatchStatus('processing'); setLoading('')
      batchCodeRef.current  = accessCode
      batchTotalRef.current = total
      saveActiveBatch({ jobId, accessCode, total, status: 'processing' })
      startBatchPoll(jobId)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '批量导入失败'); setLoading('')
    }
  }

  function startBatchPoll(jobId: string) {
    if (batchPollRef.current) clearInterval(batchPollRef.current)
    batchPollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`${BASE}/api/batch/status?jobId=${encodeURIComponent(jobId)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '查询失败')
        setBatchSuccess(data.success ?? 0); setBatchFailed(data.failed ?? 0); setBatchPhase(data.phase ?? '')
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(batchPollRef.current!); batchPollRef.current = null
          setBatchStatus(data.status as BatchStatus)
          saveActiveBatch({
            jobId, accessCode: batchCodeRef.current,
            total: batchTotalRef.current, status: data.status as BatchStatus,
          })
          if (data.status === 'completed' && autoDownload) triggerDownload(batchCodeRef.current)
        }
      } catch (e: unknown) {
        clearInterval(batchPollRef.current!); batchPollRef.current = null
        setError(e instanceof Error ? e.message : '批量状态查询失败')
      }
    }, 5000)
  }

  function triggerDownload(code: string) {
    const a = document.createElement('a')
    a.href = `${BASE}/api/batch/export?code=${encodeURIComponent(code)}`
    a.download = ''; document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  async function handleQueryJob() {
    const id = queryCode.trim()
    if (!id) return
    setQueryLoading(true); setQueryResult(null)
    try {
      const res  = await fetch(`${BASE}/api/batch/status?code=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '查询失败，请确认访问码是否正确')
      setQueryResult({
        status: data.status, total: data.total ?? 0, success: data.success ?? 0,
        failed: data.failed ?? 0, phase: data.phase ?? '', accessCode: id,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '查询失败')
    } finally { setQueryLoading(false) }
  }

  function handleDragOver(e: React.DragEvent)  { e.preventDefault(); setIsDragging(true) }
  function handleDragLeave(e: React.DragEvent) { e.preventDefault(); setIsDragging(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleBatchImport(file)
  }

  const batchBusy = batchStatus === 'processing' || loading === 'batch'
  const asrDone   = asrStatus === 'done'

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-gray-800 text-white rounded-lg shadow text-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-[1400px] mx-auto">
          <h1 className="text-lg font-bold text-gray-900">短视频字幕提取工具</h1>
          <p className="text-xs text-gray-400 mt-0.5">粘贴抖音链接，自动提取字幕文案 · 支持批量 Excel 导入</p>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="max-w-[1400px] mx-auto px-6 mt-4">
          <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <span>{error}</span>
            <button className="ml-4 underline shrink-0 cursor-pointer" onClick={() => setError('')}>关闭</button>
          </div>
        </div>
      )}

      <main className="max-w-[1400px] mx-auto p-6 space-y-4">

        {/* ── 单条提取 ── */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">单条视频 ASR 转换</h2>
          <p className="text-sm text-gray-500">粘贴抖音视频分享链接，提取视频封面、基础信息和字幕文案。</p>

          {/* Input row */}
          <div className="flex gap-2">
            <input
              className="flex-1 h-10 px-3 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="粘贴抖音视频分享链接，例如：https://v.douyin.com/xxx/"
              value={shareText}
              onChange={e => setShareText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleExtract() }}
            />
            <button
              className="px-4 h-10 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              onClick={handleExtract}
              disabled={!shareText.trim() || !!loading}
            >
              {loading === 'parsing' ? <><Spinner /> 解析中</> : '提取视频内容'}
            </button>
          </div>

          {/* Result: cover + content */}
          {videoInfo && (
            <div className="grid grid-cols-[minmax(280px,360px)_1fr] gap-5 pt-2 max-[900px]:grid-cols-1">

              {/* Cover */}
              <div className="relative min-h-[480px] rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                {videoInfo.coverUrl ? (
                  <img
                    src={videoInfo.coverUrl} alt="封面"
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-4xl">▶</div>
                )}
                <div className="absolute left-3 bottom-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs">
                  ▶ 视频封面
                </div>
              </div>

              {/* Right side */}
              <div className="flex flex-col gap-4 min-w-0">

                {/* Video info */}
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-gray-900 leading-snug">{videoInfo.title}</h3>
                    {videoInfo.playUrl && (
                      <a href={videoInfo.playUrl} target="_blank" rel="noopener noreferrer">
                        <button className="px-3 h-8 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                          下载视频
                        </button>
                      </a>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">已提取</span>
                    {videoInfo.isSubtitled === 1 && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">平台字幕</span>}
                    {asrStatus === 'uploading'  && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">提交转写中</span>}
                    {asrStatus === 'processing' && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full flex items-center gap-1"><Spinner /> 转写中</span>}
                    {asrStatus === 'done'       && <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full">字幕已完成</span>}
                  </div>

                  {/* Meta board: 3 columns */}
                  <div className="grid grid-cols-3 gap-2 max-[640px]:grid-cols-1">
                    {videoInfo.authorNickname && (
                      <div className="p-2.5 border border-gray-100 rounded-lg bg-gray-50">
                        <div className="text-xs text-gray-400 mb-1">作者</div>
                        <div className="text-sm font-medium text-gray-800 truncate">{videoInfo.authorNickname}</div>
                      </div>
                    )}
                    <div className="p-2.5 border border-gray-100 rounded-lg bg-gray-50">
                      <div className="text-xs text-gray-400 mb-1">点赞数</div>
                      <div className="text-sm font-medium text-gray-800">{formatCount(videoInfo.diggCount)}</div>
                    </div>
                    <div className="p-2.5 border border-gray-100 rounded-lg bg-gray-50">
                      <div className="text-xs text-gray-400 mb-1">视频 ID</div>
                      <div className="text-sm font-medium text-gray-800 truncate font-mono">{videoInfo.awemeId}</div>
                    </div>
                  </div>
                </div>

                {/* Transcript / Mindmap box */}
                <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-800">字幕内容</h3>
                    <div className="flex items-center gap-2">
                      {asrDone && transcript && (
                        <button
                          className="px-3 h-7 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                          onClick={handleCopy}
                        >
                          复制
                        </button>
                      )}
                      {asrDone && transcript && (
                        <button
                          className="px-3 h-7 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                          onClick={handleToggleMindmap}
                          disabled={mindmapLoading}
                        >
                          {mindmapLoading ? '生成中...' : viewMode === 'mindmap' ? '文案' : '思维导图'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Content box */}
                  <div className="border border-gray-100 rounded-lg bg-gray-50 overflow-y-auto" style={{ height: 'clamp(260px, 32vh, 300px)' }}>
                    <div className="p-3 h-full">
                      {/* Subtitle view */}
                      {viewMode === 'subtitle' && (
                        <>
                          {(asrStatus === 'idle' || asrStatus === 'uploading' || asrStatus === 'processing') && (
                            <p className="text-sm text-gray-400 text-center py-8">
                              {asrStatus === 'idle' ? '等待提取...' : asrStatus === 'uploading' ? '正在提交音频转写任务...' : '转写中，请稍候...'}
                            </p>
                          )}
                          {asrStatus === 'error' && <p className="text-sm text-red-500 text-center py-8">转写失败，请重试</p>}
                          {asrStatus === 'done' && !transcript && <p className="text-sm text-gray-400 text-center py-8">暂无字幕文本</p>}
                          {asrStatus === 'done' && transcript && (
                            <pre className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-sans break-words">{transcript}</pre>
                          )}
                        </>
                      )}

                      {/* Mindmap view */}
                      {viewMode === 'mindmap' && mindmap && (
                        <div className="grid grid-cols-[minmax(100px,0.7fr)_1fr] gap-4 items-start max-[640px]:grid-cols-1">
                          <div className="p-3 rounded-xl bg-gray-800 text-white text-sm font-semibold text-center leading-snug">
                            {mindmap.rootTitle}
                          </div>
                          <div className="flex flex-col gap-2.5">
                            {mindmap.branches.map((branch, i) => (
                              <div key={i} className="grid grid-cols-[90px_1fr] gap-2 items-start max-[480px]:grid-cols-1">
                                <div className="px-2 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold leading-tight">
                                  {branch.title}
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  {branch.children.map((child, j) => (
                                    <div key={j} className="px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-700 text-xs leading-snug">
                                      {child}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </section>

        {/* ── 批量提取 ── */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">批量提取</h2>
            <p className="text-sm text-gray-500 mt-1">上传包含抖音链接的 Excel，批量解析视频并转字幕，生成可下载结果。A 列为链接，首行标题自动跳过，最多 200 条。</p>
          </div>

          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleBatchImport(f); e.target.value = '' }} />

          {/* Upload row */}
          <div className="flex gap-2 items-stretch max-[640px]:flex-col">
            <div
              className={`flex-1 flex items-center min-h-[40px] px-3 rounded-lg border text-sm cursor-pointer select-none transition-colors ${
                isDragging  ? 'border-blue-400 bg-blue-50' :
                batchBusy   ? 'border-dashed border-gray-300 bg-gray-50 opacity-60 cursor-not-allowed' :
                              'border-dashed border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
              }`}
              onClick={() => !batchBusy && fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={e => { if (!batchBusy) handleDrop(e) }}
            >
              {loading === 'batch'
                ? <span className="flex items-center gap-2 text-blue-600"><Spinner /> 上传中...</span>
                : <span className="text-gray-500"><strong className="text-blue-600 font-medium">选择 Excel 文件</strong>，或拖拽文件到这里</span>
              }
            </div>
            <button
              className="px-4 h-10 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              disabled={batchBusy}
              onClick={() => { setAutoDownload(false); fileInputRef.current?.click() }}
            >
              导入并转字幕
            </button>
            <button
              className="px-4 h-10 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              disabled={batchBusy}
              onClick={() => { setAutoDownload(true); fileInputRef.current?.click() }}
            >
              上传并自动下载
            </button>
          </div>

          {/* Active batch job */}
          {batchStatus !== 'idle' && (
            <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
              <div className="space-y-1.5 min-w-0">
                <div className="text-sm font-mono font-medium text-gray-800">{batchAccessCode}</div>
                <div className="flex flex-wrap gap-2 text-xs text-gray-500 items-center">
                  {batchStatus === 'processing' && (
                    <span className="flex items-center gap-1 text-blue-600"><Spinner />{batchPhase || '处理中'}</span>
                  )}
                  {batchStatus === 'completed' && <span className="text-green-600">已完成</span>}
                  {batchStatus === 'failed'    && <span className="text-red-500">失败</span>}
                  <span>共 {batchTotal} 条</span>
                  {batchStatus === 'processing' && <span>已处理 {batchSuccess + batchFailed} 条</span>}
                  {(batchStatus === 'completed' || batchStatus === 'failed') && (
                    <span>成功 {batchSuccess} / 失败 {batchFailed}</span>
                  )}
                </div>
                {batchStatus === 'processing' && batchTotal > 0 && (
                  <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-1.5 bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((batchSuccess + batchFailed) / batchTotal * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {batchStatus === 'processing' && (
                  <button
                    className="px-3 h-8 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigator.clipboard.writeText(batchAccessCode).then(() => showToast('已复制访问码'))}
                  >
                    复制访问码
                  </button>
                )}
                {(batchStatus === 'completed' || batchStatus === 'failed') && (
                  <>
                    <button
                      className="px-3 h-8 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 cursor-pointer"
                      onClick={() => triggerDownload(batchAccessCode)}
                    >
                      下载结果
                    </button>
                    <button
                      className="px-3 h-8 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                      onClick={() => { setBatchStatus('idle'); setBatchJobId(''); setBatchAccessCode(''); saveActiveBatch(null) }}
                    >
                      新任务
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Query result */}
          {queryResult && batchStatus === 'idle' && (
            <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <div className="text-sm font-mono font-medium text-gray-800">{queryResult.accessCode}</div>
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  {queryResult.status === 'completed' && <span className="text-green-600">已完成</span>}
                  {queryResult.status === 'failed'    && <span className="text-red-500">失败</span>}
                  {queryResult.status === 'processing'&& <span className="text-blue-600">处理中</span>}
                  <span>成功 {queryResult.success} / {queryResult.total} 条</span>
                  {queryResult.failed > 0 && <span className="text-red-500">失败 {queryResult.failed} 条</span>}
                </div>
              </div>
              {(queryResult.status === 'completed' || queryResult.status === 'failed') && (
                <button
                  className="px-3 h-8 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 cursor-pointer"
                  onClick={() => triggerDownload(queryResult.accessCode)}
                >
                  下载结果
                </button>
              )}
            </div>
          )}

          {/* History query */}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-2">查询历史任务（输入访问码，格式：ABCD-1234）</p>
            <div className="flex gap-2">
              <input
                className="flex-1 h-10 px-3 border border-gray-300 rounded-lg text-sm font-mono text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
                placeholder="例如：ABCD-1234"
                value={queryCode}
                onChange={e => { setQueryCode(e.target.value); setQueryResult(null) }}
                onKeyDown={e => { if (e.key === 'Enter') handleQueryJob() }}
              />
              <button
                className="px-4 h-10 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                onClick={handleQueryJob}
                disabled={!queryCode.trim() || queryLoading}
              >
                {queryLoading ? <><Spinner /> 查询中</> : '查询'}
              </button>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
