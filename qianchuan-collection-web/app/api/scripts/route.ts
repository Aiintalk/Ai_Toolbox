import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

interface ScriptItem {
  id: string;
  title: string;
  likes?: number;
  source?: string;
  sourceAccount?: string;
  date: string;
  content: string;
  persona?: string;
  pool: 'global' | 'persona';
}

function parseScript(filename: string, raw: string, pool: 'global' | 'persona', persona?: string): ScriptItem {
  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    return { id: filename, title: filename.replace('.md', ''), date: '', content: raw, pool, persona };
  }

  const meta = frontmatterMatch[1];
  const content = frontmatterMatch[2].trim();

  const getField = (field: string) => {
    const m = meta.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
    return m?.[1]?.trim();
  };

  return {
    id: filename,
    title: getField('title') || filename.replace('.md', ''),
    likes: getField('likes') ? Number(getField('likes')) : undefined,
    source: getField('source'),
    sourceAccount: getField('source_account'),
    date: getField('date') || '',
    content,
    pool,
    persona,
  };
}

function globalScriptsDir() {
  return path.join(process.cwd(), "data", "global", "scripts");
}

function personaScriptsDir(persona: string) {
  return path.join(process.cwd(), "data", "personas", persona, "scripts");
}

function readScriptsFromDir(dir: string, pool: 'global' | 'persona', persona?: string): ScriptItem[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
    return parseScript(f, raw, pool, persona);
  });
}

// GET
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pool = searchParams.get('pool'); // 'global' | 'persona' | null (all)
    const persona = searchParams.get('persona');

    let scripts: ScriptItem[] = [];

    if (pool === 'global' || !pool) {
      scripts.push(...readScriptsFromDir(globalScriptsDir(), 'global'));
    }

    if (pool === 'persona' || !pool) {
      if (persona) {
        scripts.push(...readScriptsFromDir(personaScriptsDir(persona), 'persona', persona));
      } else if (!pool || pool !== 'persona') {
        // All personas
        const personasDir = path.join(process.cwd(), "data", "personas");
        if (fs.existsSync(personasDir)) {
          for (const entry of fs.readdirSync(personasDir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            scripts.push(...readScriptsFromDir(personaScriptsDir(entry.name), 'persona', entry.name));
          }
        }
      }
    }

    scripts.sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
    return NextResponse.json({ scripts });
  } catch (err) {
    console.error("scripts GET error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}

// POST
export async function POST(request: Request) {
  try {
    const { pool, persona, title, likes, source, sourceAccount, content } = await request.json();
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: '标题和内容为必填' }, { status: 400 });
    }
    if (pool === 'persona' && !persona) {
      return NextResponse.json({ error: '请选择达人' }, { status: 400 });
    }

    const dir = pool === 'global' ? globalScriptsDir() : personaScriptsDir(persona);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timestamp = now.getTime();
    const safeTitle = title.trim().replace(/[\/\\:*?"<>|]/g, '_').slice(0, 50);
    const filename = `${timestamp}-${safeTitle}.md`;

    let frontmatter = `---\ntitle: ${title.trim()}\ndate: ${dateStr}\n`;
    if (likes) frontmatter += `likes: ${likes}\n`;
    if (source) frontmatter += `source: ${source}\n`;
    if (sourceAccount) frontmatter += `source_account: ${sourceAccount}\n`;
    frontmatter += `---\n`;

    fs.writeFileSync(path.join(dir, filename), frontmatter + content.trim(), 'utf-8');

    return NextResponse.json({ ok: true, id: filename });
  } catch (err) {
    console.error("scripts POST error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}

// DELETE
export async function DELETE(request: Request) {
  try {
    const { pool, persona, id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing script id' }, { status: 400 });
    }

    const dir = pool === 'global' ? globalScriptsDir() : personaScriptsDir(persona);
    const filePath = path.join(dir, id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("scripts DELETE error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
