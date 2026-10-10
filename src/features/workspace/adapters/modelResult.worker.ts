/// <reference lib="webworker" />
import { analyzeModel2dSupport, analyzeModel2dTarget } from '../../../design/elements/model2dResultSnapshot';
import type { ModelResultInventory } from '../../../design/elements/modelResultSnapshot';
import { analyzeSpace3dSupport, analyzeSpace3dTarget } from '../../../integrations/space3dResultSnapshot';
import type { ProjectModel } from '../../../types';
import type { Space3DProjectV1 } from '../../../modules/space3d/space3d/model/types';

type Request = {
  readonly requestId: number;
  readonly action: 'member' | 'support';
  readonly source: { readonly kind: 'model2d'; readonly model: ProjectModel } | { readonly kind: 'model3d'; readonly model: Space3DProjectV1 };
  readonly inventory: ModelResultInventory;
  readonly request: { readonly memberId: string; readonly targetId: string; readonly xM: number; readonly side: 'left' | 'right'; readonly axisId?: string } | { readonly nodeId: string; readonly targetId: string };
};

self.onmessage = (event: MessageEvent<Request>) => {
  const { requestId, source, inventory, request, action } = event.data;
  try {
    const result = source.kind === 'model2d'
      ? action === 'member'
        ? analyzeModel2dTarget(source.model, inventory, request as Extract<Request['request'], { memberId: string }>)
        : analyzeModel2dSupport(source.model, inventory, request as Extract<Request['request'], { nodeId: string }>)
      : action === 'member'
        ? analyzeSpace3dTarget(source.model, inventory, request as Extract<Request['request'], { memberId: string }>)
        : analyzeSpace3dSupport(source.model, inventory, request as Extract<Request['request'], { nodeId: string }>);
    self.postMessage({ requestId, revision: inventory.revision, result });
  } catch (error) {
    self.postMessage({ requestId, revision: inventory.revision, error: error instanceof Error ? error.message : 'No se pudo obtener el resultado del modelo.' });
  }
};
