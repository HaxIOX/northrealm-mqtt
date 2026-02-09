export function detectRuntime() {
  const userAgent =
    typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string' ? navigator.userAgent : '';
  const isElectronUserAgent = userAgent.includes('Electron');

  const hasWindow = typeof window !== 'undefined';
  const hasPreload = hasWindow && window.__MQTT_PRO_DESKTOP__ === true;
  const hasMainInfo = hasWindow && !!window.__MQTT_PRO_MAIN_INFO__;
  const mqttSource = hasWindow ? window.__MQTT_PRO_MQTT_SOURCE__ : undefined;

  const isDesktopShell = hasWindow && (hasPreload || hasMainInfo || isElectronUserAgent);
  const isCapacitorNative =
    hasWindow &&
    !!window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform() === true;

  return {
    isElectronUserAgent,
    hasPreload,
    hasMainInfo,
    isDesktopShell,
    isCapacitorNative,
    mqttSource,
  };
}

export function isDesktopTcpCapable() {
  if (typeof window === 'undefined') return false;
  const { isDesktopShell, hasPreload, isCapacitorNative } = detectRuntime();
  const sourceNow = window.__MQTT_PRO_MQTT_SOURCE__;
  const hasConnect = typeof window.mqtt?.connect === 'function';

  // Desktop: preload-injected Node mqtt (supports mqtt://).
  const desktopTcpCapable = isDesktopShell && hasPreload && sourceNow === 'native' && hasConnect;

  // Mobile: Capacitor native plugin bridge (supports mqtt:// and mqtts://).
  // Prefer checking plugin availability when possible, so we don't mis-detect broken APKs.
  const mobilePluginOk =
    typeof window.Capacitor?.isPluginAvailable === 'function'
      ? window.Capacitor.isPluginAvailable('NativeMqtt')
      : true;
  const mobileTcpCapable = isCapacitorNative && mobilePluginOk;

  return desktopTcpCapable || mobileTcpCapable;
}
