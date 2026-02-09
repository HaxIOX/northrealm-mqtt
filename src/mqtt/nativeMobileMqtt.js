import { registerPlugin } from '@capacitor/core';

// Mobile native MQTT bridge (Android first).
// Goal: provide a small mqtt.js-like surface so existing UI logic can stay unchanged (KISS/DRY).
const NativeMqtt = registerPlugin('NativeMqtt');

const toError = (e) => {
  if (!e) return new Error('Unknown error');
  if (e instanceof Error) return e;
  const msg = typeof e === 'string' ? e : (e.message || e.error || JSON.stringify(e));
  return new Error(String(msg));
};

class MobileMqttClient {
  constructor(url, opts = {}) {
    this._url = String(url || '');
    this._opts = opts || {};
    this._handlers = new Map(); // event -> Set<fn>
    this._listenerHandles = [];
    this.connected = false;
    this._closed = false;
  }

  on(event, cb) {
    const ev = String(event || '');
    if (!ev || typeof cb !== 'function') return this;
    if (!this._handlers.has(ev)) this._handlers.set(ev, new Set());
    this._handlers.get(ev).add(cb);
    return this;
  }

  _emit(event, ...args) {
    const set = this._handlers.get(event);
    if (!set) return;
    for (const fn of set) {
      try { fn(...args); } catch { /* ignore */ }
    }
  }

  async _attachNativeListeners() {
    const add = async (eventName, fn) => {
      const h = await NativeMqtt.addListener(eventName, fn);
      this._listenerHandles.push(h);
    };

    await add('connect', (ev) => {
      this.connected = true;
      // mqtt.js style connack object fields used by App: sessionPresent/returnCode (best-effort).
      const connack = { sessionPresent: !!ev?.sessionPresent, returnCode: 0, reconnect: !!ev?.reconnect };
      this._emit('connect', connack);
      if (ev?.reconnect) this._emit('reconnect');
    });

    await add('reconnect', () => {
      this._emit('reconnect');
    });

    await add('offline', () => {
      this.connected = false;
      this._emit('offline');
    });

    await add('close', () => {
      this.connected = false;
      this._emit('close');
    });

    await add('error', (ev) => {
      const err = new Error(String(ev?.message || ev?.error || 'Native MQTT error'));
      if (ev?.code) err.code = ev.code;
      this._emit('error', err);
    });

    await add('message', (ev) => {
      const topic = String(ev?.topic || '');
      const payloadStr = ev?.payload != null ? String(ev.payload) : '';
      // Keep compatibility with existing code: it calls m.toString().
      const m = { toString: () => payloadStr };
      const packet = {
        qos: Number.isFinite(ev?.qos) ? Number(ev.qos) : 0,
        retain: !!ev?.retain,
        dup: !!ev?.dup,
      };
      this._emit('message', topic, m, packet);
    });
  }

  async connect() {
    await this._attachNativeListeners();

    const o = this._opts || {};
    const reconnectPeriod = Number(o.reconnectPeriod ?? 0);
    const connectTimeout = Number(o.connectTimeout ?? 10_000);
    const keepalive = Number(o.keepalive ?? 60);
    const clean = o.clean !== false;

    await NativeMqtt.connect({
      url: this._url,
      clientId: String(o.clientId || ''),
      username: String(o.username || ''),
      password: String(o.password || ''),
      clean,
      keepalive,
      connectTimeoutMs: Number.isFinite(connectTimeout) ? connectTimeout : 10_000,
      reconnectPeriodMs: Number.isFinite(reconnectPeriod) ? reconnectPeriod : 0,
    });

    return this;
  }

  subscribe(topic, cb) {
    const t = String(topic || '').trim();
    const qos = 0;
    NativeMqtt.subscribe({ topic: t, qos })
      .then(() => { if (typeof cb === 'function') cb(null); })
      .catch((e) => { if (typeof cb === 'function') cb(toError(e)); });
    return this;
  }

  unsubscribe(topic, cb) {
    const t = String(topic || '').trim();
    NativeMqtt.unsubscribe({ topic: t })
      .then(() => { if (typeof cb === 'function') cb(null); })
      .catch((e) => { if (typeof cb === 'function') cb(toError(e)); });
    return this;
  }

  publish(topic, payload, options = {}, cb) {
    const t = String(topic || '').trim();
    const o = options || {};
    const qos = Number.isFinite(o.qos) ? Number(o.qos) : 0;
    const retain = !!o.retain;
    const p = payload != null ? String(payload) : '';
    NativeMqtt.publish({ topic: t, payload: p, qos, retain })
      .then(() => { if (typeof cb === 'function') cb(null); })
      .catch((e) => { if (typeof cb === 'function') cb(toError(e)); });
    return this;
  }

  end(force = true, cb) {
    const f = !!force;
    NativeMqtt.end({ force: f })
      .then(async () => {
        this.connected = false;
        await this._cleanupListeners();
        if (typeof cb === 'function') cb();
      })
      .catch(async () => {
        this.connected = false;
        await this._cleanupListeners();
        if (typeof cb === 'function') cb();
      });
    return this;
  }

  async _cleanupListeners() {
    if (this._closed) return;
    this._closed = true;
    for (const h of this._listenerHandles) {
      try { await h.remove(); } catch { /* ignore */ }
    }
    this._listenerHandles = [];
  }
}

export function createMobileMqttLib() {
  return {
    VERSION: 'native-mobile',
    connect: (url, opts) => {
      const c = new MobileMqttClient(url, opts);
      // Fire-and-forget: App listens for 'connect'/'error' events.
      c.connect().catch((e) => {
        c._emit('error', toError(e));
      });
      return c;
    },
  };
}

