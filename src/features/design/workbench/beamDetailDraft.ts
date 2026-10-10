import { useCallback, useEffect, useState } from 'react';
import type { JsonValue } from '../../../shared/project/unifiedProjectBundle';
import type { WorkbenchStorage } from './workbenchStorage';

export interface BeamLoadDraft {
  readonly id: string;
  /** Claro de la viga, con numeración desde 1. */
  readonly span: string;
  readonly kind: 'point' | 'distributed';
  readonly category: 'dead' | 'live';
  readonly start: string;
  readonly end: string;
  readonly startValue: string;
  readonly endValue: string;
}

export interface BeamBastionDraft {
  readonly id: string;
  readonly bed: 'top' | 'bottom';
  readonly count: string;
  readonly diameterMm: string;
  readonly startM: string;
  readonly endM: string;
}

export interface BeamStirrupZoneDraft {
  /** Claro de la viga, con numeración desde 1. */
  readonly span: string;
  readonly endSpacingMm: string;
  readonly endLengthM: string;
  readonly centerSpacingMm: string;
}

export interface BeamDetailDraft {
  readonly kind: 'beam';
  readonly version: 1;
  readonly loads: readonly BeamLoadDraft[];
  readonly bastions: readonly BeamBastionDraft[];
  readonly stirrupZones: readonly BeamStirrupZoneDraft[];
}

export const EMPTY_BEAM_DETAILS: BeamDetailDraft = {
  kind: 'beam', version: 1, loads: [], bastions: [], stirrupZones: [],
};

const ID = /^[A-Za-z][A-Za-z0-9-]{0,31}$/;
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
const isRawString = (value: unknown): value is string => typeof value === 'string' && value.length <= 32;
const isId = (value: unknown): value is string => typeof value === 'string' && ID.test(value);
const isLoad = (value: unknown): value is BeamLoadDraft => {
  if (!isObject(value) || !exactKeys(value, ['id', 'span', 'kind', 'category', 'start', 'end', 'startValue', 'endValue'])) return false;
  return isId(value.id) && isRawString(value.span) && (value.kind === 'point' || value.kind === 'distributed')
    && (value.category === 'dead' || value.category === 'live')
    && isRawString(value.start) && isRawString(value.end) && isRawString(value.startValue) && isRawString(value.endValue);
};
const isBastion = (value: unknown): value is BeamBastionDraft => {
  if (!isObject(value) || !exactKeys(value, ['id', 'bed', 'count', 'diameterMm', 'startM', 'endM'])) return false;
  return isId(value.id) && (value.bed === 'top' || value.bed === 'bottom')
    && isRawString(value.count) && isRawString(value.diameterMm) && isRawString(value.startM) && isRawString(value.endM);
};
const isStirrupZone = (value: unknown): value is BeamStirrupZoneDraft => {
  if (!isObject(value) || !exactKeys(value, ['span', 'endSpacingMm', 'endLengthM', 'centerSpacingMm'])) return false;
  return isRawString(value.span) && isRawString(value.endSpacingMm) && isRawString(value.endLengthM) && isRawString(value.centerSpacingMm);
};

/** Valida forma y límites del borrador, sin evaluar geometría ni completar valores físicos. */
export function isBeamDetailDraft(value: unknown): value is BeamDetailDraft {
  if (!isObject(value) || !exactKeys(value, ['kind', 'version', 'loads', 'bastions', 'stirrupZones'])) return false;
  return value.kind === 'beam' && value.version === 1
    && Array.isArray(value.loads) && value.loads.length <= 32 && value.loads.every(isLoad)
    && Array.isArray(value.bastions) && value.bastions.length <= 16 && value.bastions.every(isBastion)
    && Array.isArray(value.stirrupZones) && value.stirrupZones.length <= 8 && value.stirrupZones.every(isStirrupZone);
}

export interface StoredBeamDetails {
  readonly details: BeamDetailDraft;
  /** Preflight y escribe juntas las entradas que acompañan al detalle. */
  setDetails(details: BeamDetailDraft, writes?: Readonly<Record<string, JsonValue>>): boolean;
}

/** Lee y persiste el detalle tipado del taller sin evaluar su geometría. */
export function useStoredBeamDetails(storage: WorkbenchStorage): StoredBeamDetails {
  const [details, setState] = useState<BeamDetailDraft>(() => {
    const stored = storage.read('beam-details');
    return isBeamDetailDraft(stored) ? structuredClone(stored) : EMPTY_BEAM_DETAILS;
  });
  const setDetails = useCallback((next: BeamDetailDraft, writes: Readonly<Record<string, JsonValue>> = {}): boolean => {
    if (!isBeamDetailDraft(next)) return false;
    const copy = structuredClone(next);
    const batch = { ...writes, 'beam-details': copy as unknown as JsonValue };
    if (storage.canWrite && !storage.canWrite(batch)) return false;
    for (const [key, value] of Object.entries(writes)) storage.write(key, value);
    setState(copy);
    storage.write('beam-details', copy as unknown as JsonValue);
    return true;
  }, [storage]);
  // Memoria puede abrir/duplicar un elemento desde otro componente; vuelve a leer
  // el borrador externo cuando el taller renderiza, sin escribirlo de nuevo.
  useEffect(() => {
    const stored = storage.read('beam-details');
    if (!isBeamDetailDraft(stored)) return;
    setState((current) => JSON.stringify(current) === JSON.stringify(stored) ? current : structuredClone(stored));
  });
  return { details, setDetails };
}

