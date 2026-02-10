import { useEffect, useState } from 'react';

// Mobile keyboard inset helper (best-effort).
// On Android WebView/Chrome, VisualViewport usually exists and reports the reduced viewport height.
export default function useKeyboardInsetPx(enabled = true) {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!enabled) { setInset(0); return undefined; }
    if (typeof window === 'undefined') return undefined;

    const vv = window.visualViewport;
    if (!vv) { setInset(0); return undefined; }

    const update = () => {
      try {
        // innerHeight ~= layout viewport; vv.height ~= visual viewport.
        const raw = window.innerHeight - vv.height - (vv.offsetTop || 0);
        const next = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
        setInset(next);
      } catch {
        setInset(0);
      }
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);

    return () => {
      try { vv.removeEventListener('resize', update); } catch { /* ignore */ }
      try { vv.removeEventListener('scroll', update); } catch { /* ignore */ }
      try { window.removeEventListener('orientationchange', update); } catch { /* ignore */ }
    };
  }, [enabled]);

  return inset;
}

