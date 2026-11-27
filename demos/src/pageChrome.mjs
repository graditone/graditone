/**
 * Injected page chrome — the things Playwright records but does not draw.
 *
 * Playwright's `recordVideo` captures the viewport and nothing else: there is no
 * pointer and no callouts. So we add our own, inside the page, before any app
 * script runs:
 *
 *   - a pointer that follows the real (invisible) mouse Playwright moves,
 *   - a ripple wherever it clicks, so a tap reads even at a glance,
 *   - a caption bar the runner writes into, per step.
 *
 * Because it lives in the page, it is part of the recorded video for free — no
 * ffmpeg overlay needed for captions.
 */

export function installDemoChrome() {
  const whenReady = (fn) => {
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

      #demo-caption {
        position: fixed; left: 50%; bottom: 36px; transform: translateX(-50%);
        z-index: 2147483645; max-width: 78%; padding: 13px 22px;
        border-radius: 14px; background: rgba(17,17,20,.84); color: #fff;
        font: 500 21px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
        text-align: center; opacity: 0; transition: opacity .25s ease;
        pointer-events: none; box-shadow: 0 10px 34px rgba(0,0,0,.38);
        -webkit-font-smoothing: antialiased;
      }
      #demo-caption.visible { opacity: 1; }
    `;
    document.documentElement.appendChild(style);

    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.style.transform = 'translate(-100px, -100px)';
    cursor.innerHTML =
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M4 2l14 8-6 1.5L9 20 4 2z" fill="#ffffff" stroke="#111111" ' +
      'stroke-width="1.2" stroke-linejoin="round"/></svg>';

    const caption = document.createElement('div');
    caption.id = 'demo-caption';

    document.documentElement.appendChild(cursor);
    document.documentElement.appendChild(caption);

    const move = (x, y) => {
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

    window.__demoCaption = (text) => {
      caption.textContent = text || '';
      caption.classList.toggle('visible', Boolean(text));
    };
    window.__demoMoveCursor = move;
  });
}
