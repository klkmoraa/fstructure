/**
 * Sobres versionados del worker de Space 3D.
 *
 * El handler es puro y se comparte entre el Web Worker y las pruebas, así que
 * la ruta en hilo y la ruta en worker son literalmente el mismo código. Todo lo
 * que cruza el `postMessage` es JSON simple: nada de clases, funciones ni
 * `Map`/`Set`, para que `structuredClone` lo transporte sin pérdida.
 */
import { analyzeSpace3DProject } from '../engine/solver';
import { analyzeSpace3DBuckling, analyzeSpace3DModal, analyzeSpace3DPDelta } from '../engine/analysisModes';
import { analyzeSpace3DResponseSpectrum } from '../engine/responseSpectrum';
import type { AnalysisBudget } from '../../../../shared/contracts';
import type { Space3DAnalysisResult, Space3DProjectV1 } from '../model/types';

/** v2: además del lineal, los estudios (P-Delta, modal, pandeo, espectro). */
export const SPACE3D_PROTOCOL_VERSION = 2 as const;

/** Estudio que corre en el worker sobre el mismo proyecto. */
export type Space3DStudy =
  | { readonly kind: 'pdelta'; readonly targetId: string; readonly maxIterations?: number }
  | { readonly kind: 'modal'; readonly targetId?: string; readonly modes: number }
  | { readonly kind: 'buckling'; readonly targetId: string; readonly modes: number }
  | { readonly kind: 'response-spectrum'; readonly caseId: string };

export type Space3DStudyOutcome =
  | { readonly kind: 'pdelta'; readonly result: ReturnType<typeof analyzeSpace3DPDelta> }
  | { readonly kind: 'modal'; readonly result: ReturnType<typeof analyzeSpace3DModal> }
  | { readonly kind: 'buckling'; readonly result: ReturnType<typeof analyzeSpace3DBuckling> }
  | { readonly kind: 'response-spectrum'; readonly result: ReturnType<typeof analyzeSpace3DResponseSpectrum> };

/** Ejecuta un estudio; puro, lo comparten el worker y la ruta en hilo. */
export const runSpace3DStudy = (project: Space3DProjectV1, study: Space3DStudy, budget?: AnalysisBudget): Space3DStudyOutcome => {
  switch (study.kind) {
    case 'pdelta': return { kind: 'pdelta', result: analyzeSpace3DPDelta(project, study.targetId, { maxIterations: study.maxIterations ?? 20, budget }) };
    case 'modal': return { kind: 'modal', result: analyzeSpace3DModal(project, { targetId: study.targetId, modes: study.modes, budget }) };
    case 'buckling': return { kind: 'buckling', result: analyzeSpace3DBuckling(project, study.targetId, { modes: study.modes, budget }) };
    case 'response-spectrum': return { kind: 'response-spectrum', result: analyzeSpace3DResponseSpectrum(project, study.caseId) };
  }
};

export interface Space3DRunRequest {
  readonly protocolVersion: typeof SPACE3D_PROTOCOL_VERSION;
  readonly type: 'run';
  readonly requestId: number;
  readonly project: Space3DProjectV1;
  readonly targetId: string;
  /** Optional for compatibility; the solver falls back to the device budget. */
  readonly budget?: AnalysisBudget;
}

export interface Space3DStudyRequest {
  readonly protocolVersion: typeof SPACE3D_PROTOCOL_VERSION;
  readonly type: 'study';
  readonly requestId: number;
  readonly project: Space3DProjectV1;
  readonly study: Space3DStudy;
  readonly budget?: AnalysisBudget;
}

export type Space3DWorkerRequest = Space3DRunRequest | Space3DStudyRequest;

export interface Space3DSuccessResponse {
  readonly protocolVersion: typeof SPACE3D_PROTOCOL_VERSION;
  readonly type: 'success';
  readonly requestId: number;
  readonly result: Space3DAnalysisResult;
}

export interface Space3DStudySuccessResponse {
  readonly protocolVersion: typeof SPACE3D_PROTOCOL_VERSION;
  readonly type: 'study-success';
  readonly requestId: number;
  readonly outcome: Space3DStudyOutcome;
}

type Space3DWorkerErrorCode = 'PROTOCOL_MISMATCH' | 'UNSUPPORTED_REQUEST' | 'WORKER_FAILURE';

export interface Space3DErrorResponse {
  readonly protocolVersion: typeof SPACE3D_PROTOCOL_VERSION;
  readonly type: 'error';
  readonly requestId: number;
  readonly code: Space3DWorkerErrorCode;
  readonly message: string;
}

export type Space3DWorkerResponse = Space3DSuccessResponse | Space3DStudySuccessResponse | Space3DErrorResponse;

const error = (requestId: number, code: Space3DWorkerErrorCode, message: string): Space3DErrorResponse => ({
  protocolVersion: SPACE3D_PROTOCOL_VERSION,
  type: 'error',
  requestId,
  code,
  message,
});

const requestIdOf = (request: unknown): number => {
  const candidate = (request as { requestId?: unknown } | null)?.requestId;
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : 0;
};

/**
 * Fail-closed: una versión distinta no se «adapta», se rechaza. Un worker
 * antiguo respondiendo a una app nueva devolvería resultados con otra semántica
 * de signos o de GDL, y eso es peor que no responder.
 */
export const handleSpace3DWorkerRequest = (request: unknown): Space3DWorkerResponse => {
  const requestId = requestIdOf(request);
  if (typeof request !== 'object' || request === null) {
    return error(requestId, 'PROTOCOL_MISMATCH', 'El worker de Space 3D recibió un sobre vacío.');
  }
  const envelope = request as Partial<Omit<Space3DRunRequest, 'type'>> & Partial<Pick<Space3DStudyRequest, 'study'>> & { readonly type?: string };
  if (envelope.protocolVersion !== SPACE3D_PROTOCOL_VERSION) {
    return error(
      requestId,
      'PROTOCOL_MISMATCH',
      `El worker de Space 3D habla el protocolo ${SPACE3D_PROTOCOL_VERSION} y recibió ${String(envelope.protocolVersion)}.`,
    );
  }
  if (envelope.type === 'study' && envelope.study && typeof envelope.study === 'object') {
    try {
      return {
        protocolVersion: SPACE3D_PROTOCOL_VERSION,
        type: 'study-success',
        requestId,
        outcome: runSpace3DStudy(envelope.project as Space3DProjectV1, envelope.study, envelope.budget),
      };
    } catch (cause) {
      return error(requestId, 'WORKER_FAILURE', cause instanceof Error ? cause.message : 'El estudio espacial terminó de forma inesperada.');
    }
  }
  if (envelope.type !== 'run') {
    return error(requestId, 'UNSUPPORTED_REQUEST', `El worker de Space 3D no admite la petición «${String(envelope.type)}».`);
  }

  try {
    return {
      protocolVersion: SPACE3D_PROTOCOL_VERSION,
      type: 'success',
      requestId,
      result: analyzeSpace3DProject(envelope.project as Space3DProjectV1, String(envelope.targetId), { budget: envelope.budget }),
    };
  } catch (cause) {
    return error(
      requestId,
      'WORKER_FAILURE',
      cause instanceof Error ? cause.message : 'El análisis espacial terminó de forma inesperada.',
    );
  }
};
