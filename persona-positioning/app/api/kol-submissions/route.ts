import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

// Read kol-intake submissions directly from its data directory
const KOL_DATA_DIR = '/opt/kol-intake/data'

export async function GET() {
  try {
    if (!fs.existsSync(KOL_DATA_DIR)) {
      return NextResponse.json({ submissions: [] })
    }

    const files = fs.readdirSync(KOL_DATA_DIR).filter(f => f.endsWith('.json'))
    const submissions = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(KOL_DATA_DIR, f), 'utf-8'))
      return {
        id: data.id,
        nickname: data.nickname || data.answers?.nickname || '未填写',
        submittedAt: data.submittedAt,
        answers: data.answers,
        report: data.report || '',
      }
    }).sort((a, b) => {
      // Sort by submission time descending
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    })

    return NextResponse.json({ submissions })
  } catch (err) {
    console.error('kol-submissions error:', err)
    return NextResponse.json({ error: 'Failed to load submissions' }, { status: 500 })
  }
}
