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

// PATCH /api/admin/users/[id] —— 改密码或角色
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
  }

  const id = parseInt(params.id, 10)
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: '无效的用户 ID' }, { status: 400 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求体解析失败' }, { status: 400 })
  }

  ensureSchema()
  const db = getDb()
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!row) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 })
  }

  const updates: string[] = []
  const values: any[] = []

  if (body.password) {
    const pwd = String(body.password)
    if (pwd.length < 6) {
      return NextResponse.json({ error: '密码长度至少 6 位' }, { status: 400 })
    }
    updates.push('password = ?')
    values.push(await hashPassword(pwd))
  }

  if (body.role) {
    if (!['admin', 'employee', 'kol'].includes(body.role)) {
      return NextResponse.json({ error: 'role 必须是 admin / employee / kol' }, { status: 400 })
    }
    updates.push('role = ?')
    values.push(body.role)
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 })
  }

  values.push(id)
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow
  return NextResponse.json({ user: toPublic(updated) })
}

// DELETE /api/admin/users/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
  }

  const id = parseInt(params.id, 10)
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: '无效的用户 ID' }, { status: 400 })
  }

  // 不允许删除自己（避免锁死管理员）
  if (id === session.uid) {
    return NextResponse.json({ error: '不能删除当前登录的账号' }, { status: 400 })
  }

  ensureSchema()
  const info = getDb().prepare('DELETE FROM users WHERE id = ?').run(id)
  if (info.changes === 0) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
