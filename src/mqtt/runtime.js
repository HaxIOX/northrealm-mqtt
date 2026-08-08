export function detectRuntime() {
  const userAgent =
    typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string' ? navigator.userAgent : '';
  const isElectronUserAgent = userAgent.includes('Electron');

  const hasWindow = typeof window !== 'undefined';
  const hasPreload = hasWindow && window.__MQTT_PRO_DESKTOP__ === true;
  const hasMainInfo = hasWindow && !!window.__MQTT_PRO_MAIN_INFO__;
  const mqttSource = hasWindow ? window.__MQTT_PRO_MQTT_SOURCE__ : undefined;

  const isDesktopShell = hasWindow && (hasPreload || hasMainInfo || isElectronUserAgent);
  const isNativeMobile = hasWindow
    && !!window.Capacitor
    && typeof window.Capacitor.isNativePlatform === 'function'
    && window.Capacitor.isNativePlatform() === true;

  return {
    isElectronUserAgent,
    hasPreload,
    hasMainInfo,
    isDesktopShell,
    isNativeMobile,
    mqttSource,
  };
}

export function isDesktopTcpCapable() {
  if (typeof window === 'undefined') return false;
  const { isDesktopShell, hasPreload } = detectRuntime();
  const sourceNow = window.__MQTT_PRO_MQTT_SOURCE__;

  return (
    isDesktopShell &&
    hasPreload &&
    sourceNow === 'native' &&
    typeof window.mqtt?.connect === 'function'
  );
}

export function isTcpCapable() {
  if (typeof window === 'undefined') return false;
  const { isNativeMobile } = detectRuntime();
  const sourceNow = window.__MQTT_PRO_MQTT_SOURCE__;

  if (isNativeMobile && sourceNow === 'native-mobile') {
    return typeof window.mqtt?.connect === 'function';
  }

  return isDesktopTcpCapable();
}
