import { useCallback, useState, useEffect, useRef } from 'react';
import './VolumeSlider.css';

interface VolumeSliderProps {
  /** Initial volume (0–100). */
  initialValue: number;
  /** Called when the user changes the volume. */
  onChange: (value: number) => void;
}

/**
 * Compact vertical volume slider with speaker icon.
 * The speaker icon is always visible; clicking it toggles a vertical slider popup.
 * Touch-friendly (44×44 px hit area on the icon).
 * Feature 063 — Master Volume (FR-009: vertical to minimise horizontal space).
 */
export function VolumeSlider({ initialValue, onChange }: VolumeSliderProps) {
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setValue(v);
      onChange(v);
    },
    [onChange],
  );

  const icon = value === 0 ? '🔇' : value < 40 ? '🔈' : value < 75 ? '🔉' : '🔊';

  return (
    <div className="volume-slider" ref={containerRef} aria-label="Master volume">
      <button
        className="volume-slider__icon"
        onClick={() => setOpen(o => !o)}
        aria-label={`Volume ${value}%`}
        aria-expanded={open}
        type="button"
      >
        {icon}
      </button>
      {open && (
        <div className="volume-slider__popup">
          <input
            className="volume-slider__range"
            type="range"
            min={0}
            max={100}
            step={1}
            value={value}
            onChange={handleChange}
            aria-label="Master volume"
          />
        </div>
      )}
    </div>
  );
}
