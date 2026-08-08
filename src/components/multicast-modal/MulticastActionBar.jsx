import React from 'react';

export default function MulticastActionBar({
  onClearAll,
  onClearQuery,
  onImportFromSubscriptions,
  onImportFromTopic,
  onSearchChange,
  onSelectAll,
  onSelectNone,
  multicastQuery,
  t,
  theme,
}) {
  return (
    <>
      <div className="flex gap-2 mb-4">
        <div className={`flex-1 flex items-center gap-2 ${t.bgInput} border ${t.border} rounded-xl px-3 py-2`}>
          <input
            autoFocus
            value={multicastQuery}
            onChange={onSearchChange}
            placeholder="搜索 名称 / Topic..."
            className={`flex-1 bg-transparent text-sm outline-none ${t.text}`}
          />
        </div>
        <button onClick={onClearQuery} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${t.bgTertiary} ${t.textSecondary} border ${t.border} ${t.bgHover}`}>清空</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button type="button" onClick={onSelectAll} className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${t.bgTertiary} ${t.textSecondary} border ${t.border} ${t.bgHover}`}>全选</button>
        <button type="button" onClick={onSelectNone} className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${t.bgTertiary} ${t.textSecondary} border ${t.border} ${t.bgHover}`}>全不选</button>
        <button type="button" onClick={onImportFromSubscriptions} className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${t.bgTertiary} ${t.textSecondary} border ${t.border} ${t.bgHover}`}>从订阅导入</button>
        <button type="button" onClick={onImportFromTopic} className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${t.bgTertiary} ${t.textSecondary} border ${t.border} ${t.bgHover}`}>从当前Topic导入</button>
        <button
          type="button"
          onClick={onClearAll}
          className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${theme === 'light' ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' : 'bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20'}`}
        >
          清空目标
        </button>
      </div>
    </>
  );
}
