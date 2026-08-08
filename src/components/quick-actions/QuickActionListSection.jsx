import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Edit2,
  MoreVertical,
  Share2,
  Star,
  Trash2,
  Zap,
} from 'lucide-react';
import { isTemplateAction } from '../../utils/mqtt-helpers.js';
import { renderTemplateStr, splitNameByPrefix } from './quickActionUtils.jsx';

function ActionRow({
  action,
  displayNameOverride,
  theme,
  t,
  isTemplate,
  onSend,
  onTogglePin,
  onMulticast,
  onEdit,
  onLoad,
  onClose,
  onDelete,
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div
      onClick={() => onSend(action)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSend(action);
        }
      }}
      role="button"
      tabIndex={0}
      className={`w-full text-left ${t.card} border hover:border-amber-500/30 rounded-xl p-3 transition-all ${t.bgHover}`}
      title="点击直接发送"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className={`font-bold text-sm ${t.text} truncate`} title={action.name}>
              {displayNameOverride || action.name}
            </div>
            {isTemplate && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${theme === 'light' ? 'bg-purple-100 text-purple-600 border border-purple-200' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'}`}>
                模板
              </span>
            )}
          </div>
          <div className={`text-[11px] ${t.textMuted} truncate mt-1`}>
            {isTemplate ? renderTemplateStr(action.topic, theme) : action.topic}
          </div>
          <div className={`text-[11px] ${t.textSecondary} truncate mt-1 font-mono`}>
            {isTemplate ? renderTemplateStr(String(action.payload || ''), theme) : String(action.payload || '')}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(action.id);
            }}
            className={`hidden sm:block p-1 rounded-lg border ${t.border} ${t.bgSecondary} ${t.bgHover} transition-colors`}
            title={action.pinned ? '取消置顶' : '置顶'}
          >
            <Star
              className={`w-4 h-4 ${action.pinned ? (theme === 'light' ? 'text-amber-600' : 'text-amber-300') : t.textMuted}`}
              fill={action.pinned ? 'currentColor' : 'none'}
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMulticast(action);
            }}
            className={`hidden sm:block p-1 rounded-lg border ${t.border} ${t.bgSecondary} ${t.bgHover} transition-colors`}
            title="群发到已选目标"
          >
            <Share2 className={`w-4 h-4 ${t.textMuted}`} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(action);
            }}
            className={`hidden sm:block p-1 rounded-lg border ${t.border} ${t.bgSecondary} ${t.bgHover} transition-colors`}
            title="编辑"
          >
            <Edit2 className={`w-4 h-4 ${t.textMuted}`} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLoad(action);
              onClose();
            }}
            className={`hidden sm:block p-1 rounded-lg border ${t.border} ${t.bgSecondary} ${t.bgHover} transition-colors`}
            title="填充到发送区"
          >
            <Copy className={`w-4 h-4 ${t.textMuted}`} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(action.id);
            }}
            className={`hidden sm:block p-1 rounded-lg border ${t.border} ${t.bgSecondary} ${t.bgHover} transition-colors`}
            title="删除"
          >
            <Trash2 className={`w-4 h-4 ${t.textMuted}`} />
          </button>
          <div className="relative sm:hidden">
            <button type="button" onClick={(event) => { event.stopPropagation(); setMenuOpen((open) => !open); }} className={`p-1.5 rounded-lg border ${t.border} ${t.bgSecondary} ${t.bgHover} ${t.textMuted}`} title="更多操作" aria-label="更多操作">
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className={`absolute right-0 top-full mt-1 z-20 w-32 ${t.bgSecondary} border ${t.border} rounded-lg shadow-lg overflow-hidden`} onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={() => { onTogglePin(action.id); setMenuOpen(false); }} className={`w-full px-3 py-2 text-left text-xs ${t.textSecondary} ${t.bgHover}`}>{action.pinned ? '取消置顶' : '置顶'}</button>
                <button type="button" onClick={() => { onMulticast(action); setMenuOpen(false); }} className={`w-full px-3 py-2 text-left text-xs ${t.textSecondary} ${t.bgHover}`}>群发</button>
                <button type="button" onClick={() => { onEdit(action); setMenuOpen(false); }} className={`w-full px-3 py-2 text-left text-xs ${t.textSecondary} ${t.bgHover}`}>编辑</button>
                <button type="button" onClick={() => { onLoad(action); onClose(); }} className={`w-full px-3 py-2 text-left text-xs ${t.textSecondary} ${t.bgHover}`}>填入发布区</button>
                <button type="button" onClick={() => { onDelete(action.id); setMenuOpen(false); }} className={`w-full px-3 py-2 text-left text-xs text-rose-500 ${t.bgHover}`}>删除</button>
              </div>
            )}
          </div>
          <span className={`hidden sm:inline-flex text-[10px] ${t.textMuted} border ${t.border} rounded-full px-2 py-0.5`}>
            QoS {action.qos ?? 0}
            {action.retain ? ' · Retain' : ''}
          </span>
          <div className={`px-2 sm:px-3 py-1 rounded-lg text-xs font-bold ${theme === 'light' ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-300'} flex items-center gap-1`}>
            <Zap className="w-3 h-3" /> 发送
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuickActionListSection({
  title,
  items,
  grouped = false,
  theme,
  t,
  quickActionGroupCollapsed,
  setQuickActionGroupCollapsed,
  actionRowProps,
}) {
  if (!grouped) {
    return (
      <div className="space-y-2">
        <div className={`text-xs font-semibold ${t.textMuted} px-1`}>{title}</div>
        <div className="space-y-2">
          {items.map((action) => (
            <ActionRow
              key={action.id}
              action={action}
              isTemplate={isTemplateAction(action)}
              theme={theme}
              t={t}
              {...actionRowProps}
            />
          ))}
        </div>
      </div>
    );
  }

  const groupedMap = new Map();
  for (const action of items) {
    const { group, displayName } = splitNameByPrefix(action?.name);
    if (!groupedMap.has(group)) groupedMap.set(group, []);
    groupedMap.get(group).push({ action, displayName });
  }

  return (
    <div className="space-y-2">
      <div className={`text-xs font-semibold ${t.textMuted} px-1`}>{title}</div>
      <div className="space-y-3">
        {Array.from(groupedMap.entries()).map(([group, rows]) => {
          const isCollapsed = !!quickActionGroupCollapsed?.[group];

          return (
            <div key={group} className={`${t.card} border rounded-xl p-3`}>
              <button
                type="button"
                onClick={() => setQuickActionGroupCollapsed((prev) => ({ ...(prev || {}), [group]: !prev?.[group] }))}
                className={`w-full flex items-center justify-between gap-3 ${t.bgHover} rounded-lg px-2 py-1.5 transition-colors`}
                title={isCollapsed ? '展开' : '收起'}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isCollapsed ? (
                    <ChevronDown className={`w-4 h-4 ${t.textMuted}`} />
                  ) : (
                    <ChevronUp className={`w-4 h-4 ${t.textMuted}`} />
                  )}
                  <div className={`text-sm font-bold ${t.text} truncate`}>{group}</div>
                  <div className={`text-[10px] ${t.textMuted} border ${t.border} rounded-full px-2 py-0.5 shrink-0`}>
                    {rows.length}
                  </div>
                </div>
                <div className={`text-[11px] ${t.textMuted} shrink-0`}>{isCollapsed ? '展开' : '收起'}</div>
              </button>
              {!isCollapsed && (
                <div className="space-y-2 mt-3">
                  {rows.map(({ action, displayName }) => (
                    <ActionRow
                      key={action.id}
                      action={action}
                      displayNameOverride={displayName || action.name}
                      isTemplate={isTemplateAction(action)}
                      theme={theme}
                      t={t}
                      {...actionRowProps}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
