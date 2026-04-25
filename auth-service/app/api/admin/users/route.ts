import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getDb, ensureSchema, toPublic, type UserRow } from '@/lib/db'
import { hashPassword } from '@/lib/password'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const s = await getSession()
  if (!s || s.role !== 'admin') return null
  return s
}

// GET /api/admin/users —— 列出全部用户
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
  }
  ensureSchema()
  const rows = getDb()
    .prepare('SELECT * FROM users ORDER BY id ASC')
    .all() as UserRow[]
  return NextResponse.json({ users: rows.map(toPublic) })
}

// POST /api/admin/users —— 新增用户
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求体解析失败' }, { status: 400 })
  }

  const username = String(body?.username || '').trim()
  const password = String(body?.password || '')
  const role = String(body?.role || '')

  if (!username || !password) {
    return NextResponse.json({ error: '用户名和密码必填' }, { status: 400 })
  }
  if (!['admin', 'employee', 'kol'].includes(role)) {
    return NextResponse.json({ error: 'role 必须是 admin / employee / kol' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '密码长度至少 6 位' }, { status: 400 })
  }

  ensureSchema()
  const db = getDb()
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (exists) {
    return NextResponse.json({ error: '用户名已存在' }, { status: 409 })
  }

  const hash = await hashPassword(password)
  const info = db
    .prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
    .run(username, hash, role)

  const row = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(info.lastInsertRowid) as UserRow
  return NextResponse.json({ user: toPublic(row) }, { status: 201 })
}
