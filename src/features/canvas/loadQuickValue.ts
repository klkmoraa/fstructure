import type { UnitQuantity } from '../../foundation/units';
import type { ProjectModel as Project, Selection } from '../../types';

/**
 * El valor principal de una carga, para editarlo sin abrir el inspector: la
 * magnitud y hacia dónde actúa. Al cambiar la magnitud se conserva la
 * dirección (y la forma, en una distribuida variable); invertir cambia el
 * sentido sin tocar la magnitud. Unidades internas: kN, kN/m, kN·m.
 */
export interface LoadQuickValue {
  id: string;
  quantity: Extract<UnitQuantity, 'force' | 'distributedForce' | 'moment'>;
  /** Siempre ≥ 0. */
  magnitude: number;
  /** Fuerzas: ángulo del vector en grados (−90 = hacia abajo). Momentos: +1 antihorario, −1 horario. */
  direction: number;
}

const hypot = (x = 0, y = 0) => Math.hypot(x, y);
const EPS = 1e-12;

export const readLoadQuickValue = (project: Project, selection: Selection): LoadQuickValue | null => {
  if (selection?.kind === 'nodalLoad') {
    const load = project.nodalLoads.find((item) => item.id === selection.id);
    if (!load) return null;
    const force = hypot(load.fx, load.fy);
    if (force < EPS && Math.abs(load.mz) > EPS) return { id: load.id, quantity: 'moment', magnitude: Math.abs(load.mz), direction: Math.sign(load.mz) };
    return { id: load.id, quantity: 'force', magnitude: force, direction: force < EPS ? -90 : Math.atan2(load.fy, load.fx) * 180 / Math.PI };
  }
  if (selection?.kind === 'memberLoad') {
    const load = project.memberLoads.find((item) => item.id === selection.id);
    if (!load) return null;
    if (load.type === 'moment') {
      const moment = load.moment ?? 0;
      return { id: load.id, quantity: 'moment', magnitude: Math.abs(moment), direction: moment < 0 ? -1 : 1 };
    }
    if (load.type === 'point') {
      const force = hypot(load.px, load.py);
      return { id: load.id, quantity: 'force', magnitude: force, direction: force < EPS ? -90 : Math.atan2(load.py ?? 0, load.px ?? 0) * 180 / Math.PI };
    }
    const start = hypot(load.qxStart, load.qyStart);
    const end = hypot(load.qxEnd, load.qyEnd);
    const governing = start >= end
      ? { x: load.qxStart ?? 0, y: load.qyStart ?? 0, magnitude: start }
      : { x: load.qxEnd ?? 0, y: load.qyEnd ?? 0, magnitude: end };
    return {
      id: load.id,
      quantity: 'distributedForce',
      magnitude: governing.magnitude,
      direction: governing.magnitude < EPS ? -90 : Math.atan2(governing.y, governing.x) * 180 / Math.PI,
    };
  }
  return null;
};

/** Escala un vector a `magnitude`; uno nulo toma la dirección por omisión (hacia abajo). */
const scaled = (x: number, y: number, magnitude: number) => {
  const current = Math.hypot(x, y);
  if (current < EPS) return { x: 0, y: -magnitude };
  return { x: x * magnitude / current, y: y * magnitude / current };
};

