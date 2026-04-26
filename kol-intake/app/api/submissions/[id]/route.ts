import { NextRequest, NextResponse } from 'next/server'
import { getSubmission } from '@/lib/storage'
import { getSession, canSeeAll } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const sub = getSubmission(params.id)
  if (!sub) return NextResponse.json({ error: '未找到' }, { status: 404 })

  // kol 只能看自己的
  if (!canSeeAll(session) && sub.userId !== session.username) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 })
  }

  return NextResponse.json(sub)
}
