# 0003: WebSocket Event Conventions

**Status:** Accepted

## Context

The realtime layer must deliver state transitions, match assignments, meeting timers, and organiser dashboard updates with low latency, must survive client reconnects without losing application state, and must be addressable by both per-session and broadcast scopes.

## Decision

- **Transport:** Socket.IO over WebSocket on path `/realtime`. JSON message envelopes.
- **Authentication:** bearer JWT in the connection query string (`?token=`) or an initial `AUTH` client message. Server replies with `AUTH_OK` or `AUTH_ERROR`.
- **Room topology:**
  - `session:<sessionId>` — exactly one socket: the single's own session.
  - `event:<eventId>` — every connected single and organiser for that event.
  - `organiser:<eventId>` — only organisers actively viewing the dashboard.
- **Naming:**
  - All message types are `UPPER_SNAKE_CASE` strings on the `type` field.
  - Server-emitted types are noun-prefixed (`STATE_CHANGED`, `MATCH_ASSIGNED`).
  - Client-emitted types are verb-prefixed (`AUTH`, `PING`).
  - Catalogues live in `packages/shared/src/ws/`; both apps consume the same enums and payload interfaces.
- **Direction:** push-only from server. Client→server traffic is limited to `AUTH` and `PING`; all other client-initiated actions go through REST. This keeps the server authoritative and simplifies idempotency.
- **Delivery guarantees:** at-most-once over the live connection. Persistent state is held server-side; on reconnect the server emits `STATE_SNAPSHOT` so the client can rehydrate without REST calls. Out-of-band push notifications (Web Push) provide a fallback for `MATCH_ASSIGNED`, `MEETING_WARNING`, and `MEETING_ENDED`.
- **Reconnection window:** 60 seconds (configurable). During this window the session state is held in `OFFLINE` substate and restored on reconnect. After expiry the session reverts according to its prior state's transition rules.
- **Versioning:** breaking changes to message shapes require a new `type` (additive) or a v2 namespace (`/realtime/v2`); never a silent shape change. Adding optional fields is non-breaking.
- **Error envelope:** `{ type: "ERROR", code: "UNAUTHORIZED" | "ILLEGAL_TRANSITION" | "UNKNOWN", message: string }`.

## Consequences

- Reconnect logic on the client is uniform: connect → authenticate → wait for `STATE_SNAPSHOT` → render.
- Push-only direction keeps WebSocket handlers thin; REST is the only write surface.
- Shared payload types prevent frontend/backend drift.
- At-most-once delivery means the snapshot, not message history, is the source of truth on reconnect.
