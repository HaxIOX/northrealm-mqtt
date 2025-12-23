/* eslint-disable global-require */

console.log('[Preload] 开始加载 preload 脚本');
console.log('[Preload] Node 版本:', process.versions.node);
console.log('[Preload] Electron 版本:', process.versions.electron);
console.log('[Preload] Chrome 版本:', process.versions.chrome);
console.log('[Preload] resourcesPath:', process.resourcesPath);

const canRequire = typeof require === 'function';

// 标记桌面环境：必须写到 window（渲染层读取的来源）
try {
  if (typeof window !== 'undefined') window.__MQTT_PRO_DESKTOP__ = true;
} catch {
  // ignore
}
globalThis.__MQTT_PRO_DESKTOP__ = true;

// 如果 preload 运行在受限沙箱环境，require 可能不可用（无法加载 mqtt / fs 等 Node 模块）
if (!canRequire) {
  const msg = 'preload 运行在受限环境（require 不可用）。请在 BrowserWindow.webPreferences 设置 sandbox:false';
  try {
    if (typeof window !== 'undefined') window.__MQTT_PRO_DESKTOP_PRELOAD_ERROR__ = msg;
  } catch {
    // ignore
  }
  globalThis.__MQTT_PRO_DESKTOP_PRELOAD_ERROR__ = msg;
  try {
    if (typeof window !== 'undefined') window.__MQTT_PRO_MQTT_SOURCE__ = 'missing';
  } catch {
    // ignore
  }
  globalThis.__MQTT_PRO_MQTT_SOURCE__ = 'missing';
  console.warn('[Preload] ⚠️', msg);
  console.log('[Preload] ✅ preload 脚本加载完成（受限模式）');
  // eslint-disable-next-line no-useless-return
  return;
}

let logPreload = () => {};
try {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const diagDir = path.join(os.tmpdir(), 'mqtt-pro-diagnostics');
  const preloadLogPath = path.join(diagDir, 'preload.log');
  logPreload = (message, extra) => {
    try {
      fs.mkdirSync(diagDir, { recursive: true });
      const line = `[${new Date().toISOString()}] ${message}${extra !== undefined ? ` ${JSON.stringify(extra)}` : ''}\n`;
      fs.appendFileSync(preloadLogPath, line, 'utf8');
    } catch {
      // ignore
    }
  };
  logPreload('preload start', { resourcesPath: process.resourcesPath, versions: process.versions });
} catch {
  // ignore
}

try {
  const ver = require('../package.json').version;
  try {
    if (typeof window !== 'undefined') window.__MQTT_PRO_APP_VERSION__ = ver;
  } catch {
    // ignore
  }
  globalThis.__MQTT_PRO_APP_VERSION__ = ver;
} catch {
  try {
    if (typeof window !== 'undefined') window.__MQTT_PRO_APP_VERSION__ = 'unknown';
  } catch {
    // ignore
  }
  globalThis.__MQTT_PRO_APP_VERSION__ = 'unknown';
}

try {
  if (typeof window !== 'undefined') {
    window.__MQTT_PRO_PRELOAD_DIR__ = __dirname;
    window.__MQTT_PRO_CWD__ = process.cwd();
    window.__MQTT_PRO_MODULE_PATHS__ = module.paths;
    window.__MQTT_PRO_VERSIONS__ = process.versions;
    window.__MQTT_PRO_RESOURCES_PATH__ = process.resourcesPath;
  }
} catch {
  // ignore
}
globalThis.__MQTT_PRO_PRELOAD_DIR__ = __dirname;
globalThis.__MQTT_PRO_CWD__ = process.cwd();
globalThis.__MQTT_PRO_MODULE_PATHS__ = module.paths;
globalThis.__MQTT_PRO_VERSIONS__ = process.versions;
globalThis.__MQTT_PRO_RESOURCES_PATH__ = process.resourcesPath;

