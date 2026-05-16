import fs from "fs";
import path from "path";
import crypto from "crypto";

const JOB_DIR = path.join(process.cwd(), "data", "batch-jobs");

export type ItemStatus = "pending" | "processing" | "success" | "failed";
export type JobStatus = "processing" | "completed" | "failed";

export interface BatchItem {
  rowNumber: number;
  originalUrl: string;
  title: string;
  transcript: string;
  status: ItemStatus;
  error: string;
}

export interface BatchJob {
  jobId: string;
  status: JobStatus;
  phase: string;
  total: number;
  success: number;
  failed: number;
  items: BatchItem[];
  createdAt: string;
  updatedAt: string;
}

export function generateJobId(): string {
  const now = new Date();
  const datePart = now.toISOString().replace(/[-T:]/g, "").slice(0, 14);
  const rand = crypto.randomBytes(4).toString("hex");
  return `job_${datePart}_${rand}`;
}

function ensureJobDir(): void {
  fs.mkdirSync(JOB_DIR, { recursive: true });
}

export function readJob(jobId: string): BatchJob | null {
  const filePath = path.join(JOB_DIR, `${jobId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as BatchJob;
  } catch {
    return null;
  }
}

export function writeJob(job: BatchJob): void {
  ensureJobDir();
  const filePath = path.join(JOB_DIR, `${job.jobId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(job, null, 2), "utf-8");
}

export function updateJob(jobId: string, patch: Partial<BatchJob>): void {
  const job = readJob(jobId);
  if (!job) return;
  writeJob({ ...job, ...patch, updatedAt: new Date().toISOString() });
}

export function updateItem(jobId: string, rowNumber: number, patch: Partial<BatchItem>): void {
  const job = readJob(jobId);
  if (!job) return;
  const items = job.items.map((item) =>
    item.rowNumber === rowNumber ? { ...item, ...patch } : item
  );
  const success = items.filter((i) => i.status === "success").length;
  const failed = items.filter((i) => i.status === "failed").length;
  writeJob({ ...job, items, success, failed, updatedAt: new Date().toISOString() });
}
