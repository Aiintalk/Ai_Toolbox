import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

const KOL_DATA_DIR = '/opt/kol-intake/data';

interface PersonaInfo {
  name: string;
  scriptCount: number;
}

function deletedListPath() {
  return path.join(process.cwd(), "data", "personas", "_deleted.json");
}

function readDeletedList(): string[] {
  try {
    const fp = deletedListPath();
    if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch {}
  return [];
}

function addToDeletedList(name: string) {
  const list = readDeletedList();
  if (!list.includes(name)) list.push(name);
  fs.writeFileSync(deletedListPath(), JSON.stringify(list, null, 2), 'utf-8');
}

export async function GET() {
  try {
    const personasDir = path.join(process.cwd(), "data", "personas");
    if (!fs.existsSync(personasDir)) fs.mkdirSync(personasDir, { recursive: true });

    const deletedNames = new Set(readDeletedList());
    const personas: PersonaInfo[] = [];
    const knownNames = new Set<string>();

    const entries = fs.readdirSync(personasDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (deletedNames.has(entry.name)) continue;

      const scriptsDir = path.join(personasDir, entry.name, "scripts");
      let scriptCount = 0;
      try {
        if (fs.existsSync(scriptsDir)) {
          scriptCount = fs.readdirSync(scriptsDir).filter(f => f.endsWith(".md")).length;
        }
      } catch {}

      personas.push({ name: entry.name, scriptCount });
      knownNames.add(entry.name);
    }

    // Auto-populate from kol-intake
    try {
      if (fs.existsSync(KOL_DATA_DIR)) {
        for (const f of fs.readdirSync(KOL_DATA_DIR).filter(f => f.endsWith('.json'))) {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(KOL_DATA_DIR, f), 'utf-8'));
            const nickname = data.nickname || data.answers?.nickname;
            const douyinName = data.answers?.douyin_name;
            if (!nickname && !douyinName) continue;
            if ((nickname && knownNames.has(nickname)) || (douyinName && knownNames.has(douyinName))) continue;
            const displayName = douyinName || nickname;
            if (!displayName || deletedNames.has(displayName)) continue;
            if (nickname && deletedNames.has(nickname)) continue;
            const newDir = path.join(personasDir, displayName, "scripts");
            fs.mkdirSync(newDir, { recursive: true });
            personas.push({ name: displayName, scriptCount: 0 });
            knownNames.add(displayName);
          } catch {}
        }
      }
    } catch {}

    return NextResponse.json({ personas });
  } catch (err) {
    console.error("personas error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: '请输入达人名称' }, { status: 400 });
    }
    const personaDir = path.join(process.cwd(), "data", "personas", name.trim(), "scripts");
    if (fs.existsSync(path.join(process.cwd(), "data", "personas", name.trim()))) {
      return NextResponse.json({ error: '该达人已存在' }, { status: 409 });
    }
    fs.mkdirSync(personaDir, { recursive: true });

    // Remove from deleted list if previously deleted
    const deleted = readDeletedList();
    const idx = deleted.indexOf(name.trim());
    if (idx !== -1) {
      deleted.splice(idx, 1);
      fs.writeFileSync(deletedListPath(), JSON.stringify(deleted, null, 2), 'utf-8');
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("personas POST error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { persona } = await request.json();
    if (!persona || typeof persona !== 'string') {
      return NextResponse.json({ error: 'Missing persona name' }, { status: 400 });
    }
    const personaDir = path.join(process.cwd(), "data", "personas", persona);
    if (fs.existsSync(personaDir)) {
      fs.rmSync(personaDir, { recursive: true, force: true });
    }
    addToDeletedList(persona);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("personas DELETE error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
