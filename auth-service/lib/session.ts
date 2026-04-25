import { cookies } from 'next/headers'
import { COOKIE_NAME, verifySession, type SessionPayload } from './jwt'

/** 服务端获取当前会话（Server Component / Route Handler 用） */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
}
