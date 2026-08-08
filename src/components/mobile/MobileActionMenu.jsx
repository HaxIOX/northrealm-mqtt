import React from 'react';
import { Plus, Send, Settings, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext.jsx';

export default function MobileActionMenu({
  open,
  onToggle,
  onConnection,
  onPublish,
}) {
  const { theme, t } = useTheme();

  const selectAction = (callback) => {
    onToggle(false);
    callback?.();
  };

  return (
    <div className="fixed inset-0 z-40 pointer-events-none lg:hidden">
      {open && (
        <button
          type="button"
          aria-label="收起快捷操作"
          className="absolute inset-0 pointer-events-auto bg-black/10"
          onClick={() => onToggle(false)}
        />
      )}

      <div
        className={`absolute flex flex-col items-end gap-3 pointer-events-auto transition-[right] duration-200 ${open ? 'right-4' : '-right-px'}`}
        style={{ bottom: 'calc(var(--app-safe-bottom, 0px) + 16px)' }}
      >
        <div className={`flex flex-col items-end gap-3 transition-all duration-200 ${open ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>
          <button
            type="button"
            aria-label="连接配置"
            tabIndex={open ? 0 : -1}
            onClick={() => selectAction(onConnection)}
            className={`mr-10 flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium shadow-lg ${t.bgSecondary} ${t.border} ${t.text}`}
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            <span>连接配置</span>
          </button>

          <button
            type="button"
            aria-label="发送消息"
            tabIndex={open ? 0 : -1}
            onClick={() => selectAction(onPublish)}
            className={`mr-16 flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium shadow-lg transition-colors ${t.bgSecondary} ${t.border} ${t.text}`}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>发送消息</span>
          </button>
        </div>

        <button
          type="button"
          aria-label={open ? '收起快捷操作' : '展开快捷操作'}
          aria-expanded={open}
          onClick={() => onToggle(!open)}
          className={`flex items-center justify-center border shadow-xl transition-all duration-200 active:scale-95 ${
            open
              ? `h-12 w-12 rounded-full ${t.bgSecondary} ${t.border} ${t.text}`
              : `h-12 w-10 rounded-l-full rounded-r-none ${theme === 'light' ? 'border-black bg-black text-white' : 'border-white bg-white text-black'}`
          }`}
        >
          {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Plus className="h-6 w-6" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
