// Renders the app icon (a dumbbell) to PNG with Playwright. Usage: node scripts/make-icons.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#111418"/>
<g fill="#5b8cff"><rect x="88" y="196" width="36" height="120" rx="12"/><rect x="128" y="160" width="40" height="192" rx="14"/>
<rect x="168" y="240" width="176" height="32" rx="8"/><rect x="344" y="160" width="40" height="192" rx="14"/><rect x="388" y="196" width="36" height="120" rx="12"/></g></svg>`;

const browser = await chromium.launch();
for (const [file, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  await page.screenshot({ path: `icons/${file}` });
  await page.close();
}
await browser.close();
