/**
 * TimingFeedbackOverlay (096-timing-feedback-overlay)
 *
 * Transient badget showing the signed timing deviation (±ms) after an
 * out-of-time note during live practice. The parent toggles `visible`;
 * this component fades in on (re-）mount and fades out shortly after
 * `visible` flips to false, then unmounts. State changes are scheduled via
 * timers (never synchronously in an effect body) to satisfy
 * react-hooks/set-state-in-effect. See
 * specs/096-timing-feedback-overlay/contracts/timing-feedback-contract.md.
 */

import { useEffect, useState } from 'react';

type DisplayPhase = 'shown' | 'exiting' | 'hidden';

/** Fade-out duration in ms (must match the CSS transition ~180ms + margin). */
const FADE_OUT_MS = 400;

export function TimingFeedbackOverlay({ value, visible }: { value: string; visible: boolean }) {
  const [display, setDisplay] = useState<DisplayPhase>(visible ? 'shown' : 'hidden');

  useEffect(() => {
    if (visible) {
      // Re-appear on the next tick so the fade-in animation restarts reliably.

      const t = setTimeout(() => setDisplay('shown'), 0);
      return () => clearTimeout(t);
    }

    if (display === 'hidden') return;

    // Fade out, then unmount once the exit transition completes.

    const t = setTimeout(() => setDisplay('hidden'), FADE_OUT_MS);
    return () => clearTimeout(t);
  }, [visible, display]);

  if (display === 'hidden') return null;

  const exiting = !visible && display === 'shown';

  return (
    <div
      className={`practice-plugin__timing-overlay${exiting ? ' practice-plugin__timing-overlay--exiting' : ' practice-plugin__timing-overlay--shown'}`}
      style={{ pointerEvents: 'none' }}
      aria-live="polite"
    >
      <span className="practice-plugin__timing-overlay-value">{value}</span>
    </div>
  );
}