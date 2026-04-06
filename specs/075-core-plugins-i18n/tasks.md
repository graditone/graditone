# Tasks: Complete i18n for Internal Core Plugins

**Feature**: `075-core-plugins-i18n`
**Input**: Design documents from `specs/075-core-plugins-i18n/`
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md) | **Data Model**: [data-model.md](data-model.md)

---

## Phase 1: Setup

**Purpose**: No project initialization needed — worktree, dependencies, and i18n infrastructure already exist.

*No tasks — all setup is complete from feature 073 (i18n infrastructure) and existing worktree.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Locale key parity test and missing plugin nav name keys. MUST complete before user story phases.

**⚠️ CRITICAL**: The parity test (T001) must be written first (it will fail until all keys are added). The nav name keys (T002) are a prerequisite for US2 acceptance.

- [X] T001 Add locale key parity test to `frontend/src/i18n/locales.test.ts` (new file) that asserts en.json and es.json have identical key sets
- [X] T002 [US2] Add `plugin.name.sessions-plugin` ("Sessions" / "Sesiones") and `plugin.name.virtual-keyboard` ("Virtual Keyboard" / "Teclado Virtual") to `frontend/src/i18n/locales/en.json` and `frontend/src/i18n/locales/es.json`

**Checkpoint**: T001 (parity test) is now failing as expected. T002 gives US2 its two translation keys.

---

## Phase 3: User Story 1 — play-score i18n (Priority: P1) 🎯 MVP

**Goal**: All user-facing text in the play-score plugin (toolbar, score selection screen, loading state) rendered via `useTranslation()` in both English and Spanish.

**Independent Test**: Set browser language to Spanish, open the play-score plugin — all toolbar labels (Play, Pause, Stop, Tempo, Back, metronome controls), score selection headings (PRELOADED SCORES, MY SCORES, Load from file), and the loading state appear in Spanish with no English text visible.

### Implementation for User Story 1

- [X] T003 [P] [US1] Add `play_score.*` English keys (~22 keys covering: `play_score.loading`, `play_score.toolbar.play`, `play_score.toolbar.pause`, `play_score.toolbar.stop`, `play_score.toolbar.back_aria`, `play_score.toolbar.tempo`, `play_score.toolbar.elapsed_aria`, `play_score.toolbar.playback_controls_aria`, `play_score.toolbar.metronome_toggle_aria`, `play_score.toolbar.metronome_sub_aria`, `play_score.toolbar.loading_score_aria`, `play_score.selection.preloaded`, `play_score.selection.my_scores`, `play_score.selection.load_file`) to `frontend/src/i18n/locales/en.json`
- [X] T004 [P] [US1] Add `play_score.*` Spanish translations for all keys from T003 to `frontend/src/i18n/locales/es.json`
- [X] T005 [P] [US1] Migrate `frontend/plugins/play-score/playbackToolbar.tsx` — import `useTranslation` from `../../src/i18n`, destructure `t`, replace all hardcoded toolbar labels and aria-labels with `t()` calls
- [X] T006 [P] [US1] Migrate `frontend/plugins/play-score/scoreSelectionScreen.tsx` — import `useTranslation`, replace "PRELOADED SCORES", "MY SCORES", "📁 Load from file…" headings and button text with `t()` calls
- [X] T007 [P] [US1] Migrate `frontend/plugins/play-score/PlayScorePlugin.tsx` — import `useTranslation`, replace "Loading…" text and "Loading score" aria-label with `t()` calls

**Checkpoint**: play-score plugin is fully translated. Switch browser to Spanish and verify: toolbar shows "▶ Reproducir", "⏸ Pausar", "■ Detener"; score selection shows translated headings.

---

## Phase 4: User Story 1 — train-view i18n (Priority: P1)

**Goal**: All user-facing text in the train-view plugin rendered via `useTranslation()` — toolbar, config panel, level selector, tips, scale names shown in components, result overlay, and virtual keyboard aria labels.

