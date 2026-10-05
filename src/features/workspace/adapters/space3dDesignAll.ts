import { summarizeExternalStructure, type ExternalStructureAxes, type StructureAxisSummary } from '../../../design/elements/structure';
import { space3dDesignAxes } from '../../../integrations/space3dDesign';
import type { Space3DProjectV1 } from '../../../modules/space3d/space3d/model/types';
import type { Space3DDesignAllMessage, Space3DDesignAllRequest } from './space3dDesignTask';

let nextRequestId = 1;

/**
 * Los ejes del Modelo 3D con `designAll`: «Revisar todos los ejes» corre en un
 * worker y la mesa sigue fluida. Si el worker no existe o falla, los ejes que
 * falten se diseñan uno por tick en el hilo principal.
 */
export function space3dDesignAxesWithWorker(model: Space3DProjectV1): ExternalStructureAxes {
  const axes = space3dDesignAxes(model);
  return {
    ...axes,
    designAll(request, onAxis) {
      const pending = new Set(axes.axes.map((axis) => axis.id));
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let worker: Worker | null = null;
      const deliver = (axisId: string, summary: StructureAxisSummary) => {
        if (cancelled || !pending.delete(axisId)) return;
        onAxis(axisId, summary);
      };
      const mainThread = () => {
        worker?.terminate();
        worker = null;
        const step = () => {
          if (cancelled) return;
          const axisId = pending.values().next().value;
          if (axisId === undefined) return;
          let summary: StructureAxisSummary;
          try { summary = summarizeExternalStructure(axes.source(axisId), request.options, request.braced); }
          catch (error) { summary = { ok: false, error: error instanceof Error ? error.message : 'No se pudo diseñar.' }; }
          deliver(axisId, summary);
          timer = setTimeout(step, 0);
        };
        timer = setTimeout(step, 0);
      };
      if (typeof Worker === 'undefined' || !pending.size) { mainThread(); }
      else {
        const requestId = nextRequestId++;
        try {
          worker = new Worker(new URL('./space3dDesign.worker.ts', import.meta.url), { type: 'module' });
          worker.onmessage = (event: MessageEvent<Space3DDesignAllMessage>) => {
            const message = event.data;
            if (cancelled || message.requestId !== requestId) return;
            if (message.type === 'axis') deliver(message.axisId, message.summary);
            else { worker?.terminate(); worker = null; if (pending.size) mainThread(); }
          };
          worker.onerror = (event) => { event.preventDefault?.(); mainThread(); };
          const payload: Space3DDesignAllRequest = { requestId, model, axisIds: [...pending], options: request.options, braced: request.braced };
          worker.postMessage(payload);
        } catch { mainThread(); }
      }
      return () => {
        cancelled = true;
        if (timer !== null) clearTimeout(timer);
        worker?.terminate();
        worker = null;
      };
    },
  };
}
