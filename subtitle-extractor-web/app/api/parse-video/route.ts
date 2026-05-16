import { NextRequest, NextResponse } from "next/server";
import { fetchVideoByShareUrl } from "@/lib/tikhub";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shareText } = body;

    if (!shareText || typeof shareText !== "string") {
      return NextResponse.json(
        { error: "shareText is required" },
        { status: 400 }
      );
    }

    const videoInfo = await fetchVideoByShareUrl(shareText);

    return NextResponse.json({
      awemeId: videoInfo.awemeId,
      title: videoInfo.title,
      diggCount: videoInfo.diggCount,
      playUrl: videoInfo.playUrl,
      isSubtitled: videoInfo.isSubtitled,
    });
  } catch (err) {
    console.error("parse-video error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
