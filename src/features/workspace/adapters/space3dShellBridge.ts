import type { Space3DProjectV1 } from '../../../modules/space3d/space3d/model/types';
import type { JsonValue, LinkedSpace3DBranchV1 } from '../../../shared/project/unifiedProjectBundle';

/** Imported/example IDs belong to the standalone editor; the shell owns parent identity. */
export function linkSpace3DToShell(projectId: string, sourceVersion: string, model: Space3DProjectV1): LinkedSpace3DBranchV1 {
  return { sourceProjectId: projectId, sourceVersion,
    model: JSON.parse(JSON.stringify({ ...model, id: `space3d:${projectId}` })) as JsonValue,
  };
}
