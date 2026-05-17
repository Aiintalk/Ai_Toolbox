import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const REPORTS_DIR = '/opt/qianchuan-review/reports'

async function ensureDir() {
  try { await fs.mkdir(REPORTS_DIR, { recursive: true }) } catch {}
}

export async function POST(request: NextRequest) {
  try {
    await ensureDir()
    const body = await request.json()
    const { report, scripts, excelData, createdAt } = body

    if (!report) {
      return NextResponse.json({ error: 'report is required' }, { status: 400 })
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const data = {
      id,
      report,
      scripts: scripts || [],
      excelData: excelData || [],
      createdAt: createdAt || new Date().toISOString(),
    }

    await fs.writeFile(
      path.join(REPORTS_DIR, `${id}.json`),
      JSON.stringify(data, null, 2),
      'utf-8'
    )

    return NextResponse.json({ id })
  } catch (err) {
    console.error('save report error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '保存失败' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureDir()
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (id) {
      const filePath = path.join(REPORTS_DIR, `${id}.json`)
      const content = await fs.readFile(filePath, 'utf-8')
      return NextResponse.json(JSON.parse(content))
    }

    const files = await fs.readdir(REPORTS_DIR)
    const reports = []
    for (const f of files) {
      if (!f.endsWith('.json')) continue
      const content = await fs.readFile(path.join(REPORTS_DIR, f), 'utf-8')
      const data = JSON.parse(content)
      reports.push({
        id: data.id,
        createdAt: data.createdAt,
        scriptCount: data.scripts?.length ?? 0,
        preview: data.report?.slice(0, 100) ?? '',
      })
    }
    reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    return NextResponse.json({ reports })
  } catch (err) {
    if ((err as any)?.code === 'ENOENT') {
      return NextResponse.json({ error: '报告不存在' }, { status: 404 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '读取失败' },
      { status: 500 }
    )
  }
}
