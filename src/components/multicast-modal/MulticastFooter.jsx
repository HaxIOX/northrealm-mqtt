import React from 'react';

export default function MulticastFooter({
  client,
  onApplyToTopic,
  onSend,
  t,
}) {
  return (
    <div className={`pt-3 border-t ${t.border} flex flex-wrap justify-end gap-2`}>
      <button
        type="button"
        onClick={onApplyToTopic}
        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg ${t.bgTertiary} ${t.bgHover} border ${t.border} ${t.text}`}
        title="把选中的目标 Topic 应用到发送区"
      >
        应用到Topic
      </button>
      <button
        type="button"
        onClick={onSend}
        disabled={!client?.connected}
        className="px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        title="使用当前 Payload 群发到已选目标"
      >
        群发当前Payload
      </button>
    </div>
  );
}
