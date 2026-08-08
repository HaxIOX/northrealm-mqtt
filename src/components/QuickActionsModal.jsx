import React, { useState } from 'react';
import { Search, X, Zap } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useMqtt } from '../contexts/MqttContext.jsx';
import { useAppData } from '../contexts/AppDataContext.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import { removeLocalStorageItem } from '../hooks/useLocalStorage.js';
import { EditActionForm } from './quick-actions/EditActionForm.jsx';
import { QuickActionListSection } from './quick-actions/QuickActionListSection.jsx';
import { TemplateFillForm } from './quick-actions/TemplateFillForm.jsx';
import { useQuickActionRunner } from './quick-actions/useQuickActionRunner.js';

export default function QuickActionsModal() {
  const { theme, t } = useTheme();
  const { openConfirmModal } = useModal();
  const {
    client, showQuickActionsPanel, setShowQuickActionsPanel,
    quickActionQuery, setQuickActionQuery,
    addLog,
    pendingTemplateAction, setPendingTemplateAction,
  } = useMqtt();
  const {
    quickActions, recentActionIds, quickActionGroupCollapsed, setQuickActionGroupCollapsed,
    toggleActionPinned, updateData,
  } = useAppData();
  const {
    loadActionIntoPublishForm,
    sendQuickAction,
    sendToSelectedMulticastTargets,
    submitTemplateAction,
  } = useQuickActionRunner();

  const [templateFillAction, setTemplateFillAction] = useState(null);
  const [editingAction, setEditingAction] = useState(null);

  if (!showQuickActionsPanel) return null;

  const activeTemplateFill = templateFillAction || pendingTemplateAction;

  const closePanel = () => {
    setShowQuickActionsPanel(false);
    setQuickActionQuery('');
    setTemplateFillAction(null);
    setEditingAction(null);
    setPendingTemplateAction(null);
  };

  const handleTemplateSubmit = (vars) => {
    submitTemplateAction(activeTemplateFill, vars, { onAfterSend: closePanel });
  };

  const handleLoadAction = (action) => {
    loadActionIntoPublishForm(action);
  };

  const handleDeleteAction = (id) => {
    openConfirmModal('确定删除此快捷指令?', () => {
      updateData('actions', quickActions.filter((a) => a.id !== id));
      removeLocalStorageItem(`mqtt_action_vars_${id}`);
    }, { confirmText: '确定删除', confirmVariant: 'danger' });
  };

  const handleEditAction = (action) => {
    setEditingAction(action);
  };

  const handleSaveEdit = (form) => {
    const action = editingAction;
    if (!action) return;
    if (quickActions.some((a) => a.id !== action.id && a.name === form.name)) {
      addLog('error', '', `指令名称"${form.name}"已存在`);
      return;
    }
    updateData('actions', quickActions.map((a) => a.id === action.id ? { ...a, ...form } : a));
    setEditingAction(null);
  };

  const actionRowProps = {
    onSend: (action) => sendQuickAction(action, {
      onAfterSend: closePanel,
      setTemplateFillAction,
    }),
    onTogglePin: toggleActionPinned,
    onMulticast: (action) => sendToSelectedMulticastTargets(action),
    onEdit: handleEditAction,
    onLoad: handleLoadAction,
    onClose: closePanel,
    onDelete: handleDeleteAction,
  };

  const query = (quickActionQuery || '').trim().toLowerCase();
  const allActions = Array.isArray(quickActions) ? quickActions : [];
  const matchesQuery = (action) => `${action?.name || ''} ${action?.topic || ''} ${action?.payload || ''}`.toLowerCase().includes(query);
  const filteredActions = query ? allActions.filter(matchesQuery) : allActions;
  const pinnedActions = !query ? allActions.filter((action) => action && action.pinned) : [];
  const recentActions = !query
    ? recentActionIds
      .map((id) => allActions.find((action) => action.id === id))
      .filter(Boolean)
      .slice(0, 10)
    : [];

  return (
    <div className="fixed inset-0 bg-black/50 z-[65] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`${t.bgSecondary} rounded-2xl shadow-2xl max-w-2xl w-full border ${t.border} p-6`}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className={`text-lg font-bold flex items-center gap-2 ${t.text}`}><Zap className="w-5 h-5 text-amber-500" /> 快捷指令</h3>
          <button onClick={closePanel} className={`${t.textMuted} hover:${t.text} p-1 ${t.bgHover} rounded-lg transition-colors`} title="关闭 (Esc)"><X className="w-5 h-5" /></button>
        </div>

        {activeTemplateFill ? (
          <TemplateFillForm
            action={activeTemplateFill}
            theme={theme}
            t={t}
            onSubmit={handleTemplateSubmit}
            onCancel={() => {
              setTemplateFillAction(null);
              setPendingTemplateAction(null);
            }}
          />
        ) : editingAction ? (
          <EditActionForm
            action={editingAction}
            theme={theme}
            t={t}
            onSave={handleSaveEdit}
            onCancel={() => setEditingAction(null)}
          />
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <div className={`flex-1 flex items-center gap-2 ${t.bgInput} border ${t.border} rounded-xl px-3 py-2`}>
                <Search className={`w-4 h-4 ${t.textMuted}`} />
                <input autoFocus value={quickActionQuery} onChange={(e) => setQuickActionQuery(e.target.value)} placeholder="搜索 名称 / Topic / Payload..." className={`flex-1 bg-transparent text-sm outline-none ${t.text}`} />
              </div>
              <button onClick={() => setQuickActionQuery('')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${t.bgTertiary} ${t.textSecondary} border ${t.border} ${t.bgHover}`}>清空</button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
              {!client?.connected && (
                <div className={`p-3 rounded-xl border ${theme === 'light' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'} text-sm`}>
                  提示：当前未连接，点击发送会提示错误。请先连接 MQTT。
                </div>
              )}
              {pinnedActions.length > 0 && (
                <QuickActionListSection
                  title={`置顶（${pinnedActions.length}）`}
                  items={pinnedActions}
                  theme={theme}
                  t={t}
                  quickActionGroupCollapsed={quickActionGroupCollapsed}
                  setQuickActionGroupCollapsed={setQuickActionGroupCollapsed}
                  actionRowProps={actionRowProps}
                />
              )}
              {recentActions.length > 0 && (
                <QuickActionListSection
                  title="最近使用"
                  items={recentActions}
                  theme={theme}
                  t={t}
                  quickActionGroupCollapsed={quickActionGroupCollapsed}
                  setQuickActionGroupCollapsed={setQuickActionGroupCollapsed}
                  actionRowProps={actionRowProps}
                />
              )}
              <QuickActionListSection
                title={query ? `搜索结果（${filteredActions.length}）` : `全部（${filteredActions.length}）`}
                items={filteredActions}
                grouped={!query && filteredActions.length > 0}
                theme={theme}
                t={t}
                quickActionGroupCollapsed={quickActionGroupCollapsed}
                setQuickActionGroupCollapsed={setQuickActionGroupCollapsed}
                actionRowProps={actionRowProps}
              />
              {filteredActions.length === 0 && (
                <div className={`text-center py-10 border border-dashed ${t.border} rounded-xl text-sm ${t.textMuted}`}>没有匹配的快捷指令</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
