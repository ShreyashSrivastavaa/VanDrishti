import { query } from '../db/client.js';

export interface EnqueueJobOptions {
  type: 'ingest_observations' | 'compute_forest_mask' | 'run_change_analysis';
  payload: Record<string, any>;
  runAfter?: Date;
}

export async function enqueueJob(options: EnqueueJobOptions): Promise<string> {
  const { type, payload, runAfter } = options;

  // Check global limit of queued jobs
  const maxQueued = parseInt(process.env.MAX_QUEUED_JOBS || '20', 10);
  const { rows: countRows } = await query(
    `SELECT count(*) as count FROM jobs WHERE status = 'queued'`
  );
  if (parseInt(countRows[0].count, 10) >= maxQueued) {
    const error: any = new Error('Job queue is currently full. Please try again later.');
    error.status = 429;
    error.code = 'QUEUE_FULL';
    throw error;
  }

  const { rows } = await query(
    `
    INSERT INTO jobs (type, payload, status, run_after)
    VALUES ($1, $2, 'queued', COALESCE($3, NOW()))
    RETURNING id
    `,
    [type, JSON.stringify(payload), runAfter || null]
  );

  return rows[0].id;
}

export async function getJob(id: string) {
  const { rows } = await query(
    `
    SELECT id, type, payload, status, attempts, error, result, created_at, updated_at
    FROM jobs
    WHERE id = $1
    `,
    [id]
  );
  return rows[0] || null;
}
