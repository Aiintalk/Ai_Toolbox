import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// 单例：避免热重载时重复打开
let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db

  const dataDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const dbPath = path.join(dataDir, 'users.db')
  _db = new Database(dbPath)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')

  return _db
}

export function ensureSchema() {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL CHECK (role IN ('admin', 'employee', 'kol')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
}

export type UserRow = {
  id: number
  username: string
  password: string
  role: 'admin' | 'employee' | 'kol'
  created_at: string
}

export type PublicUser = Omit<UserRow, 'password'>

export function toPublic(u: UserRow): PublicUser {
  const { password, ...rest } = u
  return rest
}
