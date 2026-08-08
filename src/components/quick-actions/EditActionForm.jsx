import React, { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';

export function EditActionForm({ action, theme, t, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: action?.name || '',
    topic: action?.topic || '',
    payload: action?.payload || '',
    qos: action?.qos ?? 0,
    retain: !!action?.retain,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({ ...form, name: form.name.trim() });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className={`p-1.5 rounded-lg ${t.bgTertiary} ${t.bgHover} transition-colors`}
        >
          <ArrowLeft className={`w-4 h-4 ${t.textMuted}`} />
        </button>
        <div className={`font-bold text-sm ${t.text}`}>编辑指令</div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={`text-xs font-medium ${t.textSecondary} mb-1 block`}>名称</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            autoFocus
            className={`w-full px-3 py-2 ${t.bgInput} border ${t.border} rounded-xl text-sm ${t.text} focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
          />
        </div>
        <div>
          <label className={`text-xs font-medium ${t.textSecondary} mb-1 block`}>Topic</label>
          <input
            type="text"
            value={form.topic}
            onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
            className={`w-full px-3 py-2 ${t.bgInput} border ${t.border} rounded-xl text-sm ${t.text} font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
          />
        </div>
        <div>
          <label className={`text-xs font-medium ${t.textSecondary} mb-1 block`}>Payload</label>
          <textarea
            value={form.payload}
            onChange={(e) => setForm((prev) => ({ ...prev, payload: e.target.value }))}
            rows={3}
            className={`w-full px-3 py-2 ${t.bgInput} border ${t.border} rounded-xl text-sm ${t.text} font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none`}
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className={`text-xs font-medium ${t.textSecondary} mb-1 block`}>QoS</label>
            <select
              value={form.qos}
              onChange={(e) => setForm((prev) => ({ ...prev, qos: Number(e.target.value) }))}
              className={`w-full px-3 py-2 ${t.bgInput} border ${t.border} rounded-xl text-sm ${t.text} focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
            >
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </div>
          <div className="flex-1 flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.retain}
                onChange={(e) => setForm((prev) => ({ ...prev, retain: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className={`text-sm ${t.textSecondary}`}>Retain</span>
            </label>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${theme === 'light' ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30'}`}
          >
            <Check className="w-4 h-4" /> 保存
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium ${t.bgTertiary} ${t.textSecondary} border ${t.border} ${t.bgHover}`}
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
