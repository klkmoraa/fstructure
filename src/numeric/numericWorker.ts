import type { AnalysisJobRequest } from '../shared/contracts';
import { estimateSparseLinearSystemBytes } from './admission';
import {
  ANALYSIS_WORKER_PROTOCOL_VERSION,
  AdaptiveAnalysisJobRuntime,
  type AnalysisWorkerLike,
  type AnalysisWorkerResponse,
  type AnalysisWorkerRunRequest,
} from './analysisRuntime';
import { solveCscWithFaerWasm, type FaerWasmSolveResult } from './faerWasmBackend';
import { validateCscMatrix, type SparseMatrixCSC } from './sparse';

export interface SparseLinearAnalysisPayload {
  readonly kind: 'sparse-linear-system';
  readonly matrix: SparseMatrixCSC;
  readonly rhs: readonly number[];
}

export const validateSparseAnalysisPayload = (payload: SparseLinearAnalysisPayload): void => {
  if (payload?.kind !== 'sparse-linear-system') throw new Error('Unsupported numerical payload.');
  validateCscMatrix(payload.matrix);
  if (payload.matrix.rowCount !== payload.matrix.columnCount || payload.rhs.length !== payload.matrix.rowCount) {
    throw new Error('Sparse linear system dimensions are incompatible.');
  }
  if (payload.rhs.some((value) => !Number.isFinite(value))) {
    throw new Error('Sparse right-hand side must contain only finite values.');
  }
};

export const estimateSparseAnalysisPayload = (payload: SparseLinearAnalysisPayload): number => {
  validateSparseAnalysisPayload(payload);
  return estimateSparseLinearSystemBytes({
    dimension: Math.max(payload.matrix.rowCount, payload.matrix.columnCount),
    nonZeros: payload.matrix.values.length,
    rhsCount: 1,
  });
};

const identity = (request: AnalysisJobRequest<SparseLinearAnalysisPayload>) => ({
  protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
  jobId: request.jobId,
  sourceVersion: request.sourceVersion,
  targetId: request.targetId,
});

export const handleNumericWorkerRequest = async (
  envelope: unknown,
  publish: (message: AnalysisWorkerResponse<FaerWasmSolveResult>) => void,
): Promise<void> => {
  const candidate = envelope as Partial<AnalysisWorkerRunRequest<SparseLinearAnalysisPayload>> | null;
  const requestCandidate = candidate?.request as Partial<AnalysisJobRequest<SparseLinearAnalysisPayload>> | undefined;
  const rejectedBase = {
    protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
    jobId: typeof requestCandidate?.jobId === 'string' ? requestCandidate.jobId : '',
    sourceVersion: typeof requestCandidate?.sourceVersion === 'string' ? requestCandidate.sourceVersion : '',
    targetId: typeof requestCandidate?.targetId === 'string' ? requestCandidate.targetId : '',
  } as const;
  if (candidate?.protocolVersion !== ANALYSIS_WORKER_PROTOCOL_VERSION) {
    publish({ ...rejectedBase, type: 'error', code: 'PROTOCOL_MISMATCH', message: 'Numerical worker protocol does not match the app.' });
    return;
  }
  if (candidate.type !== 'run' || !candidate.request) {
    publish({ ...rejectedBase, type: 'error', code: 'UNSUPPORTED_REQUEST', message: 'Numerical worker request is unsupported.' });
    return;
  }
  const envelopeRequest = candidate.request;
  if (typeof envelopeRequest.jobId !== 'string'
    || typeof envelopeRequest.sourceVersion !== 'string'
    || typeof envelopeRequest.targetId !== 'string') {
    publish({ ...rejectedBase, type: 'error', code: 'INVALID_REQUEST', message: 'Numerical worker request identity is invalid.' });
    return;
  }
  const request = envelopeRequest;
  const base = identity(request);
  try {
    publish({ ...base, type: 'progress', phase: 'assembly', completed: 1, total: 1 });
    publish({ ...base, type: 'progress', phase: 'factorization', completed: 0, total: 1 });
    const result = await solveCscWithFaerWasm(request.payload.matrix, request.payload.rhs);
    publish({ ...base, type: 'progress', phase: 'solve', completed: 1, total: 1 });
    publish({ ...base, type: 'progress', phase: 'quality', completed: 1, total: 1 });
    publish({ ...base, type: 'success', result, quality: result.quality });
  } catch (cause) {
    publish({
      ...base,
      type: 'error',
      code: 'NUMERICAL_FAILURE',
      message: cause instanceof Error ? cause.message : 'Numerical worker failed.',
    });
  }
};

const createWorker = (): AnalysisWorkerLike =>
  new Worker(new URL('./numeric.worker.ts', import.meta.url), { type: 'module' }) as unknown as AnalysisWorkerLike;

export const createSparseAnalysisRuntime = (
  currentSourceVersion: (targetId: string) => string | undefined,
): AdaptiveAnalysisJobRuntime<SparseLinearAnalysisPayload, FaerWasmSolveResult> =>
  new AdaptiveAnalysisJobRuntime({
    createWorker,
    validatePayload: validateSparseAnalysisPayload,
    estimateBytes: estimateSparseAnalysisPayload,
    currentSourceVersion,
  });
