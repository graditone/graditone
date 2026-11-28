/**
 * Injected page chrome — the things Playwright records but does not draw.
 *
 * Playwright's `recordVideo` captures the viewport and nothing else: there is no
 * pointer and no callouts. So we add our own, inside the page, before any app
 * script runs:
 *
 *   - a pointer that follows the real (invisible) mouse Playwright moves,
 *   - a ripple wherever it clicks, so a tap reads even at a glance.
 *
 * Because it lives in the page, it is part of the recorded video for free.
 * Captions are deliberately NOT drawn here — they become DemoClip text
 * annotations so the author can adjust them in DemoClip (see democlip.ts).
 *
 * The function is serialised and run in the browser, so it uses DOM globals and
 * takes nothing from this module's scope.
 */

export function installDemoChrome(): void {
  const whenReady = (fn: () => void): void => {
    if (document.documentElement) fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  };

  whenReady(() => {
    const style = document.createElement('style');
    style.textContent = `
      #demo-cursor {
        position: fixed; left: 0; top: 0; width: 30px; height: 30px;
        z-index: 2147483647; pointer-events: none; will-change: transform;
      }
      #demo-cursor svg { display: block; width: 100%; height: 100%;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,.45)); }

      #demo-ripple {
        position: fixed; z-index: 2147483646; width: 14px; height: 14px;
        margin: -7px 0 0 -7px; border-radius: 50%;
        background: rgba(99,102,241,.5); pointer-events: none;
        animation: demo-ripple .55s cubic-bezier(.2,.6,.3,1) forwards;
      }
      @keyframes demo-ripple {
        from { transform: scale(1); opacity: .75; }
        to   { transform: scale(10); opacity: 0; }
      }
    `;
    document.documentElement.appendChild(style);

    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.style.transform = 'translate(-100px, -100px)';
    cursor.innerHTML =
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M4 2l14 8-6 1.5L9 20 4 2z" fill="#ffffff" stroke="#111111" ' +
      'stroke-width="1.2" stroke-linejoin="round"/></svg>';

    document.documentElement.appendChild(cursor);

    const move = (x: number, y: number): void => {
      cursor.style.transform = `translate(${x}px, ${y}px)`;
    };

    document.addEventListener('mousemove', (e) => move(e.clientX, e.clientY), true);

    document.addEventListener(
      'mousedown',
      (e) => {
        const ripple = document.createElement('div');
        ripple.id = 'demo-ripple';
        ripple.style.left = `${e.clientX}px`;
        ripple.style.top = `${e.clientY}px`;
        document.documentElement.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
      },
      true,
    );

    window.__demoMoveCursor = move;
  });
}
