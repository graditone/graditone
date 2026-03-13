# Tasks: Plugin Manager Dialog

**Feature Branch**: `048-plugin-manager-dialog`  
**Input**: `specs/048-plugin-manager-dialog/spec.md`  
**Tech Stack**: React 19, TypeScript, Vite, plain CSS (`--ls-*` design tokens), IndexedDB via `idb`  
**Tests**: Not requested — no test tasks generated

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete-task dependencies)
- **[US1/US2/US3]**: Which user story this task belongs to
- Exact file paths included in every description

---

## Phase 1: Setup

**Purpose**: Identify all touch-points in the existing codebase that this feature must replace

- [X] T001 Audit `frontend/src/App.tsx` lines ~70–80 and ~390–650 — map all `showImporter`/`showRemover` state declarations, `handleImportComplete`/`handleRemoveComplete` handlers, both old dialog render blocks (`<PluginImporterDialog>` / `<PluginRemoverDialog>`), and the +/− `<button>` elements in `.plugin-manage-btns`; record exact line numbers for replacement tasks

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the `PluginManagerDialog` shell that all user stories extend. MUST be complete before Phase 3 or 4 can proceed.

- [X] T002 Create `frontend/src/components/plugins/PluginManagerDialog.css` — BEM single-panel layout classes: `.plugin-manager-dialog` (overlay backdrop, z-index 1000), `.plugin-manager-dialog__card` (card container matching `--ls-bg`/`--ls-heading` token pattern), `.plugin-manager-dialog__header`, `.plugin-manager-dialog__body` (scrollable, `overflow-y: auto`, max-height bounded to viewport), `.plugin-manager-dialog__footer`, `.plugin-manager-dialog__item` (flex row, space-between), `.plugin-manager-dialog__remove-btn` (danger style), `.plugin-manager-dialog__empty` (muted empty-state text), `.plugin-manager-dialog__error` (error alert style)
- [X] T003 Create `frontend/src/components/plugins/PluginManagerDialog.tsx` — overlay `<div>` backdrop + inner card shell; props: `onClose(): void`; renders header with dialog title ("Manage Plugins") and a close (×) button; empty scrollable body area; footer action slot (placeholder); wires Escape keydown listener and backdrop-click to call `onClose`; imports `PluginManagerDialog.css`

**Checkpoint**: Shell component renders and dismisses correctly — Phase 3 and Phase 4 can now proceed

---

## Phase 3: User Story 1 — Unified Plugin Manager Dialog (Priority: P1) 🎯 MVP

**Goal**: Replace the disjointed +/− buttons with a single "Plugins" button; open a dialog showing all user-imported plugins with per-row remove actions.

**Independent Test**: Launch the app with one or more previously imported plugins; click the "Plugins" button (right edge of the plugin nav bar); verify the Plugin Manager dialog opens showing each plugin name with a "Remove" button; activate remove for one plugin; verify the tab disappears from the header and the row is gone from the list; verify pressing Escape closes the dialog. The old +/− buttons must not be present.

- [X] T004 [US1] Add `importedPlugins: PluginManifest[]` and `onRemoveComplete: (id: string) => void` props to `PluginManagerDialog` in `frontend/src/components/plugins/PluginManagerDialog.tsx`; render each manifest as a `.plugin-manager-dialog__item` row showing `manifest.name` and a "Remove" button; render `.plugin-manager-dialog__empty` message when array is empty
- [X] T005 [US1] Implement remove handler in `frontend/src/components/plugins/PluginManagerDialog.tsx` — on "Remove" click, call `pluginRegistry.remove(id)` (import `PluginRegistry` singleton); on success call `onRemoveComplete(id)`; on failure show inline `.plugin-manager-dialog__error` message in the row without closing the dialog; track `removing: string | null` state to disable the button during the async operation
- [X] T006 [US1] Update `frontend/src/App.tsx` — replace `const [showImporter, setShowImporter] = useState(false)` and `const [showRemover, setShowRemover] = useState(false)` with single `const [showPluginManager, setShowPluginManager] = useState(false)`; update `handleImportComplete` to call `setPluginsVersion(v => v + 1)` (dialog remains open — no `setShowPluginManager(false)` here); update `handleRemoveComplete` to call `setPluginsVersion(v => v + 1)` if removed plugin was active (`activePlugin === removedId`) also call `setActivePlugin(null)` (dialog remains open)
- [X] T007 [US1] In `frontend/src/App.tsx`, replace the `.plugin-manage-btns` div containing the two +/− `<button>` elements with a single `<button>` element: `aria-label="Manage Plugins"`, `title="Manage Plugins"`, `className="plugin-manage-btn"`, `onClick={() => setShowPluginManager(true)}`; label text "Plugins"
- [X] T008 [US1] In `frontend/src/App.tsx`, replace the two conditional render blocks (`{showImporter && <PluginImporterDialog ...>}` and `{showRemover && <PluginRemoverDialog ...>}`) with a single block: `{showPluginManager && <PluginManagerDialog importedPlugins={allPlugins.map(e => e.manifest).filter(m => m.origin === 'imported' && !m.hidden)} onRemoveComplete={handleRemoveComplete} onClose={() => setShowPluginManager(false)} />`; remove the import statements for `PluginImporterDialog` and `PluginRemoverDialog`; add import for `PluginManagerDialog`
- [X] T009 [P] [US1] Delete `frontend/src/components/plugins/PluginRemoverDialog.tsx` (fully superseded by `PluginManagerDialog` remove flow)

