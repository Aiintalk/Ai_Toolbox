/**
 * 初始化数据库：建表 + 种子初始用户
 *   - admin（默认 admin / admin123，可用环境变量覆盖）
 *   - darenshuo / darenshuo123（员工，测试账号）
 *
 * 用法：npm run init-db
 */
import { getDb, ensureSchema, type UserRow } from '../lib/db'
import { hashPassword } from '../lib/password'

async function upsert(username: string, password: string, role: 'admin' | 'employee' | 'kol') {
  const db = getDb()
  const existing = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(username) as UserRow | undefined

  if (existing) {
    console.log(`  ⏭  ${username}（${role}）已存在，跳过`)
    return
  }

  const hash = await hashPassword(password)
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(
    username,
    hash,
    role
  )
  console.log(`  ✅ ${username}（${role}）已创建`)
}

async function main() {
  console.log('▶ 初始化 auth-service 数据库…')
  ensureSchema()
  console.log('  ✅ 用户表已就绪')

  const adminUser = process.env.ADMIN_USERNAME || 'admin'
  const adminPwd = process.env.ADMIN_PASSWORD || 'admin123'
  if (adminPwd === 'admin123') {
    console.log('  ⚠️  使用默认 admin 密码 admin123，生产环境务必通过 ADMIN_PASSWORD 环境变量覆盖')
  }

  await upsert(adminUser, adminPwd, 'admin')
  await upsert('darenshuo', 'darenshuo123', 'employee')

  console.log('▶ 完成')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
