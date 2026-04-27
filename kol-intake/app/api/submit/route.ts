import { NextRequest, NextResponse } from 'next/server'
import { saveSubmission, getSubmissionByUser } from '@/lib/storage'
import { getSession } from '@/lib/auth'

async function generateReport(answers: Record<string, string>): Promise<string> {
  const apiKey = process.env.YUNWU_API_KEY
  const baseUrl = process.env.YUNWU_BASE_URL || 'https://api.yunwu.ai/v1'

  if (!apiKey) return ''

  const sections: string[] = []
  const fieldMap: Record<string, string> = {
    nickname: '昵称',
    age_city: '年龄城市',
    relationship: '情感状态',
    kids: '子女情况',
    parents: '与父母关系',
    streaming_frequency: '当前直播频率',
    relocation: '是否接受搬家',
    daily_schedule: '每日时间安排',
    last_job_ending: '上一份工作/合作结束方式',
    money_split: '合伙分钱经历',
    unfair_experience: '被不公平对待的经历',
    never_cooperate: '绝对不合作的人',
    one_sentence: '一句话介绍',
    career_path: '职业经历',
    unique_experiences: '独特经历',
    speaking_style: '说话风格',
    never_say: '绝对不做的内容',
    credentials: '特殊背书',
    content_direction: '内容方向',
    target_audience: '目标受众',
    liked_blogger: '喜欢的博主',
    liked_douyin_content: '喜欢的抖音内容',
    own_best_content: '自己最满意的内容',
  }

  for (const [key, label] of Object.entries(fieldMap)) {
    if (answers[key]) {
      sections.push(`【${label}】\n${answers[key]}`)
    }
  }

  const prompt = `你是一个红人孵化团队的资深分析师。以下是一位新红人的信息采集结果，请生成一份分析报告。

## 重要：措辞要求

这份报告会同时给红人本人和团队看，所以措辞必须：
- **像朋友在帮你分析**，不要像在写评估报告
- **不要出现「评估」「人品」「野心」「风险」这类字眼**
- 涉及投入程度时，用关心的语气引导思考，比如："直播带货是个需要高频投入的事，你现在的节奏能支撑每天直播吗？如果还没想清楚，签约前值得认真考虑一下"
- 涉及合作风格时，用建设性的方式表达，比如："签约意味着长期合作，过去有没有跟公司合作产生过纠纷？提前聊清楚期望，对双方都好"
- **有分析深度但不伤人**——问题要点到，但语气是善意的提醒而不是下判断

## 报告结构

# 新红人分析报告 · [昵称]

## 人物画像
（2-3句话总结这个人是谁、核心特质是什么，让人读完觉得"说的就是我"）

## 人格标签
（3-5个关键词，如：务实型创业者 / 毒舌但真诚 / 逆袭叙事）

## 核心差异化素材
（从经历中提炼 2-3 个最有内容价值的素材点，标注素材类型：逆袭/专业/争议/共情）

## 表达风格
（说话特点、语气、内容底线）

## 投入节奏与准备度
（基于当前直播频率、日程安排、搬家意愿，分析这个人现在的投入状态。
- 如果投入度高：肯定现状，指出优势
- 如果投入度一般：温和地指出"直播带货需要持续高频投入，你可能需要想清楚是否准备好了"
- 如果从未直播过：善意提醒"建议先试播一段时间，感受一下节奏再做决定"
不要下结论说"这个人不行"，而是引导对方自己思考）

## 合作适配度
（基于过去的工作/合作经历、处理冲突的方式，分析合作风格。
- 突出正面信号（守信、理性、有合作经验）
- 如果有需要注意的地方，用建设性方式表达，比如："签约是长期关系，建议提前跟团队聊清楚分成、排期这些关键问题，避免后面产生误解"
- 如果信息不足，自然地说"这部分后面可以进一步聊聊"）

## 内容方向建议
（基于经历和偏好，建议 2-3 个内容方向）

## 还可以聊的
（还有哪些方面值得进一步了解，用"期待更多了解"的语气）

===采集信息===
${sections.join('\n\n')}
===

请用简洁自然的中文输出。语气真诚、温和、有洞察力，像一个懂你的团队伙伴在跟你聊天。`

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        thinking: {
          type: 'enabled',
          budget_tokens: 6000,
        },
      }),
    })

    if (!res.ok) {
      console.error('AI report generation failed:', await res.text())
      return ''
    }

    const data = await res.json()

    // Extract text content from thinking response
    const content = data.choices?.[0]?.message?.content
    if (typeof content === 'string') {
      return content
    } else if (Array.isArray(content)) {
      // Extended thinking: [{type: 'thinking', ...}, {type: 'text', text: '...'}]
      const textBlock = content.find((b: { type: string }) => b.type === 'text')
      return textBlock?.text || ''
    }

    return ''
  } catch (e) {
    console.error('AI report error:', e)
    return ''
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { answers } = await req.json()
    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: '无效数据' }, { status: 400 })
    }

    // kol 一人一份：覆盖之前的提交（沿用旧 id 保持引用稳定）
    // employee/admin 也走 userId 写入，便于追溯（一人一份）
    const userId = session.username
    const existing = getSubmissionByUser(userId)
    const id = existing?.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6))

    // 部分覆盖：本次未填的字段沿用之前的答案
    const mergedAnswers: Record<string, string> = { ...(existing?.answers || {}) }
    for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim().length > 0) {
        mergedAnswers[k] = v
      }
    }

    const nickname = mergedAnswers.nickname || existing?.nickname || '未填写'
    const now = new Date()
    const submittedAt = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })

    const report = await generateReport(mergedAnswers)

    saveSubmission({ id, userId, nickname, submittedAt, answers: mergedAnswers, report })

    return NextResponse.json({ ok: true, id, report })
  } catch (e) {
    console.error('Submit error:', e)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
