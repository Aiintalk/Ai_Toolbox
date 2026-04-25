import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import AdminClient from './AdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await getSession()
  if (!session) {
    redirect('/auth/login')
  }
  if (session.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow p-8 text-center">
          <h1 className="text-xl font-semibold text-red-600">无权访问</h1>
          <p className="text-slate-600 mt-2">该页面仅管理员可见。</p>
        </div>
      </div>
    )
  }
  return <AdminClient currentUid={session.uid} currentUsername={session.username} />
}
