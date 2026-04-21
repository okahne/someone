# Architecture Plan

## System Shape

The MVP should be delivered as a monorepo with Angular frontend, NestJS backend, and a shared TypeScript contracts package. The architecture should keep domain rules server authoritative while allowing the frontend to render responsive realtime behavior.

## Repository Layout

- `apps/frontend`: Angular application for public single flows and protected dashboards
- `apps/backend`: NestJS application for REST APIs, WebSocket gateway, jobs, and integrations
- `packages/shared`: shared DTOs, enums, schemas, and transport contracts
- `docs`: specification, planning, standards, API, protocol, and data model documents

## Frontend Responsibilities

- Public event entry, anonymous join, and SSO entry
- Admin dashboard for event lifecycle and organiser assignment
- Organiser dashboard for event configuration and live monitoring
- Single experience for pool selection, mode changes, match flow, and meeting flow
- Push subscription registration and reconnect-safe state restoration

## Backend Responsibilities

- SSO-backed authentication and backend-managed role authorization
- Persistent storage of domain entities and runtime session state
- REST APIs for management, configuration, and bootstrap data
- WebSocket gateway for live state transitions and event updates
- Scheduled jobs for matching calls, reconnection windows, and meeting timers
- Push notification dispatch and audit logging

## Domain Service Boundaries

### Identity and Access

- Identity provider linkage for Google and Discord
- Role assignment separated from authentication provider identity
- Guards and policies for admin and organiser actions

### Event Management

- Event lifecycle enforcement
- Organiser assignment and audit entry creation
- Public event link generation and validation

### Pool Configuration

- Event languages and translation fallback rules
- Pool definitions, scheduling, tags, and rematch policy
- Meeting spots, media metadata, question scripts, and time limits

### Participation and State Machine

- Event-scoped single session lifecycle
- Pool membership, own tags, and mandatory partner tags
- Server-authoritative state transition validation
- Reconnect and offline handling

### Matching and Meetings

- Immediate search matching against available singles
- Scheduled call matching graph preparation and Blossom execution
- Spot reservation with exclusivity guarantees
- Match creation, arrival confirmation, no-show handling, and match logging

### Notifications and Realtime

- WebSocket room topology by event and role-specific views
- Push subscription registration and delivery fallback
- Timer warning and expiry events
- Organiser live dashboard projections

## Data and Storage Notes

- Postgres is the system of record for product and runtime state
- Redis supports background jobs, scheduled execution, and websocket scaling concerns
- Images are stored via a storage abstraction; Postgres holds metadata only
- Audit retention and organiser reporting retention should reflect the 90-day default

## Key Design Constraints

- Singles participate in one event at a time and one pool at a time per event
- Matching is pool-scoped and only valid while the event is live
- Meeting spots are exclusive per finalized pair
- Logged historical matches in the same pool control rematch prevention when enabled
- Changes to live pool configuration affect future actions only, not finalized matches

## Recommended Early ADRs

- Authentication flow and session model for anonymous and persistent singles
- ORM and migration strategy for strongly typed schema changes
- WebSocket event naming, versioning, and delivery guarantees
- Background job framework and retry/idempotency conventions
- Matching engine wrapper strategy around the Blossom implementation
- Media storage abstraction for local and deployed environments