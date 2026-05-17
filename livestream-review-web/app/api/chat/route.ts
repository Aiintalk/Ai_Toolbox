import { NextRequest } from 'next/server'
import { chatStream } from '@/lib/yunwu'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, systemPrompt } = body

    if (!messages || !systemPrompt) {
      return new Response('messages and systemPrompt are required', { status: 400 })
    }

    const stream = chatStream(messages, systemPrompt)

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (err) {
    console.error('chat error:', err)
    return new Response(
      err instanceof Error ? err.message : 'Internal server error',
      { status: 500 }
    )
  }
}
