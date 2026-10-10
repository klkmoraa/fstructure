import type { DesignCodeId } from '../../../design/elements/codes';
import { proposeBeamSectionCompute } from './beamSectionProposalCompute';
import type { BeamDraft, SpanDraft } from './beamModel';
import type { BeamDetailDraft } from './beamDetailDraft';

export interface BeamSectionProposalRequest { readonly requestId: number; readonly code: DesignCodeId; readonly draft: BeamDraft; readonly spans: readonly SpanDraft[]; readonly details: BeamDetailDraft }
export interface BeamSectionProposalReply { readonly requestId: number; readonly proposal: { readonly width: string; readonly height: string } | null; readonly error?: string }

export function resolveBeamSectionProposal(request: BeamSectionProposalRequest): BeamSectionProposalReply {
  try { return { requestId: request.requestId, proposal: proposeBeamSectionCompute(request.code, request.draft, request.spans, request.details) }; }
  catch { return { requestId: request.requestId, proposal: null, error: 'Falló la búsqueda de sección. Los datos siguen disponibles.' }; }
}

export function startBeamSectionProposal(request: BeamSectionProposalRequest, onResult: (reply: BeamSectionProposalReply) => void): () => void {
  let cancelled = false;
  let worker: Worker | undefined;
  const deliver = (reply: BeamSectionProposalReply) => { if (!cancelled && reply.requestId === request.requestId) onResult(reply); };
  try { if (typeof Worker !== 'undefined') worker = new Worker(new URL('./beamSectionProposal.worker.ts', import.meta.url), { type: 'module' }); }
  catch { /* fallback below */ }
  if (!worker) queueMicrotask(() => deliver({ requestId: request.requestId, proposal: null, error: 'El navegador no permite ejecutar esta búsqueda en segundo plano.' }));
  else {
    worker.onmessage = (event: MessageEvent<BeamSectionProposalReply>) => { deliver(event.data); worker?.terminate(); };
    worker.onerror = (event) => { event.preventDefault(); deliver({ requestId: request.requestId, proposal: null, error: 'Falló la búsqueda de sección. Los datos siguen disponibles.' }); worker?.terminate(); };
    try { worker.postMessage(request); }
    catch { worker.terminate(); worker = undefined; queueMicrotask(() => deliver({ requestId: request.requestId, proposal: null, error: 'No se pudo iniciar el cálculo en segundo plano.' })); }
  }
  return () => { cancelled = true; worker?.terminate(); };
}
