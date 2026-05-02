# UI Style Guide — Blind Date

A single source of truth for the look, feel and interaction language of the
**Blind Date** product. Every screen — admin console, organiser configuration,
and the participant ("single") experience — must adhere to the rules in this
document. When in doubt, prefer **calm, generous, romantic** over "dense, loud,
techy".

---

## 1. Brand voice

| Attribute      | We are…                              | We are not…                  |
| -------------- | ------------------------------------ | ---------------------------- |
| Tone           | Warm, witty, encouraging             | Clinical, transactional      |
| Pace           | Unhurried, deliberate                | Frantic, "growth-hacky"      |
| Visual feel    | Soft glow, dusk colours, gentle glass | Flat utility, neon dashboard |
| Microcopy      | Short, human, second person          | Jargon, marketing fluff      |

A participant should feel like they are at a candle-lit bar, not in a SaaS
admin panel. Organisers and admins get the same warmth, with denser
information density and more controls.

---

## 2. Design tokens

All tokens are exposed as CSS custom properties on `:root` in
`apps/frontend/src/styles.scss`. **Never hard-code colours, radii, spacing or
shadows in components** — always use a token. If a token is missing, add it
here first.

### 2.1 Colour — Dark theme (default)

| Token                  | Value      | Usage                                       |
| ---------------------- | ---------- | ------------------------------------------- |
| `--bg-canvas`          | `#0B0D12`  | App background (with gradient overlay)      |
| `--bg-surface`         | `#151823`  | Cards, panels                               |
| `--bg-surface-2`       | `#1D2230`  | Nested surfaces, table header, hovered rows |
| `--bg-elevated`        | `#222838`  | Popovers, modals                            |
| `--bg-input`           | `#10131C`  | Form inputs                                 |
| `--border-subtle`      | `#262B3A`  | Dividers, table rows, input borders         |
| `--border-strong`      | `#3A4054`  | Focused inputs, selected rows               |
| `--text-primary`       | `#F5F5F7`  | Body & headings                             |
| `--text-secondary`     | `#C7CAD4`  | Secondary copy                              |
| `--text-muted`         | `#8A90A2`  | Labels, captions, timestamps                |
| `--text-on-brand`      | `#FFFFFF`  | Text on brand-filled surfaces               |

### 2.2 Colour — Brand palette

The brand is a warm rose, evoking dusk, candlelight and connection. It is
paired with a cool indigo accent that signals system / administrative actions.

| Token              | Value     | Usage                                    |
| ------------------ | --------- | ---------------------------------------- |
| `--brand-50`       | `#FFF1F4` | Brand wash on light surfaces             |
| `--brand-200`      | `#FFC2CE` | Hover backgrounds                        |
| `--brand-400`      | `#FF7E96` | Brand secondary, hover                   |
| `--brand-500`      | `#FF5C7A` | **Primary brand** — buttons, focus rings |
| `--brand-600`      | `#E63E63` | Brand pressed state                      |
| `--brand-700`      | `#B82B4B` | Brand on dark, accent text               |
| `--brand-gradient` | `linear-gradient(135deg, #FF7E96 0%, #FF5C7A 50%, #E63E63 100%)` | Hero buttons, brand bar |
| `--accent-500`     | `#7C8CFF` | Admin/system accent, links               |
| `--accent-600`     | `#5B6CFF` | Admin pressed state                      |

### 2.3 Colour — Semantic

| Token             | Value     | Usage                       |
| ----------------- | --------- | --------------------------- |
| `--success-500`   | `#3DDC97` | Live, confirmed, online     |
| `--warning-500`   | `#F5A524` | Closed, warnings, "2 min left" |
| `--danger-500`    | `#FF5C5C` | Destructive, errors         |
| `--info-500`      | `#5BC0EB` | Informational badges        |

### 2.4 Status mapping (events & sessions)

| Status        | Token used        | Visual         |
| ------------- | ----------------- | -------------- |
| `DRAFT`       | `--text-muted`    | Neutral pill   |
| `PUBLISHED`   | `--accent-500`    | Indigo pill    |
| `LIVE`        | `--success-500`   | Green pill, pulsing dot |
| `CLOSED`      | `--warning-500`   | Amber pill     |
| `ARCHIVED`    | `--border-strong` | Faded pill     |

