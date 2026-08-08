import React from 'react';
import { Activity, Sun, Moon, Wifi, WifiOff, Clock, Settings, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useMqtt } from '../contexts/MqttContext.jsx';
import { useAppData } from '../contexts/AppDataContext.jsx';
import { formatDuration } from '../utils/formatters.js';
import StatCards from './StatCards.jsx';
import ConnectionPanel from './ConnectionPanel.jsx';
import SubscriptionPanel from './SubscriptionPanel.jsx';

export default function Sidebar({ mobileOpen = false, onClose }) {
  const { theme, t, toggleTheme } = useTheme();
  const { connectStatus, connectDuration, reconnectCount, connection } = useMqtt();
  const { isCloudConnected, setShowSyncModal } = useAppData();

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[86vw] ${mobileOpen ? 'flex translate-x-0' : 'hidden -translate-x-full'} lg:static lg:flex lg:w-80 lg:max-w-none lg:translate-x-0 ${t.bgSecondary} backdrop-blur-xl border-r ${t.borderLight} flex-col shrink-0 transition-transform duration-200 lg:transition-colors`}>
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className={`text-lg font-bold tracking-tight ${t.text}`}>NR <span className="text-indigo-500">MQTT</span></h1>
              <p className={`text-xs ${t.textMuted}`}>Cloud Edition</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-xl ${t.bgTertiary} ${t.bgHover} ${t.textSecondary} transition-all hover:scale-105`}
            title={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl ${t.bgTertiary} ${t.bgHover} ${t.textSecondary} lg:hidden`}
            title="关闭侧栏"
            aria-label="关闭侧栏"
          >
            <X className="w-5 h-5" />
          </button>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border transition-all duration-300 ${
          connectStatus === 'connected'
            ? theme === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/30'
            : connectStatus === 'connecting'
              ? theme === 'light' ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/10 border-amber-500/30'
              : `${t.bgTertiary} ${t.border}`
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {connectStatus === 'connected' ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-slate-500" />}
              <span className={`text-sm font-medium ${connectStatus === 'connected' ? 'text-emerald-400' : 'text-slate-400'}`}>
                {connectStatus === 'connected' ? '已连接' : connectStatus === 'connecting' ? '连接中...' : '未连接'}
              </span>
            </div>
            {connectStatus === 'connected' && (
              <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
                <Clock className="w-3 h-3" />
                <span>{formatDuration(connectDuration)}</span>
              </div>
            )}
          </div>
          {connectStatus === 'connected' && (
            <p className="text-xs text-slate-500 truncate">{connection.host}:{connection.port}</p>
          )}
          {reconnectCount > 0 && connectStatus !== 'connected' && (
            <p className="text-xs text-amber-500 mt-2">🔄 重连次数: {reconnectCount}</p>
          )}
        </div>
      </div>

      <StatCards />

      <div className="flex-1 overflow-y-auto custom-scrollbar px-4">
        <ConnectionPanel />
        <SubscriptionPanel />
      </div>

      <div className={`p-4 border-t ${t.borderLight}`}>
        <button
          onClick={() => setShowSyncModal(true)}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
            isCloudConnected
              ? `${theme === 'light' ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30'}`
              : `${t.bgTertiary} ${t.textSecondary} border ${t.border} ${t.bgHover}`
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>同步与备份</span>
          {isCloudConnected && <span className={`text-[10px] px-2 py-0.5 rounded-full border ${theme === 'light' ? 'border-indigo-200 text-indigo-600' : 'border-indigo-500/30 text-indigo-300'}`}>已连接</span>}
        </button>
      </div>
    </aside>
  );
}
