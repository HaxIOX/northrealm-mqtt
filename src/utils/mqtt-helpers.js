export function topicMatchesFilter(filter, topic) {
  const f = String(filter || '').trim();
  const tpc = String(topic || '');
  if (!f) return false;
  if (f === '#') return true;

  const fLevels = f.split('/');
  const tLevels = tpc.split('/');

  let i = 0;
  for (; i < fLevels.length; i++) {
    const fl = fLevels[i];
    if (fl === '#') return i === fLevels.length - 1;
    if (i >= tLevels.length) return false;
    if (fl === '+') continue;
    if (fl !== tLevels[i]) return false;
  }
  return i === tLevels.length;
}

export function validateAndFixConfig(config, isDesktopShell) {
  if (!config || typeof config !== 'object') return config;

  const port = Number(config.port);
  const protocol = config.protocol;

  if (!protocol || !Number.isFinite(port)) return config;

  let fixed = { ...config };
  let needsFix = false;

  if ((protocol === 'ws' || protocol === 'wss') && (port === 1883 || port === 8883)) {
    needsFix = true;
    if (!isDesktopShell) {
      fixed.port = protocol === 'wss' ? 8084 : 8083;
    } else {
      fixed.protocol = port === 1883 ? 'mqtt' : 'mqtts';
    }
  }

  if ((protocol === 'mqtt' || protocol === 'mqtts') && (port === 8083 || port === 8084)) {
    needsFix = true;
    if (!isDesktopShell) {
      fixed.protocol = port === 8084 ? 'wss' : 'ws';
    } else {
      fixed.port = protocol === 'mqtts' ? 8883 : 1883;
    }
  }

  if (needsFix) {
    console.warn(`[Config] 已自动修正配置 "${config.name}": ${protocol}://${port} → ${fixed.protocol}://${fixed.port}`);
  }

  return fixed;
}

export function diagnoseConnectionError(err, connection) {
  const errorMsg = err.message || err.toString();
  const errorCode = err.code;
  let diagnosis = '';

  if (errorCode === 'ECONNREFUSED') {
    diagnosis = '💡 诊断: 连接被拒绝\n   - 服务器可能未运行\n   - 端口号可能错误\n   - 防火墙可能阻止了连接';
  } else if (errorCode === 'ETIMEDOUT' || errorCode === 'ESOCKETTIMEDOUT') {
    diagnosis = '💡 诊断: 连接超时\n   - 服务器地址可能不可达\n   - 网络问题或防火墙阻止\n   - 服务器响应太慢';
  } else if (errorCode === 'ENOTFOUND' || errorCode === 'EAI_AGAIN') {
    diagnosis = '💡 诊断: 域名解析失败\n   - 服务器地址拼写错误\n   - DNS 服务器问题\n   - 网络连接问题';
  } else if (errorCode === 'ECONNRESET') {
    diagnosis = '💡 诊断: 连接被重置\n   - 服务器主动断开了连接\n   - 可能是认证失败\n   - 可能是协议版本不匹配';
  } else if (errorMsg.includes('WebSocket')) {
    if (connection?.protocol === 'wss') {
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
}

export function extractTemplateVars(str) {
  const vars = [];
  const seen = new Set();
  const regex = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      vars.push(match[1]);
    }
  }
  return vars;
}

export function isTemplateAction(action) {
  const combined = (action?.topic || '') + (action?.payload || '');
  return /\{\{(\w+)\}\}/.test(combined);
}

export function resolveTemplate(str, vars) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] ?? '');
}

export function parseTopicList(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return [];

  const parts = s
    .split(/[,\n\r;]+/g)
    .map((x) => String(x).trim())
    .filter(Boolean);

  const seen = new Set();
  const out = [];
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}
