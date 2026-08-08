import React from 'react';

export default function ConnectionFormFields({
  connectStatus,
  connection,
  handlePortChange,
  handleProtocolChange,
  isDesktopShell,
  setConnection,
  t,
  theme,
}) {
  const isConnected = connectStatus === 'connected';

  return (
    <>
      <input
        type="text"
        value={connection.host}
        onChange={(e) => setConnection({ ...connection, host: e.target.value })}
        disabled={isConnected}
        className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-current outline-none transition-all disabled:opacity-50 ${t.text}`}
        placeholder="Host (e.g. broker.emqx.io)"
      />

      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={connection.port}
          onChange={(e) => handlePortChange(e.target.value)}
          disabled={isConnected}
          className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-current outline-none transition-all disabled:opacity-50 ${t.text}`}
          placeholder="Port"
        />
        <select
          value={connection.protocol}
          onChange={(e) => handleProtocolChange(e.target.value)}
          disabled={isConnected}
          className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-current outline-none transition-all disabled:opacity-50 ${t.text}`}
        >
          <option value="ws">ws://</option>
          <option value="wss">wss://</option>
          <option value="mqtt" disabled={!isDesktopShell}>mqtt://{isDesktopShell ? '' : '（桌面端）'}</option>
          <option value="mqtts" disabled={!isDesktopShell}>mqtts://{isDesktopShell ? '' : '（桌面端）'}</option>
        </select>
      </div>

      {connection.protocol === 'wss' && (
        <div className={`text-xs ${theme === 'light' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-amber-400/80 bg-amber-500/10 border-amber-500/20'} px-3 py-2 rounded-lg border`}>
          提示: 如果服务器没有 SSL 证书，请使用 ws://
        </div>
      )}

      {(connection.protocol === 'ws' || connection.protocol === 'wss') && (
        <input
          type="text"
          value={connection.path}
          onChange={(e) => setConnection({ ...connection, path: e.target.value })}
          disabled={isConnected}
          className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-current outline-none transition-all disabled:opacity-50 ${t.text}`}
          placeholder="Path（仅 ws/wss 使用，例如 /mqtt）"
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={connection.username}
          onChange={(e) => setConnection({ ...connection, username: e.target.value })}
          disabled={isConnected}
          placeholder="用户名"
          className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-current outline-none transition-all disabled:opacity-50 ${t.text}`}
        />
        <input
          type="password"
          value={connection.password}
          onChange={(e) => setConnection({ ...connection, password: e.target.value })}
          disabled={isConnected}
          placeholder="密码"
          className={`w-full ${t.bgInput} border ${t.border} rounded-lg px-3 py-2 text-sm focus:border-current outline-none transition-all disabled:opacity-50 ${t.text}`}
        />
      </div>
    </>
  );
}
