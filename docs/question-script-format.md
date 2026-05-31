# Question Script DSL

Organisers can attach a **question script** to a *singles pool* (the pool of
participants used for matching). The script controls which conversation
prompts are surfaced during a date and in what order. Scripts are uploaded
as a plain text file (or pasted into the textarea) and validated server-side
before they are persisted.

> **Terminology** — "singles pool" is the matching group of singles
> (`Pool` in the data model). A script defines its own **question pools**,
> which are just named collections of conversation prompts. The two are
> distinct concepts and intentionally use different words.

## At a glance

```text
# Comments start with `#` (rest of line ignored).

pool greetings random
  - How are you today?
    sv = Hur mår du idag?
    de = Wie geht es dir heute?
  - Where are you from?
    self = curious            # only ask if THIS single has the "curious" tag

pool deep sequential
  - What's something you're proud of?
    self    = open, brave     # comma-separated, ALL must be present
    partner = open            # partner must have "open"
  - What scares you?

act warmup
  end = 3m                    # OR  end = 4 questions
  use greetings

act main
  end = 6 questions
  use deep
    self    = deep            # act-level filter, AND'd with question's
    partner = deep
```

## Endpoints

| Method | Path                              | Body                  | Notes |
|--------|-----------------------------------|-----------------------|-------|
| `PUT`  | `/pools/:id/script/source`        | `{ "source": "..." }` | DSL upload. Returns parsed structure or `400 QUESTION_SCRIPT_INVALID` with `errors: [{ line, message }]`. |
| `GET`  | `/pools/:id/script`               | —                     | Returns `{ id, poolId, questions, source, parsed }`. `source` and `parsed` are present for DSL uploads. |
| `PUT`  | `/pools/:id/script` *(legacy)*    | `{ questions: [...] }` | Structured-only path, retained for backwards compatibility. Clears `source`. |
| `DELETE` | `/pools/:id/script`             | —                     | Remove the script entirely. |

## Grammar

The DSL is indentation-sensitive (2 spaces per level). Blank lines and
comments are ignored.

### Top-level directives

#### `pool <name> random|sequential`

Declares a **question pool**. `<name>` is a single token (no spaces). Mode:

- `random` — questions are drawn at random, without replacement within the
  same date.
- `sequential` — questions are asked in declaration order.

Children (indent 1):

```text
- <question text in the default language>
```

Children of a question (indent ≥ 2) use `<key> = <value>`:

| Key                 | Meaning                                                                |
|---------------------|------------------------------------------------------------------------|
| `<locale>` (e.g. `sv`) | Translated question text. Locale = 2-letter base + optional region. |
| `self`              | Comma-separated tag names. ALL must be present on the single.          |
| `partner`           | Comma-separated tag names. ALL must be present on the partner.         |

#### `act <name>`

Declares an act of the date. Acts run in declaration order. Children
(indent 1):

| Statement              | Meaning                                                                             |
|------------------------|-------------------------------------------------------------------------------------|
| `end = <N>m\|s\|h`     | Act ends after this duration.                                                       |
| `end = <N> questions`  | Act ends after asking this many questions.                                          |
| `end = <N>`            | Shorthand: question count.                                                          |
| `use <questionpool>`   | Reference a question pool defined earlier. Repeat to draw from multiple pools.      |

Each `use` clause may include additional act-level `self =` / `partner =`
filters (indent 2). These are **AND-combined** with the question's own
requirements.

An act ends on the **first** condition that becomes true. If both
`durationSeconds` and `questionCount` are set, whichever hits first wins.
At least one must be set.

## Runtime semantics

- The script's total duration **never overrides** the singles-pool
  `meetingTimeLimitMinutes`. The selector enforces the pool's cap as a hard
  upper bound — once reached the date ends regardless of remaining acts or
  questions.
- A question is *eligible* iff the combined `self`/`partner` tag
  requirements (per-question AND per-act-source) are satisfied. The
  selector iterates `use` clauses in declaration order and draws from the
  first source that has eligible candidates.
- A question is never asked twice within the same date.
- If an act has no eligible questions for the current pair, the selector
  skips to the next act immediately (no idle wait).

The selector is implemented in [`packages/shared/src/script/selector.ts`](../packages/shared/src/script/selector.ts)
as a pure function. The backend persists the parsed structure together
with the original source text so it can be downloaded, re-validated and
re-rendered without re-parsing.

## Validation errors

A failed `PUT /pools/:id/script/source` returns HTTP `400` with:

```json
{
    "message": "Question script has parse errors",
    "code": "QUESTION_SCRIPT_INVALID",
    "errors": [
        { "line": 4, "message": "Invalid end condition \"banana\". Use e.g. \"5m\", \"30s\", \"1h\", or \"4 questions\"." }
    ]
}
```

`line` is 1-based; `0` is used for cross-reference errors that don't map to
a single line (e.g. an act referencing a missing pool).

## Testing

| Layer    | Files |
|----------|-------|
| Shared   | [`packages/shared/src/script/parser.spec.ts`](../packages/shared/src/script/parser.spec.ts), [`packages/shared/src/script/selector.spec.ts`](../packages/shared/src/script/selector.spec.ts) |
| Backend  | [`apps/backend/src/modules/pools/pools.service.spec.ts`](../apps/backend/src/modules/pools/pools.service.spec.ts) (`uploadScript (DSL)`) |
| Backend e2e | [`apps/backend/test/question-script.e2e-spec.ts`](../apps/backend/test/question-script.e2e-spec.ts) |
| Frontend | [`apps/frontend/src/app/admin/organiser-config.component.spec.ts`](../apps/frontend/src/app/admin/organiser-config.component.spec.ts) (`uploadScript`) |

Run them with:

```sh
pnpm --filter @someone/shared test
pnpm --filter @someone/backend test
pnpm --filter @someone/frontend exec ng test --browsers=ChromeHeadlessNoSandbox --watch=false
```