### 2.5 Spacing scale

A 4-pt grid. Always use the scale tokens — do not invent intermediate values.

| Token          | Value | Use                                 |
| -------------- | ----- | ----------------------------------- |
| `--space-1`    | 4px   | Icon gap, badge inner padding       |
| `--space-2`    | 8px   | Tight stack, chip gap               |
| `--space-3`    | 12px  | Default control padding             |
| `--space-4`    | 16px  | Default `--space` (legacy alias)    |
| `--space-5`    | 24px  | Card padding, section gap           |
| `--space-6`    | 32px  | Page section gap                    |
| `--space-8`    | 48px  | Hero spacing                        |
| `--space-10`   | 64px  | Page top margin on auth screens     |

### 2.6 Radii

| Token          | Value | Use                              |
| -------------- | ----- | -------------------------------- |
| `--radius-xs`  | 4px   | Tags, micro chips                |
| `--radius-sm`  | 8px   | Buttons, inputs (legacy `--radius`) |
| `--radius-md`  | 12px  | Cards                            |
| `--radius-lg`  | 20px  | Modals, hero panels              |
| `--radius-pill`| 999px | Badges, status pills, avatars    |

### 2.7 Elevation

Shadows are **soft and warm-tinted** — never neutral grey. Combine with a 1px
inner border for definition on dark surfaces.

| Token            | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| `--shadow-sm`    | `0 1px 2px rgba(8, 10, 16, 0.4)`                         |
| `--shadow-md`    | `0 6px 20px -8px rgba(8, 10, 16, 0.55)`                  |
| `--shadow-lg`    | `0 24px 60px -20px rgba(8, 10, 16, 0.7)`                 |
| `--shadow-glow`  | `0 0 0 4px rgba(255, 92, 122, 0.18)`                     |
| `--shadow-focus` | `0 0 0 3px rgba(124, 140, 255, 0.45)`                    |

### 2.8 Motion

| Token           | Value                                  | Use                       |
| --------------- | -------------------------------------- | ------------------------- |
| `--ease-out`    | `cubic-bezier(0.22, 1, 0.36, 1)`       | Entrances                 |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)`       | Layout transitions        |
| `--dur-fast`    | `120ms`                                | Hover, focus              |
| `--dur-base`    | `220ms`                                | Cards, modals             |
| `--dur-slow`    | `420ms`                                | Hero, page transitions    |

`prefers-reduced-motion: reduce` must short-circuit all non-essential
animations to `0ms` and disable transforms.

---

## 3. Typography

- **Body / UI:** `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- **Display (h1, hero):** `"Fraunces", "Inter", serif` — a warm, slightly
  romantic serif used only for primary page titles and marketing surfaces.
- **Mono:** `"JetBrains Mono", ui-monospace, SFMono-Regular, monospace` — for
  IDs, JSON payloads in audit log, cron strings.

| Role            | Font     | Size   | Line | Weight | Tracking |
| --------------- | -------- | ------ | ---- | ------ | -------- |
| Display / h1    | Fraunces | 32 px  | 1.15 | 500    | -0.01em  |
| h2              | Inter    | 22 px  | 1.25 | 600    | -0.005em |
| h3              | Inter    | 17 px  | 1.3  | 600    | 0        |
| Body            | Inter    | 15 px  | 1.55 | 400    | 0        |
| Body small      | Inter    | 13 px  | 1.5  | 400    | 0        |
| Caption / label | Inter    | 12 px  | 1.4  | 500    | 0.02em uppercase |
| Mono            | JetBrains| 13 px  | 1.5  | 400    | 0        |

Headings must always have at least `--space-2` of breathing space below them.
Never use `<b>` for emphasis — use `<strong>` (which we re-style to brand-700).

---

## 4. Layout

### 4.1 Page frame

- **Single experience** (`/event/:slug`, `/play/:sessionId`):
  centred column, `max-width: 560px`, generous top margin (`--space-8`).
  Single column even on desktop — feels like a chat, not a dashboard.
