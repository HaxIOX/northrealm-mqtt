console.log('[Preload] 开始加载 preload 脚本');
console.log('[Preload] Node 版本:', process.versions.node);
console.log('[Preload] Electron 版本:', process.versions.electron);
console.log('[Preload] Chrome 版本:', process.versions.chrome);

// 先标记桌面环境，防止被覆盖
window.__MQTT_PRO_DESKTOP__ = true;

let mqtt;
try {
  mqtt = require('mqtt');
  console.log('[Preload] ✅ MQTT 模块加载成功');
  try {
    // eslint-disable-next-line global-require
    window.__MQTT_PRO_MQTT_VERSION__ = require('mqtt/package.json').version;
  } catch {
    window.__MQTT_PRO_MQTT_VERSION__ = mqtt.VERSION || 'unknown';
  }
  console.log('[Preload] MQTT 版本:', window.__MQTT_PRO_MQTT_VERSION__);
  console.log('[Preload] MQTT.connect 类型:', typeof mqtt.connect);

  // 测试一下 mqtt.connect 函数
  if (typeof mqtt.connect === 'function') {
    console.log('[Preload] ✅ mqtt.connect 函数存在且可调用');
  } else {
    console.error('[Preload] ❌ mqtt.connect 不是函数！');
  }
} catch (e) {
  const errorMsg = String(e && e.message ? e.message : e);
  console.error('[Preload] ❌ MQTT 模块加载失败:', errorMsg);
  console.error('[Preload] 错误堆栈:', e.stack);
  window.__MQTT_PRO_DESKTOP_PRELOAD_ERROR__ = errorMsg;
}

// 如果mqtt加载成功，将其暴露到window对象
if (mqtt) {
  // 使用 Object.defineProperty 防止被覆盖
  Object.defineProperty(window, 'mqtt', {
    value: mqtt,
    writable: false,  // 不可写，防止被CDN版本覆盖
    configurable: false,  // 不可删除或重新配置
    enumerable: true
  });

  // 标记这是Node版本
  window.__MQTT_PRO_MQTT_SOURCE__ = 'native';

  console.log('[Preload] ✅ MQTT 已注入到 window.mqtt（已锁定，防止覆盖）');
  console.log('[Preload] window.mqtt.connect 类型:', typeof window.mqtt.connect);
} else {
  console.warn('[Preload] ⚠️  MQTT 未能注入，将使用 CDN 版本');
  window.__MQTT_PRO_MQTT_SOURCE__ = 'missing';
}

console.log('[Preload] ✅ preload 脚本加载完成');