/** Fija la magnitud de la carga seleccionada conservando su dirección. Muta `draft`. */
export const withLoadMagnitude = (draft: Project, selection: Selection, rawMagnitude: number): Project => {
  const magnitude = Math.abs(rawMagnitude);
  if (selection?.kind === 'nodalLoad') {
    const load = draft.nodalLoads.find((item) => item.id === selection.id);
    if (!load) return draft;
    if (hypot(load.fx, load.fy) < EPS && Math.abs(load.mz) > EPS) {
      load.mz = Math.sign(load.mz) * magnitude;
      return draft;
    }
    const next = scaled(load.fx, load.fy, magnitude);
    load.fx = next.x;
    load.fy = next.y;
    return draft;
  }
  if (selection?.kind !== 'memberLoad') return draft;
  const load = draft.memberLoads.find((item) => item.id === selection.id);
  if (!load) return draft;
  if (load.type === 'moment') {
    load.moment = ((load.moment ?? 0) < 0 ? -1 : 1) * magnitude;
  } else if (load.type === 'point') {
    const next = scaled(load.px ?? 0, load.py ?? 0, magnitude);
    load.px = next.x;
    load.py = next.y;
  } else {
    const start = hypot(load.qxStart, load.qyStart);
    const end = hypot(load.qxEnd, load.qyEnd);
    const governing = Math.max(start, end);
    if (governing < EPS) {
      load.qyStart = -magnitude;
      load.qyEnd = -magnitude;
      return draft;
    }
    // La forma (trapecio, triángulo) se conserva: se escalan los dos extremos.
    const factor = magnitude / governing;
    if (load.qxStart !== undefined) load.qxStart *= factor;
    if (load.qxEnd !== undefined) load.qxEnd *= factor;
    if (load.qyStart !== undefined) load.qyStart *= factor;
    if (load.qyEnd !== undefined) load.qyEnd *= factor;
  }
  return draft;
};

/** Invierte el sentido de la carga seleccionada sin cambiar su magnitud. Muta `draft`. */
export const withLoadFlipped = (draft: Project, selection: Selection): Project => {
  const negate = (value: number | undefined) => value === undefined ? undefined : (value === 0 ? 0 : -value);
  if (selection?.kind === 'nodalLoad') {
    const load = draft.nodalLoads.find((item) => item.id === selection.id);
    if (!load) return draft;
    if (hypot(load.fx, load.fy) < EPS) load.mz = negate(load.mz) ?? 0;
    else { load.fx = negate(load.fx) ?? 0; load.fy = negate(load.fy) ?? 0; }
    return draft;
  }
  if (selection?.kind !== 'memberLoad') return draft;
  const load = draft.memberLoads.find((item) => item.id === selection.id);
  if (!load) return draft;
  if (load.type === 'moment') load.moment = negate(load.moment);
  else if (load.type === 'point') { load.px = negate(load.px); load.py = negate(load.py); }
  else {
    load.qxStart = negate(load.qxStart);
    load.qxEnd = negate(load.qxEnd);
    load.qyStart = negate(load.qyStart);
    load.qyEnd = negate(load.qyEnd);
  }
  return draft;
};

/**
 * Apunta la carga seleccionada hacia `angleDeg` (0 = +X, 90 = +Y, −90 = abajo)
 * conservando su magnitud y, en una distribuida, la forma de sus extremos. No
 * actúa sobre momentos. Muta `draft`.
 */
export const withLoadDirection = (draft: Project, selection: Selection, angleDeg: number): Project => {
  const cos = Math.round(Math.cos(angleDeg * Math.PI / 180) * 1e12) / 1e12;
  const sin = Math.round(Math.sin(angleDeg * Math.PI / 180) * 1e12) / 1e12;
  const aim = (x: number | undefined, y: number | undefined, fallback: number) => {
    const m = Math.hypot(x ?? 0, y ?? 0) || fallback;
    return { x: m * cos, y: m * sin };
  };
  if (selection?.kind === 'nodalLoad') {
    const load = draft.nodalLoads.find((item) => item.id === selection.id);
    if (!load || Math.hypot(load.fx, load.fy) < EPS) return draft;
    const next = aim(load.fx, load.fy, 0);
    load.fx = next.x;
    load.fy = next.y;
    return draft;
  }
  if (selection?.kind !== 'memberLoad') return draft;
  const load = draft.memberLoads.find((item) => item.id === selection.id);
  if (!load || load.type === 'moment') return draft;
  if (load.type === 'point') {
    const next = aim(load.px, load.py, 0);
    load.px = next.x;
    load.py = next.y;
    return draft;
  }
  const start = aim(load.qxStart, load.qyStart, 0);
  const end = aim(load.qxEnd, load.qyEnd, 0);
  load.qxStart = start.x;
  load.qyStart = start.y;
  load.qxEnd = end.x;
  load.qyEnd = end.y;
  return draft;
};
