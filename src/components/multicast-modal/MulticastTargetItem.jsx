import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';

export default function MulticastTargetItem({
  checked,
  id,
  onDelete,
  onRename,
  onToggle,
  t,
  target,
}) {
  return (
    <div className={`w-full ${t.card} border rounded-xl p-3 transition-all`}>
      <div className="flex items-start gap-3">
        <label className="pt-1">
          <input type="checkbox" checked={checked} onChange={() => onToggle(id)} className="rounded bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-indigo-600 w-4 h-4" />
        </label>
        <button type="button" onClick={() => onToggle(id)} className="flex-1 min-w-0 text-left" title="点击选中/取消">
          <div className={`font-bold text-sm ${t.text} truncate`}>{String(target?.name || '') || '未命名'}</div>
          <div className={`text-[11px] ${t.textMuted} truncate mt-1 font-mono`}>{String(target?.topic || '')}</div>
        </button>
        <div className="shrink-0 flex items-center gap-2">
          <button type="button" onClick={(e) => onRename(target, e)} className={`p-1 rounded-lg border ${t.border} ${t.bgSecondary} ${t.bgHover} transition-colors`} title="重命名"><Edit2 className={`w-4 h-4 ${t.textMuted}`} /></button>
          <button type="button" onClick={() => onDelete(id)} className={`p-1 rounded-lg border ${t.border} ${t.bgSecondary} ${t.bgHover} transition-colors`} title="删除"><Trash2 className={`w-4 h-4 ${t.textMuted}`} /></button>
        </div>
      </div>
    </div>
  );
}
