import React from 'react';
import { Star } from 'lucide-react';

export default function CommonActionsBar({
  commonActions,
  commonActionsContainerRef,
  maxCommonActions,
  onAddAction,
  onSendQuickAction,
  t,
  theme,
}) {
  return (
    <div ref={commonActionsContainerRef} className={`flex items-center gap-2 ${t.bgTertiary} border ${t.border} rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 overflow-x-auto custom-scrollbar`}>
      <div className={`text-xs font-semibold ${t.textMuted} shrink-0 flex items-center gap-1`}><Star className="w-3.5 h-3.5" /> 常用</div>
      <div className="flex items-center gap-2 min-w-0">
        {commonActions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onSendQuickAction(action)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${theme === 'light' ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' : 'bg-amber-500/10 text-amber-200 border-amber-500/20 hover:bg-amber-500/20'}`}
            title={`${action.name}\n${action.topic}`}
          >
            {action.name}
          </button>
        ))}
        {Array.from({ length: Math.max(0, maxCommonActions - commonActions.length) }).map((_, idx) => (
          <button
            key={`common-empty-${idx}`}
            type="button"
            onClick={onAddAction}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${t.bgSecondary} ${t.textSecondary} ${t.bgHover} ${t.border}`}
            title="添加常用（置顶或最近使用会出现在这里）"
          >
            添加
          </button>
        ))}
      </div>
    </div>
  );
}
