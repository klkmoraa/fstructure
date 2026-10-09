import { proposeColumnReinforcement } from './columnModel';
import { proposeSectionReinforcement } from '../../../design/concrete/sectionStudio';
import { sectionInput } from './concreteStudioModel';
import type { DesignCodeId } from '../../../design/elements/codes';

export type ProposalSnapshot = Readonly<Record<string, string>>;
export type ReinforcementProposalRequest =
  | { readonly kind: 'column'; readonly requestId: number; readonly code: DesignCodeId; readonly snapshot: ProposalSnapshot }
  | { readonly kind: 'section'; readonly requestId: number; readonly snapshot: ProposalSnapshot; readonly diametersMm?: readonly number[] };
export type ReinforcementProposalMessage =
  | { readonly kind: 'proposed'; readonly requestId: number; readonly fields: Record<string, string> }
  | { readonly kind: 'failed'; readonly requestId: number; readonly reason: string };

const reinforcementFields: Record<ReinforcementProposalRequest['kind'], readonly string[]> = {
  column: ['bar', 'barsWidth', 'barsDepth', 'barCount', 'tie'],
  section: ['bar', 'barCount', 'topBarCount', 'bottomBarCount', 'cornerBarCount', 'faceBarCount', 'tie', 'tieSpacing'],
};

function sanitizeMessage(request: ReinforcementProposalRequest, message: ReinforcementProposalMessage): ReinforcementProposalMessage {
  if (message.kind === 'failed') return message;
  const allowed = new Set(reinforcementFields[request.kind]);
  return {
    kind: 'proposed', requestId: message.requestId,
    fields: Object.fromEntries(Object.entries(message.fields).filter(([key, value]) => allowed.has(key) && typeof value === 'string')),
  };
}

function compute(request: ReinforcementProposalRequest): ReinforcementProposalMessage {
  try {
    if (request.kind === 'column') {
      const fields = proposeColumnReinforcement(request.code, request.snapshot as never);
      return fields
        ? { kind: 'proposed', requestId: request.requestId, fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, String(value)])) }
        : { kind: 'failed', requestId: request.requestId, reason: 'No se encontró un armado que cumpla con las acciones actuales.' };
    }
    const result = proposeSectionReinforcement(sectionInput(request.snapshot as never), request.diametersMm ? { diametersMm: request.diametersMm } : undefined);
    if (result.status !== 'proposed') return { kind: 'failed', requestId: request.requestId, reason: result.reason };
    const fields: Record<string, string> = {
      bar: String(result.input.barDiameterMm), barCount: String(result.input.barCount),
      tie: String(result.input.tieDiameterMm), tieSpacing: String(Math.round(result.input.tieSpacingMm) / 10),
    };
    if (request.snapshot.barLayout === 'layers') {
      fields.topBarCount = String(result.input.topBarCount ?? request.snapshot.topBarCount);
      fields.bottomBarCount = String(result.input.bottomBarCount ?? request.snapshot.bottomBarCount);
    }
    if (request.snapshot.barLayout === 'zones') {
      fields.cornerBarCount = String(result.input.cornerBarCount ?? request.snapshot.cornerBarCount);
      fields.faceBarCount = String(result.input.faceBarCount ?? request.snapshot.faceBarCount);
    }
    return { kind: 'proposed', requestId: request.requestId, fields };
  } catch {
    return { kind: 'failed', requestId: request.requestId, reason: 'Falló la búsqueda. Revisa los datos e inténtalo de nuevo.' };
  }
}

export function startReinforcementProposal(request: ReinforcementProposalRequest, onResult: (message: ReinforcementProposalMessage) => void): () => void {
  let cancelled = false;
  let worker: Worker | undefined;
  const deliver = (message: ReinforcementProposalMessage) => { if (!cancelled && message.requestId === request.requestId) onResult(sanitizeMessage(request, message)); };
  try {
    if (typeof Worker !== 'undefined') worker = new Worker(new URL('./reinforcementProposal.worker.ts', import.meta.url), { type: 'module' });
  } catch { /* El fallback local mantiene la función disponible en navegadores sin workers. */ }
  if (!worker) {
    queueMicrotask(() => deliver(compute(request)));
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
      queueMicrotask(() => deliver(compute(request)));
    }
  }
  return () => { cancelled = true; worker?.terminate(); };
}

export const resolveReinforcementProposal = compute;
