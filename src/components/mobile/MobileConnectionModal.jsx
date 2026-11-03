import React, { useEffect, useRef } from 'react';
import { Settings, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import ConnectionPanel from '../ConnectionPanel.jsx';
import SubscriptionPanel from '../SubscriptionPanel.jsx';

export default function MobileConnectionModal({ open, onClose }) {
  const { theme, t } = useTheme();
  const closeButtonRef = useRef(null);

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

  return (
    <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-labelledby="mobile-connection-title">
      <button type="button" tabIndex={-1} className="absolute inset-0 bg-slate-950/55" onClick={onClose} aria-label="关闭连接配置" />
      <section
        className={`absolute inset-x-2 flex flex-col overflow-hidden rounded-lg border ${t.border} ${theme === 'light' ? 'bg-white' : 'bg-black'} shadow-2xl`}
        style={{
          top: 'calc(var(--app-safe-top, 0px) + 8px)',
          bottom: 'calc(var(--app-safe-bottom, 0px) + 8px)',
        }}
      >
        <header className={`flex h-12 shrink-0 items-center gap-2 border-b px-3 ${t.border}`}>
          <Settings className={theme === 'light' ? 'h-4 w-4 text-black' : 'h-4 w-4 text-white'} />
          <h2 id="mobile-connection-title" className={`text-sm font-semibold ${t.text}`}>连接与订阅</h2>
          <button ref={closeButtonRef} type="button" onClick={onClose} className={`ml-auto flex h-8 w-8 items-center justify-center rounded-lg ${t.bgHover} ${t.textSecondary}`} aria-label="关闭连接配置">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
          <ConnectionPanel forceExpanded />
          <SubscriptionPanel forceExpanded />
        </div>
      </section>
    </div>
  );
}
