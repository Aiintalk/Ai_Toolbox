import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface PersonaInfo {
  name: string;
  soul: string;
  contentPlan: string;
  references: string[];
}

export async function GET() {
  try {
    const personasDir = path.join(process.cwd(), "data", "personas");

    if (!fs.existsSync(personasDir)) {
      return NextResponse.json({ personas: [] });
    }

    const entries = fs.readdirSync(personasDir, { withFileTypes: true });
    const personas: PersonaInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

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
