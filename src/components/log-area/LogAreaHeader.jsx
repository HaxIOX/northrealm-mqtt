import React, { useState } from 'react';
import { Download, MessageSquare, Search, Trash2, X } from 'lucide-react';

export default function LogAreaHeader({
  clearLogTopicFilters,
  filteredCount,
  handleExportLogs,
  isAutoScroll,
  logExportButtonRef,
  logExportMenuOpen,
  logExportMenuRef,
  logFilter,
  logTopicFilters,
  onClearLogs,
  setIsAutoScroll,
  setLogExportMenuOpen,
  setLogFilter,
  t,
  theme,
}) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <div className={`px-3 py-1.5 sm:py-2 ${t.bgTertiary} border-b ${t.border} flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0`}>
      <div className="flex items-center gap-2 min-w-0">
        <h3 className={`text-sm font-semibold ${t.textSecondary} flex items-center gap-1.5 shrink-0`}>
          <MessageSquare className={`w-4 h-4 ${t.text}`} /> <span className="hidden sm:inline">消息日志</span>
        </h3>
        <span className={`text-xs ${t.textMuted} shrink-0`}>{filteredCount} 条</span>
        {logTopicFilters.length > 0 && (
          <span className={`text-xs ${t.textMuted} flex items-center gap-1.5 min-w-0`}>
            <span className="hidden sm:inline truncate">主题筛选 {logTopicFilters.length}</span>
            <button type="button" onClick={clearLogTopicFilters} className={`px-1.5 py-0.5 rounded-md border ${t.border} ${t.bgHover} ${t.textSecondary} transition-colors shrink-0`} title="取消主题筛选">
              <span className="sm:hidden">筛 {logTopicFilters.length} ×</span>
              <span className="hidden sm:inline">清除</span>
            </button>
          </span>
        )}
      </div>

      <div className="relative group hidden sm:block sm:w-48 sm:ml-2">
        <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={14} />
        <input
          type="text"
          value={logFilter}
          onChange={(event) => setLogFilter(event.target.value)}
          placeholder="搜索消息..."
          aria-label="搜索消息"
          className={`w-full pl-8 pr-3 py-1.5 ${t.bgInput} border ${t.border} rounded-lg text-xs focus:outline-none focus:border-current ${t.text} ${t.textMuted}`}
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setMobileSearchOpen((open) => !open)}
          className={`relative sm:hidden p-1.5 rounded-lg ${t.textSecondary} ${t.bgHover} transition-colors`}
          title={mobileSearchOpen ? '关闭搜索' : '搜索消息'}
          aria-label={mobileSearchOpen ? '关闭搜索' : '搜索消息'}
        >
          {mobileSearchOpen ? <X className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
          {logFilter && !mobileSearchOpen && <span className={`absolute right-1 top-1 w-1.5 h-1.5 rounded-full ${theme === 'light' ? 'bg-black' : 'bg-white'}`} />}
        </button>
        <div className="relative">
          <button ref={logExportButtonRef} type="button" onClick={() => setLogExportMenuOpen((value) => !value)} className={`text-xs px-2 py-1.5 rounded-lg ${t.textSecondary} ${t.bgHover} transition-colors flex items-center gap-1`} title="导出消息日志">
            <Download className="w-3 h-3" /> <span className="hidden sm:inline">导出</span>
          </button>
          {logExportMenuOpen && (
            <div ref={logExportMenuRef} className={`absolute right-0 mt-2 w-44 ${t.bgSecondary} border ${t.border} rounded-xl ${t.shadowLg} overflow-hidden z-30`}>
              <button type="button" onClick={() => handleExportLogs('filtered')} className={`w-full px-4 py-2 text-left text-xs ${t.textSecondary} ${t.bgHover} transition-colors`}>导出当前（筛选后）</button>
              <button type="button" onClick={() => handleExportLogs('all')} className={`w-full px-4 py-2 text-left text-xs ${t.textSecondary} ${t.bgHover} transition-colors`}>导出全部</button>
            </div>
          )}
        </div>
        <button type="button" onClick={() => setIsAutoScroll(!isAutoScroll)} className={`text-xs px-2 py-1.5 rounded-lg transition-colors ${isAutoScroll ? (theme === 'light' ? 'text-emerald-600 bg-emerald-50' : 'text-emerald-400 bg-emerald-500/10') : (theme === 'light' ? 'text-amber-600 bg-amber-50' : 'text-amber-400 bg-amber-500/10')}`} title={isAutoScroll ? '暂停自动滚动' : '开启自动滚动'}>
          {isAutoScroll ? 'Auto' : '暂停'}
        </button>
        <button type="button" onClick={onClearLogs} className={`p-1.5 rounded-lg ${t.textSecondary} ${t.bgHover} transition-colors`} title="清空消息">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {mobileSearchOpen && (
        <div className="relative group order-last w-full sm:hidden">
          <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={14} />
          <input
            autoFocus
            type="text"
            value={logFilter}
            onChange={(event) => setLogFilter(event.target.value)}
            placeholder="搜索消息..."
            aria-label="搜索消息"
            className={`w-full h-8 pl-8 pr-3 ${t.bgInput} border ${t.border} rounded-lg text-xs focus:outline-none focus:border-current ${t.text} ${t.textMuted}`}
          />
        </div>
      )}
    </div>
  );
}
