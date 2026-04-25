import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * 给 nginx auth_request 调用。
 * 校验通过：返回 200 + X-User-* headers
 * 校验失败：返回 401
 */
export async function GET() {
  const session = await getSession()
  if (!session) {
    return new NextResponse(null, { status: 401 })
  }
  const res = new NextResponse(null, { status: 200 })
  res.headers.set('X-User-Id', String(session.uid))
  res.headers.set('X-User-Name', session.username)
  res.headers.set('X-User-Role', session.role)
  return res
}
