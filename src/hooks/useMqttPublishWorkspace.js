import { useEffect, useRef, useState } from 'react';
import { parseTopicList } from '../utils/mqtt-helpers.js';

export function useMqttPublishWorkspace({ client, addLog, shouldDropDuplicateManualPublish }) {
  const [pubTopic, setPubTopic] = useState('test/topic');
  const [pubMessage, setPubMessage] = useState('{"msg": "Hello MQTT"}');
  const [pubQoS, setPubQoS] = useState(0);
  const [pubRetain, setPubRetain] = useState(false);

  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerInterval, setTimerInterval] = useState(1000);
  const [timerIntervalInput, setTimerIntervalInput] = useState('1000');
  const timerRef = useRef(null);

  const [publishEditorOpen, setPublishEditorOpen] = useState(false);
  const [publishEditorValue, setPublishEditorValue] = useState('');

  const [showQuickActionsPanel, setShowQuickActionsPanel] = useState(false);
  const [quickActionQuery, setQuickActionQuery] = useState('');
  const [pendingTemplateAction, setPendingTemplateAction] = useState(null);
  const [pubTopicFocusTrigger, setPubTopicFocusTrigger] = useState(0);
  const [pubTopicCursorPos, setPubTopicCursorPos] = useState(-1);

  const [showMulticastPanel, setShowMulticastPanel] = useState(false);
  const [multicastQuery, setMulticastQuery] = useState('');

  const [maxCommonActions, setMaxCommonActions] = useState(6);
  const commonActionsContainerRef = useRef(null);

  useEffect(() => {
    const container = commonActionsContainerRef.current;
    if (!container) return;

    const updateMaxActions = () => {
      const containerWidth = container.offsetWidth;
      const availableWidth = containerWidth - 60 - 16;
      const buttonWidth = 100 + 8;
      const maxButtons = Math.floor(availableWidth / buttonWidth);
      setMaxCommonActions(Math.max(3, Math.min(6, maxButtons)));
    };

    updateMaxActions();
    const resizeObserver = new ResizeObserver(updateMaxActions);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const handlePublish = (options = {}) => {
    const onSuccess = typeof options?.onSuccess === 'function' ? options.onSuccess : null;
    const onError = typeof options?.onError === 'function' ? options.onError : null;
    if (!client?.connected) {
      addLog('error', '', '请先连接');
      onError?.(new Error('MQTT client is disconnected'));
      return false;
    }

    const topics = parseTopicList(pubTopic);
    if (topics.length === 0) {
      addLog('error', '', '请输入 Topic');
      onError?.(new Error('Topic is required'));
      return false;
    }

    const parsedMessage = pubMessage;
    const topicKey = topics.length === 1 ? topics[0] : topics.join('|');
    if (shouldDropDuplicateManualPublish(topicKey, parsedMessage, pubQoS, pubRetain)) return false;

    if (topics.length > 1) {
      addLog('system', '', `群发: ${topics.length} 个 Topic（QoS ${pubQoS}${pubRetain ? ' · Retain' : ''}）`);
    }

    let pendingCount = topics.length;
    let failed = false;
    topics.forEach((topic) => {
      client.publish(topic, parsedMessage, { qos: pubQoS, retain: pubRetain }, (err) => {
        if (err) {
          failed = true;
          addLog('error', topic, err.message);
          onError?.(err);
        } else {
          addLog('sent', topic, parsedMessage, `QoS: ${pubQoS}`);
        }
        pendingCount -= 1;
        if (pendingCount === 0 && !failed) onSuccess?.();
      });
    });
    return true;
  };

  const normalizeTimerIntervalMs = (raw) => {
    const value = String(raw ?? '').trim();
    if (!value) return null;

    for (let i = 0; i < value.length; i += 1) {
      if (value[i] < '0' || value[i] > '9') return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(100, Math.floor(parsed));
  };

  const syncTimerIntervalFromInput = () => {
    const normalized = normalizeTimerIntervalMs(timerIntervalInput);
    if (normalized == null) {
      setTimerIntervalInput(String(timerInterval));
      return timerInterval;
    }

    setTimerInterval(normalized);
    setTimerIntervalInput(String(normalized));
    return normalized;
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setTimerEnabled(false);
  };

  const toggleTimer = () => {
    if (timerEnabled) {
      stopTimer();
      addLog('system', '', '定时发送已停止');
      return;
    }

    if (!client?.connected) return addLog('error', '', '请先连接服务器');

    const topics = parseTopicList(pubTopic);
    if (topics.length === 0) return addLog('error', '', '请输入 Topic');

    const intervalMs = syncTimerIntervalFromInput();
    setTimerEnabled(true);
    addLog('system', '', `定时发送已启动，间隔 ${intervalMs}ms${topics.length > 1 ? `（${topics.length} 个 Topic）` : ''}`);
    timerRef.current = setInterval(() => {
      topics.forEach((topic) => {
        client.publish(topic, pubMessage, { qos: pubQoS, retain: pubRetain }, (err) => {
          if (err) addLog('error', topic, err.message);
          else addLog('sent', topic, pubMessage, `定时发送 QoS: ${pubQoS}`);
        });
      });
    }, intervalMs);
  };

  const openPublishEditor = () => {
    setPublishEditorValue(pubMessage);
    setPublishEditorOpen(true);
  };

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return {
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
  };
}
