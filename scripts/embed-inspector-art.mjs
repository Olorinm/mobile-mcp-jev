import { readFileSync, writeFileSync } from 'node:fs';

// Embed unchanged artwork so the inspector's existing three static routes suffice.
const page = new URL('../inspector/index.html', import.meta.url);
let html = readFileSync(page, 'utf8');
for (const [className, file] of [['device-art', 'back.webp'], ['device-mask', 'mask.webp']]) {
  const image = readFileSync(new URL(`../inspector/assets/pixel-10/${file}`, import.meta.url));
  const pattern = new RegExp(`(<img class="${className}" src=")[^"]*(")`);
  if (!pattern.test(html)) throw new Error(`Missing ${className} image`);
  html = html.replace(pattern, (_, before, after) => `${before}data:image/webp;base64,${image.toString('base64')}${after}`);
}
writeFileSync(page, html);
