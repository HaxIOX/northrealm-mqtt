/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { parseTopicList } from '../utils/mqtt-helpers.js';
import {
  readLocalStorageFlag,
  useLocalStorageFlag,
} from '../hooks/useLocalStorage.js';
import { useMqttConnectionState } from '../hooks/useMqttConnectionState.js';
import { useMqttLogState } from '../hooks/useMqttLogState.js';
import { useMqttPublishWorkspace } from '../hooks/useMqttPublishWorkspace.js';
import { useAppData } from './AppDataContext.jsx';

const MqttContext = createContext(null);

export function MqttProvider({ children }) {
  const isDevMode = (() => {
    try { if (import.meta?.env?.DEV) return true; } catch { /* ignore */ }
    return readLocalStorageFlag('mqtt_dev_mode', false);
  })();

  const { updateSubscriptions, lastSubscriptionsRef } = useAppData();

  const [autoReconnect, setAutoReconnect] = useLocalStorageFlag('mqtt_auto_reconnect', true);
  const [autoResubscribe, setAutoResubscribe] = useState(true);
  const [showRetained, setShowRetained] = useLocalStorageFlag('mqtt_show_retained', false);

  const lastManualPublishRef = useRef({ at: 0, topic: '', payload: '', qos: 0, retain: false });
  const recentInboundRef = useRef(new Map());
  const manualDisconnectRef = useRef(null);
  const handleConnectRef = useRef(null);
  const handleDisconnectRef = useRef(null);
  const handlePublishRef = useRef(null);

  const [subTopic, setSubTopic] = useState('test/topic');
  const [subscriptionsCollapsed, setSubscriptionsCollapsed] = useState(true);

  const {
    logs, setLogs,
    logFilter, setLogFilter, logTopicFilters, setLogTopicFilters,
    isAutoScroll, setIsAutoScroll, logViewMode, setLogViewMode,
    logsEndRef,
    debugPacketLog, setDebugPacketLog, debugPacketLogRef,
    eventCenterOpen, setEventCenterOpen, eventFilter, setEventFilter,
    msgStats,
    logExportMenuOpen, setLogExportMenuOpen, logExportMenuRef, logExportButtonRef,
    addLog, clearLogsAndStats, resetStats,
    toggleLogTopicFilter, clearLogTopicFilters,
    messageLogs, eventLogs, filteredMessageLogs, filteredEventLogs,
  } = useMqttLogState({ isDevMode });

  const showRetainedRef = useRef(showRetained);
  useEffect(() => {
    showRetainedRef.current = showRetained;
  }, [showRetained]);

  const shouldDropDuplicateManualPublish = (topic, payload, qos, retain) => {
    const now = Date.now();
    const last = lastManualPublishRef.current;
    if (last && now - last.at < 80 && last.topic === topic && last.payload === payload && last.qos === qos && last.retain === retain) {
      return true;
    }

    lastManualPublishRef.current = { at: now, topic, payload, qos, retain };
    return false;
  };

  const shouldDropDuplicateInbound = (topic, payload, packet) => {
    if (!packet || packet.dup !== true) return false;

    const now = Date.now();
    const mid = packet.messageId ?? packet.message_id ?? packet.mid ?? null;
    const key = mid != null ? `${topic}|mid:${String(mid)}` : `${topic}|payload:${payload}`;
    const seenAt = recentInboundRef.current.get(key);
    if (typeof seenAt === 'number' && now - seenAt < 60_000) return true;

    recentInboundRef.current.set(key, now);
    if (recentInboundRef.current.size > 2000) {
      for (const [existingKey, seenTime] of recentInboundRef.current.entries()) {
        if (now - seenTime > 120_000) recentInboundRef.current.delete(existingKey);
      }
    }

    return false;
  };

  const {
    runtime,
    isElectronRuntime,
    isDesktopShell,
    getDesktopTcpCapable,
    client,
    connectStatus,
    sdkReady,
    connectDuration,
    reconnectCount,
    isRecovering,
    lastConnectionError,
    lastDisconnectedAt,
    manuallyStopped,
    connection,
    setConnection,
    advancedConfig,
    setAdvancedConfig,
    showAdvanced,
    setShowAdvanced,
    configCollapsed,
    setConfigCollapsed,
    selectedPresetBroker,
    setSelectedPresetBroker,
    handleConnect: handleConnectCore,
    handleDisconnect: handleDisconnectCore,
    handleProtocolChange,
    handlePortChange,
  } = useMqttConnectionState({
    addLog,
    autoReconnect,
    autoResubscribe,
    debugPacketLogRef,
    isDevMode,
    lastSubscriptionsRef,
    manualDisconnectRef,
    onMessage: (topic, payload, packet) => {
      addLog('received', topic, payload, packet?.retain ? '⚠️ Retained' : '');
    },
    showRetainedRef,
    shouldDropDuplicateInbound,
  });

  const {
    commonActionsContainerRef,
    handlePublish,
    maxCommonActions,
    multicastQuery,
    openPublishEditor,
    pendingTemplateAction,
    pubMessage,
    pubQoS,
    pubRetain,
    pubTopic,
    pubTopicCursorPos,
    pubTopicFocusTrigger,
    publishEditorOpen,
    publishEditorValue,
    quickActionQuery,
    setMulticastQuery,
    setPendingTemplateAction,
    setPubMessage,
    setPubQoS,
    setPubRetain,
    setPubTopic,
    setPubTopicCursorPos,
    setPubTopicFocusTrigger,
    setPublishEditorOpen,
    setPublishEditorValue,
    setQuickActionQuery,
    setShowMulticastPanel,
    setShowQuickActionsPanel,
    setTimerIntervalInput,
    showMulticastPanel,
    showQuickActionsPanel,
    stopTimer,
    syncTimerIntervalFromInput,
    timerEnabled,
    timerInterval,
    timerIntervalInput,
    toggleTimer,
  } = useMqttPublishWorkspace({ client, addLog, shouldDropDuplicateManualPublish });

  const handleConnect = () => {
    handleConnectCore();
  };

  const handleDisconnect = () => {
    lastSubscriptionsRef.current = [...lastSubscriptionsRef.current];
    stopTimer();
    handleDisconnectCore();
  };

  const handleSubscribe = () => {
    const topic = String(subTopic || '').trim();
    const currentSubs = lastSubscriptionsRef.current;
    if (client?.connected && topic && !currentSubs.includes(topic)) {
      client.subscribe(topic, (error) => {
        if (!error) {
          updateSubscriptions((prev) => (prev.includes(topic) ? prev : [...prev, topic]));
          setLogTopicFilters((prev) => (prev.includes(topic) ? prev : [...prev, topic]));
          addLog('system', topic, '订阅成功');
        } else {
          addLog('error', topic, '订阅失败');
        }
      });
    }
  };

  const handleUnsubscribe = (rawTopic) => {
    const topic = String(rawTopic || '').trim();
    if (!topic) return;

    const removeLocalSubscription = () => {
      updateSubscriptions((prev) => prev.filter((item) => item !== topic));
      setLogTopicFilters((prev) => prev.filter((item) => item !== topic));
    };

    if (!client?.connected) {
      removeLocalSubscription();
      addLog('system', topic, '已从订阅列表移除（未连接）');
      return;
    }

    client.unsubscribe(topic, (error) => {
      if (!error) {
        removeLocalSubscription();
        addLog('system', topic, '退订成功');
      } else {
        addLog('error', topic, '退订失败');
      }
    });
  };

  useEffect(() => {
    handleConnectRef.current = handleConnect;
    handleDisconnectRef.current = handleDisconnect;
    handlePublishRef.current = handlePublish;
  });

  useEffect(() => {
    if (isAutoScroll) logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isAutoScroll, logs, logsEndRef]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (eventCenterOpen && e.key === 'Escape') {
        e.preventDefault();
        setEventCenterOpen(false);
        return;
      }
      if (showQuickActionsPanel && e.key === 'Escape') {
        e.preventDefault();
        setShowQuickActionsPanel(false);
        setQuickActionQuery('');
        return;
      }
      if (showMulticastPanel && e.key === 'Escape') {
        e.preventDefault();
        setShowMulticastPanel(false);
        setMulticastQuery('');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handlePublishRef.current?.();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (connectStatus === 'connected') handleDisconnectRef.current?.();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        clearLogsAndStats();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (connectStatus === 'connected') handleDisconnectRef.current?.();
        else if (connectStatus === 'connecting') handleDisconnectRef.current?.();
        else if (reconnectCount > 0) handleDisconnectRef.current?.();
        else if (connectStatus !== 'connecting') handleConnectRef.current?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    clearLogsAndStats,
    connectStatus,
    eventCenterOpen,
    reconnectCount,
    setEventCenterOpen,
    setMulticastQuery,
    setQuickActionQuery,
    setShowMulticastPanel,
    setShowQuickActionsPanel,
    showMulticastPanel,
    showQuickActionsPanel,
  ]);

  const value = {
    runtime, isElectronRuntime, isDesktopShell, isDevMode, getDesktopTcpCapable,
    client, connectStatus, sdkReady, connectDuration, reconnectCount,
    isRecovering, lastConnectionError, lastDisconnectedAt, manuallyStopped,
    autoReconnect, setAutoReconnect, autoResubscribe, setAutoResubscribe, showRetained, setShowRetained,
    connection, setConnection, advancedConfig, setAdvancedConfig,
    showAdvanced, setShowAdvanced, configCollapsed, setConfigCollapsed,
    selectedPresetBroker, setSelectedPresetBroker,
    subTopic, setSubTopic, subscriptionsCollapsed, setSubscriptionsCollapsed,
    pubTopic, setPubTopic, pubMessage, setPubMessage, pubQoS, setPubQoS, pubRetain, setPubRetain,
    logs, setLogs, logFilter, setLogFilter, logTopicFilters, setLogTopicFilters,
    isAutoScroll, setIsAutoScroll, logViewMode, setLogViewMode,
    logsEndRef, debugPacketLog, setDebugPacketLog,
    eventCenterOpen, setEventCenterOpen, eventFilter, setEventFilter,
    msgStats, timerEnabled, timerInterval, timerIntervalInput, setTimerIntervalInput,
    publishEditorOpen, setPublishEditorOpen, publishEditorValue, setPublishEditorValue,
    showQuickActionsPanel, setShowQuickActionsPanel, quickActionQuery, setQuickActionQuery,
    pendingTemplateAction, setPendingTemplateAction,
    pubTopicFocusTrigger, setPubTopicFocusTrigger, pubTopicCursorPos, setPubTopicCursorPos,
    showMulticastPanel, setShowMulticastPanel, multicastQuery, setMulticastQuery,
    maxCommonActions, commonActionsContainerRef,
    logExportMenuOpen, setLogExportMenuOpen, logExportMenuRef, logExportButtonRef,
    addLog, handleConnect, handleDisconnect,
    handleSubscribe, handleUnsubscribe,
    handlePublish, handleProtocolChange, handlePortChange,
    toggleTimer, syncTimerIntervalFromInput, resetStats,
    toggleLogTopicFilter, clearLogTopicFilters,
    messageLogs, eventLogs, filteredMessageLogs, filteredEventLogs,
    openPublishEditor,
    shouldDropDuplicateManualPublish, parseTopicList,
  };

  return (
    <MqttContext.Provider value={value}>
      {children}
    </MqttContext.Provider>
  );
}

export function useMqtt() {
  const ctx = useContext(MqttContext);
  if (!ctx) throw new Error('useMqtt must be used within MqttProvider');
  return ctx;
}
