import { summarizeExternalStructure, type StructureAxisSummary, type StructureDesignOptions } from '../../../design/elements/structure';
import { space3dDesignAxes } from '../../../integrations/space3dDesign';
import type { Space3DProjectV1 } from '../../../modules/space3d/space3d/model/types';

/** Pedido al worker: el Modelo 3D (datos planos) y qué ejes diseñar. */
export interface Space3DDesignAllRequest {
  readonly requestId: number;
  readonly model: Space3DProjectV1;
  readonly axisIds: readonly string[];
  readonly options: StructureDesignOptions;
  readonly braced: boolean;
}

export type Space3DDesignAllMessage =
  | { readonly requestId: number; readonly type: 'axis'; readonly axisId: string; readonly summary: StructureAxisSummary }
  | { readonly requestId: number; readonly type: 'done' };

/**
 * Diseña los ejes pedidos y entrega cada resumen al terminarlo. Lo corre el
 * worker; es la misma cuenta que la mesa hace en el hilo principal.
 */
export function designSpace3DAxes(request: Space3DDesignAllRequest, post: (message: Space3DDesignAllMessage) => void): void {
  const axes = space3dDesignAxes(request.model);
  for (const axisId of request.axisIds) {
    let summary: StructureAxisSummary;
    try { summary = summarizeExternalStructure(axes.source(axisId), request.options, request.braced); }
    catch (error) { summary = { ok: false, error: error instanceof Error ? error.message : 'No se pudo diseñar.' }; }
    post({ requestId: request.requestId, type: 'axis', axisId, summary });
  }
  post({ requestId: request.requestId, type: 'done' });
}
