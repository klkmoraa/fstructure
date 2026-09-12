import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Generate favicon.svg (Vector with prefers-color-scheme light/dark support)
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <style>
    :root { color-scheme: light dark; }
    .fs-mark-body { fill: #14171a; }
    .fs-mark-arm { fill: #ed4b46; }
    @media (prefers-color-scheme: dark) {
      .fs-mark-body { fill: #f2f4f3; }
      .fs-mark-arm { fill: #ff8e80; }
    }
  </style>
  <g transform="translate(-0.5, 0)">
    <path class="fs-mark-body" d="M8 5h9v38H8z M17 5h24v5.5L17 14z" />
    <path class="fs-mark-arm" d="M17 21h17v5L17 30z" />
  </g>
</svg>
`;

fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgContent, 'utf-8');
console.log('✓ Created public/favicon.svg');

// 2. Generate site.webmanifest
const manifest = {
  name: 'FStructure · Solver 2D',
  short_name: 'FStructure',
  description: 'FStructure · solver estructural 2D experimental',
  icons: [
    {
      src: './icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any'
    },
    {
      src: './icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any'
    },
    {
      src: './icon-maskable-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable'
    },
    {
      src: './icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable'
    },
    {
      src: './apple-touch-icon.png',
      sizes: '180x180',
      type: 'image/png'
    }
  ],
  start_url: './',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#14171a'
};

fs.writeFileSync(path.join(publicDir, 'site.webmanifest'), JSON.stringify(manifest, null, 2), 'utf-8');
console.log('✓ Created public/site.webmanifest');

// 3. Render PNGs using Playwright
async function generatePngs() {
  const browser = await chromium.launch();

  // Template for App Icons (White background, Apple HIG centered safe area)
  const appIconHtml = (scalePct = 60) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  svg {
    width: ${scalePct}%;
    height: ${scalePct}%;
  }
</style>
</head>
<body>
  <svg viewBox="0 0 48 48">
    <g transform="translate(-0.5, 0)">
      <path fill="#14171a" d="M8 5h9v38H8z M17 5h24v5.5L17 14z" />
      <path fill="#ed4b46" d="M17 21h17v5L17 30z" />
    </g>
  </svg>
</body>
</html>`;

  // Template for Tab Favicons (Transparent background)
  const faviconHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  svg {
    width: 100%;
    height: 100%;
  }
</style>
</head>
<body>
  <svg viewBox="0 0 48 48">
    <g transform="translate(-0.5, 0)">
      <path fill="#14171a" d="M8 5h9v38H8z M17 5h24v5.5L17 14z" />
      <path fill="#ed4b46" d="M17 21h17v5L17 30z" />
    </g>
  </svg>
</body>
</html>`;

  const targets = [
    { file: 'apple-touch-icon.png', size: 180, html: appIconHtml(60), transparent: false },
    { file: 'apple-touch-icon-precomposed.png', size: 180, html: appIconHtml(60), transparent: false },
    { file: 'icon-192.png', size: 192, html: appIconHtml(60), transparent: false },
    { file: 'icon-512.png', size: 512, html: appIconHtml(60), transparent: false },
    { file: 'icon-maskable-192.png', size: 192, html: appIconHtml(55), transparent: false },
    { file: 'icon-maskable-512.png', size: 512, html: appIconHtml(55), transparent: false },
    { file: 'favicon-32x32.png', size: 32, html: faviconHtml, transparent: true },
    { file: 'favicon-16x16.png', size: 16, html: faviconHtml, transparent: true },
    { file: 'favicon-48x48.png', size: 48, html: faviconHtml, transparent: true },
  ];

  for (const target of targets) {
    const page = await browser.newPage({
      viewport: { width: target.size, height: target.size },
      deviceScaleFactor: 1,
    });
    await page.setContent(target.html);
    const destPath = path.join(publicDir, target.file);
    await page.screenshot({
      path: destPath,
      omitBackground: target.transparent,
    });
    await page.close();
    console.log(`✓ Created public/${target.file} (${target.size}x${target.size})`);
  }

  await browser.close();

  // 4. Generate favicon.ico from favicon-32x32.png using macOS sips
  try {
    const png32 = path.join(publicDir, 'favicon-32x32.png');
    const icoPath = path.join(publicDir, 'favicon.ico');
    execSync(`sips -s format ico "${png32}" --out "${icoPath}"`);
    console.log('✓ Created public/favicon.ico');
  } catch (err) {
    console.error('Error generating ICO with sips:', err);
  }

  console.log('Icon generation complete!');
}

generatePngs().catch((err) => {
  console.error(err);
  process.exit(1);
});
