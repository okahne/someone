# Data Model

This document defines every persisted entity in the Someone Meetup MVP, their relationships, key indexes, enum types, lifecycle notes, and data retention rules.

---

## Enums

### `EventStatus`

| Value       | Meaning                                              |
|-------------|------------------------------------------------------|
| `DRAFT`     | Not yet visible to singles; organiser can configure  |
| `PUBLISHED` | Singles may join; organisers may still configure     |
| `LIVE`      | Matching and meetings are active                     |
| `CLOSED`    | No new matches; historical data preserved            |
| `ARCHIVED`  | Read-only; all write operations rejected             |

### `SingleState`

| Value       | Meaning                                                    |
|-------------|------------------------------------------------------------|
| `JOINED`    | Session created; not yet in a pool or mode                 |
| `AVAILABLE` | In a pool; visible to searchers                            |
| `SEARCHING` | Triggered immediate search; awaiting match                 |
| `BOOKED`    | Registered for the next scheduled matching call            |
| `MOVING`    | Match assigned; en route to meeting spot                   |
| `MEETING`   | Both singles confirmed arrival; meeting is active          |
| `COMPLETED` | Meeting ended; ready to choose a new mode                  |
| `UNMATCHED` | Last search or booking call did not produce a match        |
| `OFFLINE`   | Session disconnected; state held for reconnection window   |

### `UserRole`

| Value          | Meaning                        |
|----------------|--------------------------------|
| `SYSTEM_ADMIN` | Full admin privileges          |
| `ORGANISER`    | Assigned to one or more events |

### `IdentityProvider`

| Value     | Meaning           |
|-----------|-------------------|
| `GOOGLE`  | Google OAuth 2.0  |
| `DISCORD` | Discord OAuth 2.0 |

### `MatchRunTrigger`

| Value       | Meaning                                       |
|-------------|-----------------------------------------------|
| `SCHEDULED` | Triggered by pool matching call schedule      |
| `IMMEDIATE` | Triggered by a single initiating a search     |

### `NotificationType`

| Value             | Meaning                                          |
|-------------------|--------------------------------------------------|
| `MATCH_ASSIGNED`  | A match has been created for this single         |
| `MEETING_WARNING` | Meeting time limit will expire in 2 minutes      |
| `MEETING_ENDED`   | Meeting time limit has expired                   |

---

## Entities

### `User`

Persistent registered user. Admins and organisers only. Singles who use SSO also have a `User` record, but their event participation is tracked via `SingleSession`.

| Column       | Type        | Notes                       |
|--------------|-------------|-----------------------------|
| `id`         | `uuid`      | Primary key                 |
| `displayName`| `text`      | Display name                |
| `createdAt`  | `timestamp` |                             |
| `updatedAt`  | `timestamp` |                             |
| `deletedAt`  | `timestamp` | Soft delete; nullable       |

**Indexes:** `id` (PK).

**Relationships:**
- Has many `Identity` (one per provider)
- Has many `UserRole`
- Has many `EventOrganiser`
- Has many `SingleSession` (when joining events as a persistent single)

**Lifecycle:** Soft delete is used when a user requests account deletion. Audit entries referencing the user are retained for 90 days under the retention rules, but PII columns are cleared on deletion.

---

### `Identity`

Links a `User` to an external OAuth provider.

| Column       | Type        | Notes                              |
|--------------|-------------|------------------------------------|
| `id`         | `uuid`      | Primary key                        |
| `userId`     | `uuid`      | FK → `User`                        |
| `provider`   | `enum`      | `IdentityProvider`                 |
| `providerSub`| `text`      | Subject claim from the provider    |
| `createdAt`  | `timestamp` |                                    |

**Indexes:** `id` (PK), unique on `(provider, providerSub)`.

**Relationships:** Belongs to one `User`.

---

### `UserRole`

Role assignment for a `User`. A user may have multiple roles.

