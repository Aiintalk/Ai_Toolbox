import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// ── Config (override via env vars) ────────────────────────────
const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "batch.db");

/** Delete jobs older than this many months (0 = disabled) */
const RETENTION_MONTHS = Number(process.env.BATCH_RETENTION_MONTHS ?? 3);

/** Delete oldest jobs when DB file exceeds this size in MB (0 = disabled) */
const MAX_DB_SIZE_MB = Number(process.env.BATCH_MAX_DB_SIZE_MB ?? 500);

// ── Singleton ─────────────────────────────────────────────────

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  fs.mkdirSync(DB_DIR, { recursive: true });

  _db = new Database(DB_PATH);

  // WAL mode: better concurrency for read-heavy workloads
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  initSchema(_db);
  runCleanup(_db);

  // Schedule daily cleanup while the process is alive
  const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
  const timer = setInterval(() => {
    try {
      runCleanup(getDb());
    } catch (err) {
      console.error("[db] cleanup error:", err);
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't block process exit
  timer.unref();

  return _db;
}

// ── Schema ────────────────────────────────────────────────────

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS batch_jobs (
      job_id       TEXT PRIMARY KEY,
      access_code  TEXT UNIQUE NOT NULL,
      status       TEXT NOT NULL DEFAULT 'processing',
      phase        TEXT NOT NULL DEFAULT '',
      total        INTEGER NOT NULL DEFAULT 0,
      success      INTEGER NOT NULL DEFAULT 0,
      failed       INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_access_code ON batch_jobs(access_code);
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at  ON batch_jobs(created_at);

    CREATE TABLE IF NOT EXISTS batch_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id        TEXT NOT NULL REFERENCES batch_jobs(job_id) ON DELETE CASCADE,
      row_number    INTEGER NOT NULL,
      original_url  TEXT NOT NULL DEFAULT '',
      title         TEXT NOT NULL DEFAULT '',
      transcript    TEXT NOT NULL DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'pending',
      error         TEXT NOT NULL DEFAULT '',
      UNIQUE (job_id, row_number)
    );

    CREATE INDEX IF NOT EXISTS idx_items_job_id ON batch_items(job_id);
  `);
}

// ── Retention cleanup ─────────────────────────────────────────

/**
 * Runs both retention policies:
 * 1. Time-based: delete jobs created more than RETENTION_MONTHS ago
 * 2. Size-based: if the DB file is larger than MAX_DB_SIZE_MB, delete
 *    the oldest jobs (in batches of 10) until it fits
 */
export function runCleanup(db: Database.Database = getDb()): void {
  let deleted = 0;

  // Policy 1 — time-based TTL
  if (RETENTION_MONTHS > 0) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
    const result = db
      .prepare(
        "DELETE FROM batch_jobs WHERE created_at < ?"
      )
      .run(cutoff.toISOString());
    deleted += result.changes;
  }

  // Policy 2 — size-based cleanup (loop until under limit)
  if (MAX_DB_SIZE_MB > 0) {
    const maxBytes = MAX_DB_SIZE_MB * 1024 * 1024;
    while (dbSizeBytes() > maxBytes) {
      const result = db.prepare(`
        DELETE FROM batch_jobs
        WHERE job_id IN (
          SELECT job_id FROM batch_jobs
          ORDER BY created_at ASC
          LIMIT 10
        )
      `).run();
      if (result.changes === 0) break; // nothing left to delete
      deleted += result.changes;
    }
  }

  if (deleted > 0) {
    // Reclaim space after deletions
    db.exec("VACUUM");
    console.log(`[db] cleanup: removed ${deleted} job(s)`);
  }
}

function dbSizeBytes(): number {
  try {
    return fs.statSync(DB_PATH).size;
  } catch {
    return 0;
  }
}
