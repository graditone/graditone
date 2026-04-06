# Data Model: Sessions Plugin i18n (074)

**Phase 1 output** | Branch: `074-sessions-plugin-i18n` | Date: 2026-04-06

---

## i18n Module Interface

File: `plugins-external/sessions-plugin/i18n.ts`

```typescript
// Supported locales — extend this array to add a new language
export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/** Maps a raw BCP-47 tag (e.g. "es-MX", "en-GB") to a supported locale.
 *  Unknown or empty tags fall back to DEFAULT_LOCALE. */
export function resolveLocale(raw: string | undefined): SupportedLocale;

/** Props for the context provider that wraps the plugin root. */
export interface LocaleProviderProps {
  locale?: SupportedLocale;          // Optional override (used in tests)
  children: React.ReactNode;
}
export function LocaleProvider(props: LocaleProviderProps): JSX.Element;

/** Union of all valid translation keys — derived from en.json at compile time. */
export type TranslationKey = keyof typeof enCatalog;

/** Hook for translating a key with optional `{param}` interpolation. */
export function useTranslation(): {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};
```

**Usage in `index.tsx`**:
```typescript
import { LocaleProvider } from './i18n';
import { SessionsPlugin } from './SessionsPlugin';

const plugin = {
  // ...init...
  Component: () => (
    <LocaleProvider>
      <SessionsPlugin context={context} />
    </LocaleProvider>
  ),
};
```

**Usage in components**:
```typescript
import { useTranslation } from './i18n';

const { t } = useTranslation();
// Simple key
<h2>{t('sessions.toolbar_title')}</h2>
// With interpolation
<span>{t('sessions.task_progress_label', { done: 3, total: 10 })}</span>
// Pluralization (component selects key)
<span>{t(count === 1 ? 'common.task' : 'common.tasks', { count })}</span>
```

---

## Translation Key Schema

`en.json` is the authoritative source of truth. Every key defined here **MUST** have a
corresponding entry in `es.json`. TypeScript enforces this at compile time via
`Record<TranslationKey, string>`.

### Full English Catalog (`locales/en.json`)

