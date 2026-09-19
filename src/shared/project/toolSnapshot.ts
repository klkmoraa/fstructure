import type { AnalysisResult, ProjectModel, Selection } from '../../types';
import type { ToolId } from '../contracts';

export interface EntityReference {
  readonly projectId: string;
  readonly tool: ToolId;
  readonly kind: 'node' | 'member' | 'nodalLoad' | 'memberLoad';
  readonly id: string;
}
export interface SolverSnapshot {
  readonly sourceProjectId: string;
  readonly sourceVersion: string;
  readonly reliability: 'reliable' | 'limited' | 'unreliable';
  readonly model: Readonly<ProjectModel>;
  readonly result: Readonly<AnalysisResult>;
}
export function map2DSelection(projectId: string, selection: Selection): readonly EntityReference[] {
  if (!selection) return [];
  if (selection.kind === 'multi') return [
    ...selection.nodeIds.map((id): EntityReference => ({ projectId, tool: 'model2d', kind: 'node', id })),
    ...selection.memberIds.map((id): EntityReference => ({ projectId, tool: 'model2d', kind: 'member', id })),
  ];
  return [{ projectId, tool: 'model2d', ...selection }];
}
function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}
export function createSolverSnapshot(project: ProjectModel, sourceVersion: string, result: AnalysisResult): SolverSnapshot | null {
  if (!result.success) return null;
  const reliability = result.reliability?.completed && result.reliability.usable ? result.reliability.level : 'unreliable';
  return freezeDeep({ sourceProjectId: project.id, sourceVersion,
    reliability: reliability === 'reliable' ? 'reliable' : reliability === 'limited' ? 'limited' : 'unreliable',
    model: structuredClone(project), result: structuredClone(result),
  });
}
