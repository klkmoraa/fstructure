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
import type { SparseMatrixCSC } from './sparse';

export interface SparseLinearAnalysisPayload {
  readonly kind: 'sparse-linear-system';
  readonly matrix: SparseMatrixCSC;
  readonly rhs: readonly number[];
}

export const estimateSparseAnalysisPayload = (payload: SparseLinearAnalysisPayload): number =>
  estimateSparseLinearSystemBytes({
    dimension: Math.max(payload.matrix.rowCount, payload.matrix.columnCount),
    nonZeros: payload.matrix.values.length,
    rhsCount: 1,
  });

const identity = (request: AnalysisJobRequest<SparseLinearAnalysisPayload>) => ({
  protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
  jobId: request.jobId,
  sourceVersion: request.sourceVersion,
  targetId: request.targetId,
});

export const handleNumericWorkerRequest = async (
  envelope: AnalysisWorkerRunRequest<SparseLinearAnalysisPayload>,
  publish: (message: AnalysisWorkerResponse<FaerWasmSolveResult>) => void,
): Promise<void> => {
  const request = envelope.request;
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
    estimateBytes: estimateSparseAnalysisPayload,
    currentSourceVersion,
  });
