const YUNWU_API_KEY = process.env.YUNWU_API_KEY!
const YUNWU_BASE_URL = process.env.YUNWU_BASE_URL!

const FALLBACK_MODELS = ['gpt-4o']

interface ChatMessage {
  role: string
  content: string
}

async function tryRequest(
  url: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
): Promise<Response | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: true }),
    })
    if (response.status === 429) {
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
      continue
    }
    if (response.ok) return response
    break
  }
  return null
}

export function chatStream(
  messages: ChatMessage[],
  systemPrompt: string,
  model: string = 'claude-sonnet-4-20250514'
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const allMessages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...messages,
        ]

        const url = `${YUNWU_BASE_URL}/chat/completions`
        let response = await tryRequest(url, YUNWU_API_KEY, model, allMessages)

        // Fallback to alternative models if primary fails
        if (!response) {
          for (const fallback of FALLBACK_MODELS) {
            response = await tryRequest(url, YUNWU_API_KEY, fallback, allMessages)
            if (response) break
          }
        }

        if (!response) {
          controller.enqueue(encoder.encode('AI 服务暂时繁忙，请稍后重试'))
          controller.close()
          return
        }

        const reader = response.body?.getReader()
        if (!reader) {
          controller.enqueue(encoder.encode('Error: No response body'))
          controller.close()
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data: ')) continue

            const data = trimmed.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                controller.enqueue(encoder.encode(content))
              }
            } catch {
              // skip malformed JSON chunks
            }
          }
        }

        controller.close()
      } catch (err) {
        controller.enqueue(
          encoder.encode(`Error: ${err instanceof Error ? err.message : String(err)}`)
        )
        controller.close()
      }
    },
  })
}
