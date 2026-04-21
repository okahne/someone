# API Reference

This document covers the REST API and WebSocket protocol for the Someone Meetup backend.

REST endpoints are published via Swagger / OpenAPI at `/api/docs` when the backend is running. This file documents the structure, contracts, and protocol rules that implementation must follow.

---

## REST API

### Conventions

- Base path: `/api/v1`
- All request and response bodies use JSON.
- All timestamps use ISO 8601 UTC.
- Authentication is via a bearer JWT in the `Authorization` header.
- Validation errors return `400` with a structured body (see Error Shapes below).
- Authorization failures return `403`.
- Resource not found returns `404`.
- State conflict errors (illegal transitions, duplicate actions) return `409`.

### Authentication

All persistent-user endpoints require a valid JWT. Anonymous session endpoints accept an anonymous session token issued at join time.

---

### Auth

| Method | Path                  | Auth     | Description                                   |
|--------|-----------------------|----------|-----------------------------------------------|
| `GET`  | `/auth/google`        | None     | Redirect to Google OAuth authorization URL    |
| `GET`  | `/auth/google/callback` | None   | Handle Google OAuth callback; issue tokens    |
| `GET`  | `/auth/discord`       | None     | Redirect to Discord OAuth authorization URL   |
| `GET`  | `/auth/discord/callback` | None  | Handle Discord OAuth callback; issue tokens   |
| `POST` | `/auth/anonymous`     | None     | Issue anonymous event session token           |
| `POST` | `/auth/refresh`       | Refresh token | Refresh an access token                 |
| `POST` | `/auth/logout`        | Bearer   | Revoke current session tokens                 |

**`POST /auth/anonymous` request body:**
```json
{
  "eventId": "uuid",
  "displayName": "string (1–80 chars)"
}
```

**`POST /auth/anonymous` response:**
```json
{
  "accessToken": "string",
  "sessionId": "uuid",
  "expiresAt": "ISO 8601"
}
```

---

### Users

| Method   | Path            | Auth        | Role       | Description                     |
|----------|-----------------|-------------|------------|---------------------------------|
| `GET`    | `/users/me`     | Bearer      | Any        | Get own user profile            |
| `PATCH`  | `/users/me`     | Bearer      | Any        | Update own display name         |
| `DELETE` | `/users/me`     | Bearer      | Any        | Delete own account              |

---

### Events

| Method   | Path                        | Auth   | Role    | Description                               |
|----------|-----------------------------|--------|---------|-------------------------------------------|
| `POST`   | `/events`                   | Bearer | Admin   | Create an event                           |
| `GET`    | `/events`                   | Bearer | Admin   | List all events                           |
| `GET`    | `/events/:id`               | Bearer | Admin, Organiser | Get event by ID                 |
| `PATCH`  | `/events/:id`               | Bearer | Admin   | Update event metadata                     |
| `PATCH`  | `/events/:id/status`        | Bearer | Admin   | Change event lifecycle status             |
| `GET`    | `/events/:slug/public`      | None   | None    | Resolve event by public slug; validates status |
| `GET`    | `/events/:id/link`          | Bearer | Admin   | Get the public event access link          |

**`POST /events` request body:**
```json
{
  "title": "string",
  "description": "string | null"
}
```

**`PATCH /events/:id/status` request body:**
```json
{
  "status": "PUBLISHED | LIVE | CLOSED | ARCHIVED"
}
```

---

### Organisers

| Method   | Path                              | Auth   | Role  | Description                     |
|----------|-----------------------------------|--------|-------|---------------------------------|
| `POST`   | `/events/:id/organisers`          | Bearer | Admin | Assign an organiser to an event |
| `DELETE` | `/events/:id/organisers/:userId`  | Bearer | Admin | Remove an organiser from an event |
| `GET`    | `/events/:id/organisers`          | Bearer | Admin | List organisers for an event    |

---

### Event Languages

| Method   | Path                            | Auth   | Role      | Description                       |
|----------|---------------------------------|--------|-----------|-----------------------------------|
| `PUT`    | `/events/:id/languages`         | Bearer | Organiser | Set the full language list (replaces existing) |
| `GET`    | `/events/:id/languages`         | Bearer | Organiser | List event languages              |

**`PUT /events/:id/languages` request body:**
```json
[
  { "locale": "en", "isDefault": true },
  { "locale": "de", "isDefault": false }
]
```

---

### Pools

