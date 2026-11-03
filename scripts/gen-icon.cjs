const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'build', 'icon.svg');
const OUT_DIR = path.join(ROOT, 'build');

// 小尺寸（≤48px）若直接由大图缩小，描边会落在半像素上，边缘发虚、16px 时线条几乎消失。
// 因此按像素网格单独设计：描边取整；奇数描边的横线中心落在 .5，偶数描边落在整数，
// 使横线上下边缘恰好对齐像素行。与侧栏 Logo（src/App.jsx，32px）使用同一套 32px 设计。
const PIXEL_ICONS = {
  16: { stroke: 2, d: 'M2 10 H5.5 L8 2.5 L10.5 13.5 L12 10 H14' },
  24: { stroke: 2, d: 'M2.5 15 H8.5 L11 4 L13.5 20 L15.5 15 H21.5' },
  32: { stroke: 3, d: 'M3.5 20.5 H11 L14.5 5.5 L18 27 L21 20.5 H28.5' },
  48: { stroke: 4, d: 'M5 31 H16.5 L22 8 L27 40.5 L31.5 31 H43' },
};

function pixelSvg(size) {
  const { stroke, d } = PIXEL_ICONS[size];
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<path d="${d}" fill="none" stroke="#2563EB" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>` +
      '</svg>',
  );
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const base = await sharp(SRC).resize(1024, 1024).png().toBuffer();

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = await Promise.all(
    sizes.map((s) => (PIXEL_ICONS[s]
      ? sharp(pixelSvg(s), { density: 72 }).png().toBuffer()
      : sharp(base).resize(s, s).png().toBuffer())),
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
