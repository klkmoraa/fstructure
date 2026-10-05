import { handleAnalysisWorkerRequest, type AnalysisWorkerResponse } from '../../../engine/analysisWorkerProtocol';
import type { AnalysisResult, ProjectModel } from '../../../types';

let nextRequest = 1;

/** Derivado local: analiza el modelo completo, sin reparar ni escribir el proyecto. */
export async function analyzeSteelModel(project: ProjectModel, combinationId: string, signal: AbortSignal): Promise<AnalysisResult> {
  if (signal.aborted) throw new DOMException('Cálculo cancelado.', 'AbortError');
  const request = { type: 'analyze' as const, requestId: nextRequest++, project, combinationId, includeEducationTrace: false };
  if (typeof Worker === 'undefined') {
    const reply = handleAnalysisWorkerRequest(request);
    if (reply.type === 'analysis-error') throw new Error(reply.message);
    return reply.result;
  }
  const worker = new Worker(new URL('../../../workers/analysis.worker.ts', import.meta.url), { type: 'module' });
  try {
    return await new Promise<AnalysisResult>((resolve, reject) => {
      const abort = () => reject(new DOMException('Cálculo cancelado.', 'AbortError'));
      signal.addEventListener('abort', abort, { once: true });
      const finish = () => signal.removeEventListener('abort', abort);
      worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
        if (signal.aborted || event.data.requestId !== request.requestId) return;
        finish();
        if (event.data.type === 'analysis-result') resolve(event.data.result);
        else reject(new Error(event.data.message));
      };
      worker.onerror = (event) => { event.preventDefault?.(); finish(); reject(new Error('No se pudo analizar la combinación de acero.')); };
      worker.postMessage(request);
    });
  } finally { worker.terminate(); }
}
