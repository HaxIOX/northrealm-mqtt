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

  const exeName = getProductExeName();
  const unpackedDir = path.join(process.cwd(), 'release', 'win-unpacked');

  if (isProcessRunning(exeName)) {
    if (shouldKill) {
      console.log(`[prep] Detected running process: ${exeName}. Stopping it before packaging.`);
      killProcess(exeName);
      await sleep(500);
    } else {
      console.error(`Desktop build blocked: detected running process ${exeName}.`);
      console.error('Close the running desktop app, especially anything started from release/win-unpacked, then rerun `npm run desktop:build`.');
      console.error('Or use `npm run desktop:build:kill` to stop the process automatically.');
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
