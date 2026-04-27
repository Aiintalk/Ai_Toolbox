import { NextRequest, NextResponse } from 'next/server'
import { listSubmissions } from '@/lib/storage'
import { getSession, canSeeAll } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  let subs = listSubmissions()
  if (!canSeeAll(session)) {
    // kol 只能看自己的
    subs = subs.filter(s => s.userId === session.username)
  }

  return NextResponse.json(subs.map(s => ({
    id: s.id,
    userId: s.userId,
    nickname: s.nickname,
    submittedAt: s.submittedAt,
    answerCount: Object.keys(s.answers).length,
  })))
}
