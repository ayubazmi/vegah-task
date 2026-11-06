# Dispatch Board — Next.js + NestJS + PostgreSQL + Redis (BullMQ)

## Flow (ek parcel ki journey).

```
Browser (Next.js :3000)
   │  POST /api/jobs
   ▼
NestJS API (:4000) ──► Postgres  (job row, status = queued)
   │
   └──────────────────► Redis queue "jobs"   (BullMQ)
                              │
                              ▼
                        Worker (Node)  ──► Postgres (processing → completed / failed)
                                                  ▲
Browser ── GET /api/jobs (har 2 sec) ─────────────┘
```

## Local run

```bash
# 1) Postgres + Redis (Docker se)
docker compose -f docker-compose.dev.yml up -d

# 2) Backend  (terminal 1)
cd backend && cp .env.example .env && npm install && npm run start:dev

# 3) Worker   (terminal 2)  -- backend ke baad start karna (table backend banata hai)
cd worker && cp .env.example .env && npm install && npm run dev

# 4) Frontend (terminal 3)
cd frontend && cp .env.example .env.local && npm install && npm run dev
```

Open http://localhost:3000

## API

| Method | URL | Kaam |
|---|---|---|
| POST | /api/jobs | Job banao `{ "task": "word-count", "input": "hello world" }` |
| GET | /api/jobs | Latest 30 jobs |
| GET | /api/jobs/:id | Ek job ka status/result |
| GET | /api/health | API + Postgres + Redis health |

Tasks: `word-count`, `reverse-text`, `fibonacci`, `failing-job`
