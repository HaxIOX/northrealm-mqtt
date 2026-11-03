export const MESSAGE_LOG_LIMIT = 2000;
export const EVENT_LOG_LIMIT = 300;

export function isMessageLog(log, isDevMode) {
  return log.type === 'sent'
    || log.type === 'received'
    || (log.type === 'error' && (!!log.topic || !isDevMode));
}

export function trimMqttLogs(
  logs,
  isDevMode,
  messageLimit = MESSAGE_LOG_LIMIT,
  eventLimit = EVENT_LOG_LIMIT,
) {
  let messageCount = 0;
  let eventCount = 0;
  const retained = [];

  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const log = logs[index];
    if (isMessageLog(log, isDevMode)) {
      if (messageCount >= messageLimit) continue;
      messageCount += 1;
    } else {
      if (eventCount >= eventLimit) continue;
      eventCount += 1;
    }
    retained.push(log);
  }

  retained.reverse();
  return retained;
}

export function appendBoundedMqttLog(logs, log, isDevMode) {
  return trimMqttLogs([...logs, log], isDevMode);
}

