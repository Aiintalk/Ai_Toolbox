import { SignJWT, jwtVerify, JWTPayload } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-change-me-in-production-please-please'
)

const TTL_HOURS = parseInt(process.env.JWT_TTL_HOURS || '168', 10)

export type SessionPayload = {
  uid: number
  username: string
  role: 'admin' | 'employee' | 'kol'
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return await new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TTL_HOURS}h`)
    .sign(SECRET)
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
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

export const COOKIE_NAME = 'auth_token'
export const COOKIE_MAX_AGE_SEC = TTL_HOURS * 3600