```json
{
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.close_aria": "Close",
  "common.back_aria": "Back",
  "common.partial": "Partial",
  "common.complete": "Complete",
  "common.task": "{count} task",
  "common.tasks": "{count} tasks",
  "common.activity": "{count} activity",
  "common.activities": "{count} activities",
  "common.session": "{count} session",
  "common.sessions": "{count} sessions",
  "common.score_not_found": "⚠ Score not found",
  "common.select_score": "Select score…",
  "common.type_label": "Type of goal",
  "common.type_aria": "Type of goal",
  "common.type_play_score": "Play Score",
  "common.type_warmup": "Warm-Up Tasks",

  "sessions.loading": "Loading sessions…",
  "sessions.toolbar_title": "Sessions",
  "sessions.toolbar_title_add_tasks": "Add Tasks",
  "sessions.guide_aria": "Sessions guide",
  "sessions.guide_title": "Open sessions guide",
  "sessions.tab_sessions": "Sessions",
  "sessions.tab_calendar": "Calendar",
  "sessions.tab_goals": "Goals",
  "sessions.confirm_delete_dialog_aria": "Confirm delete",
  "sessions.confirm_delete_text": "Delete this session? Activities (saved practices) will not be deleted, only unlinked from this session.",
  "sessions.new_session_btn": "▶ New Session",
  "sessions.empty_no_sessions": "No sessions yet.",
  "sessions.empty_instructions": "Start a session to group your practice activities together.",
  "sessions.rename_aria": "Rename session",
  "sessions.rename_title": "Tap to rename",
  "sessions.done_icon_title": "All tasks completed",
  "sessions.status_active": "Active",
  "sessions.status_scheduled": "Scheduled",
  "sessions.status_closed": "Closed",
  "sessions.activate_btn": "▶ Activate",
  "sessions.activate_disabled_title": "Only one active session can exist",
  "sessions.activate_title": "Activate session",
  "sessions.close_btn": "■ Close",
  "sessions.close_title": "Close session",
  "sessions.reopen_btn": "▶ Reopen",
  "sessions.reopen_title": "Reopen session",
  "sessions.edit_btn_done": "✓ Done",
  "sessions.edit_btn_default": "✎ Edit",
  "sessions.edit_btn_done_title": "Done editing",
  "sessions.edit_btn_default_title": "Edit session tasks",
  "sessions.delete_aria": "Delete session",
  "sessions.delete_title": "Delete session",
  "sessions.meta_estimated": "⏱ {duration} estimated",
  "sessions.meta_remaining": "⌛ {duration} remaining",
  "sessions.task_progress_label": "{done} of {total} tasks completed",
  "sessions.add_task_btn": "+ Add Task",
  "sessions.no_activities": "No activities recorded yet.",
  "sessions.activity_load_title": "Load this practice",
  "sessions.remove_task_aria": "Remove task {index}",
  "sessions.remove_task_goal_title": "Cannot remove goal-linked task",
  "sessions.remove_task_activity_title": "Cannot remove task with activities",
  "sessions.remove_task_title": "Remove task",

  "goals.creating": "Creating…",
  "goals.create_btn": "+ Create Goal",
  "goals.confirm_delete_aria": "Confirm delete goal",
  "goals.confirm_delete_text": "Delete this goal? Unused tasks and empty sessions will be removed. Tasks with practice history will be kept.",
  "goals.empty": "No goals yet.",
  "goals.empty_instructions": "Tap \"Create Goal\" to get started with guided practice.",
  "goals.collapse_aria": "Collapse goal",
  "goals.expand_aria": "Expand goal",
  "goals.status_done": "✓ Done",
  "goals.status_active": "Active",
  "goals.delete_aria": "Delete goal",
  "goals.no_tasks": "No tasks found.",
  "goals.view_task_aria": "View task in session",
  "goals.warmup_added": "Warm-up added to {actual} of {requested} requested sessions",
  "goals.error_already_exists": "A goal already exists for \"{scoreTitle}\". Complete or delete it first.",
  "goals.error_no_measures": "Score has no measures — cannot create a goal.",
  "goals.error_create_failed": "Failed to create goal",
  "goals.error_warmup_failed": "Failed to create warm-up goal",
  "goals.confirm_sessions": "This will create {count} sessions. {overflow} oldest closed sessions will be removed to stay within the {max}-session limit. Continue?",

  "goal_form.title": "Create Goal",
  "goal_form.score_breakdown_label": "Score breakdown",
  "goal_form.phrases": "Phrases",
  "goal_form.score_label": "Score",
  "goal_form.score_unavailable": "⚠ Score no longer available — please select a different score",
  "goal_form.score_required": "Please select a score to continue",
  "goal_form.goal_exists": "An active goal already exists for this score.",
  "goal_form.dismiss": "Dismiss",
  "goal_form.iterations_label": "Iterations: {count}",
  "goal_form.min_result_label": "Min result: {percent}%",
  "goal_form.tempo_label": "Tempo: {percent}%",
  "goal_form.create_btn": "Create Goal",

  "warmup_form.no_sessions": "No scheduled sessions available for warm-up tasks",
  "warmup_form.only_sessions_singular": "Only {count} session available — warm-up will be added to {count}.",
  "warmup_form.only_sessions_plural": "Only {count} sessions available — warm-up will be added to {count}.",
  "warmup_form.scale_label": "Scale",
  "warmup_form.scale_aria": "Scale",
  "warmup_form.tempo_label": "Tempo: {percent}%",
  "warmup_form.tempo_aria": "Tempo multiplier",
  "warmup_form.iterations_label": "Iterations: {count}",
  "warmup_form.iterations_aria": "Iterations",
  "warmup_form.min_score_label": "Min score: {percent}%",
  "warmup_form.min_score_aria": "Minimum score",
  "warmup_form.sessions_label": "Warm-up sessions: {count}",
  "warmup_form.sessions_aria": "Warm-up sessions",
  "warmup_form.add_btn": "Add Warm-Up Goal",

  "task_row.difficulty_easy": "Easy",
  "task_row.difficulty_medium": "Medium",
  "task_row.difficulty_hard": "Hard",
  "task_row.score_not_found": "⚠ Score not found",
  "task_row.difficulty_aria": "Difficulty: {level}",
  "task_row.retry_title": "Retry practice",
  "task_row.practice_title": "Start practice",
  "task_row.retry_btn": "↻ Retry",
  "task_row.practice_btn": "▶ Practice",
  "task_row.no_practices": "No practices yet",
  "task_row.round_prefix": "Round",

  "task_builder.title_add": "Add Tasks",
  "task_builder.title_new": "New Session",
  "task_builder.subtitle_add": "Add tasks to the existing session",
  "task_builder.subtitle_new": "Define tasks for your practice session",
  "task_builder.reset": "↺ Reset",
  "task_builder.date_label": "Session date",
  "task_builder.duration_label": "Session duration: {minutes} min",
  "task_builder.time_bar": "{busy}m busy · {free}m free",
  "task_builder.over_budget": " ⚠ over budget",
  "task_builder.task_header": "Task {index}",
  "task_builder.region_label": "Region",
  "task_builder.region_whole": "Whole score",
  "task_builder.region_range": "Measure range",
  "task_builder.measures_label": "Measures",
  "task_builder.measure_start_placeholder": "Start",
  "task_builder.measure_end_placeholder": "End",
  "task_builder.iter_placeholder": "Iter",
  "task_builder.hands_label": "Hands",
  "task_builder.hands_both": "Both hands",
  "task_builder.hands_right": "Right hand",
  "task_builder.hands_left": "Left hand",
  "task_builder.tempo_label": "Tempo: {percent}%",
  "task_builder.min_result_label": "Min result: {percent}%",
  "task_builder.duration_task_label": "Duration: {minutes} min",
  "task_builder.add_task_btn": "+ Add Task",
  "task_builder.no_time_title": "Not enough free time in session",
  "task_builder.add_another_title": "Add another task",
  "task_builder.create_session_btn": "Create Session",
  "task_builder.add_tasks_btn": "Add Tasks",
  "task_builder.over_budget_title": "Session is over budget — reduce task durations or increase session duration",
  "task_builder.add_tasks_title": "Add tasks",
  "task_builder.score_not_found": "⚠ Score not found — please select a different score",
  "task_builder.error_no_time": "Not enough free time. {minutes}m {seconds}s remaining of {sessionDurationMins}m session.",
  "task_builder.error_no_tasks": "At least one task is required.",

  "calendar.view_week": "Week",
  "calendar.view_month": "Month",
  "calendar.view_year": "Year",
  "calendar.prev_aria": "Previous",
  "calendar.next_aria": "Next",
  "calendar.period_week": "Week of {month} {day}",
  "calendar.empty": "No practice data available.",
  "calendar.empty_instructions": "Start a session and complete some practice to see your calendar.",
  "calendar.month_empty": "No practice data for this month.",
  "calendar.month_jan": "January",
  "calendar.month_feb": "February",
  "calendar.month_mar": "March",
  "calendar.month_apr": "April",
  "calendar.month_may": "May",
  "calendar.month_jun": "June",
  "calendar.month_jul": "July",
  "calendar.month_aug": "August",
  "calendar.month_sep": "September",
  "calendar.month_oct": "October",
  "calendar.month_nov": "November",
  "calendar.month_dec": "December",
  "calendar.month_short_jan": "Jan",
  "calendar.month_short_feb": "Feb",
  "calendar.month_short_mar": "Mar",
  "calendar.month_short_apr": "Apr",
  "calendar.month_short_may": "May",
  "calendar.month_short_jun": "Jun",
  "calendar.month_short_jul": "Jul",
  "calendar.month_short_aug": "Aug",
  "calendar.month_short_sep": "Sep",
  "calendar.month_short_oct": "Oct",
  "calendar.month_short_nov": "Nov",
  "calendar.month_short_dec": "Dec",
  "calendar.day_mon": "Mon",
  "calendar.day_tue": "Tue",
  "calendar.day_wed": "Wed",
  "calendar.day_thu": "Thu",
  "calendar.day_fri": "Fri",
  "calendar.day_sat": "Sat",
  "calendar.day_sun": "Sun",
  "calendar.day_short_mo": "Mo",
  "calendar.day_short_tu": "Tu",
  "calendar.day_short_we": "We",
  "calendar.day_short_th": "Th",
  "calendar.day_short_fr": "Fr",
  "calendar.day_short_sa": "Sa",
  "calendar.day_short_su": "Su",
  "calendar.scheduled_sessions_aria": "{count} scheduled sessions",
  "calendar.active_sessions_aria": "{count} active sessions",

  "calendar_overlay.activities_aria": "Activities for {date}",
  "calendar_overlay.avg_score": "Avg: {score}%",
  "calendar_overlay.score": "Score: {score}%",
  "calendar_overlay.notes": "{correct}/{total} notes",
  "calendar_overlay.task_prefix": "Task: {name}",
  "calendar_overlay.pass_indicator": " ✓ ≥{minResult}%",
  "calendar_overlay.fail_indicator": " ✗ needs {minResult}%",
  "calendar_overlay.sessions_aria": "{variant} sessions for {date}",
  "calendar_overlay.target_date": "Target date: ",
  "calendar_overlay.open_sessions": "Open in Sessions →",
  "calendar_overlay.variant_scheduled": "Scheduled",
  "calendar_overlay.variant_active": "Active",

  "period_report.aria": "Period report for {label}",
  "period_report.with": "with",
  "period_report.score": "Score",
  "period_report.time_label": "Time ({duration} max)",
  "period_report.empty": "No practice data for this period.",

  "date_picker.choose_date": "Choose date",
  "date_picker.prev_month_aria": "Previous month",
  "date_picker.next_month_aria": "Next month",

  "guide.title": "Sessions Guide",
  "guide.close_aria": "Close guide",
  "guide.section_quick_start": "Quick Start",
  "guide.qs_step1": "Open the <strong>Sessions</strong> plugin from the sidebar.",
  "guide.qs_step2": "Go to the <strong>Goals</strong> tab and tap <strong>+ Create Goal</strong>.",
  "guide.qs_step3": "Pick a score from the catalogue.",
  "guide.qs_step4": "Adjust iterations, target score, and tempo (or keep the defaults).",
  "guide.qs_step5": "Tap <strong>Create</strong> — sessions are generated and scheduled automatically.",
  "guide.qs_step6": "Switch to the <strong>Sessions</strong> tab, activate your first session, and start practising.",
  "guide.section_goals": "Goals",
  "guide.goals_intro": "A <strong>goal</strong> turns a score into a structured practice plan. Select a score and configure:",
  "guide.goals_iterations": "<strong>Iterations</strong> (1–20, default 10) — how many times each phrase is repeated per round.",
  "guide.goals_min_result": "<strong>Min Result</strong> (0–100 %, default 90 %) — practice score needed to mark a task as done.",
  "guide.goals_tempo": "<strong>Tempo</strong> (50–200 %, default 100 %) — speed multiplier applied to the base tempo.",
  "guide.goals_on_create": "On create the engine detects phrases, generates tasks per hand (RH, LH, BH), assigns difficulty, estimates duration, and distributes tasks into sessions.",
  "guide.goals_time_limit": "The total session length is <strong>60 minutes</strong>. Only <strong>50 %</strong> (30 min) is allocated to score practice. If tasks exceed 30 min they are split across multiple sessions.",
  "guide.section_sessions": "Sessions",
  "guide.sessions_scheduled": "<strong>Scheduled</strong> — planned for a future date. Tap ▶ Activate when ready.",
  "guide.sessions_active": "<strong>Active</strong> — open for practice. Only one active session at a time.",
  "guide.sessions_closed": "<strong>Closed</strong> — finalised. Activities are preserved.",
  "guide.sessions_expand": "Expand a session to see its tasks, progress bar, and activity list. Tap a session name to rename it. Maximum 50 sessions per workspace.",
  "guide.section_tasks": "Tasks",
  "guide.tasks_intro": "Each task represents a phrase region, hand, repetitions, and tempo. Title format:",
  "guide.tasks_format": "Score · m. 1–4 · ×10 · LH · 100 % · ≥90 %",
  "guide.tasks_todo": "<strong>○ Todo</strong> — no attempts yet.",
  "guide.tasks_in_progress": "<strong>◐ In Progress</strong> — at least one attempt, not yet passed.",
  "guide.tasks_done": "<strong>✓ Done</strong> — scored ≥ min result.",
  "guide.tasks_failed": "<strong>✗ Failed</strong> — all iterations used. Tap Retry to start a new round.",
  "guide.tasks_practice": "Tap <strong>Practice</strong> to launch with pre-loaded config. A task tag and difficulty badge appear in the practice toolbar.",
  "guide.section_difficulty": "How Difficulty Works",
  "guide.difficulty_intro": "Difficulty is computed per task region and staff by the WASM backend:",
  "guide.difficulty_density": "<strong>Note Density</strong> (60 %) — notes per beat. Mix of average (70 %) and peak (30 %).",
  "guide.difficulty_polyphony": "<strong>Polyphony</strong> (40 %) — simultaneous notes. Mix of average (70 %) and max (30 %).",
  "guide.difficulty_formula": "combined = 0.6 × density + 0.4 × polyphony",
  "guide.difficulty_bh": "For <strong>Both Hands</strong>, note density sums across staves and polyphony combines all intervals, so BH is typically harder than a single hand.",
  "guide.section_duration": "Duration Estimation",
  "guide.duration_formula": "duration = measures × 210 s × difficulty × loops × result",
  "guide.duration_difficulty": "<strong>Difficulty</strong> — Easy 0.6×, Medium 1.0×, Hard 1.5×",
  "guide.duration_loops": "<strong>Loops</strong> — 0.3 + 0.7 × (loopCount / 10)",
  "guide.duration_result": "<strong>Result</strong> — 0.5 + 0.5 × (minResult / 100)",
  "guide.duration_example": "Example: 4 measures, Easy, 10 loops, 90 % target → 4 × 210 × 0.6 × 1.0 × 0.95 ≈ 8 min.",
  "guide.section_calendar": "Calendar",
  "guide.calendar_intro": "View practice history visually: <strong>Month</strong> (6-week grid), <strong>Week</strong> (7-day strip), or <strong>Year</strong> (monthly overview). Tap a day for details. Tap a scheduled session to jump to it.",
  "guide.section_tips": "Tips",
  "guide.tip_easy": "<strong>Start easy</strong> — lower tempo to 50–70 % for hard passages, then create a new goal at full tempo.",
  "guide.tip_retry": "<strong>Use retry</strong> — tap Retry on failed tasks instead of re-creating the goal.",
  "guide.tip_calendar": "<strong>Check the calendar</strong> — the year view shows practice streaks and gaps.",
  "guide.tip_rename": "<strong>Rename sessions</strong> — tap the name to label it \"Nocturne — Slow Practice\".",
  "guide.tip_one_active": "<strong>One active session</strong> — close or complete it before activating the next."
}
```

