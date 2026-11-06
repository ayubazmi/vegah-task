'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Status = 'queued' | 'processing' | 'completed' | 'failed';

interface JobItem {
  id: string;
  task: string;
  input: string;
  status: Status;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface Health {
  status: string;
  checks?: { database: string; redis: string };
}

const TASKS = [
  { id: 'word-count', title: 'Count words', hint: 'Paste any text', placeholder: 'The quick brown fox jumps over the lazy dog', icon: 'Aa' },
  { id: 'reverse-text', title: 'Reverse text', hint: 'Flip it backwards', placeholder: 'Hello from the worker', icon: '⇄' },
  { id: 'fibonacci', title: 'Fibonacci', hint: 'A number from 0 to 1000', placeholder: '90', icon: 'Fn' },
  { id: 'failing-job', title: 'Fail on purpose', hint: 'Watch retries and errors', placeholder: 'anything', icon: '!' },
];

const secs = (a: string | null, b: string | null) =>
  a && b ? ((new Date(b).getTime() - new Date(a).getTime()) / 1000).toFixed(1) + 's' : null;

function Node({ name, detail, state, busy }: { name: string; detail: string; state: 'up' | 'down' | 'idle'; busy?: boolean }) {
  return (
    <div className={`node node-${state} ${busy ? 'node-busy' : ''}`}>
      <span className="node-dot" />
      <strong>{name}</strong>
      <small>{detail}</small>
    </div>
  );
}

function JobCard({ job }: { job: JobItem }) {
  const task = TASKS.find((t) => t.id === job.task);
  const took = secs(job.startedAt, job.completedAt);
  return (
    <article className={`job job-${job.status}`}>
      <header>
        <span className="job-task">{task?.title ?? job.task}</span>
        <span className={`badge badge-${job.status}`}>{job.status}</span>
      </header>
      <p className="job-input" title={job.input}>{job.input}</p>

      {job.status === 'processing' && <div className="bar" aria-label="Processing" />}

      {job.status === 'completed' && job.result && (
        <dl className="result">
          {Object.entries(job.result).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd title={String(v)}>{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {job.error && <p className="job-error">{job.error}</p>}

      <footer>
        <code>{job.id.slice(0, 8)}</code>
        <span>{took ? `took ${took}` : new Date(job.createdAt).toLocaleTimeString()}</span>
      </footer>
    </article>
  );
}

function Lane({ title, note, jobs, tone }: { title: string; note: string; jobs: JobItem[]; tone: string }) {
  return (
    <section className={`lane lane-${tone}`}>
      <h2>
        {title} <span className="count">{jobs.length}</span>
      </h2>
      <p className="lane-note">{note}</p>
      <div className="lane-body">
        {jobs.length === 0 ? <p className="empty">Nothing here yet.</p> : jobs.map((j) => <JobCard key={j.id} job={j} />)}
      </div>
    </section>
  );
}

export default function Home() {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [offline, setOffline] = useState(false);
  const [task, setTask] = useState(TASKS[0].id);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [j, h] = await Promise.all([
        fetch(`${API}/api/jobs`, { cache: 'no-store' }),
        fetch(`${API}/api/health`, { cache: 'no-store' }),
      ]);
      setJobs(await j.json());
      setHealth(await h.json());
      setOffline(false);
    } catch {
      setOffline(true);
      setHealth(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSending(true);
    try {
      const res = await fetch(`${API}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, input }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
        throw new Error(msg || 'Could not queue the job');
      }
      setInput('');
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not reach the API');
    } finally {
      setSending(false);
    }
  }

  const current = TASKS.find((t) => t.id === task)!;
  const queued = jobs.filter((j) => j.status === 'queued');
  const processing = jobs.filter((j) => j.status === 'processing');
  const completed = jobs.filter((j) => j.status === 'completed');
  const failed = jobs.filter((j) => j.status === 'failed');
  const finished = jobs.filter((j) => j.status === 'completed' || j.status === 'failed');

  const apiUp = !offline && health?.status === 'ok';
  const st = (v?: string) => (offline ? 'down' : v === 'up' ? 'up' : 'down') as 'up' | 'down';

  return (
    <main>
      <header className="top">
        <div>
          <h1>Dispatch Board</h1>
          <p className="sub">
            Submit a job and watch it travel: API, Redis queue, worker, database. Everything below updates live.
          </p>
        </div>
        <div className="stats">
          <div><b>{jobs.length}</b><span>total</span></div>
          <div><b>{completed.length}</b><span>done</span></div>
          <div><b>{failed.length}</b><span>failed</span></div>
        </div>
      </header>

      {offline && (
        <div className="alert">
          Can’t reach the API at <code>{API}</code>. Start the backend (<code>npm run start:dev</code> in <code>backend/</code>) and check Postgres and Redis are running.
        </div>
      )}

      <section className="pipeline" aria-label="Live system status">
        <Node name="Frontend" detail="Next.js :3000" state="up" />
        <span className="arrow" />
        <Node name="API" detail={apiUp ? 'NestJS :4000' : 'unreachable'} state={offline ? 'down' : health?.status === 'ok' ? 'up' : 'down'} />
        <span className="arrow" />
        <Node name="Redis queue" detail={`${queued.length} waiting`} state={st(health?.checks?.redis)} busy={queued.length > 0} />
        <span className="arrow" />
        <Node name="Worker" detail={`${processing.length} running`} state={offline ? 'down' : 'up'} busy={processing.length > 0} />
        <span className="arrow" />
        <Node name="Postgres" detail={`${finished.length} saved`} state={st(health?.checks?.database)} />
      </section>

      <div className="grid">
        <form className="composer" onSubmit={submit}>
          <h2>New job</h2>
          <div className="tasks" role="radiogroup" aria-label="Job type">
            {TASKS.map((t) => (
              <button
                type="button"
                key={t.id}
                role="radio"
                aria-checked={task === t.id}
                className={`task ${task === t.id ? 'on' : ''}`}
                onClick={() => setTask(t.id)}
              >
                <span className="task-icon">{t.icon}</span>
                <span>
                  <strong>{t.title}</strong>
                  <small>{t.hint}</small>
                </span>
              </button>
            ))}
          </div>

          <label htmlFor="input">Input</label>
          <textarea
            id="input"
            rows={4}
            value={input}
            maxLength={500}
            placeholder={current.placeholder}
            onChange={(e) => setInput(e.target.value)}
          />
          {formError && <p className="form-error">{formError}</p>}
          <button className="submit" disabled={sending || !input.trim()}>
            {sending ? 'Queuing…' : 'Queue job'}
          </button>
        </form>

        <div className="board">
          <Lane tone="queued" title="Waiting" note="In the Redis queue" jobs={queued} />
          <Lane tone="processing" title="Processing" note="A worker has it" jobs={processing} />
          <Lane tone="done" title="Finished" note="Result stored in Postgres" jobs={finished} />
        </div>
      </div>
    </main>
  );
}