| Column      | Type        | Notes              |
|-------------|-------------|--------------------|
| `id`        | `uuid`      | Primary key        |
| `userId`    | `uuid`      | FK → `User`        |
| `role`      | `enum`      | `UserRole`         |
| `grantedAt` | `timestamp` |                    |
| `grantedBy` | `uuid`      | FK → `User` or null; null for seed grants |

**Indexes:** `id` (PK), index on `userId`.

---

### `Event`

Top-level event entity.

| Column        | Type        | Notes                                      |
|---------------|-------------|--------------------------------------------|
| `id`          | `uuid`      | Primary key                                |
| `slug`        | `text`      | URL-safe identifier used in public links   |
| `title`       | `text`      |                                            |
| `description` | `text`      | Nullable                                   |
| `status`      | `enum`      | `EventStatus`                              |
| `createdBy`   | `uuid`      | FK → `User` (admin who created the event)  |
| `createdAt`   | `timestamp` |                                            |
| `updatedAt`   | `timestamp` |                                            |

**Indexes:** `id` (PK), unique on `slug`.

**Relationships:**
- Has many `EventOrganiser`
- Has many `EventLanguage`
- Has many `Pool`
- Has many `SingleSession`

**Lifecycle:** Follows `EventStatus` enum transitions. Status changes are audit logged.

---

### `EventOrganiser`

Join table assigning an organiser to an event.

| Column       | Type        | Notes              |
|--------------|-------------|--------------------|
| `id`         | `uuid`      | Primary key        |
| `eventId`    | `uuid`      | FK → `Event`       |
| `userId`     | `uuid`      | FK → `User`        |
| `assignedAt` | `timestamp` |                    |
| `assignedBy` | `uuid`      | FK → `User` (admin)|

**Indexes:** `id` (PK), unique on `(eventId, userId)`, index on `userId`.

---

### `EventLanguage`

Supported languages for an event. The row with `isDefault = true` is the default language.

| Column      | Type        | Notes                   |
|-------------|-------------|-------------------------|
| `id`        | `uuid`      | Primary key             |
| `eventId`   | `uuid`      | FK → `Event`            |
| `locale`    | `text`      | BCP 47 locale tag       |
| `isDefault` | `boolean`   | Exactly one true per event |
| `sortOrder` | `integer`   |                         |

**Indexes:** `id` (PK), index on `eventId`.

**Constraint:** Exactly one `isDefault = true` per event enforced in application logic and by a partial unique index on `(eventId, isDefault)` where `isDefault = true`.

---

### `Pool`

An event-scoped matching pool. Singles choose exactly one pool per event.

| Column             | Type        | Notes                                     |
|--------------------|-------------|-------------------------------------------|
| `id`               | `uuid`      | Primary key                               |
| `eventId`          | `uuid`      | FK → `Event`                              |
| `defaultTitle`     | `text`      | Title in the event default language       |
| `allowRematch`     | `boolean`   | Whether the same pair may be matched again within this pool |
| `callSchedule`     | `jsonb`     | Cron expression or structured schedule for matching calls |
| `meetingTimeLimitMinutes` | `integer` | Nullable; 0 means no limit           |
| `archivedAt`       | `timestamp` | Nullable; archived pools reject new memberships |
| `createdAt`        | `timestamp` |                                           |
| `updatedAt`        | `timestamp` |                                           |

**Indexes:** `id` (PK), index on `eventId`.

**Relationships:**
- Belongs to one `Event`
- Has many `PoolTranslation`
- Has many `Tag`
- Has many `MeetingSpot`
- Has one optional `QuestionScript`
- Has many `SinglePoolMembership`
- Has many `MatchRun`

---

### `PoolTranslation`

Translated pool title for non-default event languages.

| Column     | Type   | Notes               |
|------------|--------|---------------------|
| `id`       | `uuid` | Primary key         |
| `poolId`   | `uuid` | FK → `Pool`         |
| `locale`   | `text` | BCP 47              |
| `title`    | `text` |                     |

