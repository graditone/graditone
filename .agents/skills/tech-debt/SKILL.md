---
name: tech-debt
description: Use whenever you notice a problem in the Graditone codebase that you are NOT going to fix in the current change (pre-existing issues, out-of-scope findings, deliberate trade-offs, review comments you defer, TODOs). Records it as a prioritised row in DEBT.md so it is not lost. Also use when asked to review/triage/prioritise or close tech debt, or when reading DEBT.md. Triggers on: tech debt, DEBT.md, known issue, deferred, out of scope, pre-existing, TODO, FIXME, refactor later, record this, prioritise, backlog, follow-up.
---

# Managing tech debt (DEBT.md)

`DEBT.md` (repo root) is the register of known problems we have **chosen not
to fix yet**. This skill is how to add, prioritise, and close entries so the
list stays useful instead of becoming a graveyard.

Read `DEBT.md` first — it holds the priority scale, the row format, and the
current open items.

## When to record

Record a row when **all** of these hold:

- You **found** a real problem in existing code, **and**
- you are **not fixing it in this change** (out of scope, pre-existing, needs
  design, low value right now, or a deliberate trade-off), **and**
- it is worth someone's attention later.

Negative examples — do **not** record:

- Trivial things you should just fix now (a typo, a one-line theme token).
- Anything already tracked in `DEBT.md` — update/extend that row instead.
- Spec-work items that belong in a plan/`tasks.md`, not debt.
- Questions you should ask the user instead.

When the user explicitly says "add this to the debt / track it", record it
even if you think it is minor.

## Format — one row per item

Append a row to the **Open debt** table in `DEBT.md`:

| ID | Description | Impact | Priority |
|----|-------------|--------|----------|

- **ID** — unique, semantic, kebab-case slug of the problem
  (e.g. `theme-hardcoded-colors`, `score-viewer-inline-colors`). Never reuse
  an ID. Domain-prefix when it helps (`theme-…`, `practice-…`, `a11y-…`).
- **Description** — what it is and **where** (concrete paths/files, and the
  scale/evidence: counts, line refs, a grep). Keep it specific enough to act
  on without re-investigating.
- **Impact** — **why it matters**: user-visible effects, which features/themes
  are at risk, what it blocks, and whether growth is guarded. This is the
  prioritisation input — never leave it vague.
- **Priority** — `P1`/`P2`/`P3` (see below).

### Priority scale

| Priority | Meaning | Rule of thumb |
|----------|---------|---------------|
| **P1** | High — actively causes user-visible bugs or blocks work | fix next |
| **P2** | Medium — real risk / recurring friction, not urgent | schedule, guard growth |
| **P3** | Low — cosmetic or cheap to live with | opportunistic |

`P1` is the **most** urgent. Choose the lowest priority you can honestly
justify; when torn, prefer the more urgent one. Base it on **impact**, not on
how hard the fix is.

## How to add

1. Read `DEBT.md`; if the issue is already there, refine that row instead.
2. Check the ID is unique (`grep` the ID).
3. Add one row to **Open debt**, filled in with the four columns above.
4. If it is a *rule* others could repeat, pair it with a guard (lint rule,
   test, skill) and mention the guard in the row's Impact.

## How to close

When a debt item is fixed: move its row to **Closed debt** with a one-line
resolution (commit/PR, or the guard that now prevents recurrence) and the date
(`YYYY-MM-DD`). Do not delete history; do not reuse the ID.

## Examples

- **Good:** `theme-hardcoded-colors` — what it is (502 literals / 28 files),
  the impact (theme contrast bugs already observed; theme work risky), and the
  guard (`npm run lint:colors` ratchet). See `DEBT.md` for the real row.
- **Bad:** "CSS is messy" — no location, no impact, unactionable.
- **Bad:** a row for something you could have fixed in two lines — just fix it.

## Related

- Theming rules and the colour guard: the **`graditone-theming`** skill and
  `frontend/scripts/check-theme-colors.mjs` (`npm run lint:colors`).
