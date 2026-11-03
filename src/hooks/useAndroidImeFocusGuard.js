import { useEffect, useRef } from 'react';

// Android WebView: IME open/close can cause focus to be lost unexpectedly.
// Keep it minimal and avoid touching pointer/touch events (which can break scrolling).
export default function useAndroidImeFocusGuard(enabled = true) {
  const lastResizeTs = useRef(0);
  const lastFocusTs = useRef(0);
  const lastFocusEl = useRef(null);
  const refocusOnceGuard = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    const ua = String(navigator?.userAgent || '');
    if (!/Android/i.test(ua)) return undefined;

    const vv = window.visualViewport || null;
    const onResize = () => { lastResizeTs.current = Date.now(); };
    const onFocusIn = (e) => {
      lastFocusTs.current = Date.now();
      const target = e?.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        lastFocusEl.current = target;
        refocusOnceGuard.current = 0;
      }
    };

    const onFocusOut = (e) => {
      // If an input loses focus immediately during IME animation, try to restore focus once.
      // This is a last-resort guard for device-specific WebView blur glitches.
      const blurred = e?.target;
      if (!blurred || blurred !== lastFocusEl.current) return;

      // relatedTarget is set synchronously and tells us where focus is moving.
      // If the user tapped another editable element, this is intentional - don't fight it.
      const related = e?.relatedTarget;
      if (related && (related.tagName === 'INPUT' || related.tagName === 'TEXTAREA' || related.isContentEditable)) return;

      const now = Date.now();
      const sinceResize = now - lastResizeTs.current;
      const sinceFocus = now - lastFocusTs.current;
      const withinGlitchWindow = (sinceResize >= 0 && sinceResize <= 1000) || (sinceFocus >= 0 && sinceFocus <= 250);
      if (!withinGlitchWindow) return;
      if (refocusOnceGuard.current >= 1) return;

      // Fallback: check activeElement (may lag behind during focus transition).
      try {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      } catch {
        // ignore
      }

      refocusOnceGuard.current += 1;
      // Defer to next frame so WebView finishes its focus transition.
      requestAnimationFrame(() => {
        try {
          if (!blurred.isConnected) return;
          blurred.focus?.();
        } catch {
          // ignore
        }
      });
    };

    if (vv) vv.addEventListener('resize', onResize);
    window.addEventListener('resize', onResize);
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);

    return () => {
      try { if (vv) vv.removeEventListener('resize', onResize); } catch { /* ignore */ }
      try { window.removeEventListener('resize', onResize); } catch { /* ignore */ }
      try { document.removeEventListener('focusin', onFocusIn, true); } catch { /* ignore */ }
      try { document.removeEventListener('focusout', onFocusOut, true); } catch { /* ignore */ }
    };
  }, [enabled]);
}
