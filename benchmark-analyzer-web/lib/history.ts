import fs from 'fs/promises';
import path from 'path';

// 数据目录：生产环境在 /opt/benchmark-analyzer/data，开发在项目根 data/
const DATA_DIR = process.env.BENCHMARK_DATA_DIR || path.join(process.cwd(), 'data');

export interface AnalysisEntry {
  id: string;
  createdAt: number;
  nickname: string;
  secUserId: string;
  accountName: string;
  totalVideos: number;
  top10Text: string;
  recent30Text: string;
  profileResult: string;
  planResult: string;
}

export interface AnalysisSummary {
  id: string;
  createdAt: number;
  nickname: string;
  accountName: string;
  totalVideos: number;
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function saveAnalysis(entry: Omit<AnalysisEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: number }): Promise<AnalysisEntry> {
  await ensureDir();
  const createdAt = entry.createdAt || Date.now();
  const safeSec = (entry.secUserId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
  const id = entry.id || `${createdAt}_${safeSec}`;
  const full: AnalysisEntry = { ...entry, id, createdAt };
  await fs.writeFile(path.join(DATA_DIR, `${id}.json`), JSON.stringify(full, null, 2), 'utf-8');
  return full;
}

export async function listAnalyses(): Promise<AnalysisSummary[]> {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const entries: AnalysisSummary[] = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, f), 'utf-8');
      const data = JSON.parse(raw) as AnalysisEntry;
      entries.push({
        id: data.id,
        createdAt: data.createdAt,
        nickname: data.nickname,
        accountName: data.accountName,
        totalVideos: data.totalVideos,
      });
    } catch {
      // 跳过损坏文件
    }
  }
  return entries.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAnalysis(id: string): Promise<AnalysisEntry | null> {
  await ensureDir();
  // 安全检查：防止路径穿越
  if (!/^[\w-]+$/.test(id)) return null;
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${id}.json`), 'utf-8');
    return JSON.parse(raw) as AnalysisEntry;
  } catch {
    return null;
  }
}
