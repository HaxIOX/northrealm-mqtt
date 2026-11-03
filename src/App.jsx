import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import {
  Send, Download, Trash2, Play, Square, Activity,
  Settings, MessageSquare, Loader2, Save, Search,
  PauseCircle, PlayCircle, FileJson, X, ChevronDown, ChevronUp,
  Copy, Plus, Binary, Zap, Edit2,
  AlertCircle, Layout, RefreshCw, Timer, BarChart3, Keyboard,
  FileText, Variable, Info, ArrowUpRight, ArrowDownRight,
  Bell, LayoutDashboard, SunDim, Moon, Star, Hash, Check
} from 'lucide-react';
import { detectRuntime, isDesktopTcpCapable } from './mqtt/runtime.js';

// 协议端口映射表
const PROTOCOL_PORT_MAP = {
  'ws': { port: 8083, description: 'WebSocket 未加密' },
  'wss': { port: 8084, description: 'WebSocket SSL 加密' },
  'mqtt': { port: 1883, description: 'MQTT TCP' },
  'mqtts': { port: 8883, description: 'MQTT TLS' }
};

// --- 语义色（浅底徽标）：dark: 变体自动切换深浅色，替代 theme 三元判断 ---
const TONE = {
  info: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300',
  ok: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  warn: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  err: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  accent: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  neutral: 'bg-slate-50 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400',
};
const TONE_BORDER = {
  warn: 'border-amber-200 dark:border-amber-500/30',
  err: 'border-rose-200 dark:border-rose-500/30',
  accent: 'border-violet-200 dark:border-violet-500/30',
  neutral: 'border-slate-200 dark:border-slate-500/30',
};
// 选中态（带边框的高亮块）
const ACTIVE = {
  info: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/20 dark:border-blue-500/40 dark:text-blue-200',
  ok: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-200',
};

// --- 日志展示辅助（模块级纯函数） ---
const MAX_LOGS = 500;
const THEME_STORAGE_KEY = 'mqtt_theme_v2';

const toHex = (str) => { let h=''; for(let i=0;i<str.length;i++) h+=str.charCodeAt(i).toString(16).padStart(2,'0')+' '; return h.toUpperCase(); };
const isJson = (str) => { try { JSON.parse(str); return true; } catch { return false; } };
const tryFormatJson = (str) => { try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; } };

// 轻量 JSON tokenizer：切分为 {type,value} 序列，供语法着色使用
function tokenizeJson(text) {
  const tokens = [];
  let i = 0;
  const n = text.length;
  const push = (type, value) => { if (value) tokens.push({ type, value }); };
  while (i < n) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      let str = c;
      while (j < n) {
        const ch = text[j];
        str += ch;
        j++;
        if (ch === '\\') { if (j < n) { str += text[j]; j++; } continue; }
        if (ch === '"') break;
      }
      push('string', str);
      i = j;
    } else if (c === '{' || c === '}' || c === '[' || c === ']' || c === ':' || c === ',') {
      push('punct', c);
      i++;
    } else if (/\s/.test(c)) {
      let j = i;
      while (j < n && /\s/.test(text[j])) j++;
      push('whitespace', text.slice(i, j));
      i = j;
    } else {
      const numMatch = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));
      if (numMatch) { push('number', numMatch[0]); i += numMatch[0].length; continue; }
      const wordMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i));
      if (wordMatch) {
        const w = wordMatch[0];
        if (w === 'true' || w === 'false') push('boolean', w);
        else if (w === 'null') push('null', w);
        else push('other', w);
        i += w.length;
        continue;
      }
      push('other', c);
      i++;
    }
  }
  // 字符串后（跳过空白）紧跟 ':' 视为键
  for (let k = 0; k < tokens.length; k++) {
    if (tokens[k].type !== 'string') continue;
    let p = k + 1;
    while (p < tokens.length && tokens[p].type === 'whitespace') p++;
    if (p < tokens.length && tokens[p].type === 'punct' && tokens[p].value === ':') tokens[k].type = 'key';
  }
  return tokens;
}

function JsonHighlight({ text, theme }) {
  const tokens = useMemo(() => tokenizeJson(text), [text]);
  const cls = {
    key: theme === 'light' ? 'text-[#2563eb]' : 'text-[#60a5fa]/80',
    string: theme === 'light' ? 'text-emerald-700' : 'text-emerald-400/70',
    number: theme === 'light' ? 'text-amber-600' : 'text-amber-400/70',
    boolean: theme === 'light' ? 'text-violet-600' : 'text-[#FB7185]/80',
    null: theme === 'light' ? 'text-violet-600' : 'text-[#FB7185]/80',
    other: theme === 'light' ? 'text-slate-600' : 'text-[#94A3B8]',
    punct: theme === 'light' ? 'text-slate-500' : 'text-[#94A3B8]',
    whitespace: '',
  };
  return tokens.map((tok, idx) => (
    cls[tok.type] ? <span key={idx} className={cls[tok.type]}>{tok.value}</span> : tok.value
  ));
}

