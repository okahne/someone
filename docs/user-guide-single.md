# Singles User Guide

Welcome! This guide explains how to take part in a Someone Meetup blind date event as a **single**. It walks you through joining an event, choosing a pool, picking your tags, choosing a mode, getting matched, and meeting your partner.

## 1. What you need

- A modern web browser (Chrome, Edge, Firefox, or Safari) on your phone or laptop.
- The **event link** from the organiser. Links look like `https://<host>/event/<event-slug>`.
- Optional: a profile picture (camera capture or file upload).
- Optional: a Google or Discord account if you want to sign in instead of joining anonymously.

You do **not** need to install an app. The site works as a Progressive Web App and can be added to your home screen if you want.

## 2. Joining an event

1. Open the event link the organiser shared.
2. If the event is open for joining, you will see the event title and a join screen.
3. Choose how to join:
   - **Continue as guest** — enter a display name. No account is created. Your access lasts only for this event.
   - **Sign in with Google** or **Sign in with Discord** — you keep a persistent account that can join future events.
4. Optionally upload or capture a **profile picture**. You will be asked for camera or file permission. You can skip this step.
5. Accept the consent prompt for notifications when asked. Notifications make sure you don't miss your match.

Anonymous accounts cannot be upgraded to a real account later in this version. If you want a persistent account, sign in with SSO from the start.

If the link says the event is unavailable, the event has not been opened yet, is already closed, or the link is wrong. Ask the organiser for the current link.

## 3. The main screen

After joining you land on the main screen. From here you:

1. **Pick a pool** — for example "Men seeking Women", "Women seeking Men", "Anyone seeking Anyone". You can be in only one pool at a time.
2. **Pick your own tags** — things that describe you, from the list the organiser configured (for example `loves dogs`, `non-smoker`, `vegetarian`).
3. **Choose a mode** — see the next section.

You can change your pool at any time. Switching pool resets your current mode and your partner preferences.

## 4. The three modes

You participate by choosing one of three modes.

### 4.1 Available to be contacted

You stay visible in your pool and may be picked by anyone else who searches for a partner like you.

Choose this mode when you want a relaxed pace. You will be notified when someone is matched with you.

### 4.2 Search for someone now

You actively look for a partner right now.

1. Pick the **mandatory tags** your partner must have.
2. Tap **Search now**.
3. The system finds one compatible single in your pool who is currently available and reserves a meeting spot for the two of you.
4. You both get a notification with the meeting spot.

If nothing is available right now you will see a clear message — for example "no compatible partner is available" or "no free meeting spot". You can pick another mode immediately.

### 4.3 Join the next matching call

You sign up for the next scheduled batch of matches.

1. Pick the **mandatory tags** your partner must have.
2. Tap **Join next call**.
3. You see a countdown to the call time.
4. At the call, the system pairs everyone who is booked into as many compatible pairs as it can.
5. If you are paired, you get a notification with the meeting spot. If not, you see a friendly "unmatched" screen and can choose another mode.

If the pool blocks rematches, you will not be paired again with someone you have already met in this pool.

## 5. Compatibility, in one sentence

A match is only valid when **both** people meet **all** of the mandatory tags the other person required. Your tags must satisfy your partner, and theirs must satisfy you.

## 6. The meeting flow

Once you are matched:

1. You see the **meeting spot** (name, short description, picture if available).
2. Walk to the spot.
3. Tap **I'm here** when you arrive.
4. When both of you have confirmed (or the rules of the event are otherwise met), the meeting starts.
5. If the organiser configured a **question script**, prompts appear on screen to help break the ice.
6. If there is a **time limit**, you will get a warning **2 minutes** before the end and a notification when time is up.
7. When the meeting ends, you are returned to the main screen to choose a new mode.

If one of you never confirms arrival within the no-show window, the meeting is marked as a no-show and you are both returned to the main screen.

## 7. Notifications

You will get a notification for:

- A match being assigned to you.
- 2-minute warning during a meeting.
- The end of a meeting.

These arrive as **Web Push notifications** when the browser tab is in the background. When the tab is open and connected, updates appear instantly on screen.

To get notifications you must:

- Accept the notification permission prompt the first time the browser asks.
- Keep the site allowed to send notifications in your browser settings.

If you missed a notification, just open the tab — your current state is restored automatically.

## 8. Your states explained

Behind the scenes you move through these states:

| State        | Meaning                                              |
| ------------ | ---------------------------------------------------- |
| `JOINED`     | You have entered the event but not picked a mode.    |
| `AVAILABLE`  | You can be picked by other searchers.                |
| `SEARCHING`  | You are actively searching right now.                |
| `BOOKED`     | You are signed up for the next scheduled call.       |
| `MOVING`     | You have a match — walk to the meeting spot.         |
| `MEETING`    | Your meeting is in progress.                         |
| `COMPLETED`  | Your meeting ended; pick a new mode.                 |
| `UNMATCHED`  | The last search or call did not produce a match.     |
| `OFFLINE`    | You are disconnected. State is restored on reconnect.|

## 9. Privacy and your data

- Anonymous accounts exist only for this event and disappear when it closes.
- Persistent accounts (Google / Discord) can be deleted from the profile screen.
- Profile pictures are stored only if you uploaded one and only for the duration of organiser retention (90 days).
- Notification subscriptions are stored server-side and can be revoked at any time from your browser settings or the profile screen.

## 10. Tips and etiquette

- Pick tags honestly — they decide whether someone wants to be matched with you.
- If you choose **Search now** with very strict mandatory tags you may get an "unmatched" result a lot. Loosen requirements to find more partners.
- Be quick to confirm arrival at the meeting spot — your partner may give up waiting.
- If the venue is crowded, look for the meeting spot picture if one is provided.
- After a meeting, take a moment before jumping into the next mode. There is no rush.

## 11. Troubleshooting

**"This event is not available."**
The event has not been opened yet, is closed, or the link is wrong. Ask the organiser.

**I can't upload a profile picture.**
The browser blocked camera or file access. Open the site permissions in your browser and allow them, then try again.

**I never got my match notification.**
Check that notifications are allowed for this site, and that the browser is not in "do not disturb" mode. Re-open the event tab — your match is still there.

**The countdown timer looks frozen.**
The connection dropped. The timer is driven by the server, so reconnecting restores the real remaining time.

**I want to switch pools.**
Switching pool is allowed and will reset your current mode and partner preferences. You will not be removed from a meeting that is already in progress.

**My partner never showed up.**
Wait for the no-show timeout. The system will mark it and return you to the main screen so you can try again.

Have fun, and good luck!
