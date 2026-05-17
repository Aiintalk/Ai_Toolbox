import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

const KOL_DATA_DIR = '/opt/kol-intake/data';

const FIELD_LABELS: Record<string, string> = {
  nickname: '昵称', douyin_name: '抖音账号名', age_city: '年龄城市',
  relationship: '情感状态', kids: '子女情况', parents: '与父母关系',
  streaming_frequency: '直播频率', relocation: '搬迁意愿', daily_schedule: '日程安排',
  last_job_ending: '上份工作结束方式', money_split: '合伙分钱经历', unfair_experience: '不公经历',
  never_cooperate: '不合作底线', one_sentence: '一句话介绍', career_path: '职业经历',
  unique_experiences: '独特经历', speaking_style: '说话风格', never_say: '绝不做的内容',
  credentials: '背书资质', content_direction: '内容方向', target_audience: '目标受众',
  liked_blogger: '喜欢的博主', liked_douyin_content: '喜欢的抖音内容', own_best_content: '最满意的内容',
};

interface PersonaInfo {
  name: string;
  soul: string;
  contentPlan: string;
  references: string[];
  intake?: {
    submittedAt: string;
    answers: Record<string, string>;
    report?: string;
  };
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

export async function POST(request: Request) {
  try {
    const { name, soul, contentPlan } = await request.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: '请输入达人名称' }, { status: 400 });
    }
    const personaDir = path.join(process.cwd(), "data", "personas", name.trim());
    if (fs.existsSync(personaDir)) {
      return NextResponse.json({ error: '该达人已存在' }, { status: 409 });
    }
    fs.mkdirSync(path.join(personaDir, "references"), { recursive: true });
    if (soul && typeof soul === 'string') {
      fs.writeFileSync(path.join(personaDir, "soul.md"), soul, 'utf-8');
    }
    if (contentPlan && typeof contentPlan === 'string') {
      fs.writeFileSync(path.join(personaDir, "content-plan.md"), contentPlan, 'utf-8');
    }
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

export async function PUT(request: Request) {
  try {
    const { persona, field, content } = await request.json();
    if (!persona || !field || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing persona, field, or content' }, { status: 400 });
    }
    if (field !== 'soul' && field !== 'contentPlan') {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }
    const personaDir = path.join(process.cwd(), "data", "personas", persona);
    if (!fs.existsSync(personaDir)) fs.mkdirSync(personaDir, { recursive: true });
    const fileName = field === 'soul' ? 'soul.md' : 'content-plan.md';
    fs.writeFileSync(path.join(personaDir, fileName), content, 'utf-8');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("personas PUT error:", err);
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

export async function GET() {
  try {
    const personasDir = path.join(process.cwd(), "data", "personas");
    if (!fs.existsSync(personasDir)) fs.mkdirSync(personasDir, { recursive: true });

    const deletedNames = new Set(readDeletedList());

    // Pre-load kol-intake submissions
    // Index by both nickname and douyin_name so we can match existing persona folders
    const intakeByName = new Map<string, { submittedAt: string; answers: Record<string, string>; report?: string }>();
    try {
      if (fs.existsSync(KOL_DATA_DIR)) {
        for (const f of fs.readdirSync(KOL_DATA_DIR).filter(f => f.endsWith('.json'))) {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(KOL_DATA_DIR, f), 'utf-8'));
            const nickname = data.nickname || data.answers?.nickname;
            const douyinName = data.answers?.douyin_name;
            if (!nickname && !douyinName) continue;
            const intake = { submittedAt: data.submittedAt, answers: data.answers || {}, report: data.report };
            // Index under both names so either can match an existing folder
            const names = new Set<string>();
            if (nickname) names.add(nickname);
            if (douyinName) names.add(douyinName);
            for (const name of names) {
              const existing = intakeByName.get(name);
              if (!existing || new Date(data.submittedAt) > new Date(existing.submittedAt)) {
                intakeByName.set(name, intake);
              }
            }
          } catch {}
        }
      }
    } catch {}

    const entries = fs.readdirSync(personasDir, { withFileTypes: true });
    const personas: PersonaInfo[] = [];
    const knownNames = new Set<string>();

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (deletedNames.has(entry.name)) continue;

      const personaDir = path.join(personasDir, entry.name);
      let soul = "", contentPlan = "";
      const references: string[] = [];

      try { const p = path.join(personaDir, "soul.md"); if (fs.existsSync(p)) soul = fs.readFileSync(p, "utf-8"); } catch {}
      try { const p = path.join(personaDir, "content-plan.md"); if (fs.existsSync(p)) contentPlan = fs.readFileSync(p, "utf-8"); } catch {}
      try {
        const refsDir = path.join(personaDir, "references");
        if (fs.existsSync(refsDir)) {
          for (const refFile of fs.readdirSync(refsDir).filter(f => f.endsWith(".md")).sort()) {
            references.push(fs.readFileSync(path.join(refsDir, refFile), "utf-8"));
          }
        }
      } catch {}

      personas.push({ name: entry.name, soul, contentPlan, references, intake: intakeByName.get(entry.name) });
      knownNames.add(entry.name);
    }

    // Auto-create for KOLs not yet in personas and not deleted
    // Only create if neither nickname nor douyin_name has a folder already
    const createdFromIntake = new Set<string>();
    try {
      if (fs.existsSync(KOL_DATA_DIR)) {
        for (const f of fs.readdirSync(KOL_DATA_DIR).filter(f => f.endsWith('.json'))) {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(KOL_DATA_DIR, f), 'utf-8'));
            const nickname = data.nickname || data.answers?.nickname;
            const douyinName = data.answers?.douyin_name;
            if (!nickname && !douyinName) continue;
            // Skip if either name already has a folder
            if ((nickname && knownNames.has(nickname)) || (douyinName && knownNames.has(douyinName))) continue;
            const displayName = douyinName || nickname;
            if (!displayName || deletedNames.has(displayName) || createdFromIntake.has(displayName)) continue;
            if (nickname && deletedNames.has(nickname)) continue;
            const intake = intakeByName.get(displayName) || intakeByName.get(nickname || '');
            if (!intake) continue;
            const newDir = path.join(personasDir, displayName);
            fs.mkdirSync(path.join(newDir, "references"), { recursive: true });
            personas.push({ name: displayName, soul: "", contentPlan: "", references: [], intake });
            knownNames.add(displayName);
            createdFromIntake.add(displayName);
          } catch {}
        }
      }
    } catch {}

    return NextResponse.json({ personas, fieldLabels: FIELD_LABELS });
  } catch (err) {
    console.error("personas error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
