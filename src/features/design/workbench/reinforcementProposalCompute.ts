import { proposeColumnReinforcement } from './columnProposal';
import { proposeSectionReinforcement } from '../../../design/concrete/sectionStudio';
import { sectionInput } from './concreteStudioInput';
import type { ReinforcementProposalMessage, ReinforcementProposalRequest } from './reinforcementProposalTypes';

const reinforcementFields: Record<ReinforcementProposalRequest['kind'], readonly string[]> = {
  column: ['bar', 'barsWidth', 'barsDepth', 'barCount', 'tie'],
  section: ['bar', 'barCount', 'topBarCount', 'bottomBarCount', 'cornerBarCount', 'faceBarCount', 'tie', 'tieSpacing'],
};

export function sanitizeReinforcementProposalMessage(request: ReinforcementProposalRequest, message: ReinforcementProposalMessage): ReinforcementProposalMessage {
  if (message.kind === 'failed') return message;
  const allowed = new Set(reinforcementFields[request.kind]);
  return {
    kind: 'proposed', requestId: message.requestId,
    fields: Object.fromEntries(Object.entries(message.fields).filter(([key, value]) => allowed.has(key) && typeof value === 'string')),
  };
}

export function resolveReinforcementProposal(request: ReinforcementProposalRequest): ReinforcementProposalMessage {
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

export function resolveReinforcementProposalMessage(request: ReinforcementProposalRequest): ReinforcementProposalMessage {
  return sanitizeReinforcementProposalMessage(request, resolveReinforcementProposal(request));
}
