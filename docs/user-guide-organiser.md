# Organiser User Guide

This guide is for **organisers** running a Someone Meetup blind date event. As an organiser you set up the pools, tags, meeting spots, scripts, and timers that shape the event, and you monitor the live dashboard while singles are matching and meeting.

## 1. Before you start

You need:

- A persistent account signed in with **Google** or **Discord**.
- An admin to have **assigned you to the event** you will run.
- The list of physical meeting spots at the venue.
- The languages you want to support, with one chosen as default.
- The pool structure you want (for example "Women seeking Men", "Men seeking Women", "Anyone seeking Anyone").

If you do not yet have an event, ask a system admin to create one and assign you — see [user-guide-admin.md](user-guide-admin.md).

## 2. Signing in

1. Open `/admin/login`.
2. Sign in with the same SSO provider linked to the account that was assigned as organiser.
3. You land on the admin shell. The events you can configure appear in **Events**.

You will only see events you are assigned to. Other events are hidden.

## 3. Event dashboard overview

Open your event from the events list. The event detail page shows:

- **Status** — current lifecycle state (`DRAFT`, `PUBLISHED`, `LIVE`, `CLOSED`, `ARCHIVED`).
- **Languages** — supported languages with the default language flagged.
- **Pools** — configured pools with quick counts.
- **Live activity** — connected singles, active searches, active meetings, recent match runs, and unmatched singles (visible while the event is `LIVE`).
- **Match runs** — history of immediate searches and scheduled call executions.

From here you can open the full configuration screen via **Configure**.

## 4. Configuring the event

You can configure the event while it is in `DRAFT` or `PUBLISHED`. Most config changes are also permitted while `LIVE`, but they only affect future searches and bookings; finalized matches are not retroactively re-evaluated.

### 4.1 Languages

1. Open **Configure › Languages**.
2. Add each supported language (for example `en`, `de`, `fr`).
3. Mark one language as **Default**. The default language is used as a fallback whenever a translation is missing.

The first language you add becomes the default automatically; you can change the default later.

### 4.2 Pools

A pool is a self-contained matching group. Singles belong to exactly one pool per event.

For each pool, configure:

- **Title (default language)** and **translations** for the other event languages.
- **Tags** allowed in this pool.
- **Meeting spots** available to pairs in this pool.
- **Matching call schedule** — zero or more scheduled times when the matching algorithm runs across all booked singles in this pool.
- **Rematch policy** — whether two singles who already met in this pool can be paired again.
- **Optional question script** — a list of prompts shown to a pair during their meeting.
- **Optional meeting time limit** — a duration after which the meeting ends automatically.

A pool cannot be published with zero tags or zero meeting spots.

### 4.3 Tags

Tags express what singles are like (their own tags) and what they require in a partner (mandatory tags). Examples: `LGBTQ+`, `loves dogs`, `non-smoker`, `vegetarian`.

For each tag:

1. Provide the **default-language label**.
2. Add **translations** for each other event language.

Tags are pool-scoped. The same concept can exist in two pools as two separate tag records if you need different translations or visibility rules.

### 4.4 Meeting spots

A meeting spot is a physical location at the venue (a numbered table, a bench, a corner). For each spot:

1. Add a **name** that singles will recognise (for example "Table 7").
2. Add a **short description** if the location needs context (for example "near the bar, by the window").
3. Optionally upload **pictures** so singles can find the spot quickly.

Meeting spots are exclusive: while a pair is using a spot, no other pair will be sent there.

If you run out of spots during a busy matching call, fewer pairs are finalised and the dashboard reports the deficit. Add more spots before the next call.

### 4.5 Question scripts

A question script is an optional sequence of prompts shown to a pair during their meeting. Use scripts to break the ice or to structure the conversation.

You can either build the script in the UI step by step, or upload a script in the DSL described in [question-script-format.md](question-script-format.md).

### 4.6 Matching call schedule and rematch

For a pool, you can configure:

- **Scheduled call times** — concrete clock times in the event's time zone. At each call, the backend runs Edmonds' Blossom over all booked singles in the pool to compute a maximum-cardinality matching.
- **Rematch policy** — when disabled, two singles who have already met (in this pool) are not paired again. Re-pairings in other pools are unaffected.

### 4.7 Meeting time limit

Set a duration if you want meetings to end automatically. A warning notification is sent 2 minutes before the end, and the meeting ends at expiry. Without a time limit, pairs end their meeting manually.

## 5. Running the event

### 5.1 Going live

1. Confirm all pools have at least one tag and one meeting spot.
2. Have an admin move the event to `PUBLISHED` so singles can join.
3. When you are ready to start matching, move the event to `LIVE`.

### 5.2 The live dashboard

While the event is `LIVE`, the dashboard updates in real time over WebSocket. You can see:

- **Connected singles** per pool, with current state (available, searching, booked, moving, meeting, completed, unmatched, offline).
- **Active searches** in progress.
- **Active meetings** with their start time and remaining time.
- **Upcoming scheduled call** countdown per pool.
- **Match run results** — pairs finalised, singles left unmatched, reasons for failures (no compatible partner, no spot capacity).

If the dashboard freezes, reload the page. Connections resume and state is restored automatically.

### 5.3 Handling capacity issues

If a match run reports that pairs could not be finalised because there were not enough meeting spots:

1. Open **Configure › Pools › Meeting spots**.
2. Add additional spots.
3. The change takes effect for the next search or scheduled call. It does not retroactively pair the singles who were already marked unmatched; they can choose another mode immediately.

### 5.4 Closing the event

When the event is over, move it to `CLOSED`. Singles can no longer join and no new matches are made. Historical data — match logs, audit entries, dashboard counts — remains available for review.

After cleanup, the admin can move the event to `ARCHIVED` to make it read-only.

## 6. What you cannot do

- Manage system-wide admin permissions (admin-only).
- Edit events you are not assigned to.
- Override the matching algorithm to force a specific pair manually (phase 1 excludes manual overrides).
- Approve or reject attendees (phase 1 excludes attendee approval).

## 7. Quick reference

| Task                                       | Where                                          |
| ------------------------------------------ | ---------------------------------------------- |
| Add a language                             | Configure › Languages                          |
| Create a pool                              | Configure › Pools › New pool                   |
| Add tags                                   | Configure › Pools › *pool* › Tags              |
| Add meeting spots                          | Configure › Pools › *pool* › Meeting spots     |
| Schedule a matching call                   | Configure › Pools › *pool* › Schedule          |
| Disable rematches                          | Configure › Pools › *pool* › Rematch policy    |
| Attach a question script                   | Configure › Pools › *pool* › Script            |
| Watch live activity                        | Event detail (while `LIVE`)                    |
| Review a past match run                    | Event detail › Match runs                      |

## 8. Troubleshooting

**A pool will not save.**
It needs at least one tag and one meeting spot.

**Singles say the link does not work.**
The event is not in `PUBLISHED` or `LIVE`. Ask the admin to publish it.

**A scheduled call produced very few pairs.**
Check the match run details. Common causes: too many incompatible tag requirements, rematch policy blocking previously-paired singles, or insufficient meeting spots.

**Translations look wrong.**
Translations fall back to the default language when missing. Confirm the translation entry exists for the language the single is viewing.

**A meeting never started.**
At least one single must confirm arrival within the no-show timeout. Both users are then prompted for the next action.
