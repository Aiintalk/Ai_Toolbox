import { Suspense } from 'react'
import ReportView from './ReportView'

export const metadata = { title: '复盘报告' }
export const dynamic = 'force-dynamic'

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-8 text-gray-400">加载中...</div>}>
      <ReportView />
    </Suspense>
  )
}
