import { NextRequest, NextResponse } from 'next/server'
import { getSubmission } from '@/lib/storage'
import { generateDocx } from '@/lib/docgen'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sub = getSubmission(params.id)
  if (!sub) return NextResponse.json({ error: '未找到' }, { status: 404 })

  try {
    const buf = await generateDocx(sub)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(sub.nickname)}_信息采集表.docx"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: '生成文档失败' }, { status: 500 })
  }
}
