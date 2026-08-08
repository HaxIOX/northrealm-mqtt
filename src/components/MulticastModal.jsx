import React from 'react';
import { Share2, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useMqtt } from '../contexts/MqttContext.jsx';
import { useAppData } from '../contexts/AppDataContext.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import { parseTopicList } from '../utils/mqtt-helpers.js';
import MulticastActionBar from './multicast-modal/MulticastActionBar.jsx';
import MulticastFooter from './multicast-modal/MulticastFooter.jsx';
import MulticastTargetList from './multicast-modal/MulticastTargetList.jsx';

export default function MulticastModal() {
  const { theme, t } = useTheme();
  const { openConfirmModal, openInputModal } = useModal();
  const {
    client, showMulticastPanel, setShowMulticastPanel,
    multicastQuery, setMulticastQuery,
    pubTopic, setPubTopic, pubMessage, pubQoS, pubRetain,
    addLog,
  } = useMqtt();
  const {
    subscriptions, multicastTargets, multicastSelectedIds,
    getSelectedMulticastTopics, upsertMulticastTargetsFromTopics,
    toggleMulticastTargetSelected, selectAllMulticastTargets, clearMulticastSelection,
    setMulticastSelectedIds, updateData,
  } = useAppData();

  if (!showMulticastPanel) return null;

  const closePanel = () => { setShowMulticastPanel(false); setMulticastQuery(''); };

  const deleteMulticastTarget = (id) => {
    const n = Number(id);
    openConfirmModal('确定删除该群发目标？', () => {
      updateData('multicastTargets', (multicastTargets || []).filter((t) => Number(t?.id) !== n));
      setMulticastSelectedIds((prev) => (prev || []).filter((x) => Number(x) !== n));
    }, { confirmText: '确定删除', confirmVariant: 'danger' });
  };

  const renameMulticastTarget = (target, e) => {
    if (e) e.stopPropagation();
    const id = Number(target?.id);
    if (!Number.isFinite(id)) return;
    openInputModal('修改目标名称', String(target?.name || ''), (newName) => {
      const name = String(newName || '').trim();
      if (!name) return;
      updateData('multicastTargets', (multicastTargets || []).map((t) => (Number(t?.id) === id ? { ...t, name } : t)));
    });
  };

  const sendToSelectedMulticastTargets = () => {
    if (!client?.connected) return addLog('error', '', '请先连接服务器');
    const topics = getSelectedMulticastTopics();
    if (topics.length === 0) return addLog('error', '', '未选择群发目标');
    addLog('system', '', `群发（${topics.length} 个目标）`);
    topics.forEach((topic) => {
      client.publish(topic, pubMessage, { qos: pubQoS, retain: pubRetain }, (err) => {
        if (err) addLog('error', topic, `群发 发送失败: ${err.message}`);
        else addLog('sent', topic, pubMessage, `QoS: ${pubQoS}`);
      });
    });
  };

  const q = (multicastQuery || '').trim().toLowerCase();
  const all = Array.isArray(multicastTargets) ? multicastTargets : [];
  const match = (tgt) => `${tgt?.name || ''} ${tgt?.topic || ''}`.toLowerCase().includes(q);
  const filtered = q ? all.filter(match) : all;
  const selected = new Set((multicastSelectedIds || []).map((x) => Number(x)));
  const selectedCount = (multicastTargets || []).filter((t) => selected.has(Number(t?.id))).length;

  return (
    <div className="fixed inset-0 bg-black/50 z-[66] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`${t.bgSecondary} rounded-2xl shadow-2xl max-w-2xl w-full border ${t.border} p-6`}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className={`text-lg font-bold flex items-center gap-2 ${t.text}`}><Share2 className="w-5 h-5 text-indigo-500" /> 群发目标</h3>
          <button onClick={closePanel} className={`${t.textMuted} hover:${t.text} p-1 ${t.bgHover} rounded-lg transition-colors`} title="关闭 (Esc)"><X className="w-5 h-5" /></button>
        </div>

        <MulticastActionBar
          multicastQuery={multicastQuery}
          onClearAll={() => {
            openConfirmModal('确定清空全部群发目标？', () => {
              updateData('multicastTargets', []);
              setMulticastSelectedIds([]);
            }, { confirmText: '确定清空', confirmVariant: 'danger' });
          }}
          onClearQuery={() => setMulticastQuery('')}
          onImportFromSubscriptions={() => upsertMulticastTargetsFromTopics(subscriptions, { selectAdded: true })}
          onImportFromTopic={() => upsertMulticastTargetsFromTopics(parseTopicList(pubTopic), { selectAdded: true })}
          onSearchChange={(e) => setMulticastQuery(e.target.value)}
          onSelectAll={selectAllMulticastTargets}
          onSelectNone={clearMulticastSelection}
          t={t}
          theme={theme}
        />

        <div className="space-y-3">
          <MulticastTargetList
            allCount={all.length}
            emptyText={'没有目标。可点"从订阅导入"或"从当前Topic导入"。'}
            filteredTargets={filtered}
            onDelete={deleteMulticastTarget}
            onRename={renameMulticastTarget}
            onToggle={toggleMulticastTargetSelected}
            q={q}
            selectedCount={selectedCount}
            selectedIds={selected}
            t={t}
          />

          <MulticastFooter
            client={client}
            onApplyToTopic={() => {
              const topics = getSelectedMulticastTopics();
              if (topics.length === 0) return addLog('error', '', '未选择群发目标');
              setPubTopic(topics.join(','));
              closePanel();
            }}
            onSend={sendToSelectedMulticastTargets}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}
