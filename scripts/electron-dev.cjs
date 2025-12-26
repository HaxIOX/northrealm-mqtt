const { spawn } = require('child_process');

const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const TIMEOUT_MS = 60_000;
const POLL_MS = 250;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function resolveElectronBinary() {
  try {
    // In a Node.js process, `require('electron')` returns the path to the Electron binary.
    // This is more reliable than spawning `electron` from PATH (Windows may only have electron.cmd).
    const electronPath = require('electron');
    if (typeof electronPath === 'string' && electronPath.length > 0) return electronPath;
    throw new Error('Unexpected electron export');
  } catch (e) {
    const msg = String(e?.message || e);
    throw new Error(
      `Electron binary not found. Please run \`npm ci\` first.\nDetails: ${msg}`,
    );
  }
}

function checkDesktopMqttInstalled() {
  try {
    require.resolve('mqtt');
    return true;
  } catch {
    // eslint-disable-next-line no-console
    console.warn('⚠️ 依赖缺失: 未安装 mqtt（桌面端直连 1883/8883 将不可用）');
    // eslint-disable-next-line no-console
    console.warn('   解决: 在项目根目录执行 `npm install` 后再运行 `npm run desktop:dev`');
    return false;
  }
}

async function waitForDevServer() {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await fetch(DEV_URL, { method: 'GET' });
      if (res.ok) return;
    } catch {
      // ignore
    }

    if (Date.now() - start > TIMEOUT_MS) {
      throw new Error(`Timed out waiting for dev server at ${DEV_URL}`);
    }
    await sleep(POLL_MS);
  }
}

(async () => {
  const hasNativeMqtt = checkDesktopMqttInstalled();
  await waitForDevServer();

  const electronBin = resolveElectronBinary();
  const child = spawn(
    electronBin,
    ['electron/main.cjs'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: DEV_URL,
        MQTT_PRO_NATIVE_MQTT_OK: hasNativeMqtt ? '1' : '0',
      },
    }
  );

  child.on('exit', (code) => process.exit(code ?? 0));
})();
