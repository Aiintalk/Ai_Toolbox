/**
 * CLI：新增用户
 * 用法：npm run user:add -- <username> <password> <role>
 *   role: admin | employee | kol
 */
import { getDb, ensureSchema, type UserRow } from '../lib/db'
import { hashPassword } from '../lib/password'

async function main() {
  const [, , username, password, role] = process.argv

  if (!username || !password || !role) {
    console.error('用法：npm run user:add -- <username> <password> <role>')
    console.error('  role 可选：admin | employee | kol')
    process.exit(1)
  }

  if (!['admin', 'employee', 'kol'].includes(role)) {
    console.error(`无效的 role：${role}（可选 admin / employee / kol）`)
    process.exit(1)
  }

  if (password.length < 6) {
    console.error('密码长度至少 6 位')
    process.exit(1)
  }

  ensureSchema()
  const db = getDb()
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) {
    console.error(`用户名 ${username} 已存在`)
    process.exit(1)
  }

  const hash = await hashPassword(password)
  const info = db
    .prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
    .run(username, hash, role)
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as UserRow
  console.log(`✅ 已创建：id=${row.id}  ${row.username}（${row.role}）`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
