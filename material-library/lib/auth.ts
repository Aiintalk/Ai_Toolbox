import { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-change-me-in-production-please-please'
)

export type SessionPayload = {
  uid: number
  username: string
  role: 'admin' | 'employee' | 'kol'
}

export const COOKIE_NAME = 'auth_token'

export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, SECRET)
    if (
      typeof payload.uid === 'number' &&
      typeof payload.username === 'string' &&
      (payload.role === 'admin' || payload.role === 'employee' || payload.role === 'kol')
    ) {
      return { uid: payload.uid, username: payload.username, role: payload.role }
    }
    return null
  } catch {
    return null
  }
}

export function canSeeAll(session: SessionPayload | null): boolean {
  return session?.role === 'admin' || session?.role === 'employee'
}

/**
 * 判断当前 session 是否有权访问 / 修改指定 persona。
 * - admin / employee：可访问所有
 * - kol：只能访问与自己 username 同名的 persona
 */
export function canAccessPersona(session: SessionPayload | null, personaName: string): boolean {
  if (!session) return false
  if (canSeeAll(session)) return true
  return session.username === personaName
}
