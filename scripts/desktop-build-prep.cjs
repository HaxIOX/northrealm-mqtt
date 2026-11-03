const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = new Set(process.argv.slice(2));
const shouldKill = args.has('--kill');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

// Only instances started from the directory about to be cleaned (release/win-unpacked) lock it.
// An installed copy (under AppData) does not affect packaging and must neither block nor be killed.
// Returns null when the query itself fails (e.g. wmic unavailable): the caller then does not block.
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
      .filter((proc) => proc.exePath.toLowerCase().startsWith(base));
  } catch {
    return null;
  }
}

function killPid(pid) {
  execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
}

async function ensureRemovableDir(dirPath, retries = 10) {
  if (!fs.existsSync(dirPath)) return;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = error && typeof error === 'object' ? error.code : undefined;
      const mayBeLocked = code === 'EPERM' || code === 'EACCES' || code === 'EBUSY';
      if (!mayBeLocked || attempt === retries) throw error;
      await sleep(500);
    }
  }
}

(async () => {
  if (process.platform !== 'win32') return;

  // electron-builder runs with TEMP/TMP pointing at ./.tmp (see package.json desktop:build).
  // Some machines only let executables located under the Desktop folder write inside that folder.
  // The NSIS installer stub must write the uninstaller into TEMP; when %TEMP% is refused, the build fails
  // with "Command failed: Northrealm Setup x.y.z.exe" (exit code 2). A project-local .tmp avoids that.
  fs.mkdirSync(path.join(process.cwd(), '.tmp'), { recursive: true });

  const exeName = getProductExeName();
  const unpackedDir = path.join(process.cwd(), 'release', 'win-unpacked');

  // A failed query (null) does not block: if the directory really is locked,
  // ensureRemovableDir below reports a precise error.
  const running = findRunningFromDir(exeName, unpackedDir) || [];
  if (running.length > 0) {
    if (shouldKill) {
      console.log(`[prep] Found ${running.length} ${exeName} process(es) running from ${unpackedDir}. Stopping them before packaging.`);
      running.forEach((proc) => killPid(proc.pid));
      await sleep(500);
    } else {
      console.error(`Desktop build blocked: ${exeName} is running from ${unpackedDir} and locks the output directory.`);
      console.error('Close it and rerun `npm run desktop:build`, or use `npm run desktop:build:kill` to stop those processes.');
      console.error('An installed copy (under AppData) is not affected and does not need to be closed.');
      process.exit(1);
    }
  }

  try {
    await ensureRemovableDir(unpackedDir, 15);
  } catch (error) {
    console.error(`Failed to clean output directory: ${unpackedDir}`);
    console.error(`Error: ${String(error?.message || error)}`);
    console.error('Close Northrealm and any Explorer window opened inside win-unpacked, then retry the build.');
    process.exit(1);
  }
})();
