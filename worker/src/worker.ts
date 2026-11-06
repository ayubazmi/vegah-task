import 'dotenv/config';
import { Worker, Job as BullJob } from 'bullmq';
import { Pool } from 'pg';

const QUEUE = 'jobs'; // backend ke JOBS_QUEUE jaisa hi naam hona chahiye

const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'taskflow',
});

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
};

interface JobData {
  jobId: string;
  task: string;
  input: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Actual "kaam" jo worker karta hai ----
function runTask(task: string, input: string): Record<string, unknown> {
  switch (task) {
    case 'word-count': {
      const words = input.trim().split(/\s+/).filter(Boolean);
      return {
        words: words.length,
        characters: input.length,
        uniqueWords: new Set(words.map((w) => w.toLowerCase())).size,
      };
    }
    case 'reverse-text':
      return { reversed: [...input].reverse().join('') };
    case 'fibonacci': {
      const n = Number.parseInt(input, 10);
      if (!Number.isInteger(n) || n < 0 || n > 1000) {
        throw new Error('Input 0 se 1000 ke beech ka number hona chahiye');
      }
      let a = 0n;
      let b = 1n;
      for (let i = 0; i < n; i++) [a, b] = [b, a + b];
      return { n, value: a.toString() };
    }
    case 'failing-job':
      throw new Error('Simulated failure: yeh job jaan-bujh ke fail hoti hai');
    default:
      throw new Error(`Unknown task: ${task}`);
  }
}

const worker = new Worker<JobData>(
  QUEUE,
  async (job: BullJob<JobData>) => {
    const { jobId, task, input } = job.data;

    await pool.query(
      `UPDATE jobs SET status = 'processing', started_at = COALESCE(started_at, NOW()), error = NULL WHERE id = $1`,
      [jobId],
    );

    // Heavy kaam ka dikhava: 2-5 second wait, taaki UI me status change dikhe
    await sleep(2000 + Math.random() * 3000);

    const result = runTask(task, input);

    await pool.query(
      `UPDATE jobs SET status = 'completed', result = $2::jsonb, completed_at = NOW() WHERE id = $1`,
      [jobId, JSON.stringify(result)],
    );
    return result;
  },
  { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2) },
);

worker.on('ready', () => console.log(`[worker] ready, listening on queue "${QUEUE}"`));
worker.on('completed', (job) => console.log(`[worker] job ${job.id} completed`));

worker.on('failed', async (job, err) => {
  if (!job) return;
  const isFinal = job.attemptsMade >= (job.opts.attempts ?? 1);
  console.error(`[worker] job ${job.id} failed (attempt ${job.attemptsMade}): ${err.message}`);
  try {
    if (isFinal) {
      await pool.query(
        `UPDATE jobs SET status = 'failed', error = $2, completed_at = NOW() WHERE id = $1`,
        [job.data.jobId, err.message],
      );
    } else {
      // retry aane wala hai -> wapas queued dikhao
      await pool.query(`UPDATE jobs SET status = 'queued', error = $2 WHERE id = $1`, [
        job.data.jobId,
        `Retry ${job.attemptsMade}: ${err.message}`,
      ]);
    }
  } catch (dbErr) {
    console.error('[worker] could not update failed status', dbErr);
  }
});

worker.on('error', (err) => console.error('[worker] error', err.message));

// Graceful shutdown (Docker stop / Ctrl+C)
async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received, shutting down...`);
  await worker.close();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
