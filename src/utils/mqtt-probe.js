function normalizeWebSocketPath(protocol, rawPath) {
  if (protocol !== 'ws' && protocol !== 'wss') return '';
  const path = String(rawPath || '').trim();
  if (!path) return '';
  return path.startsWith('/') ? path : `/${path}`;
}

export function createMqttProbeTarget({
  advancedConfig,
  connection,
  tcpCapable,
  probeClientId,
  timeoutMs,
}) {
  const protocol = String(connection.protocol || '');
  const host = String(connection.host || '').trim();
  const port = Number(connection.port);

  if (!host) throw new Error('Host 不能为空');
  if (host.includes('://') || host.includes('/') || host.includes('?') || host.includes('#')) {
    throw new Error('Host 只允许填写域名或 IP');
  }
  if (host.includes(':') && !host.startsWith('[')) throw new Error('Host 中不要包含端口');
  if (!Number.isFinite(port) || port < 1 || port > 65535) throw new Error('端口必须在 1 到 65535 之间');
  if (!['ws', 'wss', 'mqtt', 'mqtts'].includes(protocol)) throw new Error('不支持当前连接协议');
  if ((protocol === 'mqtt' || protocol === 'mqtts') && !tcpCapable) {
    throw new Error('当前环境未启用 MQTT TCP/TLS');
  }
  if ((protocol === 'ws' || protocol === 'wss') && (port === 1883 || port === 8883)) {
    throw new Error('WebSocket 不能使用 MQTT TCP/TLS 端口');
  }

  const protocolVersion = [3, 4, 5].includes(Number(advancedConfig.protocolVersion))
    ? Number(advancedConfig.protocolVersion)
    : 4;
  const keepalive = Number(advancedConfig.keepalive);
  const path = normalizeWebSocketPath(protocol, connection.path);

  return {
    url: `${protocol}://${host}:${port}${path}`,
    options: {
      clientId: probeClientId,
      username: connection.username,
      password: connection.password,
      clean: true,
      keepalive: Number.isFinite(keepalive) && keepalive >= 0 ? keepalive : 60,
      connectTimeout: timeoutMs,
      reconnectPeriod: 0,
      resubscribe: false,
      protocolId: protocolVersion === 3 ? 'MQIsdp' : 'MQTT',
      protocolVersion,
      timerVariant: 'worker',
    },
  };
}

export function simplifyProbeError(error) {
  const message = String(error?.message || error || '连接失败').trim();
  return message.length > 120 ? `${message.slice(0, 117)}...` : message;
}

export function runMqttConnectionProbe({
  advancedConfig,
  connection,
  isDesktopShell,
  mqtt,
  now = Date.now,
  signal,
  tcpCapable,
  timeoutMs = 10000,
}) {
  const startedAt = now();
  let client = null;
  let timeoutId = null;
  let settled = false;

  return new Promise((resolve) => {
    const cleanupClient = () => {
      if (!client) return;
      if (typeof client.removeListener === 'function') {
        client.removeListener('connect', handleConnect);
        client.removeListener('error', handleError);
        client.removeListener('close', handleClose);
      }
      try {
        client.end(true);
      } catch {
        // A failed temporary transport is already terminal.
      }
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      signal?.removeEventListener('abort', handleAbort);
      cleanupClient();
      resolve({ ...result, durationMs: Math.max(0, now() - startedAt) });
    };

    function handleConnect(connack) {
      const returnCode = connack?.reasonCode ?? connack?.returnCode ?? 0;
      if (returnCode !== 0) {
        finish({ ok: false, error: `Broker 拒绝连接（CONNACK ${returnCode}）` });
        return;
      }
      finish({
        ok: true,
        sessionPresent: connack?.sessionPresent === true,
        returnCode,
      });
    }

    function handleError(error) {
      finish({ ok: false, error: simplifyProbeError(error) });
    }

    function handleClose() {
      finish({ ok: false, error: '连接在完成握手前已关闭' });
    }

    function handleAbort() {
      finish({ ok: false, error: '测试已取消' });
    }

    try {
      if (!mqtt || typeof mqtt.connect !== 'function') throw new Error('MQTT SDK 尚未就绪');
      if (signal?.aborted) return handleAbort();

      const target = createMqttProbeTarget({
        advancedConfig,
        connection,
        isDesktopShell,
        tcpCapable,
        probeClientId: `probe_${Math.random().toString(16).slice(2, 14)}`,
        timeoutMs,
      });
      client = mqtt.connect(target.url, target.options);
      client.on('connect', handleConnect);
      client.on('error', handleError);
      client.on('close', handleClose);
      signal?.addEventListener('abort', handleAbort, { once: true });
      timeoutId = setTimeout(() => finish({ ok: false, error: `连接超时（${timeoutMs} ms）` }), timeoutMs);
    } catch (error) {
      finish({ ok: false, error: simplifyProbeError(error) });
    }
  });
}
