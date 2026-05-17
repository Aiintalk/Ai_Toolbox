import { NextRequest, NextResponse } from "next/server";
import { submitTranscription } from "@/lib/aliyun-asr";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audioUrl } = body;

    if (!audioUrl || typeof audioUrl !== "string") {
      return NextResponse.json(
        { error: "audioUrl is required" },
        { status: 400 }
      );
    }

    // Submit ASR directly with audio URL (no download or OSS needed)
    const taskId = await submitTranscription(audioUrl);

    return NextResponse.json({ taskId });
  } catch (err) {
    console.error("transcribe upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