- **Admin & organiser** (`/admin/**`):
  `220px` sidebar + fluid content area. Content is constrained to
  `max-width: 1080px` and centred within the work area.
- **Auth (login, entry):** centred card `max-width: 480px`,
  `margin-top: --space-10`.

### 4.2 Grids

Use CSS Grid for any 2-D layout (sidebar + content, dashboard tiles). Use
flexbox for 1-D rows (toolbars, button groups). Never nest flex inside flex
inside flex — extract a class.

### 4.3 Density

Two densities are supported:
- **Comfortable** (default everywhere participants see).
- **Compact** for admin tables — opt in with `class="compact"` on the table.

---

## 5. Components

All components below are styled globally. Components MUST use the documented
class names rather than inline styles. Inline `style="…"` is permitted only for
truly dynamic values (e.g. progress widths).

### 5.1 Buttons

```html
<button>Primary</button>
<button class="secondary">Secondary</button>
<button class="ghost">Ghost</button>
<button class="danger">Destructive</button>
<button class="link">Inline link button</button>
```

- **Primary** uses `--brand-gradient` with white text. Hover lifts shadow,
  active scales to `0.98`. Focus ring uses `--shadow-glow`.
- **Secondary** is transparent with a `--border-strong` outline.
- **Ghost** has no border, only hover background — used in toolbars.
- **Danger** uses `--danger-500` solid.
- **Link** removes all chrome and is used inline.
- All buttons honour `:disabled` with `opacity: 0.45; cursor: not-allowed`
  and **never** show hover styles when disabled.
- Minimum hit target: **40×40 px** on touch, **32 px** desktop dense.

### 5.2 Inputs

- Background `--bg-input`, 1 px `--border-subtle`, radius `--radius-sm`.
- Focus: border becomes `--accent-500` and shadow becomes `--shadow-focus`.
- Invalid: border `--danger-500` and supporting `<p class="error">` directly
  below the field.
- Labels live ABOVE the field with the `caption` typography style.
- Checkboxes/radios use the system control accented with `--brand-500` via
  `accent-color`.

### 5.3 Cards

```html
<section class="card">
  <header class="card-header">
    <h2>Pools</h2>
    <p class="muted">Configure the call cadence and rematch rules.</p>
  </header>
  <!-- body -->
</section>
```

- Background `--bg-surface`, border `1px solid --border-subtle`,
  radius `--radius-md`, padding `--space-5`, shadow `--shadow-md`.
- Use `card.card--flush` for cards that contain only a table (no inner padding
  on the table area).
- Use `card.card--hero` on the participant landing card; it gets the
  `--brand-gradient` as a 2 px top border and a soft `--shadow-glow`.

### 5.4 Badges & status pills

```html
<span class="badge live">LIVE</span>
<span class="badge published">PUBLISHED</span>
```

- Pills are `--radius-pill`, `caption` typography (uppercase, tracked).
- The `live` variant adds a `::before` pulsing dot in `--success-500`.

### 5.5 Tables

- Header row uses `--bg-surface-2`, sticky on scroll inside cards.
- Rows separated by `1px solid --border-subtle`. Hover row gets
  `--bg-surface-2`.
- Numeric columns are right-aligned and use `font-variant-numeric: tabular-nums`.
- IDs/UUIDs are rendered with the mono font and truncated with an ellipsis at
  8 chars (already done in the audit log).

### 5.6 Sidebar navigation

- Background `#080A10` (slightly darker than canvas), 1 px right border in
  `--border-subtle`.
- Nav items: `--radius-sm`, `--space-3` padding, hover `--bg-surface`,
  active `--brand-gradient` background and white text.
- Sidebar header includes the brand mark (rose-coloured dot + "Blind Date").

### 5.7 Empty / loading / error states

Every list view MUST handle three states explicitly:
1. **Loading** — render a `<div class="skeleton">` placeholder of the same
   shape as the eventual content.
2. **Empty** — render `<div class="empty-state">` with an emoji-free icon, a
   short title and a single CTA.
3. **Error** — render `<p class="error">` with a retry button when applicable.

