/** El entorno de prueba registra inglés sin convertir cada prueba visual en asíncrona. */
import { registerCatalog } from './catalogs';
import { en } from './catalogEn';

registerCatalog('en', en);

// La transición de mesa y las importaciones diferidas necesitan margen en equipos ocupados.
if (typeof window !== 'undefined') {
  const { configure } = await import('@testing-library/dom');
  configure({ asyncUtilTimeout: 5_000 });
}
