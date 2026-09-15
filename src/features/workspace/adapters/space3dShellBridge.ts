import type { Space3DProjectV1 } from '../../../modules/space3d/space3d/model/types';
import type { JsonValue, LinkedSpace3DBranchV1 } from '../../../shared/project/unifiedProjectBundle';
import type { ProjectModel } from '../../../types';

/** Imported/example IDs belong to the standalone editor; the shell owns parent identity. */
export function linkSpace3DToShell(project: ProjectModel, sourceVersion: string, model: Space3DProjectV1): LinkedSpace3DBranchV1;
/** Legacy compatibility: an ID alone cannot establish an exact three-way baseline. */
export function linkSpace3DToShell(project: string, sourceVersion: string, model: Space3DProjectV1): LinkedSpace3DBranchV1;
export function linkSpace3DToShell(project: ProjectModel | string, sourceVersion: string, model: Space3DProjectV1): LinkedSpace3DBranchV1 {
  const projectId = typeof project === 'string' ? project : project.id;
  return { sourceProjectId: projectId, sourceVersion,
    ...(typeof project === 'string' ? {} : { sourceModel2D: structuredClone(project), baselineStatus: 'exact' as const }),
    model: JSON.parse(JSON.stringify({ ...model, id: `space3d:${projectId}` })) as JsonValue,
  };
}
