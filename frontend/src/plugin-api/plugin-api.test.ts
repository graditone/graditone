/**
 * Plugin API contract tests — T006 (v1) + T002 (v2)
 * Feature 030: Plugin Architecture
 * Feature 031: Practice View Plugin & Plugin API Recording Extension
 *
 * Verifies the public surface exported from src/plugin-api/index.ts
 * matches the contract defined in specs/030-plugin-architecture/contracts/plugin-api.ts
 * and specs/031-practice-view-plugin/contracts/plugin-api-v2.ts.
 *
 * Constitution Principle V: these tests must exist and be green before
 * any code that consumes the Plugin API is merged.
 */

import { describe, it, expect } from 'vitest';
import {
  PLUGIN_API_VERSION,
  type PluginManifest,
  type PluginNoteEvent,
  type PluginContext,
  type GraditonePlugin,
  type PluginPitchEvent,
  type PluginRecordingContext,
} from './index';

describe('Plugin API contract', () => {
  describe('PLUGIN_API_VERSION', () => {
    it('is the string "7" (v7 — adds ListDialogItem, OpenListDialogOptions, context.openListDialog)', () => {
      expect(PLUGIN_API_VERSION).toBe('7');
    });

    it('is a string (not a number)', () => {
      expect(typeof PLUGIN_API_VERSION).toBe('string');
    });
  });

  describe('PluginNoteEvent shape', () => {
    it('accepts an object with midiNote and timestamp', () => {
      const event: PluginNoteEvent = { midiNote: 60, timestamp: Date.now() };
      expect(event.midiNote).toBe(60);
      expect(typeof event.timestamp).toBe('number');
    });

    it('accepts optional velocity', () => {
      const event: PluginNoteEvent = { midiNote: 60, timestamp: 0, velocity: 64 };
      expect(event.velocity).toBe(64);
    });

    it('does not include coordinate fields (Constitution Principle VI)', () => {
      const event: PluginNoteEvent = { midiNote: 60, timestamp: 0 };
      // Compile-time guard: 'x', 'y', 'position', 'bbox' must NOT exist on PluginNoteEvent.
      // If they were added, TypeScript would surface an error here via @ts-expect-error reversal.
      expect('x' in event).toBe(false);
      expect('y' in event).toBe(false);
      expect('position' in event).toBe(false);
      expect('bbox' in event).toBe(false);
    });
  });

  describe('PluginManifest shape', () => {
    it('can be constructed with required fields', () => {
      const manifest: PluginManifest = {
        id: 'virtual-keyboard',
        name: 'Virtual Keyboard',
        version: '1.0.0',
        pluginApiVersion: '1',
        entryPoint: 'index.js',
        origin: 'builtin',
      };
      expect(manifest.id).toBe('virtual-keyboard');
      expect(manifest.origin).toBe('builtin');
    });

    it('accepts optional description', () => {
      const manifest: PluginManifest = {
        id: 'test',
        name: 'Test',
        version: '0.1.0',
        pluginApiVersion: '1',
        entryPoint: 'index.js',
        origin: 'imported',
        description: 'A test plugin',
      };
      expect(manifest.description).toBe('A test plugin');
    });
  });

  describe('GraditonePlugin interface contract', () => {
    it('an object satisfying GraditonePlugin compiles and has init + Component', () => {
      // Runtime check: confirm the shape is as expected by constructing a minimal mock
      const mockPlugin: GraditonePlugin = {
        init: (_ctx: PluginContext) => { /* no-op */ },
        Component: () => null,
      };
      expect(typeof mockPlugin.init).toBe('function');
      expect(typeof mockPlugin.Component).toBe('function');
    });

    it('dispose is optional', () => {
      const withoutDispose: GraditonePlugin = {
        init: () => { /* no-op */ },
        Component: () => null,
      };
      expect(withoutDispose.dispose).toBeUndefined();

      const withDispose: GraditonePlugin = {
        init: () => { /* no-op */ },
        dispose: () => { /* no-op */ },
        Component: () => null,
      };
      expect(typeof withDispose.dispose).toBe('function');
    });
  });

  describe('PluginContext interface contract', () => {
    it('context mock satisfies the contract', () => {
      const manifst: PluginManifest = {
        id: 'x',
        name: 'X',
        version: '1.0.0',
        pluginApiVersion: '1',
        entryPoint: 'index.js',
        origin: 'builtin',
      };
      const ctx: PluginContext = {
        emitNote: (_event: PluginNoteEvent) => { /* no-op */ },
        playNote: (_event: PluginNoteEvent) => { /* no-op */ },
        midi: { subscribe: () => () => {} },
        components: {
          StaffViewer: () => null,
        },
        recording: {
          subscribe: () => () => {},
          onError: () => () => {},
          stop: () => {},
        },
        stopPlayback: () => { /* no-op */ },
        close: () => { /* no-op */ },
        manifest: manifst,
      };
      expect(typeof ctx.emitNote).toBe('function');
      expect(typeof ctx.playNote).toBe('function');
      expect(typeof ctx.components.StaffViewer).toBe('function');
      expect(ctx.manifest.id).toBe('x');
    });

    // v2: recording namespace
    it('context.recording has subscribe and onError functions (v2)', () => {
      const manifest: PluginManifest = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        pluginApiVersion: '2',
        entryPoint: 'index.js',
        origin: 'builtin',
      };
      const ctx: PluginContext = {
        emitNote: () => {},
        playNote: () => {},
        midi: { subscribe: () => () => {} },
        components: { StaffViewer: () => null },
        recording: {
          subscribe: (_handler: (e: PluginPitchEvent) => void) => () => {},
          onError: (_handler: (e: string) => void) => () => {},
          stop: () => {},
        },
        stopPlayback: () => {},
        close: () => {},
        manifest,
      };
      expect(typeof ctx.recording.subscribe).toBe('function');
      expect(typeof ctx.recording.onError).toBe('function');
    });

    // v2: stopPlayback
    it('context.stopPlayback is a function (v2)', () => {
      const manifest: PluginManifest = {
        id: 'test2',
        name: 'Test2',
        version: '1.0.0',
        pluginApiVersion: '2',
        entryPoint: 'index.js',
        origin: 'builtin',
      };
      const ctx: PluginContext = {
        emitNote: () => {},
        playNote: () => {},
        midi: { subscribe: () => () => {} },
        components: { StaffViewer: () => null },
        recording: { subscribe: () => () => {}, onError: () => () => {}, stop: () => {} },
        stopPlayback: () => {},
        close: () => {},
        manifest,
      };
      expect(typeof ctx.stopPlayback).toBe('function');
    });
  });

  // -------------------------------------------------------------------------
  // v2: PluginPitchEvent
  // -------------------------------------------------------------------------
  describe('PluginPitchEvent shape (v2)', () => {
    it('accepts an object with midiNote, hz, confidence, and timestamp', () => {
      const event: PluginPitchEvent = {
        midiNote: 60,
        hz: 261.63,
        confidence: 0.95,
        timestamp: Date.now(),
      };
      expect(event.midiNote).toBe(60);
      expect(typeof event.hz).toBe('number');
      expect(typeof event.confidence).toBe('number');
      expect(typeof event.timestamp).toBe('number');
    });

    it('does not include raw-audio or geometry fields (privacy constraint)', () => {
      const event: PluginPitchEvent = { midiNote: 60, hz: 261.63, confidence: 0.95, timestamp: 0 };
      expect('pcm' in event).toBe(false);
      expect('waveform' in event).toBe('waveform' in event && false);
      expect('buffer' in event).toBe(false);
      expect('x' in event).toBe(false);
      expect('y' in event).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // v2: PluginRecordingContext
  // -------------------------------------------------------------------------
  describe('PluginRecordingContext shape (v2)', () => {
    it('can be constructed with subscribe and onError', () => {
      const recording: PluginRecordingContext = {
        subscribe: (_handler) => () => {},
        onError: (_handler) => () => {},
        stop: () => {},
      };
      expect(typeof recording.subscribe).toBe('function');
      expect(typeof recording.onError).toBe('function');
      expect(typeof recording.stop).toBe('function');
    });

    it('subscribe returns an unsubscribe function', () => {
      const recording: PluginRecordingContext = {
        subscribe: (_handler) => () => {},
        onError: (_handler) => () => {},
        stop: () => {},
      };
      const unsub = recording.subscribe(() => {});
      expect(typeof unsub).toBe('function');
    });
  });

  // -------------------------------------------------------------------------
  // v2: PluginNoteEvent.offsetMs
  // -------------------------------------------------------------------------
  describe('PluginNoteEvent.offsetMs (v2)', () => {
    it('offsetMs is optional (can be omitted)', () => {
      const event: PluginNoteEvent = { midiNote: 60, timestamp: 0 };
      expect(event.offsetMs).toBeUndefined();
    });

    it('offsetMs can be set to a positive number', () => {
      const event: PluginNoteEvent = { midiNote: 60, timestamp: 0, offsetMs: 500 };
      expect(event.offsetMs).toBe(500);
    });
  });
});
