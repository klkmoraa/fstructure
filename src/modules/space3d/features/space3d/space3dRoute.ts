import type { Space3DAnalysisState } from '../../space3d/store/Space3DProjectContext';
import type { Space3DProjectV1 } from '../../space3d/model/types';

export type Space3DGuideStepId = 'geometry' | 'supports' | 'loads' | 'analysis';
type Space3DGuideStepState = 'done' | 'current' | 'pending';

export type Space3DGuideAction =
  | 'start'
  | 'add-node'
  | 'add-member'
  | 'add-support'
  | 'add-load'
  | 'analyze'
  | 'running'
  | 'reanalyze'
  | 'review-failure'
  | 'explore-results';

export interface Space3DGuideStep {
  readonly id: Space3DGuideStepId;
  readonly state: Space3DGuideStepState;
}

export interface Space3DGuide {
  readonly steps: readonly Space3DGuideStep[];
  readonly next: Space3DGuideAction;
  /** Nudo propuesto para la acción: el más bajo recibe apoyos, el más alto cargas. */
  readonly nodeId: string | null;
  readonly counts: {
    readonly nodes: number;
    readonly members: number;
    readonly supports: number;
    readonly loads: number;
  };
}

const isSupported = (node: Space3DProjectV1['nodes'][number]) => Object.values(node.restraints).some(Boolean);

const extremeNode = (project: Space3DProjectV1, pick: 'lowest' | 'highest'): string | null => {
  let best: Space3DProjectV1['nodes'][number] | null = null;
  for (const node of project.nodes) {
    if (!best || (pick === 'lowest' ? node.y < best.y : node.y > best.y)) best = node;
  }
  return best?.id ?? null;
};

/**
 * Orden físico del cálculo: sin geometría no hay apoyos, sin apoyos el sistema
 * es un mecanismo y sin cargas la respuesta es nula. La ruta sólo describe el
 * estado; nunca modifica el proyecto.
 */
export const deriveSpace3DGuide = (
  project: Space3DProjectV1,
  analysisState: Space3DAnalysisState,
): Space3DGuide => {
  const counts = {
    nodes: project.nodes.length,
    members: project.members.length,
    supports: project.nodes.filter(isSupported).length,
    loads: project.nodalLoads.length,
  };
  const done: Record<Space3DGuideStepId, boolean> = {
    geometry: counts.nodes >= 2 && counts.members >= 1,
    supports: counts.supports >= 1,
    loads: counts.loads >= 1,
    analysis: analysisState === 'ready',
  };
  const order: readonly Space3DGuideStepId[] = ['geometry', 'supports', 'loads', 'analysis'];
  const current = order.find((id) => !done[id]) ?? null;
  const steps = order.map((id) => ({
    id,
    state: done[id] ? 'done' as const : id === current ? 'current' as const : 'pending' as const,
  }));

  let next: Space3DGuideAction;
  let nodeId: string | null = null;
  if (counts.nodes === 0) next = 'start';
  else if (counts.nodes === 1) next = 'add-node';
  else if (counts.members === 0) next = 'add-member';
  else if (counts.supports === 0) { next = 'add-support'; nodeId = extremeNode(project, 'lowest'); }
  else if (counts.loads === 0) { next = 'add-load'; nodeId = extremeNode(project, 'highest'); }
  else if (analysisState === 'running') next = 'running';
  else if (analysisState === 'failed') next = 'review-failure';
  else if (analysisState === 'stale') next = 'reanalyze';
  else if (analysisState === 'ready') next = 'explore-results';
  else next = 'analyze';

  return { steps, next, nodeId, counts };
};
