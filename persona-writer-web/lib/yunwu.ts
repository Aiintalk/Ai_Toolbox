const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;
const YUNWU_BASE_URL = process.env.YUNWU_BASE_URL!;

interface ChatMessage {
  role: string;
  content: string;
}

export function chatStream(
  messages: ChatMessage[],
  systemPrompt: string,
  model: string = "claude-sonnet-4-6"
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const allMessages: ChatMessage[] = [
          { role: "system", content: systemPrompt },
          ...messages,
        ];

        const response = await fetch(`${YUNWU_BASE_URL}/chat/completions`, {
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

        if (!response.ok) {
          const text = await response.text();
          controller.enqueue(encoder.encode(`Error: ${response.status} ${text}`));
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
