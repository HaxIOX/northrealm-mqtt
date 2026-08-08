import { useEffect } from 'react';

export function useMqttSdkLoader({ isDesktopShell, setSdkReady }) {
  useEffect(() => {
    let canceled = false;

    const normalizeMqttModule = (mod) => {
      const candidate = mod?.default ?? mod;
      if (candidate && typeof candidate.connect === 'function') return candidate;
      if (mod && typeof mod.connect === 'function') return mod;
      return null;
    };

    const applyMqttLib = (mqttLib, sourceLabel) => {
      if (!mqttLib || typeof mqttLib.connect !== 'function') return false;

      try {
        if (!window.mqtt) window.mqtt = mqttLib;
      } catch {
        /* ignore */
      }

      try {
        if (window.__MQTT_PRO_MQTT_SOURCE__ !== 'native') window.__MQTT_PRO_MQTT_SOURCE__ = sourceLabel;
        if (!window.__MQTT_PRO_MQTT_VERSION__ && mqttLib.VERSION) window.__MQTT_PRO_MQTT_VERSION__ = mqttLib.VERSION;
      } catch {
        /* ignore */
      }

      setSdkReady(true);
      return true;
    };

    const checkMqtt = () => {
      const hasConnect = !!window.mqtt && typeof window.mqtt.connect === 'function';
      if (!hasConnect) return false;
      setSdkReady(true);
      return true;
    };

    const loadBundledMqtt = async () => {
      try {
        const mod = await import('mqtt');
        if (canceled) return;
        const mqttLib = normalizeMqttModule(mod);
        if (!mqttLib) throw new Error('Bundled mqtt module has no connect()');
        applyMqttLib(mqttLib, 'bundled');
      } catch (error) {
        console.error('[App] 内置 MQTT SDK 加载失败:', error);
        alert('MQTT 库加载失败（内置模块）。请刷新重试或检查构建产物是否完整。');
      }
    };

    const isNativeMobile = typeof window !== 'undefined'
      && !!window.Capacitor
      && typeof window.Capacitor.isNativePlatform === 'function'
      && window.Capacitor.isNativePlatform() === true;

    const loadNativeMobileMqtt = async () => {
      try {
        const mod = await import('../mqtt/nativeMobileMqtt.js');
        if (canceled) return;
        const mqttLib = mod?.createMobileMqttLib?.();
        if (!mqttLib || typeof mqttLib.connect !== 'function') throw new Error('Mobile mqtt shim has no connect()');
        applyMqttLib(mqttLib, 'native-mobile');
      } catch (error) {
        console.error('[App] Mobile native MQTT shim load failed:', error);
        loadBundledMqtt();
      }
    };

    if (checkMqtt()) return () => { canceled = true; };

    if (isNativeMobile) {
      loadNativeMobileMqtt();
      return () => { canceled = true; };
    }

    if (isDesktopShell) {
      const waitTimer = setTimeout(() => {
        if (checkMqtt()) return;
        console.warn('[App] ⚠️  Preload 未检测到，降级使用内置浏览器版 MQTT');
        if (window.__MQTT_PRO_DESKTOP__ !== true && !window.__MQTT_PRO_DESKTOP_PRELOAD_ERROR__) {
          const mainInfo = window.__MQTT_PRO_MAIN_INFO__ ? ` main=${JSON.stringify(window.__MQTT_PRO_MAIN_INFO__)}` : '';
          window.__MQTT_PRO_DESKTOP_PRELOAD_ERROR__ = `preload 未检测到${mainInfo}`;
        }
        loadBundledMqtt();
      }, 1000);

      return () => {
        canceled = true;
        clearTimeout(waitTimer);
      };
    }

    loadBundledMqtt();
    return () => { canceled = true; };
  }, [isDesktopShell, setSdkReady]);
}
