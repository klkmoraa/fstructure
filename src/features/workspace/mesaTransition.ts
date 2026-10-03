import { flushSync } from 'react-dom';
import type { MesaMode } from '../../shared/navigation/projectUrl';
import { preloadMesaMode } from './toolSurfaces';
import './mesaTransition.css';

type ViewTransitionLike = { finished: Promise<void> };
type DocumentWithTransitions = Document & { startViewTransition?: (update: () => Promise<void> | void) => ViewTransitionLike };

const ORDER: Record<MesaMode, number> = { model: 0, '3d': 1, design: 2 };

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Espera a que el modo nuevo deje de mostrar «Cargando…» (su código diferido ya
 * está, pero React lo resuelve en una microtarea). No usa requestAnimationFrame:
 * durante la actualización de una transición el navegador no pinta y esos
 * cuadros no llegarían nunca.
 */
const settled = async (limitMs = 120) => {
  for (let elapsed = 0; elapsed < limitMs; elapsed += 20) {
    if (!document.querySelector('.app-shell .workspace-loading, .app-shell [data-lazy-surface-loading]')) return;
    await wait(20);
  }
};

/**
 * Cambia de modo la mesa de FStructure con una transición de vista.
 *
 * Del 2D al 3D el plano del dibujo se tiende hacia el fondo y el modelo
 * espacial emerge; al volver, el plano se levanta de nuevo. Diseño entra y sale
 * de lado, en el orden 2D → 3D → Diseño del interruptor. Antes de capturar la
 * vista nueva se descarga el código del modo y se espera a que monte. Sin la
 * API de transiciones, con
 * movimiento reducido o en pruebas, el cambio es inmediato. La vista nueva es
 * en vivo durante la animación: el visor 3D termina de pintarse mientras entra.
 */
export function runMesaTransition(from: MesaMode, to: MesaMode, commit: () => void): void {
  const doc = typeof document === 'undefined' ? null : document as DocumentWithTransitions;
  const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc?.startViewTransition || reduced || from === to) {
    commit();
    return;
  }
  const root = doc.documentElement;
  const planar = (from === 'model' && to === '3d') ? 'lay' : (from === '3d' && to === 'model') ? 'raise' : null;
  root.dataset.mesaTransition = planar ?? (ORDER[to] > ORDER[from] ? 'forward' : 'back');
  let transition: ViewTransitionLike;
  try {
    transition = doc.startViewTransition(async () => {
      await preloadMesaMode(to);
      flushSync(commit);
      await settled();
    });
  } catch {
    delete root.dataset.mesaTransition;
    commit();
    return;
  }
  void transition.finished.catch(() => undefined).finally(() => { delete root.dataset.mesaTransition; });
}
