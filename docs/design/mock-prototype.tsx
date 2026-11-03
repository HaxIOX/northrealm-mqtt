import React, { useState, useRef } from 'react';
import {
  Moon, Sun, Settings, Zap, Play, ChevronDown, ChevronUp, Download, Upload,
  Trash2, Edit3, MessageSquare, Plus, Search, Server, User, Lock, Send, 
  Activity, Save, Clock, Layout, Hash, Command, CornerDownLeft, Copy, MoreHorizontal, Star
} from 'lucide-react';

const mockMessages = [
  {
    id: 1,
    type: 'in',
    topic: 'card-v1/004B12C1CAE4/alerts/stationary',
    qos: 0,
    timestamp: '12:04:26',
    payload: '{\n  "alert": "stationary_timeout",\n  "battery_level": 56,\n  "lat": 0,\n  "lon": 0,\n  "d": 3,\n  "wifi": [\n    {\n      "ssid": "home_net",\n      "rssi": -65\n    }\n  ]\n}'
  },
  {
    id: 2,
    type: 'out',
    topic: 'device/control/air_conditioner',
    qos: 1,
    timestamp: '12:05:12',
    payload: '{\n  "cmd": "set_temp",\n  "value": 22,\n  "mode": "cool",\n  "active": true,\n  "payload": null\n}'
  }
];

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [connectionState, setConnectionState] = useState('connected');
  
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [isSubOpen, setIsSubOpen] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filterType, setFilterType] = useState('all');

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [payload, setPayload] = useState('{\n  "cmd": "set_temp",\n  "value": 22\n}');
  const textareaRef = useRef(null);

  // Address states
  const [protocol, setProtocol] = useState('mqtt://');
  const [host, setHost] = useState('broker.emqx.io');

  // Form states
  const [retain, setRetain] = useState(false);
  const [qos, setQos] = useState('0');

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);
  
  const handleConnect = () => {
    if (connectionState === 'disconnected') {
      setConnectionState('connecting');
      setTimeout(() => setConnectionState('connected'), 1200);
    } else {
      setConnectionState('disconnected');
    }
  };

  const handlePayloadKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      
      setPayload(payload.substring(0, start) + "  " + payload.substring(end));
      
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const filteredMessages = mockMessages.filter(msg => filterType === 'all' ? true : msg.type === filterType);

  const theme = {
    app: 'bg-[#F9FAFB] dark:bg-[#09090B]', 
    sidebar: 'bg-white/60 dark:bg-[#18181B]/60 backdrop-blur-2xl border-r border-gray-200/50 dark:border-white/5',
    textMain: 'text-gray-800 dark:text-gray-200',
    textMuted: 'text-slate-500 dark:text-slate-400',
    
    floatingPanel: 'bg-white/80 dark:bg-[#18181B]/80 backdrop-blur-xl shadow-lg shadow-gray-200/40 dark:shadow-black/40 border border-gray-200/50 dark:border-white/10 rounded-2xl',
    inputBg: 'bg-gray-100/70 dark:bg-zinc-900/50 transition-all duration-300 focus:bg-white dark:focus:bg-zinc-900',
    focusRing: 'focus:ring-2 focus:ring-[#5B8DEF]/30 focus:border-[#5B8DEF] dark:focus:ring-[#93B6F8]/30 dark:focus:border-[#93B6F8]',
    
    btnPrimaryBase: 'relative overflow-hidden rounded-xl font-semibold tracking-wide transition-all duration-300 ease-out flex items-center justify-center gap-2',
    btnPrimaryColors: 'bg-[#5B8DEF] text-white hover:bg-[#457CE0] dark:bg-[#77A3F6] dark:hover:bg-[#93B6F8]',
    btnPrimaryShadow: 'shadow-md shadow-[#5B8DEF]/25 hover:shadow-lg hover:shadow-[#5B8DEF]/40 dark:shadow-[#77A3F6]/20 dark:hover:shadow-[#77A3F6]/40',
    
    btnDangerColors: 'bg-rose-500 text-white hover:bg-rose-600 dark:bg-rose-500 dark:hover:bg-rose-400',
    btnDangerShadow: 'shadow-md shadow-rose-500/20 hover:shadow-lg hover:shadow-rose-500/40 dark:shadow-rose-500/20 dark:hover:shadow-rose-500/40',
    hoverLift: 'hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
  };

  const inputStyle = `w-full text-[13px] ${theme.textMain} ${theme.inputBg} border border-transparent rounded-xl px-4 py-2.5 outline-none ${theme.focusRing} placeholder:text-gray-400 dark:placeholder:text-gray-500`;
  const iconBtnStyle = `p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-[#5B8DEF] hover:bg-[#5B8DEF]/10 dark:hover:text-[#93B6F8] dark:hover:bg-[#93B6F8]/10 transition-all duration-300 ${theme.hoverLift}`; 
  const labelStyle = `block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider pl-1`; 

  const formatJSON = (jsonString) => {
    const parts = jsonString.split(/(".*?"\s*:|".*?"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],:]|\s+)/g);
    
    return parts.map((part, index) => {
      if (!part) return null;
      
      // key 键名 (#2563eb / dark: #60A5FA)
      if (part.match(/^".*?"\s*:$/)) {
        const keyMatch = part.match(/(".*?")(\s*:)/);
        return (
          <span key={index}>
            <span className="text-blue-600 dark:text-[#60A5FA]">{keyMatch[1]}</span>
            <span className="text-slate-500 dark:text-[#94A3B8]">{keyMatch[2]}</span>
          </span>
        );
      } 
      // string 字符串 (#047857 / dark: #34D399)
      else if (part.match(/^".*"$/)) {
        return <span key={index} className="text-emerald-700 dark:text-[#34D399]">{part}</span>;
      } 
      // number 数字 (#d97706 / dark: #FBBF24)
      else if (part.match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/)) {
        return <span key={index} className="text-amber-600 dark:text-[#FBBF24]">{part}</span>;
      } 
      // boolean / null (#7c3aed / dark: #FB7185)
      else if (part.match(/\btrue\b|\bfalse\b|\bnull\b/)) {
        return <span key={index} className="text-violet-600 dark:text-[#FB7185]">{part}</span>;
      }
      // punct 标点 (#64748b / dark: #94A3B8)
      else if (part.match(/^[{}[\],:]$/)) {
        return <span key={index} className="text-slate-500 dark:text-[#94A3B8]">{part}</span>;
      }
      // other 其它 / 空白 (#475569 / dark: #94A3B8)
      return <span key={index} className="text-slate-600 dark:text-[#94A3B8]">{part}</span>; 
    });
  };

  return (
    <div className={`min-h-screen font-sans ${isDarkMode ? 'dark' : ''} selection:bg-[#B4C5FF]/30 text-[13px]`}>
      <div className={`flex h-screen w-full ${theme.app} ${theme.textMain} overflow-hidden transition-colors duration-500`}>

        {/* --- 侧边栏 --- */}
        <aside className={`${isSidebarOpen ? 'w-[280px] opacity-100' : 'w-0 opacity-0'} transition-all duration-300 ease-in-out flex flex-col ${theme.sidebar} z-20 shrink-0 overflow-hidden`}>
          
          <header className={`h-16 px-6 flex items-center justify-between shrink-0 min-w-[280px]`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#77A3F6] to-[#457CE0] dark:from-[#93B6F8] dark:to-[#77A3F6] flex items-center justify-center text-white shadow-md shadow-[#5B8DEF]/30">
                <Activity size={18} strokeWidth={2.5} />
              </div>
              <span className="font-bold text-[16px] tracking-tight text-gray-800 dark:text-gray-100">NRmqtt</span>
            </div>
            <button onClick={toggleDarkMode} className={iconBtnStyle}>
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </header>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-2 space-y-6">
            
            {/* 状态栏：单行合并状态与地址 */}
            <div className={`flex items-center gap-2 px-3 py-2.5 ${theme.floatingPanel}`}>
              <span className={`relative inline-flex rounded-full h-2 w-2 shrink-0 ${connectionState === 'connected' ? 'bg-[#06D6A0]' : connectionState === 'connecting' ? 'bg-[#FFD166]' : 'bg-[#EF476F]'}`}></span>
              <span className="text-[12px] font-mono font-medium text-slate-700 dark:text-slate-300 truncate" title={`${protocol}${host}`}>
                {protocol}{host}
              </span>
            </div>

            {/* 配置区 */}
            <section>
              <button onClick={() => setIsConfigOpen(!isConfigOpen)} className="w-full flex items-center justify-between group py-2 mb-2">
                <div className="flex items-center gap-2 font-bold text-[13px] text-[#333D4F] dark:text-[#E6EDF3]">
                   Broker Config
                </div>
                {isConfigOpen ? <ChevronUp size={16} className="text-slate-600 group-hover:text-slate-800 dark:group-hover:text-slate-300 transition-colors"/> : <ChevronDown size={16} className="text-slate-600 group-hover:text-slate-800 dark:group-hover:text-slate-300 transition-colors"/>}
              </button>
              
              {isConfigOpen && (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className={labelStyle}>Host & Protocol</label>
                    <div className={`flex items-center ${theme.inputBg} border border-transparent rounded-xl focus-within:ring-2 focus-within:ring-[#5B8DEF]/30 focus-within:border-[#5B8DEF] dark:focus-within:border-[#93B6F8] transition-all overflow-hidden`}>
                      <select 
                        value={protocol}
                        onChange={(e) => setProtocol(e.target.value)}
                        className="bg-transparent text-[13px] text-slate-700 dark:text-slate-300 outline-none pl-3 pr-1 py-2.5 font-bold cursor-pointer border-r border-gray-300/50 dark:border-white/10 shrink-0"
                      >
                        <option value="mqtt://">mqtt://</option>
                        <option value="ws://">ws://</option>
                        <option value="wss://">wss://</option>
                      </select>
                      <input 
                        type="text" 
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        className="flex-1 min-w-0 w-full bg-transparent text-[13px] px-3 py-2.5 outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400 font-medium" 
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelStyle}>Port</label>
                      <input type="number" defaultValue={1883} className={inputStyle} />
                    </div>
                    <div>
                      <label className={labelStyle}>Client ID</label>
                      <input type="text" defaultValue="mqtt_x_1" className={inputStyle} />
                    </div>
                  </div>

                  <div className="pt-1">
                    <button 
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-[11px] font-bold text-slate-500 hover:text-[#5B8DEF] transition-colors flex items-center gap-1"
                    >
                      {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      Advanced Settings (Auth)
                    </button>
                    
                    {showAdvanced && (
                      <div className="grid grid-cols-2 gap-3 mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div>
                          <label className={labelStyle}>Username</label>
                          <input type="text" placeholder="Optional" className={inputStyle} />
                        </div>
                        <div>
                          <label className={labelStyle}>Password</label>
                          <input type="password" placeholder="Optional" className={inputStyle} />
                        </div>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={handleConnect} 
                    className={`w-full py-3 mt-2 ${theme.btnPrimaryBase} ${theme.hoverLift} ${
                      connectionState === 'connected' 
                        ? `${theme.btnDangerColors} ${theme.btnDangerShadow}` 
                        : `${theme.btnPrimaryColors} ${theme.btnPrimaryShadow}`
                    }`}
                  >
                    {connectionState === 'connected' ? (
                      <><Zap size={16} className="fill-current"/> Disconnect</>
                    ) : (
                      <><Play size={16} className="fill-current"/> Connect</>
                    )}
                  </button>
                </div>
              )}
            </section>

            {/* 订阅区 */}
            <section>
              <button onClick={() => setIsSubOpen(!isSubOpen)} className="w-full flex items-center justify-between group py-2 mb-2">
                <div className="flex items-center gap-2 font-bold text-[13px] text-[#333D4F] dark:text-[#E6EDF3]">
                   Subscriptions
                </div>
                {isSubOpen ? <ChevronUp size={16} className="text-slate-600 group-hover:text-slate-800 dark:group-hover:text-slate-300 transition-colors"/> : <ChevronDown size={16} className="text-slate-600 group-hover:text-slate-800 dark:group-hover:text-slate-300 transition-colors"/>}
              </button>

              {isSubOpen && (
                <div className="space-y-2 pt-1 min-w-[240px]">
                  <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/50 dark:bg-[#1C2128]/50 border border-[#E1E4E8]/50 dark:border-[#30363D]/50 group transition-all hover:bg-white dark:hover:bg-[#1C2128]`}>
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#5B8DEF] shadow-[0_0_8px_rgba(91,141,239,0.5)]"></div>
                      <span className="text-[12px] text-[#333D4F] dark:text-[#E6EDF3] font-mono truncate">sensor/+/data</span>
                    </div>
                    <button className="text-[#8B98A9] hover:text-rose-400 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                  </div>
                  
                  <button className="w-full mt-3 py-2.5 border-2 border-dashed border-[#5B8DEF]/30 dark:border-[#93B6F8]/30 rounded-xl text-[12px] font-bold text-[#457CE0] dark:text-[#93B6F8] hover:bg-[#5B8DEF]/10 dark:hover:bg-[#93B6F8]/10 transition-colors flex items-center justify-center gap-2">
                    <Plus size={15} strokeWidth={2.5} /> New Topic
                  </button>
                </div>
              )}
            </section>
          </div>
        </aside>

        {/* --- 主面板 --- */}
        <main className="flex-1 flex flex-col min-w-0 relative transition-all duration-300">
          
          {/* 顶部栏 */}
          <header className={`h-16 px-6 md:px-8 flex items-center justify-between shrink-0 z-10 border-b border-gray-200/50 dark:border-white/5`}>
            <div className="flex items-center gap-4 h-full">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`p-2 rounded-xl text-slate-600 hover:text-[#5B8DEF] hover:bg-[#5B8DEF]/10 dark:hover:text-[#93B6F8] dark:hover:bg-[#93B6F8]/10 transition-all ${!isSidebarOpen && 'rotate-180'}`}
                title="Toggle Sidebar"
              >
                <Layout size={18} />
              </button>
              
              <h2 className="font-bold text-[17px] text-[#333D4F] dark:text-white tracking-wide hidden sm:block">Messages</h2>
              
              <div className="flex items-center bg-gray-100 dark:bg-zinc-800/50 rounded-lg p-0.5 ml-2">
                {['all', 'in', 'out'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1.5 rounded-md text-[12px] font-bold uppercase tracking-wider transition-all duration-300 ${
                      filterType === type
                        ? 'bg-white dark:bg-zinc-700 text-[#5B8DEF] dark:text-[#93B6F8] shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 group-focus-within:text-[#5B8DEF] transition-colors" />
                <input type="text" placeholder="Filter logs..." className={`w-48 lg:w-64 pl-10 pr-4 py-2 ${theme.inputBg} ${theme.focusRing} border border-transparent rounded-full text-[13px] outline-none shadow-sm dark:shadow-none transition-all duration-300`} />
              </div>
              <button className={iconBtnStyle} title="Clear"><Trash2 size={16} /></button>
            </div>
          </header>

          {/* 消息流区域：精确采用 JetBrains Mono，12px 字体与 leading-relaxed 行高 */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-8 pb-[210px] pt-4 space-y-3 font-mono">
            {filteredMessages.map((msg) => (
              <div key={msg.id} className="group flex flex-col gap-1.5 py-2.5 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors rounded-lg px-2 -mx-2">
                
                {/* 消息头：时间 -> IN/OUT -> Topic (参考图经典的左向右排版) */}
                <div className="flex items-center gap-3 text-[11px] w-full">
                  <span className="text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                    {msg.timestamp}
                  </span>
                  <span className={`shrink-0 font-bold tracking-wide ${
                    msg.type === 'in' 
                      ? 'text-emerald-700 dark:text-[#34D399]' 
                      : 'text-blue-600 dark:text-[#60A5FA]' 
                  }`}>
                    {msg.type.toUpperCase()}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 truncate font-medium" title={msg.topic}>
                    {msg.topic}
                  </span>
                </div>

                {/* 消息体：使用自定义字体和高亮色值 */}
                <div className="relative pl-0 mt-0.5">
                  <pre className="text-[12px] leading-relaxed font-['JetBrains_Mono',Cascadia_Code,Consolas,ui-monospace,monospace] overflow-x-auto whitespace-pre-wrap">
                    {formatJSON(msg.payload)}
                  </pre>
                  <button className="absolute top-0 right-0 p-1.5 rounded-md bg-white dark:bg-[#27272A] border border-gray-200 dark:border-white/10 text-gray-400 opacity-0 group-hover:opacity-100 transition-all hover:text-gray-700 dark:hover:text-white shadow-sm" title="Copy">
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 底部悬浮发布控制台 */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-4xl z-20">
            <div className={`p-4 ${theme.floatingPanel} flex flex-col gap-3 transition-transform duration-300 hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-black/60`}>
              
              {/* 控制行 */}
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Hash size={14} className="text-slate-500 dark:text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Topic (e.g. device/control)"
                    defaultValue="device/control/air_conditioner"
                    className={`w-full pl-9 pr-4 py-2 text-[13px] font-mono ${theme.inputBg} border border-transparent rounded-xl outline-none ${theme.focusRing}`}
                  />
                </div>

                <div className={`flex items-center gap-4 px-4 py-2 rounded-xl ${theme.inputBg} border border-transparent`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">QoS</span>
                    <select
                      className="bg-transparent text-[13px] font-mono outline-none text-[#333D4F] dark:text-[#E6EDF3] cursor-pointer"
                      value={qos}
                      onChange={(e) => setQos(e.target.value)}
                    >
                      <option value="0">0</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                    </select>
                  </div>
                  <div className="w-px h-4 bg-[#D1D5DB] dark:bg-[#4B5563]"></div>
                  
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={retain}
                        onChange={() => setRetain(!retain)}
                      />
                      <div className={`block w-8 h-4.5 rounded-full transition-colors duration-300 ${retain ? 'bg-[#5B8DEF] dark:bg-[#77A3F6]' : 'bg-gray-300 dark:bg-zinc-700'}`}></div>
                      <div className={`dot absolute left-0.5 top-0.5 bg-white w-3.5 h-3.5 rounded-full transition-transform duration-300 shadow-sm ${retain ? 'transform translate-x-3.5' : ''}`}></div>
                    </div>
                    <span className="text-[12px] font-bold text-gray-500 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">Retain</span>
                  </label>
                </div>
              </div>

              {/* 快捷指令行 */}
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-0.5">
                <div className="flex items-center gap-1.5 pr-2 text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700/50 shrink-0">
                  <Star size={13} className="text-[#F59E0B] dark:text-[#FBBF24]" />
                  <span className="text-[12px] font-bold">Quick Cmds</span>
                </div>
                {['Status', 'Bind', 'Unbind', 'OTA', 'Calibrate'].map((cmd, idx) => (
                  <button key={idx} className="shrink-0 px-2.5 py-1 rounded-md bg-white dark:bg-zinc-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-bold shadow-sm border border-slate-200/80 dark:border-slate-700/80 hover:border-[#5B8DEF]/60 hover:text-[#5B8DEF] dark:hover:border-[#93B6F8]/60 dark:hover:text-[#93B6F8] transition-all">
                    {cmd}
                  </button>
                ))}
                <button className="shrink-0 px-2 py-1 rounded-md text-[#5B8DEF] hover:bg-[#5B8DEF]/10 dark:text-[#93B6F8] dark:hover:bg-[#93B6F8]/10 text-[11px] font-bold transition-colors flex items-center gap-1 border border-dashed border-[#5B8DEF]/40 dark:border-[#93B6F8]/40 ml-1">
                  <Plus size={12} strokeWidth={2.5}/> Add
                </button>
              </div>

              {/* Payload 输入与发送 */}
              <div className="flex gap-3 h-[90px]">
                <div className={`flex-1 relative rounded-xl ${theme.inputBg} border border-transparent focus-within:ring-2 focus-within:ring-[#5B8DEF]/30 dark:focus-within:ring-[#93B6F8]/30 focus-within:bg-white dark:focus-within:bg-zinc-900 transition-all overflow-hidden`}>
                  <textarea
                    ref={textareaRef}
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                    onKeyDown={handlePayloadKeyDown}
                    className="w-full h-full bg-transparent p-3 font-mono text-[13px] leading-relaxed text-[#333D4F] dark:text-[#E6EDF3] resize-none outline-none custom-scrollbar placeholder:text-[#8B98A9]"
                    placeholder="Enter payload here..."
                    spellCheck="false"
                  />
                  <div className="absolute bottom-2 right-2">
                     <button className={`p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-[#5B8DEF] hover:bg-white dark:hover:bg-zinc-800 transition-all shadow-sm`} title="Format JSON"><Command size={14}/></button>
                  </div>
                </div>

                <button className={`w-[110px] h-full ${theme.btnPrimaryBase} ${theme.btnPrimaryColors} ${theme.btnPrimaryShadow} ${theme.hoverLift} flex flex-col group`}>
                  <Send size={22} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                  <span className="text-[13px] mt-1 font-bold tracking-widest uppercase">Send</span>
                </button>
              </div>

            </div>
          </div>
          
        </main>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @font-face {
          font-family: 'JetBrains Mono';
          src: url('/public/fonts/jetbrains-mono-latin-var.woff2') format('woff2');
          font-weight: 100 900;
          font-style: normal;
          font-display: swap;
        }
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; margin-block: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.3);
          border-radius: 20px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(113, 113, 122, 0.3); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(91, 141, 239, 0.5); }
      `}} />
    </div>
  );
};

export default App;