**Independent Test**: Set browser language to Spanish, open the train-view plugin — level selector shows "Bajo/Medio/Alto/Personalizado", config sections show "Modo/Partitura/Notas/Clave/Octavas/Tempo/Ejercicio", results show "Notas/Correcto/Desafinado/Incorrecto", tips and action buttons in Spanish.

### Implementation for User Story 1 (train-view)

- [X] T008 [P] [US1] Add `train.*` English keys (~80 keys) to `frontend/src/i18n/locales/en.json` — covering: `train.toolbar.back`, `train.toolbar.title`, `train.level.label`, `train.level.low`, `train.level.mid`, `train.level.high`, `train.level.custom`, `train.level.complexity_aria`, `train.mode.label`, `train.mode.flow`, `train.mode.step`, `train.score.label`, `train.score.scale_aria`, `train.score.change_aria`, `train.notes.label`, `train.notes.count_aria`, `train.notes.set_by_scale`, `train.clef.label`, `train.clef.set_by_score`, `train.clef.set_by_scale`, `train.octaves.label`, `train.octaves.range_aria`, `train.tempo.label`, `train.tempo.bpm`, `train.tempo.bpm_aria`, `train.exercise.label`, `train.exercise.mute_aria`, `train.exercise.unmute_aria`, `train.exercise.mute_title`, `train.exercise.unmute_title`, `train.exercise.your_response`, `train.input.midi_keyboard`, `train.input.mic`, `train.input.mic_error`, `train.input.suspended`, `train.input.midi_detected_tip`, `train.input.mic_listening_tip`, `train.action.start_aria`, `train.action.stop_aria`, `train.action.metronome_aria`, `train.action.metronome_stop_title`, `train.action.metronome_start_title`, `train.action.metronome_sub_aria`, `train.action.vkeyboard_hide_aria`, `train.action.vkeyboard_show_aria`, `train.action.config_open_aria`, `train.action.config_collapse_aria`, `train.action.config_open_title`, `train.action.config_collapse_title`, `train.session_task`, `train.tip.dismiss_aria`, `train.tip.use_midi`, `train.tip.mic_placement`, `train.tip.quiet_space`, `train.tip.external_mic`, `train.save.failed`, `train.results.notes`, `train.results.correct`, `train.results.off_beat`, `train.results.wrong`, `train.results.details`, `train.results.target`, `train.results.detected`, `train.results.status`, `train.results.pitch_delta`, `train.results.timing_delta`, `train.results.status_correct`, `train.results.status_wrong_pitch`, `train.results.status_wrong_timing`, `train.results.status_missed`, `train.results.extraneous`, `train.results.timing_chart`, `train.results.grade_perfect`, `train.results.grade_excellent`, `train.results.grade_good`, `train.results.grade_keep_going`, `train.results.grade_keep_practicing`, `train.results.retry_hint`, `train.results.overlay_aria`, `train.results.close_aria`, `train.results.retry_aria`, `train.results.new_aria`, `train.results.replay_aria`, `train.results.stop_replay_aria`, `train.results.save_aria`, `train.results.saved_aria`, `train.results.session_aria`, `train.scales.c_major` through `train.scales.d_minor` (~15 scale name keys), `train.vkeyboard.aria`, `train.vkeyboard.scroll_left_aria`, `train.vkeyboard.scroll_right_aria`
- [X] T009 [P] [US1] Add `train.*` Spanish translations for all keys from T008 to `frontend/src/i18n/locales/es.json`
- [X] T010 [US1] Migrate `frontend/plugins/train-view/TrainPlugin.tsx` — import `useTranslation`, replace all hardcoded toolbar/config/level/tips/input-status strings with `t()` calls; move scale display-name rendering from `exerciseGenerator.ts` data to component level (map scale id → `t('train.scales.{id}')`)
- [X] T011 [P] [US1] Migrate `frontend/plugins/train-view/TrainResultsOverlay.tsx` — import `useTranslation`, replace all stat labels, grade messages, button labels, and aria-labels with `t()` calls
- [X] T012 [P] [US1] Migrate `frontend/plugins/train-view/TrainVirtualKeyboard.tsx` — import `useTranslation`, replace virtual piano aria-labels and scroll button aria-labels with `t()` calls

