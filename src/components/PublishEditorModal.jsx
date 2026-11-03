import React from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useMqtt } from '../contexts/MqttContext.jsx';

export default function PublishEditorModal() {
  const { t } = useTheme();
  const { publishEditorOpen, setPublishEditorOpen, publishEditorValue, setPublishEditorValue, setPubMessage } = useMqtt();

  if (!publishEditorOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`${t.bgSecondary} rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] border ${t.border} flex flex-col overflow-hidden`}>
        <div className={`p-4 border-b ${t.border} flex items-center gap-3`}>
          <div className="min-w-0 flex-1">
            <div className={`text-sm font-semibold ${t.text}`}>发送区编辑</div>
            <div className={`text-xs ${t.textMuted}`}>Payload</div>
          </div>
          <button
            type="button" onClick={() => setPublishEditorOpen(false)}
            className={`p-2 ${t.bgTertiary} border ${t.border} rounded-xl ${t.textSecondary} hover:${t.text} ${t.bgHover} transition-all`}
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 p-4">
          <textarea
            value={publishEditorValue}
            onChange={(e) => setPublishEditorValue(e.target.value)}
            spellCheck={false} autoCorrect="off" autoCapitalize="off"
            className={`w-full h-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-3 text-sm font-mono resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${t.text} custom-scrollbar`}
          />
        </div>
        <div className={`p-4 border-t ${t.border} flex justify-end gap-3`}>
          <button type="button" onClick={() => setPublishEditorOpen(false)} className={`px-4 py-2 ${t.bgTertiary} ${t.bgHover} rounded-xl text-sm font-medium transition-colors ${t.textSecondary}`}>取消</button>
          <button
            type="button"
            onClick={() => { setPubMessage(publishEditorValue); setPublishEditorOpen(false); }}
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20"
          >应用</button>
        </div>
      </div>
    </div>
  );
}
