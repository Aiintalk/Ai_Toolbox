import { NextRequest, NextResponse } from "next/server";
import { pollTranscription } from "@/lib/aliyun-asr";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 }
      );
    }

    const result = await pollTranscription(taskId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("transcribe poll error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
