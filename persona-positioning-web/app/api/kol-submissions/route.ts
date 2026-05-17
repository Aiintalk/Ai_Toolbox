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
      // Use nickname as display name (stable identity), show douyin_name in answers
      let displayName = data.nickname || data.answers?.douyin_name || data.answers?.nickname || '未填写'
      if (displayName.length > 12) displayName = displayName.slice(0, 12) + '…'
      return {
        id: data.id,
        nickname: displayName,
        submittedAt: data.submittedAt,
        answers: data.answers,
        report: data.report || '',
      }
    }).sort((a, b) => {
      // Sort by submission time descending
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    })

    // Deduplicate: same nickname only keep the latest (already sorted newest first)
    const seen = new Set<string>()
    const deduped = submissions.filter(s => {
      if (seen.has(s.nickname)) return false
      seen.add(s.nickname)
      return true
    })

    return NextResponse.json({ submissions: deduped })
  } catch (err) {
    console.error('kol-submissions error:', err)
    return NextResponse.json({ error: 'Failed to load submissions' }, { status: 500 })
  }
}
