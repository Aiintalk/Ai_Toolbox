'use client'

import { useState, useEffect, useRef } from 'react'

const BASE = '/subtitle-extractor'

interface VideoInfo {
  awemeId: string
  title: string
  diggCount: number
  playUrl: string
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

export default function Home() {
  const [shareText, setShareText] = useState('')

  // Single extraction
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [asrStatus, setAsrStatus] = useState<AsrStatus>('idle')
  const [transcript, setTranscript] = useState('')

  // View
  const [viewMode, setViewMode] = useState<'subtitle' | 'mindmap'>('subtitle')
  const [mindmap, setMindmap] = useState<MindmapResult | null>(null)
  const [mindmapLoading, setMindmapLoading] = useState(false)

  // Batch
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputAutoRef = useRef<HTMLInputElement>(null)
  const [batchJobId, setBatchJobId] = useState('')
  const [batchTotal, setBatchTotal] = useState(0)
  const [batchSuccess, setBatchSuccess] = useState(0)
  const [batchFailed, setBatchFailed] = useState(0)
  const [batchStatus, setBatchStatus] = useState<BatchStatus>('idle')
  const [batchPhase, setBatchPhase] = useState('')

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

    setLoading('解析视频中...')
    try {
      const res = await fetch(`${BASE}/api/parse-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareText: shareText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '解析失败')
      const info: VideoInfo = data
      setVideoInfo(info)
      setLoading('')
      await startTranscribe(info.playUrl)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '解析失败')
      setLoading('')
    }
  }

  async function startTranscribe(playUrl: string) {
    setAsrStatus('uploading')
    try {
      const res = await fetch(`${BASE}/api/transcribe/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '上传失败')
      const id: string = data.taskId
      setAsrStatus('processing')
      startAsrPoll(id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '上传失败')
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
          setTranscript(data.text || '')
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
    if (viewMode === 'mindmap') {
      setViewMode('subtitle')
      return
    }
    if (mindmap) {
      setViewMode('mindmap')
      return
    }
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
  async function handleBatchImport(file: File, autoDownload: boolean) {
    if (batchPollRef.current) clearInterval(batchPollRef.current)
    setBatchJobId('')
    setBatchStatus('idle')
    setBatchPhase('')
    setBatchSuccess(0)
    setBatchFailed(0)
    setBatchTotal(0)
    setError('')

    const formData = new FormData()
    formData.append('file', file)

    setLoading('上传 Excel 中...')
    try {
      const res = await fetch(`${BASE}/api/batch/import`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '上传失败')
      const { jobId, total } = data as { jobId: string; total: number }
      setBatchJobId(jobId)
      setBatchTotal(total)
      setBatchStatus('processing')
      setLoading('')
      startBatchPoll(jobId, autoDownload)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '批量导入失败')
      setLoading('')
    }
  }

  function startBatchPoll(jobId: string, autoDownload: boolean) {
    if (batchPollRef.current) clearInterval(batchPollRef.current)
    batchPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${BASE}/api/batch/status?jobId=${encodeURIComponent(jobId)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '查询失败')
        setBatchSuccess(data.success || 0)
        setBatchFailed(data.failed || 0)
        setBatchPhase(data.phase || '')
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(batchPollRef.current!)
          batchPollRef.current = null
          setBatchStatus(data.status as BatchStatus)
          if (data.status === 'completed' && autoDownload) {
            triggerDownload(jobId)
          }
        }
      } catch (e: unknown) {
        clearInterval(batchPollRef.current!)
        batchPollRef.current = null
        setError(e instanceof Error ? e.message : '批量状态查询失败')
      }
    }, 5000)
  }

  function triggerDownload(jobId: string) {
    const a = document.createElement('a')
    a.href = `${BASE}/api/batch/export?jobId=${encodeURIComponent(jobId)}`
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const batchBusy = batchStatus === 'processing' || !!loading

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">字幕提取工具</h1>
        <p className="text-base text-gray-500 mt-1">粘贴抖音分享链接，自动提取视频字幕</p>
      </header>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-base flex items-center justify-between">
          <span>{error}</span>
          <button className="ml-4 underline shrink-0" onClick={() => setError('')}>关闭</button>
        </div>
      )}

      <main className="flex gap-6 p-6 max-w-7xl mx-auto h-[calc(100vh-80px)]">

        {/* Left panel */}
        <div className="w-80 shrink-0 space-y-4 overflow-y-auto">

          {/* Share text input */}
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <label className="block text-base font-medium text-gray-700">抖音分享文案 / 链接</label>
            <textarea
              className="w-full border rounded-lg p-3 text-base h-36 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder={"粘贴抖音分享文案或链接\n例如：4.82 z@t.Rk CXD:/ ...\nhttps://v.douyin.com/xxx/"}
              value={shareText}
              onChange={e => setShareText(e.target.value)}
            />
            <button
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-base font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              onClick={handleExtract}
              disabled={!shareText.trim() || !!loading}
            >
              {loading ? loading : '提取视频内容'}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-sm text-gray-400 whitespace-nowrap">Excel 批量导入</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          {/* Batch import */}
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <p className="text-sm text-gray-500">A 列为抖音链接，首行标题自动跳过，最多 200 条</p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleBatchImport(file, false)
                e.target.value = ''
              }}
            />
            <input
              ref={fileInputAutoRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleBatchImport(file, true)
                e.target.value = ''
              }}
            />

            <button
              className="w-full border-2 border-dashed border-gray-300 text-gray-600 py-2.5 rounded-lg text-base hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              disabled={batchBusy}
            >
              上传 Excel
            </button>
            <button
              className="w-full bg-green-600 text-white py-2.5 rounded-lg text-base font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              onClick={() => fileInputAutoRef.current?.click()}
              disabled={batchBusy}
            >
              上传并直接下载结果 Excel
            </button>

            {/* Batch progress */}
            {batchStatus !== 'idle' && (
              <div className="space-y-2 pt-3 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{batchPhase || '处理中...'}</span>
                  <span className="text-gray-500 tabular-nums">
                    {batchSuccess + batchFailed}/{batchTotal}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${batchStatus === 'completed' ? 'bg-green-500' : batchStatus === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: batchTotal > 0 ? `${Math.round((batchSuccess + batchFailed) / batchTotal * 100)}%` : '0%' }}
                  />
                </div>
                {batchStatus === 'processing' && (
                  <p className="text-xs text-gray-400">每 5 秒自动刷新进度</p>
                )}
                {batchFailed > 0 && (
                  <p className="text-sm text-red-500">{batchFailed} 条失败</p>
                )}
                {batchStatus === 'completed' && (
                  <>
                    <p className="text-sm text-green-600">全部处理完成，共成功 {batchSuccess} 条</p>
                    <button
                      className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                      onClick={() => triggerDownload(batchJobId)}
                    >
                      下载结果 Excel
                    </button>
                  </>
                )}
                {batchStatus === 'failed' && (
                  <p className="text-sm text-red-600">任务失败，请重试</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {!videoInfo ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
                <p className="text-base">粘贴抖音链接，点击「提取视频内容」</p>
                <p className="text-sm mt-1">结果将显示在这里</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">

              {/* Video info card */}
              <div className="bg-white rounded-lg border p-4 flex gap-4 items-start">
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                  <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 text-base leading-snug">{videoInfo.title}</p>
                  <p className="text-sm text-gray-500 mt-1.5">
                    点赞{' '}
                    <span className="font-medium text-gray-700">
                      {videoInfo.diggCount >= 10000
                        ? `${(videoInfo.diggCount / 10000).toFixed(1)} 万`
                        : videoInfo.diggCount.toLocaleString()}
                    </span>
                  </p>
                  {videoInfo.isSubtitled === 1 && (
                    <span className="inline-block mt-1.5 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">有平台字幕</span>
                  )}
                </div>
              </div>

              {/* ASR status */}
              {asrStatus === 'uploading' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 text-blue-700 text-base">
                  <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  正在上传视频到转写服务...
                </div>
              )}

              {asrStatus === 'processing' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 text-blue-700 text-base">
                  <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  转写中，请稍候...（每 3 秒自动更新）
                </div>
              )}

              {asrStatus === 'done' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-base">
                  转写完成
                </div>
              )}

              {asrStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-base">
                  转写失败，请重试
                </div>
              )}

              {/* Subtitle / mindmap area */}
              {asrStatus === 'done' && (
                <div className="bg-white rounded-lg border">
                  <div className="px-4 py-3 border-b flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      {viewMode === 'subtitle' ? '字幕文案' : '思维导图'}
                    </span>
                    <div className="flex items-center gap-2">
                      {viewMode === 'subtitle' && transcript && (
                        <button
                          className="text-sm text-gray-500 border rounded-lg px-3 py-1 hover:bg-gray-50 transition-colors"
                          onClick={handleCopy}
                        >
                          复制
                        </button>
                      )}
                      {transcript && (
                        <button
                          className="text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-1 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                          onClick={handleToggleMindmap}
                          disabled={mindmapLoading}
                        >
                          {mindmapLoading ? '生成中...' : viewMode === 'subtitle' ? '切换导图' : '切换文案'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-4 max-h-[calc(100vh-400px)] overflow-y-auto">
                    {!transcript && (
                      <p className="text-gray-400 text-base text-center py-8">暂无字幕文本</p>
                    )}

                    {transcript && viewMode === 'subtitle' && (
                      <pre className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap font-sans">{transcript}</pre>
                    )}

                    {viewMode === 'mindmap' && mindmap && (
                      <div className="space-y-4">
                        <div>
                          <h2 className="text-lg font-bold text-gray-900">{mindmap.rootTitle}</h2>
                          <p className="text-sm text-gray-500 mt-1">{mindmap.summary}</p>
                        </div>
                        <div className="space-y-3">
                          {mindmap.branches.map((branch, i) => (
                            <div key={i}>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="w-2.5 h-2.5 bg-blue-500 rounded-full shrink-0" />
                                <span className="font-medium text-gray-800 text-base">{branch.title}</span>
                              </div>
                              <div className="ml-5 space-y-1">
                                {branch.children.map((child, j) => (
                                  <div key={j} className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full shrink-0 mt-2" />
                                    <span className="text-sm text-gray-600">{child}</span>
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
              )}

            </div>
          )}
        </div>
      </main>
    </div>
  )
}
