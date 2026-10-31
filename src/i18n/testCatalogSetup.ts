/** El entorno de prueba registra inglés sin convertir cada prueba visual en asíncrona. */
import { registerCatalog } from './catalogs';
import { en } from './catalogEn';

registerCatalog('en', en);

// La transición de mesa y las importaciones diferidas necesitan margen en equipos ocupados.
if (typeof window !== 'undefined') {
  const { configure } = await import('@testing-library/dom');
  configure({ asyncUtilTimeout: 5_000 });
}

// Las fuentes de la memoria PDF se piden por URL al propio sitio (`pdfFonts.ts`). En las
// pruebas no hay servidor: los archivos de `/node_modules/` se leen del disco.
{
  const original = globalThis.fetch;
  if (typeof original === 'function') {
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const path = raw.startsWith('/') ? raw : (() => { try { return new URL(raw).pathname; } catch { return ''; } })();
      if (path.startsWith('/node_modules/')) {
        const { readFile } = await import('node:fs/promises');
        const bytes = await readFile(`${process.cwd()}${decodeURIComponent(path)}`);
        return new Response(bytes);
      }
      return original(input, init);
    }) as typeof fetch;
  }
}
