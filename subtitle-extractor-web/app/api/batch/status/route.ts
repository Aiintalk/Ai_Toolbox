import { NextRequest, NextResponse } from "next/server";
import { readJob, findJobByCode } from "@/lib/batch-store";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    const code = searchParams.get("code");

    if (!jobId && !code) {
      return NextResponse.json(
        { error: "jobId 或 code 必须提供其中一个" },
        { status: 400 }
      );
    }

    const job = code ? findJobByCode(code) : readJob(jobId!);
    if (!job) {
      return NextResponse.json({ error: "任务不存在，请确认访问码是否正确" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (err) {
    console.error("batch status error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
