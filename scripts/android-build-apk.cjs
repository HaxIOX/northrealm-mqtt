const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const isWin = process.platform === 'win32';
const repoRoot = process.cwd();
const androidDir = path.join(repoRoot, 'android');
const repoSdk = path.join(repoRoot, 'tools', 'android-sdk');

function log(message) {
  console.log(`[android:apk] ${message}`);
}

function fail(message) {
  console.error(`[android:apk] ${message}`);
  process.exit(1);
}

function pathExists(targetPath) {
  try {
    fs.accessSync(targetPath);
    return true;
  } catch {
    return false;
  }
}

function dirExists(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function fileExists(targetPath) {
  try {
    return fs.statSync(targetPath).isFile();
  } catch {
    return false;
  }
}

function exe(name) {
  return isWin ? `${name}.exe` : name;
}

function parseJavaMajor(versionText) {
  const raw = String(versionText || '').trim();
  if (!raw) return null;

  const match = raw.match(/^(?:1\.)?(\d+)/);
  if (!match) return null;

  const major = Number(match[1]);
  return Number.isFinite(major) ? major : null;
}

function readJavaMajorFromRelease(javaHome) {
  const releasePath = path.join(javaHome, 'release');
  if (!fileExists(releasePath)) return null;

  try {
    const text = fs.readFileSync(releasePath, 'utf8');
    const match = text.match(/JAVA_VERSION="([^"]+)"/);
    return match ? parseJavaMajor(match[1]) : null;
  } catch {
    return null;
  }
}

function readJavaMajorFromCommand(javaExe) {
  if (!fileExists(javaExe)) return null;

  try {
    const result = spawnSync(javaExe, ['-version'], { encoding: 'utf8' });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    const match = output.match(/version "([^"]+)"/);
    return match ? parseJavaMajor(match[1]) : null;
  } catch {
    return null;
  }
}

function validateJavaHome(javaHome, source) {
  const javaExe = path.join(javaHome, 'bin', exe('java'));
  const javacExe = path.join(javaHome, 'bin', exe('javac'));
  const jlinkExe = path.join(javaHome, 'bin', exe('jlink'));
  const problems = [];

  if (!dirExists(javaHome)) problems.push('missing directory');
  if (!fileExists(javaExe)) problems.push('missing java');
  if (!fileExists(javacExe)) problems.push('missing javac');
  if (!fileExists(jlinkExe)) problems.push('missing jlink');

  const major = readJavaMajorFromRelease(javaHome) ?? readJavaMajorFromCommand(javaExe);
  if (major == null) {
    problems.push('unknown Java version');
  } else if (major < 17) {
    problems.push(`Java ${major} < 17`);
  }

  return {
    home: javaHome,
    source,
    major,
    ok: problems.length === 0,
    problems,
  };
}

function pushCandidate(candidates, seen, home, source) {
  if (!home) return;

  const resolved = path.resolve(home);
  const key = resolved.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);

  candidates.push({ home: resolved, source });
}

function collectDirectChildren(root, sourcePrefix, candidates, seen) {
  if (!dirExists(root)) return;

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name.toLowerCase();
    if (!/^(jdk|jre|jbr|temurin|openjdk|zulu|graalvm)/.test(name)) continue;
    pushCandidate(candidates, seen, path.join(root, entry.name), `${sourcePrefix}/${entry.name}`);
  }
}

function collectJetBrainsJbr(root, candidates, seen) {
  if (!dirExists(root)) return;

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const javaHome = path.join(root, entry.name, 'jbr');
    if (dirExists(javaHome)) {
      pushCandidate(candidates, seen, javaHome, `JetBrains/${entry.name}/jbr`);
    }
  }
}

