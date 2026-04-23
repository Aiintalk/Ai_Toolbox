const TIKHUB_API_KEY = process.env.TIKHUB_API_KEY;

interface VideoInfo {
  title: string;
  diggCount: number;
  awemeId: string;
  isSubtitled: number;
  playUrl: string;
  desc: string;
}

export async function fetchVideoByShareUrl(rawInput: string): Promise<VideoInfo> {
  if (!TIKHUB_API_KEY) {
    throw new Error("TIKHUB_API_KEY is not configured");
  }

  // Extract URL from pasted share text (e.g. "4.82 z@t.Rk ... https://v.douyin.com/xxx/ 复制此链接...")
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
    throw new Error("Failed to extract video detail from TikHub response");
  }

  const playUrl = detail.video?.play_addr?.url_list?.[0] ?? "";
  const isSubtitled = detail.interaction_stickers?.[0]?.attr?.is_subtitled ?? 0;

  return {
    title: detail.desc ?? "",
    diggCount: detail.statistics?.digg_count ?? 0,
    awemeId: detail.aweme_id ?? "",
    isSubtitled,
    playUrl,
    desc: detail.desc ?? "",
  };
}
