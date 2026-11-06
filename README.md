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


# Taskflow — Production-Grade Full-Stack Deployment

Taskflow is a containerized full-stack application deployed using Docker Compose on AWS EC2. It uses Next.js, NestJS, PostgreSQL, Redis, and BullMQ for background job processing.

## Architecture

| Component          | Technology          | Port |
| ------------------ | ------------------- | ---- |
| Frontend           | Next.js             | 3000 |
| Backend            | NestJS              | 4000 |
| Database           | PostgreSQL          | 5432 |
| Queue              | Redis               | 6379 |
| Worker             | Node.js + BullMQ    | -    |
| Cloud              | AWS EC2             | -    |
| Containerization   | Docker Compose      | -    |
| CI/CD              | GitHub Actions      | -    |
| Container Registry | GHCR                | -    |
| Secrets            | AWS Secrets Manager | -    |

### Application Flow

```text
User / Browser
      |
      v
Next.js Frontend (:3000)
      |
      v
NestJS Backend (:4000)
      |
      +------> PostgreSQL
      |
      +------> Redis (BullMQ Queue)
                       |
                       v
                 Node.js Worker

GitHub Actions ---> GHCR ---> AWS EC2
AWS Secrets Manager ---> Application Environment
AWS IAM Role ---> Secure AWS Access
```

## Prerequisites

For local development:

- Docker
- Docker Compose

For production:

- AWS EC2 Ubuntu instance
- Docker Engine
- Docker Compose plugin
- AWS IAM Role with required Secrets Manager permissions
- GitHub repository and GHCR access

## Run Locally

Node.js does not need to be installed on your local machine. Docker builds and runs all application services.

### 1. Clone the Repository

```bash
git clone https://github.com/<OWNER>/<REPOSITORY>.git
cd <REPOSITORY>
```

### 2. Build and Start Services

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 3. Access the Application

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend Health: [http://localhost:4000/api/health](http://localhost:4000/api/health)

### 4. Stop the Application

```bash
docker compose -f docker-compose.prod.yml down
```

The named PostgreSQL volume is retained when using this command.

## Production Deployment on AWS EC2

### Step 1: Create a Secret in AWS Secrets Manager

1. Open AWS Console.
2. Navigate to AWS Secrets Manager.
3. Select **Store a new secret**.
4. Choose **Other type of secret**.
5. Add the following JSON values.
6. Name the secret `taskflow/production` and save it.

### Environment Variables

```json
{
  "PORT": "4000",
  "CORS_ORIGIN": "http://<EC2_PUBLIC_IP_OR_DOMAIN>",
  "DB_HOST": "<POSTGRES_SERVICE_NAME>",
  "DB_PORT": "5432",
  "DB_USER": "<DB_USERNAME>",
  "DB_PASSWORD": "<STRONG_DB_PASSWORD>",
  "DB_NAME": "<DB_NAME>",
  "REDIS_HOST": "<REDIS_SERVICE_NAME>",
  "REDIS_PORT": "6379",
  "WORKER_CONCURRENCY": "2"
}
```

Replace all placeholders with actual production values.

**Important:** `DB_HOST` and `REDIS_HOST` must match the service names defined in your Docker Compose configuration. Use the actual frontend origin for `CORS_ORIGIN`.

### Step 2: Install Docker on EC2

Connect to your Ubuntu EC2 instance and execute:

```bash
sudo apt-get update

sudo apt-get install -y docker.io docker-compose-v2 git

sudo systemctl enable --now docker

sudo docker --version
sudo docker compose version
```

### Step 3: Clone the Repository

```bash
git clone https://github.com/<OWNER>/<REPOSITORY>.git

cd <REPOSITORY>
```

Ensure EC2 has access to the repository.

### Step 4: Configure AWS IAM Role

Attach an IAM role to the EC2 instance with least-privilege permission to retrieve the required secret from AWS Secrets Manager.

The deployment script must retrieve the secret and securely inject its values into the Docker Compose environment.

### Step 5: Pull Production Images

```bash
sudo docker compose -f docker-compose.prod.yml pull
```

### Step 6: Start Production Containers

```bash
sudo docker compose -f docker-compose.prod.yml up -d
```

### Step 7: Verify Deployment

```bash
sudo docker compose ps

sudo docker ps -a

sudo docker logs <container_name>

curl http://localhost:4000/api/health
```

## CI/CD Pipeline

GitHub Actions automates the production deployment process.

Deployment workflow:

1. Developer pushes code to the `main` branch.
2. GitHub Actions builds frontend, backend, and worker Docker images.
3. Images are tagged and pushed to GitHub Container Registry (GHCR).
4. GitHub Actions connects to EC2 through SSH.
5. Required configuration is retrieved from AWS Secrets Manager using AWS CLI and the configured AWS identity.
6. Docker Compose pulls the latest images.
7. Application containers are restarted.

```text
Developer
    |
    v
GitHub Repository
    |
    v
GitHub Actions
    |
    v
Build Docker Images
    |
    v
GitHub Container Registry
    |
    v
SSH into AWS EC2
    |
    v
Pull Images & Deploy
    |
    v
Production Application
```

## Reliability & Security

### 1. Container Restart Policy

Containers use:

```yaml
restart: unless-stopped
```

Docker automatically attempts to restart containers after unexpected exits.

### 2. Secrets Management

- Secrets are stored in AWS Secrets Manager.
- EC2 accesses secrets through an attached IAM role.
- No sensitive `.env` files or credentials are committed to Git.
- Runtime secret files, if used, must have restricted permissions.

### 3. Database Persistence

PostgreSQL uses a named Docker volume:

```yaml
volumes:
  pgdata:
```

This preserves database data across container recreation.

### 4. Rollback Strategy

Docker images are tagged using Git commit SHA.

To roll back:

1. Update the image tag in `docker-compose.prod.yml` to the previous commit SHA.
2. Pull the previous image.
3. Restart the application.

```bash
sudo docker compose  -f docker-compose.prod.yml pull

sudo docker compose  -f docker-compose.prod.yml up -d
```

### 5. Monitoring & Troubleshooting

Check container status:

```bash
docker ps -a
```

View application logs:

```bash
docker logs <container_name>
```

Check API health:

```bash
curl http://localhost:4000/api/health
```

The health endpoint checks PostgreSQL and Redis connectivity. Docker health checks monitor individual container health.

---

## Important Notes

- Never commit AWS credentials, database passwords, or secret values to GitHub.
- Ensure EC2 security groups allow only required inbound traffic.
- Use HTTPS for production application access.
- Keep PostgreSQL persistent volumes safe during deployments.
- Verify application health after every deployment.
- Ensure the deployment workflow explicitly fetches and injects Secrets Manager values; creating a secret alone does not automatically configure containers.

## Project Summary

Taskflow demonstrates a production-oriented deployment workflow using Docker, Docker Compose, AWS EC2, GitHub Actions, GHCR, AWS Secrets Manager, PostgreSQL, Redis, and BullMQ.

The architecture focuses on containerization, automated deployment, secure configuration management, persistent storage, health checks, and rollback capability.

