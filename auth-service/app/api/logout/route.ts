import { NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    domain: process.env.COOKIE_DOMAIN || undefined,
  })
  return res
}