**Indexes:** `id` (PK), unique on `(poolId, locale)`.

**Fallback:** If no translation exists for a requested locale, the `Pool.defaultTitle` is used.

---

### `Tag`

A pool-scoped tag that singles can assign to themselves or require in a partner.

| Column        | Type   | Notes               |
|---------------|--------|---------------------|
| `id`          | `uuid` | Primary key         |
| `poolId`      | `uuid` | FK → `Pool`         |
| `defaultLabel`| `text` | Label in default language |
| `archivedAt`  | `timestamp` | Nullable       |

**Indexes:** `id` (PK), index on `poolId`.

**Relationships:** Has many `TagTranslation`.

---

### `TagTranslation`

Translated tag label.

| Column    | Type   | Notes               |
|-----------|--------|---------------------|
| `id`      | `uuid` | Primary key         |
| `tagId`   | `uuid` | FK → `Tag`          |
| `locale`  | `text` | BCP 47              |
| `label`   | `text` |                     |

**Indexes:** `id` (PK), unique on `(tagId, locale)`.

**Fallback:** Falls back to `Tag.defaultLabel` if no translation for requested locale.

---

### `MeetingSpot`

A physical or designated meeting location within an event.

| Column       | Type        | Notes                               |
|--------------|-------------|-------------------------------------|
| `id`         | `uuid`      | Primary key                         |
| `poolId`     | `uuid`      | FK → `Pool`                         |
| `title`      | `text`      |                                     |
| `description`| `text`      | Nullable                            |
| `archivedAt` | `timestamp` | Nullable                            |
| `createdAt`  | `timestamp` |                                     |

**Indexes:** `id` (PK), index on `poolId`.

**Relationships:** Has many `MeetingSpotImage`. Referenced by `Match`.

---

### `MeetingSpotImage`

Metadata for an uploaded image associated with a meeting spot. The file itself is stored via the storage abstraction; only metadata is in Postgres.

| Column        | Type        | Notes                                        |
|---------------|-------------|----------------------------------------------|
| `id`          | `uuid`      | Primary key                                  |
| `meetingSpotId` | `uuid`   | FK → `MeetingSpot`                           |
| `storageKey`  | `text`      | Object key or path in the storage backend    |
| `mimeType`    | `text`      |                                              |
| `sizeBytes`   | `integer`   |                                              |
| `uploadedAt`  | `timestamp` |                                              |

**Indexes:** `id` (PK), index on `meetingSpotId`.

---

### `QuestionScript`

An ordered list of prompts presented to both singles during a meeting.

| Column    | Type    | Notes                          |
|-----------|---------|--------------------------------|
| `id`      | `uuid`  | Primary key                    |
| `poolId`  | `uuid`  | FK → `Pool`; unique (one per pool) |
| `questions` | `jsonb` | Ordered array of `{ locale: string, text: string }[]` per question |

**Indexes:** `id` (PK), unique on `poolId`.

---

### `SingleSession`

Event-scoped participation record. Exists for both anonymous and persistent singles.

| Column        | Type        | Notes                                                   |
|---------------|-------------|---------------------------------------------------------|
| `id`          | `uuid`      | Primary key                                             |
| `eventId`     | `uuid`      | FK → `Event`                                            |
| `userId`      | `uuid`      | FK → `User`; nullable for anonymous sessions            |
| `displayName` | `text`      |                                                         |
| `profileImageKey` | `text`  | Storage key; nullable; set only after consent          |
| `profileImageConsent` | `boolean` | Must be true before `profileImageKey` is set    |
| `state`       | `enum`      | `SingleState`                                           |
| `createdAt`   | `timestamp` |                                                         |
| `updatedAt`   | `timestamp` |                                                         |
| `expiresAt`   | `timestamp` | Nullable; anonymous sessions expire on event close      |

**Indexes:** `id` (PK), index on `eventId`, index on `userId`.

