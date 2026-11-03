import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { getConnectionPresentation } from '../src/utils/mqtt-connection-presentation.js';
import {
  appendBoundedMqttLog,
  EVENT_LOG_LIMIT,
  isMessageLog,
  MESSAGE_LOG_LIMIT,
} from '../src/utils/mqtt-log-limits.js';
import { createMqttProbeTarget, runMqttConnectionProbe } from '../src/utils/mqtt-probe.js';

const basePresentation = {
  connectStatus: 'disconnected',
  isRecovering: false,
  lastConnectionError: '',
  manuallyStopped: false,
  reconnectCount: 0,
};

test('maps every connection phase to one user-visible state', () => {
  const cases = [
    [{ connectStatus: 'connected' }, 'connected'],
    [{ connectStatus: 'connecting' }, 'connecting'],
    [{ connectStatus: 'connecting', isRecovering: true }, 'recovering'],
    [{ reconnectCount: 2 }, 'reconnecting'],
    [{}, 'disconnected'],
    [{ manuallyStopped: true }, 'manual-stop'],
    [{ connectStatus: 'error', lastConnectionError: 'denied' }, 'error'],
  ];

  for (const [input, expected] of cases) {
    assert.equal(getConnectionPresentation({ ...basePresentation, ...input }).key, expected);
  }
});

test('keeps the newest message and event logs under independent limits', () => {
  let logs = [];
  for (let index = 0; index < MESSAGE_LOG_LIMIT + 5; index += 1) {
    logs = appendBoundedMqttLog(logs, { id: `message-${index}`, type: 'received', topic: 'test' }, true);
  }
  for (let index = 0; index < EVENT_LOG_LIMIT + 5; index += 1) {
    logs = appendBoundedMqttLog(logs, { id: `event-${index}`, type: 'system', topic: '' }, true);
  }

  const messages = logs.filter((log) => isMessageLog(log, true));
  const events = logs.filter((log) => !isMessageLog(log, true));
  assert.equal(messages.length, MESSAGE_LOG_LIMIT);
  assert.equal(events.length, EVENT_LOG_LIMIT);
  assert.equal(messages[0].id, 'message-5');
  assert.equal(messages.at(-1).id, `message-${MESSAGE_LOG_LIMIT + 4}`);
  assert.equal(events[0].id, 'event-5');
  assert.equal(events.at(-1).id, `event-${EVENT_LOG_LIMIT + 4}`);
});

test('classifies topicless errors consistently with the existing dev-mode behavior', () => {
  const log = { type: 'error', topic: '' };
  assert.equal(isMessageLog(log, true), false);
  assert.equal(isMessageLog(log, false), true);
});

class FakeProbeClient extends EventEmitter {
  endCalls = 0;

  end(force) {
    assert.equal(force, true);
    this.endCalls += 1;
  }
}

const probeConfig = {
  advancedConfig: {
    clean: true,
    keepalive: 60,
    protocolVersion: 4,
  },
  connection: {
    protocol: 'wss',
    host: 'broker.example.com',
    port: 8084,
    path: '/mqtt',
    username: 'user',
    password: 'secret',
  },
  isDesktopShell: false,
  tcpCapable: false,
};

test('closes and detaches the temporary client after a successful probe', async () => {
  const client = new FakeProbeClient();
  let capturedTarget;
  const resultPromise = runMqttConnectionProbe({
    ...probeConfig,
    mqtt: {
      connect(url, options) {
        capturedTarget = { url, options };
        queueMicrotask(() => client.emit('connect', { sessionPresent: true, reasonCode: 0 }));
        return client;
      },
    },
  });

  const result = await resultPromise;
  assert.equal(result.ok, true);
  assert.equal(result.sessionPresent, true);
  assert.equal(capturedTarget.url, 'wss://broker.example.com:8084/mqtt');
  assert.equal(capturedTarget.options.reconnectPeriod, 0);
  assert.equal(capturedTarget.options.clean, true);
  assert.match(capturedTarget.options.clientId, /^probe_/);
  assert.equal(client.endCalls, 1);
  assert.equal(client.eventNames().length, 0);
});

test('allows an MQTT TCP probe when the native runtime is TCP capable', () => {
  const target = createMqttProbeTarget({
    advancedConfig: { keepalive: 60, protocolVersion: 4 },
    connection: {
      protocol: 'mqtt',
      host: 'broker.example.com',
      port: 1883,
      path: '/mqtt',
      username: '',
      password: '',
    },
    tcpCapable: true,
    probeClientId: 'probe-native-mobile',
    timeoutMs: 10000,
  });

  assert.equal(target.url, 'mqtt://broker.example.com:1883');
});

test('closes the temporary client after errors, timeouts and cancellation', async () => {
  const errorClient = new FakeProbeClient();
  const errorResultPromise = runMqttConnectionProbe({
    ...probeConfig,
    mqtt: {
      connect() {
        queueMicrotask(() => errorClient.emit('error', new Error('Not authorized')));
        return errorClient;
      },
    },
  });
  const errorResult = await errorResultPromise;
  assert.equal(errorResult.ok, false);
  assert.equal(errorResult.error, 'Not authorized');
  assert.equal(errorClient.endCalls, 1);

  const timeoutClient = new FakeProbeClient();
  const timeoutResult = await runMqttConnectionProbe({
    ...probeConfig,
    mqtt: { connect: () => timeoutClient },
    timeoutMs: 5,
  });
  assert.equal(timeoutResult.ok, false);
  assert.match(timeoutResult.error, /连接超时/);
  assert.equal(timeoutClient.endCalls, 1);

  const canceledClient = new FakeProbeClient();
  const controller = new AbortController();
  const canceledResultPromise = runMqttConnectionProbe({
    ...probeConfig,
    mqtt: { connect: () => canceledClient },
    signal: controller.signal,
  });
  controller.abort();
  const canceledResult = await canceledResultPromise;
  assert.equal(canceledResult.ok, false);
  assert.equal(canceledResult.error, '测试已取消');
  assert.equal(canceledClient.endCalls, 1);
});

test('treats a rejected CONNACK as a failed probe and closes the client', async () => {
  const client = new FakeProbeClient();
  const result = await runMqttConnectionProbe({
    ...probeConfig,
    mqtt: {
      connect() {
        queueMicrotask(() => client.emit('connect', { reasonCode: 135 }));
        return client;
      },
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /CONNACK 135/);
  assert.equal(client.endCalls, 1);
});
