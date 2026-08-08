import React from 'react';
import { Maximize2, Send, Share2 } from 'lucide-react';

export default function PublishComposer({
  client,
  getSelectedMulticastTopics,
  handlePublish,
  openPublishEditor,
  pubMessage,
  setPubMessage,
  setShowMulticastPanel,
  t,
}) {
  const selectedTopicCount = getSelectedMulticastTopics().length;

  return (
    <div className="flex gap-2 sm:gap-3 flex-1 min-h-0 min-w-0">
      <textarea
        value={pubMessage}
        onChange={(e) => setPubMessage(e.target.value)}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        className={`flex-1 h-full min-w-0 ${t.bgInput} border ${t.border} rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-sm font-mono resize-none min-h-0 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${t.text} custom-scrollbar`}
        placeholder='Payload (e.g. {"msg": "Hello"})'
      />
      <button type="button" onClick={openPublishEditor} className={`w-10 ${t.bgTertiary} ${t.bgHover} border ${t.border} rounded-xl ${t.textSecondary} hover:${t.text} transition-all flex items-center justify-center`} title="展开编辑">
        <Maximize2 className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => setShowMulticastPanel(true)}
        className={`w-10 ${t.bgTertiary} ${t.bgHover} border ${t.border} rounded-xl ${t.textSecondary} hover:${t.text} transition-all flex items-center justify-center`}
        title={selectedTopicCount > 0 ? `群发目标（已选 ${selectedTopicCount}）` : '群发目标'}
      >
        <Share2 className="w-4 h-4" />
      </button>
      <button onClick={handlePublish} disabled={!client?.connected} className="w-14 sm:w-24 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 sm:gap-2 transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30">
        <Send className="w-4 h-4 sm:w-5 sm:h-5" /><span className="text-[11px] sm:text-xs">发送</span><span className="hidden sm:block text-[10px] text-indigo-200 opacity-70">Ctrl+Enter</span>
      </button>
    </div>
  );
}