**Relationships:**
- Belongs to one `Event`
- Optionally belongs to one `User`
- Has at most one active `SinglePoolMembership`
- Has many `SinglePreference`

**Lifecycle:** Anonymous sessions are scoped to the event and expire when the event closes or the session token expires. Persistent sessions survive across reconnects.

---

### `SinglePoolMembership`

Records a single's current pool within an event. A new row is created when pool changes; previous rows are retained for history.

| Column     | Type        | Notes                    |
|------------|-------------|--------------------------|
| `id`       | `uuid`      | Primary key              |
| `sessionId`| `uuid`      | FK → `SingleSession`     |
| `poolId`   | `uuid`      | FK → `Pool`              |
| `ownTagIds`| `uuid[]`    | Tags the single has selected for themselves |
| `joinedAt` | `timestamp` |                          |
| `leftAt`   | `timestamp` | Nullable; set when pool changes |

**Indexes:** `id` (PK), index on `sessionId`.

**Constraint:** Only one membership with `leftAt IS NULL` per session enforced in application logic.

---

### `SinglePreference`

The mandatory partner tags a single requires for a specific search or booking action. A new row is created per action.

| Column             | Type        | Notes                           |
|--------------------|-------------|---------------------------------|
| `id`               | `uuid`      | Primary key                     |
| `sessionId`        | `uuid`      | FK → `SingleSession`            |
| `poolMembershipId` | `uuid`      | FK → `SinglePoolMembership`     |
| `mandatoryTagIds`  | `uuid[]`    | Tags required in a partner      |
| `createdAt`        | `timestamp` |                                 |

**Indexes:** `id` (PK), index on `sessionId`.

---

### `PushSubscription`

Browser Web Push subscription stored server-side.

| Column      | Type        | Notes                             |
|-------------|-------------|-----------------------------------|
| `id`        | `uuid`      | Primary key                       |
| `sessionId` | `uuid`      | FK → `SingleSession`              |
| `endpoint`  | `text`      | Browser push endpoint URL         |
| `p256dh`    | `text`      | Public key                        |
| `auth`      | `text`      | Auth secret                       |
| `subscribedAt` | `timestamp` |                               |
| `revokedAt` | `timestamp` | Nullable                          |

**Indexes:** `id` (PK), unique on `endpoint`, index on `sessionId`.

**Consent:** Subscription creation requires prior user consent. Subscriptions are revocable by the user.

---

### `MatchRun`

One execution of the matching algorithm, either immediate (single search) or scheduled (pool call).

| Column         | Type        | Notes                                           |
|----------------|-------------|-------------------------------------------------|
| `id`           | `uuid`      | Primary key                                     |
| `poolId`       | `uuid`      | FK → `Pool`                                     |
| `trigger`      | `enum`      | `MatchRunTrigger`                               |
| `initiatedBy`  | `uuid`      | FK → `SingleSession`; nullable for scheduled runs |
| `ranAt`        | `timestamp` |                                                 |
| `totalBooked`  | `integer`   | Singles eligible at run time                    |
| `totalMatched` | `integer`   | Singles placed in a match                       |
| `totalUnmatched` | `integer` | Singles not placed                              |
| `spotsShortfall` | `integer` | Pairs that could not be finalized due to no spot |

**Indexes:** `id` (PK), index on `poolId`.

**Relationships:** Has many `Match`.

---

### `Match`

A finalized pair assigned to a meeting spot.

| Column         | Type        | Notes                               |
|----------------|-------------|-------------------------------------|
| `id`           | `uuid`      | Primary key                         |
| `matchRunId`   | `uuid`      | FK → `MatchRun`                     |
| `sessionAId`   | `uuid`      | FK → `SingleSession`                |
| `sessionBId`   | `uuid`      | FK → `SingleSession`                |
| `meetingSpotId`| `uuid`      | FK → `MeetingSpot`; reserved exclusively |
| `createdAt`    | `timestamp` |                                     |
| `releasedAt`   | `timestamp` | Nullable; set when match is no-show or completed |

