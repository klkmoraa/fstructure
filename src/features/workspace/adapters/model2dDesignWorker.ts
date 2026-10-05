import { model2dDesignSource } from '../../../design/elements/model2dSource';
import { hydrateModel2dCases, type Model2dAnalysisPacket, type Model2dAnalysisRequest } from '../../../design/elements/model2dAnalysis';
import { designStructure, type StructureAnalysisOutcome } from '../../../design/elements/structure';
import type { ProjectModel } from '../../../types';

class MissingAnalysis {
  readonly key: string;
  readonly request: Model2dAnalysisRequest;
  constructor(key: string, request: Model2dAnalysisRequest) {
    this.key = key;
    this.request = request;
  }
}
let requestId = 0;
const abort = () => new DOMException('Cálculo cancelado', 'AbortError');

/** Reproduce el diseño sólo cuando falta un análisis: base o inercia agrietada. Ningún closure cruza el worker. */
export function model2dDesignSourceWithWorker(project: ProjectModel) {
  const external = model2dDesignSource(project);
  const cache = new Map<string, StructureAnalysisOutcome>();
  return {
    ...external,
    async designAsync(options: Parameters<typeof designStructure>[1], braced: boolean, signal: AbortSignal) {
      if (signal.aborted) throw abort();
      if (external.errors.length) return { ok: false as const, errors: external.errors };
      if (typeof Worker === 'undefined') return designStructure(external.create({ braced })!, options);
      let worker: Worker | null = null;
      try {
        worker = new Worker(new URL('./model2dDesign.worker.ts', import.meta.url), { type: 'module' });
        const source = model2dDesignSource(project, (request) => {
          const key = JSON.stringify([request.cases.map((c) => c.solverId), request.model.members.map((m) => m.I)]);
          const known = cache.get(key);
          if (known) return known;
          throw new MissingAnalysis(key, request);
        }).create({ braced })!;
        for (let round = 0; round < project.members.length + 3; round++) {
          if (signal.aborted) throw abort();
          try {
            return designStructure(source, options);
          } catch (error) {
            if (!(error instanceof MissingAnalysis)) throw error;
            const id = ++requestId;
            const packet = await new Promise<Model2dAnalysisPacket>((resolve, reject) => {
              const cancel = () => {
                worker?.terminate();
                reject(abort());
              };
              const finish = () => signal.removeEventListener('abort', cancel);
              signal.addEventListener('abort', cancel, { once: true });
              worker!.onmessage = (event: MessageEvent<{ requestId: number; packet: Model2dAnalysisPacket }>) => {
                if (event.data.requestId !== id) return;
                finish();
                resolve(event.data.packet);
              };
              worker!.onerror = (event) => {
                event.preventDefault();
                finish();
                reject(new Error('Falló el worker de análisis. Recarga la mesa para reintentarlo.'));
              };
              try {
                worker!.postMessage({ requestId: id, analysis: error.request });
              } catch (failure) {
                finish();
                reject(failure);
              }
            });
            if (signal.aborted) throw abort();
            if (cache.size >= 24) cache.delete(cache.keys().next().value!);
            cache.set(error.key, hydrateModel2dCases(packet));
            // Cede una tarea entre las pasadas del diseño y deja pintar la mesa.
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
          }
        }
        return { ok: false as const, errors: ['El diseño agotó sus recálculos de inercia.'] };
      } finally {
        worker?.terminate();
      }
    },
  };
}
