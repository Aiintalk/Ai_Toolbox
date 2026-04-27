import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSession, canSeeAll, canAccessPersona } from "@/lib/auth";

export const dynamic = 'force-dynamic';

interface PersonaInfo {
  name: string;
  soul: string;
  contentPlan: string;
  references: string[];
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { persona, field, content } = await request.json();
    if (!persona || !field || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing persona, field, or content' }, { status: 400 });
    }
    if (field !== 'soul' && field !== 'contentPlan') {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }

    if (!canAccessPersona(session, persona)) {
      return NextResponse.json({ error: '无权修改该达人档案' }, { status: 403 });
    }

    const personaDir = path.join(process.cwd(), "data", "personas", persona);
    if (!fs.existsSync(personaDir)) {
      fs.mkdirSync(personaDir, { recursive: true });
    }

    const fileName = field === 'soul' ? 'soul.md' : 'content-plan.md';
    fs.writeFileSync(path.join(personaDir, fileName), content, 'utf-8');

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("personas PUT error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const personasDir = path.join(process.cwd(), "data", "personas");

    if (!fs.existsSync(personasDir)) {
      return NextResponse.json({ personas: [] });
    }

    const entries = fs.readdirSync(personasDir, { withFileTypes: true });
    const personas: PersonaInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // kol 只能看到与自己 username 同名的 persona
      if (!canSeeAll(session) && entry.name !== session.username) continue;

      const personaDir = path.join(personasDir, entry.name);
      const soulPath = path.join(personaDir, "soul.md");
      const contentPlanPath = path.join(personaDir, "content-plan.md");
      const refsDir = path.join(personaDir, "references");

      let soul = "";
      let contentPlan = "";
      const references: string[] = [];

      try {
        if (fs.existsSync(soulPath)) {
          soul = fs.readFileSync(soulPath, "utf-8");
        }
      } catch {
        // skip unreadable soul file
      }

      try {
        if (fs.existsSync(contentPlanPath)) {
          contentPlan = fs.readFileSync(contentPlanPath, "utf-8");
        }
      } catch {
        // skip unreadable content-plan file
      }

      try {
        if (fs.existsSync(refsDir)) {
          const refFiles = fs.readdirSync(refsDir).filter(f => f.endsWith(".md")).sort();
          for (const refFile of refFiles) {
            const content = fs.readFileSync(path.join(refsDir, refFile), "utf-8");
            references.push(content);
          }
        }
      } catch {
        // skip unreadable references
      }

      personas.push({
        name: entry.name,
        soul,
        contentPlan,
        references,
      });
    }

    return NextResponse.json({ personas });
  } catch (err) {
    console.error("personas error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
