import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import type { SessionPayload, Role } from './auth'
import { COOKIE_NAME } from './auth'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-change-me-in-production-please-please'
)

/**
 * Server Component / Server Action 场景：从 next/headers 的 cookies() 解析 session。
 * Route Handler 与 Middleware 仍使用 ./auth 中的 getSession(req)。
 */
export async function getServerSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, SECRET)
    if (
      typeof payload.uid === 'number' &&
      typeof payload.username === 'string' &&
      (payload.role === 'admin' || payload.role === 'employee' || payload.role === 'kol')
    ) {
      return {
        uid: payload.uid,
        username: payload.username,
        role: payload.role as Role,
      }
    }
    return null
  } catch {
    return null
  }
}
