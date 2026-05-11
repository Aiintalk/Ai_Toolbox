'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

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

interface ReportListItem {
  id: string
  createdAt: string
  scriptCount: number
  preview: string
}

export default function ReportView() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [report, setReport] = useState<any>(null)
  const [list, setList] = useState<ReportListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        if (id) {
          const res = await fetch(`/persona-review/api/reports?id=${id}`)
          if (!res.ok) throw new Error('报告不存在')
          setReport(await res.json())
        } else {
          const res = await fetch('/persona-review/api/reports')
          if (!res.ok) throw new Error('加载失败')
          const data = await res.json()
          setList(data.reports || [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8 text-gray-400">加载中...</div>
  if (error) return <div className="max-w-4xl mx-auto px-4 py-8 text-red-500">{error}</div>

  // Single report view
  if (id && report) {
    const date = new Date(report.createdAt).toLocaleString('zh-CN')
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <a href="/persona-review/report" className="text-sm text-orange-500 hover:text-orange-600">← 所有报告</a>
          <a href="/persona-review/" className="text-sm text-gray-400 hover:text-gray-600">回到首页</a>
        </div>
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">复盘报告</h1>
          <p className="text-sm text-gray-400 mt-1">{date} · {report.scripts?.length || 0} 条脚本</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
            <SimpleMarkdown text={report.report} />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => { navigator.clipboard.writeText(report.report); alert('已复制') }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            复制报告
          </button>
        </div>
      </div>
    )
  }

  // Report list view
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">历史复盘报告</h1>
        <a href="/persona-review/" className="text-sm text-orange-500 hover:text-orange-600">← 回到首页</a>
      </div>
      {list.length === 0 ? (
        <div className="text-gray-400 text-center py-12">暂无保存的报告</div>
      ) : (
        <div className="space-y-3">
          {list.map(item => (
            <a
              key={item.id}
              href={`/persona-review/report?id=${item.id}`}
              className="block bg-white rounded-xl shadow-sm border p-5 hover:border-orange-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                </span>
                <span className="text-xs text-gray-400">{item.scriptCount} 条脚本</span>
              </div>
              <div className="text-sm text-gray-700 line-clamp-2">{item.preview}...</div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
