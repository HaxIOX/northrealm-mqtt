export function downloadJsonFile(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function safeJsonValue(v) {
  try {
    JSON.stringify(v);
    return v;
  } catch {
    return String(v);
  }
}

export function buildMessageLogsExportPayload(scope, exportLogs, logTopicFilters, logFilter) {
  const safeLogs = (exportLogs || []).map((l) => ({
    id: l?.id ?? null,
    timestamp: l?.timestamp ?? '',
    type: l?.type ?? '',
    topic: l?.topic ?? '',
    payload: safeJsonValue(l?.payload),
    details: safeJsonValue(l?.details),
  }));

  return {
    schema: 'mqtt-pro-message-logs',
    v: 1,
    scope,
    exportedAt: new Date().toISOString(),
    appVersion: (typeof window !== 'undefined' && window.__MQTT_PRO_APP_VERSION__) ? window.__MQTT_PRO_APP_VERSION__ : 'unknown',
    filters: {
      topicFilters: logTopicFilters || [],
      text: logFilter || '',
    },
    count: safeLogs.length,
    data: safeLogs,
  };
}

export function buildBackupPayload(savedConfigs, quickActions, subscriptions, multicastTargets, includePasswords) {
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
      multicastTargets: multicastTargets || [],
    },
  };
}

export function parseBackup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.schema === 'mqtt-pro-backup' && raw.v === 1 && raw.data && typeof raw.data === 'object') return raw.data;
  if (raw.configs || raw.actions || raw.subscriptions || raw.multicastTargets) {
    return {
      configs: raw.configs,
      actions: raw.actions,
      subscriptions: raw.subscriptions,
      multicastTargets: raw.multicastTargets,
    };
  }
  return null;
}

export function mergeConfigsByName(existing, incoming) {
  const byName = new Map((existing || []).map((c) => [String(c?.name || ''), c]));
  for (const cfg of incoming || []) {
    const name = String(cfg?.name || '').trim();
    if (!name) continue;
    byName.set(name, cfg);
  }
  return Array.from(byName.values());
}

export function mergeActionsById(existing, incoming) {
  const keyOf = (a) => (a && a.id != null ? `id:${String(a.id)}` : `hash:${String(a?.name || '')}|${String(a?.topic || '')}|${String(a?.payload || '')}`);
  const byKey = new Map((existing || []).map((a) => [keyOf(a), a]));
  for (const a of incoming || []) byKey.set(keyOf(a), a);
  return Array.from(byKey.values());
}

export function mergeSubscriptionsUnique(existing, incoming) {
  const set = new Set([...(existing || []), ...(incoming || [])].map((s) => String(s).trim()).filter(Boolean));
  return Array.from(set);
}

export function mergeMulticastTargetsByTopic(existing, incoming) {
  const norm = (t) => String(t || '').trim();
  const topicOf = (x) => norm(x?.topic);
  const byTopic = new Map((existing || []).map((t) => [topicOf(t), t]).filter(([k]) => k));

  for (const t of incoming || []) {
    const topic = topicOf(t);
    if (!topic) continue;
    const prev = byTopic.get(topic);
    byTopic.set(topic, {
      id: prev?.id ?? t?.id ?? Date.now() + Math.floor(Math.random() * 1000),
      name: String(t?.name || prev?.name || topic),
      topic,
    });
  }

  return Array.from(byTopic.values());
}
