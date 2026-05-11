import { NextRequest } from 'next/server';
import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } from 'docx';

export const runtime = 'nodejs';

function parseInlineRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index) }));
    }
    runs.push(new TextRun({ text: match[1], bold: true }));
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex) }));
  }
  if (runs.length === 0) {
    runs.push(new TextRun({ text: '' }));
  }
  return runs;
}

function markdownToParagraphs(md: string): Paragraph[] {
  const lines = md.split('\n');
  const paragraphs: Paragraph[] = [];
  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed === '') { paragraphs.push(new Paragraph({ children: [] })); continue; }
    if (trimmed.startsWith('# ')) { paragraphs.push(new Paragraph({ text: trimmed.slice(2), heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } })); continue; }
    if (trimmed.startsWith('## ')) { paragraphs.push(new Paragraph({ text: trimmed.slice(3), heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } })); continue; }
    if (trimmed.startsWith('### ')) { paragraphs.push(new Paragraph({ text: trimmed.slice(4), heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 } })); continue; }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) { paragraphs.push(new Paragraph({ children: parseInlineRuns(trimmed.slice(2)), bullet: { level: 0 } })); continue; }
    paragraphs.push(new Paragraph({ children: parseInlineRuns(trimmed) }));
  }
  return paragraphs;
}

export async function POST(req: NextRequest) {
  try {
    const { personaName, topic, content } = await req.json();
    if (!content) {
      return new Response(JSON.stringify({ error: 'Script content is empty' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const name = personaName || 'Creator';
    const title = `${name} · TikTok Script`;

    const children: Paragraph[] = [
      new Paragraph({ text: title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
      new Paragraph({ text: `Topic: ${topic || 'N/A'}`, alignment: AlignmentType.CENTER, spacing: { after: 120 } }),
      new Paragraph({ text: `Exported: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
      ...markdownToParagraphs(content),
    ];

    const doc = new Document({
      creator: 'TikTok Content Writer',
      title,
      styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(doc);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = encodeURIComponent(`TikTok_Script_${name}_${dateStr}.docx`);

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'export failed';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
