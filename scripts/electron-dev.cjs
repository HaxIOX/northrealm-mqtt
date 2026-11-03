const { spawn } = require('child_process');

const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const TIMEOUT_MS = 60_000;
const POLL_MS = 250;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function resolveElectronBinary() {
  try {
    const electronPath = require('electron');
    if (typeof electronPath === 'string' && electronPath.length > 0) return electronPath;
    throw new Error('Unexpected electron export');
  } catch (error) {
    const message = String(error?.message || error);
    throw new Error(
      `Electron binary not found. Please run \`npm ci\` first.\nDetails: ${message}`,
    );
  }
}

function checkDesktopMqttInstalled() {
  try {
    require.resolve('mqtt');
    return true;
  } catch {
    console.warn('Desktop native MQTT support is unavailable because the `mqtt` package is missing.');
    console.warn('Run `npm install` or `npm ci`, then retry `npm run desktop:dev`.');
    return false;
  }
}

async function waitForDevServer() {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(DEV_URL, { method: 'GET' });
      if (res.ok) return;
    } catch {
      // ignore and retry
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
    },
  );

  child.on('exit', (code) => process.exit(code ?? 0));
})();
