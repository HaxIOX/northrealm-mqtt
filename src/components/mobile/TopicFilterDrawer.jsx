import React, { useEffect, useRef } from 'react';
import { Check, ListFilter, Moon, Sun, X } from 'lucide-react';
import { useAppData } from '../../contexts/AppDataContext.jsx';
import { useMqtt } from '../../contexts/MqttContext.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import ConnectionStatusBar from '../ConnectionStatusBar.jsx';

const SWIPE_CLOSE_DISTANCE = 56;

export default function TopicFilterDrawer({ open, onClose }) {
  const { subscriptions } = useAppData();
  const { logTopicFilters, toggleLogTopicFilter, clearLogTopicFilters } = useMqtt();
  const { theme, t, toggleTheme } = useTheme();
  const closeButtonRef = useRef(null);
  const gestureRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus();
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      previousFocus?.focus?.();
    };
  }, [onClose, open]);

  if (!open) return null;

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    gestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event) => {
    const start = gestureRef.current;
    gestureRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (deltaX <= -SWIPE_CLOSE_DISTANCE && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      onClose();
    }
  };

  const topics = Array.isArray(subscriptions) ? subscriptions : [];

  return (
    <div
      className="fixed inset-0 z-[72] lg:hidden"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { gestureRef.current = null; }}
    >
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 bg-slate-950/55"
        onClick={onClose}
        aria-label="关闭主题筛选"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="topic-filter-title"
        className={`absolute inset-y-0 left-0 flex w-[min(84vw,336px)] flex-col border-r ${t.border} ${theme === 'light' ? 'bg-white' : 'bg-black'} shadow-2xl`}
        style={{
          paddingTop: 'var(--app-safe-top, 0px)',
          paddingBottom: 'var(--app-safe-bottom, 0px)',
          touchAction: 'pan-y',
        }}
      >
        <header className={`flex h-12 shrink-0 items-center gap-2 border-b px-3 ${t.border}`}>
          <ListFilter className={theme === 'light' ? 'h-4 w-4 text-black' : 'h-4 w-4 text-white'} aria-hidden="true" />
          <h2 id="topic-filter-title" className={`text-sm font-semibold ${t.text}`}>主题筛选</h2>
          <span className={`text-xs ${t.textMuted}`}>{logTopicFilters.length}/{topics.length}</span>
          {logTopicFilters.length > 0 && (
            <button
              type="button"
              onClick={clearLogTopicFilters}
              className={`ml-auto px-2 py-1 text-xs ${t.textSecondary} ${t.bgHover} rounded`}
            >
              清空
            </button>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.bgHover} ${t.textSecondary} ${logTopicFilters.length === 0 ? 'ml-auto' : ''}`}
            aria-label={theme === 'light' ? '切换到深色主题' : '切换到浅色主题'}
            title={theme === 'light' ? '深色主题' : '浅色主题'}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.bgHover} ${t.textSecondary}`}
            aria-label="关闭主题筛选"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="shrink-0 p-3 pb-0">
          <ConnectionStatusBar compact />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
          {topics.length === 0 ? (
            <p className={`rounded-lg border border-dashed px-3 py-8 text-center text-xs ${t.border} ${t.textMuted}`}>
              暂无订阅主题
            </p>
          ) : (
            <div className="space-y-1.5" role="group" aria-label="按订阅主题筛选消息">
              {topics.map((topic) => {
                const selected = logTopicFilters.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleLogTopicFilter(topic)}
                    className={`flex min-h-10 w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                      selected
                        ? (theme === 'light' ? 'border-black bg-neutral-100' : 'border-white bg-neutral-900')
                        : `${t.border} ${t.bgHover}`
                    }`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      selected
                        ? (theme === 'light' ? 'border-black bg-black text-white' : 'border-white bg-white text-black')
                        : `${t.border} ${theme === 'light' ? 'bg-white' : 'bg-slate-800'}`
                    }`}>
                      {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                    </span>
                    <span className={`min-w-0 truncate font-mono text-xs ${selected ? t.text : t.textSecondary}`} title={topic}>
                      {topic}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