// 复制按钮：点击后 1.5 秒内显示对勾，作为复制成功反馈
function CopyButton({ text, className, title = '复制' }) {
  const [copied, setCopied] = useState(false);
  const handleClick = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(text ?? ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };
  return (
    <button type="button" onClick={handleClick} className={className} title={copied ? '已复制' : title} aria-label={title}>
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

const LogItem = React.memo(function LogItem({ log, theme, logViewMode, onEdit }) {
  const isSent = log.type === 'sent';
  const isReceived = log.type === 'received';
  const isSystem = log.type === 'system';
  const isError = !isSent && !isReceived && !isSystem;
  const tagLabel = isSent ? 'TX' : isReceived ? 'RX' : isError ? 'ERR' : 'SYS';

  const tagCls = isSent
    ? (theme === 'light' ? 'text-[#2563eb]' : 'text-[#60a5fa]/80')
    : isReceived
      ? (theme === 'light' ? 'text-emerald-600' : 'text-emerald-400/70')
      : isError
        ? (theme === 'light' ? 'text-rose-600' : 'text-rose-400/80')
        : (theme === 'light' ? 'text-slate-500' : 'text-gray-400');

  const mutedText = theme === 'light' ? 'text-slate-400' : 'text-gray-500';
  const secondaryText = theme === 'light' ? 'text-slate-600' : 'text-gray-300';
  const hoverBtn = theme === 'light' ? 'text-slate-400 hover:text-slate-700' : 'text-gray-500 hover:text-gray-200';

  const showEdit = !!log.topic && typeof log.payload === 'string' && onEdit;

  return (
    <div className="group flex flex-col gap-1.5 py-2.5 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors rounded-lg px-2 -mx-2">
      <div className="flex items-center gap-3 text-[11px] w-full">
        <span className={`text-[11px] font-mono ${mutedText} shrink-0 font-medium`}>{log.timestamp}</span>
        <span className={`text-[11px] font-bold tracking-wider uppercase shrink-0 ${tagCls}`}>{tagLabel}</span>
        {log.topic && <span className={`text-[11px] font-mono truncate opacity-90 ${secondaryText}`} title={log.topic}>{log.topic}</span>}
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {showEdit && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(log); }} className={`p-1 ${hoverBtn} rounded-lg transition-colors`} title="填充到发送区编辑">
                <Edit2 className="w-3 h-3" />
              </button>
          )}
          <CopyButton text={log.payload} title="复制 Payload" className={`p-1 ${hoverBtn} rounded-lg transition-colors`} />
        </div>
      </div>
      <pre className={`text-[13px] leading-relaxed overflow-x-auto whitespace-pre-wrap ${isSent || isReceived ? 'font-mono break-all' : 'font-sans break-words'}`}>
        {logViewMode === 'hex' ? (
          <span className={theme === 'light' ? 'text-purple-600' : 'text-gray-400'}>{toHex(log.payload)}</span>
        ) : typeof log.payload === 'string' && isJson(log.payload) ? (
          <JsonHighlight text={tryFormatJson(log.payload)} theme={theme} />
        ) : (
          String(log.payload ?? '')
        )}
      </pre>
      {!!log.details && (
        <div className={`text-xs leading-relaxed whitespace-pre-wrap break-words ${mutedText}`}>{log.details}</div>
      )}
    </div>
  );
});

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

  const [showBackupModal, setShowBackupModal] = useState(false);

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

  // 记录协议是否为用户手动修改（用于只对用户主动选的 wss 显示 SSL 提示）
  const protocolTouched = useRef(false);

  const [advancedConfig, setAdvancedConfig] = useState({
    keepalive: 60, clean: true, willEnabled: false,
    willTopic: 'last/will', willPayload: 'offline', willQos: 0, willRetain: false,
    protocolVersion: 4  // 新增：协议版本 (3=MQTT 3.1, 4=MQTT 3.1.1, 5=MQTT 5.0)
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [configCollapsed, setConfigCollapsed] = useState(false); // 新增：连接后折叠配置面板
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [subscriptions, setSubscriptions] = useState([]);
  const [subscriptionsCollapsed, setSubscriptionsCollapsed] = useState(true);
  const [subTopic, setSubTopic] = useState('test/topic');
  const subTopicInputRef = useRef(null);
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [subMonitorSelectedTopics, setSubMonitorSelectedTopics] = useState([]);
  
  const [pubTopic, setPubTopic] = useState('test/topic');
  const [pubMessage, setPubMessage] = useState('{"msg": "Hello MQTT"}');
  const [pubQoS, setPubQoS] = useState(0);
  const [pubRetain, setPubRetain] = useState(false); 
  const pubMessageTextareaRef = useRef(null);
  // 发送框随内容自动增高（上限 38vh，随窗口/屏幕自适应）
  useEffect(() => {
    const el = pubMessageTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [pubMessage]);
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
  const [logTypeFilter, setLogTypeFilter] = useState('all');
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

  // 定时发送
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerInterval, setTimerInterval] = useState(1000);
  const [timerNextSendAt, setTimerNextSendAt] = useState(null);
  const [timerNow, setTimerNow] = useState(Date.now());
  const timerRef = useRef(null);
  useEffect(() => {
    if (!timerEnabled || !timerNextSendAt) return undefined;
    setTimerNow(Date.now());
    const ticker = setInterval(() => setTimerNow(Date.now()), 100);
    return () => clearInterval(ticker);
  }, [timerEnabled, timerNextSendAt]);

  // 自动重订阅
  const [autoResubscribe, setAutoResubscribe] = useState(true);
  const lastSubscriptionsRef = useRef([]);
  const reconnectCountRef = useRef(0);
  useEffect(() => { reconnectCountRef.current = reconnectCount; }, [reconnectCount]);
  const clientRef = useRef(null);
  useEffect(() => { clientRef.current = client; }, [client]);

  // 主题状态：无本地记忆时跟随系统主题
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });
  const themeUserOverride = useRef((() => {
    try { return !!localStorage.getItem(THEME_STORAGE_KEY); } catch { return false; }
  })());

  // Tailwind darkMode:'class'：应用内主题同步到 <html> 的 dark 类，先于绘制执行避免闪烁
  useLayoutEffect(() => {
    try {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    } catch {
      // ignore
    }
  }, [theme]);

  // 系统主题变化时跟随，直到用户手动切换过主题
  useEffect(() => {
    try {
      if (typeof window === 'undefined' || !window.matchMedia) return;
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e) => {
        if (!themeUserOverride.current) setTheme(e.matches ? 'dark' : 'light');
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } catch {
      // ignore
    }
  }, []);

  // 主题切换
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    themeUserOverride.current = true;
    setTheme(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  };

  // 主题配色
  const t = theme === 'light' ? {
  // 亮色主题
    bg: 'bg-[#F9FAFB]',
    bgSecondary: 'bg-white/60',
    bgTertiary: 'bg-gray-100/50',
    bgHover: 'hover:bg-gray-100',
    bgInput: 'bg-gray-100/70',
    border: 'border-gray-200/50',
    borderLight: 'border-gray-200/40',
    text: 'text-gray-800',
    textSecondary: 'text-slate-600',
    textMuted: 'text-slate-500',
    shadow: 'shadow-sm',
    shadowLg: 'shadow-lg shadow-gray-200/40',
    card: 'bg-white/80 border-gray-200/50',
    cardHover: 'hover:border-gray-300',
    accent: 'blue',
    accentBg: 'bg-blue-500',
    accentText: 'text-blue-500',
    accentLight: 'bg-blue-50',
    floatingPanel: 'bg-white/90 shadow-lg shadow-gray-200/40 border border-gray-200/50 rounded-xl',
  } : {
    // 暗色主题
    bg: 'bg-[#09090B]',
    bgSecondary: 'bg-[#18181B]/60',
    bgTertiary: 'bg-white/[0.03]',
    bgHover: 'hover:bg-white/[0.05]',
    bgInput: 'bg-zinc-900/50',
    border: 'border-white/5',
    borderLight: 'border-white/[0.05]',
    text: 'text-gray-200',
    textSecondary: 'text-slate-400',
    textMuted: 'text-slate-500',
    shadow: 'shadow-none',
    shadowLg: 'shadow-[0_8px_30px_rgba(0,0,0,0.4)]',
    card: 'bg-[#18181B]/80 border-white/10',
    cardHover: 'hover:border-white/[0.15]',
    accent: 'blue',
    accentBg: 'bg-blue-400',
    accentText: 'text-blue-300',
    accentLight: 'bg-blue-400/10',
    floatingPanel: 'bg-[#18181B]/90 shadow-xl shadow-black/40 border border-white/10 rounded-xl',
  };
  const themedSelectClass = `themed-select ${t.bgInput} border ${t.border} outline-none transition-all ${t.text}`;
  const labelStyle = 'block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider pl-1';
  const configInputStyle = `w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all disabled:opacity-50 ${t.text}`;

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
    const localConfigs = localStorage.getItem('mqtt_configs');
    const localActions = localStorage.getItem('mqtt_quick_actions');
    const localSubs = localStorage.getItem('mqtt_subscriptions');
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
  }, []);

  const updateData = (type, newData) => {
    if (type === 'configs') {
      setSavedConfigs(newData);
      localStorage.setItem('mqtt_configs', JSON.stringify(newData));
    } else if (type === 'actions') {
      setQuickActions(newData);
      localStorage.setItem('mqtt_quick_actions', JSON.stringify(newData));
    } else if (type === 'subscriptions') {
      setSubscriptions(newData);
      localStorage.setItem('mqtt_subscriptions', JSON.stringify(newData));
      lastSubscriptionsRef.current = newData;
    }
  };

  const updateSubscriptions = (updater) => {
    setSubscriptions((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem('mqtt_subscriptions', JSON.stringify(next));
      lastSubscriptionsRef.current = next;
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
    const defaultName = String(pubTopic || '').split('/').filter(Boolean).pop() || '新指令';
    openInputModal("给指令起个名字 (如: 开灯)", defaultName, (name) => {
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

  const fillQuickAction = (action, opts = {}) => {
    const { closePanel = true, clearQuery = true } = opts;
    if (!action) return;
    if (closePanel) setShowQuickActionsPanel(false);
    if (clearQuery) setQuickActionQuery('');
    handleLoadAction(action);
  };

  const loadPublishDraft = useCallback((draft) => {
    if (!draft) return;
    if (typeof draft.topic === 'string') setPubTopic(draft.topic);
    if (typeof draft.payload === 'string') setPubMessage(draft.payload);
    setTimeout(() => pubMessageTextareaRef.current?.focus(), 0);
  }, []);

  // 供日志行 LogItem 使用的稳定回调（React.memo 生效依赖引用稳定）
  const handleEditFromLog = useCallback((log) => {
    loadPublishDraft({ topic: log.topic, payload: log.payload });
  }, [loadPublishDraft]);

  const toggleQuickActionGroupCollapsed = (collapseKey) => {
    const root = quickActionsScrollRef.current;
    const scrollTop = root?.scrollTop ?? null;

    setQuickActionGroupCollapsed((prev) => {
      const prevMap = prev || {};
      const nextCollapsed = !(prevMap[collapseKey] ?? true);
      return { ...prevMap, [collapseKey]: nextCollapsed };
    });

    if (scrollTop == null) return;

    const restoreScroll = () => {
      if (quickActionsScrollRef.current) quickActionsScrollRef.current.scrollTop = scrollTop;
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(restoreScroll);
    } else {
      setTimeout(restoreScroll, 0);
    }
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
    if (!client || !client.connected) {
      addLog('error', '', '请先连接服务器');
      return false;
    }
    const payload = action.payload;
    client.publish(action.topic, payload, { qos: action.qos, retain: action.retain }, (err) => {
      if (err) addLog('error', action.topic, `指令 "${action.name}" 发送失败: ${err.message}`);
      else addLog('sent', action.topic, payload, `指令: ${action.name}`);
    });
    return true;
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
    const dispatched = handleFireAction(action);
    if (dispatched) recordRecentAction(action.id);
    if (closePanel) {
      setShowQuickActionsPanel(false);
      setQuickActionQuery('');
    }
  };

  // UX: 打开弹窗时沿用上次展开/收起状态（会话内记忆）。

  // 搜索框当前的第一个匹配项（空查询返回 undefined，避免误发）。搜索定位与 Enter 共用。
  const findFirstMatchedAction = () => {
    const q = (quickActionQuery || '').trim().toLowerCase();
    if (!q) return undefined;
    const all = Array.isArray(quickActions) ? quickActions : [];
    return all.find((a) => `${a?.name || ''} ${a?.topic || ''} ${a?.payload || ''}`.toLowerCase().includes(q));
  };

  // 搜索时自动展开命中的分组并滚动到对应指令。
  useEffect(() => {
    if (!showQuickActionsPanel) return;
    const first = findFirstMatchedAction();
    if (!first) return;

    const { group } = getActionGroup(first);
    const collapseKey = `all::${group}`;
    setQuickActionGroupCollapsed(prev => ({ ...(prev || {}), [collapseKey]: false }));

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
    setLogs(prev => {
      logIdRef.current += 1;
      const newLogs = [...prev, { id: logIdRef.current, timestamp: new Date().toLocaleTimeString(), type, topic, payload, details }];
      return newLogs.length > MAX_LOGS ? newLogs.slice(newLogs.length - MAX_LOGS) : newLogs;
    });
  };

  // 协议改变时智能更新端口
  const handleProtocolChange = (newProtocol) => {
    protocolTouched.current = true;
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
      diagnosis = '连接被拒绝：服务器可能未运行；端口号可能错误；防火墙可能阻止了连接';
    } else if (errorCode === 'ETIMEDOUT' || errorCode === 'ESOCKETTIMEDOUT') {
      diagnosis = '连接超时：服务器地址可能不可达；网络问题或防火墙阻止；服务器响应太慢';
    } else if (errorCode === 'ENOTFOUND' || errorCode === 'EAI_AGAIN') {
      diagnosis = '域名解析失败：服务器地址拼写错误；DNS 服务器问题；网络连接问题';
    } else if (errorCode === 'ECONNRESET') {
      diagnosis = '连接被重置：服务器主动断开了连接；可能是认证失败；可能是协议版本不匹配';
    } else if (errorMsg.includes('WebSocket')) {
      if (connection.protocol === 'wss') {
        diagnosis = 'WebSocket SSL 连接失败：服务器可能不支持 WSS；尝试使用 ws:// 协议';
      } else {
        diagnosis = 'WebSocket 连接失败：检查服务器是否支持 WebSocket；检查路径(path)是否正确';
      }
    } else if (errorMsg.includes('timeout') || errorMsg.includes('TIMEOUT')) {
      diagnosis = '连接超时：检查服务器地址和端口；检查网络连接；检查防火墙设置';
    } else if (errorMsg.includes('certificate') || errorMsg.includes('SSL') || errorMsg.includes('TLS')) {
      diagnosis = 'SSL/TLS 证书问题：自签名证书不被信任；尝试使用非加密协议 (mqtt:// 或 ws://)';
    } else if (errorMsg.includes('authorized') || errorMsg.includes('authentication')) {
      diagnosis = '认证失败：用户名或密码错误；服务器要求认证但未提供凭据';
    } else if (errorMsg.includes('protocol')) {
      diagnosis = '协议错误：MQTT 协议版本不匹配；服务器可能不是标准 MQTT 服务器';
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

      addLog('system', '', `MQTT 库：${isNative ? 'Node 原生（支持 TCP）' : source === 'cdn' ? 'CDN 浏览器版（仅 WebSocket）' : '未知'}，版本 ${window.__MQTT_PRO_MQTT_VERSION__ || 'unknown'}`);

      if (!isNative && (connection.protocol === 'mqtt' || connection.protocol === 'mqtts')) {
        addLog('error', '', '当前 MQTT 库不支持 mqtt:// 协议，请切换到 ws:// 或 wss://，或检查桌面端 preload 是否注入成功');
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
        addLog('system', '', '已连接', `CONNACK sessionPresent=${connack?.sessionPresent}, returnCode=${connack?.returnCode || 0}`);
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
            hintLines.length ? `建议：${hintLines.join('；')}` : '',
          ].filter(Boolean).join('\n');

          addLog('error', '', `连接错误：${errorMsg}`, detailsText);
          return;
        }

        const devDetails = Object.keys(filteredDetails).length > 1 ? JSON.stringify(filteredDetails, null, 2) : '';
        addLog('error', '', `连接错误：${errorMsg}`, [diagnosis, devDetails].filter(Boolean).join('\n'));
      });

      // 连接关闭事件
      newClient.on('close', () => {
        const wasConnected = connectStatus === 'connected';
        setConnectStatus('disconnected');
        if (wasConnected) {
          addLog('system', '', '连接已断开');
        } else if (reconnectCount === 0) {
          addLog('error', '', '连接关闭，MQTT 握手未完成', '可能原因：用户名或密码错误；ClientID 被拒绝或已被占用；服务器不允许此连接；MQTT 协议版本不匹配');
        } else {
          addLog('system', '', '连接关闭（未成功建立连接）');
        }
      });

      // 离线事件
      newClient.on('offline', () => {
        addLog('system', '', reconnectCountRef.current === 0 ? '客户端离线：请检查服务器地址、端口和网络连接' : '客户端离线');
      });

      // 重连事件
      newClient.on('reconnect', () => {
        setReconnectCount(prev => {
          const newCount = prev + 1;
          addLog('system', '', `正在重连（第 ${newCount} 次）`);

          if (newCount === 3) {
            addLog('error', '', '已重连 3 次仍失败', '可能原因：服务器地址或端口错误；服务器未运行或无法访问；防火墙阻止连接；用户名或密码错误');
          }

          if (newCount >= 10) {
            addLog('error', '', `已重连 ${newCount} 次，建议停止连接并检查配置`);
            // 10次后停止自动重连
            if (newCount >= 15) {
              addLog('error', '', '已达最大重连次数（15），已停止重连');
              newClient.end(true);
            }
          }

          return newCount;
        });
      });

      // 包发送事件（用于调试）
      newClient.on('packetsend', (packet) => {
        if (debugPacketLogRef.current && reconnectCountRef.current === 0) {
          addLog('system', '', `发送包：${packet.cmd}`);
        }
      });

      // 包接收事件（用于调试）
      newClient.on('packetreceive', (packet) => {
        if (debugPacketLogRef.current && reconnectCountRef.current === 0) {
          addLog('system', '', `接收包：${packet.cmd}`);
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

  const handleDisconnect = () => {
    // 保存当前订阅列表供重连使用
    lastSubscriptionsRef.current = [...subscriptions];
    // 停止定时发送
    if (timerRef.current) stopPublishTimer();
    const currentClient = clientRef.current || client;
    if (currentClient) {
      // 强制结束连接，传入true表示不再重连
      currentClient.end(true);
      clientRef.current = null;
      setClient(null);
      setConnectStatus('disconnected');
      setReconnectCount(0); // 重置重连计数
      addLog('system', '', connectStatus === 'connecting' ? '已取消连接' : '已断开连接（已停止重连）');
    }
  };

  const handleSubscribe = () => {
    if (!subTopic) return;
    if (!client?.connected) { addLog('error', '', '请先连接服务器'); return; }
    if (subscriptions.includes(subTopic)) { addLog('system', subTopic, '已订阅该主题'); return; }
    client.subscribe(subTopic, (e) => {
      if (e) { addLog('error', subTopic, '订阅失败'); return; }
      updateSubscriptions((prev) => (prev.includes(subTopic) ? prev : [...prev, subTopic]));
      addLog('system', subTopic, '订阅成功');
    });
  };

  const handleUnsubscribe = (t) => {
    const removeLocal = () => {
      updateSubscriptions((prev) => prev.filter((i) => i !== t));
      setSubMonitorSelectedTopics((prev) => prev.filter((x) => x !== t));
    };
    // 未连接时没有服务端订阅可退，直接移除本地保存的订阅
    if (!client?.connected) { removeLocal(); return; }
    client.unsubscribe(t, (e) => {
      if (e) { addLog('error', t, `退订失败：${e.message}`); return; }
      removeLocal();
      addLog('system', t, '退订成功');
    });
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

  const stopPublishTimer = (logMessage = '') => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerEnabled(false);
    setTimerNextSendAt(null);
    if (logMessage) addLog('system', '', logMessage);
  };

  const scheduleNextTimerRun = (delayMs = timerInterval) => {
    const normalizedDelay = Math.max(0, Number(delayMs) || 0);
    setTimerNextSendAt(Date.now() + normalizedDelay);
  };

  const startPublishTimer = () => {
    setTimerEnabled(true);
    scheduleNextTimerRun(timerInterval);
    addLog('system', '', `定时发送已启动，间隔 ${timerInterval}ms`);

    timerRef.current = setInterval(() => {
      const parsedMessage = pubMessage;
      client.publish(pubTopic, parsedMessage, { qos: pubQoS, retain: pubRetain }, e => {
        if (e) addLog('error', pubTopic, e.message);
        else addLog('sent', pubTopic, parsedMessage, `定时发送 QoS: ${pubQoS}`);
      });
      scheduleNextTimerRun(timerInterval);
    }, timerInterval);
  };

  // 定时发送控制
  const toggleTimer = () => {
    if (timerEnabled) {
      stopPublishTimer('定时发送已停止');
      return;
    }
    if (!client?.connected) return addLog('error', '', '请先连接服务器');
    if (!pubTopic) return addLog('error', '', '请输入 Topic');
    startPublishTimer();
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
      // Ctrl/Cmd + P: 打开快捷指令面板（搜索框自动聚焦）
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key?.toLowerCase() === 'p') {
        e.preventDefault();
        setShowQuickActionsPanel(true);
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

  // Formatters
  const formatDuration = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

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
    .filter((log) => (logTypeFilter === 'all' ? true : logTypeFilter === 'in' ? log.type === 'received' : log.type === 'sent'))
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
    const byId = new Map(all.map((a) => [actionIdKey(a?.id), a]));
    const chosen = [];

    for (const action of pinnedActions) {
      if (action && chosen.length < MAX_COMMON) chosen.push(action);
    }

    if (chosen.length < MAX_COMMON) {
      for (const id of (recentActionIds || [])) {
        const action = byId.get(actionIdKey(id));
        if (!action) continue;
        if (chosen.some((a) => actionIdKey(a?.id) === actionIdKey(action?.id))) continue;
        chosen.push(action);
        if (chosen.length >= MAX_COMMON) break;
      }
    }

    return chosen.slice(0, MAX_COMMON);
  })();
  const timerRemainingMs = timerEnabled && timerNextSendAt
    ? Math.max(0, timerNextSendAt - timerNow)
    : 0;
  const timerProgress = timerEnabled
    ? Math.min(100, Math.max(0, ((timerInterval - timerRemainingMs) / Math.max(timerInterval, 1)) * 100))
    : 0;
  const formatTimerCountdown = (ms) => {
    if (ms >= 60000) {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
    }
    if (ms >= 10000) return `${(ms / 1000).toFixed(0)}s`;
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.max(0, Math.round(ms))}ms`;
  };

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
      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all duration-300 hover:shadow-lg hover:shadow-black/20 group">
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
    <div className={`app-shell flex h-screen ${t.bg} ${t.text} font-sans overflow-hidden selection:bg-blue-500/20 transition-colors duration-300`}>

      {/* 模态框 */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`${t.floatingPanel} max-w-sm w-full p-6 transform scale-100`}>
            <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${t.text}`}>
              {modal.type === 'confirm' && <AlertCircle className="w-5 h-5 text-amber-500" />}
              {modal.title}
            </h3>
            {modal.type === 'input' && (
              <input
                autoFocus onFocus={(e) => e.target.select()} type="text" value={modal.inputValue} onChange={(e) => setModal({...modal, inputValue: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && handleModalSubmit()}
                className={`w-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none mb-4 transition-all ${t.text}`}
              />
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setModal({...modal, open: false})} className={`px-4 py-2 ${t.bgTertiary} ${t.bgHover} rounded-xl text-sm font-medium transition-colors ${t.textSecondary}`}>取消</button>
              <button onClick={handleModalSubmit} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg ${modal.type === 'confirm' ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20' : 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20'}`}>{modal.type === 'confirm' ? '确定删除' : '确定保存'}</button>
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
          <div className={`relative ${t.floatingPanel} max-w-3xl w-full p-6`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className={`text-lg font-bold flex items-center gap-2 ${t.text}`}>
                <Edit2 className="w-5 h-5 text-blue-500" />
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
                  className={`w-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-2.5 text-sm font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${t.text}`}
                  placeholder="Topic (e.g. test/topic)"
                />
              </div>
              <div>
                <label className={`text-xs ${t.textMuted} block mb-1`}>Payload</label>
                <textarea
                  autoFocus
                  value={publishEditorPayload}
                  onChange={(e) => setPublishEditorPayload(e.target.value)}
                  className={`w-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-3 text-sm font-mono resize-y focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all min-h-[260px] ${t.text}`}
                  placeholder='Payload (e.g. {"msg": "Hello"})'
                />
                <div className={`text-[11px] mt-1 ${t.textMuted}`}>快捷键：Ctrl/Cmd + Enter 应用并关闭</div>
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
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20"
              >
                应用
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuickActionsPanel && (
        <div className="fixed inset-0 bg-black/50 z-[65] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`${t.floatingPanel} max-w-2xl w-full p-6`}>
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
                  onKeyDown={(e) => {
                    // 输入法组词中的回车只是确认候选，不触发发送
                    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                    const first = findFirstMatchedAction();
                    if (!first) return;
                    e.preventDefault();
                    if (e.shiftKey) fillQuickAction(first);
                    else sendQuickAction(first);
                  }}
                  placeholder="搜索 名称 / Topic / Payload...　Enter 发送 · Shift+Enter 填入"
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
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${t.border} ${t.textMuted}`}>
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
                      ? ACTIVE.info
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
                      ? ACTIVE.info
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
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          active
                            ? ACTIVE.ok
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
                          <div className={`text-[11px] ${t.textMuted} truncate mt-1`}>分组：{resolvedGroup}</div>
                        )}
                        <div className={`text-[11px] ${t.textSecondary} truncate mt-1 font-mono`}>{String(action?.payload || '')}</div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); fillQuickAction(action); }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                            theme === 'light'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                              : 'bg-blue-500/10 text-blue-200 border-blue-500/30 hover:bg-blue-500/20'
                          }`}
                          title="填充到发送区"
                        >
                          填充
                        </button>
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
                          <Layout className={`w-4 h-4 ${action?.group ? (theme === 'light' ? 'text-blue-600' : 'text-blue-300') : t.textMuted}`} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteAction(action?.id, e)}
                          className={`p-1 rounded-lg border ${t.border} ${t.bgSecondary} ${t.bgHover} transition-colors`}
                          title="删除"
                        >
                          <Trash2 className={`w-4 h-4 ${t.textMuted}`} />
                        </button>
                        <span className={`text-[11px] ${t.textMuted} border ${t.border} rounded-full px-2 py-0.5`}>
                          QoS {action?.qos ?? 0}{action?.retain ? ' · Retain' : ''}
                        </span>
                        <div className={`px-3 py-1 rounded-lg text-xs font-bold ${TONE.warn} flex items-center gap-1`}>
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
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => toggleQuickActionGroupCollapsed(collapseKey)}
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
                                  <div className={`text-[11px] ${t.textMuted} border ${t.border} rounded-full px-2 py-0.5 shrink-0`}>
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
          <div className={`${t.floatingPanel} max-w-lg w-full p-6`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className={`text-lg font-bold flex items-center gap-2 ${t.text}`}>
                <Edit2 className="w-5 h-5 text-blue-500" />
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
                   className={`w-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${t.text}`}
                  placeholder="指令名称"
                />
              </div>
              <div>
                <label className={`text-xs ${t.textMuted} block mb-1`}>Topic</label>
                <input
                  type="text"
                  value={editingAction.topic}
                  onChange={(e) => setEditingAction({ ...editingAction, topic: e.target.value })}
                  className={`w-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-2.5 text-sm font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${t.text}`}
                  placeholder="test/topic"
                />
              </div>
              <div>
                <label className={`text-xs ${t.textMuted} block mb-1`}>Payload</label>
                <textarea
                  value={editingAction.payload}
                  onChange={(e) => setEditingAction({ ...editingAction, payload: e.target.value })}
                  onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSaveEditAction(); } }}
                  className={`w-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-3 text-sm font-mono resize-y focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all min-h-[120px] ${t.text}`}
                  placeholder='{"msg": "Hello"}'
                />
                <div className={`text-[11px] mt-1 ${t.textMuted}`}>Ctrl/Cmd + Enter 保存</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className={`text-xs ${t.textMuted}`}>QoS</label>
                  {[0, 1, 2].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setEditingAction({ ...editingAction, qos: q })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        editingAction.qos === q
                          ? ACTIVE.info
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
                    className="rounded bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-blue-600"
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
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20"
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

      {/* 备份弹窗 */}
      {showBackupModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className={`${t.floatingPanel} max-w-md w-full p-6`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-lg font-bold flex items-center gap-2 ${t.text}`}><Settings className="w-5 h-5 text-blue-500"/> 备份</h3>
              <button onClick={() => setShowBackupModal(false)} className={`${t.textMuted} hover:${t.text} p-1 ${t.bgHover} rounded-lg transition-colors`}><X className="w-5 h-5"/></button>
            </div>

            <div className={`p-4 ${t.bgTertiary} border ${t.border} rounded-xl space-y-3 mb-4`}>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
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
          </div>
        </div>
      )}

      {/* 左侧侧边栏 */}
      <aside className={`app-sidebar ${isSidebarOpen ? 'w-[280px]' : 'w-0 opacity-0'} ${t.bgSecondary} border-r ${t.borderLight} flex flex-col shrink-0 transition-all duration-300 overflow-hidden z-20`}>

        {/* Logo 区域（渐变图标 + NRmqtt + 主题切换） */}
        <div className="h-16 px-4 flex items-center justify-between shrink-0 min-w-[280px]">
          <div className="flex items-center gap-3">
            {/* 32px 像素对齐设计：横线中心在 y=20.5、描边 3px，上下边缘恰落在像素行上；须保持 w-8 h-8（1:1 渲染）。与 scripts/gen-icon.cjs 的 32px 帧一致 */}
            <svg viewBox="0 0 32 32" className="w-8 h-8 text-blue-500" aria-hidden="true">
              <path d="M3.5 20.5 H11 L14.5 5.5 L18 27 L21 20.5 H28.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className={`font-bold text-base tracking-tight ${theme === 'light' ? 'text-gray-800' : 'text-gray-100'}`}>NRmqtt</span>
          </div>
          <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowBackupModal(true)}
            className={`p-1.5 rounded-lg ${t.textMuted} ${t.bgHover} transition-colors`}
            title="备份与导入"
            aria-label="备份与导入"
          >
            <FileText size={16} />
          </button>
          {/* 主题切换开关 */}
          <button
            onClick={toggleTheme}
            className={`relative w-11 h-6 rounded-full transition-colors duration-300 border ${
              theme === 'dark' ? 'bg-blue-500/20 border-blue-500/40' : 'bg-gray-200 border-gray-300'
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

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-2 space-y-4">

          {/* 连接状态行（悬浮面板：状态点 + 地址） */}
          <div className={`flex items-center gap-2 px-3 py-2 ${t.floatingPanel}`}>
            <span className="relative inline-flex h-2 w-2 shrink-0">
              {connectStatus !== 'disconnected' && <span className={`absolute inline-flex h-full w-full rounded-full opacity-50 animate-ping ${connectStatus === 'connected' ? 'bg-[#06D6A0]' : 'bg-[#FFD166]'}`}></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${connectStatus === 'connected' ? 'bg-[#06D6A0]' : connectStatus === 'connecting' ? 'bg-[#FFD166]' : 'bg-[#EF476F]'}`}></span>
            </span>
            <span className="text-[12px] font-mono font-medium text-slate-700 dark:text-slate-300 truncate" title={`${connection.protocol}://${connection.host}`}>
              {connectStatus === 'disconnected' ? '未连接' : `${connection.protocol}://${connection.host}`}
            </span>
            {connectStatus === 'connected' && (
              <span className="ml-auto text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">{formatDuration(connectDuration)}</span>
            )}
            {reconnectCount > 0 && connectStatus !== 'connected' && (
              <span className="ml-auto text-[11px] font-mono text-[#FFD166] shrink-0">重连×{reconnectCount}</span>
            )}
          </div>

          {/* 连接配置 */}
          <section className="space-y-2">
          <div className="mb-2">
            <button
              onClick={() => setConfigCollapsed(!configCollapsed)}
              className="w-full flex items-center justify-between group py-1.5 mb-1"
            >
              <div className="flex items-center gap-2 font-bold text-[13px] text-[#333D4F] dark:text-[#E6EDF3]">
                <span>连接配置</span>
              </div>
              <div className="flex items-center gap-2">
                {configCollapsed ? <ChevronDown size={16} className="text-slate-600 group-hover:text-slate-800 dark:group-hover:text-slate-300 transition-colors"/> : <ChevronUp size={16} className="text-slate-600 group-hover:text-slate-800 dark:group-hover:text-slate-300 transition-colors"/>}
              </div>
            </button>

            {!configCollapsed && (
              <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                 <div className={`flex items-center ${t.bgInput} border ${t.border} rounded-lg focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-500 transition-all overflow-hidden`}>
                   <select
                     value={connection.protocol}
                     onChange={(e) => handleProtocolChange(e.target.value)}
                     disabled={connectStatus === 'connected'}
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
                     onChange={(e) => setConnection({...connection, host: e.target.value})}
                     disabled={connectStatus === 'connected'}
                     aria-label="主机"
                     className="flex-1 min-w-0 w-full bg-transparent text-[13px] px-2.5 py-2 outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400 font-medium"
                     placeholder="broker.emqx.io"
                   />
                   <input
                     type="number"
                     value={connection.port}
                     onChange={(e) => handlePortChange(e.target.value)}
                     disabled={connectStatus === 'connected'}
                     aria-label="端口"
                     className="w-14 shrink-0 bg-transparent text-[13px] font-mono px-1 py-2 outline-none text-gray-800 dark:text-gray-200 border-l border-gray-300/50 dark:border-white/10 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                     placeholder="1883"
                   />
                 </div>

                {protocolTouched.current && connection.protocol === 'wss' && (
                  <div className={`text-xs ${TONE.warn} ${TONE_BORDER.warn} px-3 py-2 rounded-lg border`}>
                    提示: 如果服务器没有 SSL 证书，请使用 ws://
                  </div>
                )}

                {(connection.protocol === 'ws' || connection.protocol === 'wss') && (
                  <div>
                    <input
                      type="text"
                      value={connection.path}
                      onChange={(e) => setConnection({...connection, path: e.target.value})}
                      disabled={connectStatus === 'connected'}
                      className={configInputStyle}
                      aria-label="Path" placeholder="Path，如 /mqtt"
                    />
                  </div>
                )}

                <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-blue-500 transition-colors">
                  {showAdvanced ? <ChevronUp size={12}/> : <ChevronDown size={12}/>} 高级设置 (Auth)
                </button>

                {showAdvanced && (
                  <div className="space-y-3">
                    <div>
                      <label className={labelStyle}>Client ID</label>
                      <input type="text" value={connection.clientId} onChange={(e) => setConnection({...connection, clientId: e.target.value})} className={configInputStyle} />
                    </div>
                    <div>
                      <label className={labelStyle}>Auth</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={connection.username} onChange={(e) => setConnection({...connection, username: e.target.value})} disabled={connectStatus === 'connected'} placeholder="用户名" className={configInputStyle}/>
                        <input type="password" value={connection.password} onChange={(e) => setConnection({...connection, password: e.target.value})} disabled={connectStatus === 'connected'} placeholder="密码" className={configInputStyle}/>
                      </div>
                    </div>
                    <div className={`p-3 ${t.bgTertiary} rounded-lg border ${t.borderLight} space-y-2`}>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className={`text-[11px] ${t.textMuted} block mb-1`}>Keep Alive (秒)</label>
                        <input type="number" value={advancedConfig.keepalive} onChange={(e) => setAdvancedConfig({...advancedConfig, keepalive: e.target.value})} className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-2 py-1 text-xs ${t.text}`}/>
                      </div>
                      <div className="flex-1">
                        <label className={`text-[11px] ${t.textMuted} block mb-1`}>协议版本</label>
                        <select value={advancedConfig.protocolVersion} onChange={(e) => setAdvancedConfig({...advancedConfig, protocolVersion: Number(e.target.value)})} className={`w-full rounded-lg px-2 py-1 text-xs ${themedSelectClass}`}>
                          <option value={3}>MQTT 3.1</option>
                          <option value={4}>MQTT 3.1.1</option>
                          <option value={5}>MQTT 5.0</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={advancedConfig.clean} onChange={(e) => setAdvancedConfig({...advancedConfig, clean: e.target.checked})} className="rounded bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-blue-600"/>
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
                  </div>
                )}

                <button
                  onClick={connectStatus === 'connected' || connectStatus === 'connecting' || reconnectCount > 0 ? handleDisconnect : handleConnect}
                  disabled={!sdkReady}
                  className={`w-full text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg transition-all text-sm ${
                    connectStatus !== 'connected'
                      ? reconnectCount > 0
                        ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
                        : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
                      : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
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

                {/* 预设配置（本地保存/加载） */}
                <div className="flex gap-2">
                   <select className={`flex-1 text-xs rounded-lg px-3 py-2 focus:border-blue-500 ${themedSelectClass}`} onChange={handleLoadConfig} value={connection.name || ""}>
                     <option value="" disabled>加载预设配置...</option>
                     {savedConfigs.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <button onClick={handleSaveConfig} title="保存配置" className={`p-2 ${t.bgTertiary} ${t.bgHover} border ${t.border} rounded-lg ${t.textMuted} hover:text-blue-500 transition-colors`}><Save className="w-4 h-4"/></button>
                    {connection.name && <button onClick={handleDeleteConfig} title="删除配置" className={`p-2 ${t.bgTertiary} ${t.bgHover} border ${t.border} rounded-lg ${t.textMuted} hover:text-rose-500 transition-colors`}><Trash2 className="w-4 h-4"/></button>}
                 </div>
              </div>
            )}
          </div>

          {/* 订阅管理 */}
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setSubscriptionsCollapsed((v) => !v)}
              className="w-full flex items-center justify-between group py-1.5 mb-1"
              title={subscriptionsCollapsed ? '展开订阅' : '收起订阅'}
            >
              <div className="flex items-center gap-2 font-bold text-[13px] text-[#333D4F] dark:text-[#E6EDF3]">
                <span>订阅监控</span>
              </div>
              <div className="flex items-center gap-2">
                {subscriptionsCollapsed ? (
                  <ChevronDown size={16} className="text-slate-600 group-hover:text-slate-800 dark:group-hover:text-slate-300 transition-colors" />
                ) : (
                  <ChevronUp size={16} className="text-slate-600 group-hover:text-slate-800 dark:group-hover:text-slate-300 transition-colors" />
                )}
              </div>
            </button>

            {!subscriptionsCollapsed && (
              <div className="space-y-2 mt-2">
                <div className="space-y-1 px-2">
                  {subMonitorSelectedTopics.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSubMonitorSelectedTopics([])}
                      className={`text-[11px] ${t.textMuted} hover:text-blue-500 transition-colors mb-1 px-1`}
                    >
                      清除筛选（已选 {subMonitorSelectedTopics.length}）
                    </button>
                  )}
                  {subscriptions.map(sub => {
                    const isSelected = subMonitorSelectedTopics.includes(sub);
                    return (
                    <div
                      key={sub}
                      onClick={() => toggleSubMonitorTopicSelection(sub)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl border group transition-all cursor-pointer ${
                        isSelected
                          ? (theme === 'light' ? 'bg-blue-50/80 border-blue-300' : 'bg-blue-500/10 border-blue-500/30')
                          : 'bg-white/50 dark:bg-[#1C2128]/50 border-[#E1E4E8]/50 dark:border-[#30363D]/50 hover:bg-white dark:hover:bg-[#1C2128]'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSelected ? 'bg-blue-500 shadow-[0_0_8px_rgba(91,141,239,0.5)]' : 'bg-blue-500/40'}`}></span>
                        <span className={`text-[12px] font-mono truncate ${isSelected ? 'text-blue-500 dark:text-blue-300 font-semibold' : 'text-[#333D4F] dark:text-[#E6EDF3]'}`} title={sub}>{sub}</span>
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
                {newTopicOpen && (
                  <div
                    className="px-2 animate-in fade-in slide-in-from-top-2 duration-200"
                    onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setNewTopicOpen(false); }}
                  >
                    <div className={`flex items-center ${t.bgInput} border ${t.border} rounded-lg overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all`}>
                      <input
                        ref={subTopicInputRef}
                        type="text"
                        placeholder="Topic，如 # 或 a/b/+"
                        aria-label="订阅 Topic"
                        value={subTopic}
                        onChange={(e) => setSubTopic(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { handleSubscribe(); setNewTopicOpen(false); }
                          else if (e.key === 'Escape') setNewTopicOpen(false);
                        }}
                        className={`flex-1 min-w-0 bg-transparent px-2.5 py-1.5 text-xs font-mono outline-none ${t.text}`}
                      />
                      <button
                        onClick={() => { handleSubscribe(); setNewTopicOpen(false); }}
                        disabled={!client?.connected}
                        className="shrink-0 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        订阅
                      </button>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setNewTopicOpen(true); setTimeout(() => subTopicInputRef.current?.focus(), 0); }}
                  className="w-full mt-1 py-2.5 border-2 border-dashed border-blue-500/30 dark:border-blue-300/30 rounded-xl text-[12px] font-bold text-blue-500 dark:text-blue-300 hover:bg-blue-500/10 dark:hover:bg-blue-300/10 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={15} strokeWidth={2.5}/> New Topic
                </button>
              </div>
            )}
          </div>
        </section>
        </div>

      </aside>

      {/* 右侧主内容区 */}
      <main className={`flex-1 flex flex-col min-w-0 relative ${t.bg} transition-colors duration-300`}>

        {/* 顶部 Header */}
        <header className={`app-header sticky top-0 z-20 ${theme === 'light' ? 'bg-[#F9FAFB]' : 'bg-[#09090B]'} border-b ${t.border} h-16 px-5 flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3 h-full">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-2 rounded-xl ${t.textSecondary} ${t.bgHover} transition-all duration-300 ${!isSidebarOpen && 'rotate-180'}`}
              title="切换侧栏"
            >
              <Layout size={18} />
            </button>
            <div className="flex items-center bg-gray-100 dark:bg-zinc-800/50 rounded-lg p-0.5">
              {([['all', '全部'], ['in', '接收'], ['out', '发送']]).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => setLogTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all duration-300 ${
                    logTypeFilter === type
                      ? 'bg-white dark:bg-zinc-700 text-blue-500 dark:text-blue-300 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${TONE.info}`}>{filteredMessageLogs.length}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 mr-1">
              <button onClick={() => setLogViewMode(m => m==='text'?'hex':'text')} className={`text-[11px] px-2.5 py-1 rounded-lg ${t.textSecondary} ${t.bgHover} transition-colors flex items-center gap-1`}>
                <Binary className="w-3 h-3"/>{logViewMode.toUpperCase()}
              </button>
              <button onClick={() => setIsAutoScroll(!isAutoScroll)} className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${isAutoScroll ? TONE.ok : TONE.warn}`}>
                {isAutoScroll ? '自动滚动' : '已暂停'}
              </button>
            </div>
            <div className="relative group">
              <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${t.textMuted} group-focus-within:text-blue-500 transition-colors`} size={15} />
              <input
                type="text"
                value={logFilter}
                onChange={e => setLogFilter(e.target.value)}
                placeholder="搜索日志..."
                ref={logFilterInputRef}
                className={`pl-10 pr-4 py-2 ${t.bgInput} ${t.border} border rounded-full text-[13px] w-40 min-[1180px]:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${t.text} placeholder:${t.textMuted}`}
              />
            </div>
            {isDevMode && (
              <button
                onClick={() => setEventCenterOpen(true)}
                title="事件中心（开发模式）"
                className={`relative p-2 rounded-xl ${t.textSecondary} ${t.bgHover} transition-all duration-300`}
              >
                <Bell size={16} />
              </button>
            )}
            <button
              onClick={() => setLogs([])}
              className={`p-2 rounded-xl ${t.textSecondary} ${t.bgHover} transition-all duration-300`}
              title="清空日志"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </header>

        {/* 日志区域 */}
        <div className="flex-1 flex flex-col min-h-0 relative">

          {/* 日志列表 */}
          <div className="app-log-list flex-1 overflow-y-auto py-4 custom-scrollbar">
            <div className="px-8 space-y-3 min-h-full flex flex-col">
            {filteredMessageLogs.length === 0 ? (
              <div className={`flex flex-col items-center justify-center flex-1 ${t.textMuted}`}>
                <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">暂无日志记录</p>
                <p className="text-xs mt-1">连接服务器并订阅主题后，消息将显示在这里</p>
              </div>
            ) : (
              filteredMessageLogs.map(log => (
                <LogItem key={log.id} log={log} theme={theme} logViewMode={logViewMode} onEdit={handleEditFromLog} />
              ))
            )}
            <div ref={logsEndRef} />
            </div>
          </div>
        </div>

        {/* 发布台 */}
        <div className="shrink-0 mx-4 mb-3 z-20">
          <div className={`p-3 ${t.floatingPanel} flex flex-col gap-2.5`}>

            {/* 控制行：Topic + QoS + Retain + 定时 */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Hash className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={14} />
                <input
                  type="text"
                  value={pubTopic}
                  onChange={(e) => setPubTopic(e.target.value)}
                  placeholder="Topic (e.g. device/control)"
                  className={`w-full pl-9 pr-4 py-2 text-[13px] font-mono ${t.bgInput} border border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all ${t.text}`}
                />
              </div>
              <div className={`flex items-center gap-4 px-4 py-2 rounded-xl ${t.bgInput} border border-transparent`}>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">QoS</span>
                  <select value={pubQoS} onChange={(e) => setPubQoS(Number(e.target.value))} className="bg-transparent text-[13px] font-mono outline-none text-[#333D4F] dark:text-[#E6EDF3] cursor-pointer">
                    <option value={0}>0</option>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                  </select>
                </div>
                <div className="w-px h-4 bg-[#D1D5DB] dark:bg-[#4B5563]"></div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={pubRetain} onChange={e => setPubRetain(e.target.checked)} />
                    <div className={`block w-8 h-5 rounded-full transition-colors duration-300 ${pubRetain ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-300 dark:bg-zinc-700'}`}></div>
                    <div className={`absolute left-0.5 top-0.5 bg-white w-3.5 h-3.5 rounded-full transition-transform duration-300 shadow-sm ${pubRetain ? 'translate-x-3.5' : ''}`}></div>
                  </div>
                  <span className="text-[12px] font-bold text-gray-500 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">Retain</span>
                </label>
              </div>

              {/* 定时发送 */}
              <div className={`flex items-center gap-2 ${t.bgInput} border border-transparent rounded-xl px-3 py-2`}>
                <Timer className={`w-4 h-4 ${t.textMuted}`}/>
                {timerEnabled ? (
                  <span className="w-[72px] text-center text-xs font-mono text-emerald-600 dark:text-emerald-400">
                    {formatTimerCountdown(timerRemainingMs)}
                  </span>
                ) : (
                  <>
                    <input
                      type="number"
                      value={timerInterval}
                      onChange={(e) => setTimerInterval(Math.max(100, Number(e.target.value)))}
                      className={`w-14 bg-transparent text-xs outline-none text-center ${t.textSecondary}`}
                      placeholder="间隔"
                      aria-label="定时间隔（毫秒）"
                    />
                    <span className={`text-xs ${t.textMuted}`}>ms</span>
                  </>
                )}
                <button
                  onClick={toggleTimer}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    timerEnabled
                      ? `${TONE.err} hover:bg-rose-100 dark:hover:bg-rose-500/20`
                      : `${TONE.ok} hover:bg-emerald-100 dark:hover:bg-emerald-500/20`
                  }`}
                >
                  {timerEnabled ? '停止' : '定时'}
                </button>
              </div>
            </div>

            {timerEnabled && (
              <div className="h-0.5 -mt-1 rounded-full overflow-hidden bg-emerald-500/15" role="progressbar" aria-label="定时发送进度">
                <div className="h-full bg-emerald-500 transition-[width] duration-100" style={{ width: `${timerProgress}%` }} />
              </div>
            )}

            {/* 快捷指令行 */}
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-0.5">
              <div className={`flex items-center gap-1.5 pr-2 text-slate-500 dark:text-slate-400 border-r ${theme === 'light' ? 'border-slate-200' : 'border-slate-700/50'} shrink-0`}>
                <Star size={13} className="text-[#F59E0B] dark:text-[#FBBF24]" />
                <span className="text-[12px] font-bold">快捷指令</span>
              </div>
              {commonActions.map((action) => (
                <button
                  key={actionIdKey(action?.id) || action.name}
                  type="button"
                  onClick={(e) => (e.shiftKey
                    ? fillQuickAction(action, { closePanel: false, clearQuery: false })
                    : sendQuickAction(action, { closePanel: false }))}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-bold shadow-sm border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-500/60 hover:text-blue-500 dark:hover:border-blue-300/60 dark:hover:text-blue-300 transition-all"
                  title={`${action.name}\n${action.topic}\n点击发送 · Shift+点击仅填入`}
                >
                  {action.name}
                </button>
              ))}
              <button onClick={handleSaveAction} className="shrink-0 px-2 py-1 rounded-lg text-blue-500 hover:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-300/10 text-[11px] font-bold transition-colors flex items-center gap-1 border border-dashed border-blue-500/40 dark:border-blue-300/40 ml-1">
                <Plus size={12} strokeWidth={2.5}/> 存为指令
              </button>
              <button onClick={() => setShowQuickActionsPanel(true)} className="shrink-0 px-2 py-1 rounded-lg text-[11px] font-bold text-blue-500 hover:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-300/10 transition-colors flex items-center gap-1 ml-auto">
                <Zap size={12} strokeWidth={2.5}/> 快捷面板
                <span className={`text-[11px] font-semibold ${theme === 'light' ? 'text-blue-500' : 'text-blue-300'}`}>{quickActions.length}</span>
              </button>
            </div>

            {/* Payload + 发送（可垂直拉伸） */}
            <div className="flex gap-3 items-end">
              <div className={`flex-1 relative rounded-xl ${t.bgInput} border border-transparent focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:bg-white dark:focus-within:bg-zinc-900 transition-all`}>
                <textarea
                  ref={pubMessageTextareaRef}
                  value={pubMessage}
                  onChange={(e) => setPubMessage(e.target.value)}
                  className={`payload-textarea custom-scrollbar w-full bg-transparent p-3 font-mono text-[13px] leading-relaxed ${t.text} min-h-[64px] max-h-[38vh] overflow-y-auto outline-none rounded-xl`}
                  placeholder='{"msg": "Hello"}'
                  spellCheck="false"
                />
                <button type="button" onClick={openPublishEditor} className={`absolute bottom-2 right-2 p-1.5 rounded-lg ${t.textSecondary} ${t.bgHover} transition-all`} title="编辑即将发送的消息"><Edit2 size={14}/></button>
              </div>
              <button onClick={handlePublish} disabled={!client?.connected} className={`w-24 self-stretch min-h-[64px] bg-blue-500 hover:bg-blue-600 dark:bg-blue-400 dark:hover:bg-blue-300 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-500/25 dark:shadow-blue-400/20`}>
                <Send size={20}/>
                <span className="text-[13px] font-bold tracking-widest uppercase">发送</span>
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
                      ? TONE.accent
                      : TONE.neutral
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
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted} group-focus-within:text-blue-500 transition-colors`} size={16} />
                  <input
                    type="text"
                    value={eventFilter}
                    onChange={(e) => setEventFilter(e.target.value)}
                    placeholder="搜索事件..."
                    className={`pl-9 pr-4 py-2 ${t.bgInput} border ${t.border} rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${t.text} placeholder:${t.textMuted}`}
                  />
                </div>
                <div className={`text-[11px] ${t.textMuted}`}>
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
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-bold uppercase ${
                          log.type === 'error' ? `${TONE.err} ${TONE_BORDER.err}` :
                          log.type === 'system' ? `${TONE.neutral} ${TONE_BORDER.neutral}` :
                          `${TONE.accent} ${TONE_BORDER.accent}`
                        }`}>{log.type}</span>
                        {log.topic && <span className={`text-xs ${t.textSecondary} font-semibold font-mono truncate`}>{log.topic}</span>}
                        <CopyButton
                          text={[log.topic, log.payload, log.details].filter(Boolean).join('\n')}
                          className={`ml-auto ${t.textMuted} hover:${t.text} p-1 ${t.bgHover} rounded-lg transition-all`}
                        />
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
         .custom-scrollbar::-webkit-scrollbar-thumb { background: ${theme === 'light' ? '#cbd5e1' : 'rgba(156,163,175,0.2)'}; border-radius: 3px; }
         .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${theme === 'light' ? '#94a3b8' : 'rgba(156,163,175,0.4)'}; }
        .connection-config-scroll { scrollbar-gutter: stable; }
        .connection-config-scroll::-webkit-scrollbar { width: 8px; }
        .connection-config-scroll::-webkit-scrollbar-track {
           background: ${theme === 'light' ? 'rgba(241,245,249,0.9)' : 'rgba(10,10,10,0.8)'};
          border-radius: 999px;
        }
        .connection-config-scroll::-webkit-scrollbar-thumb {
           background: ${theme === 'light' ? '#94a3b8' : 'rgba(156,163,175,0.2)'};
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .connection-config-scroll::-webkit-scrollbar-thumb:hover {
           background: ${theme === 'light' ? '#64748b' : 'rgba(156,163,175,0.4)'};
        }
        .themed-select {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          color-scheme: ${theme === 'light' ? 'light' : 'dark'};
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7.5L10 12.5L15 7.5' stroke='${theme === 'light' ? '%2364758b' : '%2394a3b8'}' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.75rem center;
          background-size: 14px 14px;
          padding-right: 2.5rem;
        }
        .themed-select option,
        .themed-select optgroup {
           background: ${theme === 'light' ? '#ffffff' : '#18181B'};
           color: ${theme === 'light' ? '#0f172a' : '#d1d5db'};
        }
        .themed-select:disabled {
          cursor: not-allowed;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7.5L10 12.5L15 7.5' stroke='${theme === 'light' ? '%2394a3b8' : '%23475569'}' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        }
        .payload-textarea { scrollbar-gutter: stable; }
        .payload-textarea::-webkit-scrollbar { width: 10px; }
        .payload-textarea::-webkit-scrollbar-thumb {
           background: ${theme === 'light' ? '#94a3b8' : 'rgba(156,163,175,0.2)'};
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
         .payload-textarea::-webkit-scrollbar-thumb:hover { background: ${theme === 'light' ? '#64748b' : 'rgba(156,163,175,0.4)'}; }
        .payload-textarea::-webkit-resizer {
          background:
            linear-gradient(135deg, transparent 0 58%, ${theme === 'light' ? '#cbd5e1' : 'rgba(156,163,175,0.2)'} 58% 66%, transparent 66% 74%, ${theme === 'light' ? '#94a3b8' : 'rgba(156,163,175,0.4)'} 74% 82%, transparent 82% 100%);
        }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-from-bottom-2 { from { transform: translateY(8px); } to { transform: translateY(0); } }
        .animate-in { animation: fade-in 0.2s ease-out, slide-in-from-bottom-2 0.2s ease-out; }
      `}</style>
    </div>
  );
}
