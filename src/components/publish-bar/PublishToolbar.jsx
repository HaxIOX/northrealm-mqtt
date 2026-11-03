import React from 'react';
import { Ellipsis, Plus, Timer, Zap } from 'lucide-react';

export default function PublishToolbar({
  onOpenQuickActions,
  onSaveAction,
  onSyncTimerBlur,
  onTimerInputChange,
  pubQoS,
  pubRetain,
  quickActionsCount,
  setPubQoS,
  setPubRetain,
  theme,
  timerEnabled,
  timerIntervalInput,
  toggleTimer,
  t,
  topicInput,
}) {
  return (
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 min-w-0">
      <div className="col-span-2 w-full sm:flex-1 sm:min-w-[180px]">{topicInput}</div>
      <div className="col-span-2 flex items-stretch gap-2 min-w-0 sm:contents">
        <div className={`shrink-0 flex items-center gap-2 ${t.bgInput} border ${t.border} rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2`}>
          <select value={pubQoS} onChange={(e) => setPubQoS(Number(e.target.value))} className={`bg-transparent text-xs outline-none ${t.textSecondary}`} aria-label="QoS">
            <option value={0}>QoS 0</option>
            <option value={1}>QoS 1</option>
            <option value={2}>QoS 2</option>
          </select>
          <div className={`w-px h-4 ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-700'}`} />
          <label className={`flex items-center gap-1.5 text-xs ${t.textSecondary} cursor-pointer`}>
            <input type="checkbox" checked={pubRetain} onChange={(e) => setPubRetain(e.target.checked)} className="rounded bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-indigo-600 w-3.5 h-3.5" />
            Retain
          </label>
        </div>
        <div className={`flex-1 min-w-0 flex items-center gap-1.5 ${t.bgInput} border ${t.border} rounded-lg sm:rounded-xl px-2 py-1.5 sm:px-3 sm:py-2`}>
          <Timer className={`w-4 h-4 shrink-0 ${t.textMuted}`} />
          <input
            type="text"
            inputMode="numeric"
            value={timerIntervalInput}
            onChange={onTimerInputChange}
            onBlur={onSyncTimerBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            disabled={timerEnabled}
            className={`w-10 sm:w-16 min-w-0 bg-transparent text-xs outline-none text-center ${t.textSecondary}`}
            placeholder="间隔"
            aria-label="定时发送间隔"
          />
          <span className={`text-xs ${t.textMuted}`}>ms</span>
          <button type="button" onClick={toggleTimer} className={`ml-auto px-2 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all ${timerEnabled ? (theme === 'light' ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30') : (theme === 'light' ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30')}`}>
            {timerEnabled ? '停止' : '定时'}
          </button>
        </div>
        <details className="relative shrink-0 sm:hidden">
          <summary className={`list-none w-9 h-full min-h-9 flex items-center justify-center rounded-lg border ${t.border} ${t.bgInput} ${t.bgHover} ${t.textSecondary} cursor-pointer`} title="更多发布操作">
            <Ellipsis className="w-4 h-4" />
          </summary>
          <div className={`absolute right-0 bottom-full mb-2 z-40 w-36 p-1.5 rounded-lg border ${t.border} ${t.bgSecondary} shadow-lg`}>
            <button type="button" onClick={onOpenQuickActions} className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs ${t.textSecondary} ${t.bgHover}`}>
              <Zap className="w-3.5 h-3.5" /> 快捷指令 ({quickActionsCount})
            </button>
            <button type="button" onClick={onSaveAction} className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs ${t.textSecondary} ${t.bgHover}`}>
              <Plus className="w-3.5 h-3.5" /> 保存指令
            </button>
          </div>
        </details>
      </div>
      <button type="button" onClick={onOpenQuickActions} className={`hidden sm:flex min-w-0 justify-center items-center gap-1.5 text-xs font-bold ${theme === 'light' ? 'text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100' : 'text-amber-300 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20'} border px-3 py-2 rounded-xl transition-all`} title="打开快捷指令面板">
        <Zap className="w-3.5 h-3.5" /> 快捷指令 <span className={`ml-1 text-[10px] font-semibold ${theme === 'light' ? 'text-amber-600' : 'text-amber-300/80'}`}>{quickActionsCount}</span>
      </button>
      <button type="button" onClick={onSaveAction} className={`hidden sm:flex min-w-0 justify-center items-center gap-1.5 text-xs font-medium ${theme === 'light' ? 'text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100' : 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20'} border px-3 py-2 rounded-xl transition-all`}>
        <Plus className="w-3.5 h-3.5" /> 保存指令
      </button>
    </div>
  );
}
