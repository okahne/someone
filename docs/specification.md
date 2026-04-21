# Someone Meetup MVP Specification

## 1. Overview

This document is the canonical product and delivery specification for the Someone Meetup MVP. It defines the required product scope, roles, workflows, technical boundaries, documentation requirements, and test obligations for a browser-first blind date meetup application.

The phase 1 product shape is:

- Web app / PWA only
- Public event links for singles
- Google and Discord SSO for persistent users, including admins
- Anonymous event-only access for singles
- Basic privacy baseline with consent, account deletion for persistent users, and organiser reporting retention

## 2. Product Scope

### 2.1 Goal

The system supports live blind date meetup events. Organisers configure an event, pools, meeting spots, supported languages, tags, scripts, and timing rules. Singles join an event via link, choose a pool, select their own tags, and either stay available to be contacted, search immediately for a compatible match, or join the next scheduled matching call.

When a match is made, both singles are directed to a meeting spot, notified in real time, and guided through confirmation and meeting flow.

### 2.2 Phase 1 Included

- Angular frontend for singles, organisers, and system admins
- Node.js TypeScript backend
- Shared TypeScript data model and API/WebSocket contracts
- Postgres database
- Redis for background jobs and WebSocket scaling
- Docker Compose local development environment
- WebSocket realtime state updates
- Web Push notifications
- Google and Discord SSO
- Anonymous single participation
- Event, organiser, pool, tag, meeting spot, script, and timer management
- Swagger / OpenAPI documentation for REST APIs
- WebSocket protocol documentation
- Data model documentation
- Code standards documentation
- Unit, integration, and end-to-end tests for all critical scenarios

### 2.3 Phase 1 Excluded

- Native mobile applications
- SMS or email notification channels
- Payments
- Geolocation verification
- Attendee approval workflows
- Manual organiser override of generated matches
- Advanced moderation flows such as report/block
- Cross-event user recommendations

## 3. Roles and Permissions

### 3.1 System Admin

A system admin is a persistent registered user authenticated with Google or Discord SSO and granted the `SYSTEM_ADMIN` role.

System admins can:

- Create events
- Edit event metadata
- Generate and copy event access links
- Assign and remove organisers for an event
- Change event lifecycle status
- View audit history for admin and organiser actions

System admins cannot:

- Use anonymous mode
- Bypass role checks by virtue of SSO alone

### 3.2 Organiser

An organiser is a persistent registered user authenticated with Google or Discord SSO and assigned to one or more events.

For events they organise, organisers can:

- View singles connected to the event
- Define supported event languages, where the first language is the default language
- Create, edit, and archive pools
- Configure whether rematching the same pair is allowed within a pool
- Configure scheduled matching call times for a pool
- Define pool tags and translations
- Create, edit, and archive meeting spots
- Upload meeting spot pictures
- Define an optional question script for meetings
- Define a meeting time limit
- View match runs, pairings, unmatched users, and operational logs

Organisers cannot:

- Manage system-wide admin permissions
- Edit events they are not assigned to

### 3.3 Single

A single participates in one event at a time.

A single may join:

- Anonymously by entering a display name after opening the event link
- As a persistent user via Google or Discord SSO

Singles can:

- Upload or capture a profile picture
- Select a pool
- Select their own tags for that pool
- Select mandatory tags they require in a partner
- Choose one of three modes: available, search now, join next matching call
- Confirm arrival at a meeting spot
- Receive meeting prompts and timer notifications
- Choose a new mode after a meeting ends

## 4. Event Lifecycle

Events have the following states:

- `DRAFT`
- `PUBLISHED`
- `LIVE`
- `CLOSED`
- `ARCHIVED`

Rules:

- Organisers may configure an event while it is `DRAFT` or `PUBLISHED`
- Singles may join an event only when it is `PUBLISHED` or `LIVE`
- Matching and meeting actions are allowed only while the event is `LIVE`
- `CLOSED` prevents new matches but preserves historical data
- `ARCHIVED` is read-only

## 5. User Entry and Identity Rules

### 5.1 Anonymous Singles

Anonymous singles:

- Join with an event link and display name
- Are scoped to a single event
- Do not have a reusable account
- Lose access when the event closes or their session expires
- Cannot upgrade to a persistent account in phase 1

### 5.2 Persistent Users

Persistent users:

- Authenticate through Google or Discord
- May have one or more roles
- May participate in multiple events over time
- May delete their own account

### 5.3 Role Assignment

Authentication and authorization are separate concerns:

- Google or Discord proves identity
- Backend role assignment determines permissions
- Admins and organisers are authorized by backend roles, not by provider alone

## 6. Pool and Tag Rules

### 6.1 Pool Scope

Pools are event-scoped. A single may belong to only one pool at a time within an event.

