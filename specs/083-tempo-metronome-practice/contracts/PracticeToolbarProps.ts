/**
 * Contract: Updated `PracticeToolbarProps` interface
 * Feature 083 — Tempo Slider Range Extension & Practice Metronome Deferred Start
 *
 * Documents the changes to the PracticeToolbar component props.
 * Source: frontend/plugins/practice-view-plugin/practiceToolbar.tsx
 *
 * Changes from baseline:
 *   - Added: `metronomeArmed: boolean`   (FR-012)
 *   - Unchanged: all other props
 *
 * Consumers:
 *   - frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx
 *
 * Tests:
 *   - frontend/plugins/practice-view-plugin/practiceToolbar.test.tsx
 */

/**
 * Props for PracticeToolbar component (post-feature-083 surface).
 * Only the new/changed props are documented here; unchanged props are omitted.
 */
export interface PracticeToolbarPropsChanges {
  // ─── New prop (FR-012) ──────────────────────────────────────────────────
  /**
   * True when the metronome is armed: toggled ON in practice mode but no
   * note has been played yet. The metronome engine is NOT running while armed.
   *
   * When true:
   *   - Renders `practice-plugin__metro-btn--armed` CSS class on the button
   *   - The button pulses to signal it is waiting for the first note
   *   - Mutually exclusive with `metronomeActive` (armed resets the moment
   *     the engine starts on the first note)
   *
   * Invariants (enforced by PracticeViewPlugin, verifiable in tests):
   *   - `metronomeArmed && metronomeActive` MUST NOT both be true simultaneously
   *   - `metronomeArmed` MUST only be true when practice mode is running
   *     (mode ∈ {waiting, active, holding})
   */
  metronomeArmed: boolean;

  // ─── Changed slider behaviour (not a prop type change — implementation only) ──
  /**
   * Slider min is now dynamic: `computeEffectiveMinMultiplier(bpm)` → [0.1, 1.0]
   * Slider step is now 0.01 (was 0.05)
   * Snap zone is now ±0.03 (was ±0.05)
   * Slider renders a datalist tick at 100% position
   *
   * These changes are implemented inside practiceToolbar.tsx and
   * playbackToolbar.tsx; they do not add new props.
   */
  _sliderChangesNote: never; // documentation-only field; remove in implementation
}

/**
 * CSS classes on the metronome button — possible combinations after feature-083.
 *
 * | Active | Armed | Downbeat | Class list                                                      |
 * |--------|-------|----------|-----------------------------------------------------------------|
 * | false  | false | —        | `practice-plugin__metro-btn`                                    |
 * | false  | true  | —        | `practice-plugin__metro-btn practice-plugin__metro-btn--armed`  |
 * | true   | false | false    | `practice-plugin__metro-btn practice-plugin__metro-btn--active` |
 * | true   | false | true     | `practice-plugin__metro-btn practice-plugin__metro-btn--active practice-plugin__metro-btn--downbeat` |
 * | true   | true  | —        | INVALID — must never occur                                      |
 */
export type MetronomeButtonClassState =
  | 'off'
  | 'armed'
  | 'active'
  | 'active-downbeat';
