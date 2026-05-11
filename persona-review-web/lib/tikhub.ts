const TIKHUB_API_KEY = process.env.TIKHUB_API_KEY;

export interface VideoInfo {
  title: string;
  diggCount: number;
  commentCount: number;
  shareCount: number;
  collectCount: number;
  playCount: number;
  awemeId: string;
  authorName: string;
  createTime: string;
  coverUrl: string;
}

export async function fetchVideoByShareUrl(rawInput: string): Promise<VideoInfo> {
  if (!TIKHUB_API_KEY) {
    throw new Error("TIKHUB_API_KEY is not configured");
  }

  const urlMatch = rawInput.match(/https?:\/\/[^\s]+/);
  const shareUrl = urlMatch ? urlMatch[0] : rawInput.trim();

  const url = `https://api.tikhub.io/api/v1/douyin/web/fetch_one_video_by_share_url?share_url=${encodeURIComponent(shareUrl)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TIKHUB_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`TikHub API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const detail = json?.data?.aweme_detail;

  if (!detail) {
    throw new Error("无法解析该视频，请检查链接是否正确");
  }

  const stats = detail.statistics ?? {};
  const author = detail.author ?? {};
  const createTime = detail.create_time
    ? new Date(detail.create_time * 1000).toISOString().split("T")[0]
    : "";

  return {
    title: detail.desc ?? "(无标题)",
    diggCount: stats.digg_count ?? 0,
    commentCount: stats.comment_count ?? 0,
    shareCount: stats.share_count ?? 0,
    collectCount: stats.collect_count ?? 0,
    playCount: stats.play_count ?? 0,
    awemeId: detail.aweme_id ?? "",
    authorName: author.nickname ?? "",
    createTime,
    coverUrl: detail.video?.cover?.url_list?.[0] ?? "",
  };
}
