import React from 'react';
import MulticastTargetItem from './MulticastTargetItem.jsx';

export default function MulticastTargetList({
  allCount,
  emptyText,
  filteredTargets,
  onDelete,
  onRename,
  onToggle,
  q,
  selectedCount,
  selectedIds,
  t,
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className={`text-xs font-semibold ${t.textMuted}`}>{q ? `搜索结果（${filteredTargets.length}）` : `全部（${filteredTargets.length}）`}</div>
        <div className={`text-xs ${t.textMuted}`}>已选 {selectedCount} / {allCount}</div>
      </div>

      <div className="space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
        {filteredTargets.map((target) => {
          const id = Number(target?.id);
          return (
            <MulticastTargetItem
              key={String(target?.id)}
              checked={selectedIds.has(id)}
              id={id}
              onDelete={onDelete}
              onRename={onRename}
              onToggle={onToggle}
              t={t}
              target={target}
            />
          );
        })}
        {filteredTargets.length === 0 && (
          <div className={`text-center py-10 border border-dashed ${t.border} rounded-xl text-sm ${t.textMuted}`}>{emptyText}</div>
        )}
      </div>
    </div>
  );
}
