/**
 * webMidiMock — Playwright-compatible Web MIDI API stubs
 * Feature 076: E2E Test Coverage Review
 *
 * These functions return serialisable JS strings for use with
 * `page.addInitScript()`. They run in the browser context, so they
 * cannot use Node/Vitest imports. See frontend/src/test/mockMidi.ts
 * for the Vitest-only equivalent.
 */

/**
 * Returns an `addInitScript`-compatible JS string that replaces
 * `navigator.requestMIDIAccess` with a stub that resolves with no
 * connected devices.
 *
 * Usage:
 * ```ts
 * await page.addInitScript(buildNoMidiScript());
 * await page.goto('/');
 * ```
 */
export function buildNoMidiScript(): string {
  return `
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      value: function() {
        return Promise.resolve({
          inputs: new Map(),
          outputs: new Map(),
          sysexEnabled: false,
          onstatechange: null,
          addEventListener: function() {},
          removeEventListener: function() {},
        });
      },
      writable: true,
      configurable: true,
    });
  `;
}

/**
 * Returns an `addInitScript`-compatible JS string that replaces
 * `navigator.requestMIDIAccess` with a stub that resolves with one
 * connected input device.
 *
 * @param deviceName - Display name for the fake MIDI input device.
 *
 * Usage:
 * ```ts
 * await page.addInitScript(buildMidiConnectedScript('My Piano'));
 * await page.goto('/');
 * ```
 */
export function buildMidiConnectedScript(deviceName = 'Test MIDI Device'): string {
  // The device name is embedded as a JSON string to safely handle quotes.
  const safeDeviceName = JSON.stringify(deviceName);
  return `
    (function() {
      var deviceName = ${safeDeviceName};
      var fakeInput = {
        id: 'fake-input-0',
        manufacturer: '',
        name: deviceName,
        type: 'input',
        version: '1.0',
        state: 'connected',
        connection: 'open',
        onstatechange: null,
        onmidimessage: null,
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return true; },
      };
      var inputs = new Map([['fake-input-0', fakeInput]]);
      Object.defineProperty(navigator, 'requestMIDIAccess', {
        value: function() {
          return Promise.resolve({
            inputs: inputs,
            outputs: new Map(),
            sysexEnabled: false,
            onstatechange: null,
            addEventListener: function() {},
            removeEventListener: function() {},
          });
        },
        writable: true,
        configurable: true,
      });
    })();
  `;
}
