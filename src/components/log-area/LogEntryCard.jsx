import React from 'react';
import { Copy } from 'lucide-react';
import { formatJsonPayload, toHex } from '../../utils/formatters.js';

function getTypeBadgeClass(logType, theme) {
  if (logType === 'sent') return theme === 'light' ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-blue-400 border-blue-500/30 bg-blue-500/10';
  if (logType === 'received') return theme === 'light' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  if (logType === 'system') return theme === 'light' ? 'text-slate-600 border-slate-200 bg-slate-50' : 'text-slate-400 border-slate-500/30 bg-slate-500/10';
  return theme === 'light' ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-rose-400 border-rose-500/30 bg-rose-500/10';
}

function getPayloadClass(logType, theme) {
  if (logType === 'sent') return theme === 'light' ? 'bg-blue-50 border-blue-100 text-blue-900' : 'bg-blue-500/5 border-blue-500/20 text-blue-200';
  if (logType === 'received') return theme === 'light' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-200';
  if (logType === 'system') return theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-700' : 'bg-slate-800/50 border-slate-700/50 text-slate-300';
  return theme === 'light' ? 'bg-rose-50 border-rose-100 text-rose-900' : 'bg-rose-500/5 border-rose-500/20 text-rose-200';
}

export default function LogEntryCard({
  log,
  logViewMode,
  t,
  theme,
}) {
  const { isJson, formatted } = formatJsonPayload(log.payload);

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 group min-w-0">
      <div className={`text-[10px] sm:text-xs ${t.textMuted} sm:min-w-[70px] sm:pt-2 font-mono shrink-0`}>{log.timestamp}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold uppercase shrink-0 ${getTypeBadgeClass(log.type, theme)}`}>{log.type}</span>
          {log.topic && <span className={`text-xs ${t.textSecondary} font-semibold font-mono truncate`} title={log.topic}>{log.topic}</span>}
          {log.details && log.type === 'received' && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${theme === 'light' ? 'text-amber-600 border-amber-200 bg-amber-50 border' : 'text-amber-400 border-amber-500/30 bg-amber-500/10 border'}`}>{log.details}</span>}
          <button type="button" onClick={() => navigator.clipboard.writeText(log.payload)} className={`ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100 ${t.textMuted} hover:${t.text} p-1 ${t.bgHover} rounded transition-all`} title="复制消息">
            <Copy className="w-3 h-3" />
          </button>
        </div>
        <div className={`p-2.5 sm:p-3 lg:p-4 rounded-lg sm:rounded-xl text-xs sm:text-sm break-all whitespace-pre-wrap border font-mono ${getPayloadClass(log.type, theme)}`}>
          {logViewMode === 'hex' ? (
            <div className={`${theme === 'light' ? 'text-purple-600' : 'text-purple-300'} tracking-wider`}>{toHex(log.payload)}</div>
          ) : (
            isJson ? <pre className={`${theme === 'light' ? 'text-indigo-600' : 'text-indigo-300'} overflow-x-auto`}>{formatted}</pre> : formatted
          )}
        </div>
      </div>
    </div>
  );
}
