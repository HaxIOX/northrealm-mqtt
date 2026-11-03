import React from 'react';
import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useMqtt } from '../contexts/MqttContext.jsx';
import { formatDuration } from '../utils/formatters.js';
import { getConnectionPresentation } from '../utils/mqtt-connection-presentation.js';

const toneClasses = {
  amber: 'bg-amber-500 text-amber-500',
  emerald: 'bg-emerald-500 text-emerald-500',
  rose: 'bg-rose-500 text-rose-500',
  slate: 'bg-slate-400 text-slate-400',
};

function formatDisconnectedAt(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ConnectionStatusBar({ compact = false }) {
  const { t } = useTheme();
  const {
    connectDuration,
    connectStatus,
    connection,
    handleConnect,
    handleDisconnect,
    isRecovering,
    lastConnectionError,
    lastDisconnectedAt,
    manuallyStopped,
    reconnectCount,
    sdkReady,
  } = useMqtt();

  const presentation = getConnectionPresentation({
    connectStatus,
    isRecovering,
    lastConnectionError,
    manuallyStopped,
    reconnectCount,
  });
  const broker = `${connection.protocol}://${connection.host}:${connection.port}`;
  const disconnectedAt = formatDisconnectedAt(lastDisconnectedAt);
  const detail = (() => {
    if (presentation.key === 'connected') return `${broker} · ${formatDuration(connectDuration)}`;
    if (presentation.key === 'reconnecting') return `第 ${reconnectCount} 次 · ${broker}`;
    if (presentation.key === 'error') return lastConnectionError || broker;
    if (presentation.key === 'disconnected' && disconnectedAt) return `最近断开 ${disconnectedAt}`;
    return broker;
  })();
  const shouldDisconnect = presentation.action === 'disconnect';
  const actionLabel = shouldDisconnect ? '断开连接' : '重新连接';

  return (
    <div className={`${compact ? 'min-h-14 px-3 rounded-md border' : 'h-9 px-3 sm:px-4 lg:px-6 border-b'} flex items-center gap-2 ${t.border} ${t.bgSecondary} shrink-0 min-w-0`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${toneClasses[presentation.tone].split(' ')[0]}`} />
      <span className={`text-xs font-semibold shrink-0 ${toneClasses[presentation.tone].split(' ')[1]}`}>
        {presentation.label}
      </span>
      <span className={`text-xs truncate min-w-0 ${t.textMuted}`} title={detail}>{detail}</span>
      <button
        type="button"
        onClick={shouldDisconnect ? handleDisconnect : handleConnect}
        disabled={!shouldDisconnect && !sdkReady}
        className={`ml-auto w-7 h-7 shrink-0 rounded-lg border ${t.border} ${t.bgHover} ${t.textSecondary} disabled:opacity-50 flex items-center justify-center`}
        title={actionLabel}
        aria-label={actionLabel}
      >
        {!sdkReady && !shouldDisconnect
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : shouldDisconnect
            ? <WifiOff className="w-3.5 h-3.5" />
            : <Wifi className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
