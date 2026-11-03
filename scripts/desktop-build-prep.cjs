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

// 只找“从待清理目录（release/win-unpacked）运行”的实例：只有它们会锁住输出目录。
// 已安装版（AppData）不影响打包，不应被拦截，更不应被结束。
// 查询失败（如 wmic 不可用）时返回 null，调用方按“无法判断”处理。
function findRunningFromDir(imageName, dir) {
  try {
    const out = execSync(
      `wmic process where "name='${imageName}'" get ExecutablePath,ProcessId /format:csv`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const base = path.resolve(dir).toLowerCase() + path.sep;
    return out
      .split(/\r?\n/)
      .map((line) => line.trim().split(','))
      .filter((cols) => cols.length >= 3 && /^\d+$/.test(cols[cols.length - 1]))
      .map((cols) => ({ exePath: cols[cols.length - 2], pid: cols[cols.length - 1] }))
      .filter((p) => p.exePath.toLowerCase().startsWith(base));
  } catch {
    return null;
  }
}

function killPid(pid) {
  execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
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

  // 打包时 TEMP/TMP 指向项目内 .tmp（见 package.json 的 desktop:build）：
  // 部分机器限制位于用户目录下的 exe 写入目录之外的位置，NSIS 安装包存根要把卸载程序写进 TEMP，
  // 默认 %TEMP% 会被拒绝，导致 "Command failed: Northrealm Setup x.y.z.exe"（退出码 2）。
  fs.mkdirSync(path.join(process.cwd(), '.tmp'), { recursive: true });

  const exeName = getProductExeName();
  const unpackedDir = path.join(process.cwd(), 'release', 'win-unpacked');

  // 查询失败（null）时不拦截：若目录真被占用，下面的 ensureRemovableDir 会给出明确报错
  const running = findRunningFromDir(exeName, unpackedDir) || [];
  if (running.length > 0) {
    if (shouldKill) {
      // eslint-disable-next-line no-console
      console.log(`[prep] 检测到从 ${unpackedDir} 运行的 ${exeName}（${running.length} 个进程），正在结束...`);
      running.forEach((p) => killPid(p.pid));
      await sleep(500);
    } else {
      // eslint-disable-next-line no-console
      console.error(`❌ 桌面打包失败前置检查：检测到从 ${unpackedDir} 运行的 ${exeName}，它会锁住输出目录。`);
      // eslint-disable-next-line no-console
      console.error('   请先关闭它再执行 `npm run desktop:build`，或使用 `npm run desktop:build:kill` 自动结束这些进程。');
      // eslint-disable-next-line no-console
      console.error('   （已安装版本在 AppData 下，不受影响，无需关闭。）');
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
