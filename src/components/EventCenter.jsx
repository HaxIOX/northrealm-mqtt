import React from 'react';
import { X, Bell, Search, Activity, Copy } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useMqtt } from '../contexts/MqttContext.jsx';

export default function EventCenter() {
  const { theme, t } = useTheme();
  const {
    isDevMode, eventCenterOpen, setEventCenterOpen,
    eventFilter, setEventFilter, filteredEventLogs,
    debugPacketLog, setDebugPacketLog,
  } = useMqtt();

  if (!isDevMode || !eventCenterOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close" onClick={() => setEventCenterOpen(false)} className="absolute inset-0 bg-black/40" />
      <div className={`absolute right-0 top-0 h-full w-full max-w-md ${t.bgSecondary} border-l ${t.border} shadow-2xl flex flex-col`}>
        <div className={`p-4 border-b ${t.border} flex items-center gap-3`}>
          <div className="min-w-0 flex-1">
            <div className={`text-sm font-semibold ${t.text}`}>事件中心</div>
            <div className={`text-xs ${t.textMuted}`}>{filteredEventLogs.length} 条</div>
          </div>
          <button
            type="button" onClick={() => setDebugPacketLog(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
              debugPacketLog ? (theme === 'light' ? 'text-violet-700 bg-violet-50' : 'text-violet-300 bg-violet-500/10') : (theme === 'light' ? 'text-slate-600 bg-slate-50' : 'text-slate-400 bg-slate-500/10')
            }`}
            title="packetsend/packetreceive（高频）"
          >
            <Activity className="w-3 h-3"/>{debugPacketLog ? 'Pkt On' : 'Pkt Off'}
          </button>
          <button type="button" onClick={() => setEventCenterOpen(false)} className={`p-2 ${t.bgTertiary} border ${t.border} rounded-xl ${t.textSecondary} hover:${t.text} ${t.bgHover} transition-all`} title="关闭">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={`p-4 border-b ${t.border} space-y-2`}>
          <div className="relative group">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted} group-focus-within:text-indigo-500 transition-colors`} size={16} />
            <input type="text" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} placeholder="搜索事件..." className={`pl-9 pr-4 py-2 ${t.bgInput} border ${t.border} rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${t.text} placeholder:${t.textMuted}`}/>
          </div>
          <div className={`text-[10px] ${t.textMuted}`}>主视图仅显示发送/接收消息；连接过程、诊断、重连等事件会显示在这里。</div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {filteredEventLogs.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-full ${t.textMuted}`}>
              <Bell className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">暂无事件</p>
              <p className="text-xs mt-1">连接、重连、错误等会显示在这里</p>
            </div>
          ) : (
            filteredEventLogs.map((log) => (
              <div key={log.id} className={`p-3 rounded-xl border ${t.border} ${t.bgTertiary}`}>
                <div className="flex items-center gap-2">
                  <div className={`text-xs ${t.textMuted} font-mono`}>{log.timestamp}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${
                    log.type === 'error' ? (theme === 'light' ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-rose-400 border-rose-500/30 bg-rose-500/10') :
                    log.type === 'system' ? (theme === 'light' ? 'text-slate-600 border-slate-200 bg-slate-50' : 'text-slate-400 border-slate-500/30 bg-slate-500/10') :
                    (theme === 'light' ? 'text-violet-700 border-violet-200 bg-violet-50' : 'text-violet-300 border-violet-500/30 bg-violet-500/10')
                  }`}>{log.type}</span>
                  {log.topic && <span className={`text-xs ${t.textSecondary} font-semibold font-mono truncate`}>{log.topic}</span>}
                  <button type="button" onClick={() => navigator.clipboard.writeText([log.topic, log.payload, log.details].filter(Boolean).join('\n'))} className={`ml-auto ${t.textMuted} hover:${t.text} p-1 ${t.bgHover} rounded transition-all`} title="复制">
                    <Copy className="w-3 h-3"/>
                  </button>
                </div>
                <div className={`mt-2 text-xs whitespace-pre-wrap break-words font-mono ${t.text}`}>{log.payload}</div>
                {!!log.details && <div className={`mt-2 text-[11px] whitespace-pre-wrap break-words ${t.textMuted}`}>{log.details}</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
