import { NextRequest } from 'next/server';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, ShadingType, Header, Footer, PageNumber } from 'docx';

export const runtime = 'nodejs';

type Answers = Record<string, string>;

type Question = {
  id: string;
  q: string;
  hint?: string;
  required?: boolean;
};

type Section = {
  label: string;
  questions: Question[];
};

const COLORS = {
  primary: '6D28D9',
  accent: 'DC2626',
  gray: '6B7280',
  light: 'F5F3FF',
  white: 'FFFFFF',
};

const border = (color = 'E5E7EB', size = 1) => ({ style: BorderStyle.SINGLE, size, color });

const SECTIONS: Section[] = [
  {
    label: '一、基本信息',
    questions: [
      { id: 'q1', q: '达人的名字 / 昵称是什么？', hint: '粉丝怎么称呼 ta，比如“菁华姐”“小七”', required: true },
      { id: 'q2', q: '年龄、所在城市？', required: true },
      { id: 'q3', q: '职业背景和从业经历？', hint: '做过什么、多少年、怎么走到今天的', required: true },
      { id: 'q4', q: '想做的内容赛道是什么？', hint: '如美妆、母婴、美食、知识分享、生活方式等', required: true },
    ],
  },
  {
    label: '二、个人特色',
    questions: [
      { id: 'q5', q: '有什么专业资质、成就或独特经历？', hint: '证书、奖项、特殊人生经历、别人觉得不可思议的事——都算', required: true },
      { id: 'q6', q: '性格特点是什么？朋友会怎么形容 ta？', hint: '真性情的、毒舌的、温柔的、搞笑的……都可以直接写', required: true },
      { id: 'q7', q: '想要什么样的说话风格？', hint: '如专业严谨、轻松幽默、像闺蜜聊天、犀利点评', required: true },
    ],
  },
  {
    label: '三、内容方向（选填）',
    questions: [
      { id: 'q8', q: '目标受众是什么人群？', hint: '年龄、身份、关注什么，比如“25-35岁职场女性”' },
      { id: 'q9', q: '有没有想对标或喜欢的博主？喜欢 ta 什么？', hint: '说清楚喜欢和不喜欢的部分' },
      { id: 'q10', q: '还有什么想补充的？', hint: '家庭情况、个人故事、品牌信息、商业模式——任何有助于人设定位的信息' },
    ],
  },
];

const title = (name: string) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 280, after: 120 },
  children: [new TextRun({ text: `${name} · 达人入职信息采集表`, bold: true, size: 34, color: COLORS.primary, font: 'Microsoft YaHei' })],
});

const subtitle = () => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 280 },
  children: [new TextRun({ text: '根据问答自动整理，便于直接查看与存档', size: 20, color: COLORS.gray, font: 'Microsoft YaHei' })],
});

const sectionTitle = (text: string, important = false) => new Paragraph({
  spacing: { before: 260, after: 140 },
  shading: { fill: important ? 'FEF2F2' : COLORS.light, type: ShadingType.CLEAR },
  border: {
    top: border(important ? 'FCA5A5' : 'DDD6FE', 1),
    bottom: border(important ? 'FCA5A5' : 'DDD6FE', 1),
    left: border(important ? 'FCA5A5' : 'DDD6FE', 1),
    right: border(important ? 'FCA5A5' : 'DDD6FE', 1),
  },
  children: [new TextRun({ text, bold: true, size: 24, color: important ? COLORS.accent : COLORS.primary, font: 'Microsoft YaHei' })],
});

const questionParagraph = (index: number, q: Question) => new Paragraph({
  spacing: { before: 140, after: 40 },
  children: [
    new TextRun({ text: `${index}. `, bold: true, size: 22, color: '111827', font: 'Arial' }),
    new TextRun({ text: q.q, bold: true, size: 22, color: '111827', font: 'Microsoft YaHei' }),
    ...(q.required ? [new TextRun({ text: '  *必填', size: 18, color: COLORS.accent, font: 'Microsoft YaHei' })] : []),
  ],
});

const hintParagraph = (text: string) => new Paragraph({
  spacing: { after: 50 },
  indent: { left: 200 },
  children: [new TextRun({ text: text, italics: true, size: 18, color: COLORS.gray, font: 'Microsoft YaHei' })],
});

const answerParagraph = (text: string) => new Paragraph({
  spacing: { after: 100 },
  border: { left: border('C4B5FD', 3) },
  shading: { fill: 'FAFAFA', type: ShadingType.CLEAR },
  indent: { left: 240, right: 120 },
  children: [new TextRun({ text, size: 21, color: '1F2937', font: 'Microsoft YaHei' })],
});

export async function POST(req: NextRequest) {
  try {
    const { answers, nickname } = (await req.json()) as { answers?: Answers; nickname?: string };

    if (!answers || typeof answers !== 'object') {
      return new Response(JSON.stringify({ error: '采集表内容为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const name = nickname?.trim() || answers.q1?.trim() || '达人';
    const children: Paragraph[] = [
      title(name),
      subtitle(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 320 },
        children: [
          new TextRun({ text: `导出时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`, size: 18, color: '9CA3AF', font: 'Microsoft YaHei' }),
        ],
      }),
    ];

    let questionIndex = 1;

    for (const section of SECTIONS) {
      const hasAnyAnswer = section.questions.some((q) => answers[q.id]?.trim());
      if (!hasAnyAnswer) {
        questionIndex += section.questions.length;
        continue;
      }

      children.push(sectionTitle(section.label, section.label.includes('★★★')));

      for (const q of section.questions) {
        children.push(questionParagraph(questionIndex, q));
        if (q.hint) children.push(hintParagraph(q.hint));
        children.push(answerParagraph(answers[q.id]?.trim() || '未填写'));
        questionIndex += 1;
      }
    }

    const doc = new Document({
      creator: '人设定位助手',
      title: `${name} · 达人入职信息采集表`,
      styles: {
        default: {
          document: {
            run: { font: 'Microsoft YaHei', size: 22 },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 },
          },
        },
        headers: {
          default: new Header({
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: '达人入职信息采集表', size: 16, color: 'C4B5FD', font: 'Microsoft YaHei' })],
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: '第 ', size: 16, color: '9CA3AF', font: 'Arial' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '9CA3AF', font: 'Arial' }),
                new TextRun({ text: ' 页', size: 16, color: '9CA3AF', font: 'Microsoft YaHei' }),
              ],
            })],
          }),
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = encodeURIComponent(`达人入职信息采集表_${name}_${dateStr}.docx`);

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'export failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
