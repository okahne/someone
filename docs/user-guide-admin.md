# Admin User Guide

This guide is for **system administrators** of the Someone Meetup platform. As an admin you create events, control their lifecycle, assign organisers, and audit activity across the system.

## 1. Who this guide is for

You are a system admin if your persistent account has been granted the `SYSTEM_ADMIN` role on the backend. SSO alone does not make you an admin — the role must be assigned in the database by an existing admin or the initial seed.

## 2. Signing in

1. Open the application in a modern browser (Chrome, Edge, Firefox, or Safari).
2. Go to `/admin/login`.
3. Choose **Sign in with Google** or **Sign in with Discord**.
4. Complete the SSO consent screen at your provider.
5. You are redirected to the admin shell at `/admin/events`.

If the provider authenticates you but the app shows a "not authorised" message, your account exists but does not yet have the admin role. Ask another admin to grant `SYSTEM_ADMIN`.

## 3. The admin shell

The admin shell at `/admin` provides two main areas via its sidebar:

- **Events** — list, create, open, and configure events.
- **Audit** — view a chronological log of admin and organiser actions.

Your signed-in identity and a sign-out control appear in the header.

## 4. Managing events

### 4.1 Creating an event

1. Open **Events**.
2. Click **New event**.
3. Fill in the event metadata:
   - **Title** — public name shown to singles.
   - **Slug** — the URL fragment used in the public link (`/event/<slug>`).
   - **Description** — short overview shown on the join page.
   - **Time zone** — used for scheduled matching calls and timers.
   - **Start / end** — informational lifecycle bounds.
4. Save. The event is created in `DRAFT` state.

### 4.2 Editing event metadata

Open the event from the list and edit any field that is not locked. Metadata edits are allowed in `DRAFT` and `PUBLISHED`. Once an event is `LIVE` only safe fields (such as description) may change.

### 4.3 Event lifecycle

Events move through these states:

| State       | What it means                                                       |
| ----------- | ------------------------------------------------------------------- |
| `DRAFT`     | Visible only to admins and organisers. Fully editable.              |
| `PUBLISHED` | Singles can open the link and join.                                 |
| `LIVE`      | Matching, meetings, and timers are active.                          |
| `CLOSED`    | New joins and matches blocked. Historical data preserved.           |
| `ARCHIVED`  | Read-only. Use for events that no longer need operational access.   |

Use the state controls on the event detail page to advance the lifecycle. You cannot skip backward (for example, `LIVE` → `DRAFT`).

### 4.4 Generating the public link

Once the event exists, an event link is generated automatically. On the event detail page, use **Copy link** to put the public URL on your clipboard. Share this link with attendees through your own channel (Discord, email, printed QR, etc.).

The link is public by design: anyone with it can open the join page while the event is `PUBLISHED` or `LIVE`.

### 4.5 Assigning organisers

1. Open the event detail page.
2. Go to the **Organisers** section.
3. Search for a persistent user by name or email.
4. Click **Add organiser**.

Only persistent users (Google or Discord SSO accounts) can be assigned as organisers. Anonymous singles cannot become organisers. Remove an organiser at any time with the **Remove** action; that user immediately loses access to the event configuration.

## 5. Configuring an event

Admins may open the configuration page (`Events › Configure`) and edit pools, languages, tags, meeting spots, and scripts. Most day-to-day configuration is intended to be done by organisers — see [user-guide-organiser.md](user-guide-organiser.md) for the full reference. As an admin you have the same configuration powers on every event.

## 6. The audit log

Open **Audit** to view system activity. Each entry includes:

- Timestamp (in your browser time zone).
- Actor (user and role).
- Action (for example, `event.publish`, `organiser.assign`).
- Target resource.
- Optional context payload.

Filters let you scope the log by actor, event, or time range. The log is retained for 90 days.

## 7. Things admins cannot do

- Use anonymous mode. Admins always act under their SSO identity.
- Bypass role checks. Authentication and authorisation are separate; SSO proves who you are, the role determines what you may do.
- Edit historical match logs or audit entries. Both are append-only.

## 8. Common tasks at a glance

| I want to…                                | Where to go                          |
| ----------------------------------------- | ------------------------------------ |
| Create a new event                        | Events › New event                   |
| Share the join link                       | Events › *event* › Copy link         |
| Let an organiser start setting up         | Events › *event* › Organisers › Add  |
| Open the doors to singles                 | Events › *event* › Set `PUBLISHED`   |
| Start matching                            | Events › *event* › Set `LIVE`        |
| Stop accepting new joins                  | Events › *event* › Set `CLOSED`      |
| Investigate "who changed that?"           | Audit                                |

## 9. Troubleshooting

**I can sign in but I cannot see any events.**
You do not yet have the `SYSTEM_ADMIN` role. Another admin must grant it.

**The event link returns "event unavailable".**
The event is in `DRAFT`, `CLOSED`, or `ARCHIVED`. Move it to `PUBLISHED` or `LIVE` to allow joins.

**An organiser cannot edit a pool.**
Confirm the organiser is assigned to the event. Organisers only see events they are assigned to.

**A change I made is not visible to organisers in real time.**
Organiser dashboards refresh over WebSocket. Ask them to reload the page if they were disconnected; live updates resume automatically on reconnect.
