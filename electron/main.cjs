const { app, BrowserWindow, screen } = require('electron');
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

let mainWindow = null;

// 窗口最小尺寸，同时也是首次启动（没有保存过窗口状态）时的默认尺寸
const MIN_WIDTH = 1000;
const MIN_HEIGHT = 650;
const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

// 读取上次窗口状态；文件缺失/损坏时回退默认，屏幕外的坐标丢弃（只保留尺寸）
function loadWindowState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const s = JSON.parse(raw);
    if (typeof s.width !== 'number' || typeof s.height !== 'number') return {};
    const w = Math.max(s.width, MIN_WIDTH);
    const h = Math.max(s.height, MIN_HEIGHT);
    if (typeof s.x === 'number' && typeof s.y === 'number') {
      const visible = screen.getAllDisplays().some((d) => {
        const a = d.workArea;
        return s.x < a.x + a.width && s.x + w > a.x && s.y < a.y + a.height && s.y + h > a.y;
      });
      if (visible) return { width: w, height: h, x: s.x, y: s.y };
      return { width: w, height: h };
    }
    return { width: w, height: h };
  } catch {
    return {};
  }
}

function saveWindowState(win) {
  try {
    const b = win.getBounds();
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(b), 'utf8');
  } catch {
    // ignore
  }
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  const createWindow = async () => {
    const preloadPath = path.join(__dirname, 'preload.cjs');
    console.log('[Main] preloadPath:', preloadPath, 'exists=', fs.existsSync(preloadPath));
    logMain('createWindow', { preloadPath, preloadExists: fs.existsSync(preloadPath) });

    const state = loadWindowState();
    const winIcon = path.join(__dirname, '..', 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

    mainWindow = new BrowserWindow({
      ...state,
      width: state.width ?? MIN_WIDTH,
      height: state.height ?? MIN_HEIGHT,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      autoHideMenuBar: true,
      icon: fs.existsSync(winIcon) ? winIcon : undefined,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: false,
        sandbox: false,
      },
    });
    mainWindow.on('close', () => saveWindowState(mainWindow));

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
}
