import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { extractText } from 'unpdf';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '请选择文件' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();
    let text = '';

    if (name.endsWith('.pdf')) {
      try {
        const { text: pdfText } = await extractText(new Uint8Array(buffer));
        text = Array.isArray(pdfText) ? pdfText.join('\n') : (pdfText || '');
      } catch {
        return NextResponse.json({ error: 'PDF 解析失败，请尝试手动粘贴内容' }, { status: 400 });
      }
    } else if (name.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      // .txt, .md, etc.
      text = buffer.toString('utf-8');
    }

    if (!text.trim()) {
      return NextResponse.json({ error: '未能从文件中提取到文字内容' }, { status: 400 });
    }

    // Truncate to prevent token overflow
    const truncated = text.slice(0, 8000);

    return NextResponse.json({ text: truncated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'parse failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
