import { NextRequest, NextResponse } from 'next/server';
import { listAnalyses, saveAnalysis } from '@/lib/history';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const list = await listAnalyses();
    return NextResponse.json({ items: list });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'load failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry = await saveAnalysis({
      nickname: body.nickname || '',
      secUserId: body.secUserId || '',
      accountName: body.accountName || '',
      totalVideos: body.totalVideos || 0,
      top10Text: body.top10Text || '',
      recent30Text: body.recent30Text || '',
      profileResult: body.profileResult || '',
      planResult: body.planResult || '',
    });
    return NextResponse.json({ id: entry.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'save failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
