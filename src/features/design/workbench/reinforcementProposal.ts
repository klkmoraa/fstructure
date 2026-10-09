import { resolveReinforcementProposal as computeProposal, sanitizeReinforcementProposalMessage } from './reinforcementProposalCompute';
import type { ReinforcementProposalMessage, ReinforcementProposalRequest } from './reinforcementProposalTypes';
export type { ProposalSnapshot, ReinforcementProposalMessage, ReinforcementProposalRequest } from './reinforcementProposalTypes';

function sanitizeMessage(request: ReinforcementProposalRequest, message: ReinforcementProposalMessage): ReinforcementProposalMessage {
  return sanitizeReinforcementProposalMessage(request, message);
}

export const resolveReinforcementProposal = computeProposal;

export function startReinforcementProposal(request: ReinforcementProposalRequest, onResult: (message: ReinforcementProposalMessage) => void): () => void {
  let cancelled = false;
  let worker: Worker | undefined;
  const deliver = (message: ReinforcementProposalMessage) => { if (!cancelled && message.requestId === request.requestId) onResult(sanitizeMessage(request, message)); };
  try {
    if (typeof Worker !== 'undefined') worker = new Worker(new URL('./reinforcementProposal.worker.ts', import.meta.url), { type: 'module' });
  } catch { /* El fallback local mantiene la función disponible en navegadores sin workers. */ }
  if (!worker) {
    queueMicrotask(() => deliver(computeProposal(request)));
  } else {
    worker.onmessage = (event: MessageEvent<ReinforcementProposalMessage>) => {
      deliver(event.data);
      worker?.terminate();
    };
    worker.onerror = (event) => {
      event.preventDefault();
      deliver({ kind: 'failed', requestId: request.requestId, reason: 'Falló la búsqueda. Vuelve a proponer para reintentarlo.' });
      worker?.terminate();
    };
    try { worker.postMessage(request); }
    catch {
      worker.terminate();
      worker = undefined;
      queueMicrotask(() => deliver(computeProposal(request)));
    }
  }
  return () => { cancelled = true; worker?.terminate(); };
}