let mqtt;
try {
  const path = require('path');
  const tried = [];
  const errors = [];

  const tryRequire = (label, reqPath) => {
    tried.push(label);
    try {
      // eslint-disable-next-line import/no-dynamic-require
      return require(reqPath);
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      errors.push({ label, msg });
      return null;
    }
  };

  mqtt = tryRequire("require('mqtt')", 'mqtt');

  // 兜底：部分安装环境 module.paths 可能缺少 resources/app/node_modules
  if (!mqtt && process.resourcesPath) {
    const appNodeModules = path.join(process.resourcesPath, 'app', 'node_modules');
    if (!module.paths.includes(appNodeModules)) module.paths.push(appNodeModules);
    mqtt = tryRequire('require(resources/app/node_modules/mqtt)', path.join(appNodeModules, 'mqtt'));
  }

  try {
    if (typeof window !== 'undefined') window.__MQTT_PRO_MQTT_REQUIRE_TRIED__ = tried;
    if (typeof window !== 'undefined' && !mqtt && errors.length) window.__MQTT_PRO_MQTT_REQUIRE_ERRORS__ = errors;
  } catch {
    // ignore
  }
  globalThis.__MQTT_PRO_MQTT_REQUIRE_TRIED__ = tried;
  if (!mqtt && errors.length) globalThis.__MQTT_PRO_MQTT_REQUIRE_ERRORS__ = errors;

  if (!mqtt) {
    throw new Error(errors.map((e) => `${e.label}: ${e.msg}`).join(' | ') || 'unknown preload mqtt require error');
  }

  console.log('[Preload] ✅ MQTT 模块加载成功');
  let mqttVersion = 'unknown';
  try {
    mqttVersion = require('mqtt/package.json').version;
  } catch {
    mqttVersion = mqtt.VERSION || 'unknown';
  }
  try {
    if (typeof window !== 'undefined') window.__MQTT_PRO_MQTT_VERSION__ = mqttVersion;
  } catch {
    // ignore
  }
  globalThis.__MQTT_PRO_MQTT_VERSION__ = mqttVersion;
  console.log('[Preload] MQTT 版本:', mqttVersion);
  console.log('[Preload] MQTT.connect 类型:', typeof mqtt.connect);
} catch (e) {
  const errorMsg = String(e && e.message ? e.message : e);
  console.error('[Preload] ❌ MQTT 模块加载失败:', errorMsg);
  console.error('[Preload] 错误堆栈:', e.stack);
  logPreload('mqtt require failed', { error: errorMsg, stack: String(e?.stack || '') });
  try {
    if (typeof window !== 'undefined') window.__MQTT_PRO_DESKTOP_PRELOAD_ERROR__ = errorMsg;
  } catch {
    // ignore
  }
  globalThis.__MQTT_PRO_DESKTOP_PRELOAD_ERROR__ = errorMsg;
  try {
    if (typeof window !== 'undefined') window.__MQTT_PRO_MQTT_RESOLVE_PATH__ = null;
  } catch {
    // ignore
  }
  globalThis.__MQTT_PRO_MQTT_RESOLVE_PATH__ = null;
}

if (mqtt) {
  try {
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'mqtt', {
        value: mqtt,
        writable: false,
        configurable: false,
        enumerable: true,
      });
    }
  } catch {
    // ignore
  }

  Object.defineProperty(globalThis, 'mqtt', {
    value: mqtt,
    writable: false,
    configurable: false,
    enumerable: true,
  });

  try {
    if (typeof window !== 'undefined') window.__MQTT_PRO_MQTT_SOURCE__ = 'native';
  } catch {
    // ignore
  }
  globalThis.__MQTT_PRO_MQTT_SOURCE__ = 'native';

  try {
    const rp = require.resolve('mqtt');
    try {
      if (typeof window !== 'undefined') window.__MQTT_PRO_MQTT_RESOLVE_PATH__ = rp;
    } catch {
      // ignore
    }
    globalThis.__MQTT_PRO_MQTT_RESOLVE_PATH__ = rp;
  } catch {
    try {
      if (typeof window !== 'undefined') window.__MQTT_PRO_MQTT_RESOLVE_PATH__ = null;
    } catch {
      // ignore
    }
    globalThis.__MQTT_PRO_MQTT_RESOLVE_PATH__ = null;
  }

  console.log('[Preload] ✅ MQTT 已注入到 window.mqtt（已锁定）');
  logPreload('mqtt injected', { resolve: globalThis.__MQTT_PRO_MQTT_RESOLVE_PATH__, version: globalThis.__MQTT_PRO_MQTT_VERSION__ });
} else {
  try {
    if (typeof window !== 'undefined') window.__MQTT_PRO_MQTT_SOURCE__ = 'missing';
  } catch {
    // ignore
  }
  globalThis.__MQTT_PRO_MQTT_SOURCE__ = 'missing';
}

console.log('[Preload] ✅ preload 脚本加载完成');
logPreload('preload end');
