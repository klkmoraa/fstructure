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

// 1. Generate adaptive favicon.svg (Vector with prefers-color-scheme light/dark support)
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <style>
    :root { color-scheme: light dark; }
    .fs-mark-body { fill: #14171a; }
    .fs-mark-arm { fill: #ed4b46; }
    @media (prefers-color-scheme: dark) {
      .fs-mark-body { fill: #ffffff; }
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

// 2. Generate site.webmanifest (Light Mode) and site-dark.webmanifest (Dark Mode)
const manifestLight = {
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
    },
    {
      src: './icon-192-dark.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
      media: '(prefers-color-scheme: dark)'
    },
    {
      src: './icon-512-dark.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
      media: '(prefers-color-scheme: dark)'
    }
  ],
  start_url: './',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#ffffff'
};

const manifestDark = {
  name: 'FStructure · Solver 2D',
  short_name: 'FStructure',
  description: 'FStructure · solver estructural 2D experimental',
  icons: [
    {
      src: './icon-192-dark.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any'
    },
    {
      src: './icon-512-dark.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any'
    },
    {
      src: './icon-maskable-192-dark.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable'
    },
    {
      src: './icon-maskable-512-dark.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable'
    },
    {
      src: './apple-touch-icon-dark.png',
      sizes: '180x180',
      type: 'image/png'
    }
  ],
  start_url: './',
  display: 'standalone',
  background_color: '#14171a',
  theme_color: '#14171a'
};

fs.writeFileSync(path.join(publicDir, 'site.webmanifest'), JSON.stringify(manifestLight, null, 2), 'utf-8');
fs.writeFileSync(path.join(publicDir, 'site-dark.webmanifest'), JSON.stringify(manifestDark, null, 2), 'utf-8');
console.log('✓ Created public/site.webmanifest & public/site-dark.webmanifest');

// 3. Render PNGs using Playwright
async function generatePngs() {
  const browser = await chromium.launch();

  // Template for App Icons (Solid background, Apple HIG centered safe area)
  const appIconHtml = ({ bgColor, bodyColor, armColor, scalePct = 60 }) => `<!DOCTYPE html>
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
    background: ${bgColor};
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
      <path fill="${bodyColor}" d="M8 5h9v38H8z M17 5h24v5.5L17 14z" />
      <path fill="${armColor}" d="M17 21h17v5L17 30z" />
    </g>
  </svg>
</body>
</html>`;

  // Template for Tab Favicons (Transparent background)
  const faviconHtml = ({ bodyColor, armColor }) => `<!DOCTYPE html>
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
      <path fill="${bodyColor}" d="M8 5h9v38H8z M17 5h24v5.5L17 14z" />
      <path fill="${armColor}" d="M17 21h17v5L17 30z" />
    </g>
  </svg>
</body>
</html>`;

  const lightColors = { bgColor: '#ffffff', bodyColor: '#14171a', armColor: '#ed4b46' };
  const darkColors = { bgColor: '#14171a', bodyColor: '#ffffff', armColor: '#ed4b46' };

  const targets = [
    // --- LIGHT THEME (Fondo blanco, F carbón oscuro, línea roja) ---
    { file: 'apple-touch-icon.png', size: 180, html: appIconHtml({ ...lightColors, scalePct: 60 }), transparent: false },
    { file: 'apple-touch-icon-precomposed.png', size: 180, html: appIconHtml({ ...lightColors, scalePct: 60 }), transparent: false },
    { file: 'icon-192.png', size: 192, html: appIconHtml({ ...lightColors, scalePct: 60 }), transparent: false },
    { file: 'icon-512.png', size: 512, html: appIconHtml({ ...lightColors, scalePct: 60 }), transparent: false },
    { file: 'icon-maskable-192.png', size: 192, html: appIconHtml({ ...lightColors, scalePct: 55 }), transparent: false },
    { file: 'icon-maskable-512.png', size: 512, html: appIconHtml({ ...lightColors, scalePct: 55 }), transparent: false },
    { file: 'favicon-32x32.png', size: 32, html: faviconHtml(lightColors), transparent: true },
    { file: 'favicon-16x16.png', size: 16, html: faviconHtml(lightColors), transparent: true },

    // --- DARK THEME (Fondo negro/carbón, F blanca, línea roja) ---
    { file: 'apple-touch-icon-dark.png', size: 180, html: appIconHtml({ ...darkColors, scalePct: 60 }), transparent: false },
    { file: 'apple-touch-icon-precomposed-dark.png', size: 180, html: appIconHtml({ ...darkColors, scalePct: 60 }), transparent: false },
    { file: 'icon-192-dark.png', size: 192, html: appIconHtml({ ...darkColors, scalePct: 60 }), transparent: false },
    { file: 'icon-512-dark.png', size: 512, html: appIconHtml({ ...darkColors, scalePct: 60 }), transparent: false },
    { file: 'icon-maskable-192-dark.png', size: 192, html: appIconHtml({ ...darkColors, scalePct: 55 }), transparent: false },
    { file: 'icon-maskable-512-dark.png', size: 512, html: appIconHtml({ ...darkColors, scalePct: 55 }), transparent: false },
    { file: 'favicon-32x32-dark.png', size: 32, html: faviconHtml(darkColors), transparent: true },
    { file: 'favicon-16x16-dark.png', size: 16, html: faviconHtml(darkColors), transparent: true },
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
