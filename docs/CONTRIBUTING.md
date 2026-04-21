# Developer Bootstrap Guide

This document explains how to get the Someone Meetup monorepo running locally from a clean checkout.

---

## Prerequisites

| Tool       | Version   | Install                              |
|------------|-----------|--------------------------------------|
| Node.js    | 20 LTS    | https://nodejs.org or `nvm`          |
| pnpm       | ≥ 9       | `npm install -g pnpm`                |
| Docker     | ≥ 24      | https://docs.docker.com/get-docker/  |
| Docker Compose | ≥ 2.20 | Included with Docker Desktop        |

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url> someone
cd someone

# 2. Copy environment file
cp apps/backend/.env.example apps/backend/.env

# 3. Install dependencies (from repo root)
pnpm install

# 4. Start all services
docker compose up
```

After a successful startup:

| Service  | URL                       |
|----------|---------------------------|
| Frontend | http://localhost:4200     |
| Backend  | http://localhost:3000     |
| Health   | http://localhost:3000/health |
| Postgres | localhost:5432            |
| Redis    | localhost:6379            |

---

## Environment Variables

All required environment variables are in `apps/backend/.env.example`. Copy to `.env` before starting.

| Variable       | Default                                            | Description                  |
|----------------|----------------------------------------------------|------------------------------|
| `NODE_ENV`     | `development`                                      | Runtime environment          |
| `PORT`         | `3000`                                             | Backend HTTP port            |
| `LOG_LEVEL`    | `debug`                                            | Pino log level               |
| `DATABASE_URL` | `postgresql://someone:someone@localhost:5432/someone_dev` | Postgres connection string |
| `REDIS_HOST`   | `localhost`                                        | Redis hostname               |
| `REDIS_PORT`   | `6379`                                             | Redis port                   |

---

## Running Without Docker

### Backend

```bash
# Start Postgres and Redis only via Docker
docker compose up postgres redis

# Run backend in watch mode
pnpm --filter @someone/backend start:dev
```

### Frontend

```bash
# Run frontend dev server (proxies /api to backend)
pnpm --filter @someone/frontend start:dev
```

---

## Useful Commands

```bash
# Install all dependencies
pnpm install

# Type-check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Auto-format all files
pnpm format

# Check formatting without writing
pnpm format:check

# Run unit tests (backend)
pnpm --filter @someone/backend test:unit

# Build all packages
pnpm build
```

---

## Troubleshooting

### Postgres connection refused

**Symptom:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Fix:** Ensure the `postgres` container is healthy before starting the backend:

```bash
docker compose up postgres
docker compose ps postgres  # status should be "healthy"
```

Check that `DATABASE_URL` in `apps/backend/.env` matches the Docker Compose credentials (`someone:someone`).

---

### Redis connection refused

**Symptom:** `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Fix:** Ensure the `redis` container is running:

```bash
docker compose up redis
docker compose ps redis  # status should be "healthy"
```

---

### Port already in use

If another process occupies port `3000`, `4200`, `5432`, or `6379`, stop the conflicting process or update the relevant port mappings in `docker-compose.yml`.

---

### pnpm version mismatch

This repo requires pnpm ≥ 9. Check your version with:

```bash
pnpm --version
```

Upgrade with:

```bash
npm install -g pnpm@latest
```

---

### Hot reload not working in Docker

Ensure the source volumes are mounted correctly. The `docker-compose.yml` mounts `./apps/backend/src` and `./apps/frontend/src` as read-only volumes. If edits are not picked up, restart the relevant container:

```bash
docker compose restart backend
docker compose restart frontend
```
