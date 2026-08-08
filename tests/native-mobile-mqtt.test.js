import test from 'node:test';
import assert from 'node:assert/strict';
import { createMobileMqttLib } from '../src/mqtt/nativeMobileMqtt.js';
import { detectRuntime, isTcpCapable } from '../src/mqtt/runtime.js';

function createNativePlugin() {
  const listeners = new Map();
  const calls = { connect: [], subscribe: [], unsubscribe: [], publish: [], end: [] };
  return {
    calls,
    listeners,
    async addListener(eventName, handler) {
      listeners.set(eventName, handler);
      return { remove: async () => listeners.delete(eventName) };
    },
    async connect(options) {
      calls.connect.push(options);
      queueMicrotask(() => listeners.get('connect')?.({ sessionPresent: false }));
    },
    async subscribe(options) { calls.subscribe.push(options); },
    async unsubscribe(options) { calls.unsubscribe.push(options); },
    async publish(options) { calls.publish.push(options); },
    async end(options) { calls.end.push(options); },
  };
}

test('native mobile runtime exposes MQTT TCP capability', () => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    Capacitor: { isNativePlatform: () => true },
    mqtt: { connect() {} },
    __MQTT_PRO_MQTT_SOURCE__: 'native-mobile',
  };

  try {
    assert.equal(detectRuntime().isNativeMobile, true);
    assert.equal(isTcpCapable(), true);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('web runtime does not expose MQTT TCP capability', () => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    mqtt: { connect() {} },
    __MQTT_PRO_MQTT_SOURCE__: 'bundled',
  };

  try {
    assert.equal(detectRuntime().isNativeMobile, false);
    assert.equal(isTcpCapable(), false);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('native mobile adapter connects and forwards connection events', async () => {
  const plugin = createNativePlugin();
  const mqtt = createMobileMqttLib(plugin);
  const client = mqtt.connect('mqtt://broker.example.com:1883', {
    clientId: 'mobile-client',
    clean: true,
    keepalive: 30,
    connectTimeout: 5000,
    reconnectPeriod: 3000,
  });

  const connack = await new Promise((resolve, reject) => {
    client.on('connect', resolve);
    client.on('error', reject);
  });

  assert.equal(connack.sessionPresent, false);
  assert.equal(client.connected, true);
  assert.deepEqual(plugin.calls.connect[0], {
    url: 'mqtt://broker.example.com:1883',
    clientId: 'mobile-client',
    username: '',
    password: '',
    clean: true,
    keepalive: 30,
    connectTimeoutMs: 5000,
    reconnectPeriodMs: 3000,
  });
});

test('native mobile adapter batches subscriptions into one callback', async () => {
  const plugin = createNativePlugin();
  const client = createMobileMqttLib(plugin).connect('mqtt://broker.example.com:1883', {});
  await new Promise((resolve) => client.on('connect', resolve));

  await new Promise((resolve, reject) => {
    client.subscribe(['devices/one', 'devices/two', 'devices/one'], { qos: 1 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  assert.deepEqual(plugin.calls.subscribe, [
    { topic: 'devices/one', qos: 1 },
    { topic: 'devices/two', qos: 1 },
    { topic: 'devices/one', qos: 1 },
  ]);
});

test('native mobile adapter releases native listeners on end', async () => {
  const plugin = createNativePlugin();
  const client = createMobileMqttLib(plugin).connect('mqtt://broker.example.com:1883', {});
  await new Promise((resolve) => client.on('connect', resolve));

  await new Promise((resolve) => client.end(true, resolve));

  assert.equal(client.connected, false);
  assert.equal(plugin.listeners.size, 0);
  assert.deepEqual(plugin.calls.end, [{ force: true }]);
});
