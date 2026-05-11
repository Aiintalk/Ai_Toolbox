import { NextRequest, NextResponse } from "next/server";
import { fetchVideoByShareUrl } from "@/lib/tikhub";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: "urls 数组不能为空" },
        { status: 400 }
      );
    }

    const results = await Promise.allSettled(
      urls.map((url: string) => fetchVideoByShareUrl(url))
    );

    const videos = results.map((result, index) => {
      if (result.status === "fulfilled") {
        return { success: true, data: result.value, originalUrl: urls[index] };
      } else {
        return {
          success: false,
          error: result.reason?.message ?? "未知错误",
          originalUrl: urls[index],
        };
      }
    });

    return NextResponse.json({ videos });
  } catch (err) {
    console.error("fetch-videos error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
