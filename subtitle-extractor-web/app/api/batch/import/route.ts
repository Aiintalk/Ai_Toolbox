import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  generateJobId,
  generateAccessCode,
  registerAccessCode,
  writeJob,
  updateItem,
  updateJob,
  type BatchItem,
  type BatchJob,
} from "@/lib/batch-store";
import { fetchVideoByShareUrl } from "@/lib/tikhub";
import { submitTranscription, pollTranscription } from "@/lib/aliyun-asr";

const MAX_ROWS = 200;
const ASR_POLL_INTERVAL_MS = 5000;
const ASR_POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes per item

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractUrls(rows: unknown[][]): string[] {
  return rows
    .map((row) => String(row[0] ?? "").trim())
    .filter((cell) => cell.includes("douyin.com") || cell.includes("http"));
}

async function pollUntilDone(taskId: string): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < ASR_POLL_TIMEOUT_MS) {
    const result = await pollTranscription(taskId);
    if (result.status === "done") return result.text ?? "";
    await sleep(ASR_POLL_INTERVAL_MS);
  }
  throw new Error("ASR 转写超时（5分钟）");
}

async function processItem(jobId: string, item: BatchItem): Promise<void> {
  updateItem(jobId, item.rowNumber, { status: "processing" });

  try {
    // Step 1: Parse video
    const videoInfo = await fetchVideoByShareUrl(item.originalUrl);
    updateItem(jobId, item.rowNumber, { title: videoInfo.title });

    if (!videoInfo.audioUrl) {
      throw new Error("未获取到音频地址");
    }

    // Step 2: Submit ASR directly with audio URL (no OSS needed)
    const taskId = await submitTranscription(videoInfo.audioUrl);

    // Step 3: Poll until done
    const transcript = await pollUntilDone(taskId);

    updateItem(jobId, item.rowNumber, {
      transcript,
      status: "success",
      error: "",
    });
  } catch (err) {
    updateItem(jobId, item.rowNumber, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

const SUBMIT_CONCURRENCY = 8; // 并发提交（TikHub + ASR submit）

async function processBatchJob(jobId: string, items: BatchItem[]): Promise<void> {
  // ── 阶段一：并发解析视频 + 提交 ASR ────────────────────────────
  updateJob(jobId, { phase: "提交转写任务中" });

  const taskMap = new Map<number, string>(); // rowNumber → ASR taskId

  const submitQueue = [...items];
  async function submitWorker() {
    while (submitQueue.length > 0) {
      const item = submitQueue.shift();
      if (!item) break;
      updateItem(jobId, item.rowNumber, { status: "processing" });
      try {
        const videoInfo = await fetchVideoByShareUrl(item.originalUrl);
        updateItem(jobId, item.rowNumber, { title: videoInfo.title });
        if (!videoInfo.audioUrl) throw new Error("未获取到音频地址");
        const taskId = await submitTranscription(videoInfo.audioUrl);
        taskMap.set(item.rowNumber, taskId);
      } catch (err) {
        updateItem(jobId, item.rowNumber, {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const submitWorkers = Array.from(
    { length: Math.min(SUBMIT_CONCURRENCY, items.length) },
    submitWorker
  );
  await Promise.all(submitWorkers);

  // ── 阶段二：所有已提交任务同时轮询（Aliyun 并行处理）────────────
  updateJob(jobId, { phase: "转写中" });

  const pollTargets = items.filter((item) => taskMap.has(item.rowNumber));

  await Promise.all(
    pollTargets.map(async (item) => {
      const taskId = taskMap.get(item.rowNumber)!;
      try {
        const transcript = await pollUntilDone(taskId);
        updateItem(jobId, item.rowNumber, { transcript, status: "success", error: "" });
      } catch (err) {
        updateItem(jobId, item.rowNumber, {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  updateJob(jobId, { status: "completed", phase: "已完成" });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: "buffer" });
    } catch {
      return NextResponse.json({ error: "Excel 解析失败" }, { status: 500 });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][];

    // Skip header row (first row) if it doesn't look like a URL
    const dataRows = rows.filter((row) => {
      const cell = String(row[0] ?? "").trim();
      return cell.includes("douyin.com") || cell.startsWith("http");
    });

    const urls = extractUrls(dataRows);

    if (urls.length === 0) {
      return NextResponse.json(
        { error: "Excel 为空或未找到有效链接" },
        { status: 400 }
      );
    }

    if (urls.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Excel 最多支持 ${MAX_ROWS} 条，当前 ${urls.length} 条` },
        { status: 400 }
      );
    }

    const jobId = generateJobId();
    const accessCode = generateAccessCode();
    const now = new Date().toISOString();

    const items: BatchItem[] = urls.map((url, index) => ({
      rowNumber: index + 1,
      originalUrl: url,
      title: "",
      transcript: "",
      status: "pending",
      error: "",
    }));

    const job: BatchJob = {
      jobId,
      accessCode,
      status: "processing",
      phase: "初始化",
      total: items.length,
      success: 0,
      failed: 0,
      items,
      createdAt: now,
      updatedAt: now,
    };

    writeJob(job);
    registerAccessCode(accessCode, jobId);

    // Fire-and-forget background processing
    // next start runs as a persistent Node.js process, so this works
    processBatchJob(jobId, items).catch((err) => {
      console.error(`batch job ${jobId} failed:`, err);
      updateJob(jobId, { status: "failed", phase: "任务异常终止" });
    });

    return NextResponse.json({ jobId, accessCode, total: items.length });
  } catch (err) {
    console.error("batch import error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
