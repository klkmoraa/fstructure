/**
 * Corre `task` cuando la mesa terminó de animar su cambio de modo.
 *
 * Mientras dura la transición de vista, la raíz lleva `data-mesa-transition`
 * (ver `src/features/workspace/mesaTransition.ts`). Un cálculo pesado lanzado
 * en ese momento entrecorta la animación; aquí se espera a que acabe y luego
 * se deja pasar un cuadro. Sin transición, corre tras `delayMs`.
 */
export function afterTransition(task: () => void, delayMs = 30): () => void {
  let handle = 0;
  let cancelled = false;
  const animating = () => typeof document !== 'undefined' && document.documentElement.dataset.mesaTransition !== undefined;
  const run = () => {
    if (cancelled) return;
    if (animating()) { handle = window.setTimeout(run, 50); return; }
    task();
  };
  handle = window.setTimeout(run, delayMs);
  return () => { cancelled = true; window.clearTimeout(handle); };
}
