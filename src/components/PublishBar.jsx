import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useMqtt } from '../contexts/MqttContext.jsx';
import { useAppData } from '../contexts/AppDataContext.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import CommonActionsBar from './publish-bar/CommonActionsBar.jsx';
import PublishComposer from './publish-bar/PublishComposer.jsx';
import PublishToolbar from './publish-bar/PublishToolbar.jsx';
import TopicInputField from './publish-bar/TopicInputField.jsx';
import { useQuickActionRunner } from './quick-actions/useQuickActionRunner.js';

export default function PublishBar() {
  const { theme, t } = useTheme();
  const { openInputModal } = useModal();
  const {
    client, pubTopic, setPubTopic, pubMessage, setPubMessage,
    pubQoS, setPubQoS, pubRetain, setPubRetain,
    timerEnabled, timerIntervalInput, setTimerIntervalInput,
    syncTimerIntervalFromInput, toggleTimer,
    handlePublish, openPublishEditor,
    setShowQuickActionsPanel, setShowMulticastPanel,
    pubTopicFocusTrigger, pubTopicCursorPos,
    maxCommonActions, commonActionsContainerRef,
    addLog,
    logs,
  } = useMqtt();
  const {
    quickActions, recentActionIds,
    getSelectedMulticastTopics, updateData,
  } = useAppData();
  const { sendQuickAction } = useQuickActionRunner();

  const pubTopicRef = useRef(null);
  const [topicFocused, setTopicFocused] = useState(false);

  const sessionTopics = useMemo(() => {
    const set = new Set();
    for (const log of (logs || [])) { if (log.topic) set.add(log.topic); }
    return Array.from(set);
  }, [logs]);

  const topicSuggestions = useMemo(() => {
    if (!topicFocused) return [];
    if (!pubTopic) return sessionTopics.slice(0, 15);
    const pParts = pubTopic.toLowerCase().split('/');
    return sessionTopics.filter((topic) => {
      if (topic === pubTopic) return false;
      const tParts = topic.toLowerCase().split('/');
      if (tParts.length === pParts.length) {
        return pParts.every((p, i) => p === '' || tParts[i].includes(p));
      }
      return topic.toLowerCase().includes(pubTopic.toLowerCase());
    });
  }, [topicFocused, pubTopic, sessionTopics]);

  useEffect(() => {
    if (pubTopicFocusTrigger > 0 && pubTopicRef.current) {
      pubTopicRef.current.focus();
      if (pubTopicCursorPos >= 0) {
        pubTopicRef.current.setSelectionRange(pubTopicCursorPos, pubTopicCursorPos);
      }
    }
  }, [pubTopicFocusTrigger, pubTopicCursorPos]);

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

  const commonActions = (() => {
    const all = Array.isArray(quickActions) ? quickActions : [];
    const byId = new Map(all.map((a) => [a.id, a]));
    const chosen = [];
    for (const action of pinnedActions) { if (action && chosen.length < maxCommonActions) chosen.push(action); }
    if (chosen.length < maxCommonActions) {
      for (const id of (recentActionIds || [])) {
        const action = byId.get(id);
        if (!action || chosen.some((a) => a.id === action.id)) continue;
        chosen.push(action);
        if (chosen.length >= maxCommonActions) break;
      }
    }
    return chosen.slice(0, maxCommonActions);
  })();

  return (
    <div
      className={`mobile-publish-bar shrink-0 overflow-hidden border-t ${t.border} ${t.bgSecondary} backdrop-blur-xl ${theme === 'light' ? 'shadow-[0_-4px_20px_rgba(0,0,0,0.05)]' : 'shadow-[0_-4px_20px_rgba(0,0,0,0.3)]'} z-10 transition-colors duration-300`}
    >
      <div className="p-2.5 sm:p-4 h-full min-h-0 flex flex-col gap-2 sm:gap-3">
        <PublishToolbar
          onOpenQuickActions={() => setShowQuickActionsPanel(true)}
          onSaveAction={handleSaveAction}
          onSyncTimerBlur={syncTimerIntervalFromInput}
          onTimerInputChange={(e) => {
            const value = e.target.value;
            if (value === '') return setTimerIntervalInput(value);
            for (let i = 0; i < value.length; i += 1) {
              if (value[i] < '0' || value[i] > '9') return;
            }
            setTimerIntervalInput(value);
          }}
          pubQoS={pubQoS}
          pubRetain={pubRetain}
          quickActionsCount={quickActions.length}
          setPubQoS={setPubQoS}
          setPubRetain={setPubRetain}
          theme={theme}
          timerEnabled={timerEnabled}
          timerIntervalInput={timerIntervalInput}
          toggleTimer={toggleTimer}
          t={t}
          topicInput={(
            <TopicInputField
              pubTopic={pubTopic}
              pubTopicRef={pubTopicRef}
              setPubTopic={setPubTopic}
              setTopicFocused={setTopicFocused}
              t={t}
              topicSuggestions={topicSuggestions}
            />
          )}
        />

        <CommonActionsBar
          commonActions={commonActions}
          commonActionsContainerRef={commonActionsContainerRef}
          maxCommonActions={maxCommonActions}
          onAddAction={() => setShowQuickActionsPanel(true)}
          onSendQuickAction={(action) => sendQuickAction(action, { openPanelForTemplate: true })}
          t={t}
          theme={theme}
        />

        <PublishComposer
          client={client}
          getSelectedMulticastTopics={getSelectedMulticastTopics}
          handlePublish={handlePublish}
          openPublishEditor={openPublishEditor}
          pubMessage={pubMessage}
          setPubMessage={setPubMessage}
          setShowMulticastPanel={setShowMulticastPanel}
          t={t}
        />
      </div>
    </div>
  );
}
