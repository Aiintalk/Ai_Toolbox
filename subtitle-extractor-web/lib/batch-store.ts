import crypto from "crypto";
import { getDb } from "./db";

// ── Types ─────────────────────────────────────────────────────

export type ItemStatus = "pending" | "processing" | "success" | "failed";
export type JobStatus  = "processing" | "completed" | "failed";

export interface BatchItem {
  rowNumber:   number;
  originalUrl: string;
  title:       string;
  transcript:  string;
  status:      ItemStatus;
  error:       string;
}

export interface BatchJob {
  jobId:      string;
  accessCode: string;
  status:     JobStatus;
  phase:      string;
  total:      number;
  success:    number;
  failed:     number;
  items:      BatchItem[];
  createdAt:  string;
  updatedAt:  string;
}

// ── ID / Code generation ──────────────────────────────────────

export function generateJobId(): string {
  const datePart = new Date().toISOString().replace(/[-T:]/g, "").slice(0, 14);
  const rand = crypto.randomBytes(4).toString("hex");
  return `job_${datePart}_${rand}`;
}

/** Short user-friendly access code like "ABCD-1234" (no ambiguous chars) */
export function generateAccessCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const part = (n: number) =>
    Array.from(
      { length: n },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  return `${part(4)}-${part(4)}`;
}

// ── Access-code index ─────────────────────────────────────────

export function registerAccessCode(accessCode: string, jobId: string): void {
  // Access codes are stored as a UNIQUE column on batch_jobs itself —
  // no separate index table needed.  This function is a no-op kept for
  // API compatibility (the code is already persisted inside writeJob).
  void accessCode;
  void jobId;
}

export function findJobByCode(accessCode: string): BatchJob | null {
  const db = getDb();
  const row = db
    .prepare("SELECT job_id FROM batch_jobs WHERE access_code = ?")
    .get(accessCode.toUpperCase().trim()) as { job_id: string } | undefined;
  if (!row) return null;
  return readJob(row.job_id);
}

// ── Job CRUD ─────────────────────────────────────────────────

export function readJob(jobId: string): BatchJob | null {
  const db = getDb();

  const jobRow = db
    .prepare("SELECT * FROM batch_jobs WHERE job_id = ?")
    .get(jobId) as DbJobRow | undefined;
  if (!jobRow) return null;

  const itemRows = db
    .prepare(
      "SELECT * FROM batch_items WHERE job_id = ? ORDER BY row_number ASC"
    )
    .all(jobId) as DbItemRow[];

  return rowsToJob(jobRow, itemRows);
}

export function writeJob(job: BatchJob): void {
  const db = getDb();

  const upsertJob = db.prepare(`
    INSERT INTO batch_jobs (job_id, access_code, status, phase, total, success, failed, created_at, updated_at)
    VALUES (@jobId, @accessCode, @status, @phase, @total, @success, @failed, @createdAt, @updatedAt)
    ON CONFLICT(job_id) DO UPDATE SET
      access_code = excluded.access_code,
      status      = excluded.status,
      phase       = excluded.phase,
      total       = excluded.total,
      success     = excluded.success,
      failed      = excluded.failed,
      updated_at  = excluded.updated_at
  `);

  const upsertItem = db.prepare(`
    INSERT INTO batch_items (job_id, row_number, original_url, title, transcript, status, error)
    VALUES (@jobId, @rowNumber, @originalUrl, @title, @transcript, @status, @error)
    ON CONFLICT(job_id, row_number) DO UPDATE SET
      original_url = excluded.original_url,
      title        = excluded.title,
      transcript   = excluded.transcript,
      status       = excluded.status,
      error        = excluded.error
  `);

  const writeAll = db.transaction(() => {
    upsertJob.run({
      jobId:      job.jobId,
      accessCode: job.accessCode.toUpperCase(),
      status:     job.status,
      phase:      job.phase,
      total:      job.total,
      success:    job.success,
      failed:     job.failed,
      createdAt:  job.createdAt,
      updatedAt:  job.updatedAt,
    });
    for (const item of job.items) {
      upsertItem.run({
        jobId:       job.jobId,
        rowNumber:   item.rowNumber,
        originalUrl: item.originalUrl,
        title:       item.title,
        transcript:  item.transcript,
        status:      item.status,
        error:       item.error,
      });
    }
  });

  writeAll();
}

export function updateJob(jobId: string, patch: Partial<BatchJob>): void {
  const job = readJob(jobId);
  if (!job) return;
  writeJob({ ...job, ...patch, updatedAt: new Date().toISOString() });
}

export function updateItem(
  jobId: string,
  rowNumber: number,
  patch: Partial<BatchItem>
): void {
  const db = getDb();

  // Update only the changed columns for this item
  db.prepare(`
    UPDATE batch_items
    SET
      original_url = COALESCE(@originalUrl, original_url),
      title        = COALESCE(@title,       title),
      transcript   = COALESCE(@transcript,  transcript),
      status       = COALESCE(@status,      status),
      error        = COALESCE(@error,       error)
    WHERE job_id = @jobId AND row_number = @rowNumber
  `).run({
    jobId,
    rowNumber,
    originalUrl: patch.originalUrl ?? null,
    title:       patch.title       ?? null,
    transcript:  patch.transcript  ?? null,
    status:      patch.status      ?? null,
    error:       patch.error       ?? null,
  });

  // Recalculate aggregates in the parent job row
  const counts = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success,
      SUM(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END) AS failed
    FROM batch_items WHERE job_id = ?
  `).get(jobId) as { success: number; failed: number };

  db.prepare(`
    UPDATE batch_jobs
    SET success = ?, failed = ?, updated_at = ?
    WHERE job_id = ?
  `).run(counts.success ?? 0, counts.failed ?? 0, new Date().toISOString(), jobId);
}

// ── Internal helpers ──────────────────────────────────────────

interface DbJobRow {
  job_id:      string;
  access_code: string;
  status:      string;
  phase:       string;
  total:       number;
  success:     number;
  failed:      number;
  created_at:  string;
  updated_at:  string;
}

interface DbItemRow {
  row_number:   number;
  original_url: string;
  title:        string;
  transcript:   string;
  status:       string;
  error:        string;
}

function rowsToJob(job: DbJobRow, items: DbItemRow[]): BatchJob {
  return {
    jobId:      job.job_id,
    accessCode: job.access_code,
    status:     job.status as JobStatus,
    phase:      job.phase,
    total:      job.total,
    success:    job.success,
    failed:     job.failed,
    createdAt:  job.created_at,
    updatedAt:  job.updated_at,
    items: items.map((i) => ({
      rowNumber:   i.row_number,
      originalUrl: i.original_url,
      title:       i.title,
      transcript:  i.transcript,
      status:      i.status as ItemStatus,
      error:       i.error,
    })),
  };
}
