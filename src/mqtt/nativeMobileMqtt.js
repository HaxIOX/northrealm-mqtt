import { registerPlugin } from '@capacitor/core';

function normalizeError(error) {
  if (!error) return new Error('Unknown error');
  if (error instanceof Error) return error;
  const message = typeof error === 'string'
    ? error
    : error.message || error.error || JSON.stringify(error);
  return new Error(String(message));
}

function normalizeTopics(rawTopics) {
  if (Array.isArray(rawTopics)) return rawTopics.map((topic) => String(topic || '').trim()).filter(Boolean);
  if (rawTopics && typeof rawTopics === 'object') return Object.keys(rawTopics).map((topic) => topic.trim()).filter(Boolean);
  const topic = String(rawTopics || '').trim();
  return topic ? [topic] : [];
}

class NativeMobileMqttClient {
  constructor(nativePlugin, url, options = {}) {
    this.nativePlugin = nativePlugin;
    this.url = String(url || '');
    this.options = options || {};
    this.handlers = new Map();
    this.listenerHandles = [];
    this.connected = false;
    this.reconnecting = false;
    this.disconnecting = false;
  }

  on(eventName, handler) {
    const event = String(eventName || '');
    if (!event || typeof handler !== 'function') return this;
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(handler);
    return this;
  }

  removeListener(eventName, handler) {
    this.handlers.get(String(eventName || ''))?.delete(handler);
    return this;
  }

  emit(eventName, ...args) {
    for (const handler of this.handlers.get(eventName) || []) {
      try { handler(...args); } catch { /* isolate consumer handlers */ }
    }
  }

  async attachNativeListeners() {
    const addListener = async (eventName, handler) => {
      const handle = await this.nativePlugin.addListener(eventName, handler);
      this.listenerHandles.push(handle);
    };

    await addListener('connect', (event) => {
      this.connected = true;
      this.reconnecting = false;
      this.emit('connect', {
        sessionPresent: !!event?.sessionPresent,
        returnCode: 0,
        reconnect: !!event?.reconnect,
      });
    });
    await addListener('reconnect', () => {
      this.reconnecting = true;
      this.emit('reconnect');
    });
    await addListener('offline', () => {
      this.connected = false;
      this.emit('offline');
    });
    await addListener('close', () => {
      this.connected = false;
      this.reconnecting = false;
      this.emit('close');
    });
    await addListener('error', (event) => {
      const error = new Error(String(event?.message || event?.error || 'Native MQTT error'));
      if (event?.code != null) error.code = event.code;
      if (event?.reasonCode != null) error.reasonCode = event.reasonCode;
      if (event?.details != null) error.details = String(event.details);
      if (event?.exception != null) error.exception = String(event.exception);
      this.emit('error', error);
    });
    await addListener('message', (event) => {
      const topic = String(event?.topic || '');
      const payload = event?.payload != null ? String(event.payload) : '';
      const message = { toString: () => payload };
      if (event?.payloadBase64) message.payloadBase64 = String(event.payloadBase64);
      this.emit('message', topic, message, {
        qos: Number.isFinite(event?.qos) ? Number(event.qos) : 0,
        retain: !!event?.retain,
        dup: !!event?.dup,
      });
    });
  }

  async connect() {
    await this.cleanupListeners();
    await this.attachNativeListeners();
    const reconnectPeriod = Number(this.options.reconnectPeriod ?? 0);
    const connectTimeout = Number(this.options.connectTimeout ?? 10000);
    const keepalive = Number(this.options.keepalive ?? 60);

    await this.nativePlugin.connect({
      url: this.url,
      clientId: String(this.options.clientId || ''),
      username: String(this.options.username || ''),
      password: String(this.options.password || ''),
      clean: this.options.clean !== false,
      keepalive,
      connectTimeoutMs: Number.isFinite(connectTimeout) ? connectTimeout : 10000,
      reconnectPeriodMs: Number.isFinite(reconnectPeriod) ? reconnectPeriod : 0,
    });
    return this;
  }

  subscribe(rawTopics, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    const topics = normalizeTopics(rawTopics);
    const qos = Number.isFinite(options?.qos) ? Number(options.qos) : 0;
    Promise.all(topics.map((topic) => this.nativePlugin.subscribe({ topic, qos })))
      .then(() => callback?.(null))
      .catch((error) => callback?.(normalizeError(error)));
    return this;
  }

  unsubscribe(rawTopics, callback) {
    const topics = normalizeTopics(rawTopics);
    Promise.all(topics.map((topic) => this.nativePlugin.unsubscribe({ topic })))
      .then(() => callback?.(null))
      .catch((error) => callback?.(normalizeError(error)));
    return this;
  }

  publish(topic, payload, options = {}, callback) {
    this.nativePlugin.publish({
      topic: String(topic || '').trim(),
      payload: payload != null ? String(payload) : '',
      qos: Number.isFinite(options?.qos) ? Number(options.qos) : 0,
      retain: !!options?.retain,
    }).then(() => callback?.(null)).catch((error) => callback?.(normalizeError(error)));
    return this;
  }

  end(force = true, callback) {
    this.disconnecting = true;
    this.nativePlugin.end({ force: !!force }).catch(() => {}).finally(async () => {
      this.connected = false;
      this.reconnecting = false;
      await this.cleanupListeners();
      callback?.();
    });
    return this;
  }

  async cleanupListeners() {
    for (const handle of this.listenerHandles) {
      try { await handle.remove(); } catch { /* listener is already gone */ }
    }
    this.listenerHandles = [];
  }
}

export function createMobileMqttLib(nativePlugin = registerPlugin('NativeMqtt')) {
  return {
    VERSION: 'native-mobile',
    connect(url, options) {
      const client = new NativeMobileMqttClient(nativePlugin, url, options);
      client.connect().catch((error) => client.emit('error', normalizeError(error)));
      return client;
    },
  };
}
