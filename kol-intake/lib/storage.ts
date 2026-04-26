import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

export interface Submission {
  id: string
  userId?: string         // 提交人的 username（kol 隔离用）
  nickname: string
  submittedAt: string
  answers: Record<string, string>
  report?: string
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function saveSubmission(data: Submission) {
  ensureDataDir()
  fs.writeFileSync(path.join(DATA_DIR, `${data.id}.json`), JSON.stringify(data, null, 2))
}

export function listSubmissions(): Submission[] {
  ensureDataDir()
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
  return files
    .map(f => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8')) as Submission)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
}

export function getSubmission(id: string): Submission | null {
  const fp = path.join(DATA_DIR, `${id}.json`)
  if (!fs.existsSync(fp)) return null
  return JSON.parse(fs.readFileSync(fp, 'utf-8'))
}

/**
 * 按 userId 查询该用户已提交的记录（一人一份）。
 * 找不到返回 null。
 */
export function getSubmissionByUser(userId: string): Submission | null {
  const all = listSubmissions()
  return all.find(s => s.userId === userId) || null
}
