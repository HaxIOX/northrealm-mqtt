import { useAppData } from '../../contexts/AppDataContext.jsx';
import { useMqtt } from '../../contexts/MqttContext.jsx';
import {
  isTemplateAction,
  parseTopicList,
  resolveTemplate,
} from '../../utils/mqtt-helpers.js';

export function useQuickActionRunner() {
  const {
    client,
    addLog,
    shouldDropDuplicateManualPublish,
    setPendingTemplateAction,
    setShowQuickActionsPanel,
    setShowMulticastPanel,
    setPubTopic,
    setPubMessage,
    setPubQoS,
    setPubRetain,
    setPubTopicFocusTrigger,
    setPubTopicCursorPos,
  } = useMqtt();
  const { recordRecentAction, getSelectedMulticastTopics } = useAppData();

  const publishAction = (action) => {
    if (!client || !client.connected) {
      addLog('error', '', '请先连接服务器');
      return;
    }

    const topics = parseTopicList(action?.topic);
    if (topics.length === 0) {
      addLog('error', '', '指令 Topic 为空');
      return;
    }

    const topicKey = topics.length === 1 ? topics[0] : topics.join('|');
    if (shouldDropDuplicateManualPublish(topicKey, action.payload, action.qos, action.retain)) {
      return;
    }

    if (topics.length > 1) {
      addLog('system', '', `群发指令: ${action.name}（${topics.length} 个 Topic）`);
    }

    topics.forEach((topic) => {
      client.publish(topic, action.payload, { qos: action.qos, retain: action.retain }, (err) => {
        if (err) {
          addLog('error', topic, `指令 "${action.name}" 发送失败: ${err.message}`);
          return;
        }

        addLog('sent', topic, action.payload, `指令: ${action.name}`);
      });
    });
  };

  const sendQuickAction = (action, options = {}) => {
    const { openPanelForTemplate = false, setTemplateFillAction, onAfterSend } = options;

    recordRecentAction(action.id);
    if (isTemplateAction(action)) {
      if (typeof setTemplateFillAction === 'function') {
        setTemplateFillAction(action);
      } else {
        setPendingTemplateAction(action);
        if (openPanelForTemplate) {
          setShowQuickActionsPanel(true);
        }
      }
      return;
    }

    publishAction(action);
    onAfterSend?.();
  };

  const submitTemplateAction = (action, vars, options = {}) => {
    if (!action) return;

    const resolved = {
      ...action,
      topic: resolveTemplate(action.topic, vars),
      payload: resolveTemplate(action.payload, vars),
    };

    publishAction(resolved);
    options.onAfterSend?.();
  };

  const sendToSelectedMulticastTargets = (action, options = {}) => {
    const topics = getSelectedMulticastTopics();
    if (topics.length === 0) {
      if (typeof options.onNoTargets === 'function') {
        options.onNoTargets();
      } else {
        setShowMulticastPanel(true);
      }
      return;
    }

    recordRecentAction(action.id);
    if (!client?.connected) {
      addLog('error', '', '请先连接服务器');
      return;
    }

    addLog('system', '', `${action.name}（${topics.length} 个目标）`);
    topics.forEach((topic) => {
      client.publish(topic, action.payload, { qos: action.qos ?? 0, retain: !!action.retain }, (err) => {
        if (err) {
          addLog('error', topic, `${action.name} 发送失败: ${err.message}`);
          return;
        }

        addLog('sent', topic, action.payload, `指令: ${action.name}`);
      });
    });
  };

  const loadActionIntoPublishForm = (action) => {
    if (isTemplateAction(action)) {
      const cursorPos = (action.topic || '').search(/\{\{\w+\}\}/);
      setPubTopic(resolveTemplate(action.topic, {}));
      setPubMessage(resolveTemplate(action.payload, {}));
      setPubQoS(action.qos);
      setPubRetain(action.retain);
      setPubTopicCursorPos(cursorPos >= 0 ? cursorPos : 0);
      setPubTopicFocusTrigger((count) => count + 1);
      return;
    }

    setPubTopic(action.topic);
    setPubMessage(action.payload);
    setPubQoS(action.qos);
    setPubRetain(action.retain);
  };

  return {
    loadActionIntoPublishForm,
    publishAction,
    sendQuickAction,
    sendToSelectedMulticastTargets,
    submitTemplateAction,
  };
}
