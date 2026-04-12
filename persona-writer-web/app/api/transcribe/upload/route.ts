import { NextRequest, NextResponse } from "next/server";
import { uploadToOSS, getSignedUrl } from "@/lib/aliyun-oss";
import { submitTranscription } from "@/lib/aliyun-asr";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playUrl } = body;

    if (!playUrl || typeof playUrl !== "string") {
      return NextResponse.json(
        { error: "playUrl is required" },
        { status: 400 }
      );
    }

    // Step 1: Download video with proper headers (Douyin CDN requires these)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout

    let videoResponse: Response;
    try {
      videoResponse = await fetch(playUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://www.douyin.com/",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!videoResponse.ok) {
      return NextResponse.json(
        { error: `视频下载失败: HTTP ${videoResponse.status}` },
        { status: 502 }
      );
    }

    const arrayBuffer = await videoResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 1000) {
      return NextResponse.json(
        { error: "视频文件过小，可能下载失败" },
        { status: 502 }
      );
    }

    // Step 2: Upload to OSS
    const objectKey = `transcribe/${Date.now()}.mp4`;
    await uploadToOSS(buffer, objectKey, "video/mp4");

    // Step 3: Generate signed URL (1 hour expiry)
    const signedUrl = getSignedUrl(objectKey, 3600);

    // Step 4: Submit ASR task with OSS URL (Douyin CDN URLs are blocked by ASR)
    const taskId = await submitTranscription(signedUrl);

    return NextResponse.json({ taskId });
  } catch (err) {
    console.error("transcribe upload error:", err);
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "视频下载超时（90秒），请重试"
          : err.message
        : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