### 5.8 Toast / inline feedback

- Success → green left border, `--bg-surface-2` background.
- Error → `--danger-500` left border. Auto-dismiss after 6 s; persist on hover.
- Keep messages under 80 characters.

---

## 6. Iconography

- Use a single icon set (Lucide). No mixing libraries.
- Stroke 1.75, 20 px default, 16 px in dense tables.
- Icons must always be paired with a visible label OR an `aria-label`.

---

## 7. Imagery

- Meeting-spot images are displayed at `aspect-ratio: 4 / 3`,
  `border-radius: --radius-md`, and a subtle linear gradient overlay from
  transparent to `rgba(0,0,0,0.35)` at the bottom for text legibility.
- User avatars are circles (`--radius-pill`), 40 px default, with a 1 px
  `--border-strong` ring.

---

## 8. Accessibility (non-negotiable)

- All text meets **WCAG AA**: ≥ 4.5:1 contrast for body, ≥ 3:1 for ≥ 18 pt.
  The dark theme above has been audited.
- Focus is **always visible**. Never `outline: none` without an equivalent
  replacement (`--shadow-focus`).
- Interactive elements are reachable by keyboard in DOM order. Modals trap
  focus. `Esc` closes overlays.
- Colour is never the only signal — every status pill includes its label as
  text. Errors include both a red border and a textual message.
- Animations respect `prefers-reduced-motion`.
- Live regions: real-time match notifications use
  `aria-live="polite"`; the "2 minutes left" warning uses `assertive`.
- Form controls have associated `<label for>` (already done).
- Minimum body font size 15 px; never below 12 px.

---

## 9. Internationalisation

- All user-facing strings come from the translation system in
  `packages/shared/src/util/translation.ts` (or the equivalent organiser
  translation rows). Never hard-code English in templates that render to
  participants.
- Numbers, dates and durations use `Intl.*` formatters with the user's locale
  resolved from `navigator.language`, falling back to the event default.
- Layout must tolerate +35 % string expansion (German, French) without wrapping
  buttons or breaking tables.

---

## 10. Per-area conventions

### 10.1 Single (participant) experience

- Single column, max 560 px.
- The session state pill (`AVAILABLE`, `SEARCHING`, `MATCHED`, …) lives in a
  sticky header at the top of the screen with the live/offline dot.
- Match-found card uses `card--hero` and animates in with a 220 ms fade + 8 px
  rise.
- Buttons describing modes (`Available now`, `Search now`, `Book next call`)
  are large (min height 48 px) and arranged in a vertical stack on mobile,
  horizontal row on ≥ 480 px.

### 10.2 Organiser configuration

- Each configuration concern (Languages, Pools, Tags, Spots, Script,
  Dashboard) lives in its own `card`.
- Selected pool gets `--border-strong` and a left accent bar in
  `--brand-500` (4 px).
- Cron strings, IDs and JSON payloads are rendered in the mono font.

### 10.3 Admin console

- Sidebar is always visible on ≥ 960 px and collapses to a top bar below.
- Tables use the **compact** density.
- Audit log payloads are collapsible — show the first 120 chars then "expand".

---

## 11. Implementation rules for engineers

1. **Do not introduce new colours** in component templates or `.scss` files.
   Add a token in `styles.scss` first, document it here.
2. **Do not use `style="color: …"`** in templates. Use a class (`muted`,
   `error`, `brand`).
3. **Do not import additional CSS frameworks** (no Tailwind, Bootstrap,
   Material). The design system above is sufficient and intentionally small.
4. Each new component must include the three states from §5.7.
5. PRs that add UI must reference the section(s) of this document they
   implement and explain any deviation in the description.
6. The Storybook-equivalent for this project is the live app — pull up
   `/admin/events`, `/event/:slug` and `/play/:sessionId` and verify visual
   parity before merging.

---

## 12. Versioning

This guide is the contract. Breaking visual changes (palette swap, type-scale
change, radius bump) require a MINOR bump of the document version below and a
note in `CHANGELOG.md` under "UI".

**Current version:** `1.0.0` — initial design system.
