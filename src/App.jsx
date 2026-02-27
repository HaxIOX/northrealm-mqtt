import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, onSnapshot 
} from 'firebase/firestore';
import {
  Wifi, WifiOff, Send, Download, Trash2, Play, Square, Activity,
  Server, Settings, MessageSquare, Loader2, Save, Search,
  PauseCircle, PlayCircle, FileJson, X, ChevronDown, ChevronUp,
  Clock, Copy, Plus, Binary, Cloud, Zap, Edit2, Check, Share2,
  AlertCircle, Layout, RefreshCw, Timer, BarChart3, Keyboard,
  FileText, Variable, RotateCcw, Info, ArrowUpRight, ArrowDownRight,
  Bell, LayoutDashboard, Sun, Moon, Star
} from 'lucide-react';
import { detectRuntime, isDesktopTcpCapable } from './mqtt/runtime.js';
import { encryptJson, decryptJson } from './mqtt/e2ee.js';

// 协议端口映射表
const PROTOCOL_PORT_MAP = {
  'ws': { port: 8083, description: 'WebSocket 未加密' },
  'wss': { port: 8084, description: 'WebSocket SSL 加密' },
  'mqtt': { port: 1883, description: 'MQTT TCP' },
  'mqtts': { port: 8883, description: 'MQTT TLS' }
};

// 常用 MQTT 服务器预设
const PRESET_BROKERS = [
  { name: 'EMQX 公共服务器', host: 'broker.emqx.io', ws: 8083, wss: 8084, path: '/mqtt' },
  { name: 'HiveMQ 公共服务器', host: 'broker.hivemq.com', ws: 8000, wss: 8884, path: '/mqtt' },
  { name: 'Mosquitto 测试服务器', host: 'test.mosquitto.org', ws: 8080, wss: 8081, path: '' }
];

// --- Firebase 初始化与容错处理 ---
let app, auth, db;
let isFirebaseAvailable = false;
let appId = 'default-app-id';

try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    const firebaseConfig = JSON.parse(__firebase_config);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseAvailable = true;
    
    if (typeof __app_id !== 'undefined') {
      appId = __app_id;
    }
  } else {
    console.warn("未检测到 __firebase_config，应用将以【仅本地模式】运行。云同步功能不可用。");
  }
} catch (error) {
  console.error("Firebase 初始化失败，降级为本地模式:", error);
}

