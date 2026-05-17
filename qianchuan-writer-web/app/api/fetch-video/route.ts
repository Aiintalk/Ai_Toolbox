import { NextRequest, NextResponse } from "next/server";
import { fetchVideoByShareUrl } from "@/lib/tikhub";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shareUrl } = body;

    if (!shareUrl || typeof shareUrl !== "string") {
      return NextResponse.json(
        { error: "shareUrl is required" },
        { status: 400 }
      );
    }

    const videoInfo = await fetchVideoByShareUrl(shareUrl);

    return NextResponse.json({
      title: videoInfo.title,
      diggCount: videoInfo.diggCount,
      awemeId: videoInfo.awemeId,
      isSubtitled: videoInfo.isSubtitled,
      playUrl: videoInfo.playUrl,
    });
  } catch (err) {
    console.error("fetch-video error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
