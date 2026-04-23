import { NextResponse } from 'next/server'
import { listSubmissions } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET() {
  const subs = listSubmissions()
  return NextResponse.json(subs.map(s => ({
    id: s.id,
    nickname: s.nickname,
    submittedAt: s.submittedAt,
    answerCount: Object.keys(s.answers).length,
  })))
}
