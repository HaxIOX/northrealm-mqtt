export function getConnectionPresentation({
  connectStatus,
  isRecovering,
  lastConnectionError,
  manuallyStopped,
  reconnectCount,
}) {
  if (isRecovering) {
    return { key: 'recovering', label: '恢复中', tone: 'amber', action: 'disconnect' };
  }

  if (connectStatus === 'connected') {
    return { key: 'connected', label: '已连接', tone: 'emerald', action: 'disconnect' };
  }

  if (reconnectCount > 0) {
    return { key: 'reconnecting', label: '重连中', tone: 'amber', action: 'disconnect' };
  }

  if (connectStatus === 'connecting') {
    return { key: 'connecting', label: '连接中', tone: 'amber', action: 'disconnect' };
  }

  if (manuallyStopped) {
    return { key: 'manual-stop', label: '手动停止', tone: 'slate', action: 'connect' };
  }

  if (connectStatus === 'error' || lastConnectionError) {
    return { key: 'error', label: '连接错误', tone: 'rose', action: 'connect' };
  }

  return { key: 'disconnected', label: '已断开', tone: 'slate', action: 'connect' };
}