**Indexes:** `id` (PK), index on `matchRunId`, index on `sessionAId`, index on `sessionBId`.

**Constraint:** Each session may have at most one active match (where `releasedAt IS NULL`) enforced in application logic.

---

### `MatchLog`

Historical record created when both singles confirm arrival and the meeting begins.

| Column         | Type        | Notes                               |
|----------------|-------------|-------------------------------------|
| `id`           | `uuid`      | Primary key                         |
| `matchId`      | `uuid`      | FK → `Match`; unique                |
| `poolId`       | `uuid`      | FK → `Pool`                         |
| `sessionAId`   | `uuid`      | FK → `SingleSession`                |
| `sessionBId`   | `uuid`      | FK → `SingleSession`                |
| `meetingBeganAt` | `timestamp` |                                   |
| `meetingEndedAt` | `timestamp` | Nullable; set when meeting ends   |

**Indexes:** `id` (PK), unique on `matchId`, index on `poolId`, index on `sessionAId`, index on `sessionBId`.

**Retention:** Retained for 90 days for organiser reporting. Used to enforce rematch prevention within the same pool.

---

### `MeetingConfirmation`

Arrival confirmation from a single for a given match.

| Column       | Type        | Notes                                       |
|--------------|-------------|---------------------------------------------|
| `id`         | `uuid`      | Primary key                                 |
| `matchId`    | `uuid`      | FK → `Match`                                |
| `sessionId`  | `uuid`      | FK → `SingleSession`                        |
| `confirmedAt`| `timestamp` |                                             |
| `noShow`     | `boolean`   | True if confirmation window expired without action |

**Indexes:** `id` (PK), unique on `(matchId, sessionId)`.

**Lifecycle:** If only one confirmation arrives within the window, `noShow = true` is set on the missing party's record and both sessions are released back to mode selection.

---

### `AuditEntry`

Append-only log of admin and organiser actions.

| Column      | Type        | Notes                                          |
|-------------|-------------|------------------------------------------------|
| `id`        | `uuid`      | Primary key                                    |
| `actorId`   | `uuid`      | FK → `User`                                    |
| `action`    | `text`      | Machine-readable action identifier             |
| `entityType`| `text`      | Target entity type (e.g. `Event`, `Pool`)      |
| `entityId`  | `uuid`      | Target entity ID                               |
| `payload`   | `jsonb`     | Before/after snapshot or action parameters     |
| `occurredAt`| `timestamp` |                                                |

**Indexes:** `id` (PK), index on `(actorId, occurredAt)`, index on `(entityType, entityId)`.

**Retention:** Retained for 90 days. Entries are immutable once written.

---

## Relationships Summary

```
User ──< Identity
User ──< UserRole
User ──< EventOrganiser >─── Event
Event ──< EventLanguage
Event ──< Pool ──< PoolTranslation
               ──< Tag ──< TagTranslation
               ──< MeetingSpot ──< MeetingSpotImage
               ──< QuestionScript
Event ──< SingleSession ──< SinglePoolMembership
                        ──< SinglePreference
                        ──< PushSubscription
Pool ──< MatchRun ──< Match ──< MeetingConfirmation
                         ──< MatchLog
User ──< AuditEntry
```

---

## Retention Notes

| Data                        | Retention                                   |
|-----------------------------|---------------------------------------------|
| `MatchLog`                  | 90 days from meeting date                   |
| `AuditEntry`                | 90 days from action date                    |
| `SingleSession` (anonymous) | Expires when event closes or token expires  |
| `User` (deleted)            | PII cleared on deletion; row retained for FK integrity |
| `MeetingSpotImage` files    | Deleted from storage when spot is archived  |
| `PushSubscription`          | Deleted when revoked; expired keys pruned on failed delivery |
