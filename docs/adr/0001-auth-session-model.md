# 0001: Authentication and Session Model

**Status:** Accepted

## Context

The product has two distinct identity surfaces:

1. **Persistent users** (admins and organisers, plus singles who choose SSO at event entry). These users sign in via Google or Discord OAuth 2.0 and have a `User` record with one or more `Identity` rows.
2. **Anonymous singles** who join an event by display name only. They have no `User` record, only a `SingleSession` scoped to the event.

Both must coexist behind a single API surface, both must produce a bearer token usable for REST and WebSocket auth, and both must support reconnect-safe state restoration. Authorization (admin / organiser) is independent of the identity provider — it is granted by `UserRole` rows.

## Decision

- **Token format:** stateless JSON Web Tokens (RS256 signed) for both persistent and anonymous sessions.
- **Persistent users:** SSO callback issues a short-lived `accessToken` (claims: `sub` = `userId`, `roles`, `iat`, `exp` = 15 minutes) plus an opaque `refreshToken` rotated on use. Refresh tokens are stored server-side and revoked on `/auth/logout` or account deletion.
- **Anonymous singles:** `POST /auth/anonymous` issues a single anonymous JWT (claims: `sub` = `sessionId`, `kind: "anonymous"`, `eventId`, `exp` = event lifetime, capped at 24h). No refresh token; expiry on event close. Re-joining the same event produces a new session.
- **Persistent singles in an event:** SSO sign-in followed by event entry creates or reuses a `SingleSession` linked to the `User`. The single uses the persistent access token for both REST and WebSocket; the server resolves the session via `(eventId, userId)`.
- **Roles:** authoritative source is `UserRole`. The role list is embedded in the access token claims for cheap authorization checks; role guards must still tolerate stale claims by re-reading on sensitive operations (organiser assignment, audit access).
- **Reconnect:** the WebSocket gateway accepts the same access token. On reconnect the gateway resolves the session, places the socket in the appropriate rooms, and emits `STATE_SNAPSHOT`. No additional handshake required.
- **Token transport:** `Authorization: Bearer <token>` for REST; query parameter or initial `AUTH` message for WebSocket (matching `docs/api.md`).

## Consequences

- One token verifier serves both audiences; the `kind` claim distinguishes downstream guard behaviour.
- Refresh-token rotation is required only for persistent users, simplifying anonymous flow.
- A single SSO event-entry path can transparently upgrade an anonymous session if the user later signs in (out of scope for MVP, but the model accommodates it).
- Embedding roles in the JWT trades cache freshness for speed; admin role revocation requires either short access-token TTL (15 min) or explicit token revocation list — we accept the 15-minute window in MVP.
