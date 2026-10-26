import type { MemberModel, NodeModel, Selection } from '../../types';
import type { ModelPoint } from './canvasInteraction';

/** Candidates retain the model's explicit identity even when their hit areas overlap. */
export interface CandidateTarget {
  kind: 'node' | 'member' | 'nodalLoad' | 'memberLoad';
  id: string;
}

export interface CandidatePickerState {
  candidates: readonly CandidateTarget[];
  activeIndex: number;
  previousSelection: Selection;
  /** The original selection gesture asked to extend the selection. */
  additive: boolean;
  anchor: { x: number; y: number };
}

export type CandidatePickerCycle = 'next' | 'previous' | 'first' | 'last';

/** Expanded finger targets can overlap. Preserve the hit type, then choose its nearest geometry. */
export const nearestGeometryCandidate = (
  target: CandidateTarget,
  candidates: readonly CandidateTarget[],
  point: ModelPoint,
  nodes: ReadonlyMap<string, NodeModel>,
  members: ReadonlyMap<string, MemberModel>,
): CandidateTarget => {
  if (target.kind !== 'node' && target.kind !== 'member') return target;
  const distance = (candidate: CandidateTarget): number => {
    if (candidate.kind === 'node') {
      const node = nodes.get(candidate.id);
      return node ? Math.hypot(point.x - node.x, point.y - node.y) : Infinity;
    }
    const member = members.get(candidate.id);
    const start = member ? nodes.get(member.i) : undefined;
    const end = member ? nodes.get(member.j) : undefined;
    if (!start || !end) return Infinity;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared > 0
      ? Math.min(1, Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
      : 0;
    return Math.hypot(point.x - start.x - ratio * dx, point.y - start.y - ratio * dy);
  };
  let nearest = target;
  let nearestDistance = distance(target);
  for (const candidate of candidates) {
    if (candidate.kind !== target.kind) continue;
    const candidateDistance = distance(candidate);
    // Equal geometry keeps the browser's stable paint order; the picker resolves it explicitly.
    if (candidateDistance < nearestDistance) {
      nearest = candidate;
      nearestDistance = candidateDistance;
    }
  }
  return nearest;
};

const shouldOpenCandidatePicker = (candidateCount: number): boolean => candidateCount > 1;

export const createCandidatePickerState = (
  candidates: readonly CandidateTarget[],
  previousSelection: Selection,
  anchor: { x: number; y: number },
  activeIndex = 0,
  additive = false,
): CandidatePickerState | null => {
  if (!shouldOpenCandidatePicker(candidates.length)) return null;
  return {
    candidates: [...candidates],
    activeIndex: Math.min(Math.max(0, activeIndex), candidates.length - 1),
    previousSelection,
    additive,
    anchor,
  };
};

export const activeCandidate = (picker: CandidatePickerState): CandidateTarget => picker.candidates[picker.activeIndex]!;

export const cycleCandidatePicker = (
  picker: CandidatePickerState,
  direction: CandidatePickerCycle,
): CandidatePickerState => {
  const lastIndex = picker.candidates.length - 1;
  const activeIndex = direction === 'first'
    ? 0
    : direction === 'last'
      ? lastIndex
      : direction === 'next'
        ? (picker.activeIndex + 1) % picker.candidates.length
        : (picker.activeIndex - 1 + picker.candidates.length) % picker.candidates.length;
  return activeIndex === picker.activeIndex ? picker : { ...picker, activeIndex };
};

export const candidateToSelection = (candidate: CandidateTarget): Selection => ({
  kind: candidate.kind,
  id: candidate.id,
});
