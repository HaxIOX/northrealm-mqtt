const fs = require('fs');
const path = require('path');

// Keep the app small by pruning Electron locale packs.
// We only keep Chinese (Simplified) and English (US), as requested.
const KEEP_LOCALES = new Set(['en-US.pak', 'en-GB.pak', 'zh-CN.pak']);

function safeUnlinkSync(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

module.exports = async function afterPack(context) {
  try {
    const platform = context?.electronPlatformName;
    // Locale pruning only makes sense for Electron's packaged output.
    if (platform !== 'win32') return;

    const localesDir = path.join(context.appOutDir, 'locales');
    if (!fs.existsSync(localesDir)) return;

    const entries = fs.readdirSync(localesDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      const name = ent.name;
      if (KEEP_LOCALES.has(name)) continue;
      if (name.toLowerCase().endsWith('.pak')) {
        safeUnlinkSync(path.join(localesDir, name));
      }
    }
  } catch {
    // Never fail packaging because of size-optimization cleanup.
  }
};
