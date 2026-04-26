'use client'
import { useState, useEffect } from 'react'
import { questions } from '@/lib/questions'

interface SubSummary {
  id: string
  nickname: string
  submittedAt: string
  answerCount: number
}

interface SubDetail {
  id: string
  nickname: string
  submittedAt: string
  answers: Record<string, string>
  report?: string
}

export default function AdminPage() {
  const [subs, setSubs] = useState<SubSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<SubDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'answers' | 'report'>('answers')

  const fetchList = async () => {
    setLoading(true)
    try {
      const res = await fetch('/kol-intake/api/submissions')
      if (res.status === 401) {
        window.location.href = '/auth/login?next=' + encodeURIComponent(location.pathname)
        return
      }
      setSubs(await res.json())
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchList() }, [])

  const viewDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/kol-intake/api/submissions/${id}`)
      if (res.ok) setDetail(await res.json())
    } catch {}
    setDetailLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">红人信息采集 · 管理后台</h1>
          <p className="text-xs text-gray-400 mt-1">查看红人提交的信息，下载文档</p>
        </div>
        <button onClick={fetchList} className="text-sm text-purple-600 hover:text-purple-800 transition">刷新</button>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {detail ? (
          <div>
            <button onClick={() => { setDetail(null); setActiveTab('answers') }} className="text-sm text-purple-600 mb-4 hover:underline">← 返回列表</button>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">{detail.nickname}</h2>
                  <p className="text-sm text-gray-400 mt-1">提交时间：{detail.submittedAt}</p>
                </div>
                <a href={`/kol-intake/api/download/${detail.id}`}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition">
                  下载文档 📄
                </a>
              </div>
              {/* Tab 切换 */}
              <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
                <button onClick={() => setActiveTab('answers')}
                  className={`flex-1 py-2 text-sm rounded-md transition ${activeTab === 'answers' ? 'bg-white font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  填写内容
                </button>
                <button onClick={() => setActiveTab('report')}
                  className={`flex-1 py-2 text-sm rounded-md transition ${activeTab === 'report' ? 'bg-white font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  分析报告
                </button>
              </div>
              {/* Tab 内容 */}
              {activeTab === 'answers' && (
              <div className="space-y-4">
                {questions.map(q => {
                  const ans = detail.answers[q.id]
                  if (!ans && !q.required) return null
                  return (
                    <div key={q.id} className="border-b border-gray-100 pb-3">
                      <div className="text-sm font-medium text-gray-600">{q.question}</div>
                      <div className="text-sm mt-1 whitespace-pre-wrap">{ans || <span className="text-gray-300">未填写</span>}</div>
                    </div>
                  )
                })}
              </div>
              )}
              {activeTab === 'report' && (
                <div className="prose prose-sm max-w-none">
                  {detail.report ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{detail.report}</div>
                  ) : (
                    <div className="text-gray-400 text-center py-10">暂无报告</div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {loading ? (
              <div className="text-center text-gray-400 py-20">加载中...</div>
            ) : subs.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-4xl mb-4">📋</div>
                <div className="text-gray-400">暂无提交记录</div>
                <div className="text-xs text-gray-300 mt-2">将采集链接发给红人后，提交的信息会显示在这里</div>
              </div>
            ) : (
              <div className="space-y-3">
                {subs.map(s => (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm transition cursor-pointer"
                    onClick={() => viewDetail(s.id)}>
                    <div>
                      <div className="font-medium">{s.nickname}</div>
                      <div className="text-xs text-gray-400 mt-1">{s.submittedAt} · 填写了 {s.answerCount} 题</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <a href={`/kol-intake/api/download/${s.id}`} onClick={e => e.stopPropagation()}
                        className="px-3 py-1.5 bg-purple-50 text-purple-600 text-xs rounded-lg hover:bg-purple-100 transition">
                        下载
                      </a>
                      <span className="text-gray-300">→</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
