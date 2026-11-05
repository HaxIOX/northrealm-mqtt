import { useAppData } from '../contexts/AppDataContext.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import { useMqtt } from '../contexts/MqttContext.jsx';

// 发布区的“存为指令”与“常用指令”（置顶优先，其次最近使用）。手机端 PublishBar 与桌面端 DesktopPublishBar 共用。
export function useCommonQuickActions(maxCommonActions) {
  const { openInputModal } = useModal();
  const { pubTopic, pubMessage, pubQoS, pubRetain, addLog } = useMqtt();
  const { quickActions, recentActionIds, updateData } = useAppData();

  const handleSaveAction = () => {
    openInputModal("给指令起个名字 (如: 开灯)", "新指令", (name) => {
      if (!name) return;
      const trimmedName = name.trim();
      const isDuplicate = quickActions.some(a => a.name === trimmedName);
      if (isDuplicate) { addLog('error', '', `指令名称"${trimmedName}"已存在，请使用其他名称`); return; }
      const newAction = { id: Date.now(), name: trimmedName, topic: pubTopic, payload: pubMessage, qos: pubQoS, retain: pubRetain, pinned: false };
      updateData('actions', [...quickActions, newAction]);
    });
  };

  // Compute common actions
  const pinnedActions = (() => {
    const pinned = (quickActions || []).filter((a) => a && a.pinned);
    if (pinned.length <= 1) return pinned;
    const index = new Map((recentActionIds || []).map((id, i) => [id, i]));
    return [...pinned].sort((a, b) => {
      const ai = index.has(a.id) ? index.get(a.id) : Number.MAX_SAFE_INTEGER;
      const bi = index.has(b.id) ? index.get(b.id) : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });
  })();

  // 按最近使用排序；置顶指令只保证不被挤出（占用末位），不再永远排最前
  const commonActions = (() => {
    const all = Array.isArray(quickActions) ? quickActions : [];
    const byId = new Map(all.map((a) => [a.id, a]));
    const result = [];
    for (const id of (recentActionIds || [])) {
      const action = byId.get(id);
      if (action && !result.some((a) => a.id === action.id)) result.push(action);
      if (result.length >= maxCommonActions) break;
    }
    for (const pin of pinnedActions) {
      if (result.some((a) => a.id === pin.id)) continue;
      if (result.length < maxCommonActions) { result.push(pin); continue; }
      let idx = -1;
      for (let i = result.length - 1; i >= 0; i--) { if (!result[i].pinned) { idx = i; break; } }
      if (idx >= 0) result[idx] = pin;
    }
    return result;
  })();

  return { handleSaveAction, commonActions };
}