**Checkpoint**: train-view plugin is fully translated. Switch to Spanish — level selector, config panel, results overlay, and virtual keyboard all show Spanish text. Existing train-view logic tests continue to pass.

---

## Phase 5: User Story 1 — practice-view-plugin i18n (Priority: P1)

**Goal**: All user-facing text in the practice-view plugin rendered via `useTranslation()` — toolbar, results overlay, feedback strings, and error messages.

**Independent Test**: Set browser language to Spanish, open the practice-view plugin — practice toolbar shows "Ambas manos/Mano derecha/Mano izquierda", difficulty labels, results overlay shows "Notas/Correcto/Desafinado/Incorrecto", all error/empty states in Spanish.

### Implementation for User Story 1 (practice-view-plugin)

- [X] T013 [P] [US1] Add `practice.*` English keys (~55 keys) to `frontend/src/i18n/locales/en.json` — covering: `practice.toolbar.practice_btn`, `practice.toolbar.stop_btn`, `practice.toolbar.back_aria`, `practice.toolbar.controls_aria`, `practice.toolbar.pause_aria`, `practice.toolbar.play_aria`, `practice.toolbar.stop_aria`, `practice.toolbar.hand_aria`, `practice.toolbar.both_hands`, `practice.toolbar.right_hand`, `practice.toolbar.left_hand`, `practice.toolbar.tempo`, `practice.toolbar.tempo_aria`, `practice.toolbar.metronome_aria`, `practice.toolbar.metronome_sub_aria`, `practice.toolbar.elapsed_aria`, `practice.toolbar.replaying`, `practice.toolbar.session_task`, `practice.toolbar.select_staff_prompt`, `practice.toolbar.no_midi_device`, `practice.toolbar.connect_midi`, `practice.toolbar.practice_mode_start_aria`, `practice.toolbar.practice_mode_stop_aria`, `practice.toolbar.midi_connected_title`, `practice.toolbar.midi_connected_aria`, `practice.plugin.untitled`, `practice.plugin.storage_full`, `practice.plugin.save_failed`, `practice.plugin.expected`, `practice.plugin.playing`, `practice.results.overlay_aria`, `practice.results.close_aria`, `practice.results.notes`, `practice.results.correct`, `practice.results.off_beat`, `practice.results.wrong`, `practice.results.your_time`, `practice.results.score_time`, `practice.results.expected`, `practice.results.played`, `practice.results.status`, `practice.results.wrong_tries`, `practice.results.timing_delta`, `practice.results.grade_perfect`, `practice.results.grade_excellent`, `practice.results.grade_good`, `practice.results.grade_keep_going`, `practice.results.grade_keep_practicing`, `practice.results.repractice_aria`, `practice.results.replay_aria`, `practice.results.stop_replay_aria`, `practice.results.save_aria`, `practice.results.saved_aria`, `practice.results.session_aria`, `practice.results.loop_count_aria`, `practice.results.loops_aria`, `practice.results.retry_hint`, `practice.results.no_notes`, `practice.results.stopped_at`
- [X] T014 [P] [US1] Add `practice.*` Spanish translations for all keys from T013 to `frontend/src/i18n/locales/es.json`
- [X] T015 [US1] Migrate `frontend/plugins/practice-view-plugin/practiceToolbar.tsx` — import `useTranslation`, replace all toolbar button labels, hand selection options, status messages, and aria-labels with `t()` calls
- [X] T016 [P] [US1] Migrate `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` — import `useTranslation`, replace "Untitled" fallback, storage/save error messages, "Expected:" / "Playing:" feedback labels with `t()` calls
- [X] T017 [P] [US1] Migrate `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx` — import `useTranslation`, replace all stat labels, grade messages, time labels, table headers, button labels, error state messages, and aria-labels with `t()` calls

**Checkpoint**: practice-view plugin is fully translated. Switch to Spanish — toolbar, results overlay, and all error states show Spanish text. Existing practice-view tests continue to pass.

---

## Phase 6: User Story 1 — virtual-keyboard i18n + guide audit (Priority: P1)

