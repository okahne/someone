# Code Standards

This document defines the code conventions, tooling settings, and workflow rules for all packages in the Someone Meetup monorepo.

---

## 1. Language and Runtime

- **Node.js:** 20 LTS for all backend and tooling code.
- **TypeScript:** Strict mode (`strict: true`) across every package. No implicit `any`. No `ts-ignore` without an accompanying explanation comment.
- The shared `tsconfig.base.json` at the repo root is extended by each package. Individual packages may not relax base strictness settings.

---

## 2. Package Manager

Use `pnpm` exclusively. Do not commit `yarn.lock` or `package-lock.json`. All workspace commands run from the repo root via `pnpm -r` or workspace filters.

---

## 3. Repository and Module Structure

```
/
├── apps/
│   ├── backend/         # NestJS application
│   └── frontend/        # Angular application
├── packages/
│   └── shared/          # Contracts, DTOs, enums, validators
├── docs/                # All project documentation
├── docker-compose.yml
├── .eslintrc.js         # Root ESLint config (extended per package)
├── .prettierrc
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

Backend module folder layout:

```
apps/backend/src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── events/
│   ├── organisers/
│   ├── pools/
│   ├── tags/
│   ├── meeting-spots/
│   ├── sessions/
│   ├── matches/
│   ├── meetings/
│   ├── notifications/
│   ├── realtime/
│   └── audit/
├── common/              # Guards, interceptors, filters, pipes
├── config/              # Env config schemas
└── main.ts
```

Each module contains:

```
<module>/
├── <module>.module.ts
├── <module>.controller.ts      # HTTP layer only; no business logic
├── <module>.service.ts         # Business logic
├── <module>.repository.ts      # Prisma queries (if needed separately)
├── dto/                        # Request/response DTOs (extend shared)
├── <module>.gateway.ts         # WebSocket gateway (if applicable)
└── __tests__/
    ├── <module>.service.spec.ts
    └── <module>.controller.spec.ts
```

---

## 4. Naming Conventions

| Concept            | Convention               | Examples                                  |
|--------------------|--------------------------|-------------------------------------------|
| Files              | kebab-case               | `match-run.service.ts`                    |
| Classes            | PascalCase               | `MatchRunService`                         |
| Interfaces / types | PascalCase, no `I` prefix| `MatchRunResult`, `SingleStateTransition` |
| Enums              | PascalCase, values UPPER_SNAKE | `EventStatus.LIVE`                  |
| Constants          | UPPER_SNAKE_CASE         | `MAX_RECONNECT_WINDOW_SECONDS`            |
| Functions/methods  | camelCase, verb-first    | `findCompatibleSingle()`, `reserveSpot()` |
| Variables          | camelCase                | `matchRunId`, `poolTags`                  |
| Database tables    | snake_case               | `match_run`, `single_session`             |
| Database columns   | snake_case               | `created_at`, `meeting_spot_id`           |
| REST paths         | kebab-case               | `/match-runs/:id`                         |
| WebSocket types    | UPPER_SNAKE_CASE strings | `"MATCH_ASSIGNED"`, `"STATE_SNAPSHOT"`    |
| Angular components | kebab-case selector, PascalCase class | `app-pool-select`, `PoolSelectComponent` |
| Angular services   | PascalCase with `Service` suffix | `MatchService`               |

---

## 5. Linting

ESLint with `@typescript-eslint/eslint-plugin` is required for all TypeScript files.

Required rule settings:

```jsonc
{
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
  "@typescript-eslint/explicit-function-return-type": "warn",
  "no-console": "warn"
}
```

Angular packages additionally use `@angular-eslint/eslint-plugin`.

Run: `pnpm lint` (all packages) or `pnpm --filter <package> lint`.

---

## 6. Formatting

Prettier with the following `.prettierrc`:

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "semi": true
}
```

Formatting is enforced in CI. Run `pnpm format` to apply, `pnpm format:check` to verify.

---

## 7. DTO Validation

- All incoming request bodies are validated using `class-validator` + `class-transformer` via NestJS `ValidationPipe` set globally with `whitelist: true` and `forbidNonWhitelisted: true`.
- Shared DTO classes live in `packages/shared`. Backend controller DTOs extend shared DTOs where appropriate.
- Never accept raw request body types (`any` or plain `object`) in controllers.
- Add `@IsUUID()`, `@IsEnum()`, `@IsString()`, `@IsArray()`, `@IsOptional()` decorators to every DTO field.

---

## 8. Error Handling

- Use NestJS exception filters for all HTTP error responses.
- Throw typed exceptions: `BadRequestException`, `ForbiddenException`, `NotFoundException`, `ConflictException`.
- Never throw raw `Error` instances from service or controller layers.
- Business rule violations (e.g. illegal state transition) throw `ConflictException` with a machine-readable `code` field.
- Unhandled promise rejections must be caught by global exception filters; do not let them crash the process silently.

