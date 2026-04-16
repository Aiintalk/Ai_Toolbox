import { NextRequest, NextResponse } from "next/server";
import { uploadToOSS, getSignedUrl } from "@/lib/aliyun-oss";
import { submitTranscription } from "@/lib/aliyun-asr";

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

    // Step 1: Download video
    const videoResponse = await fetch(playUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.douyin.com/",
      },
    });

    if (!videoResponse.ok) {
      return NextResponse.json(
        { error: `Failed to download video: ${videoResponse.status}` },
        { status: 502 }
      );
    }

    const arrayBuffer = await videoResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Step 2: Upload to OSS
    const objectKey = `transcribe/${Date.now()}.mp4`;
    await uploadToOSS(buffer, objectKey, "video/mp4");

    // Step 3: Generate signed URL (1 hour expiry)
    const signedUrl = getSignedUrl(objectKey, 3600);

    // Step 4: Submit ASR task (returns immediately with taskId)
    const taskId = await submitTranscription(signedUrl);

    return NextResponse.json({ taskId });
  } catch (err) {
    console.error("transcribe upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
