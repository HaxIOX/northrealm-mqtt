import React, { useEffect, useRef } from 'react';
import { X, Trash2 } from 'lucide-react';
import useKeyboardInsetPx from '../hooks/useKeyboardInsetPx.js';

// KISS: Mobile bottom sheet for managing subscriptions + topic filter.
// - Prevents backdrop-tap misfires (pointer events)
// - Locks body scroll while open to reduce focus/keyboard glitches in WebView
export default function SubscriptionSheet({
  open,
  onClose,
  isNative,
  t,
  theme,
  connected,
  subTopic,
  setSubTopic,
  onSubscribe,
  subscriptions,
  logTopicFilters,
  toggleLogTopicFilter,
  clearLogTopicFilters,
  onUnsubscribe,
}) {
  // Native Android WebView handles IME via windowSoftInputMode; avoid extra VisualViewport rerenders that can cause blur.
  const keyboardInsetPx = useKeyboardInsetPx(!!open && !isNative);
  const lastResizeTs = useRef(0);

  // Mobile/Android: programmatic close (backdrop tap) during soft keyboard animation
  // can steal focus and collapse the keyboard. We gate backdrop-close with:
  // - recent viewport resize (keyboard open/close)
  // - soft keyboard visible (best-effort via VisualViewport inset)
  // - focused text input (heuristic)
  const isTextInputFocused = () => {
    try {
      if (typeof document === 'undefined') return false;
      const el = document.activeElement;
      if (!el) return false;
      const tag = String(el.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
      return !!el.isContentEditable;
    } catch {
      return false;
    }
  };

  // Track viewport resizes (keyboard open/close) to prevent spurious backdrop close.
  // On Android WebView with adjustResize, the viewport change can cause phantom
  // pointer events on the backdrop during keyboard animation.
  useEffect(() => {
    if (!open) return;
    const onResize = () => { lastResizeTs.current = Date.now(); };
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (vv) vv.addEventListener('resize', onResize);
    window.addEventListener('resize', onResize);
    return () => {
      if (vv) vv.removeEventListener('resize', onResize);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (isNative) return; // Native WebView handles layout/resize; don't fight it (reduces focus glitches).
    try {
      const prev = document?.body?.style?.overflow;
      if (document?.body?.style) document.body.style.overflow = 'hidden';
      return () => {
        try { if (document?.body?.style) document.body.style.overflow = prev || ''; } catch { /* ignore */ }
      };
    } catch {
      return undefined;
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-end justify-center"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        // If keyboard is visible or a text input is focused, avoid backdrop close to prevent blur.
        if (keyboardInsetPx > 0 || isTextInputFocused()) return;
        // Resize events can lag behind keyboard animation; keep this window slightly conservative.
        if (Date.now() - lastResizeTs.current <= 800) return;
        onClose?.();
      }}
      role="presentation"
    >
      <div
        className={`w-full max-w-md ${t.bgSecondary} border ${t.border} rounded-t-3xl p-4 pb-[calc(1rem+var(--nr-safe-bottom))] max-h-[85vh] max-h-[85dvh] overflow-y-auto custom-scrollbar`}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="订阅主题"
        style={keyboardInsetPx > 0 ? { marginBottom: `${keyboardInsetPx}px` } : undefined}
      >
        <div className="flex items-center justify-between gap-3">
          <div className={`text-sm font-bold ${t.text}`}>订阅主题</div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className={`p-2 rounded-xl border ${t.border} ${t.bgTertiary} ${t.bgHover} ${t.textSecondary}`}
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            placeholder="Topic (e.g. #)"
            value={subTopic}
            onChange={(e) => setSubTopic?.(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubscribe?.()}
            onFocus={() => { lastResizeTs.current = Date.now(); }}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className={`flex-1 ${t.bgInput} border ${t.border} rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none transition-all ${t.text}`}
          />
          <button
            type="button"
            onClick={() => onSubscribe?.()}
            disabled={!connected}
            className={`${theme === 'light' ? 'bg-emerald-100 hover:bg-emerald-600 text-emerald-600 hover:text-white' : 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white'} px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 transition-all`}
            title={connected ? '订阅' : '请先连接服务器'}
          >
            订阅
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className={`text-[11px] ${t.textMuted}`}>
            当前订阅：{(subscriptions || []).length} 个
          </div>
          {(logTopicFilters || []).length > 0 && (
            <button
              type="button"
              onClick={() => clearLogTopicFilters?.()}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border ${t.border} ${t.bgTertiary} ${t.bgHover} ${t.textSecondary}`}
              title="清除 Topic 筛选"
            >
              清除筛选({(logTopicFilters || []).length})
            </button>
          )}
        </div>

        <div className="mt-2 max-h-[50vh] max-h-[50dvh] overflow-y-auto custom-scrollbar space-y-2">
          {(subscriptions || []).length === 0 ? (
            <div className={`text-xs ${t.textMuted} text-center py-6 border border-dashed ${t.border} rounded-xl`}>
              暂无订阅主题
            </div>
          ) : (
            (subscriptions || []).map((sub) => {
              const active = (logTopicFilters || []).includes(sub);
              return (
                <div
                  key={sub}
                  className={`flex items-center gap-2 ${t.card} border rounded-xl px-3 py-2 transition-colors ${
                    active ? 'border-indigo-500/60 ring-1 ring-indigo-500/20' : ''
                  }`}
                  title="点击只看该 Topic（不影响实际订阅）"
                >
                  <button
                    type="button"
                    onClick={() => toggleLogTopicFilter?.(sub)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                      active
                        ? (theme === 'light' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200')
                        : `${t.bgTertiary} ${t.border} ${t.textSecondary} ${t.bgHover}`
                    }`}
                  >
                    {active ? '只看中' : '只看'}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs ${t.textSecondary} font-mono truncate`} title={sub}>{sub}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUnsubscribe?.(sub)}
                    className={`${t.textMuted} hover:text-rose-500 p-1.5 rounded-lg ${t.bgHover} transition-colors`}
                    title="取消订阅"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className={`mt-3 text-[11px] ${t.textMuted}`}>
          提示：点击某个 Topic 可筛选“只看该 Topic”，不会影响实际订阅。
        </div>
      </div>
    </div>
  );
}
