/**
 * Pruebas de humo de la app compilada: la Home, sus secciones, la mesa 2D
 * vacía y una pieza individual, en Día y Noche, a 1440 px y a 390 px.
 *
 * Por cada pantalla comprueba que no haya errores de página ni de consola,
 * que no haya desplazamiento horizontal y que se vea su título; guarda una
 * captura en `qa-artifacts/smoke/` (fuera del repositorio).
 *
 *   npm run smoke            # compila y prueba
 *   node scripts/smoke.mjs   # prueba el `dist/` que ya existe
 *
 * Usa el Chromium de Playwright; `FS_CHROMIUM` permite indicar otro ejecutable.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'qa-artifacts/smoke');
const port = Number(process.env.FS_SMOKE_PORT ?? 4179);
const base = `http://localhost:${port}/`;

if (!existsSync(join(root, 'dist/index.html'))) {
  process.stderr.write('Falta dist/: corre `npm run build` o `npm run smoke`.\n');
  process.exit(1);
}

const screens = [
  { name: 'home', url: '?surface=welcome', title: /Modela, analiza y diseña|Model, analyze/i },
  { name: 'proyectos', url: '?surface=welcome&view=projects', title: /Proyectos|Projects/i },
  { name: 'plantillas', url: '?surface=welcome&view=templates', title: /Plantillas|Templates/i },
  { name: 'recursos', url: '?surface=welcome&view=resources', title: /Recursos|Resources/i },
  { name: 'biblioteca', url: '?surface=welcome&view=library', title: /Biblioteca|Library/i },
  { name: 'aula', url: '?surface=welcome&view=classroom', title: /Aula|Classroom/i },
  { name: 'importar', url: '?surface=welcome&view=import', title: /Importar|Import/i },
  { name: 'mesa-2d', url: '?tool=model2d', selector: '[data-testid="structural-canvas"], .structural-canvas, canvas, svg' },
  { name: 'pieza-viga', url: '?surface=welcome', click: /^Viga/, selector: '[data-testid="design-workbench"]' },
];
const variants = [
  { label: '1440-dia', width: 1440, height: 900, theme: 'light' },
  { label: '1440-noche', width: 1440, height: 900, theme: 'dark' },
  { label: '390-dia', width: 390, height: 844, theme: 'light' },
  { label: '390-noche', width: 390, height: 844, theme: 'dark' },
];

const server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
const stop = () => { if (server.exitCode === null) server.kill(); };
process.on('exit', stop);

const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(base)).ok) return; } catch { /* aún no escucha */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`vite preview no respondió en ${base}`);
};

mkdirSync(out, { recursive: true });
const failures = [];
let browser;
try {
  await waitForServer();
  browser = await chromium.launch(process.env.FS_CHROMIUM ? { executablePath: process.env.FS_CHROMIUM } : {});
  for (const variant of variants) {
    for (const screen of screens) {
      // Cada pantalla en un contexto nuevo: sin proyectos ni preferencias de la anterior.
      const context = await browser.newContext({ viewport: { width: variant.width, height: variant.height }, colorScheme: variant.theme === 'dark' ? 'dark' : 'light', serviceWorkers: 'block' });
      await context.addInitScript((theme) => { try { localStorage.setItem('fusionstructure.theme', theme); } catch { /* sin almacenamiento */ } }, variant.theme);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      const id = `${screen.name}-${variant.label}`;
      try {
        await page.goto(base + screen.url, { waitUntil: 'networkidle' });
        if (screen.click) await page.getByRole('button', { name: screen.click }).first().click();
        if (screen.title) await page.getByRole('heading', { name: screen.title }).first().waitFor({ timeout: 10_000 });
        if (screen.selector) await page.locator(screen.selector).first().waitFor({ timeout: 15_000 });
        await page.waitForTimeout(400);
        const theme = await page.evaluate(() => document.documentElement.dataset.theme);
        if (theme !== variant.theme) errors.push(`tema ${theme ?? 'sin definir'} en vez de ${variant.theme}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 1) errors.push(`desplazamiento horizontal de ${overflow} px`);
        await page.screenshot({ path: join(out, `${id}.png`) });
      } catch (error) {
        errors.push(error instanceof Error ? error.message.split('\n')[0] : String(error));
      }
      process.stdout.write(`${errors.length ? '✗' : '✓'} ${id}${errors.length ? ` — ${errors.slice(0, 3).join(' · ')}` : ''}\n`);
      if (errors.length) failures.push(id);
      await context.close();
    }
  }
} finally {
  await browser?.close();
  stop();
}
process.stdout.write(`\n${screens.length * variants.length - failures.length} de ${screens.length * variants.length} pantallas en verde. Capturas en ${out}\n`);
process.exit(failures.length ? 1 : 0);