**Goal**: Virtual-keyboard plugin translated; guide plugin confirmed 100% covered.

**Independent Test**: Set browser language to Spanish, open the virtual-keyboard plugin — title, "Staff" label, and "Clear" button appear in Spanish. Open the guide plugin — all text is in Spanish with no English strings remaining.

### Implementation for User Story 1 (virtual-keyboard + guide)

- [X] T018 [P] [US1] Add `vkeyboard.*` English keys (5 keys: `vkeyboard.title`, `vkeyboard.staff`, `vkeyboard.clear`, `vkeyboard.clear_aria`) to `frontend/src/i18n/locales/en.json` AND the matching Spanish translations to `frontend/src/i18n/locales/es.json`
- [X] T019 [P] [US1] Migrate `frontend/plugins/virtual-keyboard/VirtualKeyboard.tsx` — import `useTranslation` from `../../src/i18n`, replace "Virtual Keyboard" title, "Staff" label, "Clear" button text, and "Clear staff" aria-label with `t()` calls
- [X] T020 [P] [US1] Audit `frontend/plugins/guide/GuidePlugin.tsx` for any remaining hardcoded strings — add any missing keys to locale files and replace with `t()` calls

**Checkpoint**: All five builtin plugins are fully translated. US1 and US2 acceptance criteria met. Run T001's parity test — it should now pass.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Verify regression-free English experience, confirm key parity, and update documentation.

- [X] T021 [US3] Run the full frontend Vitest test suite (`cd frontend && npx vitest run`) and confirm all existing tests pass — zero regressions from i18n migration
- [X] T022 [US4] Verify `frontend/src/i18n/locales.test.ts` key parity test passes — confirms en.json and es.json have identical key counts and sets
- [X] T023 Update `FEATURES.md` to record that all builtin core plugins (play-score, train-view, practice-view, virtual-keyboard, guide) now support English and Spanish localization

---

## Dependencies

```
T001 (parity test) ──────────────────────────────────── runs red until T003-T020 done
T002 (US2 nav keys) ─────────────────────────────────── independent, can run anytime
T003 (play_score en.json) ──┬── T005 (playbackToolbar)
T004 (play_score es.json) ──┘   T006 (scoreSelectionScreen)   ← parallel
                                T007 (PlayScorePlugin)
T008 (train en.json) ──────┬── T010 (TrainPlugin)
T009 (train es.json) ──────┘   T011 (TrainResultsOverlay)     ← parallel
                                T012 (TrainVirtualKeyboard)
T013 (practice en.json) ───┬── T015 (practiceToolbar)
T014 (practice es.json) ───┘   T016 (PracticeViewPlugin)      ← parallel
                                T017 (ResultsOverlay)
T018 (vkeyboard keys) ─────┬── T019 (VirtualKeyboard)
                            └── T020 (GuidePlugin audit)       ← parallel
T001 ← T003..T020 ─────────── T022 (parity passes)
T021, T022, T023 ────────────── Final phase (after all above)
```

## Parallel Execution Examples

**play-score sprint (~3 parallel streams after T003+T004):**
```
Stream A: T003 → T005
Stream B: T004 → T006
Stream C:       T007
```

**train-view sprint (~3 parallel streams after T008+T009):**
```
Stream A: T008 → T010
Stream B: T009 → T011
Stream C:       T012
```

**practice sprint (~3 parallel streams after T013+T014):**
```
Stream A: T013 → T015
Stream B: T014 → T016
Stream C:       T017
```

## Implementation Strategy

**MVP (User Story 2 + US1/virtual-keyboard)**: T002 + T018 + T019 — smallest possible deliverable; adds two missing nav names and translates the simplest plugin. Demonstrable in ~1 hour.

**Full P1 delivery**: Complete Phases 2–6 (T001–T020). All five plugins translated in English and Spanish.

**Recommended sequencing**: Phase 2 → Phase 3 (play-score, simplest baseline) → Phase 6 (virtual-keyboard, quick win) → Phase 4 (train-view, largest) → Phase 5 (practice-view) → Final Phase.