Error response shape (enforced by global filter):

```json
{
  "statusCode": 409,
  "error": "CONFLICT",
  "message": "Illegal state transition",
  "code": "ILLEGAL_STATE_TRANSITION"
}
```

---

## 9. Structured Logging

- Use `pino` (via `nestjs-pino`) as the logger throughout the backend.
- Log level is configured via the `LOG_LEVEL` environment variable; default is `info` in production, `debug` in development.
- All log entries must include `requestId` (injected by middleware), `module`, and `method` fields at minimum.
- Never log passwords, tokens, session secrets, or OAuth credentials.
- Use `logger.warn` for handled business anomalies and `logger.error` for unexpected failures.

---

## 10. Database Migrations

- Use Prisma with `prisma migrate dev` for generating and applying migrations in development.
- Migration files are committed to source control and are immutable once merged to main.
- Never use `prisma db push` in a shared environment.
- Seed data lives in `apps/backend/prisma/seed.ts` and is run with `pnpm prisma db seed`.
- All migration scripts are reviewed for backwards compatibility before being merged.
- Destructive migrations (column drops, type changes) require a multi-step migration strategy: add → migrate data → remove.

---

## 11. Background Job Conventions

- Use BullMQ backed by Redis for all background jobs.
- Each job type has a typed payload interface defined in `packages/shared/jobs/`.
- Job handlers live in `apps/backend/src/modules/<module>/jobs/`.
- Jobs must be idempotent: running a job twice with the same payload must not cause inconsistent state.
- Failed jobs are retried with exponential backoff; max retries are configured per job type in the queue definition.
- Scheduled jobs (matching calls, meeting timers) are registered via `@nestjs/schedule` or BullMQ repeatable jobs using the pool's configured cron expression.

---

## 12. WebSocket Message Conventions

- All WebSocket message payloads are typed interfaces in `packages/shared/ws/`.
- Every message must have a `type` field using `UPPER_SNAKE_CASE`.
- Server-emitted types are prefixed by noun (e.g. `MATCH_ASSIGNED`, `STATE_CHANGED`).
- Client-emitted types are prefixed by verb (e.g. `AUTH`, `PING`).
- Do not embed logic in gateway handlers; delegate to service methods.
- Use NestJS `@WebSocketGateway` with `@SubscribeMessage` decorators. All gateways are in their respective module folder.

---

## 13. Testing Conventions

### Test runner

- **Unit and integration:** Jest (`ts-jest` preset).
- **End-to-end:** Playwright.

### File naming

| Test type    | File pattern                            |
|--------------|-----------------------------------------|
| Unit         | `*.spec.ts` adjacent to source file     |
| Integration  | `*.int-spec.ts` in `__tests__/`         |
| E2E          | `*.e2e.ts` under `apps/e2e/tests/`      |

### Rules

- Unit tests must not touch the database, file system, or external network.
- Use `jest.mock()` or manual mocks in `__mocks__/` for external dependencies in unit tests.
- Integration tests run against a real Postgres instance provisioned via Docker in CI.
- Each integration test is responsible for its own test data setup and teardown.
- E2E tests run against a full Docker Compose stack.
- Do not use `describe.only` or `it.only` in merged code.
- Test coverage threshold: 80% line coverage required for modules in `apps/backend/src/modules/`.

### AAA pattern

Structure every test as: Arrange, Act, Assert. One assertion cluster per test case.

---

## 14. Commit and PR Standards

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]
[optional footer]
```

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`.

Examples:
- `feat(matching): add Blossom compatibility graph preparation`
- `fix(sessions): reject illegal SEARCHING -> JOINED transition`
- `test(pools): add integration test for rematch prevention`

### Pull requests

- Every PR targets a single logical change.
- PR description links to the relevant milestone ticket.
- PR must pass CI (lint, typecheck, unit tests, integration tests) before merge.
- At least one peer review approval is required.
- Squash merge into main; do not merge commit fixup commits.

---

## 15. ADR Process

Architectural decisions that affect module boundaries, major library choices, transport contracts, or data shape must be documented as Architectural Decision Records under `docs/adr/`.

File naming: `docs/adr/NNNN-short-title.md` (e.g. `docs/adr/0001-auth-session-model.md`).

Each ADR follows this template:

```markdown
# NNNN: Title

**Status:** Proposed | Accepted | Superseded by NNNN

## Context

What problem or decision point prompted this record.

## Decision

What was decided.

## Consequences

What becomes easier or harder as a result.
```

ADRs are immutable once accepted. Supersede, do not edit.

Minimum ADRs to create before development begins (see `docs/implementation-plan.md`):

- `0001-auth-session-model.md`
- `0002-orm-and-migration-strategy.md`
- `0003-websocket-event-conventions.md`
- `0004-background-job-framework.md`
- `0005-matching-engine-wrapper.md`
- `0006-media-storage-abstraction.md`
