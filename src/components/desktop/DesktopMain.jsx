import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Binary, Edit2, Hash, Layout, MessageSquare, Plus, Search, Send, Star, Timer, Trash2, Zap } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useMqtt } from '../../contexts/MqttContext.jsx';
import { useAppData } from '../../contexts/AppDataContext.jsx';
import { useCommonQuickActions } from '../../hooks/useCommonQuickActions.js';
import { useQuickActionRunner } from '../quick-actions/useQuickActionRunner.js';
import EventCenter from '../EventCenter.jsx';
import DesktopLogItem from './DesktopLogItem.jsx';
import { TONE } from './tone.js';

const MAX_COMMON = 6;

const formatTimerCountdown = (ms) => {
  if (ms >= 60000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  if (ms >= 10000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.max(0, Math.round(ms))}ms`;
};

// 桌面端主区（v0.1.15 Windows 版外观）：顶栏 + 日志 + 发布台。
export default function DesktopMain({ sidebarOpen, onToggleSidebar }) {
  const { theme, t } = useTheme();
  const {
    client, isDevMode,
    filteredMessageLogs, logViewMode, setLogViewMode, setConnection,
    isAutoScroll, setIsAutoScroll, logFilter, setLogFilter, setLogs, logsEndRef,
    setEventCenterOpen,
    pubTopic, setPubTopic, pubMessage, setPubMessage, pubQoS, setPubQoS, pubRetain, setPubRetain,
    timerEnabled, timerNextSendAt, timerInterval, timerIntervalInput, setTimerIntervalInput,
    syncTimerIntervalFromInput, toggleTimer,
    handlePublish, openPublishEditor, setShowQuickActionsPanel,
  } = useMqtt();
  const { quickActions } = useAppData();
  const { handleSaveAction, commonActions } = useCommonQuickActions(MAX_COMMON);
  const { sendQuickAction, loadActionIntoPublishForm } = useQuickActionRunner();

  const [logTypeFilter, setLogTypeFilter] = useState('all');
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const textareaRef = useRef(null);

  const visibleLogs = useMemo(() => (
    logTypeFilter === 'all'
      ? filteredMessageLogs
      : filteredMessageLogs.filter((log) => log.type === (logTypeFilter === 'in' ? 'received' : 'sent'))
  ), [filteredMessageLogs, logTypeFilter]);

  // 发送框随内容自动增高（上限 38vh）
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [pubMessage]);

  // 定时发送倒计时：每 100ms 刷新一次
  useEffect(() => {
    if (!timerEnabled || !timerNextSendAt) return undefined;
    const ticker = setInterval(() => setTimerNow(Date.now()), 100);
    return () => clearInterval(ticker);
  }, [timerEnabled, timerNextSendAt]);

  const timerRemainingMs = timerEnabled && timerNextSendAt ? Math.max(0, timerNextSendAt - timerNow) : 0;
  const timerProgress = timerEnabled
    ? Math.min(100, Math.max(0, ((timerInterval - timerRemainingMs) / Math.max(timerInterval, 1)) * 100))
    : 0;

  const toggleViewMode = () => {
    const next = logViewMode === 'text' ? 'hex' : 'text';
    setLogViewMode(next);
    setConnection((current) => ({ ...current, logViewMode: next }));
  };

  const handleEditFromLog = (log) => {
    setPubTopic(log.topic);
    setPubMessage(log.payload);
  };

  const onTimerInputChange = (e) => {
    const { value } = e.target;
    if (value === '' || /^\d+$/.test(value)) setTimerIntervalInput(value);
  };

  return (
    <main className={`flex-1 flex flex-col min-w-0 relative ${t.bg} transition-colors duration-300`}>
      {/* 顶部 Header */}
      <header className={`app-header sticky top-0 z-20 ${theme === 'light' ? 'bg-[#F9FAFB]' : 'bg-[#09090B]'} border-b ${t.border} h-16 px-5 flex items-center justify-between shrink-0`}>
        <div className="flex items-center gap-3 h-full">
          <button
            onClick={onToggleSidebar}
            className={`p-2 rounded-xl ${t.textSecondary} ${t.bgHover} transition-all duration-300 ${!sidebarOpen && 'rotate-180'}`}
            title="切换侧栏"
          >
            <Layout size={18} />
          </button>
          <div className="flex items-center bg-gray-100 dark:bg-zinc-800/50 rounded-lg p-0.5">
            {([['all', '全部'], ['in', '接收'], ['out', '发送']]).map(([type, label]) => (
              <button
                key={type}
                onClick={() => setLogTypeFilter(type)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all duration-300 ${
                  logTypeFilter === type
                    ? 'bg-white dark:bg-zinc-700 text-brand-500 dark:text-brand-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${TONE.info}`}>{visibleLogs.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 mr-1">
            <button onClick={toggleViewMode} className={`text-[11px] px-2.5 py-1 rounded-lg ${t.textSecondary} ${t.bgHover} transition-colors flex items-center gap-1`}>
              <Binary className="w-3 h-3" />{logViewMode.toUpperCase()}
            </button>
            <button onClick={() => setIsAutoScroll(!isAutoScroll)} className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${isAutoScroll ? TONE.ok : TONE.warn}`}>
              {isAutoScroll ? '自动滚动' : '已暂停'}
            </button>
          </div>
          <div className="relative group">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${t.textMuted} group-focus-within:text-brand-500 transition-colors`} size={15} />
            <input
              type="text"
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              placeholder="搜索日志..."
              className={`pl-10 pr-4 py-2 ${t.bgInput} ${t.border} border rounded-full text-[13px] w-40 min-[1180px]:w-64 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all ${t.text}`}
            />
          </div>
          {isDevMode && (
            <button
              onClick={() => setEventCenterOpen(true)}
              title="事件中心（开发模式）"
              className={`relative p-2 rounded-xl ${t.textSecondary} ${t.bgHover} transition-all duration-300`}
            >
              <Bell size={16} />
            </button>
          )}
          <button
            onClick={() => setLogs([])}
            className={`p-2 rounded-xl ${t.textSecondary} ${t.bgHover} transition-all duration-300`}
            title="清空日志"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {/* 日志区域 */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <div className="app-log-list flex-1 overflow-y-auto py-4 custom-scrollbar">
          <div className="px-8 space-y-3 min-h-full flex flex-col">
            {visibleLogs.length === 0 ? (
              <div className={`flex flex-col items-center justify-center flex-1 ${t.textMuted}`}>
                <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">暂无日志记录</p>
                <p className="text-xs mt-1">连接服务器并订阅主题后，消息将显示在这里</p>
              </div>
            ) : (
              visibleLogs.map((log) => (
                <DesktopLogItem key={log.id} log={log} theme={theme} logViewMode={logViewMode} onEdit={handleEditFromLog} />
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* 发布台 */}
      <div className="shrink-0 mx-4 mb-3 z-20">
        <div className={`p-3 ${t.floatingPanel} flex flex-col gap-2.5`}>
          {/* 控制行：Topic + QoS + Retain + 定时 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Hash className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={14} />
              <input
                type="text"
                value={pubTopic}
                onChange={(e) => setPubTopic(e.target.value)}
                placeholder="Topic (e.g. device/control)"
                className={`w-full pl-9 pr-4 py-2 text-[13px] font-mono ${t.bgInput} border border-transparent rounded-xl outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all ${t.text}`}
              />
            </div>
            <div className={`flex items-center gap-4 px-4 py-2 rounded-xl ${t.bgInput} border border-transparent`}>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">QoS</span>
                <select value={pubQoS} onChange={(e) => setPubQoS(Number(e.target.value))} className="bg-transparent text-[13px] font-mono outline-none text-[#333D4F] dark:text-[#E6EDF3] cursor-pointer">
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </div>
              <div className="w-px h-4 bg-[#D1D5DB] dark:bg-[#4B5563]"></div>
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={pubRetain} onChange={(e) => setPubRetain(e.target.checked)} />
                  <div className={`block w-8 h-5 rounded-full transition-colors duration-300 ${pubRetain ? 'bg-brand-500 dark:bg-brand-400' : 'bg-gray-300 dark:bg-zinc-700'}`}></div>
                  <div className={`absolute left-0.5 top-0.5 bg-white w-3.5 h-3.5 rounded-full transition-transform duration-300 shadow-sm ${pubRetain ? 'translate-x-3.5' : ''}`}></div>
                </div>
                <span className="text-[12px] font-bold text-gray-500 transition-colors">Retain</span>
              </label>
            </div>

            {/* 定时发送 */}
            <div className={`flex items-center gap-2 ${t.bgInput} border border-transparent rounded-xl px-3 py-2`}>
              <Timer className={`w-4 h-4 ${t.textMuted}`} />
              {timerEnabled ? (
                <span className="w-[72px] text-center text-xs font-mono text-emerald-600 dark:text-emerald-400">
                  {formatTimerCountdown(timerRemainingMs)}
                </span>
              ) : (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={timerIntervalInput}
                    onChange={onTimerInputChange}
                    onBlur={syncTimerIntervalFromInput}
                    className={`w-14 bg-transparent text-xs outline-none text-center ${t.textSecondary}`}
                    placeholder="间隔"
                    aria-label="定时间隔（毫秒）"
                  />
                  <span className={`text-xs ${t.textMuted}`}>ms</span>
                </>
              )}
              <button
                onClick={toggleTimer}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  timerEnabled
                    ? `${TONE.err} hover:bg-rose-100 dark:hover:bg-rose-500/20`
                    : `${TONE.ok} hover:bg-emerald-100 dark:hover:bg-emerald-500/20`
                }`}
              >
                {timerEnabled ? '停止' : '定时'}
              </button>
            </div>
          </div>

          {timerEnabled && (
            <div className="h-0.5 -mt-1 rounded-full overflow-hidden bg-emerald-500/15" role="progressbar" aria-label="定时发送进度">
              <div className="h-full bg-emerald-500 transition-[width] duration-100" style={{ width: `${timerProgress}%` }} />
            </div>
          )}

          {/* 快捷指令行 */}
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-0.5">
            <div className={`flex items-center gap-1.5 pr-2 text-slate-500 dark:text-slate-400 border-r ${theme === 'light' ? 'border-slate-200' : 'border-slate-700/50'} shrink-0`}>
              <Star size={13} className="text-[#F59E0B] dark:text-[#FBBF24]" />
              <span className="text-[12px] font-bold">快捷指令</span>
            </div>
            {commonActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={(e) => (e.shiftKey
                  ? loadActionIntoPublishForm(action)
                  : sendQuickAction(action, { openPanelForTemplate: true }))}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-bold shadow-sm border border-slate-200/80 dark:border-slate-700/80 hover:border-brand-500/60 hover:text-brand-500 dark:hover:border-brand-300/60 dark:hover:text-brand-300 transition-all"
                title={`${action.name}\n${action.topic}\n点击发送 · Shift+点击仅填入`}
              >
                {action.name}
              </button>
            ))}
            <button onClick={handleSaveAction} className="shrink-0 px-2 py-1 rounded-lg text-brand-500 hover:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-300/10 text-[11px] font-bold transition-colors flex items-center gap-1 border border-dashed border-brand-500/40 dark:border-brand-300/40 ml-1">
              <Plus size={12} strokeWidth={2.5} /> 存为指令
            </button>
            <button onClick={() => setShowQuickActionsPanel(true)} className="shrink-0 px-2 py-1 rounded-lg text-[11px] font-bold text-brand-500 hover:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-300/10 transition-colors flex items-center gap-1 ml-auto">
              <Zap size={12} strokeWidth={2.5} /> 快捷面板
              <span className="text-[11px] font-semibold text-brand-500 dark:text-brand-300">{quickActions.length}</span>
            </button>
          </div>

          {/* Payload + 发送 */}
          <div className="flex gap-3 items-end">
            <div className={`flex-1 relative rounded-xl ${t.bgInput} border border-transparent focus-within:ring-2 focus-within:ring-brand-500/30 focus-within:bg-white dark:focus-within:bg-zinc-900 transition-all`}>
              <textarea
                ref={textareaRef}
                value={pubMessage}
                onChange={(e) => setPubMessage(e.target.value)}
                className={`payload-textarea custom-scrollbar w-full bg-transparent p-3 font-mono text-[13px] leading-relaxed ${t.text} min-h-[64px] max-h-[38vh] overflow-y-auto outline-none rounded-xl`}
                placeholder='{"msg": "Hello"}'
                spellCheck="false"
              />
              <button type="button" onClick={openPublishEditor} className={`absolute bottom-2 right-2 p-1.5 rounded-lg ${t.textSecondary} ${t.bgHover} transition-all`} title="编辑即将发送的消息"><Edit2 size={14} /></button>
            </div>
            <button onClick={handlePublish} disabled={!client?.connected} className="w-24 self-stretch min-h-[64px] bg-brand-500 hover:bg-brand-600 dark:bg-brand-400 dark:hover:bg-brand-300 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-brand-500/25 dark:shadow-brand-400/20">
              <Send size={20} />
              <span className="text-[13px] font-bold tracking-widest uppercase">发送</span>
            </button>
          </div>
        </div>
      </div>

      <EventCenter />
    </main>
  );
}
