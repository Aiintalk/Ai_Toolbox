import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.YUNWU_API_KEY
  const baseUrl = process.env.YUNWU_BASE_URL || 'https://api.yunwu.ai/v1'

  if (!apiKey) {
    return NextResponse.json({ reply: '服务暂时不可用' }, { status: 500 })
  }

  const { userAnswer, questionText, nextQuestionText, nextQuestionHint, isMultiCollect, collectCount, isLastQuestion, isSectionChange, nextSection, answeredQuestions } = await req.json()

  let instruction = ''

  if (isMultiCollect && collectCount > 0) {
    instruction = `用户正在回答一个可以填多条的问题："${questionText}"，这是他们的第 ${collectCount} 条回答。
请先对这条回答做出真诚的回应（共情、好奇、肯定都可以，要具体到他们说的内容），然后自然地问他们还有没有其他的。
不要说"记下了"这种机械的话。像朋友聊天一样。`
  } else if (isLastQuestion) {
    instruction = `用户刚回答了最后一道问题："${questionText}"。
请对回答做出真诚的回应，然后用温暖自然的方式告诉他们所有问题都聊完了，辛苦了，可以点击提交生成报告了。`
  } else {
    instruction = `用户刚回答了问题："${questionText}"。
请先对回答做出真诚的回应（1-2句，要具体到他们说的内容，不要泛泛而谈），
然后自然地过渡到下一个话题。${isSectionChange ? `\n下一个版块是「${nextSection}」，简单过渡一下。` : ''}
最后，用你自己的话把下一个问题问出来（不要原封不动复制问题文本，用更自然的口语化表达）。
下一个问题是："${nextQuestionText}"${nextQuestionHint ? `\n提示信息（帮你理解这个问题想问什么，但不要直接念出来）：${nextQuestionHint}` : ''}`
  }

  const systemPrompt = `你是一个红人孵化团队的面试官，正在和一个新红人聊天了解他/她的情况。
你的风格：温暖、真诚、有洞察力，像一个聊得来的朋友。
- 回应要具体到用户说的内容，不要用万能回复
- 语气自然口语化，不要太正式
- 简洁，整体不超过3句话
- 不要用"好的""收到""了解"这种客服话术开头
- 不要用emoji
- 如果用户说了很厉害的经历，真诚地表达惊叹，但不要夸张
- 如果用户说了痛苦的经历，表达理解但不要过度同情
- 不要重复用户说过的内容，直接回应你的感受和观察`

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${instruction}\n\n用户的回答是：\n"${userAnswer}"` },
        ],
        max_tokens: 300,
      }),
    })

    if (!res.ok) {
      console.error('Bridge API failed:', await res.text())
      return NextResponse.json({ reply: '' })
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    let reply = ''
    if (typeof content === 'string') {
      reply = content
    } else if (Array.isArray(content)) {
      const textBlock = content.find((b: { type: string }) => b.type === 'text')
      reply = textBlock?.text || ''
    }

    return NextResponse.json({ reply })
  } catch (e) {
    console.error('Bridge error:', e)
    return NextResponse.json({ reply: '' })
  }
}
