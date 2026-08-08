import React from 'react';
import { CircleCheck, CircleX, FlaskConical, Loader2 } from 'lucide-react';

export default function ConnectionProbeAction({
  disabledReason,
  isTesting,
  onTest,
  probeResult,
  sdkReady,
  t,
  theme,
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onTest}
        disabled={!sdkReady || isTesting || !!disabledReason}
        title={disabledReason || '使用当前配置建立临时连接'}
        className={`w-full py-2 rounded-lg border ${t.border} ${t.bgHover} ${t.textSecondary} disabled:opacity-50 flex items-center justify-center gap-2 text-xs font-medium transition-colors`}
      >
        {isTesting
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <FlaskConical className="w-3.5 h-3.5" />}
        {isTesting ? '正在测试连接' : '测试连接'}
      </button>

      {probeResult && (
        <div className={`px-3 py-2 rounded-lg border text-xs flex items-start gap-2 ${
          probeResult.ok
            ? theme === 'light'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            : theme === 'light'
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
        }`}>
          {probeResult.ok
            ? <CircleCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            : <CircleX className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
          <span className="min-w-0 break-words">
            {probeResult.ok
              ? `连接成功 · ${probeResult.durationMs} ms · CONNACK ${probeResult.returnCode}${probeResult.sessionPresent ? ' · 已恢复会话' : ''}`
              : probeResult.error}
          </span>
        </div>
      )}
    </div>
  );
}
