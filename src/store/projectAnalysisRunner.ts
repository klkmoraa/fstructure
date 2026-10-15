import type { AnalysisWorkerResponse } from '../engine/analysisWorkerProtocol';
import type { AnalysisResult, ProjectModel } from '../types';
import { WORKER_PROTOCOL_VERSION, type AnalysisWorkerPayload, type WorkerRequestEnvelope, type WorkerResponseEnvelope } from '../runtime/workerProtocol';

/** Mensaje que devuelve el worker de análisis (sobre del protocolo o respuesta heredada). */
export type AnalysisWorkerMessage = WorkerResponseEnvelope<'analysis', AnalysisResult> | AnalysisWorkerResponse;

/** El análisis en el hilo principal, cargado bajo demanda, cuando no hay worker. */
export const runFallbackAnalysis = async (project: ProjectModel, combinationId: string, includeEducationTrace: boolean) => {
  const { analyzeProjectAuto } = await import('../engine/pDelta');
  const combination = project.combinations.find((item) => item.id === combinationId) ?? null;
  return analyzeProjectAuto(project, combination, { includeEducationTrace });
};

export const createAnalysisWorker = () => new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' });

export const analysisWorkerRequest = (
  project: ProjectModel,
  combinationId: string,
  requestId: number,
  includeEducationTrace: boolean,
): WorkerRequestEnvelope<'analysis', AnalysisWorkerPayload> => ({
  protocolVersion: WORKER_PROTOCOL_VERSION, type: 'run', domain: 'analysis', requestId,
  payload: { project, combinationId: combinationId || null, includeEducationTrace },
});

/**
 * Worker o, si falta, hilo principal para `ensureEducationTrace`: a diferencia
 * de `analyze()`, nunca toca historial, selección ni la revisión que gobierna el
 * análisis interactivo; sólo calcula un resultado extra, bajo demanda, para leer
 * su `educationTrace`.
 */
export const runAnalysisWithTrace = (source: ProjectModel, combinationId: string): Promise<AnalysisResult> => new Promise((resolve, reject) => {
  const runFallback = () => {
    void runFallbackAnalysis(source, combinationId, true).then(resolve).catch(reject);
  };
  if (typeof Worker === 'undefined') {
    runFallback();
    return;
  }
  try {
    const worker = createAnalysisWorker();
    let settled = false;
    const fallbackOnce = () => {
      if (settled) return;
      settled = true;
      worker.terminate();
      runFallback();
    };
    worker.onmessage = (event: MessageEvent<AnalysisWorkerMessage>) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      if (event.data.type === 'success' || event.data.type === 'analysis-result') resolve(event.data.result);
      else reject(new Error(event.data.type === 'error' ? event.data.error.message : event.data.message));
    };
    worker.onerror = fallbackOnce;
    worker.postMessage(analysisWorkerRequest(source, combinationId, 0, true));
  } catch {
    runFallback();
  }
});
