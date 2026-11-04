import { useAppData } from '../contexts/AppDataContext.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import { useMqtt } from '../contexts/MqttContext.jsx';

// 连接配置的保存 / 加载 / 删除。手机端 ConnectionPanel 与桌面端 DesktopSidebar 共用。
export function useSavedConfigActions() {
  const { openInputModal, openConfirmModal } = useModal();
  const { isDesktopShell, connection, setConnection, addLog, setLogViewMode } = useMqtt();
  const { savedConfigs, updateData } = useAppData();

  const handleSaveConfig = () => {
    openInputModal("配置名称", connection.name || "新配置", (name) => {
      if (!name) return;
      const newConfig = { ...connection, name };
      setConnection(newConfig);
      const newConfigs = [...savedConfigs.filter(c => c.name !== name), newConfig];
      updateData('configs', newConfigs);
    });
  };

  const handleLoadConfig = (name) => {
    const config = savedConfigs.find(c => c.name === name);
    if (!config) return;
    let correctedConfig = { ...config, clientId: connection.clientId };
    const port = Number(config.port);
    const protocol = config.protocol;

    if ((protocol === 'ws' || protocol === 'wss') && (port === 1883 || port === 8883)) {
      if (isDesktopShell) {
        correctedConfig.protocol = port === 1883 ? 'mqtt' : 'mqtts';
        addLog('system', '', `⚠️ 已自动修正协议：${protocol}://${port} → ${correctedConfig.protocol}://${port}`);
      } else {
        correctedConfig.port = protocol === 'wss' ? 8084 : 8083;
        addLog('system', '', `⚠️ 已自动修正端口：${protocol}://${port} → ${protocol}://${correctedConfig.port}`);
        addLog('system', '', `提示：浏览器不支持 MQTT TCP 端口 (1883/8883)，已改用 WebSocket 端口`);
      }
    }
    if ((protocol === 'mqtt' || protocol === 'mqtts') && (port === 8083 || port === 8084)) {
      if (isDesktopShell) {
        correctedConfig.port = protocol === 'mqtts' ? 8883 : 1883;
        addLog('system', '', `⚠️ 已自动修正端口：${protocol}://${port} → ${protocol}://${correctedConfig.port}`);
      } else {
        correctedConfig.protocol = port === 8084 ? 'wss' : 'ws';
        addLog('system', '', `⚠️ 已自动修正协议：${protocol}://${port} → ${correctedConfig.protocol}://${port}`);
        addLog('system', '', `提示：浏览器不支持 MQTT TCP 协议，已改用 WebSocket`);
      }
    }
    setLogViewMode(correctedConfig.logViewMode === 'hex' ? 'hex' : 'text');
    setConnection(correctedConfig);
  };

  const handleDeleteConfig = (name = connection.name) => {
    if (!name) return;
    openConfirmModal(`确定删除配置 "${name}" 吗?`, () => {
      const newConfigs = savedConfigs.filter(c => c.name !== name);
      updateData('configs', newConfigs);
      if (connection.name === name) setConnection({ ...connection, name: '' });
    }, { confirmText: '确定删除', confirmVariant: 'danger' });
  };

  return { handleSaveConfig, handleLoadConfig, handleDeleteConfig };
}
