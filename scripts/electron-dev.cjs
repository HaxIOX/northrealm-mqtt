const { spawn } = require('child_process');

const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const TIMEOUT_MS = 60_000;
const POLL_MS = 250;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  await waitForDevServer();

  const child = spawn(
    'electron',
    ['electron/main.cjs'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: DEV_URL,
      },
    }
  );

  child.on('exit', (code) => process.exit(code ?? 0));
})();

