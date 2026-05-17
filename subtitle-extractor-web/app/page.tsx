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

const ASR_LABEL: Record<AsrStatus, string> = {
  idle: '', uploading: '提交中', processing: '转写中', done: '已完成', error: '失败',
}
const ASR_COLOR: Record<AsrStatus, string> = {
  idle: '',
  uploading: 'bg-blue-100 text-blue-700',
  processing: 'bg-yellow-100 text-yellow-700',
  done: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
}

function formatCount(n: number) {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : n.toLocaleString()
}

function Spinner({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export default function Home() {
  const [shareText, setShareText] = useState('')

  // Single extraction
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [asrStatus, setAsrStatus] = useState<AsrStatus>('idle')
  const [transcript, setTranscript] = useState('')

  // View toggle
  const [viewMode, setViewMode] = useState<'subtitle' | 'mindmap'>('subtitle')
  const [mindmap, setMindmap] = useState<MindmapResult | null>(null)
  const [mindmapLoading, setMindmapLoading] = useState(false)

  // Batch upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [autoDownload, setAutoDownload] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [batchJobId, setBatchJobId] = useState('')
  const [batchAccessCode, setBatchAccessCode] = useState('')
  const [batchTotal, setBatchTotal] = useState(0)
  const [batchSuccess, setBatchSuccess] = useState(0)
  const [batchFailed, setBatchFailed] = useState(0)
  const [batchStatus, setBatchStatus] = useState<BatchStatus>('idle')
  const [batchPhase, setBatchPhase] = useState('')

  // History lookup
  const [queryJobId, setQueryJobId] = useState('')
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryResult, setQueryResult] = useState<{
    status: string; total: number; success: number; failed: number; phase: string
  } | null>(null)

  // UI
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const asrPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const batchPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (asrPollRef.current) clearInterval(asrPollRef.current)
      if (batchPollRef.current) clearInterval(batchPollRef.current)
    }
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  // ===== Single extraction =====
  async function handleExtract() {
    if (!shareText.trim()) return
    setError('')
    setVideoInfo(null)
    setTranscript('')
    setAsrStatus('idle')
    setViewMode('subtitle')
    setMindmap(null)
    if (asrPollRef.current) clearInterval(asrPollRef.current)

    setLoading('parsing')
    try {
      const res = await fetch(`${BASE}/api/parse-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareText: shareText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '解析失败')
      const info = data as VideoInfo
      setVideoInfo(info)
      setLoading('')
      await startTranscribe(info.audioUrl)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '解析失败')
      setLoading('')
    }
  }

  async function startTranscribe(audioUrl: string) {
    setAsrStatus('uploading')
    try {
      const res = await fetch(`${BASE}/api/transcribe/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        const res = await fetch(`${BASE}/api/transcribe/poll?taskId=${encodeURIComponent(id)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '轮询失败')
        if (data.status === 'done') {
          clearInterval(asrPollRef.current!)
          asrPollRef.current = null
          setTranscript(data.text ?? '')
          setAsrStatus('done')
        }
      } catch (e: unknown) {
        clearInterval(asrPollRef.current!)
        asrPollRef.current = null
        setError(e instanceof Error ? e.message : '转写失败')
        setAsrStatus('error')
      }
    }, 3000)
  }

  // ===== Mind map =====
  async function handleToggleMindmap() {
    if (viewMode === 'mindmap') { setViewMode('subtitle'); return }
    if (mindmap) { setViewMode('mindmap'); return }
    if (!transcript) return
    setMindmapLoading(true)
    try {
      const res = await fetch(`${BASE}/api/mindmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成失败')
      setMindmap(data as MindmapResult)
      setViewMode('mindmap')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '思维导图生成失败')
    } finally {
      setMindmapLoading(false)
    }
  }

  function handleCopy() {
    if (!transcript) return
    navigator.clipboard.writeText(transcript).then(() => showToast('已复制到剪贴板'))
  }

  // ===== Batch import =====
  async function handleBatchImport(file: File) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError('请上传 .xlsx 或 .xls 格式的文件')
      return
    }
    if (batchPollRef.current) clearInterval(batchPollRef.current)
    setBatchJobId('')
    setBatchAccessCode('')
    setBatchStatus('idle')
    setBatchPhase('')
    setBatchSuccess(0)
    setBatchFailed(0)
    setBatchTotal(0)
    setError('')

    const formData = new FormData()
    formData.append('file', file)

    setLoading('batch')
    try {
      const res = await fetch(`${BASE}/api/batch/import`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '上传失败')
      const { jobId, accessCode, total } = data as { jobId: string; accessCode: string; total: number }
      setBatchJobId(jobId)
      setBatchAccessCode(accessCode)
      setBatchTotal(total)
      setBatchStatus('processing')
      setLoading('')
      startBatchPoll(jobId)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '批量导入失败')
      setLoading('')
    }
  }

  function startBatchPoll(jobId: string) {
    if (batchPollRef.current) clearInterval(batchPollRef.current)
    batchPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${BASE}/api/batch/status?jobId=${encodeURIComponent(jobId)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '查询失败')
        setBatchSuccess(data.success ?? 0)
        setBatchFailed(data.failed ?? 0)
        setBatchPhase(data.phase ?? '')
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(batchPollRef.current!)
          batchPollRef.current = null
          setBatchStatus(data.status as BatchStatus)
          if (data.status === 'completed' && autoDownload) triggerDownload(batchAccessCode)
        }
      } catch (e: unknown) {
        clearInterval(batchPollRef.current!)
        batchPollRef.current = null
        setError(e instanceof Error ? e.message : '批量状态查询失败')
      }
    }, 5000)
  }

  function triggerDownload(code: string) {
    const a = document.createElement('a')
    a.href = `${BASE}/api/batch/export?code=${encodeURIComponent(code)}`
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // ===== History lookup =====
  async function handleQueryJob() {
    const id = queryJobId.trim()
    if (!id) return
    setQueryLoading(true)
    setQueryResult(null)
    try {
      const res = await fetch(`${BASE}/api/batch/status?code=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '查询失败，请确认访问码是否正确')
      setQueryResult({
        status: data.status,
        total: data.total ?? 0,
        success: data.success ?? 0,
        failed: data.failed ?? 0,
        phase: data.phase ?? '',
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '查询失败')
    } finally {
      setQueryLoading(false)
    }
  }

  // Drag & drop handlers
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true) }
  function handleDragLeave(e: React.DragEvent) { e.preventDefault(); setIsDragging(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleBatchImport(file)
  }

  const batchBusy = batchStatus === 'processing' || loading === 'batch'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">字幕提取工具</h1>
        <p className="text-sm text-gray-500 mt-0.5">粘贴抖音分享链接，自动提取视频字幕文案</p>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button className="ml-4 underline shrink-0" onClick={() => setError('')}>关闭</button>
        </div>
      )}

      <main className="max-w-4xl mx-auto p-6 space-y-5">

        {/* ── Block 1: 单条视频提取 ── */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">单条视频提取</p>
          <div className="flex gap-3 items-start">
            <textarea
              className="flex-1 border rounded-lg p-3 text-sm resize-none h-[52px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none leading-snug"
              placeholder="粘贴抖音分享文案或链接，例如：4.82 z@t.Rk CXD:/ https://v.douyin.com/xxx/"
              value={shareText}
              onChange={e => setShareText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleExtract() }
              }}
            />
            <button
              className="shrink-0 h-[52px] px-5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              onClick={handleExtract}
              disabled={!shareText.trim() || !!loading}
            >
              {loading === 'parsing' ? <><Spinner /> 解析中</> : '提取视频内容'}
            </button>
          </div>
        </div>

        {/* ── Block 2: 单条视频结果 ── */}
        {videoInfo && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="flex">
              {/* 9:16 封面 */}
              <div className="w-40 shrink-0 bg-gray-100">
                {videoInfo.coverUrl ? (
                  <img
                    src={videoInfo.coverUrl}
                    alt="封面"
                    className="w-full object-cover"
                    style={{ aspectRatio: '9/16', minHeight: '280px' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <div className="w-full flex items-center justify-center" style={{ aspectRatio: '9/16', minHeight: '280px' }}>
                    <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* 右侧内容 */}
              <div className="flex-1 min-w-0 flex flex-col divide-y">

                {/* 视频信息 */}
                <div className="p-4 space-y-3">
                  <h2 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{videoInfo.title}</h2>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">已提取</span>
                    {videoInfo.isSubtitled === 1 && (
                      <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full border border-purple-100">平台字幕</span>
                    )}
                    {asrStatus !== 'idle' && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ASR_COLOR[asrStatus]}`}>
                        {ASR_LABEL[asrStatus]}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {videoInfo.authorNickname && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-400 mb-0.5">作者</p>
                        <p className="text-sm text-gray-700 font-medium truncate">{videoInfo.authorNickname}</p>
                      </div>
                    )}
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-400 mb-0.5">点赞</p>
                      <p className="text-sm text-gray-700 font-medium">{formatCount(videoInfo.diggCount)}</p>
                    </div>
                  </div>
                </div>

                {/* 字幕区域 */}
                <div className="flex-1 p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {viewMode === 'subtitle' ? '字幕内容' : '思维导图'}
                      </span>
                      {(asrStatus === 'uploading' || asrStatus === 'processing') && (
                        <span className="flex items-center gap-1 text-xs text-blue-600">
                          <Spinner className="h-3 w-3" />
                          {asrStatus === 'uploading' ? '提交中...' : '转写中...'}
                        </span>
                      )}
                      {asrStatus === 'done' && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">已完成</span>
                      )}
                      {asrStatus === 'error' && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">失败</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {viewMode === 'subtitle' && transcript && (
                        <button className="text-xs text-gray-500 border rounded-lg px-2.5 py-1 hover:bg-gray-50 transition-colors" onClick={handleCopy}>
                          复制
                        </button>
                      )}
                      {transcript && (
                        <button
                          className="text-xs text-blue-600 border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                          onClick={handleToggleMindmap}
                          disabled={mindmapLoading}
                        >
                          {mindmapLoading ? '生成中...' : viewMode === 'subtitle' ? '思维导图' : '切换文案'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-72 min-h-[80px]">
                    {(asrStatus === 'idle' || asrStatus === 'uploading' || asrStatus === 'processing') && (
                      <p className="text-sm text-gray-400 text-center py-8">
                        {asrStatus === 'idle' ? '等待提取...' : asrStatus === 'uploading' ? '正在提交音频转写任务...' : '转写中，请稍候...'}
                      </p>
                    )}
                    {asrStatus === 'error' && <p className="text-sm text-red-500 text-center py-8">转写失败，请重试</p>}
                    {asrStatus === 'done' && !transcript && <p className="text-sm text-gray-400 text-center py-8">暂无字幕文本</p>}
                    {asrStatus === 'done' && transcript && viewMode === 'subtitle' && (
                      <pre className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-sans">{transcript}</pre>
                    )}
                    {viewMode === 'mindmap' && mindmap && (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-base font-bold text-gray-900">{mindmap.rootTitle}</h3>
                          <p className="text-xs text-gray-500 mt-1">{mindmap.summary}</p>
                        </div>
                        {mindmap.branches.map((branch, i) => (
                          <div key={i}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                              <span className="font-medium text-gray-800 text-sm">{branch.title}</span>
                            </div>
                            <div className="ml-4 space-y-1">
                              {branch.children.map((child, j) => (
                                <div key={j} className="flex items-start gap-2">
                                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full shrink-0 mt-1.5" />
                                  <span className="text-xs text-gray-600">{child}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ── Block 3: Excel 批量导入 ── */}
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Excel 批量导入</p>
            <span className="text-xs text-gray-400">A 列为抖音链接，首行标题自动跳过，最多 200 条</span>
          </div>

          {/* 拖拽上传区 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleBatchImport(f); e.target.value = '' }}
          />
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              isDragging ? 'border-blue-400 bg-blue-50' :
              batchBusy ? 'border-gray-200 bg-gray-50 cursor-not-allowed' :
              'border-gray-200 hover:border-blue-300 hover:bg-gray-50 cursor-pointer'
            }`}
            onClick={() => !batchBusy && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={e => { if (!batchBusy) handleDrop(e) }}
          >
            {batchStatus === 'processing' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-blue-600">
                  <Spinner className="h-5 w-5" />
                  <span className="text-sm font-medium">{batchPhase || '处理中...'}</span>
                </div>
                <p className="text-sm text-gray-500">
                  已处理 {batchSuccess + batchFailed} / {batchTotal} 条
                  {batchFailed > 0 && <span className="text-red-500 ml-2">失败 {batchFailed} 条</span>}
                </p>
                <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: batchTotal > 0 ? `${Math.round((batchSuccess + batchFailed) / batchTotal * 100)}%` : '0%' }}
                  />
                </div>
                {/* 访问码提示 */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  <span className="text-xs text-gray-400">访问码：</span>
                  <span className="text-sm text-gray-700 font-mono font-bold tracking-widest bg-gray-100 px-2 py-0.5 rounded">{batchAccessCode}</span>
                  <button
                    onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(batchAccessCode).then(() => showToast('已复制访问码')) }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    复制
                  </button>
                </div>
              </div>
            ) : batchStatus === 'completed' ? (
              <div className="space-y-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700">处理完成，成功 {batchSuccess} / {batchTotal} 条</p>

                {/* 访问码 - 突出显示 */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-1">
                  <p className="text-xs text-amber-700 font-medium">请保存此访问码，下次可凭此码查询和下载结果</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-xl font-mono font-bold text-amber-800 tracking-widest">{batchAccessCode}</span>
                    <button
                      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(batchAccessCode).then(() => showToast('已复制访问码')) }}
                      className="text-xs text-amber-700 border border-amber-300 rounded px-2 py-0.5 hover:bg-amber-100 transition-colors"
                    >
                      复制
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={e => { e.stopPropagation(); triggerDownload(batchAccessCode) }}
                    className="text-sm text-blue-600 border border-blue-200 rounded-lg px-4 py-1.5 hover:bg-blue-50 transition-colors"
                  >
                    下载结果 Excel
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setBatchStatus('idle'); setBatchJobId(''); setBatchAccessCode('') }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    重新上传
                  </button>
                </div>
              </div>
            ) : batchStatus === 'failed' ? (
              <div className="space-y-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-sm text-red-600">任务失败，请重新上传</p>
                <button
                  onClick={e => { e.stopPropagation(); setBatchStatus('idle'); setBatchJobId('') }}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  重新上传
                </button>
              </div>
            ) : (
              <div className="space-y-2 pointer-events-none">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">
                  {isDragging ? '松开鼠标上传' : '拖拽文件到此处，或点击选择'}
                </p>
                <p className="text-xs text-gray-400">.xlsx / .xls 格式</p>
              </div>
            )}
          </div>

          {/* 自动下载选项（仅未开始时显示） */}
          {(batchStatus === 'idle') && (
            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={autoDownload}
                onChange={e => setAutoDownload(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
              />
              <span className="text-sm text-gray-600">完成后自动下载结果 Excel</span>
            </label>
          )}

          {/* 历史任务查询 */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs text-gray-400">查询历史任务（输入访问码）</p>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                placeholder="例如：ABCD-1234"
                value={queryJobId}
                onChange={e => { setQueryJobId(e.target.value); setQueryResult(null) }}
                onKeyDown={e => { if (e.key === 'Enter') handleQueryJob() }}
              />
              <button
                className="shrink-0 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                onClick={handleQueryJob}
                disabled={!queryJobId.trim() || queryLoading}
              >
                {queryLoading ? <><Spinner className="h-3.5 w-3.5" />查询中</> : '查询'}
              </button>
            </div>

            {/* 查询结果 */}
            {queryResult && (
              <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      queryResult.status === 'completed' ? 'bg-green-100 text-green-700' :
                      queryResult.status === 'failed'    ? 'bg-red-100 text-red-700' :
                                                          'bg-blue-100 text-blue-700'
                    }`}>
                      {queryResult.status === 'completed' ? '已完成' :
                       queryResult.status === 'failed'    ? '失败' :
                       queryResult.phase || '处理中'}
                    </span>
                    <span className="text-sm text-gray-600">
                      成功 {queryResult.success} / {queryResult.total} 条
                      {queryResult.failed > 0 && <span className="text-red-500 ml-1">（失败 {queryResult.failed} 条）</span>}
                    </span>
                  </div>
                </div>
                {(queryResult.status === 'completed' || queryResult.status === 'failed') && (
                  <button
                    onClick={() => triggerDownload(queryJobId.trim())}
                    className="text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors shrink-0"
                  >
                    下载结果
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}
