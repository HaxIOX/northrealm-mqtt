import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRecoverOnForeground } from '../src/utils/mqtt-lifecycle.js';

const base = {
  autoReconnect: true,
  connectionIntent: true,
  recoveryInFlight: false,
  client: null,
  connectStatus: 'disconnected',
};

test('recovers a stale client when the app returns to foreground', () => {
  assert.equal(shouldRecoverOnForeground(base), true);
});

test('does not recover when auto reconnect is disabled', () => {
  assert.equal(shouldRecoverOnForeground({ ...base, autoReconnect: false }), false);
});

test('does not recover after a manual disconnect', () => {
  assert.equal(shouldRecoverOnForeground({ ...base, connectionIntent: false }), false);
});

test('does not start a second recovery while one is in flight', () => {
  assert.equal(shouldRecoverOnForeground({ ...base, recoveryInFlight: true }), false);
});

test('does not recover a healthy or already reconnecting client', () => {
  assert.equal(shouldRecoverOnForeground({ ...base, client: { connected: true } }), false);
  assert.equal(shouldRecoverOnForeground({ ...base, client: { reconnecting: true } }), false);
  assert.equal(shouldRecoverOnForeground({ ...base, connectStatus: 'connecting' }), false);
});