**Checkpoint**: US1 fully functional and independently testable — single Plugins button opens dialog, installed plugins listed, remove works, header updates

---

## Phase 4: User Story 2 — Import Plugin From Dialog (Priority: P2)

**Goal**: Add "Import Plugin" action inside the Plugin Manager dialog so users can import a plugin ZIP without leaving the dialog; after import the new plugin appears in the list.

**Independent Test**: Open the Plugins dialog with no installed plugins; the empty state is shown with an "Import Plugin" button in the footer; click it; select a valid plugin ZIP; verify the new plugin appears in the list and a new header tab is created; verify the dialog is still open; click "Import Plugin" again and select an invalid file; verify an error message appears inline without closing the dialog.

- [X] T010 [US2] Add hidden `<input type="file" accept=".zip">` with a `ref` to `frontend/src/components/plugins/PluginManagerDialog.tsx`; add an "Import Plugin" `<button>` in the footer slot that calls `fileInputRef.current?.click()` on click; add `onImportComplete: (manifest: PluginManifest) => void` to props
- [X] T011 [US2] Implement import state machine in `frontend/src/components/plugins/PluginManagerDialog.tsx` — internal state `importPhase: 'idle' | 'loading' | 'error' | 'duplicate'` and `importError: string | null` and `pendingFile: File | null`; on file input `onChange` call `importPlugin(file, pluginRegistry)` (import from `PluginImporter.ts`); on `{ success: true }` call `onImportComplete(manifest)` and reset import state (dialog stays open, new plugin appears via updated `importedPlugins` prop flowing from App.tsx); on `{ success: false }` set `importPhase: 'error'` and show `importError` in `.plugin-manager-dialog__error` in the footer; on `{ duplicate: true }` set `importPhase: 'duplicate'` to trigger T012 sub-flow
- [X] T012 [US2] Implement duplicate-overwrite inline prompt in `frontend/src/components/plugins/PluginManagerDialog.tsx` — when `importPhase === 'duplicate'`, show inline message in footer ("A plugin with this ID already exists. Replace it?") with "Yes, Replace" and "Cancel" buttons; on confirm call `importPlugin` with replace/overwrite option and handle result as per T011; on cancel reset `importPhase` to `'idle'` and clear the file input value
- [X] T013 [P] [US2] Delete `frontend/src/components/plugins/PluginImporterDialog.tsx` (fully superseded by `PluginManagerDialog` import flow)

**Checkpoint**: US2 fully functional — single Plugins dialog handles both viewing/removing (US1) and importing (US2); both old dialog files deleted; no regressions

---

## Phase 5: User Story 3 — Plugin Dialog API for Third-Party Plugins (Priority: P3)

**Goal**: Expose the list dialog pattern as a Plugin API capability so third-party plugins can open a styled list dialog with label + optional icon + one configurable action per item.

**Independent Test**: Implement a minimal test plugin that calls `context.openListDialog(...)` with two items (label, icon, actionLabel "Open"); verify the dialog renders with the correct visual style (same backdrop, font, spacing as Plugin Manager dialog); verify clicking the action calls the provided callback; verify the API version is 8; verify existing plugins (e.g., play-score, practice-view-plugin) still load and run correctly.

- [X] T014 [US3] Add type definitions to `frontend/src/plugin-api/types.ts`: `ListDialogItem { id: string; label: string; icon?: string; actionLabel: string }` and `OpenListDialogOptions { title: string; items: ReadonlyArray<ListDialogItem>; onAction: (id: string) => void; onClose: () => void }`
- [X] T015 [US3] Add `openListDialog(options: OpenListDialogOptions): () => void` method to the `PluginContext` interface in `frontend/src/plugin-api/types.ts`; the return value is a close function callable by the plugin to programmatically dismiss the dialog
- [X] T016 [US3] Export `ListDialogItem` and `OpenListDialogOptions` from `frontend/src/plugin-api/index.ts`; bump `PLUGIN_API_VERSION` constant from 7 to 8
- [X] T017 [US3] Extract reusable `ListDialog` presentational component into `frontend/src/components/plugins/ListDialog.tsx` — props: `title: string`, `items: ReadonlyArray<ListDialogItem>`, `onAction: (id: string) => void`, `onClose: () => void`, `footer?: React.ReactNode` (slot for import action); renders same overlay + card structure as `PluginManagerDialog` but purely data-driven; no import logic inside
- [X] T018 [P] [US3] Create `frontend/src/components/plugins/ListDialog.css` — extract the layout classes from `PluginManagerDialog.css` into shared rules here (`.list-dialog`, `.list-dialog__header`, `.list-dialog__body`, `.list-dialog__item`, `.list-dialog__action-btn`, `.list-dialog__empty`, `.list-dialog__footer`, `.list-dialog__error`); update `PluginManagerDialog.css` to import/compose from `ListDialog.css`
- [X] T019 [US3] Refactor `frontend/src/components/plugins/PluginManagerDialog.tsx` to be composed using `<ListDialog>` — replace the hand-rolled layout with `<ListDialog title="Manage Plugins" items={...} onAction={handleRemove} onClose={onClose} footer={<ImportFooter .../>}>` so `PluginManagerDialog` becomes a thin wrapper with plugin-specific logic on top of the reusable primitive
- [X] T020 [US3] Implement `openListDialog()` in the PluginContext factory inside `frontend/src/components/PluginView.tsx` — add `listDialogOptions: OpenListDialogOptions | null` state; `openListDialog` sets state (mounting `<ListDialog>`) and returns a close function that resets state to `null`; render `{listDialogOptions && <ListDialog ...listDialogOptions />}` conditionally within the plugin view subtree

