import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { TimingFeedbackOverlay } from './TimingFeedbackOverlay';

describe('TimingFeedbackOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when never visible', () => {
    const { container } = render(<TimingFeedbackOverlay value="+120 ms" visible={false} />);
    expect(container.querySelector('.practice-plugin__timing-overlay')).toBeNull();
  });

  it('renders the signed ms value when visible', () => {
    const { container } = render(<TimingFeedbackOverlay value="+120 ms" visible={true} />);
    const el = container.querySelector('.practice-plugin__timing-overlay');
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe('+120 ms');
  });

  it('renders a negative value too', () => {
    const { container } = render(<TimingFeedbackOverlay value="-80 ms" visible={true} />);
    const el = container.querySelector('.practice-plugin__timing-overlay-value');
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe('-80 ms');
  });

  it('updates the text when the value changes while visible', () => {
    const { container, rerender } = render(<TimingFeedbackOverlay value="+120 ms" visible={true} />);
    rerender(<TimingFeedbackOverlay value="+1000 ms" visible={true} />);
    const el = container.querySelector('.practice-plugin__timing-overlay-value');
    expect(el!.textContent).toBe('+1000 ms');
  });

  it('fades out and unmounts shortly after visible flips to false', () => {
    const { container, rerender } = render(<TimingFeedbackOverlay value="+120 ms" visible={true} />);
    expect(container.querySelector('.practice-plugin__timing-overlay')).not.toBeNull();

    rerender(<TimingFeedbackOverlay value="+120 ms" visible={false} />);
    // Immediately after hide, the element is still mounted (fading out).
    expect(container.querySelector('.practice-plugin__timing-overlay')).not.toBeNull();

    act(() => { vi.advanceTimersByTime(400); });
    expect(container.querySelector('.practice-plugin__timing-overlay')).toBeNull();
  });
});