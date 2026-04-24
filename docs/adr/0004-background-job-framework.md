# 0004: Background Job Framework

**Status:** Accepted

## Context

Several flows require deferred or scheduled execution: pool matching calls (cron), no-show detection (one-shot delay), meeting warning at T-2 minutes, meeting expiry at T-0, and push dispatch fan-out. Requirements: durable queue, retries, scheduled and repeatable jobs, observability, and horizontal scaling.

## Decision

- **Framework:** [BullMQ](https://docs.bullmq.io/) backed by Redis. Integrated via `@nestjs/bullmq`.
- **Queues** (one per job type, names defined in `packages/shared/src/jobs/payloads.ts`):
  - `scheduled-call` — repeatable per pool, fires at the pool's configured cron expression.
  - `no-show` — delayed one-shot, scheduled at match creation.
  - `meeting-warning`, `meeting-expiry` — delayed one-shots, scheduled at meeting begin.
  - `push-dispatch` — fan-out, fired alongside critical WS emissions.
- **Payload typing:** every queue has a typed payload interface in the shared package consumed by both producer and consumer. No untyped `any` job data.
- **Idempotency:** every handler must be safe to run twice with the same payload. Achieved via:
  - Idempotency keys on the BullMQ job `jobId` (e.g. `scheduled-call:<poolId>:<isoTimestamp>`).
  - Conditional state checks before mutation (e.g. `MeetingWarningJob` only emits if the match is still in `MEETING` state).
  - Database constraints (unique on `(matchId, sessionId)` for `MeetingConfirmation`).
- **Retries:** exponential backoff. Defaults: 5 attempts with backoff `1s → 5s → 25s → 2m → 10m`. Push dispatch may be more aggressive; scheduled-call must not retry past the next scheduled fire.
- **Repeatable scheduling:** pool matching calls are registered as BullMQ repeatable jobs keyed on `poolId`, re-registered when `callSchedule` changes. The producer is responsible for cleaning up obsolete repeatable definitions on pool archive.
- **Observability:** every job logs `jobId`, `queue`, `attempt`, and `module`. Failed jobs are surfaced in structured logs with the error stack and payload (with PII redacted).
- **Concurrency:** per-queue concurrency limits configured at boot. Matching jobs run with concurrency 1 per pool to avoid graph races.

## Consequences

- Redis becomes a hard runtime dependency for all background work; reflected in `docker-compose.yml`.
- Idempotency requirement is up-front discipline but eliminates a class of double-emission bugs on retry.
- Scheduled-call cron lives in pool config and is registered/unregistered at the data-mutation boundary; this requires careful lifecycle handling on pool archive (covered by integration tests in M5).
