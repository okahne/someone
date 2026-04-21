# Implementation Backlog

## Planning Principles

- Build shared contracts and the core domain model first to prevent frontend/backend drift.
- Land authentication and platform foundations before role-specific product flows.
- Implement matching and meeting state transitions behind explicit domain services, with tests, before wiring UI.
- Keep admin, organiser, and single flows vertically sliceable so the product is demonstrable after each milestone.

## Cross-Cutting Workstreams

These run throughout all phases, not as a final phase:

- **Security and privacy:** consent gates, authorization boundaries, account deletion, and retention enforcement.
- **Observability:** structured logging, audit trails, and job visibility.
- **Reliability:** reconnect stability, idempotent state transitions, and job retry safety.
- **Developer experience:** seeded environments, contract reuse, CI speed, and test isolation.

## Primary Risks to Retire Early

- SSO provider OAuth integration complexity across frontend and backend
- Correctness of the Blossom compatibility graph and randomized pairing
- Race conditions in meeting spot reservation and single state transitions
- Browser push delivery differences across platforms and background states
- Realtime reconnect consistency during `MOVING` and `MEETING`

---

## Milestone M0 · Repository Foundation

**Exit criteria:** Workspace installs and boots with one command. Backend connects to Postgres and Redis. Frontend connects to backend.

---

### M0-T01 · Initialise pnpm monorepo workspace

Set up `pnpm-workspace.yaml` with `apps/*` and `packages/*`. Create placeholder `package.json` files for `apps/backend`, `apps/frontend`, and `packages/shared`.

---

### M0-T02 · Add TypeScript baseline

Create `tsconfig.base.json` at the repo root with `strict: true`. Add package-level `tsconfig.json` files that extend the base. Verify `tsc --noEmit` passes across all packages.

---

### M0-T03 · Configure ESLint and Prettier

Add root `.eslintrc.js` and `.prettierrc` matching the settings in `docs/code-standards.md`. Add `pnpm lint` and `pnpm format:check` scripts. Verify both run cleanly.

---

### M0-T04 · Scaffold NestJS backend application

