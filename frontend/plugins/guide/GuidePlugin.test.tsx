/**
 * GuidePlugin.test.tsx — Feature 001-docs-plugin
 *
 * Tests written BEFORE implementation (TDD — Constitution Principle V).
 * Tests covering US1, US2, and US3 contract requirements.
 *
 * Run: npm run test -- plugins/guide
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GuidePlugin } from './GuidePlugin';
import guidePlugin from './index';
import manifest from './plugin.json';

// ─── US1: First-Time User Orientation ───────────────────────────────────────

describe('GuidePlugin — component (US1)', () => {
  it('renders without crashing', () => {
    render(<GuidePlugin />);
  });

  it('displays the "What is Graditone?" heading (FR-005)', () => {
    render(<GuidePlugin />);
    expect(screen.getByRole('heading', { name: /what is graditone\?/i })).toBeInTheDocument();
  });

  it('exports a valid GraditonePlugin object', () => {
    expect(typeof guidePlugin.init).toBe('function');
    expect(typeof guidePlugin.Component).toBe('function');
  });

  it('init stores context without throwing', () => {
    expect(() => guidePlugin.init({} as never)).not.toThrow();
  });
});

// ─── US1 + US2: Manifest contract ───────────────────────────────────────────

describe('GuidePlugin — manifest', () => {
  it('declares type: common to appear in the nav bar (FR-001)', () => {
    expect(manifest.type).toBe('common');
  });

  it('declares order: 99 for rightmost nav bar placement (FR-002)', () => {
    expect(manifest.order).toBe(99);
  });

  it('declares icon 📖 (FR-002)', () => {
    expect(manifest.icon).toBe('📖');
  });

  it('declares name Guide (FR-002)', () => {
    expect(manifest.name).toBe('Guide');
  });

  // US3: back-navigation contract (T014)
  it('declares view: window so host renders the back button (R-002)', () => {
    expect(manifest.view).toBe('window');
  });

  it('declares pluginApiVersion: "1" to activate the v1/v2 back-button path (R-002)', () => {
    expect(manifest.pluginApiVersion).toBe('1');
  });
});

// ─── US2: Feature Discovery by Section ──────────────────────────────────────

describe('GuidePlugin — sections (US2)', () => {
  it('renders exactly five <section> elements (FR-004)', () => {
    const { container } = render(<GuidePlugin />);
    expect(container.querySelectorAll('section')).toHaveLength(5);
  });

  it('displays heading "Playing a Score" (FR-006)', () => {
    render(<GuidePlugin />);
    expect(screen.getByRole('heading', { name: /playing a score/i })).toBeInTheDocument();
  });

  it('displays heading "Practice Mode" (FR-007)', () => {
    render(<GuidePlugin />);
    expect(screen.getByRole('heading', { name: /practice mode/i })).toBeInTheDocument();
  });

  it('displays heading "Train" (FR-008)', () => {
    render(<GuidePlugin />);
    expect(screen.getByRole('heading', { name: /^train$/i })).toBeInTheDocument();
  });

  it('displays heading "Loading a Score" (FR-009)', () => {
    render(<GuidePlugin />);
    expect(screen.getByRole('heading', { name: /loading a score/i })).toBeInTheDocument();
  });
});
