import React from 'react';
import { Save, Trash2 } from 'lucide-react';
import { PRESET_BROKERS } from '../../utils/constants.js';

export default function ConnectionConfigToolbar({
  connectStatus,
  connectionName,
  onDeleteConfig,
  onLoadConfig,
  onPresetChange,
  onSaveConfig,
  savedConfigs,
  selectedPresetBroker,
  t,
}) {
  return (
    <>
      <div className="flex gap-2">
        <select
          className={`flex-1 ${t.bgInput} border ${t.border} text-xs rounded-lg px-3 py-2 focus:border-current outline-none transition-all ${t.text}`}
          onChange={onLoadConfig}
          value={connectionName || ''}
        >
          <option value="" disabled>加载预设配置...</option>
          {savedConfigs.map((config) => <option key={config.name} value={config.name}>{config.name}</option>)}
        </select>
        <button onClick={onSaveConfig} title="保存配置" className={`p-2 ${t.bgTertiary} ${t.bgHover} border ${t.border} rounded-lg ${t.textMuted} transition-colors`}><Save className="w-4 h-4" /></button>
        {connectionName && <button onClick={onDeleteConfig} title="删除配置" className={`p-2 ${t.bgTertiary} ${t.bgHover} border ${t.border} rounded-lg ${t.textMuted} hover:text-rose-500 transition-colors`}><Trash2 className="w-4 h-4" /></button>}
      </div>

      <select
        value={selectedPresetBroker}
        onChange={onPresetChange}
        disabled={connectStatus !== 'disconnected'}
        className={`w-full ${t.bgInput} border ${t.border} text-xs rounded-lg px-3 py-2 focus:border-current outline-none transition-all disabled:opacity-50 ${t.text}`}
      >
        <option value="">公共服务器预设（快速填充）...</option>
        {PRESET_BROKERS.map((broker) => <option key={broker.name} value={broker.name}>{broker.name}</option>)}
      </select>
    </>
  );
}
