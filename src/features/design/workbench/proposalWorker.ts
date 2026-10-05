import type { ProposalStep } from './frameProposal';

/** La búsqueda sólo devuelve progreso y dimensiones serializables. Terminar el worker cancela todos los candidatos. */
export function startProposalWorker(url: URL, payload: unknown, onStep: (step: ProposalStep) => void): (() => void) | null {
  if (typeof Worker === 'undefined') return null;
  let worker: Worker;
  try {
    worker = new Worker(url, { type: 'module' });
  } catch {
    return null;
  }
  let cancelled = false;
  worker.onmessage = (event: MessageEvent<ProposalStep>) => {
    if (cancelled) return;
    onStep(event.data);
    if (event.data.kind !== 'trying') worker.terminate();
  };
  worker.onerror = (event) => {
    event.preventDefault();
    if (!cancelled) onStep({ kind: 'failed', reason: 'Falló la búsqueda. Vuelve a proponer para reintentarlo.', trials: 0 });
    worker.terminate();
  };
  try {
    worker.postMessage(payload);
  } catch {
    worker.terminate();
    return null;
  }
  return () => {
    cancelled = true;
    worker.terminate();
  };
}
