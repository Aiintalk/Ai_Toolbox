import { NextResponse } from "next/server";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: '请选择文件' }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';

    if (name.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value.trim();
    } else if (name.endsWith('.pdf')) {
      const pdfData = await pdfParse(buffer);
      text = pdfData.text.trim();
    } else if (name.endsWith('.txt') || name.endsWith('.md')) {
      text = (await file.text()).trim();
    } else {
      return NextResponse.json({ error: '支持 .docx / .pdf / .txt 文件' }, { status: 400 });
    }

    const title = file.name.replace(/\.(docx|pdf|txt|md)$/i, '');

    return NextResponse.json({ text, title });
  } catch (err) {
    console.error("upload error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "解析失败" }, { status: 500 });
  }
}
