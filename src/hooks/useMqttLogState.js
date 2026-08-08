import { useEffect, useMemo, useRef, useState } from 'react';
import { topicMatchesFilter } from '../utils/mqtt-helpers.js';
import { appendBoundedMqttLog, isMessageLog } from '../utils/mqtt-log-limits.js';
import {
  readLocalStorageJsonArray,
  useLocalStorageFlag,
  writeLocalStorageJson,
} from './useLocalStorage.js';

const INITIAL_MSG_STATS = { sent: 0, received: 0, errors: 0 };

export function useMqttLogState({ isDevMode }) {
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('');
  const [logTopicFilters, setLogTopicFilters] = useState(() => (
    (readLocalStorageJsonArray('mqtt_log_topic_filters', []) || [])
      .filter((s) => typeof s === 'string' && s.trim())
  ));
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [logViewMode, setLogViewMode] = useState('text');
  const logsEndRef = useRef(null);
  const logIdRef = useRef(0);

  const [debugPacketLog, setDebugPacketLog] = useLocalStorageFlag('mqtt_debug_packet_log', false);
  const debugPacketLogRef = useRef(debugPacketLog);
  useEffect(() => { debugPacketLogRef.current = debugPacketLog; }, [debugPacketLog]);

  const [eventCenterOpen, setEventCenterOpen] = useState(false);
  const [eventFilter, setEventFilter] = useState('');
  const [msgStats, setMsgStats] = useState(INITIAL_MSG_STATS);

  const [logExportMenuOpen, setLogExportMenuOpen] = useState(false);
  const logExportMenuRef = useRef(null);
  const logExportButtonRef = useRef(null);

  const lastLogRef = useRef(null);

  useEffect(() => {
    writeLocalStorageJson('mqtt_log_topic_filters', logTopicFilters);
  }, [logTopicFilters]);

  useEffect(() => {
    if (!logExportMenuOpen) return;

    const onMouseDown = (e) => {
      const menuEl = logExportMenuRef.current;
      const btnEl = logExportButtonRef.current;
      if (menuEl && menuEl.contains(e.target)) return;
      if (btnEl && btnEl.contains(e.target)) return;
      setLogExportMenuOpen(false);
    };

    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [logExportMenuOpen]);

  const addLog = (type, topic, payload, details = '') => {
    const now = Date.now();
    const last = lastLogRef.current;
    const windowMs = type === 'received' ? 1500 : 200;
    if (last && now - last.at < windowMs && last.type === type && last.topic === topic && last.payload === payload && last.details === details) return;
    lastLogRef.current = { at: now, type, topic, payload, details };

    setMsgStats((prev) => ({
      sent: type === 'sent' ? prev.sent + 1 : prev.sent,
      received: type === 'received' ? prev.received + 1 : prev.received,
      errors: type === 'error' ? prev.errors + 1 : prev.errors,
    }));

    setLogs((prev) => {
      logIdRef.current += 1;
      return appendBoundedMqttLog(prev, {
        id: logIdRef.current,
        timestamp: new Date().toLocaleTimeString(),
        type,
        topic,
        payload,
        details,
      }, isDevMode);
    });
  };

  useEffect(() => {
    if (isAutoScroll) logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, isAutoScroll]);

  const clearLogs = () => setLogs([]);
  const resetStats = () => setMsgStats(INITIAL_MSG_STATS);
  const clearLogsAndStats = () => {
    clearLogs();
    resetStats();
  };

  const toggleLogTopicFilter = (filter) => {
    const value = String(filter || '').trim();
    if (!value) return;
    setLogTopicFilters((prev) => (
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    ));
  };

  const clearLogTopicFilters = () => setLogTopicFilters([]);

  const logFilterLower = useMemo(() => String(logFilter || '').toLowerCase(), [logFilter]);
  const eventFilterLower = useMemo(() => String(eventFilter || '').toLowerCase(), [eventFilter]);

  const { messageLogs, eventLogs } = useMemo(() => {
    const nextMessageLogs = [];
    const nextEventLogs = [];

    for (const log of logs || []) {
      (isMessageLog(log, isDevMode) ? nextMessageLogs : nextEventLogs).push(log);
    }

    return { messageLogs: nextMessageLogs, eventLogs: nextEventLogs };
  }, [logs, isDevMode]);

  const filteredMessageLogs = useMemo(() => (
    messageLogs.filter((log) => (
      (!logFilterLower || ((log.topic + log.payload + log.type + (log.details || '')).toLowerCase().includes(logFilterLower))) &&
      (!logTopicFilters.length || (log.topic && logTopicFilters.some((filter) => topicMatchesFilter(filter, log.topic))))
    ))
  ), [messageLogs, logFilterLower, logTopicFilters]);

  const filteredEventLogs = useMemo(() => (
    eventLogs.filter((log) => (
      !eventFilterLower || ((log.topic + log.payload + log.type + (log.details || '')).toLowerCase().includes(eventFilterLower))
    ))
  ), [eventLogs, eventFilterLower]);

  return {
    logs,
    setLogs,
    logFilter,
    setLogFilter,
    logTopicFilters,
    setLogTopicFilters,
    isAutoScroll,
    setIsAutoScroll,
    logViewMode,
    setLogViewMode,
    logsEndRef,
    debugPacketLog,
    setDebugPacketLog,
    debugPacketLogRef,
    eventCenterOpen,
    setEventCenterOpen,
    eventFilter,
    setEventFilter,
    msgStats,
    logExportMenuOpen,
    setLogExportMenuOpen,
    logExportMenuRef,
    logExportButtonRef,
    addLog,
    clearLogs,
    clearLogsAndStats,
    resetStats,
    toggleLogTopicFilter,
    clearLogTopicFilters,
    messageLogs,
    eventLogs,
    filteredMessageLogs,
    filteredEventLogs,
  };
}
