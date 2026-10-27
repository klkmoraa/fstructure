import type { MemberLoad, NodalLoad, ProjectModel, Selection } from '../../types';
import { fromDisplay, toDisplay } from '../../foundation/units';
import { unitLabel } from '../../engine/units';
import { parseLocalizedDecimal } from './quickEntry';
import { readLoadQuickValue, type LoadQuickValue } from './loadQuickValue';

type LoadSelection = Extract<NonNullable<Selection>, { kind: 'nodalLoad' | 'memberLoad' }>;
export interface LoadEditSession {
  projectId: string;
  units: ProjectModel['settings']['units'];
  selection: LoadSelection;
  source: NodalLoad | MemberLoad;
  initial: LoadQuickValue;
}
const sourceFor = (project: ProjectModel, selection: LoadSelection) => selection.kind === 'nodalLoad'
  ? project.nodalLoads.find(load => load.id === selection.id)
  : project.memberLoads.find(load => load.id === selection.id);

export function beginLoadEdit(project: ProjectModel, selection: Selection): LoadEditSession | null {
  if (selection?.kind !== 'nodalLoad' && selection?.kind !== 'memberLoad') return null;
  const initial = readLoadQuickValue(project, selection);
  const source = sourceFor(project, selection);
  return initial && source ? { projectId: project.id, units: structuredClone(project.settings.units), selection: { ...selection }, source: { ...source }, initial } : null;
}

export const isLoadEditCurrent = (project: ProjectModel, session: LoadEditSession): boolean =>
  project.id === session.projectId && JSON.stringify(project.settings.units) === JSON.stringify(session.units)
  && JSON.stringify(sourceFor(project, session.selection)) === JSON.stringify(session.source);

export type LoadEditResult = { ok: true; project: ProjectModel } | { ok: false; reason: 'magnitude' | 'direction' | 'stale' };

/** Prepare one reversible update; never write a draft into the live model. */
export function prepareLoadEdit(project: ProjectModel, session: LoadEditSession, value: string, angle: string, flipped: boolean): LoadEditResult {
  if (!isLoadEditCurrent(project, session)) return { ok: false, reason: 'stale' };
  const { initial, units, selection } = session;
  const displayed = toDisplay(initial.magnitude, units, initial.quantity);
  const typed = value === String(displayed) ? displayed : parseLocalizedDecimal(value, unitLabel(units, initial.quantity));
  if (typed === null) return { ok: false, reason: 'magnitude' };
  // As before, magnitude is unsigned; the direction controls its sense.
  const magnitude = Math.abs(typed) === toDisplay(initial.magnitude, units, initial.quantity)
    ? initial.magnitude : fromDisplay(Math.abs(typed), units, initial.quantity);
  if (!Number.isFinite(magnitude)) return { ok: false, reason: 'magnitude' };
  const requested = initial.quantity === 'moment' || angle === String(initial.direction) ? initial.direction : parseLocalizedDecimal(angle, '°');
  if (requested === null) return { ok: false, reason: 'direction' };
  // Reduce before subtracting to avoid overflow for a very large finite angle.
  const delta = ((requested % 360 - initial.direction % 360) % 360 + 360) % 360;
  if (magnitude === initial.magnitude && (initial.quantity === 'moment' ? !flipped : delta === 0)) return { ok: true, project };
  const trig = (v: number) => Math.abs(v) < 1e-14 ? 0 : Math.abs(v - 1) < 1e-14 ? 1 : Math.abs(v + 1) < 1e-14 ? -1 : v;
  const c = trig(Math.cos(delta * Math.PI / 180));
  const s = trig(Math.sin(delta * Math.PI / 180));
  const rotate = (x = 0, y = 0): [number, number] => {
    if (initial.magnitude === 0) {
      const radians = requested % 360 * Math.PI / 180;
      return [magnitude * trig(Math.cos(radians)), magnitude * trig(Math.sin(radians))];
    }
    // Normalize first; x * magnitude can overflow even when the answer is finite.
    const nx = x / initial.magnitude; const ny = y / initial.magnitude;
    return [(nx * c - ny * s) * magnitude || 0, (nx * s + ny * c) * magnitude || 0];
  };
  const moment = magnitude === 0 ? 0 : initial.direction * (flipped ? -1 : 1) * magnitude;
  let edited: NodalLoad | MemberLoad;
  if (selection.kind === 'nodalLoad') {
    const load = { ...session.source } as NodalLoad;
    if (initial.quantity === 'moment') load.mz = moment;
    else [load.fx, load.fy] = rotate(load.fx, load.fy);
    edited = load;
  } else {
    const load = { ...session.source } as MemberLoad;
    if (load.type === 'moment') load.moment = moment;
    else if (load.type === 'point') [load.px, load.py] = rotate(load.px, load.py);
    else {
      // Rotate both vectors by the same angle, preserving opposite signs and zero ends.
      [load.qxStart, load.qyStart] = rotate(load.qxStart, load.qyStart);
      [load.qxEnd, load.qyEnd] = rotate(load.qxEnd, load.qyEnd);
    }
    edited = load;
  }
  if (Object.values(edited).some(v => typeof v === 'number' && !Number.isFinite(v))) return { ok: false, reason: 'magnitude' };
  return { ok: true, project: selection.kind === 'nodalLoad'
    ? { ...project, nodalLoads: project.nodalLoads.map(load => load.id === selection.id ? edited as NodalLoad : load) }
    : { ...project, memberLoads: project.memberLoads.map(load => load.id === selection.id ? edited as MemberLoad : load) } };
}
