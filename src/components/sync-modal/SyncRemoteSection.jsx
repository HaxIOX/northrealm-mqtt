import React from 'react';

export default function SyncRemoteSection({
  cloudCryptoError,
  handleConnectSync,
  handleDisconnectSync,
  inputSpaceId,
  setInputSpaceId,
  setRememberPassphrase,
  setSyncEncryptEnabled,
  setSyncPassphrase,
  syncEncryptEnabled,
  syncPassphrase,
  syncSpaceId,
  rememberPassphrase,
  t,
}) {
  return (
    <>
      <p className={`text-sm ${t.textSecondary} mb-4`}>输入一个唯一的 <b className={t.text}>Space ID</b>，所有使用该 ID 的设备将实时同步数据。</p>
      <div className="space-y-4">
        <div className="flex gap-2">
          <input type="text" value={inputSpaceId} onChange={(e) => setInputSpaceId(e.target.value)} placeholder="Space ID" className={`flex-1 ${t.bgInput} border ${t.border} rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${t.text}`} />
          <button
            onClick={() => {
              const rand = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
                : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(0, 16);
              setInputSpaceId(`space_${rand}`);
            }}
            className={`px-4 py-2.5 ${t.bgTertiary} ${t.bgHover} rounded-xl text-xs font-medium transition-colors`}
          >
            随机
          </button>
        </div>

        <div className={`p-4 ${t.bgTertiary} border ${t.border} rounded-xl space-y-3`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${t.text}`}>端到端加密（推荐）</div>
              <div className={`text-xs ${t.textMuted}`}>开启后云端仅存密文，不上传明文配置</div>
            </div>
            <input type="checkbox" checked={syncEncryptEnabled} onChange={(e) => setSyncEncryptEnabled(e.target.checked)} className="rounded bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <label className={`text-xs ${t.textMuted}`}>同步口令</label>
            <input type="password" value={syncPassphrase} onChange={(e) => setSyncPassphrase(e.target.value)} disabled={!syncEncryptEnabled} placeholder={syncEncryptEnabled ? '请输入口令（用于加密/解密）' : '关闭加密时无需口令'} className={`w-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-2 text-sm outline-none transition-all ${t.text} ${syncEncryptEnabled ? 'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20' : 'opacity-60'}`} />
            <label className={`flex items-center gap-2 text-xs ${t.textSecondary}`}>
              <input type="checkbox" checked={rememberPassphrase} onChange={(e) => setRememberPassphrase(e.target.checked)} disabled={!syncEncryptEnabled} className="rounded bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-emerald-600" />
              <span>在本机记住口令（本次会话）</span>
            </label>
          </div>
          {cloudCryptoError && (
            <div className="p-3 bg-rose-100 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-700/50 rounded-xl text-rose-700 dark:text-rose-200 text-xs whitespace-pre-wrap">{cloudCryptoError}</div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={handleConnectSync} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all">开启同步</button>
          {syncSpaceId && <button onClick={handleDisconnectSync} className="px-4 bg-rose-100 hover:bg-rose-200 dark:bg-rose-600/20 dark:hover:bg-rose-600/30 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-600/30 rounded-xl font-medium transition-colors">断开</button>}
        </div>
      </div>
    </>
  );
}
