const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;
const YUNWU_BASE_URL = process.env.YUNWU_BASE_URL!;

interface ChatMessage {
  role: string;
  content: string;
}

export function chatStream(
  messages: ChatMessage[],
  systemPrompt: string,
  model: string = "claude-opus-4-6-thinking"
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const allMessages: ChatMessage[] = [
          { role: "system", content: systemPrompt },
          ...messages,
        ];

        let response: Response | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          response = await fetch(`${YUNWU_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${YUNWU_API_KEY}`,
            },
            body: JSON.stringify({
              model,
              messages: allMessages,
              stream: true,
            }),
          });
          if (response.status === 429) {
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }
          break;
        }

        if (!response || !response.ok) {
          controller.enqueue(encoder.encode("AI 服务暂时繁忙，请稍后重试"));
          controller.close();
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          controller.enqueue(encoder.encode("Error: No response body"));
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(content));
              }
            } catch {
              // skip malformed JSON chunks
            }
          }
        }

        controller.close();
      } catch (err) {
        controller.enqueue(
          encoder.encode(`Error: ${err instanceof Error ? err.message : String(err)}`)
        );
        controller.close();
      }
    },
  });
}
