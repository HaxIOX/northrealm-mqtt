/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useModal } from './ModalContext.jsx';
import { validateAndFixConfig } from '../utils/mqtt-helpers.js';
import {
  readLocalStorageJsonArray,
  readLocalStorageJsonObject,
  writeLocalStorageJson,
} from '../hooks/useLocalStorage.js';
import { isFirebaseAvailable, useAppCloudSyncState } from '../hooks/useAppCloudSyncState.js';
import {
  downloadJsonFile, buildBackupPayload, buildMessageLogsExportPayload,
  parseBackup, mergeConfigsByName, mergeActionsById,
  mergeSubscriptionsUnique, mergeMulticastTargetsByTopic,
} from '../utils/backup.js';

const AppDataContext = createContext(null);

export { isFirebaseAvailable };

export function AppDataProvider({ children, isDesktopShell, addLog }) {
  const { openConfirmModal } = useModal();
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [quickActions, setQuickActions] = useState([]);
  const savedConfigsRef = useRef(savedConfigs);
  savedConfigsRef.current = savedConfigs;
  const quickActionsRef = useRef(quickActions);
  quickActionsRef.current = quickActions;

  const [subscriptions, setSubscriptions] = useState([]);
  const lastSubscriptionsRef = useRef([]);

  const [multicastTargets, setMulticastTargets] = useState(() => readLocalStorageJsonArray('mqtt_multicast_targets', []) || []);
  const multicastTargetsRef = useRef(multicastTargets);
  multicastTargetsRef.current = multicastTargets;

  const [multicastSelectedIds, setMulticastSelectedIds] = useState(() => readLocalStorageJsonArray('mqtt_multicast_selected_ids', []) || []);

  const [recentActionIds, setRecentActionIds] = useState(() => readLocalStorageJsonArray('mqtt_recent_actions', []) || []);

  const [quickActionGroupCollapsed, setQuickActionGroupCollapsed] = useState(() => readLocalStorageJsonObject('mqtt_quick_action_group_collapsed', {}) || {});

  const backupImportInputRef = useRef(null);
  const {
    cloudCryptoError,
    handleConnectSync,
    handleDisconnectSync,
    inputSpaceId,
    isCloudConnected,
    rememberPassphrase,
    saveToCloud,
    setInputSpaceId,
    setRememberPassphrase,
    setShowSyncModal,
    setSyncEncryptEnabled,
    setSyncPassphrase,
    showSyncModal,
    syncEncryptEnabled,
    syncPassphrase,
    syncSpaceId,
    user,
  } = useAppCloudSyncState({
    addLog,
    isDesktopShell,
    lastSubscriptionsRef,
    multicastTargetsRef,
    quickActionsRef,
    savedConfigsRef,
    setMulticastTargets,
    setQuickActions,
    setSavedConfigs,
    setSubscriptions,
  });

  // --- localStorage persistence ---
  useEffect(() => {
    writeLocalStorageJson('mqtt_multicast_targets', multicastTargets || []);
  }, [multicastTargets]);
  useEffect(() => {
    writeLocalStorageJson('mqtt_multicast_selected_ids', multicastSelectedIds || []);
  }, [multicastSelectedIds]);
  useEffect(() => {
    writeLocalStorageJson('mqtt_quick_action_group_collapsed', quickActionGroupCollapsed || {});
  }, [quickActionGroupCollapsed]);

  // --- Init: load from localStorage ---
  useEffect(() => {
    const configs = readLocalStorageJsonArray('mqtt_configs');
    const actions = readLocalStorageJsonArray('mqtt_quick_actions');
    const subs = readLocalStorageJsonArray('mqtt_subscriptions');
    const targets = readLocalStorageJsonArray('mqtt_multicast_targets');
    const selectedTargetIds = readLocalStorageJsonArray('mqtt_multicast_selected_ids');

    if (configs) {
      const validatedConfigs = configs.map(c => validateAndFixConfig(c, isDesktopShell));
      setSavedConfigs(validatedConfigs);
      savedConfigsRef.current = validatedConfigs;
      if (JSON.stringify(configs) !== JSON.stringify(validatedConfigs)) {
        writeLocalStorageJson('mqtt_configs', validatedConfigs);
      }
    }
    if (actions) {
      setQuickActions(actions);
      quickActionsRef.current = actions;
    }
    if (subs) {
      setSubscriptions(subs);
      lastSubscriptionsRef.current = subs;
    }
    if (targets) {
      setMulticastTargets(targets);
      multicastTargetsRef.current = targets;
    }
    if (selectedTargetIds) setMulticastSelectedIds(selectedTargetIds);
  }, [isDesktopShell]);

  // --- Data operations ---
  const updateData = (type, newData) => {
    if (type === 'configs') {
      setSavedConfigs(newData);
      savedConfigsRef.current = newData;
      writeLocalStorageJson('mqtt_configs', newData);
      if (syncSpaceId) saveToCloud(newData, null, null);
    } else if (type === 'actions') {
      setQuickActions(newData);
      quickActionsRef.current = newData;
      writeLocalStorageJson('mqtt_quick_actions', newData);
      if (syncSpaceId) saveToCloud(null, newData, null);
    } else if (type === 'subscriptions') {
      setSubscriptions(newData);
      writeLocalStorageJson('mqtt_subscriptions', newData);
      lastSubscriptionsRef.current = newData;
      if (syncSpaceId) saveToCloud(null, null, newData);
    } else if (type === 'multicastTargets') {
      setMulticastTargets(newData);
      multicastTargetsRef.current = newData;
      writeLocalStorageJson('mqtt_multicast_targets', newData);
      if (syncSpaceId) saveToCloud(null, null, null, newData);
    }
  };

  const updateSubscriptions = (updater) => {
    setSubscriptions((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      writeLocalStorageJson('mqtt_subscriptions', next);
      lastSubscriptionsRef.current = next;
      if (syncSpaceId) saveToCloud(null, null, next);
      return next;
    });
  };

  // --- Quick action helpers ---
  const persistRecentActions = (next) => {
    writeLocalStorageJson('mqtt_recent_actions', next);
  };

  const recordRecentAction = (actionId) => {
    setRecentActionIds((prev) => {
      const next = [actionId, ...prev.filter((x) => x !== actionId)].slice(0, 20);
      persistRecentActions(next);
      return next;
    });
  };

  const toggleActionPinned = (actionId) => {
    const newActions = (quickActions || []).map((a) =>
      a.id === actionId ? { ...a, pinned: !a.pinned } : a
    );
    updateData('actions', newActions);
  };

  // --- Multicast helpers ---
  const normalizeMulticastTopic = (t) => String(t || '').trim();

  const getSelectedMulticastTopics = () => {
    const selected = new Set((multicastSelectedIds || []).map((x) => Number(x)));
    const topics = (multicastTargets || [])
      .filter((t) => selected.has(Number(t?.id)))
      .map((t) => String(t?.topic || '').trim())
      .filter(Boolean);
    const seen = new Set();
    const out = [];
    for (const t of topics) {
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  };

  const upsertMulticastTargetsFromTopics = (topics, opts = {}) => {
    const { selectAdded = true } = opts;
    const list = (topics || []).map(normalizeMulticastTopic).filter(Boolean);
    if (list.length === 0) return;

    const byTopic = new Map((multicastTargets || []).map((t) => [normalizeMulticastTopic(t?.topic), t]).filter(([k]) => k));
    const addedIds = [];
    const touchedIds = [];
    for (const topic of list) {
      const existing = byTopic.get(topic);
      if (existing) {
        touchedIds.push(Number(existing?.id));
        continue;
      }
      const id = Date.now() + Math.floor(Math.random() * 1000);
      byTopic.set(topic, { id, name: topic, topic });
      addedIds.push(id);
      touchedIds.push(Number(id));
    }

    if (addedIds.length > 0) {
      updateData('multicastTargets', Array.from(byTopic.values()));
      addLog('system', '', `已添加群发目标：${addedIds.length} 个`);
    }

    if (selectAdded && touchedIds.length > 0) {
      setMulticastSelectedIds((prev) => {
        const set = new Set((prev || []).map((x) => Number(x)));
        touchedIds.forEach((id) => { if (Number.isFinite(id)) set.add(Number(id)); });
        return Array.from(set);
      });
    }
  };

  const toggleMulticastTargetSelected = (id) => {
    const n = Number(id);
    if (!Number.isFinite(n)) return;
    setMulticastSelectedIds((prev) => {
      const set = new Set((prev || []).map((x) => Number(x)));
      if (set.has(n)) set.delete(n); else set.add(n);
      return Array.from(set);
    });
  };

  const selectAllMulticastTargets = () => {
    const ids = (multicastTargets || []).map((t) => Number(t?.id)).filter((x) => Number.isFinite(x));
    setMulticastSelectedIds(Array.from(new Set(ids)));
  };

  const clearMulticastSelection = () => setMulticastSelectedIds([]);

  // --- Backup/Export ---
  const handleExportBackup = (includePasswords = false) => {
    try {
      const payload = buildBackupPayload(savedConfigs, quickActions, subscriptions, multicastTargets, includePasswords);
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      downloadJsonFile(payload, `mqtt-pro-backup-${ts}.json`);
      addLog('system', '', includePasswords ? '已导出配置备份（包含密码）' : '已导出配置备份（不包含密码）');
    } catch (e) {
      addLog('error', '', `导出失败: ${String(e?.message || e)}`);
    }
  };

  const handleImportBackupFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const data = parseBackup(parsed);
      if (!data) throw new Error('文件格式不正确（不是 Northrealm 备份）');

      openConfirmModal('确认导入备份？（同名配置会覆盖，本地数据会合并）', () => {
        if (Array.isArray(data.configs)) updateData('configs', mergeConfigsByName(savedConfigs, data.configs));
        if (Array.isArray(data.actions)) updateData('actions', mergeActionsById(quickActions, data.actions));
        if (Array.isArray(data.subscriptions)) updateData('subscriptions', mergeSubscriptionsUnique(subscriptions, data.subscriptions));
        if (Array.isArray(data.multicastTargets)) updateData('multicastTargets', mergeMulticastTargetsByTopic(multicastTargets, data.multicastTargets));
        addLog('system', '', '备份导入完成');
      }, { confirmText: '确认导入', confirmVariant: 'primary' });
    } catch (err) {
      addLog('error', '', `导入失败: ${String(err?.message || err)}`);
    }
  };

  const exportMessageLogs = (scope, messageLogs, filteredMessageLogs, logTopicFilters, logFilter) => {
    try {
      const exportLogs = scope === 'all' ? messageLogs : filteredMessageLogs;
      const payload = buildMessageLogsExportPayload(scope, exportLogs, logTopicFilters, logFilter);
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = scope === 'all'
        ? `mqtt-pro-message-logs-all-${ts}.json`
        : `mqtt-pro-message-logs-filtered-${ts}.json`;
      downloadJsonFile(payload, filename);
      addLog('system', '', `已导出消息日志（${scope === 'all' ? '全部' : '筛选后'}，${payload.count} 条）`);
    } catch (e) {
      addLog('error', '', `导出失败: ${String(e?.message || e)}`);
    }
  };

  const value = {
    isFirebaseAvailable,
    user, syncSpaceId, inputSpaceId, setInputSpaceId,
    isCloudConnected, showSyncModal, setShowSyncModal,
    syncEncryptEnabled, setSyncEncryptEnabled,
    syncPassphrase, setSyncPassphrase,
    rememberPassphrase, setRememberPassphrase,
    cloudCryptoError,
    savedConfigs, quickActions, subscriptions, lastSubscriptionsRef,
    multicastTargets, multicastSelectedIds,
    recentActionIds, quickActionGroupCollapsed, setQuickActionGroupCollapsed,
    backupImportInputRef,
    updateData, updateSubscriptions,
    recordRecentAction, toggleActionPinned,
    getSelectedMulticastTopics, upsertMulticastTargetsFromTopics,
    toggleMulticastTargetSelected, selectAllMulticastTargets, clearMulticastSelection,
    setMulticastSelectedIds,
    handleConnectSync, handleDisconnectSync,
    handleExportBackup, handleImportBackupFileChange, exportMessageLogs,
  };

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