Bootstrap `apps/backend` with NestJS CLI. Add `nestjs-pino` for structured logging. Configure global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`. Add global exception filter that produces the standard error shape.

---

### M0-T05 · Scaffold Angular frontend application

Bootstrap `apps/frontend` with Angular CLI. Configure proxy to backend for local development. Add Angular ESLint.

---

### M0-T06 · Write Docker Compose configuration

Define services: `backend`, `frontend`, `postgres`, `redis`. Mount local source for hot reload. Expose backend on `3000`, frontend on `4200`, Postgres on `5432`, Redis on `6379`.

---

### M0-T07 · Write Dockerfile for backend and Dockerfile for frontend

Multi-stage Dockerfiles: build stage and runtime stage. Non-root user for runtime. Health check endpoints.

---

### M0-T08 · Add CI pipeline skeleton

Configure CI (GitHub Actions or equivalent) with jobs: `lint`, `typecheck`, `test:unit`. Cache `pnpm` store and `node_modules`. All jobs must pass before merge.

---

### M0-T09 · Write local developer bootstrap documentation

Document how to clone, install, copy `.env.example`, and run `docker compose up`. Add troubleshooting notes for Postgres and Redis connectivity.

---

## Milestone M1 · Shared Contracts and Core Schema

**Exit criteria:** Shared package is consumed by both apps. Prisma schema covers every entity in `docs/data-model.md`. Migrations run cleanly in local and CI environments.

---

### M1-T01 · Define shared enums

Implement `EventStatus`, `SingleState`, `UserRole`, `IdentityProvider`, `MatchRunTrigger`, and `NotificationType` in `packages/shared/enums/`.

---

### M1-T02 · Define shared DTOs and validation schemas

Implement request/response DTO classes for core entities using `class-validator`. Cover: auth, events, pools, tags, meeting spots, sessions, matches. Export from `packages/shared/dto/`.

---

### M1-T03 · Define WebSocket message payload types

Implement typed interfaces for all server→client and client→server WebSocket messages listed in `docs/api.md`. Export from `packages/shared/ws/`.

---

### M1-T04 · Define background job payload types

Implement typed interfaces for scheduling and timer jobs. Export from `packages/shared/jobs/`.

---

### M1-T05 · Write Prisma schema

Translate `docs/data-model.md` into a complete `schema.prisma` covering every entity, relationship, index, and enum. Do not omit partial unique indexes (e.g. default language constraint).

---

### M1-T06 · Generate and apply initial migration

Run `prisma migrate dev --name init`. Verify the migration applies to a fresh Postgres container. Commit migration files.

---

### M1-T07 · Write seed script

Implement `apps/backend/prisma/seed.ts` with: one admin user, one event in DRAFT, one pool, two tags, two meeting spots. Seed must be idempotent (upsert).

---

### M1-T08 · Write ADR 0001: Auth and session model

Document the decision on JWT strategy, anonymous session token issuance, persistent user SSO flow, and token refresh approach. Save to `docs/adr/0001-auth-session-model.md`.

---

### M1-T09 · Write ADR 0002: ORM and migration strategy

Document Prisma selection, migration tooling rules, and backwards-compatibility migration policy. Save to `docs/adr/0002-orm-and-migration-strategy.md`.

---

### M1-T10 · Write ADR 0003: WebSocket event conventions

Document room topology, message naming, delivery guarantees, and reconnect contract. Save to `docs/adr/0003-websocket-event-conventions.md`.

---

### M1-T11 · Write ADR 0004: Background job framework

Document BullMQ selection, queue configuration, idempotency requirements, and retry policy. Save to `docs/adr/0004-background-job-framework.md`.

---

### M1-T12 · Write ADR 0005: Matching engine wrapper

Document how the Blossom algorithm library is wrapped, graph input preparation, randomised pairing strategy, and test surface. Save to `docs/adr/0005-matching-engine-wrapper.md`.

---

### M1-T13 · Write ADR 0006: Media storage abstraction

Document the storage interface, local filesystem adapter for development, and pluggable adapter strategy for deployed environments. Save to `docs/adr/0006-media-storage-abstraction.md`.

---

## Milestone M2 · Authentication, Authorization, and Admin Flows

**Exit criteria:** Only backend-assigned admins can perform admin actions. Audit entries exist for lifecycle operations. Admin flow covered by integration and E2E tests.

---

### M2-T01 · Implement Google OAuth 2.0 SSO

Backend: implement `/auth/google` and `/auth/google/callback` using Passport.js Google strategy. On callback: upsert `User` + `Identity`, issue JWT access token and refresh token.

---

### M2-T02 · Implement Discord OAuth 2.0 SSO

Same pattern as M2-T01 for Discord provider.

---

### M2-T03 · Implement JWT auth guard and refresh

Implement `JwtAuthGuard` for protected endpoints. Implement `POST /auth/refresh` using refresh token rotation. Implement `POST /auth/logout` to revoke session.

---

### M2-T04 · Implement role model and guards

Implement `UserRole` assignment service. Implement `@Roles()` decorator and `RolesGuard`. Seed one `SYSTEM_ADMIN` role assignment for the seeded admin user.

---

### M2-T05 · Implement `POST /events` and `GET /events`

Admin-only event creation (title, description). Return event DTO with generated `slug`. List all events with status filter.

---

### M2-T06 · Implement `PATCH /events/:id` and `PATCH /events/:id/status`

Admin-only metadata update and lifecycle status change. Emit audit entry for status changes. Validate allowed status transitions.

---

### M2-T07 · Implement `GET /events/:id/link`

Return the public slug-based event URL. Generate slug on first request if not already set.

---

### M2-T08 · Implement organiser assignment endpoints

`POST /events/:id/organisers`, `DELETE /events/:id/organisers/:userId`, `GET /events/:id/organisers`. Admin-only. Emit audit entries.

---

### M2-T09 · Implement `GET /audit`

Admin-only. Filter by `actorId`, `entityType`, `entityId`, date range. Paginate with `limit` and `offset`.

---

### M2-T10 · Admin UI: event creation and list

Angular admin dashboard: event creation form, event list with status badges, and lifecycle status change button.

---

### M2-T11 · Admin UI: organiser assignment

Admin dashboard view for assigning and removing organisers per event. Show current organiser list.

---

### M2-T12 · Admin UI: audit log viewer

Paginated log view. Filter by entity type and date range.

---

### M2-T13 · Integration tests: auth and admin endpoints

Cover: SSO callback token issuance, refresh, role guard rejection, admin event CRUD, organiser assignment, audit query.

---

### M2-T14 · E2E test: admin creates and publishes event, assigns organiser

Full browser flow: sign in as admin → create event → set to PUBLISHED → assign organiser → verify audit log.

---

## Milestone M3 · Organiser Configuration Flows

**Exit criteria:** Organisers access only assigned events. Pool publish validation enforced. All configuration flows are test-covered.

---

### M3-T01 · Implement `PUT /events/:id/languages`

Replace full language list for an event. Enforce exactly one `isDefault = true`. Validate at least one language.

---

### M3-T02 · Implement pool CRUD endpoints

`POST /events/:id/pools`, `GET /events/:id/pools`, `GET /pools/:id`, `PATCH /pools/:id`, `POST /pools/:id/archive`. Organiser-scoped authorization.

---

### M3-T03 · Implement translation fallback logic in shared package

Utility function `resolveTranslation(defaultValue, translations, requestedLocale)` that falls back to `defaultValue` if no translation matches. Unit test this utility.

---

### M3-T04 · Implement tag CRUD endpoints

`POST /pools/:id/tags`, `GET /pools/:id/tags`, `PATCH /tags/:id`, `POST /tags/:id/archive`. Include translation management.

---

### M3-T05 · Implement meeting spot CRUD endpoints

`POST /pools/:id/spots`, `GET /pools/:id/spots`, `PATCH /spots/:id`, `POST /spots/:id/archive`.

---

### M3-T06 · Implement meeting spot image upload

`POST /spots/:id/images`: accept multipart upload, validate MIME type and size, write to storage abstraction, persist `MeetingSpotImage` metadata. `DELETE /spots/:id/images/:imageId`: remove metadata and delete from storage.

---

### M3-T07 · Implement question script endpoints

`PUT /pools/:id/script`, `GET /pools/:id/script`, `DELETE /pools/:id/script`.

---

### M3-T08 · Implement pool publish validation

On `PATCH /pools/:id` with a publish-intent flag: reject if pool has no active tags or no active meeting spots. Return structured validation error.

---

### M3-T09 · Implement organiser dashboard read endpoint

`GET /events/:id/dashboard`: return live count of singles per state, active matches, recent match run summaries.

---

### M3-T10 · Organiser UI: language management

Form to add, reorder, and set default event language.

---

### M3-T11 · Organiser UI: pool configuration

Form for pool title, translations, rematch toggle, call schedule, and time limit. Inline tag and meeting spot management.

---

### M3-T12 · Organiser UI: meeting spot management with image upload

Image upload with preview. Validate file type and size on the client before upload.

---

### M3-T13 · Organiser UI: question script editor

Ordered list of prompts with add/remove/reorder. Multi-locale input per prompt.

---

### M3-T14 · Organiser UI: live dashboard (polling or WebSocket stub)

Display singles per state and recent match run outcomes. Wire to WebSocket in M5.

---

### M3-T15 · Integration tests: organiser configuration endpoints

Cover: language set, pool CRUD, tag CRUD, spot CRUD, script, pool publish validation, dashboard read.

---

### M3-T16 · E2E test: organiser configures event end-to-end

Full browser flow: sign in as organiser → set languages → create pool → add tags → add spots → add script → set timer → verify dashboard.

---

## Milestone M4 · Single Entry and Participation Flows

**Exit criteria:** Singles cannot enter closed/archived events. Pool change clears stale state. Session state is server-authoritative and recoverable after reconnect.

---

### M4-T01 · Implement `GET /events/:slug/public`

Resolve event by slug. Return event DTO including pool list and status. Return 404 if slug not found. Return 403 with `EVENT_NOT_JOINABLE` code if status is CLOSED or ARCHIVED.

---

### M4-T02 · Implement anonymous session creation

`POST /auth/anonymous`: validate display name, create `SingleSession`, issue anonymous JWT with `sessionId` claim.

---

### M4-T03 · Link SSO single to event session

After SSO sign-in at event entry: create or reuse `SingleSession` linked to the `User`. If session already exists for this event+user, return existing session with current state.

---

### M4-T04 · Implement consent-gated profile image upload

`POST /sessions/:id/picture`: require `profileImageConsent: true` in body, store image via storage abstraction, update `profileImageKey` and `profileImageConsent` on `SingleSession`.

---

### M4-T05 · Implement `PUT /sessions/:id/pool`

Join a pool: create a new `SinglePoolMembership`, close previous membership (`leftAt`), clear current mode and preferences. Validate pool is active and belongs to the session's event.

---

### M4-T06 · Implement `PUT /sessions/:id/pool-tags`

Set `ownTagIds` on the active `SinglePoolMembership`. Validate all tags belong to the current pool.

---

### M4-T07 · Implement server-side state machine service

`SingleStateService.transition(sessionId, targetState)` validates, applies, and persists state changes. Rejects illegal transitions with `ConflictException`. Unit test all valid and invalid transitions from the matrix in the specification.

---

### M4-T08 · Implement `PUT /sessions/:id/mode`

Apply mode change via state machine service. For `SEARCHING` and `BOOKED`, persist `SinglePreference`. For `AVAILABLE`, clear active preference.

---

### M4-T09 · Implement WebSocket gateway: auth and state snapshot

On connects: authenticate token → place socket in rooms → emit `STATE_SNAPSHOT`. On disconnect: mark `OFFLINE`. Restore to prior state on reconnect if within reconnection window.

---

### M4-T10 · Implement WebSocket: `POOL_COUNTS` broadcast

After any state change, recompute pool-level counts (`available`, `searching`, `booked`, `meeting`) and broadcast `POOL_COUNTS` to `event:<id>` room.

---

### M4-T11 · Single UI: event landing and entry

Public route that resolves event by slug. Show anonymous name entry or SSO sign-in buttons. Validate event status; show error for CLOSED/ARCHIVED.

---

### M4-T12 · Single UI: pool selection and tag selection

Pool list with live counts. After selecting a pool, show tag selection. Submit to `PUT /sessions/:id/pool` then `PUT /sessions/:id/pool-tags`.

---

### M4-T13 · Single UI: mode selection page

Three mode buttons. Show next matching call time for BOOKED mode. Show mandatory tag selector for SEARCHING and BOOKED.

---

### M4-T14 · Single UI: reconnect and state restoration

On socket reconnect, receive `STATE_SNAPSHOT` and navigate to the correct view for the current state without requiring the user to re-enter any information.

---

### M4-T15 · Integration tests: session and participation endpoints

Cover: event slug resolution, anonymous session creation, SSO join, pool change, own tag set, mode set, illegal transition rejection.

---

### M4-T16 · E2E test: anonymous single joins, selects pool, enters available mode

Full browser flow.

---

### M4-T17 · E2E test: persistent SSO single joins and selects pool

Full browser flow including SSO redirect.

---

## Milestone M5 · Matching Engine and Live Meeting Flow

**Exit criteria:** Compatibility is bidirectional. No user holds more than one active match. Rematch blocking enforced. Capacity shortfalls are observable. Meeting flow is complete end-to-end.

---

### M5-T01 · Implement compatibility evaluator

`CompatibilityService.areCompatible(sessionA, sessionB)`: returns `true` if A's `ownTagIds` satisfy all of B's `mandatoryTagIds` AND B's `ownTagIds` satisfy all of A's `mandatoryTagIds`. Unit test exhaustive cases including empty mandatory sets.

---

### M5-T02 · Implement Blossom algorithm wrapper

Wrap the chosen Blossom library. `BlossomService.computeMatching(graph)`: takes adjacency list of eligible pairs, returns maximum-cardinality matching. Unit test: even count, odd count, no eligible pairs, all same tags.

---

### M5-T03 · Implement meeting spot reservation service

`SpotReservationService.reserve(poolId, pairList)`: for each pair finds an unreserved spot, assigns it, and records the reservation on the `Match`. Returns finalized pairs and non-finalized pairs due to capacity. Handles exclusivity via a transaction with SELECT FOR UPDATE.

---

### M5-T04 · Implement immediate search matching

`POST /sessions/:id/mode` with `mode: SEARCHING` triggers `ImmediateSearchService.run(sessionId)`: find one compatible `AVAILABLE` single in the same pool, call `SpotReservationService`, create `MatchRun` + `Match`, transition both singles to `MOVING`, emit `MATCH_ASSIGNED` to both sockets. If no match: set state to `UNMATCHED`.

---

### M5-T05 · Implement scheduled call matching job

BullMQ job `ScheduledCallJob` fires at each pool's configured call time. Gathers all `BOOKED` singles. Builds compatibility graph. Removes edges for logged prior pairs if `allowRematch = false`. Runs Blossom. Calls `SpotReservationService`. Creates `MatchRun` with stats. Transitions matched singles to `MOVING`, unmatched singles to `UNMATCHED`. Emits `MATCH_RUN_COMPLETE` to organiser room.

---

### M5-T06 · Implement WebSocket: `MATCH_ASSIGNED` event

Emit to `session:<id>` for both singles. Payload includes `matchId`, `meetingSpot` details, and `partner.displayName`.

---

### M5-T07 · Implement WebSocket: organiser live dashboard updates

Emit `MATCH_RUN_COMPLETE` and updated `POOL_COUNTS` to `organiser:<eventId>` room after each match run.

---

### M5-T08 · Implement arrival confirmation

`POST /matches/:id/confirm`: create `MeetingConfirmation` for the calling session. If both confirmations exist, transition both to `MEETING`, create `MatchLog`. Emit `STATE_CHANGED` to both.

---

### M5-T09 · Implement no-show detection

BullMQ job `NoShowJob` scheduled at match creation time + confirmation window (configurable, default 5 minutes). If confirmation is incomplete, set `noShow = true` on the missing party's `MeetingConfirmation`, release the match (`releasedAt`), transition both singles to `COMPLETED`, emit `MATCH_RELEASED` with reason `NO_SHOW`.

---

### M5-T10 · Implement meeting timer jobs

On `MatchLog` creation (meeting begins): schedule `MeetingWarningJob` at `(timeLimitMinutes - 2)` minutes and `MeetingExpiryJob` at `timeLimitMinutes`. Jobs emit `MEETING_WARNING` and `MEETING_ENDED` to `session:<id>` for both singles. `MeetingExpiryJob` also transitions both to `COMPLETED`.

---

### M5-T11 · Implement `POST /matches/:id/end`

Early end action from the single. Transition both to `COMPLETED`. Cancel pending timer jobs for this match.

---

### M5-T12 · Single UI: moving state with meeting spot details

Show spot title, description, and images. Show partner display name.

---

### M5-T13 · Single UI: arrival confirmation and meeting screen

"I'm here" button. Show waiting indicator until partner confirms. Transition to meeting view on `STATE_CHANGED: MEETING`.

---

### M5-T14 · Single UI: question script presenter

Step-through prompt display. One question at a time with Next button.

---

### M5-T15 · Single UI: countdown to next matching call

Timer component showing time remaining until next scheduled call. Shown in BOOKED state.

---

### M5-T16 · Single UI: meeting timer and re-prompt

Countdown to time limit. Show warning at 2-minute mark (driven by `MEETING_WARNING`). Show re-prompt on `MEETING_ENDED` or `STATE_CHANGED: COMPLETED`.

---

### M5-T17 · Organiser UI: live match run view

Show `MATCH_RUN_COMPLETE` results in the dashboard: pairs, unmatched singles, and spots shortfall. Update in real time via WebSocket.

---

### M5-T18 · Unit tests: matching and state machine

- Compatibility evaluator all cases
- Blossom wrapper: even/odd/empty/all-same-tags
- Spot reservation: capacity limits, exclusivity
- State transition: every valid and invalid transition

---

### M5-T19 · Integration tests: search, booking, and meeting flows

Cover: immediate search happy path, immediate search no match, scheduled call happy path, rematch prevention, spot capacity shortfall, arrival confirmation, no-show job, meeting timer jobs.

---

### M5-T20 · E2E test: immediate search match flow

Two singles, one AVAILABLE and one searches; both receive MATCH_ASSIGNED, confirm arrival, meeting begins, meeting ends.

---

### M5-T21 · E2E test: scheduled call flow with multiple booked singles

Three or more singles book next call; at call time valid pairs are formed and at least one is unmatched.

---

### M5-T22 · E2E test: rematch prevention

Two singles previously matched in a pool with `allowRematch = false`; scheduled call does not pair them again.

---

### M5-T23 · E2E test: unmatched outcome (no compatible partner)

Single searches with tags that no available single can satisfy; state is set to UNMATCHED.

---

### M5-T24 · E2E test: insufficient meeting spots

All spots occupied; scheduled call finalizes only as many pairs as there are free spots; remainder is UNMATCHED; organiser sees shortfall.

---

### M5-T25 · E2E test: meeting confirmation, timer, and re-prompt

Complete meeting flow: arrival confirmation, timer warning at 2 minutes, expiry, re-prompt.

---

## Milestone M6 · Notifications, Documentation, and Hardening

**Exit criteria:** Push works for disconnected sessions. All required documentation is complete and consistent with the implementation. Privacy and retention defaults are enforced.

---

### M6-T01 · Implement push subscription management

`POST /notifications/subscribe`: store `PushSubscription` for the session. `DELETE /notifications/subscribe`: set `revokedAt`. Both require prior consent flag from the session.

---

### M6-T02 · Implement push dispatch for `MATCH_ASSIGNED`

After WebSocket `MATCH_ASSIGNED` emission: if no active socket for the session (or as a fallback), dispatch Web Push notification with match summary.

---

### M6-T03 · Implement push dispatch for `MEETING_WARNING` and `MEETING_ENDED`

From meeting timer jobs: dispatch push notifications to both sessions in parallel with WebSocket events.

---

### M6-T04 · Angular: push subscription registration

Register service worker. On consent, call `PushManager.subscribe()` and send result to `POST /notifications/subscribe`. Handle permission denied gracefully.

---

### M6-T05 · Publish OpenAPI documentation

Configure `@nestjs/swagger` with `SwaggerModule`. Verify every REST endpoint has a `@ApiOperation`, `@ApiResponse`, and `@ApiBearerAuth` or `@ApiSecurity` decorator. Documentation served at `/api/docs`.

---

### M6-T06 · Implement media storage abstraction

Define `StorageAdapter` interface (`put`, `get`, `delete`). Implement `LocalFileStorageAdapter` for development (stores under `uploads/` volume). Wire via NestJS dependency injection so the adapter can be replaced for deployed environments.

---

### M6-T07 · Structured logging review

Review all modules for `console.log` calls and replace with `pino` logger. Confirm `requestId` is propagated to all log entries via `AsyncLocalStorage`. Add `module` and `method` to critical service log entries.

---

### M6-T08 · Privacy review: consent, deletion, and retention

- Verify `profileImageConsent` gate on upload.
- Verify `DELETE /users/me` clears PII fields on `User` and associated anonymous sessions.
- Verify `MatchLog` and `AuditEntry` 90-day retention is documented in a scheduled cleanup job placeholder.
- Verify push subscription deletion on account delete.

---

### M6-T09 · Integration tests: push subscription and delivery

Cover: subscribe, revoke, push dispatch when socket connected, push dispatch when socket absent.

---

### M6-T10 · E2E test: disconnect and reconnect restores state

Single enters MOVING, browser disconnects, reconnects; receives STATE_SNAPSHOT with active match.

---

### M6-T11 · E2E test: event closure blocks join and matching

Event moved to CLOSED; single tries to join via public link; receives rejection; existing BOOKED singles cannot trigger new matches.

---

### M6-T12 · Final documentation consistency pass

Compare `docs/api.md` against live `/api/docs` output. Compare `docs/data-model.md` against `schema.prisma`. Update any drift. Verify `docs/code-standards.md` matches actual ESLint and Prettier configs.