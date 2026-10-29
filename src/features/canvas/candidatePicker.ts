import type { MemberModel, NodeModel, Selection } from '../../types';
import type { ModelPoint } from './canvasInteraction';
import { circularMemberGeometry, curvePointAt, curveRatioAtPoint } from '../../graphics/memberCurve';
export interface CandidateTarget { kind: 'node' | 'member' | 'nodalLoad' | 'memberLoad'; id: string }
export interface CandidatePickerState { candidates: readonly CandidateTarget[]; activeIndex: number; previousSelection: Selection; additive: boolean; anchor: { x: number; y: number } }
export type CandidatePickerCycle = 'next' | 'previous' | 'first' | 'last';

export const nearestGeometryCandidate = (target: CandidateTarget, candidates: readonly CandidateTarget[], point: ModelPoint,
  nodes: ReadonlyMap<string, NodeModel>, members: ReadonlyMap<string, MemberModel>): CandidateTarget => {
  if (target.kind !== 'node' && target.kind !== 'member') return target;
  const distance = (candidate: CandidateTarget): number => {
    if (candidate.kind === 'node') { const n = nodes.get(candidate.id); return n ? Math.hypot(point.x - n.x, point.y - n.y) : Infinity; }
    const member = members.get(candidate.id), start = member ? nodes.get(member.i) : undefined, end = member ? nodes.get(member.j) : undefined;
    if (!member || !start || !end) return Infinity;
    const arc = circularMemberGeometry(member, start, end);
    if (arc) { const closest = curvePointAt(arc, curveRatioAtPoint(arc, point)); return Math.hypot(point.x - closest.x, point.y - closest.y); }
    const dx = end.x - start.x, dy = end.y - start.y, squared = dx * dx + dy * dy;
    const ratio = squared > 0 ? Math.min(1, Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / squared)) : 0;
    return Math.hypot(point.x - start.x - ratio * dx, point.y - start.y - ratio * dy);
  };
  let nearest = target, nearestDistance = distance(target);
  for (const candidate of candidates) {
    if (candidate.kind !== target.kind) continue;
    const d = distance(candidate);
    if (d < nearestDistance) { nearest = candidate; nearestDistance = d; }
  }
  return nearest;
};
export const createCandidatePickerState = (candidates: readonly CandidateTarget[], previousSelection: Selection,
  anchor: { x: number; y: number }, activeIndex = 0, additive = false): CandidatePickerState | null =>
  candidates.length > 1 ? { candidates: [...candidates], activeIndex: Math.min(Math.max(0, activeIndex), candidates.length - 1), previousSelection, additive, anchor } : null;
export const activeCandidate = (picker: CandidatePickerState): CandidateTarget => picker.candidates[picker.activeIndex]!;
export const cycleCandidatePicker = (picker: CandidatePickerState, direction: CandidatePickerCycle): CandidatePickerState => {
  const last = picker.candidates.length - 1;
  const activeIndex = direction === 'first' ? 0 : direction === 'last' ? last : direction === 'next'
    ? (picker.activeIndex + 1) % picker.candidates.length : (picker.activeIndex - 1 + picker.candidates.length) % picker.candidates.length;
  return activeIndex === picker.activeIndex ? picker : { ...picker, activeIndex };
};
export const candidateToSelection = (candidate: CandidateTarget): Selection => ({ kind: candidate.kind, id: candidate.id });
