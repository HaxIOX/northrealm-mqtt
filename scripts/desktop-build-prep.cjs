const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = new Set(process.argv.slice(2));
const shouldKill = args.has('--kill');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getProductExeName() {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const productName = pkg?.build?.productName || 'ElectronApp';
    return productName.endsWith('.exe') ? productName : `${productName}.exe`;
  } catch {
    return 'Northrealm.exe';
  }
}

function isProcessRunning(imageName) {
  try {
    const out = execSync('tasklist', { encoding: 'utf8' });
    return out.toLowerCase().includes(imageName.toLowerCase());
  } catch {
    return false;
  }
}

function killProcess(imageName) {
  execSync(`taskkill /IM "${imageName}" /F`, { stdio: 'inherit' });
}

async function ensureRemovableDir(dirPath, retries = 10) {
  if (!fs.existsSync(dirPath)) return;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      return;
    } catch (e) {
      const code = e && typeof e === 'object' ? e.code : undefined;
      const mayBeLocked = code === 'EPERM' || code === 'EACCES' || code === 'EBUSY';
      if (!mayBeLocked || attempt === retries) throw e;
      await sleep(500);
    }
  }
}

(async () => {
  if (process.platform !== 'win32') return;

  const exeName = getProductExeName();
  const unpackedDir = path.join(process.cwd(), 'release', 'win-unpacked');

  if (isProcessRunning(exeName)) {
    if (shouldKill) {
      // eslint-disable-next-line no-console
      console.log(`[prep] 检测到正在运行的进程: ${exeName}，正在结束...`);
      killProcess(exeName);
      await sleep(500);
    } else {
      // eslint-disable-next-line no-console
      console.error(`❌ 桌面打包失败前置检查：检测到 ${exeName} 正在运行。`);
      // eslint-disable-next-line no-console
      console.error('   请先关闭正在运行的桌面程序（尤其是从 release/win-unpacked 运行的版本），再执行 `npm run desktop:build`。');
      // eslint-disable-next-line no-console
      console.error('   或使用 `npm run desktop:build:kill` 自动结束进程。');
      process.exit(1);
    }
  }

  try {
    await ensureRemovableDir(unpackedDir, 15);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`❌ 无法清理输出目录（可能被占用/权限不足）：${unpackedDir}`);
    // eslint-disable-next-line no-console
    console.error(`   具体错误: ${String(e?.message || e)}`);
    // eslint-disable-next-line no-console
    console.error('   处理建议：关闭 Northrealm、关闭打开了 win-unpacked 的资源管理器窗口/预览、或重启后再打包。');
    process.exit(1);
  }
})();