Each pool includes:

- Default-language title
- Translated titles for other supported event languages
- Matching call schedule
- Rematch policy
- Allowed tags
- Optional question script
- Optional meeting time limit

### 6.2 Tags

Tags are defined per pool and support translations from the default language.

Each single chooses:

- Their own tags
- Mandatory tags required in a partner for the current search or booking action

Compatibility is bidirectional:

- Single A must satisfy all mandatory tags selected by single B
- Single B must satisfy all mandatory tags selected by single A

## 7. Single State Model

Singles have the following event-scoped runtime states:

- `JOINED`
- `AVAILABLE`
- `SEARCHING`
- `BOOKED`
- `MOVING`
- `MEETING`
- `COMPLETED`
- `UNMATCHED`
- `OFFLINE`

Rules:

- State is stored server-side and is authoritative
- Frontend may optimistically render transitions, but backend validates and confirms them
- Illegal or stale state transitions are rejected

Allowed high-level transitions:

- `JOINED -> AVAILABLE`
- `JOINED -> SEARCHING`
- `JOINED -> BOOKED`
- `AVAILABLE -> SEARCHING`
- `AVAILABLE -> BOOKED`
- `SEARCHING -> MOVING` or `UNMATCHED`
- `BOOKED -> MOVING` or `UNMATCHED`
- `MOVING -> MEETING`
- `MEETING -> COMPLETED`
- `COMPLETED -> AVAILABLE`, `SEARCHING`, or `BOOKED`

## 8. Functional Workflows

### 8.1 Admin Workflow

Flow:

1. Admin signs in via SSO.
2. Admin creates an event with metadata.
3. Admin sets event state to `PUBLISHED`.
4. Admin assigns one or more organisers.
5. Admin copies the generated public event link.
6. Admin or organiser moves the event to `LIVE` when ready.

Acceptance criteria:

- Only admins can create events
- Only admins can assign organisers
- Event link is generated once the event exists
- All admin actions are audit logged

### 8.2 Organiser Workflow

Flow:

1. Organiser signs in via SSO.
2. Organiser opens an assigned event dashboard.
3. Organiser defines event languages, with the first language as default.
4. Organiser creates one or more pools.
5. Organiser configures titles, translations, rematch rule, call schedule, tags, meeting spots, optional script, and optional meeting time limit.
6. Organiser reviews live singles, match runs, active meetings, and unmatched users.

Acceptance criteria:

- Organisers only see assigned events
- Pool configuration cannot be published without at least one tag and one meeting spot
- Translations fall back to default language if a translation is missing
- Organiser dashboard updates in real time for active events

### 8.3 Single Join Workflow

Flow:

1. Single opens the public event link.
2. System validates that the event is `PUBLISHED` or `LIVE`.
3. Single chooses anonymous or SSO entry.
4. Single provides display name and optional profile picture.
5. Single lands on the main mode-selection page.

Acceptance criteria:

- Anonymous users can join without SSO
- Persistent users authenticate with Google or Discord
- Profile picture upload requires explicit consent
- Users cannot enter closed or archived events

### 8.4 Pool Join Workflow

Flow:

1. Single selects one pool.
2. Single selects their own tags from that pool.
3. Single returns to the main page and chooses a mode.

Acceptance criteria:

- Only tags configured for the selected pool may be chosen
- Pool membership is exclusive within an event
- Changing pool clears current mode and partner preference state

### 8.5 Available-to-Be-Contacted Workflow

Flow:

1. Single selects the mode "be available to be contacted".
2. System keeps the single in the selected pool and sets state to `AVAILABLE`.

Acceptance criteria:

- Available singles are discoverable only within the same pool
- Available state is visible to organisers in the live dashboard
- Leaving the event or switching pool exits available state

### 8.6 Search-for-Someone Workflow

Flow:

1. Single selects the mode "search for someone".
2. Single selects mandatory tags required in a partner.
3. Backend finds one compatible random single in the same pool already in `AVAILABLE` state.
4. Backend reserves an exclusive meeting spot.
5. Backend creates a match, notifies both users, and sets both states to `MOVING`.
6. Both users see the meeting spot details.

If no match is possible:

- The searching single is set to `UNMATCHED`
- The UI explains that no compatible partner is currently available
- The single may choose another mode immediately

If no meeting spot is available:

- No match is finalized
- Both users remain in their prior eligible states
- Organiser dashboard shows capacity issue

Acceptance criteria:

- Match compatibility is bidirectional
- Only one active match may exist per single
- Meeting spot assignment is exclusive per pair
- Organiser sees search failures caused by no compatible partner or no spot capacity

### 8.7 Join-the-Next-Matching-Call Workflow

Flow:

1. Single selects the mode "join the next matching call".
2. Single sees the next scheduled call time.
3. Single selects mandatory tags required in a partner.
4. Backend sets the state to `BOOKED`.
5. Frontend shows a countdown to the next call.
6. At call time, backend constructs a compatibility graph of all booked singles in the pool.
7. If the pool disallows rematches, backend removes edges representing previously logged pairs in that pool.
8. Backend computes a maximum-cardinality random matching using Edmonds' Blossom.
9. Backend reserves exclusive meeting spots for as many pairs as capacity allows.
10. For each finalized pair, backend creates a match, sends notifications, and sets both states to `MOVING`.
11. Singles left without a compatible pair or without spot capacity are set to `UNMATCHED` and shown a clear outcome.

Acceptance criteria:

- The algorithm runs per pool at the configured scheduled call time
- Rematch blocking is scoped to prior logged matches in the same pool
- Unmatched singles remain eligible to choose another mode after the call
- Organiser can inspect each match run, final pairs, and unmatched participants

### 8.8 Meeting Workflow

Flow:

1. Matched singles arrive at the assigned meeting spot.
2. Each single can confirm arrival with an "I'm here" action.
3. Once confirmation rules are met, backend sets both states to `MEETING` and logs the match.
4. If a question script exists, the frontend presents the configured questions.
5. If a meeting time limit exists, backend sends a warning notification 2 minutes before the end and another at the end.
6. When the meeting ends, users are prompted to choose a new mode.

Acceptance criteria:

- Match logging occurs when the meeting begins, not only when the pair is assigned
- Timer events are backend-driven and authoritative
- If one user never confirms arrival within the timeout window, the meeting is marked as no-show and both users are prompted for the next action

## 9. Edge Case Rules

The implementation must handle these explicit outcomes:

- No compatible partner available: return `UNMATCHED` with explanation
- Odd number of booked singles: leave at least one unmatched
- Insufficient meeting spots: finalize only up to spot capacity and report the deficit
- Disconnect during active match: backend retains state and pending notifications for a short reconnection window
- User ignores push notification: frontend state remains recoverable on reconnect
- One user does not confirm arrival: mark no-show and release both users back to mode selection
- Organiser changes pool config during a live event: changes apply only to new search and booking actions, not to already finalized matches
- Duplicate match disallowed: prior logged pair in the same pool blocks future pairing in that pool

## 10. Technical Architecture

### 10.1 Repository Structure

Use a monorepo with:

- `apps/frontend`
- `apps/backend`
- `packages/shared`
- `docs`
- Docker and CI configuration at repository root

### 10.2 Backend

Recommended backend framework: NestJS.

Backend modules:

- Auth
- Users
- Roles
- Events
- Organisers
- Pools
- Tags
- Meeting spots
- Matches
- Meetings
- Notifications
- Realtime
- Audit

Backend responsibilities:

- Persist domain state in Postgres
- Expose REST APIs for management and bootstrap flows
- Expose WebSocket gateway for live user behavior
- Process scheduled call jobs and meeting timers
- Deliver Web Push notifications
- Enforce state machine and authorization rules

### 10.3 Frontend

Angular application areas:

- Public single entry and participation flows
- Protected organiser dashboard
- Protected admin dashboard

Frontend responsibilities:

- Authenticate with SSO providers
- Register Web Push subscriptions
- Maintain live state via WebSockets
- Render countdowns and meeting prompts
- Handle reconnect and state refresh gracefully

### 10.4 Shared Package

The shared package contains:

- DTOs
- Enums
- Validation schemas
- WebSocket payload types
- API request and response contracts

## 11. Realtime and Notification Boundaries

### 11.1 REST API

Use REST for:

- Auth bootstrap
- Event CRUD
- Organiser assignment
- Pool CRUD
- Tag CRUD
- Meeting spot CRUD
- Image upload
- Notification subscription registration
- Event and dashboard reads
- Audit and reporting reads

### 11.2 WebSocket

Use WebSockets for:

- Presence and connect/disconnect
- Mode changes
- Pool live counts
- Match assignment
- Meeting confirmation
- Timer warnings and expiration
- Organiser live dashboard updates

### 11.3 Push Notifications

Phase 1 uses Web Push notifications.

Required push notification types:

- Match assigned
- Meeting warning at 2 minutes remaining
- Meeting ended
- Organiser broadcast, if added later in scope

Rules:

- WebSocket is primary when connected
- Push is required for background or disconnected browser sessions
- Consent is required before registration
- Subscriptions are stored server-side and revocable

## 12. Data Model

The implementation must document the data model and relationships. At minimum, define:

- `User`: persistent identity holder
- `Identity`: external auth provider linkage for Google or Discord
- `UserRole`: role assignment such as system admin
- `Event`: event metadata and lifecycle state
- `EventOrganiser`: organiser assignment to event
- `EventLanguage`: supported languages and default flag
- `Pool`: event-scoped matching pool
- `PoolTranslation`: translated pool titles
- `Tag`: pool-scoped tag
- `TagTranslation`: translated tag labels
- `MeetingSpot`: physical meetup location descriptor
- `MeetingSpotImage`: associated spot media metadata
- `QuestionScript`: optional ordered prompt list
- `SingleSession`: event-scoped participation record for anonymous or persistent single
- `SinglePoolMembership`: current pool and own selected tags
- `SinglePreference`: currently required partner tags for search or booking
- `PushSubscription`: browser push subscription
- `MatchRun`: one scheduled call execution or immediate search execution
- `Match`: finalized pair and meeting spot
- `MatchLog`: historical completed meeting record
- `MeetingConfirmation`: arrival confirmations and no-show handling
- `AuditEntry`: admin and organiser actions

The data model documentation must include:

- Entity descriptions
- Cardinality and relationships
- Key indexes
- Enum definitions
- Lifecycle/state notes
- Retention notes

## 13. API Documentation

The backend must publish Swagger / OpenAPI documentation for all REST endpoints.

Minimum REST groups:

- Auth
- Users
- Events
- Organisers
- Pools
- Tags
- Meeting spots
- Matches
- Meetings
- Notifications
- Audit

In addition to OpenAPI, document the WebSocket protocol:

- Message names
- Payload types
- Auth rules
- Delivery guarantees
- Reconnect behavior
- Error message shapes

## 14. Code Standards

The project must define code standards covering:

- Strict TypeScript across all packages
- Repository and module structure
- Naming conventions
- ESLint and Prettier rules
- API DTO validation
- Error handling and error codes
- Structured logging
- Database migration process
- Background job conventions
- WebSocket message conventions
- Testing conventions
- Commit and PR standards
- ADR process for architectural decisions

Recommended defaults:

- Node.js 20 LTS
- `pnpm`
- ESLint
- Prettier
- Jest for unit and integration tests
- Playwright for end-to-end tests
- Prisma migrations or equivalent strongly typed migration tooling

## 15. Infrastructure and Environment

Local development uses Docker Compose with:

- Frontend container
- Backend container
- Postgres container
- Redis container

Non-local environments must use:

- HTTPS
- Externalized environment variables
- Persistent database storage
- Image storage abstraction that supports local filesystem in development and object storage in deployed environments

Images should not be stored as large blobs in Postgres. Store metadata in Postgres and use a storage abstraction for the actual file.

## 16. Testing Requirements

### 16.1 Unit Tests

Required for:

- Matching compatibility logic
- Blossom integration wrapper and graph preparation
- State transition validation
- Auth and role guards
- Service-layer business rules
- Frontend reducers, services, and utilities

### 16.2 Integration Tests

Required for:

- Postgres repositories
- Auth flows
- REST endpoints
- WebSocket gateway behavior
- Scheduled jobs
- Push subscription handling

### 16.3 End-to-End Tests

Required scenarios:

- Admin signs in, creates event, publishes event, and assigns organiser
- Organiser signs in and configures languages, pool, tags, meeting spots, question script, and timer
- Anonymous single joins event, selects pool and tags, enters available mode
- Persistent SSO single joins event, selects pool and tags, searches immediately, and receives a valid match
- Two or more singles book the next matching call and receive valid pairing results at call time
- Rematch restriction prevents a repeated pairing in a pool where repeats are disabled
- No compatible partner returns the correct unmatched behavior
- Insufficient meeting spots limits finalized pairs and reports the issue
- Meeting confirmation flow transitions both users to meeting and logs the match
- Meeting timer sends warning and expiry behavior
- Disconnect and reconnect restores current state
- Event closure prevents new joins and new matching

## 17. Acceptance Criteria

The implementation is complete only when:

- Every requested role and workflow from the original prompt is implemented
- All REST endpoints are documented in OpenAPI
- The data model is documented
- The WebSocket protocol is documented
- Code standards are documented
- Docker-based local setup works
- Automated tests cover all critical paths above
- The system demonstrates live matching, notifications, and meeting flow end-to-end

## 18. Approved Defaults

Treat these as approved defaults unless explicitly changed:

- Event links are public
- Pools are event-scoped
- A single may be in only one pool at a time per event
- Meeting spots are exclusive per pair
- Insufficient meeting spots reduce finalized matches instead of overbooking spots
- Anonymous accounts remain event-only and cannot upgrade in phase 1
- Rematch prevention applies within the same pool
- Logs are retained for 90 days for organiser reporting
- Translations fall back to the default language