import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSession } from "@/lib/auth";

export const dynamic = 'force-dynamic';

// 6 类素材分类（与前端展示一致）
const REFERENCE_TYPES = [
  '红人爆款文案',
  '红人喜欢的内容',
  '风格参考',
  '千川爆款文案',
  '千川喜欢的内容',
  '千川风格参考',
];

interface ProgressItem {
  key: string;
  label: string;
  done: boolean;
}

/**
 * 当前 kol 的素材库填写进度。
 * 8 项：soul.md（1）+ content-plan.md（1）+ 6 类素材每类至少 1 条（6）。
 * percent = 已完成项 / 8 * 100，向下取整。
 */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // kol 看自己的（=username 对应目录）；employee/admin 默认查看自己 username 对应目录
  // （如果不存在则全部为未完成；employee 一般通过 personas 列表查全部）
  const personaName = session.username;
  const personaDir = path.join(process.cwd(), "data", "personas", personaName);

  const items: ProgressItem[] = [];
  let done = 0;
  const total = 2 + REFERENCE_TYPES.length; // 8

  if (!fs.existsSync(personaDir)) {
    items.push({ key: 'soul', label: '人格档案', done: false });
    items.push({ key: 'contentPlan', label: '内容规划', done: false });
    for (const t of REFERENCE_TYPES) items.push({ key: t, label: t, done: false });
    return NextResponse.json({
      persona: personaName,
      completed: done,
      total,
      percent: 0,
      items,
    });
  }

  // soul.md
  const soulPath = path.join(personaDir, 'soul.md');
  const soulDone = fs.existsSync(soulPath) && fs.readFileSync(soulPath, 'utf-8').trim().length > 0;
  if (soulDone) done++;
  items.push({ key: 'soul', label: '人格档案', done: soulDone });

  // content-plan.md
  const cpPath = path.join(personaDir, 'content-plan.md');
  const cpDone = fs.existsSync(cpPath) && fs.readFileSync(cpPath, 'utf-8').trim().length > 0;
  if (cpDone) done++;
  items.push({ key: 'contentPlan', label: '内容规划', done: cpDone });

  // references by type
  const refsDir = path.join(personaDir, 'references');
  const typeCount: Record<string, number> = Object.fromEntries(REFERENCE_TYPES.map(t => [t, 0]));

  if (fs.existsSync(refsDir)) {
    const files = fs.readdirSync(refsDir).filter(f => f.endsWith('.md'));
    for (const f of files) {
      try {
        const content = fs.readFileSync(path.join(refsDir, f), 'utf-8');
        const m = content.match(/^---[\s\S]*?type:\s*(.+)/m);
        const t = m?.[1]?.trim();
        if (t && t in typeCount) typeCount[t]++;
      } catch {
        // skip unreadable
      }
    }
  }

  for (const t of REFERENCE_TYPES) {
    const has = typeCount[t] > 0;
    if (has) done++;
    items.push({ key: t, label: t, done: has });
  }

  return NextResponse.json({
    persona: personaName,
    completed: done,
    total,
    percent: Math.floor((done / total) * 100),
    items,
  });
}
