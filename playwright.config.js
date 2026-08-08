import path from 'node:path';
import { env } from 'node:process';
import { defineConfig, devices } from '@playwright/test';

const cachedChromium = env.LOCALAPPDATA
  ? path.join(env.LOCALAPPDATA, 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
  : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    ...devices['Pixel 5'],
    baseURL: 'http://127.0.0.1:5173',
    browserName: 'chromium',
    colorScheme: 'dark',
    launchOptions: cachedChromium ? { executablePath: cachedChromium } : {},
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: 'npm.cmd run dev -- --host 127.0.0.1',
    reuseExistingServer: true,
    url: 'http://127.0.0.1:5173',
  },
});