export default function MqttDebugger() {
  const runtime = detectRuntime();
  const isElectronRuntime = runtime.isElectronUserAgent;
  const isDesktopShell = runtime.isDesktopShell;

  const getDesktopTcpCapable = () => isDesktopTcpCapable();

  const isDevMode = (() => {
    try {
      if (import.meta?.env?.DEV) return true;
    } catch {
      // ignore
    }
    try {
      return localStorage.getItem('mqtt_dev_mode') === '1';
    } catch {
      return false;
    }
  })();

  // --- 用户与云同步状态 ---
  const [user, setUser] = useState(null);
  const [syncSpaceId, setSyncSpaceId] = useState(''); 
  const [inputSpaceId, setInputSpaceId] = useState('');
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncEncryptEnabled, setSyncEncryptEnabled] = useState(() => localStorage.getItem('mqtt_sync_encrypt') !== '0');
  const [syncPassphrase, setSyncPassphrase] = useState(() => sessionStorage.getItem('mqtt_sync_passphrase') || '');
  const [rememberPassphrase, setRememberPassphrase] = useState(() => sessionStorage.getItem('mqtt_sync_remember') === '1');
  const [cloudCryptoError, setCloudCryptoError] = useState('');
  
  // --- 通用模态框状态 ---
  const [modal, setModal] = useState({ 
    open: false, type: 'input', title: '', inputValue: '', onConfirm: null 
  });

  // --- MQTT 核心状态 ---
  const [client, setClient] = useState(null);
  const [connectStatus, setConnectStatus] = useState('disconnected');
  const [sdkReady, setSdkReady] = useState(false);
  const [connectDuration, setConnectDuration] = useState(0);
  const [reconnectCount, setReconnectCount] = useState(0); // 新增：重连计数
  const [autoReconnect, setAutoReconnect] = useState(() => {
    try {
      return localStorage.getItem('mqtt_auto_reconnect') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('mqtt_auto_reconnect', autoReconnect ? '1' : '0');
    } catch {
      // ignore
    }
  }, [autoReconnect]);
  
  // --- 数据状态 ---
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [quickActions, setQuickActions] = useState([]);

  // --- 编辑/运行状态 ---
  const [connection, setConnection] = useState(() => {
    const defaultProtocol = (typeof window !== 'undefined' && getDesktopTcpCapable()) ? 'mqtt' : 'wss';
    const defaultPort = PROTOCOL_PORT_MAP[defaultProtocol]?.port ?? 8084;
    return {
      name: '默认 EMQX 公共服',
      protocol: defaultProtocol,
      host: 'broker.emqx.io',
      port: defaultPort,
      path: '/mqtt',
      clientId: `mqtt_debugger_${Math.random().toString(16).substr(2, 8)}`,
      username: '',
      password: ''
    };
  });

  const [advancedConfig, setAdvancedConfig] = useState({
    keepalive: 60, clean: true, willEnabled: false,
    willTopic: 'last/will', willPayload: 'offline', willQos: 0, willRetain: false,
    protocolVersion: 4  // 新增：协议版本 (3=MQTT 3.1, 4=MQTT 3.1.1, 5=MQTT 5.0)
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [configCollapsed, setConfigCollapsed] = useState(false); // 新增：连接后折叠配置面板
  const [selectedPresetBroker, setSelectedPresetBroker] = useState('');

  const [subscriptions, setSubscriptions] = useState([]);
  const [subscriptionsCollapsed, setSubscriptionsCollapsed] = useState(true);
  const [subTopic, setSubTopic] = useState('test/topic');
  const [subMonitorSelectedTopics, setSubMonitorSelectedTopics] = useState([]);
  
  const [pubTopic, setPubTopic] = useState('test/topic');
  const [pubMessage, setPubMessage] = useState('{"msg": "Hello MQTT"}');
  const [pubQoS, setPubQoS] = useState(0);
  const [pubRetain, setPubRetain] = useState(false); 
  const pubMessageTextareaRef = useRef(null);
  const [publishEditorOpen, setPublishEditorOpen] = useState(false);
  const [publishEditorTopic, setPublishEditorTopic] = useState('');
  const [publishEditorPayload, setPublishEditorPayload] = useState('');
  const [showQuickActionsPanel, setShowQuickActionsPanel] = useState(false);
  const [quickActionQuery, setQuickActionQuery] = useState('');
  const [showGroupModeSettings, setShowGroupModeSettings] = useState(false);
  const [editingAction, setEditingAction] = useState(null);
  const quickActionsScrollRef = useRef(null);
  const [quickActionGroupCollapsed, setQuickActionGroupCollapsed] = useState(() => {
    try {
      const raw = sessionStorage.getItem('mqtt_quick_action_group_collapsed');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem('mqtt_quick_action_group_collapsed', JSON.stringify(quickActionGroupCollapsed || {}));
    } catch {
      // ignore
    }
  }, [quickActionGroupCollapsed]);
  const quickActionGroupModeOptions = ['smart', 'topic-prefix'];
  const [quickActionGroupMode, setQuickActionGroupMode] = useState(() => {
    try {
      const raw = String(localStorage.getItem('mqtt_quick_action_group_mode') || '').trim();
      return quickActionGroupModeOptions.includes(raw) ? raw : 'smart';
    } catch {
      return 'smart';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('mqtt_quick_action_group_mode', quickActionGroupMode);
    } catch {
      // ignore
    }
  }, [quickActionGroupMode]);
  const quickActionTopicPrefixDepthOptions = [1, 2, 3, 4, 0]; // 0 = 全部
  const [quickActionTopicPrefixDepth, setQuickActionTopicPrefixDepth] = useState(() => {
    try {
      const v = Number(localStorage.getItem('mqtt_quick_action_topic_prefix_depth'));
      return quickActionTopicPrefixDepthOptions.includes(v) ? v : 2;
    } catch {
      return 2;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('mqtt_quick_action_topic_prefix_depth', String(quickActionTopicPrefixDepth));
    } catch {
      // ignore
    }
  }, [quickActionTopicPrefixDepth]);
  const [recentActionIds, setRecentActionIds] = useState(() => {
    try {
      const raw = localStorage.getItem('mqtt_recent_actions');
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // 日志
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('');
  const logFilterInputRef = useRef(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [logViewMode, setLogViewMode] = useState('text');
  const logsEndRef = useRef(null);
  const logIdRef = useRef(0);
  const msgDedup = useRef({ topic: '', payload: '', ts: 0 });

  // 调试：数据包日志（packetsend/packetreceive 会非常频繁，默认关闭）
  const [debugPacketLog, setDebugPacketLog] = useState(() => {
    try {
      return localStorage.getItem('mqtt_debug_packet_log') === '1';
    } catch {
      return false;
    }
  });
  const debugPacketLogRef = useRef(debugPacketLog);
  useEffect(() => { debugPacketLogRef.current = debugPacketLog; }, [debugPacketLog]);
  useEffect(() => {
    try {
      localStorage.setItem('mqtt_debug_packet_log', debugPacketLog ? '1' : '0');
    } catch {
      // ignore
    }
  }, [debugPacketLog]);

  // 事件中心：集中展示 system/error/debug（默认只在主视图显示 sent/received）
  const [eventCenterOpen, setEventCenterOpen] = useState(false);
  const [eventFilter, setEventFilter] = useState('');

  // 消息统计
  const [msgStats, setMsgStats] = useState({ sent: 0, received: 0, errors: 0 });

  // 定时发送
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerInterval, setTimerInterval] = useState(1000);
  const timerRef = useRef(null);

  // 自动重订阅
  const [autoResubscribe, setAutoResubscribe] = useState(true);
  const lastSubscriptionsRef = useRef([]);
  const reconnectCountRef = useRef(0);
  useEffect(() => { reconnectCountRef.current = reconnectCount; }, [reconnectCount]);
  const clientRef = useRef(null);
  useEffect(() => { clientRef.current = client; }, [client]);

  // 主题状态
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('mqtt_theme');
    return saved || 'dark';
  });

  // 主题切换
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('mqtt_theme', newTheme);
  };

  // 主题配色
  const t = theme === 'light' ? {
  // 亮色主题
    bg: 'bg-[#F8FAFC]',
    bgSecondary: 'bg-white',
    bgTertiary: 'bg-slate-50',
    bgHover: 'hover:bg-slate-50',
    bgInput: 'bg-white',
    border: 'border-slate-200',
    borderLight: 'border-slate-100',
    text: 'text-slate-900',
    textSecondary: 'text-slate-600',
    textMuted: 'text-slate-400',
    shadow: 'shadow-sm',
    shadowLg: 'shadow-lg shadow-slate-200/50',
    card: 'bg-white border-slate-100',
    cardHover: 'hover:border-slate-200 hover:shadow-md',
    accent: 'indigo',
    accentBg: 'bg-indigo-600',
    accentText: 'text-indigo-600',
    accentLight: 'bg-indigo-50',
  } : {
    // 暗色主题
    bg: 'bg-[#0B1120]',
    bgSecondary: 'bg-slate-900/50',
    bgTertiary: 'bg-slate-800/50',
    bgHover: 'hover:bg-slate-800',
    bgInput: 'bg-slate-800/50',
    border: 'border-slate-700/50',
    borderLight: 'border-slate-800',
    text: 'text-slate-100',
    textSecondary: 'text-slate-400',
    textMuted: 'text-slate-500',
    shadow: 'shadow-none',
    shadowLg: 'shadow-lg shadow-black/20',
    card: 'bg-slate-800/30 border-slate-700/30',
    cardHover: 'hover:border-slate-600',
    accent: 'indigo',
    accentBg: 'bg-indigo-600',
    accentText: 'text-indigo-400',
    accentLight: 'bg-indigo-500/10',
  };

  // --- 初始化逻辑 ---
  useEffect(() => {
    // 延迟检查，确保preload已完成
    const checkMqtt = () => {
      if (window.mqtt) {
        const source = window.__MQTT_PRO_MQTT_SOURCE__ || 'unknown';
        const isNative = source === 'native';

        console.log('[App] 检测到 window.mqtt');
        console.log('[App] MQTT来源:', source, isNative ? '(Node原生版，支持TCP)' : '(CDN浏览器版，仅支持WebSocket)');

        if (isNative) {
          console.log('[App] ✅ 使用Node原生MQTT，支持 mqtt:// 协议');
        } else {
          console.log('[App] ⚠️  使用CDN版本MQTT，仅支持 ws:// 和 wss:// 协议');
        }

        setSdkReady(true);
        return true;
      }
      return false;
    };

    // 立即检查一次
    if (checkMqtt()) {
      return;
    }

    // 桌面环境但 mqtt 还没加载：等待 preload 注入（或降级为 CDN 版本，仅支持 ws/wss）
    if (isDesktopShell) {
      console.log('[App] 桌面环境，等待 preload 注入 mqtt...');

      // 等待最多1秒让preload完成
      const waitTimer = setTimeout(() => {
        if (checkMqtt()) {
          console.log('[App] ✅ Preload mqtt加载成功');
          return;
        }

        console.warn('[App] ⚠️  Preload超时，降级使用CDN版本（不支持mqtt://协议）');
        if (window.__MQTT_PRO_DESKTOP__ !== true && !window.__MQTT_PRO_DESKTOP_PRELOAD_ERROR__) {
          const mainInfo = window.__MQTT_PRO_MAIN_INFO__ ? ` main=${JSON.stringify(window.__MQTT_PRO_MAIN_INFO__)}` : '';
          window.__MQTT_PRO_DESKTOP_PRELOAD_ERROR__ = `preload 未检测到（可能运行了旧版本/未正确安装/主进程未配置 preload）${mainInfo}`;
        }
        loadCdnMqtt();
      }, 1000);

      return () => clearTimeout(waitTimer);
    }

    // 浏览器环境，直接加载CDN版本
    console.log('[App] 浏览器环境，加载CDN版本MQTT');
    loadCdnMqtt();

    function loadCdnMqtt() {
      console.log('[App] 加载 CDN 版本 MQTT 库（仅支持WebSocket）');
      const script = document.createElement('script');
      script.src = "https://unpkg.com/mqtt@5.3.5/dist/mqtt.min.js";
      script.async = true;
      script.onload = () => {
        console.log('[App] CDN MQTT SDK 加载成功');
        if (window.__MQTT_PRO_MQTT_SOURCE__ !== 'native') window.__MQTT_PRO_MQTT_SOURCE__ = 'cdn';
        setSdkReady(true);
      };
      script.onerror = (e) => {
        console.error('[App] MQTT SDK 加载失败:', e);
        alert('MQTT 库加载失败，请检查网络连接或使用离线版本');
      };
      document.body.appendChild(script);
    }
  }, [isDesktopShell]);

  useEffect(() => {
    if (isFirebaseAvailable && auth) {
      signInAnonymously(auth).catch(e => console.error("Auth failed:", e));
      return onAuthStateChanged(auth, setUser);
    }
  }, []);

  useEffect(() => {
    const localConfigs = localStorage.getItem('mqtt_configs');
    const localActions = localStorage.getItem('mqtt_quick_actions');
    const localSubs = localStorage.getItem('mqtt_subscriptions');
    const lastSyncId = localStorage.getItem('mqtt_sync_id');
    if (localConfigs) setSavedConfigs(JSON.parse(localConfigs));
    if (localActions) setQuickActions(JSON.parse(localActions));
    if (localSubs) {
      try {
        const subs = JSON.parse(localSubs);
        if (Array.isArray(subs)) {
          setSubscriptions(subs);
          lastSubscriptionsRef.current = subs;
        }
      } catch {
        // ignore
      }
    }
    if (lastSyncId) { setSyncSpaceId(lastSyncId); setInputSpaceId(lastSyncId); }
  }, []);

  useEffect(() => {
    localStorage.setItem('mqtt_sync_encrypt', syncEncryptEnabled ? '1' : '0');
  }, [syncEncryptEnabled]);

  useEffect(() => {
    sessionStorage.setItem('mqtt_sync_remember', rememberPassphrase ? '1' : '0');
    if (rememberPassphrase) sessionStorage.setItem('mqtt_sync_passphrase', syncPassphrase);
    else sessionStorage.removeItem('mqtt_sync_passphrase');
  }, [rememberPassphrase, syncPassphrase]);

  // --- 云同步监听 ---
  useEffect(() => {
    if (!isFirebaseAvailable || !user || !syncSpaceId) { setIsCloudConnected(false); return; }
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', `mqtt_space_${syncSpaceId}`);
      setIsCloudConnected(true);
      setCloudCryptoError('');
      addLog('system', '', `已连接云同步空间: ${syncSpaceId}`);

      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const applyPayload = (payload) => {
            if (Array.isArray(payload?.configs)) {
              setSavedConfigs(payload.configs);
              localStorage.setItem('mqtt_configs', JSON.stringify(payload.configs));
            }
            if (Array.isArray(payload?.actions)) {
              setQuickActions(payload.actions);
              localStorage.setItem('mqtt_quick_actions', JSON.stringify(payload.actions));
            }
            if (Array.isArray(payload?.subscriptions)) {
              setSubscriptions(payload.subscriptions);
              localStorage.setItem('mqtt_subscriptions', JSON.stringify(payload.subscriptions));
              lastSubscriptionsRef.current = payload.subscriptions;
            }
          };

          if (data.enc) {
            if (!syncPassphrase) {
              setCloudCryptoError('该 Space ID 使用了端到端加密，需要输入口令才能同步。');
              addLog('error', '', '云同步需要口令：请在"云同步"里输入口令后重新连接。');
              return;
            }
            decryptJson(syncPassphrase, data.enc)
              .then((payload) => {
                setCloudCryptoError('');
                applyPayload(payload);
              })
              .catch((err) => {
                const msg = `解密失败：${String(err?.message || err)}`;
                setCloudCryptoError(msg);
                addLog('error', '', msg);
              });
            return;
          }

          applyPayload(data);
        } else {
          saveToCloud(savedConfigs, quickActions, lastSubscriptionsRef.current);
        }
      }, (error) => {
        console.error("Sync error:", error);
        setIsCloudConnected(false);
        addLog('error', '', '云同步连接中断');
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Firestore init error", e);
      setIsCloudConnected(false);
    }
  }, [user, syncSpaceId, syncPassphrase]);

  const saveToCloud = async (newConfigs, newActions, newSubscriptions) => {
    if (!isFirebaseAvailable || !user || !syncSpaceId) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', `mqtt_space_${syncSpaceId}`);
      const mergedPayload = {
        configs: newConfigs ?? savedConfigs,
        actions: newActions ?? quickActions,
        subscriptions: newSubscriptions ?? lastSubscriptionsRef.current,
      };

      if (syncEncryptEnabled) {
        if (!syncPassphrase) throw new Error('云同步已启用加密，但未输入口令');
        const enc = await encryptJson(syncPassphrase, mergedPayload);
        await setDoc(
          docRef,
          {
            enc,
            encrypted: true,
            updatedAt: Date.now(),
            updatedBy: user.uid
          },
          { merge: true },
        );
      } else {
        await setDoc(
          docRef,
          {
            configs: mergedPayload.configs,
            actions: mergedPayload.actions,
            subscriptions: mergedPayload.subscriptions,
            encrypted: false,
            updatedAt: Date.now(),
            updatedBy: user.uid
          },
          { merge: true },
        );
      }
    } catch { addLog('error', '', '云端保存失败'); }
  };

  const updateData = (type, newData) => {
    if (type === 'configs') {
      setSavedConfigs(newData);
      localStorage.setItem('mqtt_configs', JSON.stringify(newData));
      if (syncSpaceId) saveToCloud(newData, null, null);
    } else if (type === 'actions') {
      setQuickActions(newData);
      localStorage.setItem('mqtt_quick_actions', JSON.stringify(newData));
      if (syncSpaceId) saveToCloud(null, newData, null);
    } else if (type === 'subscriptions') {
      setSubscriptions(newData);
      localStorage.setItem('mqtt_subscriptions', JSON.stringify(newData));
      lastSubscriptionsRef.current = newData;
      if (syncSpaceId) saveToCloud(null, null, newData);
    }
  };

  const updateSubscriptions = (updater) => {
    setSubscriptions((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem('mqtt_subscriptions', JSON.stringify(next));
      lastSubscriptionsRef.current = next;
      if (syncSpaceId) saveToCloud(null, null, next);
      return next;
    });
  };

  const backupImportInputRef = useRef(null);

  const downloadJsonFile = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const buildBackupPayload = (includePasswords) => {
    const safeConfigs = (savedConfigs || []).map((c) => ({
      ...c,
      password: includePasswords ? (c?.password || '') : '',
    }));

    return {
      schema: 'mqtt-pro-backup',
      v: 1,
      exportedAt: new Date().toISOString(),
      appVersion: (typeof window !== 'undefined' && window.__MQTT_PRO_APP_VERSION__) ? window.__MQTT_PRO_APP_VERSION__ : 'unknown',
      data: {
        configs: safeConfigs,
        actions: quickActions || [],
        subscriptions: subscriptions || [],
      },
    };
  };

  const handleExportBackup = (includePasswords = false) => {
    try {
      const payload = buildBackupPayload(includePasswords);
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      downloadJsonFile(payload, `mqtt-pro-backup-${ts}.json`);
      addLog('system', '', includePasswords ? '已导出配置备份（包含密码）' : '已导出配置备份（不包含密码）');
    } catch (e) {
      addLog('error', '', `导出失败: ${String(e?.message || e)}`);
    }
  };

  const handleExportBackupWithPasswords = () => {
    openConfirmModal('导出备份并包含密码？（文件将包含明文密码，请妥善保管）', () => handleExportBackup(true));
  };

  const parseBackup = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.schema === 'mqtt-pro-backup' && raw.v === 1 && raw.data && typeof raw.data === 'object') return raw.data;
    if (raw.configs || raw.actions || raw.subscriptions) {
      return {
        configs: raw.configs,
        actions: raw.actions,
        subscriptions: raw.subscriptions,
      };
    }
    return null;
  };

  const mergeConfigsByName = (existing, incoming) => {
    const byName = new Map((existing || []).map((c) => [String(c?.name || ''), c]));
    for (const cfg of incoming || []) {
      const name = String(cfg?.name || '').trim();
      if (!name) continue;
      byName.set(name, cfg);
    }
    return Array.from(byName.values());
  };

  const mergeActionsById = (existing, incoming) => {
    const keyOf = (a) => (a && a.id != null ? `id:${String(a.id)}` : `hash:${String(a?.name || '')}|${String(a?.topic || '')}|${String(a?.payload || '')}`);
    const byKey = new Map((existing || []).map((a) => [keyOf(a), a]));
    for (const a of incoming || []) byKey.set(keyOf(a), a);
    return Array.from(byKey.values());
  };

  const mergeSubscriptionsUnique = (existing, incoming) => {
    const set = new Set([...(existing || []), ...(incoming || [])].map((s) => String(s).trim()).filter(Boolean));
    return Array.from(set);
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
        addLog('system', '', '备份导入完成');
      });
    } catch (err) {
      addLog('error', '', `导入失败: ${String(err?.message || err)}`);
    }
  };

  // --- 模态框辅助函数 ---
  const openInputModal = (title, defaultValue, onConfirm) => {
    setModal({ open: true, type: 'input', title, inputValue: defaultValue, onConfirm });
  };
  const openConfirmModal = (title, onConfirm) => {
    setModal({ open: true, type: 'confirm', title, inputValue: '', onConfirm });
  };
  const handleModalSubmit = () => {
    if (modal.onConfirm) modal.onConfirm(modal.inputValue);
    setModal({ ...modal, open: false });
  };

  // --- 业务逻辑 ---
  const handleConnectSync = () => {
    if (!isFirebaseAvailable) {
      alert("当前环境未配置 Firebase，无法使用云同步功能。请检查配置或仅使用本地功能。");
      return;
    }
    if (!inputSpaceId.trim()) return;
    if (syncEncryptEnabled && !syncPassphrase) {
      alert('已启用端到端加密：请先输入"同步口令"。');
      return;
    }
    const id = inputSpaceId.trim();
    setSyncSpaceId(id);
    localStorage.setItem('mqtt_sync_id', id);
    setShowSyncModal(false);
  };

  const handleDisconnectSync = () => {
    setSyncSpaceId('');
    localStorage.removeItem('mqtt_sync_id');
    setIsCloudConnected(false);
    setShowSyncModal(false);
    addLog('system', '', '已断开云同步');
  };

  const handleSaveConfig = () => {
    openInputModal("配置名称", connection.name || "新配置", (name) => {
      if (!name) return;
      const newConfig = { ...connection, name };
      setConnection(newConfig);
      const newConfigs = [...savedConfigs.filter(c => c.name !== name), newConfig];
      updateData('configs', newConfigs);
    });
  };

  const handleLoadConfig = (e) => {
    const config = savedConfigs.find(c => c.name === e.target.value);
    if (config) setConnection({ ...config, clientId: connection.clientId }); 
  };

  const handleDeleteConfig = () => {
    if (!connection.name) return;
    openConfirmModal(`确定删除配置 "${connection.name}" 吗?`, () => {
      const newConfigs = savedConfigs.filter(c => c.name !== connection.name);
      updateData('configs', newConfigs);
      setConnection({ ...connection, name: '' });
    });
  };

  const handleSaveAction = () => {
    openInputModal("给指令起个名字 (如: 开灯)", "新指令", (name) => {
      if (!name) return;
      const newAction = { 
        id: Date.now(), name, topic: pubTopic, payload: pubMessage, 
        qos: pubQoS, retain: pubRetain, pinned: false
      };
      const newActions = [...quickActions, newAction];
      updateData('actions', newActions);
    });
  };

  const handleLoadAction = (action) => {
    setPubTopic(action.topic); setPubMessage(action.payload);
    setPubQoS(action.qos); setPubRetain(action.retain);
    // 填充后聚焦到发送区，方便继续编辑。
    setTimeout(() => pubMessageTextareaRef.current?.focus(), 0);
  };

  const loadPublishDraft = (draft) => {
    if (!draft) return;
    if (typeof draft.topic === 'string') setPubTopic(draft.topic);
    if (typeof draft.payload === 'string') setPubMessage(draft.payload);
    setTimeout(() => pubMessageTextareaRef.current?.focus(), 0);
  };

  const toggleSubMonitorTopicSelection = (topic) => {
    const t = String(topic || '');
    setSubMonitorSelectedTopics((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const openPublishEditor = () => {
    setPublishEditorTopic(pubTopic);
    setPublishEditorPayload(pubMessage);
    setPublishEditorOpen(true);
  };

  const applyPublishEditor = () => {
    setPubTopic(publishEditorTopic);
    setPubMessage(publishEditorPayload);
    setPublishEditorOpen(false);
    setTimeout(() => pubMessageTextareaRef.current?.focus(), 0);
  };

  const handleFireAction = (action) => {
    if (!client || !client.connected) return addLog('error', '', '请先连接服务器');
    const payload = action.payload;
    client.publish(action.topic, payload, { qos: action.qos, retain: action.retain }, (err) => {
      if (err) addLog('error', action.topic, `指令 "${action.name}" 发送失败: ${err.message}`);
      else addLog('sent', action.topic, payload, `指令: ${action.name}`);
    });
  };

  // KISS: 兼容历史数据中 id 的 number/string 差异，统一 key 比较。
  const actionIdKey = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

  // KISS: React key / DOM 查找用的稳定 key，避免把 payload 原文塞进 data-* 属性。
  const actionRowKey = (action) => {
    const id = actionIdKey(action?.id);
    if (id) return `id:${id}`;
    const raw = `${String(action?.name || '')}|${String(action?.topic || '')}|${String(action?.payload || '')}`;
    let h = 5381;
    for (let i = 0; i < raw.length; i += 1) h = ((h << 5) + h) + raw.charCodeAt(i);
    return `h:${(h >>> 0).toString(16)}`;
  };

  // 分组优先级：手动分组 > 自动分组规则
  const getActionGroup = (action) => {
    if (action?.group) return { group: action.group, displayName: action?.name || '' };

    const name = String(action?.name || '').trim();
    const topic = String(action?.topic || '').trim();

    if (quickActionGroupMode === 'topic-prefix') {
      const parts = topic.split('/').map((x) => x.trim()).filter(Boolean);
      if (parts.length === 0) return { group: '未分组', displayName: name || '' };
      const depth = Number(quickActionTopicPrefixDepth);
      const groupParts = depth > 0 ? parts.slice(0, depth) : parts;
      const tailParts = depth > 0 ? parts.slice(depth) : [];
      const group = groupParts.join('/');
      const displayName = name || (tailParts.length > 0 ? tailParts.join('/') : parts[parts.length - 1]);
      return { group: group || '未分组', displayName: displayName || '' };
    }

    // smart: 名称前缀优先，其次 Topic 前缀
    const candidates = ['/', '::', ':', '：'];
    let best = null;
    for (const sep of candidates) {
      const idx = name.indexOf(sep);
      if (idx <= 0 || idx >= name.length - sep.length) continue;
      if (!best || idx < best.idx || (idx === best.idx && sep.length > best.sep.length)) {
        best = { idx, sep };
      }
    }
    if (best) {
      const group = name.slice(0, best.idx).trim();
      const displayName = name.slice(best.idx + best.sep.length).trim();
      if (group && displayName) return { group, displayName };
    }
    if (topic) {
      const parts = topic.split('/');
      if (parts.length >= 2) {
        const group = parts.slice(0, -1).join('/');
        return { group, displayName: name || parts[parts.length - 1] };
      }
    }
    return { group: '未分组', displayName: name || '' };
  };

  const persistRecentActions = (next) => {
    try {
      localStorage.setItem('mqtt_recent_actions', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const recordRecentAction = (actionId) => {
    const id = actionIdKey(actionId);
    if (!id) return;
    setRecentActionIds((prev) => {
      const prevIds = Array.isArray(prev) ? prev.map((x) => actionIdKey(x)).filter(Boolean) : [];
      const next = [id, ...prevIds.filter((x) => x !== id)].slice(0, 20);
      persistRecentActions(next);
      return next;
    });
  };

  const sendQuickAction = (action, opts = {}) => {
    const { closePanel = true } = opts;
    recordRecentAction(action.id);
    handleFireAction(action);
    if (closePanel) {
      setShowQuickActionsPanel(false);
      setQuickActionQuery('');
    }
  };

  // UX: 打开弹窗时沿用上次展开/收起状态（会话内记忆）。

  // 搜索时自动展开命中的分组并滚动到对应指令。
  useEffect(() => {
    if (!showQuickActionsPanel) return;
    const q = (quickActionQuery || '').trim().toLowerCase();
    if (!q) return;
    const all = Array.isArray(quickActions) ? quickActions : [];
    const match = (a) => `${a?.name || ''} ${a?.topic || ''} ${a?.payload || ''}`.toLowerCase().includes(q);
    const first = all.find(match);
    if (!first) return;

    const { group } = getActionGroup(first);
    setQuickActionGroupCollapsed(prev => ({ ...(prev || {}), [group]: false }));

    const key = actionRowKey(first);
    setTimeout(() => {
      const doScroll = () => {
        const root = quickActionsScrollRef.current;
        if (!root) return;
        const esc = (s) => {
          try {
            if (typeof window !== 'undefined' && window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(s);
          } catch {
            // ignore
          }
          return String(s).replace(/["\\]/g, '\\$&');
        };
        const el = root.querySelector(`[data-action-key="${esc(key)}"]`);
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'center' });
        }
      };

      // 等待一次渲染：先展开分组，再定位目标行。
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => window.requestAnimationFrame(doScroll));
      } else {
        setTimeout(doScroll, 30);
      }
    }, 0);
  }, [showQuickActionsPanel, quickActionQuery, quickActions, quickActionGroupMode, quickActionTopicPrefixDepth]);

  const toggleActionPinned = (actionId) => {
    const id = actionIdKey(actionId);
    const newActions = (quickActions || []).map((a) => (
      actionIdKey(a?.id) === id ? { ...a, pinned: !a.pinned } : a
    ));
    updateData('actions', newActions);
  };

  const handleSetActionGroup = (action, e) => {
    if (e) e.stopPropagation();
    openInputModal("设置分组（留空则自动分组）", action.group || '', (groupName) => {
      const trimmed = (groupName || '').trim();
      const id = actionIdKey(action?.id);
      const newActions = (quickActions || []).map((a) => (
        actionIdKey(a?.id) === id ? { ...a, group: trimmed || undefined } : a
      ));
      updateData('actions', newActions);
    });
  };

  const handleSetGroupForAll = (currentGroup, rows, e) => {
    if (e) e.stopPropagation();
    openInputModal("重命名分组", currentGroup === '未分组' ? '' : currentGroup, (newGroup) => {
      const trimmed = (newGroup || '').trim();
      if (!trimmed || trimmed === currentGroup) return;
      const ids = new Set((rows || []).map((r) => actionIdKey(r?.action?.id)).filter(Boolean));
      const newActions = (quickActions || []).map((a) => (
        ids.has(actionIdKey(a?.id)) ? { ...a, group: trimmed } : a
      ));
      updateData('actions', newActions);
    });
  };

  const handleDeleteAction = (id, e) => {
    if (e) e.stopPropagation();
    openConfirmModal("确定删除此快捷指令?", () => {
      const key = actionIdKey(id);
      const newActions = (quickActions || []).filter((t) => actionIdKey(t?.id) !== key);
      updateData('actions', newActions);
    });
  };

  const handleStartEditAction = (action, e) => {
    if (e) e.stopPropagation();
    setEditingAction({
      id: action.id,
      name: action.name || '',
      topic: action.topic || '',
      payload: action.payload || '',
      qos: action.qos ?? 0,
      retain: !!action.retain,
    });
  };

  const handleSaveEditAction = () => {
    if (!editingAction) return;
    const key = actionIdKey(editingAction.id);
    const newActions = (quickActions || []).map((a) =>
      actionIdKey(a?.id) === key
        ? { ...a, name: editingAction.name, topic: editingAction.topic, payload: editingAction.payload, qos: editingAction.qos, retain: editingAction.retain }
        : a
    );
    updateData('actions', newActions);
    setEditingAction(null);
  };

  // MQTT相关函数
  const addLog = (type, topic, payload, details = '') => {
    // 更新统计
    setMsgStats(prev => ({
      sent: type === 'sent' ? prev.sent + 1 : prev.sent,
      received: type === 'received' ? prev.received + 1 : prev.received,
      errors: type === 'error' ? prev.errors + 1 : prev.errors
    }));

    setLogs(prev => {
      logIdRef.current += 1;
      const newLogs = [...prev, { id: logIdRef.current, timestamp: new Date().toLocaleTimeString(), type, topic, payload, details }];
      return newLogs.length > 500 ? newLogs.slice(newLogs.length - 500) : newLogs;
    });
  };

  // 协议改变时智能更新端口
  const handleProtocolChange = (newProtocol) => {
    const portInfo = PROTOCOL_PORT_MAP[newProtocol];
    setConnection(prev => ({
      ...prev,
      protocol: newProtocol,
      port: portInfo ? portInfo.port : prev.port
    }));
  };

  const handlePortChange = (rawPort) => {
    const port = Number(rawPort);
    if (!Number.isFinite(port)) return;

    if (isDesktopShell && port === 1883 && (connection.protocol === 'ws' || connection.protocol === 'wss')) {
      return handleProtocolChange('mqtt');
    }
    if (isDesktopShell && port === 8883 && (connection.protocol === 'ws' || connection.protocol === 'wss')) {
      return handleProtocolChange('mqtts');
    }

    setConnection(prev => ({ ...prev, port }));
  };

  useEffect(() => {
    if (!isDesktopShell) return;
    const port = Number(connection.port);
    if (!Number.isFinite(port)) return;

    if ((connection.protocol === 'ws' || connection.protocol === 'wss') && port === 1883) {
      handleProtocolChange('mqtt');
    } else if ((connection.protocol === 'ws' || connection.protocol === 'wss') && port === 8883) {
      handleProtocolChange('mqtts');
    }
  }, [isDesktopShell, connection.port, connection.protocol]);


  // 诊断连接问题
  const diagnoseConnectionError = (err) => {
    const errorMsg = err.message || err.toString();
    const errorCode = err.code;
    let diagnosis = '';

    // 根据错误代码进行诊断
    if (errorCode === 'ECONNREFUSED') {
      diagnosis = '💡 诊断: 连接被拒绝\n   - 服务器可能未运行\n   - 端口号可能错误\n   - 防火墙可能阻止了连接';
    } else if (errorCode === 'ETIMEDOUT' || errorCode === 'ESOCKETTIMEDOUT') {
      diagnosis = '💡 诊断: 连接超时\n   - 服务器地址可能不可达\n   - 网络问题或防火墙阻止\n   - 服务器响应太慢';
    } else if (errorCode === 'ENOTFOUND' || errorCode === 'EAI_AGAIN') {
      diagnosis = '💡 诊断: 域名解析失败\n   - 服务器地址拼写错误\n   - DNS 服务器问题\n   - 网络连接问题';
    } else if (errorCode === 'ECONNRESET') {
      diagnosis = '💡 诊断: 连接被重置\n   - 服务器主动断开了连接\n   - 可能是认证失败\n   - 可能是协议版本不匹配';
    } else if (errorMsg.includes('WebSocket')) {
      if (connection.protocol === 'wss') {
        diagnosis = '💡 诊断: WebSocket SSL 连接失败\n   - 服务器可能不支持 WSS\n   - 尝试使用 ws:// 协议';
      } else {
        diagnosis = '💡 诊断: WebSocket 连接失败\n   - 检查服务器是否支持 WebSocket\n   - 检查路径(path)是否正确';
      }
    } else if (errorMsg.includes('timeout') || errorMsg.includes('TIMEOUT')) {
      diagnosis = '💡 诊断: 连接超时\n   - 检查服务器地址和端口\n   - 检查网络连接\n   - 检查防火墙设置';
    } else if (errorMsg.includes('certificate') || errorMsg.includes('SSL') || errorMsg.includes('TLS')) {
      diagnosis = '💡 诊断: SSL/TLS 证书问题\n   - 自签名证书不被信任\n   - 尝试使用非加密协议 (mqtt:// 或 ws://)';
    } else if (errorMsg.includes('authorized') || errorMsg.includes('authentication')) {
      diagnosis = '💡 诊断: 认证失败\n   - 用户名或密码错误\n   - 服务器要求认证但未提供凭据';
    } else if (errorMsg.includes('protocol')) {
      diagnosis = '💡 诊断: 协议错误\n   - MQTT 协议版本不匹配\n   - 服务器可能不是标准 MQTT 服务器';
    }

    return diagnosis;
  };
  useEffect(() => { if (isAutoScroll) logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs, isAutoScroll]);
  useEffect(() => {
    let i; if (connectStatus === 'connected') i = setInterval(() => setConnectDuration(p => p + 1), 1000);
    else setConnectDuration(0); return () => clearInterval(i);
  }, [connectStatus]);

  const handleConnect = () => {
    if (!sdkReady) return addLog('error', '', 'SDK 未加载');
    if (!isDesktopShell && (connection.protocol === 'mqtt' || connection.protocol === 'mqtts')) {
      return addLog('error', '', '浏览器不支持 mqtt://（1883）直连，请使用 ws/wss 或使用桌面版');
    }
    const tcpCapableNow = getDesktopTcpCapable();
    if ((connection.protocol === 'mqtt' || connection.protocol === 'mqtts') && !tcpCapableNow) {
      const sourceNow = window.__MQTT_PRO_MQTT_SOURCE__ || 'unknown';
      addLog('error', '', '桌面端未启用 MQTT TCP（preload 未生效），请使用安装包运行桌面版或检查 Electron preload 配置');
      addLog('system', '', `诊断: isElectron=${isElectronRuntime ? '是' : '否'}, preload=${window.__MQTT_PRO_DESKTOP__ === true ? '是' : '否'}, mqttSource=${sourceNow}, mqtt.connect=${typeof window.mqtt?.connect}`);
      if (window.__MQTT_PRO_MAIN_INFO__) {
        addLog('system', '', `主进程: ${JSON.stringify(window.__MQTT_PRO_MAIN_INFO__)}`);
      }
      if (window.__MQTT_PRO_DESKTOP_PRELOAD_ERROR__) {
        addLog('system', '', `Preload 错误: ${window.__MQTT_PRO_DESKTOP_PRELOAD_ERROR__}`);
      }
      if (window.__MQTT_PRO_MQTT_REQUIRE_TRIED__) {
        addLog('system', '', `Preload require: ${JSON.stringify(window.__MQTT_PRO_MQTT_REQUIRE_TRIED__)}`);
      }
      return;
    }
    if (
      isDesktopShell &&
      (connection.protocol === 'ws' || connection.protocol === 'wss') &&
      (Number(connection.port) === 1883 || Number(connection.port) === 8883)
    ) {
      return addLog('error', '', '你正在用 ws/wss 连接 1883/8883（这是 MQTT TCP/TLS 端口，不是 WebSocket 端口），请切换协议为 mqtt/mqtts');
    }
    setReconnectCount(0);
    if (clientRef.current) {
      clientRef.current.end(true);
      clientRef.current = null;
    }
    if (client) { setClient(null); }
    setConnectStatus('connecting');
    const pathPart = (connection.protocol === 'ws' || connection.protocol === 'wss') ? connection.path : '';
    const url = `${connection.protocol}://${connection.host}:${connection.port}${pathPart}`;
    addLog('system', '', `正在连接 ${url}...`);

    // 添加调试信息
    addLog('system', '', `环境检测: ${isDesktopShell ? '桌面客户端' : '浏览器'}`);
    addLog('system', '', `TCP支持: ${getDesktopTcpCapable() ? '是' : '否'}`);
    addLog('system', '', `MQTT模块: ${window.mqtt ? '已加载' : '未加载'}`);
    if (isDesktopShell) {
      addLog('system', '', `应用版本: ${window.__MQTT_PRO_APP_VERSION__ || 'unknown'}`);
      if (window.__MQTT_PRO_PRELOAD_DIR__) addLog('system', '', `Preload目录: ${window.__MQTT_PRO_PRELOAD_DIR__}`);
      if (window.__MQTT_PRO_CWD__) addLog('system', '', `CWD: ${window.__MQTT_PRO_CWD__}`);
      if (window.__MQTT_PRO_MQTT_RESOLVE_PATH__ !== undefined) addLog('system', '', `MQTT resolve: ${window.__MQTT_PRO_MQTT_RESOLVE_PATH__}`);
    }

    // 检测 MQTT 库的类型
    if (window.mqtt) {
      const source = window.__MQTT_PRO_MQTT_SOURCE__ || 'unknown';
      const isNative = source === 'native';

      addLog('system', '', `MQTT来源: ${source === 'native' ? 'Node原生(支持TCP)' : source === 'cdn' ? 'CDN浏览器版(仅WebSocket)' : '未知'}`);
      addLog('system', '', `MQTT版本: ${window.__MQTT_PRO_MQTT_VERSION__ || 'unknown'}`);

      if (!isNative && (connection.protocol === 'mqtt' || connection.protocol === 'mqtts')) {
        addLog('error', '', '⚠️  当前使用的MQTT库不支持 mqtt:// 协议');
        addLog('error', '', '请切换到 ws:// / wss://，或检查桌面端 preload 注入是否成功');
        setConnectStatus('disconnected');
        setReconnectCount(0);
        return;
      }
    }

    addLog('system', '', `认证: 用户名=${connection.username || '无'}`);


    // 协议提示
    if (connection.protocol === 'wss') {
      addLog('system', '', '使用 WSS 加密连接，如服务器无 SSL 请改用 ws://');
    } else if (connection.protocol === 'mqtts') {
      addLog('system', '', '使用 MQTT TLS 连接（mqtts://），如服务器无证书请改用 mqtt:// 或 ws://');
    }

    try {
      const opts = {
        clientId: connection.clientId,
        username: connection.username,
        password: connection.password,
        clean: advancedConfig.clean,
        keepalive: Number(advancedConfig.keepalive),
        connectTimeout: 10000,      // 增加到10秒
        reconnectPeriod: autoReconnect ? 3000 : 0,
        protocolId: advancedConfig.protocolVersion === 3 ? 'MQIsdp' : 'MQTT',
        protocolVersion: Number(advancedConfig.protocolVersion)
      };
      if (advancedConfig.willEnabled) opts.will = { topic: advancedConfig.willTopic, payload: advancedConfig.willPayload, qos: Number(advancedConfig.willQos), retain: advancedConfig.willRetain };

      addLog('system', '', `连接选项: timeout=${opts.connectTimeout}ms, reconnect=${opts.reconnectPeriod}ms, protocol=${opts.protocolId} v${opts.protocolVersion}`);

      const newClient = window.mqtt.connect(url, opts);
      clientRef.current = newClient;

      // 连接建立事件
      newClient.on('connect', (connack) => {
        setConnectStatus('connected');
        setReconnectCount(0); // 重置重连计数
        addLog('system', '', '✅ 连接成功');
        addLog('system', '', `CONNACK 响应: sessionPresent=${connack?.sessionPresent}, returnCode=${connack?.returnCode || 0}`);
        setConfigCollapsed(true);

        // 自动重订阅
        if (autoResubscribe && lastSubscriptionsRef.current.length > 0) {
          const topicsToResubscribe = [...lastSubscriptionsRef.current];
          addLog('system', '', `正在恢复 ${topicsToResubscribe.length} 个订阅...`);
          topicsToResubscribe.forEach(topic => {
            newClient.subscribe(topic, (err) => {
              if (!err) {
                setSubscriptions(prev => prev.includes(topic) ? prev : [...prev, topic]);
                addLog('system', topic, '自动重订阅成功');
              }
            });
          });
        }
      });

      // 错误事件
      newClient.on('error', (err) => {
        setConnectStatus('error');
        const errorMsg = err.message || err.toString();

        const diagnosis = diagnoseConnectionError(err);

        // 详细错误信息
        const errorDetails = {
          message: err.message,
          code: err.code,
          errno: err.errno,
          syscall: err.syscall,
          address: err.address,
          port: err.port,
          stack: err.stack?.split('\n').slice(0, 3).join('\n')
        };

        // 过滤掉undefined的字段
        const filteredDetails = Object.fromEntries(
          Object.entries(errorDetails).filter(([, v]) => v != null)
        );

        if (!isDevMode) {
          const shortDetails = [];
          if (filteredDetails.code) shortDetails.push(`code=${filteredDetails.code}`);
          if (filteredDetails.address) shortDetails.push(`address=${filteredDetails.address}`);
          if (filteredDetails.port) shortDetails.push(`port=${filteredDetails.port}`);
          if (filteredDetails.syscall) shortDetails.push(`syscall=${filteredDetails.syscall}`);

          const hintLines = [];
          if (connection.protocol === 'ws' || connection.protocol === 'wss') {
            hintLines.push('检查 Broker 是否开启 WebSocket 端口（常见 8083/8084）以及 Path（常见 /mqtt）');
          }
          if (isDesktopShell && (connection.protocol === 'ws' || connection.protocol === 'wss') && (Number(connection.port) === 1883 || Number(connection.port) === 8883)) {
            hintLines.push('当前端口是 MQTT TCP/TLS（1883/8883），请切换协议到 mqtt/mqtts');
          }
          if (autoReconnect) {
            hintLines.push('如端口未开会反复重试：可先关闭"自动重连"');
          }

          const detailsText = [
            shortDetails.length ? `详情: ${shortDetails.join(', ')}` : '',
            diagnosis || '',
            hintLines.length ? `💡 建议: ${hintLines.join('；')}` : '',
          ].filter(Boolean).join('\n');

          addLog('error', '', `❌ 连接错误: ${errorMsg}`, detailsText);
          return;
        }

        addLog('error', '', `❌ 连接错误: ${errorMsg}`);

        if (Object.keys(filteredDetails).length > 1) {
          addLog('system', '', `错误详情: ${JSON.stringify(filteredDetails, null, 2)}`);
        }

        if (diagnosis) addLog('system', '', diagnosis);
      });

      // 连接关闭事件
      newClient.on('close', () => {
        const wasConnected = connectStatus === 'connected';
        setConnectStatus('disconnected');
        if (wasConnected) {
          addLog('system', '', '⚠️ 连接已断开');
        } else {
          addLog('system', '', '⚠️ 连接关闭（未成功建立连接）');
          if (reconnectCount === 0) {
            addLog('error', '', '⚠️ TCP连接成功但MQTT握手失败，可能原因：');
            addLog('error', '', '  1. 用户名或密码错误（最常见）');
            addLog('error', '', '  2. ClientID 被拒绝或已被占用');
            addLog('error', '', '  3. 服务器配置不允许此连接');
            addLog('error', '', '  4. MQTT 协议版本不匹配');
          }
        }
      });

      // 离线事件
      newClient.on('offline', () => {
        addLog('system', '', '📴 客户端离线 - 可能是网络问题或服务器无法访问');
        if (reconnectCountRef.current === 0) {
          addLog('system', '', '💡 提示: 检查服务器地址、端口、网络连接');
        }
      });

      // 重连事件
      newClient.on('reconnect', () => {
        setReconnectCount(prev => {
          const newCount = prev + 1;
          addLog('system', '', `🔄 正在尝试第 ${newCount} 次重连...`);

          if (newCount === 3) {
            addLog('error', '', '⚠️ 已重连3次失败，可能原因：');
            addLog('error', '', '  1. 服务器地址或端口错误');
            addLog('error', '', '  2. 服务器未运行或无法访问');
            addLog('error', '', '  3. 防火墙阻止连接');
            addLog('error', '', '  4. 用户名密码错误');
          }

          if (newCount >= 10) {
            addLog('error', '', `🛑 已重连 ${newCount} 次，建议停止连接并检查配置`);
            // 10次后停止自动重连
            if (newCount >= 15) {
              addLog('error', '', '🛑 达到最大重连次数(15)，停止重连');
              newClient.end(true);
            }
          }

          return newCount;
        });
      });

      // 包发送事件（用于调试）
      newClient.on('packetsend', (packet) => {
        if (debugPacketLogRef.current && reconnectCountRef.current === 0) {
          addLog('system', '', `📤 发送数据包: ${packet.cmd}`);
        }
      });

      // 包接收事件（用于调试）
      newClient.on('packetreceive', (packet) => {
        if (debugPacketLogRef.current && reconnectCountRef.current === 0) {
          addLog('system', '', `📥 接收数据包: ${packet.cmd}`);
        }
      });

      newClient.on('message', (t, m) => {
        const text = m.toString();
        const now = Date.now();
        const prev = msgDedup.current;
        if (prev.topic === t && prev.payload === text && now - prev.ts < 200) return;
        msgDedup.current = { topic: t, payload: text, ts: now };
        addLog('received', t, text);
      });
      setClient(newClient);
    } catch (e) {
      setConnectStatus('error');
      const diagnosis = diagnoseConnectionError(e);
      const msg = String(e?.message || e || '连接失败');
      if (!isDevMode && diagnosis) {
        addLog('error', '', msg, diagnosis);
      } else {
        addLog('error', '', msg);
        if (diagnosis) addLog('system', '', diagnosis);
      }
    }
  };

  const applyPresetBroker = (presetName) => {
    const preset = (PRESET_BROKERS || []).find((b) => b && b.name === presetName);
    if (!preset) return;
    const protocol = 'wss';
    const port = Number(preset.wss || 8084);
    const path = String(preset.path || '/mqtt');

    setConnection((prev) => ({
      ...prev,
      name: preset.name,
      host: preset.host,
      protocol,
      port,
      path,
    }));
  };

  const handleDisconnect = () => {
    // 保存当前订阅列表供重连使用
    lastSubscriptionsRef.current = [...subscriptions];
    // 停止定时发送
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setTimerEnabled(false);
    }
    const currentClient = clientRef.current || client;
    if (currentClient) {
      // 强制结束连接，传入true表示不再重连
      currentClient.end(true);
      clientRef.current = null;
      setClient(null);
      setConnectStatus('disconnected');
      setReconnectCount(0); // 重置重连计数
      addLog('system', '', connectStatus === 'connecting' ? '✅ 已取消连接' : '✅ 已断开连接（停止重连）');
    }
  };

  const handleSubscribe = () => {
    if (client?.connected && subTopic && !subscriptions.includes(subTopic)) {
      client.subscribe(subTopic, e => {
        if (!e) {
          updateSubscriptions((prev) => (prev.includes(subTopic) ? prev : [...prev, subTopic]));
          addLog('system', subTopic, '订阅成功');
        } else {
          addLog('error', subTopic, '订阅失败');
        }
      });
    }
  };

  const handleUnsubscribe = (t) => {
    if (client?.connected) {
      client.unsubscribe(t, e => {
        if (!e) {
          updateSubscriptions((prev) => prev.filter((i) => i !== t));
          setSubMonitorSelectedTopics((prev) => prev.filter((x) => x !== t));
          addLog('system', t, '退订成功');
        }
      });
    }
  };

  const handlePublish = () => {
    if (!client?.connected) return addLog('error', '', '请先连接');
    if (!pubTopic) return addLog('error', '', '请输入 Topic');


    const parsedMessage = pubMessage;

    client.publish(pubTopic, parsedMessage, { qos: pubQoS, retain: pubRetain }, e => {
      if (e) {
        addLog('error', pubTopic, e.message);
      } else {
        addLog('sent', pubTopic, parsedMessage, `QoS: ${pubQoS}`);
      }
    });
  };

  // 定时发送控制
  const toggleTimer = () => {
    if (timerEnabled) {
      // 停止定时
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimerEnabled(false);
      addLog('system', '', '定时发送已停止');
    } else {
      // 开始定时
      if (!client?.connected) return addLog('error', '', '请先连接服务器');
      if (!pubTopic) return addLog('error', '', '请输入 Topic');

      setTimerEnabled(true);
      addLog('system', '', `定时发送已启动，间隔 ${timerInterval}ms`);

      timerRef.current = setInterval(() => {
        const parsedMessage = pubMessage;
        client.publish(pubTopic, parsedMessage, { qos: pubQoS, retain: pubRetain }, e => {
          if (e) addLog('error', pubTopic, e.message);
          else addLog('sent', pubTopic, parsedMessage, `定时发送 QoS: ${pubQoS}`);
        });
      }, timerInterval);
    }
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (publishEditorOpen && e.key === 'Escape') {
        e.preventDefault();
        setPublishEditorOpen(false);
        return;
      }
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
      // Ctrl/Cmd + Enter: 发送消息
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (publishEditorOpen) applyPublishEditor();
        else handlePublish();
      }
      // Ctrl/Cmd + D: 断开连接
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (connectStatus === 'connected') handleDisconnect();
      }
      // Ctrl/Cmd + L: 清空日志
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        setLogs([]);
        setMsgStats({ sent: 0, received: 0, errors: 0 });
      }
      // Ctrl/Cmd + K: 连接/断开切换
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (connectStatus === 'connected') handleDisconnect();
        else if (connectStatus === 'connecting') handleDisconnect();
        else if (reconnectCount > 0) handleDisconnect();
        else if (connectStatus !== 'connecting') handleConnect();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [client, connectStatus, reconnectCount, eventCenterOpen, pubTopic, pubMessage, pubQoS, pubRetain, showQuickActionsPanel, publishEditorOpen, publishEditorTopic, publishEditorPayload]);

  // 重置统计
  const resetStats = () => {
    setMsgStats({ sent: 0, received: 0, errors: 0 });
  };
  
  // Formatters
  const formatDuration = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  const toHex = (str) => { let h=''; for(let i=0;i<str.length;i++) h+=str.charCodeAt(i).toString(16).padStart(2,'0')+' '; return h.toUpperCase(); };
  const isJson = (str) => { try { JSON.parse(str); return true; } catch { return false; } };
  const tryFormatJson = (str) => { try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; } };

  // KISS: 仅支持 MQTT 常见通配符（+ / #），用于订阅监控的"按主题筛选"。
  const mqttTopicMatches = (filter, topic) => {
    const f = String(filter || '');
    const t = String(topic || '');
    if (!f) return true;
    if (!t) return false;
    if (f === t) return true;

    const fl = f.split('/');
    const tl = t.split('/');
    for (let i = 0; i < fl.length; i += 1) {
      const seg = fl[i];
      if (seg === '#') {
        // MQTT 规范要求 # 只能出现在最后一段；这里按常见实现处理。
        return i === fl.length - 1;
      }
      if (i >= tl.length) return false;
      if (seg === '+') continue;
      if (seg !== tl[i]) return false;
    }
    return tl.length === fl.length;
  };

  const isMessageLog = (log) => (
    log.type === 'sent' ||
    log.type === 'received' ||
    (log.type === 'error' && (!!log.topic || !isDevMode))
  );
  const messageLogs = logs.filter(isMessageLog);
  const filteredMessageLogs = messageLogs
    .filter((log) => (subMonitorSelectedTopics.length === 0 || subMonitorSelectedTopics.some((t) => mqttTopicMatches(t, log.topic))))
    .filter((log) => (
      !logFilter || ((log.topic + log.payload + log.type + (log.details || '')).toLowerCase().includes(logFilter.toLowerCase()))
    ));
  const eventLogs = logs.filter((log) => !isMessageLog(log));
  const filteredEventLogs = eventLogs.filter((log) => (
    !eventFilter || ((log.topic + log.payload + log.type + (log.details || '')).toLowerCase().includes(eventFilter.toLowerCase()))
  ));
  const pinnedActions = (() => {
    const pinned = (quickActions || []).filter((a) => a && a.pinned);
    if (pinned.length <= 1) return pinned;
    const index = new Map((recentActionIds || []).map((id, i) => [id, i]));
    return [...pinned].sort((a, b) => {
      const ai = index.has(a.id) ? index.get(a.id) : Number.MAX_SAFE_INTEGER;
      const bi = index.has(b.id) ? index.get(b.id) : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });
  })();
  const commonActions = (() => {
    const MAX_COMMON = 6;
    const all = Array.isArray(quickActions) ? quickActions : [];
    const byId = new Map(all.map((a) => [a.id, a]));
    const chosen = [];

    for (const action of pinnedActions) {
      if (action && chosen.length < MAX_COMMON) chosen.push(action);
    }

    if (chosen.length < MAX_COMMON) {
      for (const id of (recentActionIds || [])) {
        const action = byId.get(id);
        if (!action) continue;
        if (chosen.some((a) => a.id === action.id)) continue;
        chosen.push(action);
        if (chosen.length >= MAX_COMMON) break;
      }
    }

    return chosen.slice(0, MAX_COMMON);
  })();

  // 统计卡片组件
  const StatCard = ({ label, value, icon: Icon, trendValue, positive, color = 'blue' }) => {
    const IconComp = Icon;
    const colorClasses = {
      blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      red: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    };
    return (
      <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-all duration-300 hover:shadow-lg hover:shadow-black/20 group">
        <div className="flex justify-between items-start mb-3">
          <div className={`p-2 rounded-xl ${colorClasses[color]} border`}>
            <IconComp className="w-4 h-4" />
          </div>
          {trendValue && (
            <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              positive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        <h3 className="text-2xl font-bold text-slate-100 mb-1">{value}</h3>
        <p className="text-slate-500 text-xs">{label}</p>
      </div>
    );
  };

  return (
    <div className={`flex h-screen ${t.bg} ${t.text} font-sans overflow-hidden selection:bg-indigo-500/30 transition-colors duration-300`}>

      {/* 模态框 */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`${t.bgSecondary} rounded-2xl shadow-2xl max-w-sm w-full border ${t.border} p-6 transform scale-100`}>
            <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${t.text}`}>
              {modal.type === 'confirm' && <AlertCircle className="w-5 h-5 text-amber-500" />}
              {modal.title}
            </h3>
            {modal.type === 'input' && (
              <input
                autoFocus type="text" value={modal.inputValue} onChange={(e) => setModal({...modal, inputValue: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && handleModalSubmit()}
                className={`w-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none mb-4 transition-all ${t.text}`}
              />
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setModal({...modal, open: false})} className={`px-4 py-2 ${t.bgTertiary} ${t.bgHover} rounded-xl text-sm font-medium transition-colors ${t.textSecondary}`}>取消</button>
              <button onClick={handleModalSubmit} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg ${modal.type === 'confirm' ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'}`}>{modal.type === 'confirm' ? '确定删除' : '确定保存'}</button>
            </div>
          </div>
        </div>
      )}

      {publishEditorOpen && (
        <div className="fixed inset-0 bg-black/50 z-[62] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setPublishEditorOpen(false)}
            className="absolute inset-0"
          />
          <div className={`relative ${t.bgSecondary} rounded-2xl shadow-2xl max-w-3xl w-full border ${t.border} p-6`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className={`text-lg font-bold flex items-center gap-2 ${t.text}`}>
                <Edit2 className="w-5 h-5 text-indigo-500" />
                编辑发送消息
              </h3>
              <button
                type="button"
                onClick={() => setPublishEditorOpen(false)}
                className={`${t.textMuted} hover:${t.text} p-1 ${t.bgHover} rounded-lg transition-colors`}
                title="关闭 (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={`text-xs ${t.textMuted} block mb-1`}>Topic</label>
                <input
                  type="text"
                  value={publishEditorTopic}
                  onChange={(e) => setPublishEditorTopic(e.target.value)}
                  className={`w-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-2.5 text-sm font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${t.text}`}
                  placeholder="Topic (e.g. test/topic)"
                />
              </div>
              <div>
                <label className={`text-xs ${t.textMuted} block mb-1`}>Payload</label>
                <textarea
                  autoFocus
                  value={publishEditorPayload}
                  onChange={(e) => setPublishEditorPayload(e.target.value)}
                  className={`w-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-3 text-sm font-mono resize-y focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all min-h-[260px] ${t.text}`}
                  placeholder='Payload (e.g. {"msg": "Hello"})'
                />
                <div className={`text-[10px] mt-1 ${t.textMuted}`}>快捷键：Ctrl/Cmd + Enter 应用并关闭</div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setPublishEditorOpen(false)}
                className={`px-4 py-2 ${t.bgTertiary} ${t.bgHover} rounded-xl text-sm font-medium transition-colors ${t.textSecondary}`}
              >
                取消
              </button>
              <button
                type="button"
                onClick={applyPublishEditor}
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20"
              >
                应用
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuickActionsPanel && (
        <div className="fixed inset-0 bg-black/50 z-[65] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`${t.bgSecondary} rounded-2xl shadow-2xl max-w-2xl w-full border ${t.border} p-6`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className={`text-lg font-bold flex items-center gap-2 ${t.text}`}>
                <Zap className="w-5 h-5 text-amber-500" />
                快捷指令
              </h3>
              <button
                onClick={() => { setShowQuickActionsPanel(false); setQuickActionQuery(''); }}
                className={`${t.textMuted} hover:${t.text} p-1 ${t.bgHover} rounded-lg transition-colors`}
                title="关闭 (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <div className={`flex-1 flex items-center gap-2 ${t.bgInput} border ${t.border} rounded-xl px-3 py-2`}>
                <Search className={`w-4 h-4 ${t.textMuted}`} />
                <input
                  autoFocus
                  value={quickActionQuery}
                  onChange={(e) => setQuickActionQuery(e.target.value)}
                  placeholder="搜索 名称 / Topic / Payload..."
                  className={`flex-1 bg-transparent text-sm outline-none ${t.text}`}
                />
              </div>
              <button
                onClick={() => setQuickActionQuery('')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${t.bgTertiary} ${t.textSecondary} border ${t.border} ${t.bgHover}`}
              >
                清空
              </button>
            </div>
            <div className={`${t.bgTertiary} border ${t.border} rounded-xl mb-2 overflow-hidden`}>
              <button
                type="button"
                onClick={() => setShowGroupModeSettings(prev => !prev)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 ${t.bgHover} transition-colors`}
              >
                <div className="flex items-center gap-2">
                  <LayoutDashboard className={`w-4 h-4 ${t.textMuted}`} />
                  <span className={`text-xs font-semibold ${t.textSecondary}`}>分组方式</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${t.border} ${t.textMuted}`}>
                    {quickActionGroupMode === 'smart' ? '智能' : 'Topic 前缀'}
                  </span>
                </div>
                {showGroupModeSettings
                  ? <ChevronUp className={`w-3.5 h-3.5 ${t.textMuted}`} />
                  : <ChevronDown className={`w-3.5 h-3.5 ${t.textMuted}`} />
                }
              </button>
              {showGroupModeSettings && (
                <div className="px-3 pb-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setQuickActionGroupMode('smart')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    quickActionGroupMode === 'smart'
                      ? (theme === 'light' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200')
                      : `${t.bgSecondary} ${t.border} ${t.textSecondary} ${t.bgHover}`
                  }`}
                  title="手动分组优先；未设置时自动按名称前缀与 Topic 归类"
                >
                  智能（名称 + Topic）
                </button>
                <button
                  type="button"
                  onClick={() => setQuickActionGroupMode('topic-prefix')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    quickActionGroupMode === 'topic-prefix'
                      ? (theme === 'light' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200')
                      : `${t.bgSecondary} ${t.border} ${t.textSecondary} ${t.bgHover}`
                  }`}
                  title="手动分组优先；其余按 Topic 前缀段数归类"
                >
                  Topic 前缀
                </button>
              </div>
              {quickActionGroupMode === 'topic-prefix' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs ${t.textMuted}`}>前缀段数</span>
                  {quickActionTopicPrefixDepthOptions.map((n) => {
                    const active = quickActionTopicPrefixDepth === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setQuickActionTopicPrefixDepth(n)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                          active
                            ? (theme === 'light' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200')
                            : `${t.bgSecondary} ${t.border} ${t.textSecondary} ${t.bgHover}`
                        }`}
                        title="按 Topic 前几段分组"
                      >
                        {n === 0 ? '全部' : `${n} 段`}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className={`text-[11px] ${t.textMuted}`}>
                {quickActionGroupMode === 'topic-prefix'
                  ? `手动分组优先；其余按 Topic 前 ${quickActionTopicPrefixDepth === 0 ? '全部' : `${quickActionTopicPrefixDepth} 段`} 自动归类。`
                  : '手动分组优先；未设置时自动按"名称前缀 / Topic 前缀"归类。'}
              </div>
                </div>
              )}
            </div>

            {(() => {
              const q = (quickActionQuery || '').trim().toLowerCase();
              const all = Array.isArray(quickActions) ? quickActions : [];
              const match = (a) => `${a?.name || ''} ${a?.topic || ''} ${a?.payload || ''}`.toLowerCase().includes(q);
              const filtered = q ? all.filter(match) : all;
              const pinned = !q ? all.filter((a) => a && a.pinned) : [];
              // UX: 快捷指令弹窗不展示"最近使用"（用户反馈干扰查找）。

              const ActionRow = ({ action, displayNameOverride }) => {
                const { group: resolvedGroup } = getActionGroup(action);
                const rowKey = actionRowKey(action);
                return (
                  <div
                    data-action-key={rowKey}
                    onClick={() => sendQuickAction(action)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        sendQuickAction(action);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={`w-full text-left ${t.card} border hover:border-amber-500/30 rounded-xl p-3 transition-all ${t.bgHover}`}
                    title="点击直接发送"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`font-bold text-sm ${t.text} truncate`} title={action?.name}>{displayNameOverride || action?.name}</div>
                        <div className={`text-[11px] ${t.textMuted} truncate mt-1`}>{action?.topic}</div>
                        {resolvedGroup && resolvedGroup !== '未分组' && (
                          <div className={`text-[10px] ${t.textMuted} truncate mt-1`}>分组：{resolvedGroup}</div>
                        )}
                        <div className={`text-[11px] ${t.textSecondary} truncate mt-1 font-mono`}>{String(action?.payload || '')}</div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleActionPinned(action?.id); }}
                          className={`p-1 rounded-lg border ${t.border} ${t.bgSecondary} ${t.bgHover} transition-colors`}
                          title={action?.pinned ? '取消置顶' : '置顶'}
                        >
                          <Star className={`w-4 h-4 ${action?.pinned ? (theme === 'light' ? 'text-amber-600' : 'text-amber-300') : t.textMuted}`} fill={action?.pinned ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleStartEditAction(action, e)}
                          className={`p-1 rounded-lg border ${t.border} ${t.bgSecondary} ${t.bgHover} transition-colors`}
                          title="编辑指令"
                        >
                          <Edit2 className={`w-4 h-4 ${t.textMuted}`} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleSetActionGroup(action, e)}
                          className={`p-1 rounded-lg border ${t.border} ${t.bgSecondary} ${t.bgHover} transition-colors`}
                          title="设置分组（留空则自动）"
                        >
                          <Layout className={`w-4 h-4 ${action?.group ? (theme === 'light' ? 'text-indigo-600' : 'text-indigo-300') : t.textMuted}`} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteAction(action?.id, e)}
                          className={`p-1 rounded-lg border ${t.border} ${t.bgSecondary} ${t.bgHover} transition-colors`}
                          title="删除"
                        >
                          <Trash2 className={`w-4 h-4 ${t.textMuted}`} />
                        </button>
                        <span className={`text-[10px] ${t.textMuted} border ${t.border} rounded-full px-2 py-0.5`}>
                          QoS {action?.qos ?? 0}{action?.retain ? ' · Retain' : ''}
                        </span>
                        <div className={`px-3 py-1 rounded-lg text-xs font-bold ${theme === 'light' ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-300'} flex items-center gap-1`}>
                          <Zap className="w-3 h-3" />
                          发送
                        </div>
                      </div>
                    </div>
                  </div>
                );
              };

              const Section = ({ title, items, grouped = false, collapseNamespace = 'default' }) => {
                if (!grouped) {
                  return (
                    <div className="space-y-2">
                      <div className={`text-xs font-semibold ${t.textMuted} px-1`}>{title}</div>
                      <div className="space-y-2">
                        {items.map((action) => (
                          <ActionRow
                            key={actionRowKey(action)}
                            action={action}
                          />
                        ))}
                      </div>
                    </div>
                  );
                }

                const groupedMap = new Map();
                for (const action of (items || [])) {
                  const { group, displayName } = getActionGroup(action);
                  if (!groupedMap.has(group)) groupedMap.set(group, []);
                  groupedMap.get(group).push({ action, displayName });
                }
                const groups = Array.from(groupedMap.entries());
                groups.sort((a, b) => {
                  if (a[0] === '未分组' && b[0] !== '未分组') return 1;
                  if (b[0] === '未分组' && a[0] !== '未分组') return -1;
                  return String(a[0]).localeCompare(String(b[0]));
                });

                return (
                  <div className="space-y-2">
                    <div className={`text-xs font-semibold ${t.textMuted} px-1`}>{title}</div>
                    <div className="space-y-3">
                      {groups.map(([group, rows]) => {
                        const collapseKey = `${collapseNamespace}::${group}`;
                        const isCollapsed = quickActionGroupCollapsed?.[collapseKey] ?? true;
                        return (
                          <div key={group} className={`${t.card} border rounded-xl p-3`}>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setQuickActionGroupCollapsed((prev) => ({ ...(prev || {}), [collapseKey]: !isCollapsed }))}
                                className={`flex-1 flex items-center justify-between gap-3 ${t.bgHover} rounded-lg px-2 py-1.5 transition-colors`}
                                title={isCollapsed ? '展开' : '收起'}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {isCollapsed ? (
                                    <ChevronDown className={`w-4 h-4 ${t.textMuted}`} />
                                  ) : (
                                    <ChevronUp className={`w-4 h-4 ${t.textMuted}`} />
                                  )}
                                  <div className={`text-sm font-bold ${t.text} truncate`}>{group}</div>
                                  <div className={`text-[10px] ${t.textMuted} border ${t.border} rounded-full px-2 py-0.5 shrink-0`}>
                                    {rows.length}
                                  </div>
                                </div>
                                <div className={`text-[11px] ${t.textMuted} shrink-0`}>
                                  {isCollapsed ? '展开' : '收起'}
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleSetGroupForAll(group, rows, e)}
                                className={`p-1.5 rounded-lg border ${t.border} ${t.bgSecondary} ${t.bgHover} transition-colors shrink-0`}
                                title="重命名分组"
                              >
                                <Edit2 className={`w-3.5 h-3.5 ${t.textMuted}`} />
                              </button>
                            </div>
                              {!isCollapsed && (
                                <div className="space-y-2 mt-3">
                                  {rows.map(({ action, displayName }) => (
                                    <ActionRow
                                      key={actionRowKey(action)}
                                      action={action}
                                      displayNameOverride={displayName || action?.name}
                                    />
                                  ))}
                                </div>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              };

              return (
                <div ref={quickActionsScrollRef} className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                  {!client?.connected && (
                    <div className={`p-3 rounded-xl border ${theme === 'light' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'} text-sm`}>
                      提示：当前未连接，点击发送会提示错误。请先连接 MQTT。
                    </div>
                  )}

                  {pinned.length > 0 && <Section title={`置顶（${pinned.length}）`} items={pinned} grouped collapseNamespace="pinned" />}
                  <Section title={q ? `搜索结果（${filtered.length}）` : `全部（${filtered.length}）`} items={filtered} grouped={filtered.length > 0} collapseNamespace="all" />

                  {filtered.length === 0 && (
                    <div className={`text-center py-10 border border-dashed ${t.border} rounded-xl text-sm ${t.textMuted}`}>
                      没有匹配的快捷指令
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {editingAction && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`${t.bgSecondary} rounded-2xl shadow-2xl max-w-lg w-full border ${t.border} p-6`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className={`text-lg font-bold flex items-center gap-2 ${t.text}`}>
                <Edit2 className="w-5 h-5 text-indigo-500" />
                编辑指令
              </h3>
              <button
                type="button"
                onClick={() => setEditingAction(null)}
                className={`${t.textMuted} hover:${t.text} p-1 ${t.bgHover} rounded-lg transition-colors`}
                title="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={`text-xs ${t.textMuted} block mb-1`}>名称</label>
                <input
                  type="text"
                  value={editingAction.name}
                  onChange={(e) => setEditingAction({ ...editingAction, name: e.target.value })}
                  className={`w-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${t.text}`}
                  placeholder="指令名称"
                />
              </div>
              <div>
                <label className={`text-xs ${t.textMuted} block mb-1`}>Topic</label>
                <input
                  type="text"
                  value={editingAction.topic}
                  onChange={(e) => setEditingAction({ ...editingAction, topic: e.target.value })}
                  className={`w-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-2.5 text-sm font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${t.text}`}
                  placeholder="test/topic"
                />
              </div>
              <div>
                <label className={`text-xs ${t.textMuted} block mb-1`}>Payload</label>
                <textarea
                  value={editingAction.payload}
                  onChange={(e) => setEditingAction({ ...editingAction, payload: e.target.value })}
                  onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSaveEditAction(); } }}
                  className={`w-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-3 text-sm font-mono resize-y focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all min-h-[120px] ${t.text}`}
                  placeholder='{"msg": "Hello"}'
                />
                <div className={`text-[10px] mt-1 ${t.textMuted}`}>Ctrl/Cmd + Enter 保存</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className={`text-xs ${t.textMuted}`}>QoS</label>
                  {[0, 1, 2].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setEditingAction({ ...editingAction, qos: q })}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                        editingAction.qos === q
                          ? (theme === 'light' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200')
                          : `${t.bgSecondary} ${t.border} ${t.textSecondary} ${t.bgHover}`
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <label className={`flex items-center gap-1.5 text-xs ${t.textMuted} cursor-pointer`}>
                  <input
                    type="checkbox"
                    checked={editingAction.retain}
                    onChange={(e) => setEditingAction({ ...editingAction, retain: e.target.checked })}
                    className="rounded bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-indigo-600"
                  />
                  Retain
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setEditingAction(null)}
                className={`px-4 py-2 ${t.bgTertiary} ${t.bgHover} rounded-xl text-sm font-medium transition-colors ${t.textSecondary}`}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveEditAction}
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={backupImportInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportBackupFileChange}
      />

      {/* 云同步弹窗 */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className={`${t.bgSecondary} rounded-2xl shadow-2xl max-w-md w-full border ${t.border} p-6`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-lg font-bold flex items-center gap-2 ${t.text}`}><Settings className="w-5 h-5 text-indigo-500"/> 同步与备份</h3>
              <button onClick={() => setShowSyncModal(false)} className={`${t.textMuted} hover:${t.text} p-1 ${t.bgHover} rounded-lg transition-colors`}><X className="w-5 h-5"/></button>
            </div>

            <div className={`p-4 ${t.bgTertiary} border ${t.border} rounded-xl space-y-3 mb-4`}>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                <div className={`text-sm font-semibold ${t.text}`}>本地备份</div>
                <div className={`text-xs ${t.textMuted}`}>（默认不包含密码）</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExportBackup(false)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${t.bgSecondary} ${t.textSecondary} border ${t.border} ${t.bgHover}`}
                >
                  <Download className="w-4 h-4" />
                  <span>导出</span>
                </button>
                <button
                  onClick={() => backupImportInputRef.current?.click()}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${t.bgSecondary} ${t.textSecondary} border ${t.border} ${t.bgHover}`}
                >
                  <FileJson className="w-4 h-4" />
                  <span>导入</span>
                </button>
              </div>
              <button
                onClick={handleExportBackupWithPasswords}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  theme === 'light'
                    ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20'
                }`}
                title="导出备份（包含密码，明文）"
              >
                <AlertCircle className="w-4 h-4" />
                <span>导出（含密码）</span>
              </button>
            </div>
            {!isFirebaseAvailable ? (
               <div className="p-4 bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-xl text-amber-800 dark:text-amber-200 text-sm"><p className="font-bold mb-1">云同步未启用</p><p className="text-xs opacity-80">当前环境未配置 Firebase，仅可使用本地备份/导入导出。</p></div>
            ) : (
              <>
                <p className={`text-sm ${t.textSecondary} mb-4`}>输入一个唯一的 <b className={t.text}>Space ID</b>，所有使用该 ID 的设备将实时同步数据。</p>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input type="text" value={inputSpaceId} onChange={(e) => setInputSpaceId(e.target.value)} placeholder="Space ID" className={`flex-1 ${t.bgInput} border ${t.border} rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${t.text}`}/>
                    <button
                      onClick={() => {
                        const rand = (typeof crypto !== 'undefined' && crypto.randomUUID)
                          ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
                          : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(0, 16);
                        setInputSpaceId(`space_${rand}`);
                      }}
                      className={`px-4 py-2.5 ${t.bgTertiary} ${t.bgHover} rounded-xl text-xs font-medium transition-colors`}
                    >
                      随机
                    </button>
                  </div>

                  <div className={`p-4 ${t.bgTertiary} border ${t.border} rounded-xl space-y-3`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold ${t.text}`}>端到端加密（推荐）</div>
                        <div className={`text-xs ${t.textMuted}`}>开启后云端仅存密文，不上传明文配置</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={syncEncryptEnabled}
                        onChange={(e) => setSyncEncryptEnabled(e.target.checked)}
                        className="rounded bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-emerald-600"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={`text-xs ${t.textMuted}`}>同步口令</label>
                      <input
                        type="password"
                        value={syncPassphrase}
                        onChange={(e) => setSyncPassphrase(e.target.value)}
                        disabled={!syncEncryptEnabled}
                        placeholder={syncEncryptEnabled ? '请输入口令（用于加密/解密）' : '关闭加密时无需口令'}
                        className={`w-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-2 text-sm outline-none transition-all ${t.text} ${
                          syncEncryptEnabled ? 'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20' : 'opacity-60'
                        }`}
                      />
                      <label className={`flex items-center gap-2 text-xs ${t.textSecondary}`}>
                        <input
                          type="checkbox"
                          checked={rememberPassphrase}
                          onChange={(e) => setRememberPassphrase(e.target.checked)}
                          disabled={!syncEncryptEnabled}
                          className="rounded bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-emerald-600"
                        />
                        <span>在本机记住口令（本次会话）</span>
                      </label>
                    </div>

                    {cloudCryptoError && (
                      <div className="p-3 bg-rose-100 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-700/50 rounded-xl text-rose-700 dark:text-rose-200 text-xs whitespace-pre-wrap">
                        {cloudCryptoError}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleConnectSync} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all">开启同步</button>
                    {syncSpaceId && <button onClick={handleDisconnectSync} className="px-4 bg-rose-100 hover:bg-rose-200 dark:bg-rose-600/20 dark:hover:bg-rose-600/30 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-600/30 rounded-xl font-medium transition-colors">断开</button>}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 左侧侧边栏 */}
      <aside className={`w-80 ${t.bgSecondary} backdrop-blur-xl border-r ${t.borderLight} flex flex-col shrink-0 transition-colors duration-300`}>

        {/* Logo 区域 */}
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className={`text-lg font-bold tracking-tight ${t.text}`}>MQTT <span className="text-indigo-500">Pro</span></h1>
                <p className={`text-xs ${t.textMuted}`}>Cloud Edition</p>
              </div>
            </div>
            {/* 主题切换按钮 */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl ${t.bgTertiary} ${t.bgHover} ${t.textSecondary} transition-all hover:scale-105`}
              title={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>

          {/* 连接状态卡片 */}
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

        {/* 统计卡片区 */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-3 gap-2">
            <div className={`${t.card} p-3 rounded-xl border text-center ${t.shadow}`}>
              <p className="text-lg font-bold text-blue-500">{msgStats.sent}</p>
              <p className={`text-[10px] ${t.textMuted}`}>发送</p>
            </div>
            <div className={`${t.card} p-3 rounded-xl border text-center ${t.shadow}`}>
              <p className="text-lg font-bold text-emerald-500">{msgStats.received}</p>
              <p className={`text-[10px] ${t.textMuted}`}>接收</p>
            </div>
            <div className={`${t.card} p-3 rounded-xl border text-center ${t.shadow}`}>
              <p className="text-lg font-bold text-rose-500">{msgStats.errors}</p>
              <p className={`text-[10px] ${t.textMuted}`}>错误</p>
            </div>
          </div>
        </div>

        {/* 连接配置 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4">

          {/* 配置折叠面板 */}
          <div className="mb-3">
            <button
              onClick={() => setConfigCollapsed(!configCollapsed)}
              className={`w-full flex items-center justify-between px-4 py-3 ${t.card} ${t.cardHover} rounded-xl border transition-all group`}
            >
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-500" />
                <span className={`text-sm font-medium ${t.textSecondary}`}>连接配置</span>
              </div>
              <div className="flex items-center gap-2">
                {connectStatus === 'connected' && <span className={`text-[10px] ${theme === 'light' ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/20 text-emerald-400'} px-2 py-0.5 rounded-full`}>在线</span>}
                {configCollapsed ? <ChevronDown className={`w-4 h-4 ${t.textMuted}`}/> : <ChevronUp className={`w-4 h-4 ${t.textMuted}`}/>}
              </div>
            </button>

            {!configCollapsed && (
              <div className={`mt-2 p-4 ${t.card} rounded-xl border space-y-3 animate-in fade-in slide-in-from-top-2 duration-200`}>
                <div className="flex gap-2">
                   <select className={`flex-1 ${t.bgInput} border ${t.border} text-xs rounded-lg px-3 py-2 focus:border-indigo-500 outline-none transition-all ${t.text}`} onChange={handleLoadConfig} value={connection.name || ""}>
                     <option value="" disabled>加载预设配置...</option>
                     {savedConfigs.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <button onClick={handleSaveConfig} title="保存配置" className={`p-2 ${t.bgTertiary} ${t.bgHover} border ${t.border} rounded-lg ${t.textMuted} hover:text-indigo-500 transition-colors`}><Save className="w-4 h-4"/></button>
                    {connection.name && <button onClick={handleDeleteConfig} title="删除配置" className={`p-2 ${t.bgTertiary} ${t.bgHover} border ${t.border} rounded-lg ${t.textMuted} hover:text-rose-500 transition-colors`}><Trash2 className="w-4 h-4"/></button>}
                 </div>

                 <select
                   value={selectedPresetBroker}
                   onChange={(e) => {
                     const name = e.target.value;
                     setSelectedPresetBroker(name);
                     if (name) applyPresetBroker(name);
                   }}
                   disabled={connectStatus !== 'disconnected'}
                   className={`w-full ${t.bgInput} border ${t.border} text-xs rounded-lg px-3 py-2 focus:border-indigo-500 outline-none transition-all disabled:opacity-50 ${t.text}`}
                 >
                   <option value="">公共服务器预设（快速填充）...</option>
                   {PRESET_BROKERS.map((b) => (
                     <option key={b.name} value={b.name}>{b.name}</option>
                   ))}
                 </select>

                 <input type="text" value={connection.host} onChange={(e) => setConnection({...connection, host: e.target.value})} disabled={connectStatus === 'connected'} className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none transition-all disabled:opacity-50 ${t.text}`} placeholder="Host (e.g. broker.emqx.io)"/>

                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={connection.port} onChange={(e) => handlePortChange(e.target.value)} disabled={connectStatus === 'connected'} className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none transition-all disabled:opacity-50 ${t.text}`} placeholder="Port"/>
                  <select value={connection.protocol} onChange={(e) => handleProtocolChange(e.target.value)} disabled={connectStatus === 'connected'} className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none transition-all disabled:opacity-50 ${t.text}`}>
                    <option value="ws">ws://</option>
                    <option value="wss">wss://</option>
                    <option value="mqtt" disabled={!isDesktopShell}>mqtt://{isDesktopShell ? '' : '（桌面端）'}</option>
                    <option value="mqtts" disabled={!isDesktopShell}>mqtts://{isDesktopShell ? '' : '（桌面端）'}</option>
                  </select>
                </div>

                {connection.protocol === 'wss' && (
                  <div className={`text-xs ${theme === 'light' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-amber-400/80 bg-amber-500/10 border-amber-500/20'} px-3 py-2 rounded-lg border`}>
                    提示: 如果服务器没有 SSL 证书，请使用 ws://
                  </div>
                )}

                {(connection.protocol === 'ws' || connection.protocol === 'wss') && (
                  <input
                    type="text"
                    value={connection.path}
                    onChange={(e) => setConnection({...connection, path: e.target.value})}
                    disabled={connectStatus === 'connected'}
                    className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none transition-all disabled:opacity-50 ${t.text}`}
                    placeholder="Path（仅 ws/wss 使用，例如 /mqtt）"
                  />
                )}

                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={connection.username} onChange={(e) => setConnection({...connection, username: e.target.value})} disabled={connectStatus === 'connected'} placeholder="用户名" className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none transition-all disabled:opacity-50 ${t.text}`}/>
                  <input type="password" value={connection.password} onChange={(e) => setConnection({...connection, password: e.target.value})} disabled={connectStatus === 'connected'} placeholder="密码" className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none transition-all disabled:opacity-50 ${t.text}`}/>
                </div>

                <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-400 font-medium">
                  {showAdvanced ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>} 高级设置
                </button>

                {showAdvanced && (
                  <div className={`p-3 ${t.bgTertiary} rounded-lg border ${t.borderLight} space-y-2`}>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className={`text-[10px] ${t.textMuted} block mb-1`}>Keep Alive (秒)</label>
                        <input type="number" value={advancedConfig.keepalive} onChange={(e) => setAdvancedConfig({...advancedConfig, keepalive: e.target.value})} className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-2 py-1 text-xs ${t.text}`}/>
                      </div>
                      <div className="flex-1">
                        <label className={`text-[10px] ${t.textMuted} block mb-1`}>协议版本</label>
                        <select value={advancedConfig.protocolVersion} onChange={(e) => setAdvancedConfig({...advancedConfig, protocolVersion: Number(e.target.value)})} className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-2 py-1 text-xs ${t.text}`}>
                          <option value={3}>MQTT 3.1</option>
                          <option value={4}>MQTT 3.1.1</option>
                          <option value={5}>MQTT 5.0</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={advancedConfig.clean} onChange={(e) => setAdvancedConfig({...advancedConfig, clean: e.target.checked})} className="rounded bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-indigo-600"/>
                        <span className={`text-xs ${t.textSecondary}`}>Clean Session</span>
                      </label>
                    </div>
                    <div className={`flex items-center gap-2 pt-2 border-t ${t.borderLight}`}>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={autoResubscribe} onChange={(e) => setAutoResubscribe(e.target.checked)} className="rounded bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-emerald-600"/>
                        <span className={`text-xs ${t.textSecondary}`}>自动重订阅</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer ml-auto">
                        <input type="checkbox" checked={autoReconnect} onChange={(e) => setAutoReconnect(e.target.checked)} className="rounded bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-amber-600"/>
                        <span className={`text-xs ${t.textSecondary}`}>自动重连</span>
                      </label>
                    </div>
                  </div>
                )}

                <button
                  onClick={connectStatus === 'connected' || connectStatus === 'connecting' || reconnectCount > 0 ? handleDisconnect : handleConnect}
                  disabled={!sdkReady}
                  className={`w-full text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all text-sm ${
                    connectStatus !== 'connected'
                      ? reconnectCount > 0
                        ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20'
                  } disabled:opacity-50`}
                >
                  {connectStatus !== 'connected' ? (
                    !sdkReady ? (
                      <><Loader2 className="w-4 h-4 animate-spin"/> Loading...</>
                    ) : connectStatus === 'connecting' && reconnectCount === 0 ? (
                      <><Square className="w-4 h-4 fill-current"/> 取消连接</>
                    ) : reconnectCount > 0 ? (
                      <><Square className="w-4 h-4 fill-current"/> 停止重连 ({reconnectCount})</>
                    ) : (
                      <><Play className="w-4 h-4 fill-current"/> 连接</>
                    )
                  ) : (
                    <><Square className="w-4 h-4 fill-current"/> 断开连接</>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* 订阅管理 */}
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setSubscriptionsCollapsed((v) => !v)}
              className={`w-full px-4 py-3 flex items-center gap-2 ${t.bgHover} rounded-xl transition-colors`}
              title={subscriptionsCollapsed ? '展开订阅' : '收起订阅'}
            >
              <Download className="w-4 h-4 text-emerald-500" />
              <span className={`text-sm font-medium ${t.textSecondary}`}>订阅监控</span>
              <span className={`text-xs ${t.textMuted} ml-auto`}>{subscriptions.length} 个</span>
              {subscriptionsCollapsed ? (
                <ChevronDown className={`w-4 h-4 ${t.textMuted}`} />
              ) : (
                <ChevronUp className={`w-4 h-4 ${t.textMuted}`} />
              )}
            </button>

            {!subscriptionsCollapsed && (
              <div className="space-y-2 mt-2">
                <div className="flex gap-2 px-2">
                  <input type="text" placeholder="Topic (e.g. #)" value={subTopic} onChange={(e) => setSubTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()} className={`flex-1 ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none transition-all ${t.text}`}/>
                  <button onClick={handleSubscribe} disabled={!client?.connected} className={`${theme === 'light' ? 'bg-emerald-100 hover:bg-emerald-600 text-emerald-600 hover:text-white' : 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white'} px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-all`}>订阅</button>
                </div>
                <div className="space-y-1 px-2">
                  {subMonitorSelectedTopics.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSubMonitorSelectedTopics([])}
                      className={`text-[10px] ${t.textMuted} hover:text-emerald-500 transition-colors mb-1 px-1`}
                    >
                      清除筛选（已选 {subMonitorSelectedTopics.length}）
                    </button>
                  )}
                  {subscriptions.map(sub => {
                    const isSelected = subMonitorSelectedTopics.includes(sub);
                    return (
                    <div key={sub} className={`flex items-center justify-between px-3 py-2 rounded-lg border group transition-all ${
                      isSelected
                        ? (theme === 'light' ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-500/10 border-emerald-500/30')
                        : `${t.card} hover:border-emerald-500/20`
                    }`}>
                      <button
                        type="button"
                        onClick={() => toggleSubMonitorTopicSelection(sub)}
                        className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                        title={isSelected ? `已选中：${sub}（再点取消）` : `点击筛选：${sub}`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30'
                              : (theme === 'light' ? 'border-2 border-slate-300' : 'border-2 border-slate-600')
                          }`}
                        >
                          {isSelected && (
                            <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                          )}
                        </span>
                        <span className={`text-xs font-mono truncate ${isSelected ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-emerald-500'}`} title={sub}>{sub}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleUnsubscribe(sub); }}
                        className={`${t.textMuted} hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all`}
                        title="取消订阅"
                      >
                        <Trash2 className="w-3 h-3"/>
                      </button>
                    </div>
                    );
                  })}
                  {subscriptions.length === 0 && <div className={`text-xs ${t.textMuted} text-center py-4 border border-dashed ${t.border} rounded-lg`}>暂无订阅</div>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部工具入口 */}
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

      {/* 右侧主内容区 */}
      <main className={`flex-1 flex flex-col min-w-0 ${t.bg} transition-colors duration-300`}>

        {/* 顶部 Header */}
        <header className={`sticky top-0 z-20 ${theme === 'light' ? 'bg-[#F8FAFC]/80' : 'bg-[#0B1120]/80'} backdrop-blur-xl border-b ${t.border} px-6 py-4 flex items-center justify-between shrink-0`}>
          <div>
            <h2 className={`text-xl font-bold ${t.text}`}>实时监控</h2>
            <p className={`${t.textMuted} text-sm mt-0.5`}>查看消息日志和发送数据</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted} group-focus-within:text-indigo-500 transition-colors`} size={16} />
              <input
                type="text"
                value={logFilter}
                onChange={e => setLogFilter(e.target.value)}
                placeholder="搜索日志..."
                ref={logFilterInputRef}
                className={`pl-9 pr-4 py-2 ${t.bgInput} border ${t.border} rounded-xl text-sm w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${t.text} placeholder:${t.textMuted}`}
              />
            </div>
            <button
              onClick={resetStats}
              className={`p-2 ${t.bgTertiary} border ${t.border} rounded-xl ${t.textSecondary} hover:${t.text} ${t.bgHover} transition-all`}
              title="重置统计"
            >
              <RotateCcw size={18} />
            </button>
            {isDevMode && (
              <button
                onClick={() => setEventCenterOpen(true)}
                title="事件中心（开发模式）"
                className={`relative p-2 ${t.bgTertiary} border ${t.border} rounded-xl ${t.textSecondary} hover:${t.text} ${t.bgHover} transition-all`}
              >
                <Bell size={18} />
                {msgStats.errors > 0 && <span className={`absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 ${theme === 'light' ? 'border-[#F8FAFC]' : 'border-[#0B1120]'}`}></span>}
              </button>
            )}
          </div>
        </header>

        {/* 日志区域 */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          <div className={`px-6 py-3 ${t.bgTertiary} border-b ${t.border} flex justify-between items-center shrink-0`}>
            <div className="flex items-center gap-3">
              <h3 className={`text-sm font-semibold ${t.textSecondary} flex items-center gap-2`}>
                <MessageSquare className="w-4 h-4 text-indigo-500"/> 消息日志
              </h3>
              <span className={`text-xs ${t.textMuted}`}>{filteredMessageLogs.length} 条记录</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setLogViewMode(m => m==='text'?'hex':'text')} className={`text-xs px-3 py-1.5 rounded-lg ${t.textSecondary} ${t.bgHover} transition-colors flex items-center gap-1`}>
                <Binary className="w-3 h-3"/>{logViewMode.toUpperCase()}
              </button>
              <button onClick={() => setIsAutoScroll(!isAutoScroll)} className={`text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${isAutoScroll ? (theme === 'light' ? 'text-emerald-600 bg-emerald-50' : 'text-emerald-400 bg-emerald-500/10') : (theme === 'light' ? 'text-amber-600 bg-amber-50' : 'text-amber-400 bg-amber-500/10')}`}>
                {isAutoScroll ? 'Auto' : 'Paused'}
              </button>
              <button onClick={() => setLogs([])} className={`text-xs px-3 py-1.5 rounded-lg ${t.textSecondary} ${t.bgHover} transition-colors`}>
                <Trash2 className="w-3 h-3"/>
              </button>
            </div>
          </div>

          {/* 日志列表 */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
            {filteredMessageLogs.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-full ${t.textMuted}`}>
                <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">暂无日志记录</p>
                <p className="text-xs mt-1">连接服务器并订阅主题后，消息将显示在这里</p>
              </div>
            ) : (
              filteredMessageLogs.map(log => (
                <div key={log.id} className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 group">
                  <div className={`text-xs ${t.textMuted} min-w-[70px] pt-2 font-mono`}>{log.timestamp}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${
                        log.type === 'sent' ? (theme === 'light' ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-blue-400 border-blue-500/30 bg-blue-500/10') :
                        log.type === 'received' ? (theme === 'light' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10') :
                        log.type === 'system' ? (theme === 'light' ? 'text-slate-600 border-slate-200 bg-slate-50' : 'text-slate-400 border-slate-500/30 bg-slate-500/10') :
                        (theme === 'light' ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-rose-400 border-rose-500/30 bg-rose-500/10')
                      }`}>{log.type}</span>
                      {log.topic && <span className={`text-xs ${t.textSecondary} font-semibold font-mono`}>{log.topic}</span>}
                      <div className="ml-auto flex items-center gap-1">
                        {!!log.topic && typeof log.payload === 'string' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); loadPublishDraft({ topic: log.topic, payload: log.payload }); }}
                            className={`opacity-0 group-hover:opacity-100 ${t.textMuted} hover:${t.text} p-1 ${t.bgHover} rounded transition-all`}
                            title="填充到发送区编辑"
                          >
                            <Edit2 className="w-3 h-3"/>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(String(log.payload ?? ''))}
                          className={`opacity-0 group-hover:opacity-100 ${t.textMuted} hover:${t.text} p-1 ${t.bgHover} rounded transition-all`}
                          title="复制 Payload"
                        >
                          <Copy className="w-3 h-3"/>
                        </button>
                      </div>
                    </div>
                    <div className={`p-4 rounded-xl text-sm break-all whitespace-pre-wrap border font-mono ${
                      log.type === 'sent' ? (theme === 'light' ? 'bg-blue-50 border-blue-100 text-blue-900' : 'bg-blue-500/5 border-blue-500/20 text-blue-200') :
                      log.type === 'received' ? (theme === 'light' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-200') :
                      log.type === 'system' ? (theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-700' : 'bg-slate-800/50 border-slate-700/50 text-slate-300') :
                      (theme === 'light' ? 'bg-rose-50 border-rose-100 text-rose-900' : 'bg-rose-500/5 border-rose-500/20 text-rose-200')
                    }`}>
                      {logViewMode === 'hex' ? (
                        <div className={`${theme === 'light' ? 'text-purple-600' : 'text-purple-300'} tracking-wider`}>{toHex(log.payload)}</div>
                      ) : (
                        isJson(log.payload) ? (
                          <pre className={`${theme === 'light' ? 'text-indigo-600' : 'text-indigo-300'} overflow-x-auto`}>{tryFormatJson(log.payload)}</pre>
                        ) : log.payload
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* 发布区域 */}
        <div className={`shrink-0 border-t ${t.border} ${t.bgSecondary} backdrop-blur-xl ${theme === 'light' ? 'shadow-[0_-4px_20px_rgba(0,0,0,0.05)]' : 'shadow-[0_-4px_20px_rgba(0,0,0,0.3)]'} z-10 transition-colors duration-300`}>
          <div className="p-4 space-y-3">

            {/* 第一行：Topic 和选项 */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={pubTopic}
                onChange={(e) => setPubTopic(e.target.value)}
                className={`flex-1 ${t.bgInput} border ${t.border} rounded-xl px-4 py-2.5 text-sm font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${t.text}`}
                placeholder="Topic (e.g. test/topic)"
              />

              <div className={`flex items-center gap-2 ${t.bgInput} border ${t.border} rounded-xl px-3 py-2`}>
                <select value={pubQoS} onChange={(e) => setPubQoS(Number(e.target.value))} className={`bg-transparent text-xs outline-none ${t.textSecondary}`}>
                  <option value={0}>QoS 0</option>
                  <option value={1}>QoS 1</option>
                  <option value={2}>QoS 2</option>
                </select>
                <div className={`w-px h-4 ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-700'}`}></div>
                <label className={`flex items-center gap-1.5 text-xs ${t.textSecondary} cursor-pointer`}>
                  <input type="checkbox" checked={pubRetain} onChange={e => setPubRetain(e.target.checked)} className="rounded bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-indigo-600 w-3.5 h-3.5"/>
                  Retain
                </label>
              </div>

              {/* 定时发送 */}
              <div className={`flex items-center gap-2 ${t.bgInput} border ${t.border} rounded-xl px-3 py-2`}>
                <Timer className={`w-4 h-4 ${t.textMuted}`}/>
                <input
                  type="number"
                  value={timerInterval}
                  onChange={(e) => setTimerInterval(Math.max(100, Number(e.target.value)))}
                  disabled={timerEnabled}
                  className={`w-16 bg-transparent text-xs outline-none text-center ${t.textSecondary}`}
                  placeholder="间隔"
                />
                <span className={`text-xs ${t.textMuted}`}>ms</span>
                <button
                  onClick={toggleTimer}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    timerEnabled
                      ? (theme === 'light' ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30')
                      : (theme === 'light' ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30')
                  }`}
                >
                  {timerEnabled ? '停止' : '定时'}
                </button>
              </div>

              <button
                onClick={() => setShowQuickActionsPanel(true)}
                className={`flex items-center gap-1.5 text-xs font-bold ${
                  theme === 'light'
                    ? 'text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100'
                    : 'text-amber-300 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20'
                } border px-3 py-2 rounded-xl transition-all`}
                title="打开快捷指令面板"
              >
                <Zap className="w-3.5 h-3.5"/> 快捷指令
                <span className={`ml-1 text-[10px] font-semibold ${theme === 'light' ? 'text-amber-600' : 'text-amber-300/80'}`}>{quickActions.length}</span>
              </button>

              <button onClick={handleSaveAction} className={`flex items-center gap-1.5 text-xs font-medium ${theme === 'light' ? 'text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100' : 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20'} border px-3 py-2 rounded-xl transition-all`}>
                <Plus className="w-3.5 h-3.5"/> 存为指令
              </button>
            </div>

            <div className={`flex items-center gap-2 ${t.bgTertiary} border ${t.border} rounded-xl px-3 py-2 overflow-x-auto custom-scrollbar`}>
              <div className={`text-xs font-semibold ${t.textMuted} shrink-0 flex items-center gap-1`}>
                <Star className="w-3.5 h-3.5" />
                常用
              </div>
              <div className="flex items-center gap-2 min-w-0">
                {commonActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => sendQuickAction(action, { closePanel: false })}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      theme === 'light'
                        ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                        : 'bg-amber-500/10 text-amber-200 border-amber-500/20 hover:bg-amber-500/20'
                    }`}
                    title={`${action.name}\n${action.topic}`}
                  >
                    {action.name}
                  </button>
                ))}
                {Array.from({ length: Math.max(0, 3 - commonActions.length) }).map((_, idx) => (
                  <button
                    key={`common-empty-${idx}`}
                    type="button"
                    onClick={() => setShowQuickActionsPanel(true)}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${t.bgSecondary} ${t.textSecondary} ${t.bgHover} ${t.border}`}
                    title="添加常用（置顶或最近使用会出现在这里）"
                  >
                    添加
                  </button>
                ))}
              </div>
            </div>

            {/* 消息输入和发送 */}
            <div className="flex gap-3">
              <div className="flex-1 min-w-0 relative">
                <textarea
                  ref={pubMessageTextareaRef}
                  value={pubMessage}
                  onChange={(e) => setPubMessage(e.target.value)}
                  className={`w-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-3 text-sm font-mono resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all h-24 ${t.text}`}
                  placeholder='Payload (e.g. {"msg": "Hello"})'
                />
                <button
                  type="button"
                  onClick={openPublishEditor}
                  className={`absolute top-2 right-2 p-2 rounded-lg ${t.bgTertiary} border ${t.border} ${t.textSecondary} ${t.bgHover} transition-colors`}
                  title="编辑即将发送的消息"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handlePublish}
                disabled={!client?.connected}
                className="w-24 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
              >
                <Send className="w-5 h-5"/>
                <span className="text-xs">发送</span>
                <span className="text-[10px] text-indigo-200 opacity-70">Ctrl+Enter</span>
              </button>
            </div>
          </div>
        </div>

        {isDevMode && eventCenterOpen && (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setEventCenterOpen(false)}
              className="absolute inset-0 bg-black/40"
            />
            <div className={`absolute right-0 top-0 h-full w-full max-w-md ${t.bgSecondary} border-l ${t.border} shadow-2xl flex flex-col`}>
              <div className={`p-4 border-b ${t.border} flex items-center gap-3`}>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold ${t.text}`}>事件中心</div>
                  <div className={`text-xs ${t.textMuted}`}>{filteredEventLogs.length} 条</div>
                </div>
                <button
                  type="button"
                  onClick={() => setDebugPacketLog(v => !v)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                    debugPacketLog
                      ? (theme === 'light' ? 'text-violet-700 bg-violet-50' : 'text-violet-300 bg-violet-500/10')
                      : (theme === 'light' ? 'text-slate-600 bg-slate-50' : 'text-slate-400 bg-slate-500/10')
                  }`}
                  title="packetsend/packetreceive（高频）"
                >
                  <Activity className="w-3 h-3"/>{debugPacketLog ? 'Pkt On' : 'Pkt Off'}
                </button>
                <button
                  type="button"
                  onClick={() => setEventCenterOpen(false)}
                  className={`p-2 ${t.bgTertiary} border ${t.border} rounded-xl ${t.textSecondary} hover:${t.text} ${t.bgHover} transition-all`}
                  title="关闭"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className={`p-4 border-b ${t.border} space-y-2`}>
                <div className="relative group">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted} group-focus-within:text-indigo-500 transition-colors`} size={16} />
                  <input
                    type="text"
                    value={eventFilter}
                    onChange={(e) => setEventFilter(e.target.value)}
                    placeholder="搜索事件..."
                    className={`pl-9 pr-4 py-2 ${t.bgInput} border ${t.border} rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${t.text} placeholder:${t.textMuted}`}
                  />
                </div>
                <div className={`text-[10px] ${t.textMuted}`}>
                  主视图仅显示发送/接收消息；连接过程、诊断、重连等事件会显示在这里。
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {filteredEventLogs.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center h-full ${t.textMuted}`}>
                    <Bell className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm">暂无事件</p>
                    <p className="text-xs mt-1">连接、重连、错误等会显示在这里</p>
                  </div>
                ) : (
                  filteredEventLogs.map((log) => (
                    <div key={log.id} className={`p-3 rounded-xl border ${t.border} ${t.bgTertiary}`}>
                      <div className="flex items-center gap-2">
                        <div className={`text-xs ${t.textMuted} font-mono`}>{log.timestamp}</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${
                          log.type === 'error' ? (theme === 'light' ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-rose-400 border-rose-500/30 bg-rose-500/10') :
                          log.type === 'system' ? (theme === 'light' ? 'text-slate-600 border-slate-200 bg-slate-50' : 'text-slate-400 border-slate-500/30 bg-slate-500/10') :
                          (theme === 'light' ? 'text-violet-700 border-violet-200 bg-violet-50' : 'text-violet-300 border-violet-500/30 bg-violet-500/10')
                        }`}>{log.type}</span>
                        {log.topic && <span className={`text-xs ${t.textSecondary} font-semibold font-mono truncate`}>{log.topic}</span>}
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText([log.topic, log.payload, log.details].filter(Boolean).join('\n'))}
                          className={`ml-auto ${t.textMuted} hover:${t.text} p-1 ${t.bgHover} rounded transition-all`}
                          title="复制"
                        >
                          <Copy className="w-3 h-3"/>
                        </button>
                      </div>
                      <div className={`mt-2 text-xs whitespace-pre-wrap break-words font-mono ${t.text}`}>
                        {log.payload}
                      </div>
                      {!!log.details && (
                        <div className={`mt-2 text-[11px] whitespace-pre-wrap break-words ${t.textMuted}`}>
                          {log.details}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${theme === 'light' ? '#cbd5e1' : '#334155'}; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${theme === 'light' ? '#94a3b8' : '#475569'}; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-from-bottom-2 { from { transform: translateY(8px); } to { transform: translateY(0); } }
        .animate-in { animation: fade-in 0.2s ease-out, slide-in-from-bottom-2 0.2s ease-out; }
      `}</style>
    </div>
  );
}
