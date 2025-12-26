const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sanitizeFileToken(value) {
  return String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, '');
}

function ensureDirExists(dirPath, hint) {
  if (!fs.existsSync(dirPath)) throw new Error(hint || `Missing path: ${dirPath}`);
}

function compressPortableZip(sourceDir, outZipPath) {
  const escapedSource = sourceDir.replace(/'/g, "''");
  const escapedOut = outZipPath.replace(/'/g, "''");
  const ps = [
    "$ErrorActionPreference='Stop';",
    `$src='${escapedSource}';`,
    `$dst='${escapedOut}';`,
    "if (Test-Path $dst) { Remove-Item -Force $dst }",
    // Zip the *contents* so extraction produces a runnable folder with Northrealm.exe at top level.
    "Compress-Archive -Path (Join-Path $src '*') -DestinationPath $dst -Force;",
    "Write-Host ('[portable] created: ' + $dst);",
  ].join(' ');

  execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
}

function main() {
  if (process.platform !== 'win32') {
    throw new Error('portable zip is currently supported on Windows only');
  }

  const repoRoot = process.cwd();
  const pkg = readJson(path.join(repoRoot, 'package.json'));

  const productName = sanitizeFileToken(pkg?.build?.productName || 'Northrealm') || 'Northrealm';
  const version = sanitizeFileToken(pkg?.version || '0.0.0') || '0.0.0';
  const arch = sanitizeFileToken(process.arch || 'x64') || 'x64';

  const releaseDir = path.join(repoRoot, 'release');
  const unpackedDir = path.join(releaseDir, 'win-unpacked');
  ensureDirExists(unpackedDir, 'Missing `release/win-unpacked`. Please run `npm run desktop:build` first.');

  const zipName = `${productName}-portable-${version}-win-${arch}.zip`;
  const outZipPath = path.join(releaseDir, zipName);

  compressPortableZip(unpackedDir, outZipPath);
}

main();

