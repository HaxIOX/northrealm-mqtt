import React, { useRef, useState } from 'react';
import { Binary, ChevronDown, ChevronUp, FileText, Moon, Plus, Save, SunDim, Trash2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useMqtt } from '../../contexts/MqttContext.jsx';
import { useAppData } from '../../contexts/AppDataContext.jsx';
import { useSavedConfigActions } from '../../hooks/useSavedConfigActions.js';
import { useMqttConnectionProbe } from '../../hooks/useMqttConnectionProbe.js';
import { formatDuration } from '../../utils/formatters.js';
import ConnectionActionButton from '../connection-panel/ConnectionActionButton.jsx';
import ConnectionAdvancedSection from '../connection-panel/ConnectionAdvancedSection.jsx';
import ConnectionProbeAction from '../connection-panel/ConnectionProbeAction.jsx';
import ConfigPicker from './ConfigPicker.jsx';

// 桌面端侧栏（v0.1.15 Windows 版外观）：窄栏、订阅主题、选择配置下拉、无收发计数。
export default function DesktopSidebar({ open = true }) {
  const { theme, t, toggleTheme } = useTheme();
  const {
    isDesktopShell, sdkReady, client, getDesktopTcpCapable,
    connectStatus, connectDuration, reconnectCount,
    connection, setConnection, advancedConfig, setAdvancedConfig,
    showAdvanced, setShowAdvanced, configCollapsed, setConfigCollapsed,
    autoReconnect, setAutoReconnect, autoResubscribe, setAutoResubscribe, showRetained, setShowRetained,
    handleConnect, handleDisconnect, handleProtocolChange, handlePortChange,
    subTopic, setSubTopic, subscriptionsCollapsed, setSubscriptionsCollapsed,
    handleSubscribe, handleUnsubscribe, logTopicFilters, toggleLogTopicFilter, clearLogTopicFilters,
    logViewMode, setLogViewMode,
  } = useMqtt();
  const { savedConfigs, subscriptions, setShowSyncModal } = useAppData();
  const { handleSaveConfig, handleLoadConfig, handleDeleteConfig } = useSavedConfigActions();
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const subTopicInputRef = useRef(null);
  const { isTesting, probeResult, testConnection } = useMqttConnectionProbe({
    advancedConfig,
    connection,
    isDesktopShell,
    mqtt: typeof window === 'undefined' ? null : window.mqtt,
    tcpCapable: getDesktopTcpCapable(),
  });

  const isConnected = connectStatus === 'connected';
  const configCollapsedNow = configCollapsed;
  const chevronCls = 'text-slate-600 group-hover:text-slate-800 dark:group-hover:text-slate-300 transition-colors';
  const sectionTitleCls = 'flex items-center gap-2 font-bold text-[13px] text-[#333D4F] dark:text-[#E6EDF3]';
  const subscribeNow = () => { handleSubscribe(); setNewTopicOpen(false); };

  return (
    <aside className={`app-sidebar ${open ? 'w-[280px]' : 'w-0 opacity-0'} ${t.bgSecondary} border-r ${t.borderLight} flex flex-col shrink-0 transition-all duration-300 overflow-hidden z-20`}>
      <div className="h-16 px-4 flex items-center justify-between shrink-0 min-w-[280px]">
        <div className="flex items-center gap-3">
          {/* 32px 像素对齐设计，须保持 w-8 h-8（1:1 渲染），与 scripts/gen-icon.cjs 的 32px 帧一致 */}
          <svg viewBox="0 0 32 32" className="w-8 h-8 text-brand-500" aria-hidden="true">
            <path d="M3.5 20.5 H11 L14.5 5.5 L18 27 L21 20.5 H28.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className={`font-bold text-base tracking-tight ${theme === 'light' ? 'text-gray-800' : 'text-gray-100'}`}>NRmqtt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSyncModal(true)}
            className={`p-1.5 rounded-lg ${t.textMuted} ${t.bgHover} transition-colors`}
            title="备份与导入"
            aria-label="备份与导入"
          >
            <FileText size={16} />
          </button>
          <button
            onClick={toggleTheme}
            className={`relative w-11 h-6 rounded-full transition-colors duration-300 border ${
              theme === 'dark' ? 'bg-brand-500/20 border-brand-500/40' : 'bg-gray-200 border-gray-300'
            }`}
            title={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm flex items-center justify-center transition-transform duration-300 ${
                theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
              }`}
            >
              {theme === 'dark' ? <SunDim size={13} className="text-slate-400" /> : <Moon size={13} className="text-slate-500" />}
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-2 space-y-4 min-w-[280px]">
        {/* 连接状态行 */}
        <div className={`flex items-center gap-2 px-3 py-2 ${t.floatingPanel}`}>
          <span className="relative inline-flex h-2 w-2 shrink-0">
            {connectStatus !== 'disconnected' && <span className={`absolute inline-flex h-full w-full rounded-full opacity-50 animate-ping ${isConnected ? 'bg-[#06D6A0]' : 'bg-[#FFD166]'}`}></span>}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-[#06D6A0]' : connectStatus === 'connecting' ? 'bg-[#FFD166]' : 'bg-[#EF476F]'}`}></span>
          </span>
          <span className="text-[12px] font-mono font-medium text-slate-700 dark:text-slate-300 truncate" title={`${connection.protocol}://${connection.host}`}>
            {connectStatus === 'disconnected' ? '未连接' : `${connection.protocol}://${connection.host}`}
          </span>
          {isConnected && (
            <span className="ml-auto text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">{formatDuration(connectDuration)}</span>
          )}
          {reconnectCount > 0 && !isConnected && (
            <span className="ml-auto text-[11px] font-mono text-[#FFD166] shrink-0">重连×{reconnectCount}</span>
          )}
        </div>

        {/* 连接配置 */}
        <section className="space-y-2">
          <div className="mb-2">
            <button
              onClick={() => setConfigCollapsed(!configCollapsedNow)}
              className="w-full flex items-center justify-between group py-1.5 mb-1"
            >
              <div className={sectionTitleCls}><span>连接配置</span></div>
              {configCollapsedNow ? <ChevronDown size={16} className={chevronCls} /> : <ChevronUp size={16} className={chevronCls} />}
            </button>

            {!configCollapsedNow && (
              <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className={`flex items-center ${t.bgInput} border ${t.border} rounded-lg focus-within:ring-2 focus-within:ring-brand-500/30 focus-within:border-brand-500 transition-all overflow-hidden`}>
                  <select
                    value={connection.protocol}
                    onChange={(e) => handleProtocolChange(e.target.value)}
                    disabled={isConnected}
                    aria-label="协议"
                    className="bg-transparent text-[13px] text-slate-700 dark:text-slate-300 outline-none pl-2.5 pr-1 py-2 font-bold cursor-pointer border-r border-gray-300/50 dark:border-white/10 shrink-0"
                  >
                    <option value="mqtt" disabled={!isDesktopShell}>mqtt</option>
                    <option value="mqtts" disabled={!isDesktopShell}>mqtts</option>
                    <option value="ws">ws</option>
                    <option value="wss">wss</option>
                  </select>
                  <input
                    type="text"
                    value={connection.host}
                    onChange={(e) => setConnection({ ...connection, host: e.target.value })}
                    disabled={isConnected}
                    aria-label="主机"
                    className="flex-1 min-w-0 w-full bg-transparent text-[13px] px-2.5 py-2 outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400 font-medium"
                    placeholder="broker.emqx.io"
                  />
                  <input
                    type="number"
                    value={connection.port}
                    onChange={(e) => handlePortChange(e.target.value)}
                    disabled={isConnected}
                    aria-label="端口"
                    className="w-14 shrink-0 bg-transparent text-[13px] font-mono px-1 py-2 outline-none text-gray-800 dark:text-gray-200 border-l border-gray-300/50 dark:border-white/10 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="1883"
                  />
                </div>

                {connection.protocol === 'wss' && (
                  <div className={`text-xs px-3 py-2 rounded-lg border ${theme === 'light' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-amber-400/80 bg-amber-500/10 border-amber-500/20'}`}>
                    提示: 如果服务器没有 SSL 证书，请使用 ws://
                  </div>
                )}

                {(connection.protocol === 'ws' || connection.protocol === 'wss') && (
                  <input
                    type="text"
                    value={connection.path}
                    onChange={(e) => setConnection({ ...connection, path: e.target.value })}
                    disabled={isConnected}
                    aria-label="Path"
                    placeholder="Path，如 /mqtt"
                    className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-[13px] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all disabled:opacity-50 ${t.text}`}
                  />
                )}

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={connection.username}
                    onChange={(e) => setConnection({ ...connection, username: e.target.value })}
                    disabled={isConnected}
                    placeholder="用户名"
                    className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-[13px] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all disabled:opacity-50 ${t.text}`}
                  />
                  <input
                    type="password"
                    value={connection.password}
                    onChange={(e) => setConnection({ ...connection, password: e.target.value })}
                    disabled={isConnected}
                    placeholder="密码"
                    className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-[13px] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all disabled:opacity-50 ${t.text}`}
                  />
                </div>

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
                          logViewMode === mode ? 'bg-brand-500 text-white' : t.textMuted
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

                <div className="flex gap-2">
                  <ConfigPicker
                    configs={savedConfigs}
                    currentName={connection.name}
                    onSelect={(c) => handleLoadConfig(c.name)}
                    onDelete={handleDeleteConfig}
                    t={t}
                    theme={theme}
                  />
                  <button
                    onClick={handleSaveConfig}
                    title="保存当前配置"
                    aria-label="保存当前配置"
                    className={`p-2 ${t.bgTertiary} ${t.bgHover} border ${t.border} rounded-lg ${t.textMuted} hover:text-brand-500 transition-colors`}
                  >
                    <Save className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 订阅主题 */}
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setSubscriptionsCollapsed(!subscriptionsCollapsed)}
              className="w-full flex items-center justify-between group py-1.5 mb-1"
              title={subscriptionsCollapsed ? '展开订阅列表' : '收起订阅列表'}
            >
              <div className={sectionTitleCls}><span>订阅主题</span></div>
              {subscriptionsCollapsed ? <ChevronDown size={16} className={chevronCls} /> : <ChevronUp size={16} className={chevronCls} />}
            </button>

            {/* New Topic 放在最上面，折叠订阅列表时也可见；输入框就地替换按钮 */}
            <div className="mt-1">
              {newTopicOpen ? (
                <div
                  className="animate-in fade-in duration-150"
                  onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setNewTopicOpen(false); }}
                >
                  <div className={`flex items-center ${t.bgInput} border ${t.border} rounded-lg overflow-hidden focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all`}>
                    <input
                      ref={subTopicInputRef}
                      type="text"
                      placeholder="Topic，如 # 或 a/b/+"
                      aria-label="订阅 Topic"
                      value={subTopic}
                      onChange={(e) => setSubTopic(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') subscribeNow();
                        else if (e.key === 'Escape') setNewTopicOpen(false);
                      }}
                      className={`flex-1 min-w-0 bg-transparent px-2.5 py-2 text-xs font-mono outline-none ${t.text}`}
                    />
                    <button
                      onClick={subscribeNow}
                      disabled={!client?.connected}
                      className="shrink-0 bg-brand-500 hover:bg-brand-600 text-white px-3 py-2 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      订阅
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setNewTopicOpen(true); setTimeout(() => subTopicInputRef.current?.focus(), 0); }}
                  className="w-full py-2.5 border-2 border-dashed border-brand-500/30 dark:border-brand-300/30 rounded-xl text-[12px] font-bold text-brand-500 dark:text-brand-300 hover:bg-brand-500/10 dark:hover:bg-brand-300/10 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={15} strokeWidth={2.5} /> New Topic
                </button>
              )}
            </div>

            {!subscriptionsCollapsed && (
              <div className="space-y-1 px-2 mt-3">
                {logTopicFilters.length > 0 && (
                  <button
                    type="button"
                    onClick={clearLogTopicFilters}
                    className={`text-[11px] ${t.textMuted} hover:text-brand-500 transition-colors mb-1 px-1`}
                  >
                    清除筛选（已选 {logTopicFilters.length}）
                  </button>
                )}
                {subscriptions.map((sub) => {
                  const isSelected = logTopicFilters.includes(sub);
                  return (
                    <div
                      key={sub}
                      onClick={() => toggleLogTopicFilter(sub)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl border group transition-all cursor-pointer ${
                        isSelected
                          ? (theme === 'light' ? 'bg-brand-50/80 border-brand-300' : 'bg-brand-500/10 border-brand-500/30')
                          : 'bg-white/50 dark:bg-[#1C2128]/50 border-[#E1E4E8]/50 dark:border-[#30363D]/50 hover:bg-white dark:hover:bg-[#1C2128]'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSelected ? 'bg-brand-500 shadow-[0_0_8px_rgba(91,141,239,0.5)]' : 'bg-brand-500/40'}`}></span>
                        <span className={`text-[12px] font-mono truncate ${isSelected ? 'text-brand-500 dark:text-brand-300 font-semibold' : 'text-[#333D4F] dark:text-[#E6EDF3]'}`} title={sub}>{sub}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleUnsubscribe(sub); }}
                        className={`${t.textMuted} hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity`}
                        title="取消订阅"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
                {subscriptions.length === 0 && <div className={`text-xs ${t.textMuted} text-center py-4 border border-dashed ${t.border} rounded-xl`}>暂无订阅</div>}
              </div>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
