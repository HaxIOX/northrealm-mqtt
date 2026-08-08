import React from 'react';
import { ListFilter, RotateCcw, Bell } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useMqtt } from '../contexts/MqttContext.jsx';
import LogArea from './LogArea.jsx';
import PublishBar from './PublishBar.jsx';
import EventCenter from './EventCenter.jsx';
import ConnectionStatusBar from './ConnectionStatusBar.jsx';

export default function MainContent({ onOpenTopicFilters }) {
  const { theme, t } = useTheme();
  const {
    isDevMode,
    resetStats, msgStats, setEventCenterOpen,
  } = useMqtt();

  return (
    <main className={`flex-1 flex flex-col min-w-0 overflow-hidden ${t.bg} transition-colors duration-300`}>
      <header className={`sticky top-0 z-20 ${theme === 'light' ? 'bg-[#F7F7F7]/95' : 'bg-black/95'} backdrop-blur-xl border-b ${t.border} px-3 py-2.5 sm:px-4 lg:px-6 lg:py-4 flex items-center justify-between gap-3 shrink-0`}>
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onOpenTopicFilters}
            className={`p-2 -ml-1 rounded-lg ${t.bgTertiary} ${t.bgHover} ${t.textSecondary} lg:hidden`}
            title="打开主题筛选"
            aria-label="打开主题筛选"
          >
            <ListFilter className="w-5 h-5" />
          </button>
          <h2 className={`text-base sm:text-xl font-bold truncate ${t.text}`}>实时监控</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={resetStats}
            className={`p-2 ${t.bgTertiary} border ${t.border} rounded-xl ${t.textSecondary} hover:${t.text} ${t.bgHover} transition-all`}
            title="重置统计"
          >
            <RotateCcw size={18} />
          </button>
          {isDevMode && (
            <button
              onClick={() => setEventCenterOpen(true)}
              title="事件中心（开发模式）"
              className={`relative p-2 ${t.bgTertiary} border ${t.border} rounded-xl ${t.textSecondary} hover:${t.text} ${t.bgHover} transition-all`}
            >
              <Bell size={18} />
              {msgStats.errors > 0 && <span className={`absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 ${theme === 'light' ? 'border-[#F7F7F7]' : 'border-black'}`}></span>}
            </button>
          )}
        </div>
      </header>

      <div className="hidden lg:block">
        <ConnectionStatusBar />
      </div>

      <LogArea />
      <div className="hidden shrink-0 lg:block">
        <PublishBar />
      </div>
      <EventCenter />
    </main>
  );
}
