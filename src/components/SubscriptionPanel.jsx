import React from 'react';
import { Download, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useMqtt } from '../contexts/MqttContext.jsx';
import { useAppData } from '../contexts/AppDataContext.jsx';

export default function SubscriptionPanel({ forceExpanded = false }) {
  const { theme, t } = useTheme();
  const {
    client, subTopic, setSubTopic, subscriptionsCollapsed, setSubscriptionsCollapsed,
    handleSubscribe, handleUnsubscribe, logTopicFilters, toggleLogTopicFilter,
  } = useMqtt();
  const { subscriptions } = useAppData();
  const isCollapsed = forceExpanded ? false : subscriptionsCollapsed;

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={forceExpanded ? undefined : () => setSubscriptionsCollapsed(!isCollapsed)}
        className={`w-full px-4 py-3 flex items-center gap-2 ${t.bgHover} rounded-xl transition-colors`}
        title={isCollapsed ? '展开订阅' : '收起订阅'}
      >
        <Download className="w-4 h-4 text-emerald-500" />
        <span className={`text-sm font-medium ${t.textSecondary}`}>订阅监控</span>
        <span className={`text-xs ${t.textMuted} ml-auto`}>{subscriptions.length} 个</span>
        {!forceExpanded && (isCollapsed ? <ChevronDown className={`w-4 h-4 ${t.textMuted}`} /> : <ChevronUp className={`w-4 h-4 ${t.textMuted}`} />)}
      </button>

      {!isCollapsed && (
        <div className="space-y-2 mt-2">
          <div className="flex gap-2 px-2">
            <input type="text" placeholder="Topic (e.g. #)" value={subTopic} onChange={(e) => setSubTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()} className={`flex-1 ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none transition-all ${t.text}`}/>
            <button onClick={handleSubscribe} disabled={!client?.connected} className={`${theme === 'light' ? 'bg-emerald-100 hover:bg-emerald-600 text-emerald-600 hover:text-white' : 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white'} px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-all`}>订阅</button>
          </div>
          <div className="space-y-1 px-2">
            {subscriptions.map(sub => (
              <div
                key={sub}
                role="button"
                tabIndex={0}
                onClick={() => toggleLogTopicFilter(sub)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleLogTopicFilter(sub); } }}
                className={`flex items-center justify-between ${t.card} px-3 py-2 rounded-lg border group transition-all cursor-pointer select-none ${
                  logTopicFilters.includes(sub) ? 'border-indigo-500/60 ring-1 ring-indigo-500/30' : 'hover:border-emerald-500/30'
                }`}
                title="单击切换：筛选消息日志（不影响实际订阅）"
              >
                <div className="flex items-center min-w-0 gap-2">
                  <span className={`text-xs leading-none ${logTopicFilters.includes(sub) ? (theme === 'light' ? 'text-indigo-600' : 'text-indigo-400') : 'opacity-0'}`} aria-hidden="true" title={logTopicFilters.includes(sub) ? '已选中筛选' : ''}>●</span>
                  <span className="text-xs text-emerald-500 font-mono truncate mr-2" title={sub}>{sub}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleUnsubscribe(sub); }}
                  className={`${t.textMuted} hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all`}
                  title="退订"
                >
                  <Trash2 className="w-3 h-3"/>
                </button>
              </div>
            ))}
            {subscriptions.length === 0 && <div className={`text-xs ${t.textMuted} text-center py-4 border border-dashed ${t.border} rounded-lg`}>暂无订阅</div>}
          </div>
        </div>
      )}
    </div>
  );
}
