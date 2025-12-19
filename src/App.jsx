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
  AlertCircle, Layout
} from 'lucide-react';

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
  
  // --- 数据状态 ---
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [quickActions, setQuickActions] = useState([]);

  // --- 编辑/运行状态 ---
  const [connection, setConnection] = useState({
    name: '默认 EMQX 公共服', 
    protocol: 'wss',
    host: 'broker.emqx.io',
    port: 8084,
    path: '/mqtt',
    clientId: `mqtt_debugger_${Math.random().toString(16).substr(2, 8)}`,
    username: '',
    password: ''
  });

  const [advancedConfig, setAdvancedConfig] = useState({
    keepalive: 60, clean: true, willEnabled: false,
    willTopic: 'last/will', willPayload: 'offline', willQos: 0, willRetain: false
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

  // --- 初始化逻辑 ---
  useEffect(() => {
    if (window.mqtt) { setSdkReady(true); } 
    else {
      const script = document.createElement('script');
      script.src = "https://unpkg.com/mqtt@5.3.5/dist/mqtt.min.js";
      script.async = true;
      script.onload = () => setSdkReady(true);
      document.body.appendChild(script);
    }
  }, []);

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
    setLogs(prev => {
      const newLogs = [...prev, { id: Date.now(), timestamp: new Date().toLocaleTimeString(), type, topic, payload, details }];
      return newLogs.length > 500 ? newLogs.slice(newLogs.length - 500) : newLogs;
    });
  };
  useEffect(() => { if (isAutoScroll) logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs, isAutoScroll]);
  useEffect(() => {
    let i; if (connectStatus === 'connected') i = setInterval(() => setConnectDuration(p => p + 1), 1000);
    else setConnectDuration(0); return () => clearInterval(i);
  }, [connectStatus]);

  const handleConnect = () => {
    if (!sdkReady) return addLog('error', '', 'SDK 未加载');
    if (client) { client.end(); setClient(null); }
    setConnectStatus('connecting');
    const url = `${connection.protocol}://${connection.host}:${connection.port}${connection.path}`;
    addLog('system', '', `正在连接 ${url}...`);
    try {
      const opts = {
        clientId: connection.clientId, username: connection.username, password: connection.password,
        clean: advancedConfig.clean, keepalive: Number(advancedConfig.keepalive),
        connectTimeout: 4000, reconnectPeriod: 1000, protocolId: 'MQTT', protocolVersion: 4
      };
      if (advancedConfig.willEnabled) opts.will = { topic: advancedConfig.willTopic, payload: advancedConfig.willPayload, qos: Number(advancedConfig.willQos), retain: advancedConfig.willRetain };
      
      const newClient = window.mqtt.connect(url, opts);
      newClient.on('connect', () => { 
        setConnectStatus('connected'); 
        addLog('system', '', '连接成功');
        setConfigCollapsed(true); // 连接成功后自动折叠配置面板
      });
      newClient.on('error', (err) => { setConnectStatus('error'); addLog('error', '', `连接错误: ${err.message}`); });
      newClient.on('message', (t, m) => addLog('received', t, m.toString()));
      setClient(newClient);
    } catch (e) { setConnectStatus('error'); addLog('error', '', e.message); }
  };

  const handleDisconnect = () => { if (client) { client.end(); setClient(null); setConnectStatus('disconnected'); setSubscriptions([]); addLog('system', '', '已断开'); }};
  const handleSubscribe = () => { if (client?.connected && subTopic && !subscriptions.includes(subTopic)) client.subscribe(subTopic, e => !e ? (setSubscriptions(p=>[...p, subTopic]), addLog('system', subTopic, '订阅成功')) : addLog('error', subTopic, '订阅失败')); };
  const handleUnsubscribe = (t) => { if (client?.connected) client.unsubscribe(t, e => !e && (setSubscriptions(p=>p.filter(i=>i!==t)), addLog('system', t, '退订成功'))); };
  const handlePublish = () => { 
    if (!client?.connected) return addLog('error', '', '请先连接'); 
    if (pubTopic) client.publish(pubTopic, pubMessage, { qos: pubQoS, retain: pubRetain }, e => e ? addLog('error', pubTopic, e.message) : addLog('sent', pubTopic, pubMessage, `QoS: ${pubQoS}`)); 
  };
  
  // Formatters
  const formatDuration = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  const toHex = (str) => { let h=''; for(let i=0;i<str.length;i++) h+=str.charCodeAt(i).toString(16).padStart(2,'0')+' '; return h.toUpperCase(); };
  const isJson = (str) => { try { JSON.parse(str); return true; } catch { return false; } };
  const tryFormatJson = (str) => { try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; } };

  const filteredLogs = logs.filter(log => !logFilter || (log.topic+log.payload+log.type).toLowerCase().includes(logFilter.toLowerCase()));

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden selection:bg-blue-500/30">
      
      {/* 模态框 */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-800 rounded-lg shadow-2xl max-w-sm w-full border border-slate-700 p-5 transform scale-100">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              {modal.type === 'confirm' && <AlertCircle className="w-5 h-5 text-yellow-500" />}
              {modal.title}
            </h3>
            {modal.type === 'input' && (
              <input 
                autoFocus type="text" value={modal.inputValue} onChange={(e) => setModal({...modal, inputValue: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && handleModalSubmit()}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none mb-4"
              />
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setModal({...modal, open: false})} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors">取消</button>
              <button onClick={handleModalSubmit} className={`px-4 py-2 rounded text-sm font-medium transition-colors ${modal.type === 'confirm' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>{modal.type === 'confirm' ? '确定删除' : '确定保存'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 顶部栏 */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-800 border-b border-slate-700 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold tracking-wide">MQTT Pro <span className="text-xs align-top bg-blue-600 text-white px-1 rounded ml-1">Cloud</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowSyncModal(true)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${!isFirebaseAvailable ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500 border-slate-700' : isCloudConnected ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
            {isCloudConnected ? <Cloud className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            <span>{isCloudConnected ? '已同步' : '未同步'}</span>
          </button>
          {connectStatus === 'connected' && (<div className="flex items-center gap-2 text-slate-400 text-sm font-mono bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700"><Clock className="w-3 h-3" /><span>{formatDuration(connectDuration)}</span></div>)}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-all ${connectStatus === 'connected' ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30' : connectStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30' : connectStatus === 'error' ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30' : 'bg-slate-700 text-slate-400'}`}>
            {connectStatus === 'connected' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span>{connectStatus === 'connected' ? '已连接' : connectStatus === 'connecting' ? '连接中' : '未连接'}</span>
          </div>
        </div>
      </header>

      {/* 云同步弹窗 */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-lg shadow-2xl max-w-md w-full border border-slate-700 p-6">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold flex items-center gap-2"><Cloud className="w-5 h-5 text-indigo-400"/> 多设备云同步</h3><button onClick={() => setShowSyncModal(false)} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5"/></button></div>
            {!isFirebaseAvailable ? (
               <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded text-yellow-200 text-sm"><p className="font-bold mb-1">功能未开启</p><p className="text-xs opacity-80">当前环境未配置 Firebase，无法使用云同步功能。</p></div>
            ) : (
              <>
                <p className="text-sm text-slate-400 mb-4">输入一个唯一的 <b>Space ID</b>，所有使用该 ID 的设备将实时同步数据。</p>
                <div className="space-y-4">
                  <div className="flex gap-2"><input type="text" value={inputSpaceId} onChange={(e) => setInputSpaceId(e.target.value)} placeholder="Space ID" className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 focus:border-indigo-500 outline-none"/><button onClick={() => setInputSpaceId(`space_${Math.random().toString(36).substr(2, 6)}`)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-xs">随机</button></div>
                  <div className="flex gap-3 pt-2"><button onClick={handleConnectSync} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded font-medium">开启同步</button>{syncSpaceId && <button onClick={handleDisconnectSync} className="px-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded font-medium">断开</button>}</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 主布局：左右结构 */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* 左侧侧边栏 (固定宽度, 集合了所有管理功能) */}
        <div className="w-[340px] flex-none flex flex-col border-r border-slate-700 bg-slate-900 overflow-hidden">
          
          {/* 1. 连接配置 (支持折叠) */}
          <div className="border-b border-slate-800 shrink-0">
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => setConfigCollapsed(!configCollapsed)}>
              <h2 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2"><Server className="w-4 h-4"/> 连接配置</h2>
              <div className="flex items-center gap-2">
                 {connectStatus === 'connected' && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 rounded">在线</span>}
                 {configCollapsed ? <ChevronDown className="w-4 h-4 text-slate-500"/> : <ChevronUp className="w-4 h-4 text-slate-500"/>}
              </div>
            </div>
            
            {!configCollapsed && (
              <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex gap-1 mb-3">
                   <select className="flex-1 bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1 focus:border-blue-500 outline-none" onChange={handleLoadConfig} value={connection.name || ""}><option value="" disabled>加载预设配置...</option>{savedConfigs.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select>
                   <button onClick={handleSaveConfig} title="保存配置" className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-400 hover:text-blue-400"><Save className="w-4 h-4"/></button>
                   {connection.name && <button onClick={handleDeleteConfig} title="删除配置" className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4"/></button>}
                </div>
                <div className="space-y-2">
                  <input type="text" value={connection.host} onChange={(e) => setConnection({...connection, host: e.target.value})} disabled={connectStatus === 'connected'} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:border-blue-500 outline-none" placeholder="Host (e.g. broker.emqx.io)"/>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" value={connection.port} onChange={(e) => setConnection({...connection, port: Number(e.target.value)})} disabled={connectStatus === 'connected'} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:border-blue-500 outline-none" placeholder="Port"/>
                    <select value={connection.protocol} onChange={(e) => setConnection({...connection, protocol: e.target.value})} disabled={connectStatus === 'connected'} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:border-blue-500 outline-none"><option value="ws">ws://</option><option value="wss">wss://</option></select>
                  </div>
                  <input type="text" value={connection.path} onChange={(e) => setConnection({...connection, path: e.target.value})} disabled={connectStatus === 'connected'} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:border-blue-500 outline-none" placeholder="Path (e.g. /mqtt)"/>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={connection.username} onChange={(e) => setConnection({...connection, username: e.target.value})} disabled={connectStatus === 'connected'} placeholder="User (Opt)" className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:border-blue-500 outline-none"/>
                    <input type="password" value={connection.password} onChange={(e) => setConnection({...connection, password: e.target.value})} disabled={connectStatus === 'connected'} placeholder="Pass (Opt)" className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:border-blue-500 outline-none"/>
                  </div>
                  <div className="">
                    <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 font-medium mb-1">{showAdvanced ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>} 高级设置</button>
                    {showAdvanced && (<div className="p-2 bg-slate-950/30 rounded border border-slate-800 space-y-2"><div className="flex gap-2"><div className="flex-1"><label className="text-[10px] text-slate-500 block">Keep Alive</label><input type="number" value={advancedConfig.keepalive} onChange={(e) => setAdvancedConfig({...advancedConfig, keepalive: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-[10px]"/></div><div className="flex items-end pb-1"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={advancedConfig.clean} onChange={(e) => setAdvancedConfig({...advancedConfig, clean: e.target.checked})} className="rounded bg-slate-800 border-slate-700 text-blue-600"/><span className="text-[10px] text-slate-400">Clean Session</span></label></div></div></div>)}
                  </div>
                  <button onClick={connectStatus !== 'connected' ? handleConnect : handleDisconnect} disabled={connectStatus === 'connecting' || !sdkReady} className={`w-full text-white py-2 rounded font-medium flex items-center justify-center gap-2 shadow-lg transition-colors text-xs ${connectStatus !== 'connected' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'}`}>{connectStatus !== 'connected' ? (!sdkReady ? <Loader2 className="w-3 h-3 animate-spin"/> : <Play className="w-3 h-3 fill-current"/>) : <Square className="w-3 h-3 fill-current"/>}{connectStatus !== 'connected' ? (sdkReady ? '连接' : 'Loading...') : '断开'}</button>
                </div>
              </div>
            )}
          </div>

          {/* 2. 订阅管理 (占剩余空间的 1/3 ~ 1/2) */}
          <div className="flex-1 min-h-0 flex flex-col border-b border-slate-800">
             <div className="px-4 py-3 bg-slate-900 shrink-0"><h2 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2"><Download className="w-4 h-4"/> 订阅监控</h2></div>
             <div className="px-4 pb-2 shrink-0">
               <div className="flex gap-1">
                <input type="text" placeholder="Topic (e.g. #)" value={subTopic} onChange={(e) => setSubTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()} className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:border-blue-500 outline-none"/>
                <button onClick={handleSubscribe} disabled={!client?.connected} className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50">订阅</button>
              </div>
             </div>
             <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-1 custom-scrollbar">
               {subscriptions.map(sub => (<div key={sub} className="flex items-center justify-between bg-slate-800 px-2 py-1.5 rounded border border-slate-700/50 group hover:border-blue-500/30"><span className="text-xs text-green-400 font-mono truncate mr-2" title={sub}>{sub}</span><button onClick={() => handleUnsubscribe(sub)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3"/></button></div>))}
               {subscriptions.length === 0 && <div className="text-[10px] text-slate-600 text-center py-4 border border-dashed border-slate-800 rounded">暂无订阅</div>}
             </div>
          </div>

          {/* 3. 快捷指令 (从右侧移动到左侧，作为“工具箱”) */}
          <div className="flex-[1.5] min-h-0 flex flex-col bg-slate-900">
             <div className="px-4 py-3 bg-slate-900 shrink-0 border-t border-slate-800"><h2 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500"/> 快捷指令箱</h2></div>
             <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 custom-scrollbar">
               {quickActions.length === 0 ? <div className="text-center py-6 border border-dashed border-slate-800 rounded text-[10px] text-slate-600">空空如也<br/>请在右侧保存指令</div> : (
                   quickActions.map(action => (
                     <div key={action.id} className="bg-slate-800 border border-slate-700 hover:border-blue-500/50 rounded p-2.5 group transition-colors">
                       <div className="flex justify-between items-start mb-1">
                         <span className="font-bold text-xs text-slate-200">{action.name}</span>
                         <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleLoadAction(action)} className="hover:text-blue-400" title="加载"><Edit2 className="w-3 h-3"/></button><button onClick={(e) => handleDeleteAction(action.id, e)} className="hover:text-red-400" title="删除"><Trash2 className="w-3 h-3"/></button></div>
                       </div>
                       <div className="text-[10px] text-slate-500 truncate mb-1">{action.topic}</div>
                       <div className="flex items-center gap-2">
                         <code className="flex-1 text-[10px] text-slate-400 bg-slate-950/50 px-1.5 py-0.5 rounded truncate font-mono border border-slate-800">{action.payload}</code>
                         <button onClick={() => handleFireAction(action)} className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-2 py-0.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1 shrink-0"><Zap className="w-3 h-3"/> 发送</button>
                       </div>
                     </div>
                   ))
               )}
             </div>
          </div>
        </div>

        {/* 右侧主视图 */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0f172a]">
          
          {/* 上部：日志区 (flex-1 自动撑满) */}
          <div className="flex-1 flex flex-col min-h-0 relative">
             <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center shrink-0">
               <div className="flex items-center gap-4 flex-1">
                 <h2 className="text-sm font-bold text-slate-400 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> 实时日志</h2>
                 <div className="relative max-w-xs w-full"><Search className="absolute left-2 top-1.5 w-4 h-4 text-slate-500"/><input type="text" value={logFilter} onChange={e=>setLogFilter(e.target.value)} placeholder="Filter..." className="w-full bg-slate-900/50 rounded pl-8 py-1 text-xs focus:outline-none text-slate-300"/></div>
               </div>
               <div className="flex items-center gap-2">
                 <button onClick={() => setLogViewMode(m => m==='text'?'hex':'text')} className="text-xs px-2 py-1 rounded text-slate-400 hover:bg-slate-700"><Binary className="w-3 h-3 inline mr-1"/>{logViewMode.toUpperCase()}</button>
                 <button onClick={() => setIsAutoScroll(!isAutoScroll)} className={`text-xs px-2 py-1 rounded ${isAutoScroll?'text-green-400':'text-yellow-400'}`}>{isAutoScroll?'滚动':'暂停'}</button>
                 <button onClick={() => setLogs([])} className="text-xs px-2 py-1 rounded text-slate-400 hover:bg-slate-700"><Trash2 className="w-3 h-3"/></button>
               </div>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm custom-scrollbar relative">
               {filteredLogs.map(log => (
                 <div key={log.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-1 duration-200 group">
                   <div className="text-xs text-slate-600 min-w-[70px] pt-1">{log.timestamp}</div>
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2 mb-1">
                       <span className={`text-[10px] px-1.5 rounded border font-bold ${log.type==='sent'?'text-blue-400 border-blue-500/20 bg-blue-500/10':log.type==='received'?'text-green-400 border-green-500/20 bg-green-500/10':'text-red-400 border-red-500/20 bg-red-500/10'}`}>{log.type.toUpperCase()}</span>
                       <span className="text-xs text-slate-400 font-bold">{log.topic}</span>
                       <button onClick={()=>navigator.clipboard.writeText(log.payload)} className="ml-auto opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white"><Copy className="w-3 h-3"/></button>
                     </div>
                     <div className={`p-3 rounded text-slate-300 text-xs break-all whitespace-pre-wrap border ${log.type==='sent'?'bg-blue-900/10 border-blue-900/20':'bg-slate-800 border-slate-700'}`}>
                       {logViewMode==='hex' ? <div className="text-purple-300 tracking-wider">{toHex(log.payload)}</div> : (isJson(log.payload)?<pre className="text-blue-300 overflow-x-auto">{tryFormatJson(log.payload)}</pre>:log.payload)}
                     </div>
                   </div>
                 </div>
               ))}
               <div ref={logsEndRef} />
             </div>
          </div>

          {/* 下部：发布区 (紧凑型，高度大大降低) */}
          <div className="shrink-0 border-t border-slate-700 bg-slate-900 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)] z-10">
            <div className="p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-1">
                   <input type="text" value={pubTopic} onChange={(e) => setPubTopic(e.target.value)} className="flex-[2] bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono focus:border-blue-500 outline-none" placeholder="Topic"/>
                   <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded px-2">
                     <select value={pubQoS} onChange={(e) => setPubQoS(Number(e.target.value))} className="bg-transparent text-[10px] outline-none"><option value={0}>QoS 0</option><option value={1}>QoS 1</option><option value={2}>QoS 2</option></select>
                     <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer border-l border-slate-600 pl-2"><input type="checkbox" checked={pubRetain} onChange={e=>setPubRetain(e.target.checked)} className="rounded bg-slate-700 border-slate-600 w-3 h-3"/> Retain</label>
                   </div>
                </div>
                <button onClick={handleSaveAction} className="ml-3 text-[10px] flex items-center gap-1 text-blue-400 hover:text-blue-300 border border-blue-500/20 px-2 py-1 rounded bg-blue-500/10"><Plus className="w-3 h-3"/> 存为指令</button>
              </div>
              
              <div className="flex gap-2 h-[120px]">
                <textarea value={pubMessage} onChange={(e) => setPubMessage(e.target.value)} className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs font-mono resize-none focus:border-blue-500 outline-none" placeholder="Payload (Message)"/>
                <button onClick={handlePublish} disabled={!client?.connected} className="w-[80px] bg-blue-600 hover:bg-blue-500 text-white rounded font-medium disabled:opacity-50 flex flex-col items-center justify-center gap-1 transition-colors"><Send className="w-5 h-5"/> <span className="text-xs">发送</span></button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }`}</style>
    </div>
  );
}