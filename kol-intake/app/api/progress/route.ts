import { NextRequest, NextResponse } from 'next/server'
import { getSubmissionByUser } from '@/lib/storage'
import { getSession } from '@/lib/auth'
import { questions } from '@/lib/questions'

export const dynamic = 'force-dynamic'

/**
 * 返回当前 kol 的填写进度。
 * 规则：所有 required 题目都答了 → 100%（completed=true），否则 0%。
 * 答案内容判定：非空字符串视为已答。
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const sub = getSubmissionByUser(session.username)
  const requiredIds = questions.filter(q => q.required).map(q => q.id)

  if (!sub) {
    return NextResponse.json({
      completed: false,
      percent: 0,
      submittedAt: null,
    })
  }

  const allAnswered = requiredIds.every(id => {
    const v = sub.answers[id]
    return typeof v === 'string' && v.trim().length > 0
  })

  return NextResponse.json({
    completed: allAnswered,
    percent: allAnswered ? 100 : 0,
    submittedAt: sub.submittedAt,
  })
}
