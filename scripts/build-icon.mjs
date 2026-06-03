import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const buildDir = join(projectRoot, 'build');
const svgPath = join(buildDir, 'icon.svg');

const sizes = [16, 32, 48, 64, 128, 256];

async function main() {
  const svg = await readFile(svgPath);
  const pngBuffers = await Promise.all(
    sizes.map((size) =>
      sharp(svg).resize(size, size).png().toBuffer(),
    ),
  );

  // 輸出最大尺寸 PNG 給 macOS / Linux 與 BrowserWindow icon 用
  await writeFile(join(buildDir, 'icon.png'), pngBuffers[pngBuffers.length - 1]);
  console.log('build/icon.png (256x256) generated');

  // 合成 .ico
  const ico = await pngToIco(pngBuffers);
  await writeFile(join(buildDir, 'icon.ico'), ico);
  console.log(`build/icon.ico generated with sizes: ${sizes.join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
