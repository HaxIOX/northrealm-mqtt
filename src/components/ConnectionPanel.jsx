import React from 'react';
import { Binary, ChevronDown, ChevronUp, Server } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useMqtt } from '../contexts/MqttContext.jsx';
import { useAppData } from '../contexts/AppDataContext.jsx';
import { PRESET_BROKERS } from '../utils/constants.js';
import ConnectionActionButton from './connection-panel/ConnectionActionButton.jsx';
import ConnectionAdvancedSection from './connection-panel/ConnectionAdvancedSection.jsx';
import ConnectionConfigToolbar from './connection-panel/ConnectionConfigToolbar.jsx';
import ConnectionFormFields from './connection-panel/ConnectionFormFields.jsx';
import ConnectionProbeAction from './connection-panel/ConnectionProbeAction.jsx';
import { useSavedConfigActions } from '../hooks/useSavedConfigActions.js';
import { useMqttConnectionProbe } from '../hooks/useMqttConnectionProbe.js';

export default function ConnectionPanel({ forceExpanded = false }) {
  const { theme, t } = useTheme();
  const {
    isDesktopShell, sdkReady, connectStatus, reconnectCount, getDesktopTcpCapable,
    connection, setConnection, advancedConfig, setAdvancedConfig,
    showAdvanced, setShowAdvanced, configCollapsed, setConfigCollapsed,
    selectedPresetBroker, setSelectedPresetBroker,
    autoReconnect, setAutoReconnect, autoResubscribe, setAutoResubscribe, showRetained, setShowRetained,
    handleConnect, handleDisconnect, handleProtocolChange, handlePortChange,
    logViewMode, setLogViewMode,
  } = useMqtt();
  const { savedConfigs } = useAppData();
  const isCollapsed = forceExpanded ? false : configCollapsed;
  const {
    isTesting,
    probeResult,
    testConnection,
  } = useMqttConnectionProbe({
    advancedConfig,
    connection,
    isDesktopShell,
    mqtt: typeof window === 'undefined' ? null : window.mqtt,
    tcpCapable: getDesktopTcpCapable(),
  });

  const applyPresetBroker = (presetName) => {
    const preset = (PRESET_BROKERS || []).find((b) => b && b.name === presetName);
    if (!preset) return;
    setConnection((prev) => ({
      ...prev, name: preset.name, host: preset.host,
      protocol: 'wss', port: Number(preset.wss || 8084), path: String(preset.path || '/mqtt'),
    }));
  };

  const { handleSaveConfig, handleLoadConfig, handleDeleteConfig } = useSavedConfigActions();

  return (
    <div className="mb-3">
      <button
        onClick={forceExpanded ? undefined : () => setConfigCollapsed(!isCollapsed)}
        className={`w-full flex items-center justify-between px-4 py-3 ${t.card} ${t.cardHover} rounded-xl border transition-all group`}
      >
        <div className="flex items-center gap-2">
          <Server className={`w-4 h-4 ${t.text}`} />
          <span className={`text-sm font-medium ${t.textSecondary}`}>连接配置</span>
        </div>
        <div className="flex items-center gap-2">
          {connectStatus === 'connected' && <span className={`text-[10px] ${theme === 'light' ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/20 text-emerald-400'} px-2 py-0.5 rounded-full`}>在线</span>}
          {!forceExpanded && (isCollapsed ? <ChevronDown className={`w-4 h-4 ${t.textMuted}`}/> : <ChevronUp className={`w-4 h-4 ${t.textMuted}`}/>)}
        </div>
      </button>

      {!isCollapsed && (
        <div className={`mt-2 p-4 ${t.card} rounded-xl border space-y-3 animate-in fade-in slide-in-from-top-2 duration-200`}>
          <ConnectionConfigToolbar
            connectStatus={connectStatus}
            connectionName={connection.name}
            onDeleteConfig={() => handleDeleteConfig()}
            onLoadConfig={(e) => handleLoadConfig(e.target.value)}
            onPresetChange={(e) => {
              setSelectedPresetBroker(e.target.value);
              if (e.target.value) applyPresetBroker(e.target.value);
            }}
            onSaveConfig={handleSaveConfig}
            savedConfigs={savedConfigs}
            selectedPresetBroker={selectedPresetBroker}
            t={t}
          />

          <ConnectionFormFields
            connectStatus={connectStatus}
            connection={connection}
            handlePortChange={handlePortChange}
            handleProtocolChange={handleProtocolChange}
            isDesktopShell={isDesktopShell}
            setConnection={setConnection}
            t={t}
            theme={theme}
          />

          <div className="flex items-center justify-between gap-3">
            <div className={`flex items-center gap-2 text-xs ${t.textSecondary}`}>
              <Binary className="h-4 w-4" aria-hidden="true" />
              <span>接收消息显示</span>
            </div>
            <div className={`grid grid-cols-2 rounded-md border p-0.5 ${t.border} ${t.bgTertiary}`} role="group" aria-label="接收消息显示格式">
              {['text', 'hex'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={logViewMode === mode}
                  onClick={() => {
                    setLogViewMode(mode);
                    setConnection((current) => ({ ...current, logViewMode: mode }));
                  }}
                  className={`h-7 min-w-12 rounded px-2 text-xs font-medium transition-colors ${
                    logViewMode === mode
                      ? (theme === 'light' ? 'bg-black text-white' : 'bg-white text-black')
                      : t.textMuted
                  }`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <ConnectionAdvancedSection
            advancedConfig={advancedConfig}
            autoReconnect={autoReconnect}
            autoResubscribe={autoResubscribe}
            setAdvancedConfig={setAdvancedConfig}
            setAutoReconnect={setAutoReconnect}
            setAutoResubscribe={setAutoResubscribe}
            setShowAdvanced={setShowAdvanced}
            setShowRetained={setShowRetained}
            showAdvanced={showAdvanced}
            showRetained={showRetained}
            t={t}
          />

          <ConnectionProbeAction
            disabledReason={connectStatus === 'disconnected' ? '' : '请先断开正式连接'}
            isTesting={isTesting}
            onTest={testConnection}
            probeResult={probeResult}
            sdkReady={sdkReady}
            t={t}
            theme={theme}
          />

          <ConnectionActionButton
            connectStatus={connectStatus}
            handleConnect={handleConnect}
            handleDisconnect={handleDisconnect}
            reconnectCount={reconnectCount}
            sdkReady={sdkReady}
          />
        </div>
      )}
    </div>
  );
}
