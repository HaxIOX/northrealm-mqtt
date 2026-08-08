import { useCallback, useEffect, useRef, useState } from 'react';
import { PROTOCOL_PORT_MAP } from '../utils/constants.js';
import { detectRuntime, isTcpCapable } from '../mqtt/runtime.js';
import { diagnoseConnectionError } from '../utils/mqtt-helpers.js';
import { shouldRecoverOnForeground } from '../utils/mqtt-lifecycle.js';
import { useMqttSdkLoader } from './useMqttSdkLoader.js';

export function useMqttConnectionState({
  addLog,
  autoReconnect,
  autoResubscribe,
  debugPacketLogRef,
  isDevMode,
  lastSubscriptionsRef,
  manualDisconnectRef,
  onMessage,
  showRetainedRef,
  shouldDropDuplicateInbound,
}) {
  const runtime = detectRuntime();
  const isElectronRuntime = runtime.isElectronUserAgent;
  const isDesktopShell = runtime.isDesktopShell;
  const isNativeApp = isDesktopShell || runtime.isNativeMobile;
  const getTcpCapable = () => isTcpCapable();

  const [client, setClient] = useState(null);
  const [connectStatus, setConnectStatus] = useState('disconnected');
  const [sdkReady, setSdkReady] = useState(false);
  const [connectDuration, setConnectDuration] = useState(0);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [isRecovering, setIsRecovering] = useState(false);
  const [lastConnectionError, setLastConnectionError] = useState('');
  const [lastDisconnectedAt, setLastDisconnectedAt] = useState(null);
  const [manuallyStopped, setManuallyStopped] = useState(false);

  const reconnectCountRef = useRef(0);
  useEffect(() => {
    reconnectCountRef.current = reconnectCount;
  }, [reconnectCount]);

  const clientRef = useRef(null);
  useEffect(() => {
    clientRef.current = client;
  }, [client]);

  const connectStatusRef = useRef(connectStatus);
  useEffect(() => {
    connectStatusRef.current = connectStatus;
  }, [connectStatus]);

  const everConnectedRef = useRef(null);
  const connectionIntentRef = useRef(false);
  const recoveryInFlightRef = useRef(false);
  const setRecoveryInFlight = useCallback((value) => {
    recoveryInFlightRef.current = value;
    setIsRecovering(value);
  }, []);
  const handleConnectRef = useRef(null);

  const [connection, setConnection] = useState(() => {
    const defaultProtocol = (typeof window !== 'undefined' && getTcpCapable()) ? 'mqtt' : 'wss';
    const defaultPort = PROTOCOL_PORT_MAP[defaultProtocol]?.port ?? 8084;
    return {
      name: '默认 EMQX 公共服',
      protocol: defaultProtocol,
      host: 'broker.emqx.io',
      port: defaultPort,
      path: '/mqtt',
      clientId: `mqtt_debugger_${Math.random().toString(16).substr(2, 8)}`,
      username: '',
      password: '',
    };
  });

  const [advancedConfig, setAdvancedConfig] = useState({
    keepalive: 60,
    clean: true,
    willEnabled: false,
    willTopic: 'last/will',
    willPayload: 'offline',
    willQos: 0,
    willRetain: false,
    protocolVersion: 4,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [configCollapsed, setConfigCollapsed] = useState(false);
  const [selectedPresetBroker, setSelectedPresetBroker] = useState('');

  useMqttSdkLoader({ isDesktopShell, setSdkReady });

  const updateConnection = (updater) => {
    setConnection((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!isNativeApp) return next;

      const port = Number(next?.port);
      if (!Number.isFinite(port)) return next;
      if ((next.protocol === 'ws' || next.protocol === 'wss') && port === 1883) {
        return { ...next, protocol: 'mqtt' };
      }
      if ((next.protocol === 'ws' || next.protocol === 'wss') && port === 8883) {
        return { ...next, protocol: 'mqtts' };
      }
      return next;
    });
  };

  const handleProtocolChange = (newProtocol) => {
    const portInfo = PROTOCOL_PORT_MAP[newProtocol];
    updateConnection((prev) => ({ ...prev, protocol: newProtocol, port: portInfo ? portInfo.port : prev.port }));
  };

  const handlePortChange = (rawPort) => {
    const port = Number(rawPort);
    if (!Number.isFinite(port)) return;
    if (isNativeApp && port === 1883 && (connection.protocol === 'ws' || connection.protocol === 'wss')) return handleProtocolChange('mqtt');
    if (isNativeApp && port === 8883 && (connection.protocol === 'ws' || connection.protocol === 'wss')) return handleProtocolChange('mqtts');
    updateConnection((prev) => ({ ...prev, port }));
  };

  const closeClient = () => {
    const currentClient = clientRef.current || client;
    if (!currentClient) return false;

    manualDisconnectRef.current = currentClient;
    currentClient.end(true);
    clientRef.current = null;
    setClient(null);
    setConnectStatus('disconnected');
    setConnectDuration(0);
    setReconnectCount(0);
    return true;
  };

  const handleConnect = () => {
    if (!sdkReady) return addLog('error', '', 'SDK 未加载');
    if (!isNativeApp && (connection.protocol === 'mqtt' || connection.protocol === 'mqtts')) {
      return addLog('error', '', '浏览器不支持 mqtt://（1883）直连，请使用 ws/wss 或使用桌面版');
    }

    const host = String(connection.host || '').trim();
    if (!host) return addLog('error', '', 'Host 不能为空（仅填写域名或 IP，不要带协议前缀）');
    if (host.includes('://') || host.includes('/') || host.includes('?') || host.includes('#')) {
      return addLog('error', '', 'Host 格式不正确：只填域名或 IP（不要包含协议/路径/参数），例如 broker.emqx.io');
    }
    if (host.includes(':') && !host.startsWith('[')) {
      return addLog('error', '', 'Host 请不要包含端口号（端口请填在 Port），IPv6 请使用方括号，例如 [::1]');
    }

    const port = Number(connection.port);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      return addLog('error', '', '端口号无效：请输入 1~65535 的数字');
    }

    let wsPath = String(connection.path || '').trim();
    if ((connection.protocol === 'ws' || connection.protocol === 'wss') && wsPath && !wsPath.startsWith('/')) {
      wsPath = `/${wsPath}`;
    }

    if (!isNativeApp && (connection.protocol === 'ws' || connection.protocol === 'wss') && (port === 1883 || port === 8883)) {
      return addLog('error', '', '你正在用 ws/wss 连接 1883/8883（这是 MQTT TCP/TLS 端口，不是 WebSocket 端口）。浏览器请改用 8083/8084 + /mqtt，或使用桌面版的 mqtt/mqtts。');
    }

    const tcpCapableNow = getTcpCapable();
    if ((connection.protocol === 'mqtt' || connection.protocol === 'mqtts') && !tcpCapableNow) {
      addLog('error', '', '桌面端未启用 MQTT TCP（preload 未生效），请使用安装包运行桌面版或检查 Electron preload 配置');
      return;
    }

    if (isNativeApp && (connection.protocol === 'ws' || connection.protocol === 'wss') && (port === 1883 || port === 8883)) {
      return addLog('error', '', '你正在用 ws/wss 连接 1883/8883（这是 MQTT TCP/TLS 端口，不是 WebSocket 端口），请切换协议为 mqtt/mqtts');
    }

    everConnectedRef.current = null;
    setConnectDuration(0);
    setReconnectCount(0);
    closeClient();
    setLastConnectionError('');
    setManuallyStopped(false);
    setConnectStatus('connecting');

    const pathPart = (connection.protocol === 'ws' || connection.protocol === 'wss') ? wsPath : '';
    const url = `${connection.protocol}://${host}:${port}${pathPart}`;
    addLog('system', '', `正在连接 ${url}...`);
    addLog('system', '', `环境检测: ${isDesktopShell ? '桌面客户端' : '浏览器'}`);
    addLog('system', '', `TCP支持: ${getTcpCapable() ? '是' : '否'}`);
    addLog('system', '', `MQTT模块: ${window.mqtt ? '已加载' : '未加载'}`);

    if (isDesktopShell) {
      addLog('system', '', `应用版本: ${window.__MQTT_PRO_APP_VERSION__ || 'unknown'}`);
      if (window.__MQTT_PRO_PRELOAD_DIR__) addLog('system', '', `Preload目录: ${window.__MQTT_PRO_PRELOAD_DIR__}`);
      if (window.__MQTT_PRO_CWD__) addLog('system', '', `CWD: ${window.__MQTT_PRO_CWD__}`);
      if (window.__MQTT_PRO_MQTT_RESOLVE_PATH__ !== undefined) addLog('system', '', `MQTT resolve: ${window.__MQTT_PRO_MQTT_RESOLVE_PATH__}`);
    }

    if (window.mqtt) {
      const source = window.__MQTT_PRO_MQTT_SOURCE__ || 'unknown';
      const isNative = source === 'native' || source === 'native-mobile';
      addLog('system', '', `MQTT来源: ${source === 'native' ? 'Node原生(支持TCP)' : source === 'bundled' ? '内置浏览器版(仅WebSocket)' : source === 'cdn' ? 'CDN浏览器版(仅WebSocket)' : '未知'}`);
      addLog('system', '', `MQTT版本: ${window.__MQTT_PRO_MQTT_VERSION__ || 'unknown'}`);
      if (!isNative && (connection.protocol === 'mqtt' || connection.protocol === 'mqtts')) {
        addLog('error', '', '⚠️  当前使用的MQTT库不支持 mqtt:// 协议');
        addLog('error', '', '请切换到 ws:// / wss://，或检查桌面端 preload 注入是否成功');
        setConnectStatus('disconnected');
        setReconnectCount(0);
        return;
      }
    }

    connectionIntentRef.current = true;
    addLog('system', '', `认证: 用户名=${connection.username || '无'}`);
    if (connection.protocol === 'wss') addLog('system', '', '使用 WSS 加密连接，如服务器无 SSL 请改用 ws://');
    else if (connection.protocol === 'mqtts') addLog('system', '', '使用 MQTT TLS 连接（mqtts://），如服务器无证书请改用 mqtt:// 或 ws://');

    try {
      let clientId = String(connection.clientId || '').trim();
      if (!clientId) {
        clientId = `mqtt_client_${Math.random().toString(16).slice(2, 10)}`;
        updateConnection((prev) => ({ ...prev, clientId }));
        addLog('system', '', `⚠️ ClientID 为空，已自动生成: ${clientId}`);
      }

      let keepalive = Number(advancedConfig.keepalive);
      if (!Number.isFinite(keepalive) || keepalive < 0) {
        keepalive = 60;
        addLog('system', '', '⚠️ keepalive 无效，已使用默认值 60');
      }

      let protocolVersion = Number(advancedConfig.protocolVersion);
      if (![3, 4, 5].includes(protocolVersion)) {
        protocolVersion = 4;
        addLog('system', '', '⚠️ MQTT 协议版本无效，已使用默认值 3.1.1（v4）');
      }

      const opts = {
        clientId,
        username: connection.username,
        password: connection.password,
        clean: advancedConfig.clean,
        keepalive,
        connectTimeout: 10000,
        reconnectPeriod: autoReconnect ? 3000 : 0,
        resubscribe: false,
        protocolId: protocolVersion === 3 ? 'MQIsdp' : 'MQTT',
        protocolVersion,
        timerVariant: 'worker',
      };

      if (advancedConfig.willEnabled) {
        opts.will = {
          topic: advancedConfig.willTopic,
          payload: advancedConfig.willPayload,
          qos: Number(advancedConfig.willQos),
          retain: advancedConfig.willRetain,
        };
      }

      addLog('system', '', `连接选项: timeout=${opts.connectTimeout}ms, reconnect=${opts.reconnectPeriod}ms, protocol=${opts.protocolId} v${opts.protocolVersion}`);

      const newClient = window.mqtt.connect(url, opts);
      clientRef.current = newClient;

      newClient.on('connect', (connack) => {
        if (clientRef.current !== newClient) return;
        setRecoveryInFlight(false);
        everConnectedRef.current = newClient;
        setConnectStatus('connected');
        setConnectDuration(0);
        setReconnectCount(0);
        setLastConnectionError('');
        setManuallyStopped(false);
        addLog('system', '', '✅ 连接成功');
        addLog('system', '', `CONNACK 响应: sessionPresent=${connack?.sessionPresent}, returnCode=${connack?.returnCode || 0}`);
        setConfigCollapsed(true);

        const needResubscribe = autoResubscribe && lastSubscriptionsRef.current.length > 0 && (advancedConfig.clean || connack?.sessionPresent !== true);
        if (!needResubscribe) return;

        const topicsToResubscribe = [...new Set(lastSubscriptionsRef.current)];
        addLog('system', '', `正在恢复 ${topicsToResubscribe.length} 个订阅...`);
        newClient.subscribe(topicsToResubscribe, (err) => {
          if (err) {
            addLog('error', '', `自动重订阅失败（${topicsToResubscribe.length} 个）`, err.message || String(err));
            return;
          }
          addLog('system', '', `自动重订阅成功：已恢复 ${topicsToResubscribe.length} 个订阅`);
        });
      });

      newClient.on('error', (err) => {
        if (clientRef.current !== newClient) return;
        setRecoveryInFlight(false);
        setConnectStatus('error');
        setLastConnectionError(String(err?.message || err || '连接失败'));
        const diagnosis = diagnoseConnectionError(err, connection);
        const errorDetails = {
          message: err.message,
          code: err.code,
          errno: err.errno,
          syscall: err.syscall,
          address: err.address,
          port: err.port,
          stack: err.stack?.split('\n').slice(0, 3).join('\n'),
        };
        const filteredDetails = Object.fromEntries(Object.entries(errorDetails).filter(([, value]) => value != null));

        if (!isDevMode) {
          const shortDetails = [];
          if (filteredDetails.code) shortDetails.push(`code=${filteredDetails.code}`);
          if (filteredDetails.address) shortDetails.push(`address=${filteredDetails.address}`);
          if (filteredDetails.port) shortDetails.push(`port=${filteredDetails.port}`);
          if (filteredDetails.syscall) shortDetails.push(`syscall=${filteredDetails.syscall}`);

          const hintLines = [];
          if (connection.protocol === 'ws' || connection.protocol === 'wss') hintLines.push('检查 Broker 是否开启 WebSocket 端口（常见 8083/8084）以及 Path（常见 /mqtt）');
          if (isNativeApp && (connection.protocol === 'ws' || connection.protocol === 'wss') && (port === 1883 || port === 8883)) hintLines.push('当前端口是 MQTT TCP/TLS（1883/8883），请切换协议到 mqtt/mqtts');
          if (autoReconnect) hintLines.push('如端口未开会反复重试：可先关闭"自动重连"');

          const detailsText = [
            shortDetails.length ? `详情: ${shortDetails.join(', ')}` : '',
            diagnosis || '',
            hintLines.length ? `💡 建议: ${hintLines.join('；')}` : '',
          ].filter(Boolean).join('\n');

          addLog('error', '', `❌ 连接错误: ${err.message || err.toString()}`, detailsText);
          return;
        }

        addLog('error', '', `❌ 连接错误: ${err.message || err.toString()}`);
        if (Object.keys(filteredDetails).length > 1) addLog('system', '', `错误详情: ${JSON.stringify(filteredDetails, null, 2)}`);
        if (diagnosis) addLog('system', '', diagnosis);
      });

      newClient.on('close', () => {
        if (clientRef.current !== newClient) {
          if (manualDisconnectRef.current === newClient) manualDisconnectRef.current = null;
          return;
        }
        setRecoveryInFlight(false);
        setLastDisconnectedAt(Date.now());
        if (manualDisconnectRef.current === newClient) {
          manualDisconnectRef.current = null;
          if (everConnectedRef.current === newClient) everConnectedRef.current = null;
          setConnectStatus('disconnected');
          setConnectDuration(0);
          return;
        }

        const wasConnected = everConnectedRef.current === newClient;
        if (everConnectedRef.current === newClient) everConnectedRef.current = null;
        setConnectStatus('disconnected');
        setConnectDuration(0);

        if (wasConnected) {
          addLog('system', '', '⚠️ 连接已断开');
          return;
        }

        addLog('system', '', '⚠️ 连接关闭（未成功建立连接）');
        if (reconnectCountRef.current === 0) {
          addLog('error', '', '⚠️ TCP连接成功但MQTT握手失败，可能原因：');
          addLog('error', '', '  1. 用户名或密码错误（最常见）');
          addLog('error', '', '  2. ClientID 被拒绝或已被占用');
          addLog('error', '', '  3. 服务器配置不允许此连接');
          addLog('error', '', '  4. MQTT 协议版本不匹配');
        }
      });

      newClient.on('offline', () => {
        if (clientRef.current !== newClient) return;
        addLog('system', '', '📴 客户端离线 - 可能是网络问题或服务器无法访问');
        if (reconnectCountRef.current === 0) addLog('system', '', '💡 提示: 检查服务器地址、端口、网络连接');
      });

      newClient.on('reconnect', () => {
        if (clientRef.current !== newClient) return;
        setReconnectCount((prev) => {
          const nextCount = prev + 1;
          addLog('system', '', `🔄 正在尝试第 ${nextCount} 次重连...`);
          if (nextCount === 3) {
            addLog('error', '', '⚠️ 已重连3次失败，可能原因：');
            addLog('error', '', '  1. 服务器地址或端口错误');
            addLog('error', '', '  2. 服务器未运行或无法访问');
            addLog('error', '', '  3. 防火墙阻止连接');
            addLog('error', '', '  4. 用户名密码错误');
          }
          if (nextCount >= 10) addLog('error', '', `🛑 已重连 ${nextCount} 次，建议停止连接并检查配置`);
          if (nextCount >= 15) {
            addLog('error', '', '🛑 达到最大重连次数(15)，停止重连');
            newClient.end(true);
          }
          return nextCount;
        });
      });

      newClient.on('packetsend', (packet) => {
        if (debugPacketLogRef.current && reconnectCountRef.current === 0) addLog('system', '', `📤 发送数据包: ${packet.cmd}`);
      });
      newClient.on('packetreceive', (packet) => {
        if (debugPacketLogRef.current && reconnectCountRef.current === 0) addLog('system', '', `📥 接收数据包: ${packet.cmd}`);
      });
      newClient.on('message', (topic, message, packet) => {
        if (clientRef.current !== newClient) return;
        if (packet?.retain && !showRetainedRef.current) return;
        const payload = message != null ? message.toString() : '';
        if (shouldDropDuplicateInbound(topic, payload, packet)) return;
        onMessage(topic, payload, packet);
      });

      setClient(newClient);
    } catch (error) {
      setRecoveryInFlight(false);
      setConnectStatus('error');
      setLastConnectionError(String(error?.message || error || '连接失败'));
      const diagnosis = diagnoseConnectionError(error, connection);
      const message = String(error?.message || error || '连接失败');
      if (!isDevMode && diagnosis) addLog('error', '', message, diagnosis);
      else {
        addLog('error', '', message);
        if (diagnosis) addLog('system', '', diagnosis);
      }
    }
  };

  const handleDisconnect = () => {
    connectionIntentRef.current = false;
    setRecoveryInFlight(false);
    const disconnected = closeClient();
    if (!disconnected) return;
    setLastConnectionError('');
    setLastDisconnectedAt(Date.now());
    setManuallyStopped(true);
    addLog('system', '', connectStatusRef.current === 'connecting' ? '✅ 已取消连接' : '✅ 已断开连接（停止重连）');
  };

  useEffect(() => {
    handleConnectRef.current = handleConnect;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const currentClient = clientRef.current;
      if (!shouldRecoverOnForeground({
        autoReconnect,
        connectionIntent: connectionIntentRef.current,
        recoveryInFlight: recoveryInFlightRef.current,
        client: currentClient,
        connectStatus: connectStatusRef.current,
      })) return;

      setRecoveryInFlight(true);
      addLog('system', '', '应用回到前台，正在检查 MQTT 连接...');

      if (currentClient && typeof currentClient.reconnect === 'function' && !currentClient.disconnecting) {
        try {
          setConnectStatus('connecting');
          currentClient.reconnect();
          return;
        } catch {
          // Fall through to a fresh client when the stale transport cannot reconnect.
        }
      }

      if (handleConnectRef.current) {
        handleConnectRef.current();
      } else {
        setRecoveryInFlight(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [addLog, autoReconnect, setRecoveryInFlight]);

  useEffect(() => {
    if (connectStatus !== 'connected') return undefined;
    const timer = setInterval(() => setConnectDuration((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [connectStatus]);

  return {
    advancedConfig,
    client,
    configCollapsed,
    connectDuration,
    connectStatus,
    connection,
    getDesktopTcpCapable: getTcpCapable,
    handleConnect,
    handleDisconnect,
    handlePortChange,
    handleProtocolChange,
    isDesktopShell,
    isNativeApp,
    isElectronRuntime,
    isRecovering,
    lastConnectionError,
    lastDisconnectedAt,
    manuallyStopped,
    reconnectCount,
    runtime,
    sdkReady,
    selectedPresetBroker,
    setAdvancedConfig,
    setConfigCollapsed,
    setConnection: updateConnection,
    setSelectedPresetBroker,
    setShowAdvanced,
    showAdvanced,
  };
}
