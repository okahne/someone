# Testing and Quality Plan

## Objective

Provide automated confidence for matching correctness, authorization, realtime state transitions, notification delivery paths, and the end-to-end event experience required by the MVP specification.

## Quality Gates

- Every domain rule change ships with unit or integration coverage at the service boundary that owns it.
- Every externally consumed REST contract is covered by integration tests and represented in OpenAPI.
- Every critical realtime workflow has an integration or end-to-end path covering connection, transition, and recovery behavior.
- Release readiness requires green unit, integration, and end-to-end suites for the critical scenarios in the specification.

## Test Pyramid

### Unit Tests

Cover isolated logic for:

- Compatibility evaluation and mandatory-tag matching
- Graph preparation for scheduled matching runs
- Blossom wrapper behavior and randomized pairing boundaries
- State transition validation and illegal transition rejection
- Role guards and authorization rules
- Service-level business rules for events, pools, spots, and notifications
- Frontend state reducers, services, utilities, and reconnect helpers

### Integration Tests

Cover real module wiring for:

- Database repositories and migrations
- Authentication and role-aware authorization flows
- REST endpoints for admin, organiser, single bootstrap, notifications, and audit reads
- WebSocket gateway behavior for presence, mode changes, matching, and meeting confirmation
- Scheduled jobs for call execution, no-show handling, and timer warnings
- Push subscription persistence and delivery orchestration

### End-to-End Tests

Cover browser and API flows for:

- Admin sign-in, event creation, publication, and organiser assignment
- Organiser sign-in and full event configuration
- Anonymous single join, pool selection, tag selection, and available mode
- Persistent SSO single join and immediate search match flow
- Booked singles receiving valid scheduled call results
- Rematch prevention in pools that disallow duplicates
- Unmatched outcomes for incompatible singles
- Capacity limits caused by insufficient meeting spots
- Meeting confirmation, transition to meeting, and match log creation
- Meeting timer warning and expiry flow
- Disconnect and reconnect state restoration
- Event closure blocking new joins and new matching

## Test Data Strategy

- Use deterministic fixtures for users, events, pools, tags, and meeting spots
- Provide builders for single sessions and match histories so rematch cases are explicit
- Seed enough realistic data to exercise translation fallback, capacity limits, and odd-number matching
- Keep randomized matching tests reproducible by controlling seeds where practical

## Environment Strategy

- Run unit tests without Docker when possible for speed
- Run integration tests against disposable Postgres and Redis instances
- Run end-to-end tests against a Docker-backed local environment or CI equivalent
- Isolate push and external auth dependencies behind test doubles where full-provider execution is unnecessary

## Non-Functional Validation

- Verify reconnect behavior after websocket interruption during `MOVING` and `MEETING`
- Verify idempotent handling for repeated client events and delayed notifications
- Verify audit logging for admin and organiser actions
- Verify storage abstraction behavior for meeting spot image metadata and file lifecycle
- Verify privacy flows such as consent-gated uploads and persistent account deletion

## Release Checklist

1. Unit, integration, and end-to-end suites are green.
2. OpenAPI output matches implemented REST endpoints.
3. WebSocket protocol documentation reflects actual message names and payloads.
4. Data model and code standards documents are updated for schema or architectural changes.
5. Docker-based local startup works from a clean checkout.