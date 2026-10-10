import type { ReinforcementAlternativesRequest, ReinforcementAlternativesResponse } from '../../../design/elements/reinforcementAlternatives';
export type { ReinforcementAlternativesRequest, ReinforcementAlternativesResponse } from '../../../design/elements/reinforcementAlternatives';

export function startReinforcementAlternatives(request: ReinforcementAlternativesRequest, onResult: (result: ReinforcementAlternativesResponse) => void): () => void {
  let cancelled = false;
  let worker: Worker | undefined;
  const deliver = (result: ReinforcementAlternativesResponse) => { if (!cancelled && result.requestId === request.requestId) onResult(result); };
  try { if (typeof Worker !== 'undefined') worker = new Worker(new URL('./reinforcementAlternatives.worker.ts', import.meta.url), { type: 'module' }); }
  catch { /* expensive solver searches stay off the interface thread */ }
  if (!worker) queueMicrotask(() => deliver({ kind: 'alternatives', requestId: request.requestId, candidates: [], error: 'worker-unavailable' }));
  else {
    worker.onmessage = (event: MessageEvent<ReinforcementAlternativesResponse>) => { deliver(event.data); worker?.terminate(); };
    worker.onerror = (event) => { event.preventDefault(); deliver({ kind: 'alternatives', requestId: request.requestId, candidates: [], error: 'worker-failed' }); worker?.terminate(); };
    try { worker.postMessage(request); }
    catch { worker.terminate(); worker = undefined; queueMicrotask(() => deliver({ kind: 'alternatives', requestId: request.requestId, candidates: [], error: 'worker-failed' })); }
  }
  return () => { cancelled = true; worker?.terminate(); };
}
