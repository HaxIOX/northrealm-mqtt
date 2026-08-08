import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function ConnectionAdvancedSection({
  advancedConfig,
  autoReconnect,
  autoResubscribe,
  setAdvancedConfig,
  setAutoReconnect,
  setAutoResubscribe,
  setShowAdvanced,
  setShowRetained,
  showAdvanced,
  showRetained,
  t,
}) {
  return (
    <>
      <button onClick={() => setShowAdvanced(!showAdvanced)} className={`flex items-center gap-1 text-xs font-medium ${t.textSecondary} ${t.bgHover}`}>
        {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} 高级设置
      </button>

      {showAdvanced && (
        <div className={`p-3 ${t.bgTertiary} rounded-lg border ${t.borderLight} space-y-2`}>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={`text-[10px] ${t.textMuted} block mb-1`}>Keep Alive (秒)</label>
              <input
                type="number"
                value={advancedConfig.keepalive}
                onChange={(e) => setAdvancedConfig({ ...advancedConfig, keepalive: e.target.value })}
                className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-2 py-1 text-xs ${t.text}`}
              />
            </div>
            <div className="flex-1">
              <label className={`text-[10px] ${t.textMuted} block mb-1`}>协议版本</label>
              <select
                value={advancedConfig.protocolVersion}
                onChange={(e) => setAdvancedConfig({ ...advancedConfig, protocolVersion: Number(e.target.value) })}
                className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-2 py-1 text-xs ${t.text}`}
              >
                <option value={3}>MQTT 3.1</option>
                <option value={4}>MQTT 3.1.1</option>
                <option value={5}>MQTT 5.0</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={advancedConfig.clean}
                onChange={(e) => setAdvancedConfig({ ...advancedConfig, clean: e.target.checked })}
                className="rounded border-neutral-400 bg-neutral-100 text-black dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
              />
              <span className={`text-xs ${t.textSecondary}`}>Clean Session</span>
            </label>
          </div>
          <div className={`flex items-center gap-2 pt-2 border-t ${t.borderLight}`}>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={autoResubscribe}
                onChange={(e) => setAutoResubscribe(e.target.checked)}
                className="rounded bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-emerald-600"
              />
              <span className={`text-xs ${t.textSecondary}`}>自动重订阅</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showRetained}
                onChange={(e) => setShowRetained(e.target.checked)}
                className="rounded border-neutral-400 bg-neutral-100 text-black dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
              />
              <span className={`text-xs ${t.textSecondary}`}>显示 Retained</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={autoReconnect}
                onChange={(e) => setAutoReconnect(e.target.checked)}
                className="rounded bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-amber-600"
              />
              <span className={`text-xs ${t.textSecondary}`}>自动重连</span>
            </label>
          </div>
        </div>
      )}
    </>
  );
}
