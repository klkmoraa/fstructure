import type { ProjectModel } from '../../../types';
import { model2dResultInventory } from '../../../design/elements/model2dResultSnapshot';
import type { ModelResultProvider, ModelResultInventory } from '../../../design/elements/modelResultSnapshot';
import type { Space3DProjectV1 } from '../../../modules/space3d/space3d/model/types';
import { space3dResultInventory } from '../../../integrations/space3dResultSnapshot';

type SerializableModel = { kind: 'model2d'; model: ProjectModel } | { kind: 'model3d'; model: Space3DProjectV1 };
type MemberRequest = { readonly memberId: string; readonly targetId: string; readonly xM: number; readonly side: 'left' | 'right'; readonly axisId?: string };
type SupportRequest = { readonly nodeId: string; readonly targetId: string };

let nextId = 0;
let inFlight = 0;
const MAX_CONCURRENT_ACTIONS = 6;
const canceled = () => new DOMException('Cálculo cancelado.', 'AbortError');

function createProvider(source: SerializableModel, inventory: ModelResultInventory, currentRevision?: () => string | null): ModelResultProvider {
  const run = <T,>(action: 'member' | 'support', request: MemberRequest | SupportRequest, signal: AbortSignal): Promise<T> => {
    if (signal.aborted) return Promise.reject(canceled());
    if (inFlight >= MAX_CONCURRENT_ACTIONS) return Promise.reject(new Error('Hay seis cálculos de origen en curso. Espera a que termine uno.'));
    if (typeof Worker === 'undefined') return Promise.reject(new Error('El worker de resultados no está disponible en este entorno.'));
    inFlight += 1;
    const requestId = ++nextId;
    return new Promise<T>((resolve, reject) => {
      let worker: Worker;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        inFlight = Math.max(0, inFlight - 1);
        signal.removeEventListener('abort', onAbort);
        worker?.terminate();
      };
      const onAbort = () => { finish(); reject(canceled()); };
      try { worker = new Worker(new URL('./modelResult.worker.ts', import.meta.url), { type: 'module' }); }
      catch (error) { inFlight = Math.max(0, inFlight - 1); reject(error); return; }
      signal.addEventListener('abort', onAbort, { once: true });
      worker.onmessage = (event: MessageEvent<{ requestId: number; result?: T; error?: string; revision: string }>) => {
        if (event.data.requestId !== requestId) return;
        finish();
        if (event.data.error) { reject(new Error(event.data.error)); return; }
        if (event.data.revision !== inventory.revision) { reject(new Error('La revisión del origen cambió durante el análisis.')); return; }
        if (currentRevision && currentRevision() !== inventory.revision) { reject(new Error('El origen cambió durante el análisis; vuelve a elegir la demanda.')); return; }
        resolve(event.data.result as T);
      };
      worker.onerror = (event) => { event.preventDefault(); finish(); reject(new Error('Falló el worker de resultados del modelo.')); };
      try {
        worker.postMessage({ requestId, action, source, inventory, request });
      } catch (error) { finish(); reject(error); }
    });
  };
  return {
    inventory,
    member: (request, signal) => run('member', request, signal),
    support: (request, signal) => run('support', request, signal),
  };
}

export const model2dResultProviderWithWorker = (model: ProjectModel, currentRevision?: () => string | null) => createProvider({ kind: 'model2d', model }, model2dResultInventory(model), currentRevision);
export const space3dResultProviderWithWorker = (model: Space3DProjectV1, currentRevision?: () => string | null) => createProvider({ kind: 'model3d', model }, space3dResultInventory(model), currentRevision);