**Total keys**: 202

---

## Spanish Catalog Structure (`locales/es.json`)

The Spanish catalog has the same 202 keys as `en.json`. Values must be professionally translated Spanish equivalents. The TypeScript type system enforces `Record<TranslationKey, string>` — any missing or extra key is a compile error.

## Pluralization Patterns

Components choose the singular or plural key based on the count value:

```typescript
// Pattern: component selects key, passes count for interpolation
t(count === 1 ? 'common.task' : 'common.tasks', { count })
// → "1 task" / "5 tasks"

t(count === 1 ? 'common.activity' : 'common.activities', { count })
// → "1 activity" / "3 activities"

t(count === 1 ? 'common.session' : 'common.sessions', { count })
// → "1 session" / "2 sessions"
```

## Guide HTML Rendering Pattern

Guide sections with HTML markup use `dangerouslySetInnerHTML`. Catalog values contain only developer-authored inline HTML (`<strong>`, `<code>`) — no user input, no XSS risk:

```tsx
// SessionsGuide.tsx
const { t } = useTranslation();

<li dangerouslySetInnerHTML={{ __html: t('guide.qs_step1') }} />
<li dangerouslySetInnerHTML={{ __html: t('guide.goals_iterations') }} />
<li dangerouslySetInnerHTML={{ __html: t('guide.tasks_todo') }} />
```

## Named Day/Month Arrays

`CalendarView.tsx`, `CalendarWeekView.tsx`, and `CalendarMonthView.tsx` currently use hardcoded `const` arrays for month/day names. These arrays are replaced by catalog lookups at render time:

```typescript
// Before
const MONTH_NAMES = ['January', 'February', ...];

// After — derived from catalog at component render
const MONTH_NAMES = (
  ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'] as const
).map(m => t(`calendar.month_${m}` as TranslationKey));
```

`DatePicker.tsx` follows the same pattern for its `MONTH_NAMES` and `DAY_LABELS` arrays.