**Checkpoint**: US3 fully functional — any plugin can call `context.openListDialog(...)` and get a styled list dialog; Plugin API v8 exported; no regressions in existing plugins

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T021 [P] Clean up `frontend/src/components/plugins/plugin-dialog.css` — remove all rules that were only used by the now-deleted `PluginImporterDialog` and `PluginRemoverDialog`; retain only rules still referenced by other components (if none remain, delete the file and remove its import)
- [X] T022 Accessibility pass on `frontend/src/components/plugins/PluginManagerDialog.tsx` and `frontend/src/App.tsx` — verify: "Plugins" button has `aria-label="Manage Plugins"`; dialog overlay has `role="dialog"` and `aria-modal="true"` and `aria-label`; each remove button in the list has a unique `aria-label` (e.g., `aria-label="Remove [plugin name]"`); "Import Plugin" button has descriptive label; file input has an associated visible label or `aria-label`; fix any violations found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS Phase 3 and Phase 4**
- **Phase 3 (US1)**: Depends on Phase 2 — no dependency on Phase 4 or 5
- **Phase 4 (US2)**: Depends on Phase 2 — no dependency on Phase 5; integrates incrementally with Phase 3
- **Phase 5 (US3)**: Depends on Phase 3 and Phase 4 being complete (needs the built dialog to extract)
- **Polish (Final)**: Depends on all desired phases being complete

### User Story Dependencies

- **US1 (P1)**: Standalone after Phase 2 — independently testable MVP
- **US2 (P2)**: Standalone after Phase 2 — integrates with US1's dialog shell but independently testable
- **US3 (P3)**: Depends on US1+US2 being complete — extracts and generalises what was built

### Within Each Phase

- **Phase 3**: T004 (add props + list) → T005 (remove handler) → T006 (App.tsx state) → T007 (button) → T008 (render + cleanup); T009 (delete file) is parallel after T008
- **Phase 4**: T010 (add input + button) → T011 (import state machine) → T012 (duplicate flow); T013 (delete file) is parallel after T011
- **Phase 5**: T014 → T015 → T016 (types must exist before export/API); T017 (component) → T018 (CSS — parallel) → T019 (refactor PluginManagerDialog using ListDialog) → T020 (wire into PluginView)

### Parallel Opportunities

- T002 and T003 (Phase 2) — different files, can be written in parallel
- T009 (delete PluginRemoverDialog) — parallel after T008
- T013 (delete PluginImporterDialog) — parallel after T011
- T018 (ListDialog.css) — parallel with T017 (ListDialog.tsx)

---

## Parallel Example: User Story 1

```
Start:     T004 (add props + list) ─────────────────────────────────────── T009 [P] (delete PluginRemoverDialog.tsx)
                │
                ▼
           T005 (remove handler)
                │
                ├──── T006 (App.tsx state merge)
                │          │
                │          ▼
                │     T007 (replace buttons)
                │          │
                │          ▼
                │     T008 (replace render blocks + clean imports)
                │          │
                │          └──────────────────────────────────────────────► T009 [P]
                └─────────────────────────────────────────────────────────► (continue to Phase 4)
```

## Parallel Example: User Story 3

```
T014 (types) ──► T015 (interface) ──► T016 (export + version bump)
                                             │
                      ┌──────────────────────┘
                      ▼
                 T017 (ListDialog.tsx)   T018 [P] (ListDialog.css)
                      │                      │
                      └──────────┬───────────┘
                                 ▼
                            T019 (refactor PluginManagerDialog)
                                 │
                                 ▼
                            T020 (wire into PluginView)
```

---

## Implementation Strategy

**MVP (Phases 1–3)**: Deliver User Story 1 alone — the single "Plugins" button and unified dialog with list + remove. No import capability yet. This is a complete, demonstrable UX improvement that eliminates the two-button clutter.

**Full P1+P2 (Phases 1–4)**: Add import inside the dialog. The two old dialog files are deleted. The feature is complete for end users.

**Full (Phases 1–5)**: Extract the dialog into a Plugin API capability. Unlocks ecosystem reuse.

**Suggested immediate MVP**: Phases 1–3 only (Tasks T001–T009).
