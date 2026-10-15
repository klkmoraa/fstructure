import type { DesignCodeId } from '../../../design/elements/codes';
import { designFromDraft, type BayDraft, type FrameDraft, type StoryDraft, type StructureOutcome } from './frameCalculation';

/** Mensaje al worker del pórtico rápido: sólo el borrador, serializable. */
export interface FrameDesignRequest {
  readonly requestId: number;
  readonly code: DesignCodeId;
  readonly draft: FrameDraft;
  readonly bays: readonly BayDraft[];
  readonly stories: readonly StoryDraft[];
}

let lastId = 0;
/** Worker que terminó su último cálculo: el siguiente lo reutiliza ya cargado. */
let idle: Worker | null = null;
const aborted = () => new DOMException('Cálculo cancelado', 'AbortError');

function takeWorker(): Worker | null {
  if (idle) { const worker = idle; idle = null; return worker; }
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./frameDesign.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}

/**
 * Diseña el pórtico rápido en un worker: un 5 × 5 con sismo, voladizos y
 * cargas puntuales tarda cerca de medio segundo y no debe congelar la mesa.
 * Cancelar un cálculo en curso termina su worker; uno que termina queda para
 * el siguiente. Sin `Worker` (pruebas, navegadores sin módulos en workers) se
 * calcula aquí mismo.
 */
export function designFrameAsync(code: DesignCodeId, draft: FrameDraft, bays: readonly BayDraft[], stories: readonly StoryDraft[], signal: AbortSignal): Promise<StructureOutcome> {
  if (signal.aborted) return Promise.reject(aborted());
  const worker = takeWorker();
  if (!worker) return Promise.resolve().then(() => designFromDraft(code, draft, bays, stories));
  const requestId = ++lastId;
  return new Promise<StructureOutcome>((resolve, reject) => {
    const detach = () => { signal.removeEventListener('abort', cancel); worker.onmessage = null; worker.onerror = null; };
    const cancel = () => { detach(); worker.terminate(); reject(aborted()); };
    signal.addEventListener('abort', cancel, { once: true });
    worker.onmessage = (event: MessageEvent<{ requestId: number; outcome: StructureOutcome }>) => {
      if (event.data.requestId !== requestId) return;
      detach();
      if (idle) worker.terminate(); else idle = worker;
      resolve(event.data.outcome);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      detach();
      worker.terminate();
      // Un worker que no arranca (p. ej. sin módulos) no deja la mesa sin resultado.
      resolve(designFromDraft(code, draft, bays, stories));
    };
    try {
      worker.postMessage({ requestId, code, draft, bays, stories } satisfies FrameDesignRequest);
    } catch (error) {
      detach();
      worker.terminate();
      reject(error instanceof Error ? error : new Error('No se pudo enviar el pórtico al worker.'));
    }
  });
}
