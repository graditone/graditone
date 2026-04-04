# Implementation Plan: Sessions Plugin Tabs Reorder

**Branch**: `073-sessions-tabs-order` | **Worktree**: `../worktrees/073-sessions-tabs-order` | **Date**: 2026-04-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/073-sessions-tabs-order/spec.md`

## Summary

Reorder the Sessions plugin tab bar from the current order (Sessions, Calendar, Goals) to the new order (Goals, Calendar, Sessions). The change is a pure JSX element reorder in `plugins-external/sessions-plugin/SessionsPlugin.tsx` with no logic, data model, or API changes required. A new test asserting the rendered tab order will be added before the change (Test-First, Principle V).

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: React 19.2.0, Vitest, @testing-library/react  
**Storage**: N/A  
**Testing**: Vitest + @testing-library/react (`plugins-external/sessions-plugin/sessions-plugin.test.tsx`)  
**Target Platform**: Tablet devices (iPad/Surface/Android) — PWA, Chrome 57+, Safari 11+  
**Project Type**: Web application (frontend plugin)  
**Performance Goals**: N/A (pure visual reorder, no performance impact)  
**Constraints**: Touch targets minimum 44×44px (already met by existing CSS); no functional behaviour changes  
**Scale/Scope**: Single component, single file (`SessionsPlugin.tsx` ~400 lines)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | Tab ordering is UI presentation, not domain logic |
| II. Hexagonal Architecture | ✅ PASS | No ports/adapters affected; purely a renderer detail |
| III. PWA Architecture | ✅ PASS | No PWA/WASM concerns; offline behaviour unchanged |
| IV. Precision & Fidelity | ✅ PASS | No timing or music data involved |
| V. Test-First Development | ✅ MUST COMPLY | Add failing tab-order test before reordering JSX |
| VI. Layout Engine Authority | ✅ PASS | No spatial calculations; tab bar uses CSS flexbox only |
| VII. Regression Prevention | ✅ PASS | New test permanently guards the desired order |

**Gate result**: All principles satisfied. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/073-sessions-tabs-order/
├── plan.md              # This file
├── research.md          # Phase 0 output
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (`graditone-pro-plugins` repo)

> The Sessions plugin lives in a **separate git repository** (`graditone-pro-plugins`),
> cloned at `plugins-external/` inside the graditone root and gitignored there.
> The `sessions-plugin/` subdirectory within that repo contains the plugin source.
> All source edits for this feature are made directly in that clone.

```text
# graditone-pro-plugins repo root (cloned at plugins-external/)
plugins-external/
├── sessions-plugin/
│   ├── SessionsPlugin.tsx       # Tab bar JSX — only file changed
│   └── SessionsPlugin.test.tsx  # New component test file — tab-order test added here
└── virtual-keyboard-pro/
    └── ...
```

**Structure Decision**: Monorepo plugin package. No backend, no new files outside the plugin directory, no new directories.