| Method   | Path                     | Auth   | Role      | Description                           |
|----------|--------------------------|--------|-----------|---------------------------------------|
| `POST`   | `/events/:id/pools`      | Bearer | Organiser | Create a pool                         |
| `GET`    | `/events/:id/pools`      | Bearer | Organiser, Single | List pools for an event       |
| `GET`    | `/pools/:id`             | Bearer | Organiser | Get pool details                      |
| `PATCH`  | `/pools/:id`             | Bearer | Organiser | Update pool configuration             |
| `POST`   | `/pools/:id/archive`     | Bearer | Organiser | Archive a pool                        |

**`POST /events/:id/pools` request body:**
```json
{
  "defaultTitle": "string",
  "translations": [{ "locale": "de", "title": "string" }],
  "allowRematch": false,
  "callSchedule": { "cron": "0 20 * * *", "timezone": "Europe/Berlin" },
  "meetingTimeLimitMinutes": 15
}
```

---

### Tags

| Method   | Path                     | Auth   | Role      | Description                    |
|----------|--------------------------|--------|-----------|--------------------------------|
| `POST`   | `/pools/:id/tags`        | Bearer | Organiser | Create a tag                   |
| `GET`    | `/pools/:id/tags`        | Bearer | Organiser, Single | List tags for a pool   |
| `PATCH`  | `/tags/:id`              | Bearer | Organiser | Update tag label or translations |
| `POST`   | `/tags/:id/archive`      | Bearer | Organiser | Archive a tag                  |

---

### Meeting Spots

| Method   | Path                        | Auth   | Role      | Description                        |
|----------|-----------------------------|--------|-----------|------------------------------------|
| `POST`   | `/pools/:id/spots`          | Bearer | Organiser | Create a meeting spot              |
| `GET`    | `/pools/:id/spots`          | Bearer | Organiser, Single | List spots for a pool      |
| `PATCH`  | `/spots/:id`                | Bearer | Organiser | Update spot details                |
| `POST`   | `/spots/:id/archive`        | Bearer | Organiser | Archive a spot                     |
| `POST`   | `/spots/:id/images`         | Bearer | Organiser | Upload a spot image (multipart)    |
| `DELETE` | `/spots/:id/images/:imageId`| Bearer | Organiser | Remove a spot image                |

---

### Question Scripts

| Method   | Path                    | Auth   | Role      | Description                     |
|----------|-------------------------|--------|-----------|---------------------------------|
| `PUT`    | `/pools/:id/script`     | Bearer | Organiser | Create or replace question script |
| `GET`    | `/pools/:id/script`     | Bearer | Organiser, Single | Get script for a pool |
| `DELETE` | `/pools/:id/script`     | Bearer | Organiser | Remove question script          |

---

### Sessions

| Method   | Path                         | Auth          | Description                           |
|----------|------------------------------|---------------|---------------------------------------|
| `GET`    | `/sessions/:id`              | Bearer (own)  | Get own session state                 |
| `POST`   | `/sessions/:id/picture`      | Bearer (own)  | Upload profile picture (requires consent flag) |
| `PUT`    | `/sessions/:id/pool`         | Bearer (own)  | Join a pool                           |
| `PUT`    | `/sessions/:id/pool-tags`    | Bearer (own)  | Set own tags within current pool      |
| `PUT`    | `/sessions/:id/mode`         | Bearer (own)  | Set mode; triggers search or booking  |

**`PUT /sessions/:id/mode` request body:**
```json
{
  "mode": "AVAILABLE | SEARCHING | BOOKED",
  "mandatoryTagIds": ["uuid"]
}
```
`mandatoryTagIds` is required when `mode` is `SEARCHING` or `BOOKED`, ignored otherwise.

---

### Matches

| Method   | Path                         | Auth         | Description                      |
|----------|------------------------------|--------------|----------------------------------|
| `GET`    | `/matches/:id`               | Bearer (participant or organiser) | Get match details |
| `POST`   | `/matches/:id/confirm`       | Bearer (own) | Confirm arrival at meeting spot  |
| `POST`   | `/matches/:id/end`           | Bearer (own) | Signal meeting end (from timer expiry or manual) |

---

### Organiser Dashboard

| Method | Path                          | Auth   | Role      | Description                               |
|--------|-------------------------------|--------|-----------|-------------------------------------------|
| `GET`  | `/events/:id/dashboard`       | Bearer | Organiser | Summary of live singles, matches, and runs |
| `GET`  | `/events/:id/match-runs`      | Bearer | Organiser | List match runs for an event              |
| `GET`  | `/match-runs/:id`             | Bearer | Organiser | Detailed match run: pairs and unmatched   |

---

### Notifications

| Method   | Path                        | Auth         | Description                         |
|----------|-----------------------------|--------------|-------------------------------------|
| `POST`   | `/notifications/subscribe`  | Bearer (own) | Register browser push subscription  |
| `DELETE` | `/notifications/subscribe`  | Bearer (own) | Revoke current push subscription    |

