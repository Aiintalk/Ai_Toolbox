import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer, BorderStyle } from 'docx'
import { questions } from './questions'
import type { Submission } from './storage'

const sectionOrder = [
  '基本信息', '生活与家庭', '职业经历', '独特经历 ★★★ 最重要',
  '个性与表达', '特殊背书与资质', '内容方向', '加分项'
]

export async function generateDocx(submission: Submission): Promise<Buffer> {
  const children: Paragraph[] = []

  // Title
  children.push(new Paragraph({
    children: [new TextRun({ text: '达人入职信息采集表', bold: true, size: 36, font: 'Microsoft YaHei' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
  }))
  children.push(new Paragraph({
    children: [new TextRun({ text: `达人昵称：${submission.nickname}　　提交时间：${submission.submittedAt}`, size: 20, color: '666666', font: 'Microsoft YaHei' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
  }))
  children.push(new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
    spacing: { after: 200 },
  }))

  let currentSection = ''
  for (const q of questions) {
    const answer = submission.answers[q.id]
    if (!answer && !q.required) continue

    if (q.section !== currentSection) {
      currentSection = q.section
      children.push(new Paragraph({
        children: [new TextRun({ text: currentSection, bold: true, size: 28, font: 'Microsoft YaHei' })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      }))
    }

    children.push(new Paragraph({
      children: [new TextRun({ text: q.question, bold: true, size: 22, font: 'Microsoft YaHei' })],
      spacing: { before: 200, after: 80 },
    }))
    children.push(new Paragraph({
      children: [new TextRun({ text: answer || '（未填写）', size: 22, font: 'Microsoft YaHei', color: answer ? '333333' : '999999' })],
      spacing: { after: 100 },
    }))
  }

  const doc = new Document({
    sections: [{ children }],
  })
  return Buffer.from(await Packer.toBuffer(doc))
}
