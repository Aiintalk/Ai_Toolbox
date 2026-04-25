import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema, type UserRow } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { signSession, COOKIE_NAME, COOKIE_MAX_AGE_SEC } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求体解析失败' }, { status: 400 })
  }

  const username = String(body?.username || '').trim()
  const password = String(body?.password || '')

  if (!username || !password) {
    return NextResponse.json({ error: '用户名和密码必填' }, { status: 400 })
  }

  ensureSchema()
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(username) as UserRow | undefined

  if (!row) {
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
  }

  const ok = await verifyPassword(password, row.password)
  if (!ok) {
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
  }

  const token = await signSession({ uid: row.id, username: row.username, role: row.role })

  // 登录成功后端给出建议跳转地址
  const redirect =
    row.role === 'admin'
      ? '/auth/admin'
      : row.role === 'employee'
      ? '/portal/'
      : '/kol-portal/'

  const res = NextResponse.json({
    ok: true,
    user: { id: row.id, username: row.username, role: row.role },
    redirect,
  })

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SEC,
    secure: process.env.NODE_ENV === 'production',
    domain: process.env.COOKIE_DOMAIN || undefined,
  })

  return res
}
