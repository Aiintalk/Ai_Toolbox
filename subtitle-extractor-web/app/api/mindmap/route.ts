import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/lib/yunwu";

const MINDMAP_SYSTEM_PROMPT = `你是一名内容运营专家，擅长分析短视频脚本结构。
请根据以下视频字幕文案，从运营视角提炼出思维导图结构。
你必须严格输出合法 JSON，不要输出任何其他内容，不要添加 markdown 代码块标记。
JSON格式如下：
{
  "rootTitle": "视频核心主题（一句话）",
  "summary": "一句话总结整体内容",
  "branches": [
    {
      "title": "开头钩子",
      "children": ["子要点1", "子要点2"]
    }
  ]
}
参考维度：开头钩子、用户痛点、核心卖点、内容逻辑、转化动作、可复用建议。
每个维度如与视频内容不符可省略，但至少输出 3 个维度。`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript } = body;

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "transcript is required" },
        { status: 400 }
      );
    }

    const raw = await chatComplete(
      [{ role: "user", content: transcript }],
      MINDMAP_SYSTEM_PROMPT,
      "claude-haiku-4-5-20251001"
    );

    // Strip potential markdown code fences
    const cleaned = raw.replace(/```(?:json)?\n?/g, "").trim();

    let mindmap: unknown;
    try {
      mindmap = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "AI 返回格式解析失败，请重试", raw },
        { status: 500 }
      );
    }

    return NextResponse.json(mindmap);
  } catch (err) {
    console.error("mindmap error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
