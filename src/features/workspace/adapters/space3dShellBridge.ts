import type { Space3DProjectV1 } from '../../../modules/space3d/space3d/model/types';
import type { JsonValue, LinkedSpace3DBranchV1 } from '../../../shared/project/unifiedProjectBundle';

/**
 * Rama `space3d` del proyecto: el modelo 3D con la identidad del proyecto que lo
 * guarda. Los ID de ejemplos o importaciones pertenecen al editor; el shell fija
 * el del proyecto. Sin vínculo con el Modelo 2D.
 */
export function linkSpace3DToShell(projectId: string, sourceVersion: string, model: Space3DProjectV1): LinkedSpace3DBranchV1 {
  return {
    sourceProjectId: projectId,
    sourceVersion,
    model: JSON.parse(JSON.stringify({ ...model, id: `space3d:${projectId}` })) as JsonValue,
  };
}
