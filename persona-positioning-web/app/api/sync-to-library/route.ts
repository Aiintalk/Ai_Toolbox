import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Direct file write to material-library's data directory (same server)
const MATERIAL_PERSONAS_DIR = '/opt/material-library/data/personas';

export async function POST(req: NextRequest) {
  try {
    const { persona, soul, contentPlan } = await req.json();

    if (!persona || typeof persona !== 'string') {
      return NextResponse.json({ error: 'Missing persona name' }, { status: 400 });
    }

    const personaDir = path.join(MATERIAL_PERSONAS_DIR, persona);
    const refsDir = path.join(personaDir, 'references');

    // Ensure directory exists
    if (!fs.existsSync(refsDir)) {
      fs.mkdirSync(refsDir, { recursive: true });
    }

    // Write soul.md (persona profile)
    if (soul && typeof soul === 'string') {
      fs.writeFileSync(path.join(personaDir, 'soul.md'), soul, 'utf-8');
    }

    // Write content-plan.md
    if (contentPlan && typeof contentPlan === 'string') {
      fs.writeFileSync(path.join(personaDir, 'content-plan.md'), contentPlan, 'utf-8');
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('sync-to-library error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
