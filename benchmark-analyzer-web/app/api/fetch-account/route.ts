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

    if (allVideos.length === 0) {
      return NextResponse.json({ error: '未找到该账号的作品，请检查输入是否正确' }, { status: 404 });
    }

    // 3. 分两组
    const top10 = getTop10(allVideos);
    const recent30 = getRecent30Days(allVideos);

    // 4. 格式化
    const top10Text = formatVideos(top10, '全账号点赞TOP10');
    const recent30Text = formatVideos(recent30, '最近30天内容');

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
