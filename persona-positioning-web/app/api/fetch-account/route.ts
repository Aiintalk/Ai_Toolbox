import { resolveSecUserId, fetchUserVideos, getTop10, getRecent30Days, formatVideos } from '@/lib/tikhub';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: '请输入抖音号或链接' }, { status: 400 });
    }

    // 1. 智能解析：支持抖音号、主页链接、分享链接
    const { secUserId, nickname } = await resolveSecUserId(url);

    // 2. 拉取所有作品
    const allVideos = await fetchUserVideos(secUserId);

    // 3. 分两组（新账号可能没有作品，不阻断流程）
    const top10 = allVideos.length > 0 ? getTop10(allVideos) : [];
    const recent30 = allVideos.length > 0 ? getRecent30Days(allVideos) : [];

    // 4. 格式化
    const top10Text = top10.length > 0 ? formatVideos(top10, '全账号点赞TOP10') : '';
    const recent30Text = recent30.length > 0 ? formatVideos(recent30, '最近30天内容') : '';

    return NextResponse.json({
      nickname: nickname || '',
      secUserId,
      totalVideos: allVideos.length,
      top10Count: top10.length,
      recent30Count: recent30.length,
      top10Text,
      recent30Text,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '抓取失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
