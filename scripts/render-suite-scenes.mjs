/**
 * Renderiza las escenas del Inicio a PNG transparente, en día y noche.
 *
 * Requiere el servidor de desarrollo (`npm run dev`) en http://localhost:5173:
 * la escena se construye con el mismo código three.js de la app, dentro de un
 * navegador real, y se guarda en `public/assets/suite/`.
 *
 *   node scripts/render-suite-scenes.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/assets/suite');
const base = process.argv[2] ?? 'http://localhost:5173/';
const scenes = [
  { file: 'portal', source: 'catalog', id: 'portal:single-bay', size: [1500, 1100] },
  { file: 'model2d', source: 'suite', id: 'suite:model2d', size: [960, 640] },
  { file: 'space3d', source: 'catalog', id: 'space-frame:two-story', size: [960, 640] },
  { file: 'fem', source: 'suite', id: 'suite:fem', size: [960, 640] },
  { file: 'design', source: 'suite', id: 'suite:design', size: [960, 640] },
];

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.goto(base);
for (const scene of scenes) {
  for (const theme of ['day', 'night']) {
    // Los módulos se cargan dentro del navegador, desde el servidor de Vite.
    const url = await page.evaluate(async ({ scene, theme, modules }) => {
      const render = await import(modules.render);
      const [width, height] = scene.size;
      if (scene.source === 'catalog') return render.renderThreeStructuralAssetDataUrl(scene.id, theme, width, height);
      const suite = await import(modules.suite);
      return render.renderStructuralGroupDataUrl(suite.buildSuiteScene(scene.id, theme), theme, width, height);
    }, { scene, theme, modules: { render: '/src/features/structural-assets/threeStructuralRender.ts', suite: '/src/features/structural-assets/suiteScenes.ts' } });
    writeFileSync(join(out, `${scene.file}-${theme}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
}
await browser.close();
process.stdout.write(`Escenas escritas en ${out}\n`);
