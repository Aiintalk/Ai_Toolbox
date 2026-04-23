import { NextRequest, NextResponse } from 'next/server'
import { getSubmission } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sub = getSubmission(params.id)
  if (!sub) return NextResponse.json({ error: '未找到' }, { status: 404 })
  return NextResponse.json(sub)
}
