import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = '/opt/persona-positioning/data/history';

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export async function GET(req: NextRequest) {
  try {
    ensureDir();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    // Single record detail
    if (id) {
      const filePath = path.join(DATA_DIR, `${id}.json`);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return NextResponse.json({ record: raw });
    }

    // List all
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    const list = files
      .map(f => {
        try {
          const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'));
          return {
            id: raw.id,
            name: raw.name || '未命名',
            createdAt: raw.createdAt,
            summary: (raw.profileResult || '').slice(0, 120) + ((raw.profileResult || '').length > 120 ? '...' : ''),
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return NextResponse.json({ items: list });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to read history' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureDir();
    const body = await req.json();
    const { name, profileResult, planResult } = body;
    const id = String(Date.now());
    const record = {
      id,
      name: name || '未命名',
      createdAt: new Date().toISOString(),
      profileResult: profileResult || '',
      planResult: planResult || '',
    };
    fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), JSON.stringify(record, null, 2), 'utf-8');
    return NextResponse.json({ id });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    ensureDir();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });

    const filePath = path.join(DATA_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return NextResponse.json({ deleted: true });
    }
    return NextResponse.json({ deleted: false, error: 'Not found' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
