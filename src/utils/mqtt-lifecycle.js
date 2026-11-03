export function shouldRecoverOnForeground({
  autoReconnect,
  connectionIntent,
  recoveryInFlight,
  client,
  connectStatus,
}) {
  if (!autoReconnect || !connectionIntent || recoveryInFlight) return false;
  if (client?.connected || client?.reconnecting) return false;
  return connectStatus !== 'connecting';
}
