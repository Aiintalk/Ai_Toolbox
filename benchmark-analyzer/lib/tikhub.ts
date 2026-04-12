const TIKHUB_API_KEY = process.env.TIKHUB_API_KEY;
const TIKHUB_BASE = 'https://api.tikhub.io/api/v1/douyin/web';

function headers() {
  return { Authorization: `Bearer ${TIKHUB_API_KEY}` };
}

// 智能解析输入：支持抖音号、主页链接、分享链接
export async function resolveSecUserId(input: string): Promise<{ secUserId: string; nickname?: string }> {
  const trimmed = input.trim();

  // 判断是否包含链接
  const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);

  if (urlMatch) {
    // 是链接 → 用 get_sec_user_id 解析
    const res = await fetch(`${TIKHUB_BASE}/get_sec_user_id?url=${encodeURIComponent(urlMatch[0])}`, {
      headers: headers(),
    });
    if (!res.ok) throw new Error(`链接解析失败（${res.status}），请检查链接是否正确`);
    const json = await res.json();
    const secUid = json?.data?.sec_user_id;
    if (!secUid) throw new Error('无法从链接中提取用户ID，请检查链接是否正确');
    return { secUserId: secUid };
  }

  // 不是链接 → 当作抖音号（unique_id）查询
  const res = await fetch(`${TIKHUB_BASE}/handler_user_profile_v2?unique_id=${encodeURIComponent(trimmed)}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`抖音号查询失败（${res.status}），请检查抖音号是否正确`);
  const json = await res.json();
  const userData = json?.data?.user_info || json?.data?.user;
  const secUid = userData?.sec_uid;
  const nickname = userData?.nickname;
  if (!secUid) throw new Error(`未找到抖音号「${trimmed}」对应的账号，请检查是否输入正确`);
  return { secUserId: secUid, nickname };
}

interface VideoItem {
  desc: string;
  diggCount: number;
  createTime: number;
  awemeId: string;
}

// 拉取用户所有作品（翻页，最多拉 maxPages 页）
export async function fetchUserVideos(secUserId: string, maxPages = 10): Promise<VideoItem[]> {
  const allVideos: VideoItem[] = [];
  let cursor = '0';
  let hasMore = true;

  for (let page = 0; page < maxPages && hasMore; page++) {
    const res = await fetch(
      `${TIKHUB_BASE}/fetch_user_post_videos?sec_user_id=${secUserId}&max_cursor=${cursor}&count=20`,
      { headers: headers() }
    );
    if (!res.ok) throw new Error(`TikHub error: ${res.status}`);
    const json = await res.json();

    const list = json?.data?.aweme_list || [];
    for (const item of list) {
      allVideos.push({
        desc: item.desc || '',
        diggCount: item.statistics?.digg_count || 0,
        createTime: item.create_time || 0,
        awemeId: item.aweme_id || '',
      });
    }

    hasMore = json?.data?.has_more === 1 || json?.data?.has_more === true;
    cursor = String(json?.data?.max_cursor || '0');

    // 如果没有更多了就停
    if (list.length === 0) break;
  }

  return allVideos;
}

// 获取 TOP10 点赞最高
export function getTop10(videos: VideoItem[]): VideoItem[] {
  return [...videos].sort((a, b) => b.diggCount - a.diggCount).slice(0, 10);
}

// 获取最近30天的内容
export function getRecent30Days(videos: VideoItem[]): VideoItem[] {
  const thirtyDaysAgo = Date.now() / 1000 - 30 * 24 * 60 * 60;
  return videos
    .filter((v) => v.createTime >= thirtyDaysAgo)
    .sort((a, b) => b.createTime - a.createTime);
}

// 格式化视频列表为文本
export function formatVideos(videos: VideoItem[], label: string): string {
  if (videos.length === 0) return `${label}：无数据`;
  return videos
    .map((v, i) => {
      const date = new Date(v.createTime * 1000);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const likes = v.diggCount >= 10000 ? `${(v.diggCount / 10000).toFixed(1)}万` : String(v.diggCount);
      return `---\n第${i + 1}条 | ${dateStr} | 点赞 ${likes}\n${v.desc}`;
    })
    .join('\n\n');
}
