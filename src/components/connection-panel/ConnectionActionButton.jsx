import React from 'react';
import { Loader2, Play, Square } from 'lucide-react';

export default function ConnectionActionButton({
  connectStatus,
  handleConnect,
  handleDisconnect,
  reconnectCount,
  sdkReady,
}) {
  const onClick = connectStatus === 'connected' || connectStatus === 'connecting' || reconnectCount > 0
    ? handleDisconnect
    : handleConnect;

  const buttonClass = connectStatus !== 'connected'
    ? reconnectCount > 0
      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
      : 'bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200'
    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20';

  return (
    <button
      onClick={onClick}
      disabled={!sdkReady}
      className={`w-full text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all text-sm ${buttonClass} disabled:opacity-50`}
    >
      {connectStatus !== 'connected' ? (
        !sdkReady ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</> :
        connectStatus === 'connecting' && reconnectCount === 0 ? <><Square className="w-4 h-4 fill-current" /> 取消连接</> :
        reconnectCount > 0 ? <><Square className="w-4 h-4 fill-current" /> 停止重连 ({reconnectCount})</> :
        <><Play className="w-4 h-4 fill-current" /> 连接</>
      ) : <><Square className="w-4 h-4 fill-current" /> 断开连接</>}
    </button>
  );
}
