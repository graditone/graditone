# Research: Sessions Plugin Tabs Reorder

**Feature**: `073-sessions-tabs-order`  
**Phase**: 0 — Outline & Research  
**Date**: 2026-04-04

## Summary

No open unknowns. The feature is a pure JSX reorder with a known, located source file. All decisions below are confirmations of findings from codebase exploration.

---

## Decision 1: Implementation approach — JSX element reorder only

**Decision**: Reorder the three `<button>` elements inside the `sessions-plugin__tab-bar` `<div>` in `SessionsPlugin.tsx` (currently at lines ~399–427 in the main branch). No CSS, no state, no logic changes needed.

**Rationale**: Tab render order in React is determined by JSX sibling order within the flexbox container. The `activeTab` state and `handleTabChange` handler are tab-id-based (not index-based), so swapping JSX order has zero effect on functionality.

**Alternatives considered**:
- Introduce a `TAB_ORDER` configuration array and render tabs dynamically → rejected (over-engineering for a trivial 3-element reorder; adds indirection with no benefit).

---

## Decision 2: Test strategy — rendering assertion on `sessions-plugin.test.tsx`

**Decision**: Add a single new test to `plugins-external/sessions-plugin/sessions-plugin.test.tsx` that renders `<SessionsPlugin />` and asserts the DOM order of the three tab buttons matches Goals → Calendar → Sessions using `getAllByRole('tab')`.

**Rationale**: `@testing-library/react` with `getAllByRole('tab')` returns elements in DOM order, making it the simplest, most idiomatic assertion for render order. Keeps the test co-located with existing plugin tests.

**Alternatives considered**:
- Snapshot test → fragile (any unrelated JSX change breaks it); rejected.
- E2E / Playwright test → disproportionate overhead for a unit-level assertion; rejected.

---

## Decision 3: Scope boundary — no default tab change

**Decision**: The `useState<TabId>('sessions')` default active tab is left as `'sessions'`. The feature request only changes visual order, not the startup state.

**Rationale**: Spec FR-003 explicitly prohibits changes to behaviour outside of tab order. The default active tab is behavioural state, not display order.

**Alternatives considered**: Change default to `'goals'` (first tab after reorder) → out of scope, not requested.

---

## All NEEDS CLARIFICATION resolved

None were raised. Research complete.