function findJavaCandidates() {
  const candidates = [];
  const seen = new Set();
  const homeDir = os.homedir();

  pushCandidate(candidates, seen, process.env.NR_ANDROID_JAVA_HOME, 'NR_ANDROID_JAVA_HOME');
  pushCandidate(candidates, seen, process.env.JAVA_HOME, 'JAVA_HOME');
  pushCandidate(candidates, seen, path.join(repoRoot, 'tools', 'jdk-21.0.10+7'), 'repo tools/jdk-21.0.10+7');
  pushCandidate(candidates, seen, path.join(repoRoot, 'tools', 'jdk-17.0.18+8'), 'repo tools/jdk-17.0.18+8');
  pushCandidate(candidates, seen, 'C:\\Program Files\\Android\\Android Studio\\jbr', 'Android Studio/jbr');
  pushCandidate(candidates, seen, 'C:\\Program Files\\Android\\Android Studio\\jre', 'Android Studio/jre');

  collectJetBrainsJbr('C:\\Program Files\\JetBrains', candidates, seen);
  collectDirectChildren('C:\\Program Files\\Java', 'Program Files/Java', candidates, seen);
  collectDirectChildren('C:\\Program Files\\Eclipse Adoptium', 'Program Files/Eclipse Adoptium', candidates, seen);
  collectDirectChildren(path.join(homeDir, '.jdks'), '.jdks', candidates, seen);

  return candidates;
}

function runCommand(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: opts.cwd || repoRoot,
    env: opts.env || process.env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function runGradle(javaHome, sdkRoot) {
  const env = {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_SDK_ROOT: sdkRoot,
    ANDROID_HOME: sdkRoot,
    NR_GRADLE_USE_SYSTEM_JAVA: '1',
    PATH: [
      path.join(javaHome, 'bin'),
      path.join(sdkRoot, 'platform-tools'),
      process.env.PATH || '',
    ].filter(Boolean).join(path.delimiter),
  };

  if (isWin) {
    runCommand('cmd.exe', ['/d', '/s', '/c', 'gradlew.bat :app:assembleDebug --no-daemon --console=plain'], {
      cwd: androidDir,
      env,
    });
    return;
  }

  runCommand(path.join(androidDir, 'gradlew'), [':app:assembleDebug', '--no-daemon', '--console=plain'], {
    cwd: androidDir,
    env,
  });
}

function main() {
  if (!dirExists(androidDir)) {
    fail('Missing android project. Run npm run android:add first.');
  }

  const sdkRoot = dirExists(repoSdk)
    ? repoSdk
    : (process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || '');

  if (!sdkRoot || !dirExists(sdkRoot)) {
    fail('Android SDK not found. Prepare tools/android-sdk or set ANDROID_SDK_ROOT.');
  }

  const candidates = findJavaCandidates();
  const checked = candidates.map((candidate) => validateJavaHome(candidate.home, candidate.source));
  const selected = checked.find((item) => item.ok);

  if (!selected) {
    console.error('[android:apk] No usable JDK 17+ was found. Checked candidates:');
    if (checked.length === 0) {
      console.error('  - no candidate JDK paths found');
    } else {
      for (const item of checked) {
        console.error(`  - ${item.source}: ${item.home} -> ${item.problems.join(', ')}`);
      }
    }
    fail('A full JDK 17/21 is required (java + javac + jlink). You can point NR_ANDROID_JAVA_HOME to it.');
  }

  log(`Using ${selected.source} (Java ${selected.major})`);
  log(`JAVA_HOME=${selected.home}`);
  log(`ANDROID_SDK_ROOT=${sdkRoot}`);

  log('Running android:sync ...');
  if (isWin) {
    runCommand('cmd.exe', ['/d', '/s', '/c', 'npm run android:sync'], { cwd: repoRoot });
  } else {
    runCommand('npm', ['run', 'android:sync'], { cwd: repoRoot });
  }

  log('Building debug APK ...');
  runGradle(selected.home, sdkRoot);

  const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  if (pathExists(apkPath)) {
    log(`APK generated: ${apkPath}`);
  } else {
    log('Gradle finished, but app-debug.apk was not found. Check the build log above.');
  }
}

main();
