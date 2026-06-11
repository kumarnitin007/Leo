// Generates PWA PNG icons from the lion SVG sources in /public.
// Run with: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pub = join(__dirname, '..', 'public');

const base = readFileSync(join(pub, 'leo-icon.svg'));
const maskable = readFileSync(join(pub, 'leo-icon-maskable.svg'));

const jobs = [
  { svg: base, size: 144, out: 'icon-144x144.png' },
  { svg: base, size: 192, out: 'icon-192x192.png' },
  { svg: base, size: 512, out: 'icon-512x512.png' },
  { svg: base, size: 180, out: 'apple-touch-icon.png' },
  { svg: maskable, size: 192, out: 'icon-maskable-192x192.png' },
  { svg: maskable, size: 512, out: 'icon-maskable-512x512.png' },
];

for (const j of jobs) {
  await sharp(j.svg, { density: 384 })
    .resize(j.size, j.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(pub, j.out));
  console.log('✓', j.out);
}
console.log('Done — PWA icons generated in /public');
