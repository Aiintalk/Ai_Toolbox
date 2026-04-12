import { NextRequest, NextResponse } from 'next/server';
import { getAnalysis } from '@/lib/history';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const entry = await getAnalysis(params.id);
    if (!entry) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }
    return NextResponse.json(entry);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'load failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
