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
  Bell, LayoutDashboard, Sun, Moon
} from 'lucide-react';

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
  const isElectronRuntime =
    typeof navigator !== 'undefined' &&
    typeof navigator.userAgent === 'string' &&
    navigator.userAgent.includes('Electron');
  const hasPreload =
    typeof window !== 'undefined' && window.__MQTT_PRO_DESKTOP__ === true;
  const isDesktopShell = typeof window !== 'undefined' && (hasPreload || isElectronRuntime);
  const mqttSource = typeof window !== 'undefined' ? window.__MQTT_PRO_MQTT_SOURCE__ : undefined;

  const getDesktopTcpCapable = () => {
    if (typeof window === 'undefined') return false;
    const sourceNow = window.__MQTT_PRO_MQTT_SOURCE__;
    const preloadOk = window.__MQTT_PRO_DESKTOP__ === true;
    return (
      isElectronRuntime &&
      preloadOk &&
      sourceNow === 'native' &&
      typeof window.mqtt?.connect === 'function'
    );
  };

  // --- 用户与云同步状态 ---
  const [user, setUser] = useState(null);
  const [syncSpaceId, setSyncSpaceId] = useState(''); 
  const [inputSpaceId, setInputSpaceId] = useState('');
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  
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

  const [subscriptions, setSubscriptions] = useState([]);
  const [subTopic, setSubTopic] = useState('test/topic');
  
  const [pubTopic, setPubTopic] = useState('test/topic');
  const [pubMessage, setPubMessage] = useState('{"msg": "Hello MQTT"}');
  const [pubQoS, setPubQoS] = useState(0);
  const [pubRetain, setPubRetain] = useState(false); 

  // 日志
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [logViewMode, setLogViewMode] = useState('text');
  const logsEndRef = useRef(null);

  // 消息统计
  const [msgStats, setMsgStats] = useState({ sent: 0, received: 0, errors: 0 });
  const [showStats, setShowStats] = useState(false);

  // 定时发送
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerInterval, setTimerInterval] = useState(1000);
  const timerRef = useRef(null);

  // 自动重订阅
  const [autoResubscribe, setAutoResubscribe] = useState(true);
  const lastSubscriptionsRef = useRef([]);

  // 消息模板变量
  const [templateVars, setTemplateVars] = useState({
    timestamp: () => Date.now(),
    datetime: () => new Date().toISOString(),
    random: () => Math.random().toString(36).substr(2, 8),
    count: (() => { let c = 0; return () => ++c; })()
  });
  const msgCountRef = useRef(0);

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
    // 亮色主题 (参考 houtai.html)
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

    // Electron 环境但 mqtt 还没加载：等待 preload 注入（或降级为 CDN 版本，仅支持 ws/wss）
    if (isElectronRuntime) {
      console.log('[App] Electron 环境，等待 preload 注入 mqtt...');

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
  }, [isElectronRuntime]);

  useEffect(() => {
    if (isFirebaseAvailable && auth) {
      signInAnonymously(auth).catch(e => console.error("Auth failed:", e));
      return onAuthStateChanged(auth, setUser);
    }
  }, []);

  useEffect(() => {
    const localConfigs = localStorage.getItem('mqtt_configs');
    const localActions = localStorage.getItem('mqtt_quick_actions');
    const lastSyncId = localStorage.getItem('mqtt_sync_id');
    if (localConfigs) setSavedConfigs(JSON.parse(localConfigs));
    if (localActions) setQuickActions(JSON.parse(localActions));
    if (lastSyncId) { setSyncSpaceId(lastSyncId); setInputSpaceId(lastSyncId); }
  }, []);

  // --- 云同步监听 ---
  useEffect(() => {
    if (!isFirebaseAvailable || !user || !syncSpaceId) { setIsCloudConnected(false); return; }
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', `mqtt_space_${syncSpaceId}`);
      setIsCloudConnected(true);
      addLog('system', '', `已连接云同步空间: ${syncSpaceId}`);

      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.configs) {
            setSavedConfigs(data.configs);
            localStorage.setItem('mqtt_configs', JSON.stringify(data.configs));
          }
          if (data.actions) {
            setQuickActions(data.actions);
            localStorage.setItem('mqtt_quick_actions', JSON.stringify(data.actions));
          }
        } else {
          saveToCloud(savedConfigs, quickActions);
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
  }, [user, syncSpaceId]);

  const saveToCloud = async (newConfigs, newActions) => {
    if (!isFirebaseAvailable || !user || !syncSpaceId) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', `mqtt_space_${syncSpaceId}`);
      await setDoc(docRef, {
        configs: newConfigs || savedConfigs,
        actions: newActions || quickActions,
        updatedAt: Date.now(),
        updatedBy: user.uid
      }, { merge: true });
    } catch (e) { addLog('error', '', '云端保存失败'); }
  };

  const updateData = (type, newData) => {
    if (type === 'configs') {
      setSavedConfigs(newData);
      localStorage.setItem('mqtt_configs', JSON.stringify(newData));
      if (syncSpaceId) saveToCloud(newData, null);
    } else if (type === 'actions') {
      setQuickActions(newData);
      localStorage.setItem('mqtt_quick_actions', JSON.stringify(newData));
      if (syncSpaceId) saveToCloud(null, newData);
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
        qos: pubQoS, retain: pubRetain 
      };
      const newActions = [...quickActions, newAction];
      updateData('actions', newActions);
    });
  };

  const handleLoadAction = (action) => {
    setPubTopic(action.topic); setPubMessage(action.payload);
    setPubQoS(action.qos); setPubRetain(action.retain);
  };

  const handleFireAction = (action) => {
    if (!client || !client.connected) return addLog('error', '', '请先连接服务器');
    client.publish(action.topic, action.payload, { qos: action.qos, retain: action.retain }, (err) => {
      if (err) addLog('error', action.topic, `指令 "${action.name}" 发送失败: ${err.message}`);
      else addLog('sent', action.topic, action.payload, `指令: ${action.name}`);
    });
  };

  const handleDeleteAction = (id, e) => {
    e.stopPropagation();
    openConfirmModal("确定删除此快捷指令?", () => {
      const newActions = quickActions.filter(t => t.id !== id);
      updateData('actions', newActions);
    });
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
      const newLogs = [...prev, { id: Date.now(), timestamp: new Date().toLocaleTimeString(), type, topic, payload, details }];
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

  // 解析消息模板变量
  const parseMessageTemplate = (message) => {
    msgCountRef.current++;
    return message
      .replace(/\{\{timestamp\}\}/g, Date.now())
      .replace(/\{\{datetime\}\}/g, new Date().toISOString())
      .replace(/\{\{random\}\}/g, Math.random().toString(36).substr(2, 8))
      .replace(/\{\{count\}\}/g, msgCountRef.current)
      .replace(/\{\{uuid\}\}/g, crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  };

  // 诊断连接问题
  const diagnoseConnectionError = (err, url) => {
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
    if (!isElectronRuntime && (connection.protocol === 'mqtt' || connection.protocol === 'mqtts')) {
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
    if (client) { client.end(); setClient(null); }
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
        reconnectPeriod: 3000,      // 增加到3秒，避免频繁重连
        protocolId: advancedConfig.protocolVersion === 3 ? 'MQIsdp' : 'MQTT',
        protocolVersion: Number(advancedConfig.protocolVersion)
      };
      if (advancedConfig.willEnabled) opts.will = { topic: advancedConfig.willTopic, payload: advancedConfig.willPayload, qos: Number(advancedConfig.willQos), retain: advancedConfig.willRetain };

      addLog('system', '', `连接选项: timeout=${opts.connectTimeout}ms, reconnect=${opts.reconnectPeriod}ms, protocol=${opts.protocolId} v${opts.protocolVersion}`);

      const newClient = window.mqtt.connect(url, opts);

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
        addLog('error', '', `❌ 连接错误: ${errorMsg}`);

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
          Object.entries(errorDetails).filter(([_, v]) => v != null)
        );

        if (Object.keys(filteredDetails).length > 1) {
          addLog('system', '', `错误详情: ${JSON.stringify(filteredDetails, null, 2)}`);
        }

        const diagnosis = diagnoseConnectionError(err, url);
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
        if (reconnectCount === 0) {
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
        if (reconnectCount === 0) {
          addLog('system', '', `📤 发送数据包: ${packet.cmd}`);
        }
      });

      // 包接收事件（用于调试）
      newClient.on('packetreceive', (packet) => {
        if (reconnectCount === 0) {
          addLog('system', '', `📥 接收数据包: ${packet.cmd}`);
        }
      });

      newClient.on('message', (t, m) => addLog('received', t, m.toString()));
      setClient(newClient);
    } catch (e) {
      setConnectStatus('error');
      addLog('error', '', e.message);
      const diagnosis = diagnoseConnectionError(e, url);
      if (diagnosis) addLog('system', '', diagnosis);
    }
  };

  const handleDisconnect = () => {
    // 保存当前订阅列表供重连使用
    if (subscriptions.length > 0) {
      lastSubscriptionsRef.current = [...subscriptions];
    }
    // 停止定时发送
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setTimerEnabled(false);
    }
    if (client) {
      // 强制结束连接，传入true表示不再重连
      client.end(true);
      setClient(null);
      setConnectStatus('disconnected');
      setSubscriptions([]);
      setReconnectCount(0); // 重置重连计数
      addLog('system', '', '✅ 已断开连接（停止重连）');
    }
  };

  const handleSubscribe = () => {
    if (client?.connected && subTopic && !subscriptions.includes(subTopic)) {
      client.subscribe(subTopic, e => {
        if (!e) {
          setSubscriptions(p => [...p, subTopic]);
          lastSubscriptionsRef.current = [...lastSubscriptionsRef.current.filter(t => t !== subTopic), subTopic];
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
          setSubscriptions(p => p.filter(i => i !== t));
          lastSubscriptionsRef.current = lastSubscriptionsRef.current.filter(i => i !== t);
          addLog('system', t, '退订成功');
        }
      });
    }
  };

  const handlePublish = () => {
    if (!client?.connected) return addLog('error', '', '请先连接');
    if (!pubTopic) return addLog('error', '', '请输入 Topic');

    // 解析消息模板
    const parsedMessage = parseMessageTemplate(pubMessage);

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
        const parsedMessage = parseMessageTemplate(pubMessage);
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
      // Ctrl/Cmd + Enter: 发送消息
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handlePublish();
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
        else if (connectStatus !== 'connecting') handleConnect();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [client, connectStatus, pubTopic, pubMessage, pubQoS, pubRetain]);

  // 重置统计
  const resetStats = () => {
    setMsgStats({ sent: 0, received: 0, errors: 0 });
    msgCountRef.current = 0;
  };
  
  // Formatters
  const formatDuration = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  const toHex = (str) => { let h=''; for(let i=0;i<str.length;i++) h+=str.charCodeAt(i).toString(16).padStart(2,'0')+' '; return h.toUpperCase(); };
  const isJson = (str) => { try { JSON.parse(str); return true; } catch { return false; } };
  const tryFormatJson = (str) => { try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; } };

  const filteredLogs = logs.filter(log => !logFilter || (log.topic+log.payload+log.type).toLowerCase().includes(logFilter.toLowerCase()));

  // 统计卡片组件
  const StatCard = ({ label, value, icon: Icon, trend, trendValue, positive, color = 'blue' }) => {
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
            <Icon className="w-4 h-4" />
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

      {/* 云同步弹窗 */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className={`${t.bgSecondary} rounded-2xl shadow-2xl max-w-md w-full border ${t.border} p-6`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-lg font-bold flex items-center gap-2 ${t.text}`}><Cloud className="w-5 h-5 text-indigo-500"/> 多设备云同步</h3>
              <button onClick={() => setShowSyncModal(false)} className={`${t.textMuted} hover:${t.text} p-1 ${t.bgHover} rounded-lg transition-colors`}><X className="w-5 h-5"/></button>
            </div>
            {!isFirebaseAvailable ? (
               <div className="p-4 bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-xl text-amber-800 dark:text-amber-200 text-sm"><p className="font-bold mb-1">功能未开启</p><p className="text-xs opacity-80">当前环境未配置 Firebase，无法使用云同步功能。</p></div>
            ) : (
              <>
                <p className={`text-sm ${t.textSecondary} mb-4`}>输入一个唯一的 <b className={t.text}>Space ID</b>，所有使用该 ID 的设备将实时同步数据。</p>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input type="text" value={inputSpaceId} onChange={(e) => setInputSpaceId(e.target.value)} placeholder="Space ID" className={`flex-1 ${t.bgInput} border ${t.border} rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${t.text}`}/>
                    <button onClick={() => setInputSpaceId(`space_${Math.random().toString(36).substr(2, 6)}`)} className={`px-4 py-2.5 ${t.bgTertiary} ${t.bgHover} rounded-xl text-xs font-medium transition-colors`}>随机</button>
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

                <input type="text" value={connection.host} onChange={(e) => setConnection({...connection, host: e.target.value})} disabled={connectStatus === 'connected'} className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none transition-all disabled:opacity-50 ${t.text}`} placeholder="Host (e.g. broker.emqx.io)"/>

                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={connection.port} onChange={(e) => handlePortChange(e.target.value)} disabled={connectStatus === 'connected'} className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none transition-all disabled:opacity-50 ${t.text}`} placeholder="Port"/>
                  <select value={connection.protocol} onChange={(e) => handleProtocolChange(e.target.value)} disabled={connectStatus === 'connected'} className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none transition-all disabled:opacity-50 ${t.text}`}>
                    <option value="ws">ws://</option>
                    <option value="wss">wss://</option>
                    <option value="mqtt" disabled={!isElectronRuntime}>mqtt://{isElectronRuntime ? '' : '（桌面端）'}</option>
                    <option value="mqtts" disabled={!isElectronRuntime}>mqtts://{isElectronRuntime ? '' : '（桌面端）'}</option>
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
                    </div>
                  </div>
                )}

                <button
                  onClick={connectStatus !== 'connected' ? handleConnect : handleDisconnect}
                  disabled={connectStatus === 'connecting' && reconnectCount === 0 || !sdkReady}
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
            <div className="px-4 py-3 flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-500" />
              <span className={`text-sm font-medium ${t.textSecondary}`}>订阅监控</span>
              <span className={`text-xs ${t.textMuted} ml-auto`}>{subscriptions.length} 个</span>
            </div>
            <div className="space-y-2">
              <div className="flex gap-2 px-2">
                <input type="text" placeholder="Topic (e.g. #)" value={subTopic} onChange={(e) => setSubTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()} className={`flex-1 ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none transition-all ${t.text}`}/>
                <button onClick={handleSubscribe} disabled={!client?.connected} className={`${theme === 'light' ? 'bg-emerald-100 hover:bg-emerald-600 text-emerald-600 hover:text-white' : 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white'} px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-all`}>订阅</button>
              </div>
              <div className="space-y-1 px-2 max-h-32 overflow-y-auto custom-scrollbar">
                {subscriptions.map(sub => (
                  <div key={sub} className={`flex items-center justify-between ${t.card} px-3 py-2 rounded-lg border group hover:border-emerald-500/30 transition-all`}>
                    <span className="text-xs text-emerald-500 font-mono truncate mr-2" title={sub}>{sub}</span>
                    <button onClick={() => handleUnsubscribe(sub)} className={`${t.textMuted} hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all`}><Trash2 className="w-3 h-3"/></button>
                  </div>
                ))}
                {subscriptions.length === 0 && <div className={`text-xs ${t.textMuted} text-center py-4 border border-dashed ${t.border} rounded-lg`}>暂无订阅</div>}
              </div>
            </div>
          </div>

          {/* 快捷指令 */}
          <div className="mb-4">
            <div className="px-4 py-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className={`text-sm font-medium ${t.textSecondary}`}>快捷指令</span>
              <span className={`text-xs ${t.textMuted} ml-auto`}>{quickActions.length} 个</span>
            </div>
            <div className="space-y-2 px-2 max-h-48 overflow-y-auto custom-scrollbar">
              {quickActions.length === 0 ? (
                <div className={`text-center py-6 border border-dashed ${t.border} rounded-xl text-xs ${t.textMuted}`}>
                  空空如也<br/>请在右侧保存指令
                </div>
              ) : (
                quickActions.map(action => (
                  <div key={action.id} className={`${t.card} border hover:border-amber-500/30 rounded-xl p-3 group transition-all`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`font-bold text-sm ${t.text}`}>{action.name}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleLoadAction(action)} className={`p-1 ${t.bgHover} rounded ${t.textMuted} hover:text-indigo-500 transition-colors`} title="加载"><Edit2 className="w-3 h-3"/></button>
                        <button onClick={(e) => handleDeleteAction(action.id, e)} className={`p-1 ${t.bgHover} rounded ${t.textMuted} hover:text-rose-500 transition-colors`} title="删除"><Trash2 className="w-3 h-3"/></button>
                      </div>
                    </div>
                    <div className={`text-[10px] ${t.textMuted} truncate mb-2`}>{action.topic}</div>
                    <div className="flex items-center gap-2">
                      <code className={`flex-1 text-[10px] ${t.textSecondary} ${t.bgTertiary} px-2 py-1 rounded-lg truncate font-mono border ${t.borderLight}`}>{action.payload}</code>
                      <button onClick={() => handleFireAction(action)} className={`${theme === 'light' ? 'bg-amber-100 hover:bg-amber-500 text-amber-600 hover:text-white' : 'bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-white'} px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0`}>
                        <Zap className="w-3 h-3"/> 发送
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 底部云同步按钮 */}
        <div className={`p-4 border-t ${t.borderLight}`}>
          <button
            onClick={() => setShowSyncModal(true)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              !isFirebaseAvailable
                ? `opacity-50 cursor-not-allowed ${t.bgTertiary} ${t.textMuted} border ${t.border}`
                : isCloudConnected
                  ? `${theme === 'light' ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30'}`
                  : `${t.bgTertiary} ${t.textSecondary} border ${t.border} ${t.bgHover}`
            }`}
          >
            {isCloudConnected ? <Cloud className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            <span>{isCloudConnected ? '已连接云同步' : '开启云同步'}</span>
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
            <button className={`relative p-2 ${t.bgTertiary} border ${t.border} rounded-xl ${t.textSecondary} hover:${t.text} ${t.bgHover} transition-all`}>
              <Bell size={18} />
              {msgStats.errors > 0 && <span className={`absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 ${theme === 'light' ? 'border-[#F8FAFC]' : 'border-[#0B1120]'}`}></span>}
            </button>
          </div>
        </header>

        {/* 日志区域 */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          <div className={`px-6 py-3 ${t.bgTertiary} border-b ${t.border} flex justify-between items-center shrink-0`}>
            <div className="flex items-center gap-3">
              <h3 className={`text-sm font-semibold ${t.textSecondary} flex items-center gap-2`}>
                <MessageSquare className="w-4 h-4 text-indigo-500"/> 消息日志
              </h3>
              <span className={`text-xs ${t.textMuted}`}>{filteredLogs.length} 条记录</span>
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
            {filteredLogs.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-full ${t.textMuted}`}>
                <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">暂无日志记录</p>
                <p className="text-xs mt-1">连接服务器并订阅主题后，消息将显示在这里</p>
              </div>
            ) : (
              filteredLogs.map(log => (
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
                      <button onClick={() => navigator.clipboard.writeText(log.payload)} className={`ml-auto opacity-0 group-hover:opacity-100 ${t.textMuted} hover:${t.text} p-1 ${t.bgHover} rounded transition-all`}>
                        <Copy className="w-3 h-3"/>
                      </button>
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

              <button onClick={handleSaveAction} className={`flex items-center gap-1.5 text-xs font-medium ${theme === 'light' ? 'text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100' : 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20'} border px-3 py-2 rounded-xl transition-all`}>
                <Plus className="w-3.5 h-3.5"/> 存为指令
              </button>
            </div>

            {/* 变量提示 */}
            <div className={`flex items-center gap-2 text-xs ${t.textMuted}`}>
              <Variable className="w-3.5 h-3.5"/>
              <span>支持变量:</span>
              <code className={`${t.bgTertiary} px-1.5 py-0.5 rounded ${theme === 'light' ? 'text-indigo-600' : 'text-indigo-400'} border ${t.border}`}>{"{{timestamp}}"}</code>
              <code className={`${t.bgTertiary} px-1.5 py-0.5 rounded ${theme === 'light' ? 'text-indigo-600' : 'text-indigo-400'} border ${t.border}`}>{"{{datetime}}"}</code>
              <code className={`${t.bgTertiary} px-1.5 py-0.5 rounded ${theme === 'light' ? 'text-indigo-600' : 'text-indigo-400'} border ${t.border}`}>{"{{random}}"}</code>
              <code className={`${t.bgTertiary} px-1.5 py-0.5 rounded ${theme === 'light' ? 'text-indigo-600' : 'text-indigo-400'} border ${t.border}`}>{"{{count}}"}</code>
              <code className={`${t.bgTertiary} px-1.5 py-0.5 rounded ${theme === 'light' ? 'text-indigo-600' : 'text-indigo-400'} border ${t.border}`}>{"{{uuid}}"}</code>
            </div>

            {/* 消息输入和发送 */}
            <div className="flex gap-3">
              <textarea
                value={pubMessage}
                onChange={(e) => setPubMessage(e.target.value)}
                className={`flex-1 ${t.bgInput} border ${t.border} rounded-xl px-4 py-3 text-sm font-mono resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all h-24 ${t.text}`}
                placeholder='Payload (e.g. {"msg": "Hello", "ts": {{timestamp}}})'
              />
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
