const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'build', 'icon.svg');
const OUT_DIR = path.join(ROOT, 'build');

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const base = await sharp(SRC).resize(1024, 1024).png().toBuffer();

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = await Promise.all(
    sizes.map((s) => sharp(base).resize(s, s).png().toBuffer()),
  );

  await sharp(base).resize(256, 256).png().toFile(path.join(OUT_DIR, 'icon.png'));

  const { default: pngToIco } = await import('png-to-ico');
  const ico = await pngToIco(pngs);
  fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), ico);

  console.log(`已生成 build/icon.ico (${sizes.join('/')}) 与 build/icon.png`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
