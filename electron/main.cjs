const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIAG_DIR = path.join(os.tmpdir(), 'mqtt-pro-diagnostics');
const MAIN_LOG_PATH = path.join(DIAG_DIR, 'main.log');

const safeStringify = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return '"[unserializable]"';
  }
};

const logMain = (message, extra) => {
  try {
    fs.mkdirSync(DIAG_DIR, { recursive: true });
    const line = `[${new Date().toISOString()}] ${message}${extra !== undefined ? ` ${safeStringify(extra)}` : ''}\n`;
    fs.appendFileSync(MAIN_LOG_PATH, line, 'utf8');
  } catch {
    // ignore
  }
};

const createWindow = async () => {
  const preloadPath = path.join(__dirname, 'preload.cjs');
  console.log('[Main] preloadPath:', preloadPath, 'exists=', fs.existsSync(preloadPath));
  logMain('createWindow', { preloadPath, preloadExists: fs.existsSync(preloadPath) });

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: false,
      sandbox: false,
    },
  });

  const mainInfo = {
    appPath: app.getAppPath(),
    execPath: process.execPath,
    resourcesPath: process.resourcesPath,
    preloadPath,
    preloadExists: fs.existsSync(preloadPath),
    webPreferences: {
      nodeIntegration: mainWindow.webContents?.getLastWebPreferences?.()?.nodeIntegration,
      contextIsolation: mainWindow.webContents?.getLastWebPreferences?.()?.contextIsolation,
      sandbox: mainWindow.webContents?.getLastWebPreferences?.()?.sandbox,
    },
    versions: process.versions,
  };
  logMain('mainInfo', mainInfo);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    console.log('开发模式：加载 Vite 开发服务器', devServerUrl);
    await mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    console.log('生产模式：加载构建后的文件');
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Electron 内置事件：preload 加载失败时会触发（如路径错/语法错）
  mainWindow.webContents.on('preload-error', (event, preload, error) => {
    logMain('preload-error', { preload, error: String(error?.message || error) });
  });
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logMain('did-fail-load', { errorCode, errorDescription, validatedURL });
  });
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logMain('render-process-gone', details);
  });

  // 即使 preload 没跑，也能在渲染层看到“主进程到底用的什么配置/路径”
  mainWindow.webContents.on('did-finish-load', async () => {
    try {
      await mainWindow.webContents.executeJavaScript(
        `window.__MQTT_PRO_MAIN_INFO__ = ${JSON.stringify(mainInfo)};`,
        true,
      );
      console.log('[Main] mainInfo injected');
      logMain('mainInfo injected');
    } catch (e) {
      console.error('[Main] inject mainInfo failed:', e);
      logMain('inject mainInfo failed', { error: String(e?.message || e) });
    }
  });

  // 监听渲染进程的console输出
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message}`);
  });
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
