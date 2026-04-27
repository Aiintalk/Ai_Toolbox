import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getSession, canSeeAll } from '@ai-toolbox/auth-shared'

export const dynamic = 'force-dynamic'

// Read kol-intake submissions directly from its data directory
const KOL_DATA_DIR = '/opt/kol-intake/data'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    if (!fs.existsSync(KOL_DATA_DIR)) {
      return NextResponse.json({ submissions: [] })
    }

    const files = fs.readdirSync(KOL_DATA_DIR).filter(f => f.endsWith('.json'))
    let submissions = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(KOL_DATA_DIR, f), 'utf-8'))
      return {
        id: data.id,
        userId: data.userId,
        nickname: data.nickname || data.answers?.nickname || '未填写',
        submittedAt: data.submittedAt,
        answers: data.answers,
        report: data.report || '',
      }
    })

    // KOL 只看自己的；员工/管理员看全部
    if (!canSeeAll(session)) {
      submissions = submissions.filter(s => s.userId === session.username)
    }

    submissions.sort((a, b) => {
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    })

    return NextResponse.json({ submissions })
  } catch (err) {
    console.error('kol-submissions error:', err)
    return NextResponse.json({ error: 'Failed to load submissions' }, { status: 500 })
  }
}
