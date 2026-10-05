/// <reference lib="webworker" />
import { analyzeModel2dCases, type Model2dAnalysisRequest } from '../../../design/elements/model2dAnalysis';
self.onmessage = (event: MessageEvent<{ requestId: number; analysis: Model2dAnalysisRequest }>) => {
  const { requestId, analysis } = event.data;
  try {
    self.postMessage({ requestId, packet: analyzeModel2dCases(analysis) });
  } catch (error) {
    self.postMessage({
      requestId,
      packet: { ok: false, error: error instanceof Error ? error.message : 'No se pudo analizar el modelo.' },
    });
  }
};
export {};