**`POST /notifications/subscribe` request body:** Web Push subscription object as returned by the browser `PushSubscription.toJSON()`.

---

### Audit

| Method | Path       | Auth   | Role  | Description             |
|--------|------------|--------|-------|-------------------------|
| `GET`  | `/audit`   | Bearer | Admin | Query audit entries     |

Query parameters: `actorId`, `entityType`, `entityId`, `from`, `to`, `limit`, `offset`.

---

### Error Shapes

All error responses follow this structure:

```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Human-readable summary",
  "details": [
    { "field": "displayName", "message": "must not be empty" }
  ]
}
```

`details` is present for validation errors (400) and omitted for 403, 404, and 409.

---

## WebSocket Protocol

### Connection

Clients connect to `wss://<host>/realtime` with a bearer token in the connection query string or initial handshake message. Anonymous sessions use the anonymous session token.

On successful authentication the server sends a `STATE_SNAPSHOT` message so the client can restore its current state after reconnect without any additional REST calls.

---

### Authentication Message

Sent by the client immediately after opening the socket if the token was not provided in the query string.

```json
{ "type": "AUTH", "token": "string" }
```

Server acknowledges with:

```json
{ "type": "AUTH_OK", "sessionId": "uuid" }
```

Or rejects with:

```json
{ "type": "AUTH_ERROR", "code": "INVALID_TOKEN | EXPIRED_TOKEN" }
```

---

### Rooms

Sockets are placed into rooms automatically on authentication:

| Room                    | Members                                    |
|-------------------------|--------------------------------------------|
| `event:<eventId>`       | All connected singles and organisers       |
| `session:<sessionId>`   | The single's own socket                    |
| `organiser:<eventId>`   | Organisers with an active dashboard connection |

---

### Server → Client Messages

| Type                   | Room                    | Payload                                       | Description                                        |
|------------------------|-------------------------|-----------------------------------------------|----------------------------------------------------|
| `STATE_SNAPSHOT`       | `session:<id>`          | Full `SingleSession` DTO                      | Sent on connect/reconnect                          |
| `STATE_CHANGED`        | `session:<id>`          | `{ state: SingleState }`                      | Single's state was updated                         |
| `MATCH_ASSIGNED`       | `session:<id>`          | `{ matchId, meetingSpot, partner }`           | A match was finalized for this single              |
| `MATCH_RELEASED`       | `session:<id>`          | `{ matchId, reason: 'NO_SHOW' | 'EXPIRED' }` | Match was cancelled; return to mode selection      |
| `MEETING_WARNING`      | `session:<id>`          | `{ matchId, remainingSeconds: 120 }`          | Meeting time limit 2 minutes remaining             |
| `MEETING_ENDED`        | `session:<id>`          | `{ matchId }`                                 | Meeting time limit reached                         |
| `POOL_COUNTS`          | `event:<id>`            | `{ poolId, available, searching, booked, meeting }` | Live counts per pool                         |
| `MATCH_RUN_COMPLETE`   | `organiser:<id>`        | `{ matchRunId, poolId, matched, unmatched, spotsShortfall }` | Matching call result summary          |
| `ORGANISER_SNAPSHOT`   | `organiser:<id>`        | Summary of active singles and matches         | Sent on organiser dashboard connect               |

---

### Client → Server Messages

| Type            | Payload                                        | Description                          |
|-----------------|------------------------------------------------|--------------------------------------|
| `PING`          | none                                           | Keepalive                            |

All other client actions use REST. WebSocket is server→client push only except for `AUTH` and `PING`.

---

### Delivery Guarantees

- Messages are delivered at-most-once over the WebSocket connection.
- If the client is disconnected, the server holds state. On reconnect the client receives `STATE_SNAPSHOT`.
- Push notifications provide the out-of-band fallback for `MATCH_ASSIGNED`, `MEETING_WARNING`, and `MEETING_ENDED` when the browser is backgrounded or disconnected.

---

### Reconnect Behavior

1. Client reconnects and re-authenticates.
2. Server sends `STATE_SNAPSHOT` immediately.
3. If the single's state is `MOVING` or `MEETING`, the snapshot includes the active match and meeting spot details.
4. The reconnection window (configurable, default 60 seconds) during which state is held before a disconnect is treated as `OFFLINE`.

---

### Error Message Shape

```json
{
  "type": "ERROR",
  "code": "UNAUTHORIZED | ILLEGAL_TRANSITION | UNKNOWN",
  "message": "string"
}
```
