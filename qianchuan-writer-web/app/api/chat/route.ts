import { NextRequest } from "next/server";
import { chatStream } from "@/lib/yunwu";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, systemPrompt, model } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!systemPrompt || typeof systemPrompt !== "string") {
      return new Response(JSON.stringify({ error: "systemPrompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stream = chatStream(messages, systemPrompt, model);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("chat error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
