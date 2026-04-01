/**
 * TypeScript contracts: Goal Creation Form — Feature 068
 *
 * These interfaces define the boundary between:
 *   - GoalCreationForm (form UI component)
 *   - GoalsView (parent, owns persistence + navigation)
 *   - createGoal() engine function (pure, in goalEngine.ts)
 *
 * These contracts must NOT contain implementation details (no JSX, no React imports).
 * They serve as the source of truth for what the form produces and what each
 * layer accepts. Implementation types are derived from or satisfy these contracts.
 */

import type { ScoreRef } from '../../../plugins-external/sessions-plugin/sessionTypes';

// ---------------------------------------------------------------------------
// Form output contract
// ---------------------------------------------------------------------------

/**
 * The validated, user-authored parameters collected by GoalCreationForm.
 * Produced by the form on submit; consumed by GoalsView to call createGoal().
 *
 * All fields are required — the form must not emit incomplete data.
 */
export interface GoalCreationFormParams {
  /** Reference to the score selected by the user. */
  scoreRef: ScoreRef;

  /** Display title of the selected score at selection time. */
  scoreTitle: string;

  /**
   * How many times each task region is repeated per practice round.
   * Integer. Valid range: [1, 20]. UI constraint: slider with step 1.
   * Maps to: SessionTask.loopCount
   */
  loopCount: number;

  /**
   * Minimum practice score percentage required to mark a task done.
   * Integer. Valid range: [0, 100]. UI constraint: slider with step 5.
   * Maps to: SessionTask.minResult
   */
  minResult: number;

  /**
   * Tempo multiplier applied to the score's base tempo.
   * Decimal. Valid range: [0.5, 2.0] (representing 50%–200%).
   * UI constraint: slider operating in integer percent [50, 200] with step 5;
   * form converts to decimal before emitting (tempoMultiplier = tempoPercent / 100).
   * Maps to: SessionTask.tempoMultiplier
   */
  tempoMultiplier: number;
}

// ---------------------------------------------------------------------------
// Component props contract
// ---------------------------------------------------------------------------

/**
 * Props for the GoalCreationForm component.
 *
 * The component is responsible for:
 *   - Rendering the full creation form (all fields visible at once)
 *   - Managing its own internal state (sliders, score selection, warnings)
 *   - Calling onSubmit with validated GoalCreationFormParams
 *   - Calling onCancel when the user dismisses without submitting
 */
export interface GoalCreationFormProps {
  /**
   * Provides access to score catalogue and ScoreSelector UI component.
   * The form uses context.scorePlayer.getCatalogue() and context.components.ScoreSelector.
   */
  context: {
    scorePlayer: {
      getCatalogue(): Array<{ id: string; displayName: string }>;
      loadScore(ref: { kind: 'catalogue'; catalogueId: string } | { kind: 'userScore'; scoreId: string }): Promise<void>;
      subscribe(cb: (state: { status: string; staffCount?: number; error?: string }) => void): () => void;
      getPhrases(): ReadonlyArray<unknown>;
      getMeasureEndTicks(): ReadonlyArray<number>;
    };
    components: {
      ScoreSelector: React.ComponentType<{
        catalogue: Array<{ id: string; displayName: string }>;
        onSelectScore: (id: string) => void;
        onLoadFile: () => void;
        onCancel: () => void;
        onSelectUserScore?: (id: string) => void;
      }>;
    };
  };

  /**
   * Called when the form is submitted with valid parameters.
   * The parent (GoalsView) is responsible for loading the score, calling
   * createGoal(), persisting, and navigating back to the goals list.
   */
  onSubmit: (params: GoalCreationFormParams) => void;

  /**
   * Called when the user dismisses the form without submitting.
   * The parent should close the form and return to the Goals tab.
   */
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Engine input contract change (additive)
// ---------------------------------------------------------------------------

/**
 * Extended CreateGoalInput — adds optional configuration fields.
 * This is an additive change to the existing interface in goalEngine.ts.
 * All three new fields default to the current hardcoded values when absent,
 * preserving backward compatibility.
 *
 * NOTE: This interface is defined here for documentation purposes.
 * The authoritative definition lives in goalEngine.ts.
 */
export interface CreateGoalInputExtension {
  /**
   * Number of times each task region is repeated.
   * Optional. Default: 10.
   * Must be a positive integer in [1, 20] when provided — validated by form UI (slider).
   */
  loopCount?: number;

  /**
   * Tempo multiplier for task practice speed.
   * Optional. Default: 1.0.
   * Must be in [0.5, 2.0] when provided — validated by form UI (slider).
   */
  tempoMultiplier?: number;

  /**
   * Minimum practice score % to mark task done.
   * Optional. Default: 90.
   * Must be in [0, 100] when provided — validated by form UI (slider).
   */
  minResult?: number;
}

// ---------------------------------------------------------------------------
// Validation rules (shared between form and tests)
// ---------------------------------------------------------------------------

export const GOAL_CREATION_FORM_CONSTRAINTS = {
  loopCount: { min: 1, max: 20, step: 1, defaultValue: 10 },
  minResult:  { min: 0, max: 100, step: 5, defaultValue: 90 },
  tempoPercent: { min: 50, max: 200, step: 5, defaultValue: 100 },
} as const;

/** Convert tempoPercent (50–200) to tempoMultiplier (0.5–2.0) */
export function percentToMultiplier(percent: number): number {
  return percent / 100;
}

/** Convert tempoMultiplier (0.5–2.0) to display percent (50–200) */
export function multiplierToPercent(multiplier: number): number {
  return Math.round(multiplier * 100);
}
