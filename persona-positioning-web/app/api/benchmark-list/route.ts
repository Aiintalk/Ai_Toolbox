import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const BENCHMARK_DATA_DIR = '/opt/benchmark-analyzer/data'

export async function GET() {
  try {
    if (!fs.existsSync(BENCHMARK_DATA_DIR)) {
      return NextResponse.json({ items: [] })
    }
    const files = fs.readdirSync(BENCHMARK_DATA_DIR).filter(f => f.endsWith('.json'))
    const items = files.map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(BENCHMARK_DATA_DIR, f), 'utf-8'))
        return {
          id: data.id,
          createdAt: data.createdAt,
          nickname: data.nickname || '未命名',
          profileResult: data.profileResult || '',
          planResult: data.planResult || '',
        }
      } catch {
        return null
      }
    }).filter(Boolean) as Array<{ id: string; createdAt: number; nickname: string; profileResult: string; planResult: string }>

    // Sort by createdAt desc
    items.sort((a, b) => b.createdAt - a.createdAt)

    // Deduplicate by nickname (keep latest)
    const seen = new Set<string>()
    const deduped = items.filter(it => {
      if (seen.has(it.nickname)) return false
      seen.add(it.nickname)
      return true
    })

    return NextResponse.json({ items: deduped })
  } catch (err) {
    console.error('benchmark-list error:', err)
    return NextResponse.json({ error: 'Failed to load benchmark list' }, { status: 500 })
  }
}
