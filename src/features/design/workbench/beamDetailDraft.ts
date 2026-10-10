import { useCallback, useEffect, useState } from 'react';
import type { JsonValue } from '../../../shared/project/unifiedProjectBundle';
import { isBeamDetailDraft } from '../../../shared/project/designDetailValidation';
import type { BeamDetailDraft } from '../../../shared/project/designDetailValidation';
import { commitWorkbenchBatch, type WorkbenchStorage } from './workbenchStorage';
export type { BeamLoadDraft, BeamBastionDraft, BeamStirrupZoneDraft, BeamDetailDraft } from '../../../shared/project/designDetailValidation';

export const EMPTY_BEAM_DETAILS: BeamDetailDraft = {
  kind: 'beam', version: 1, loads: [], bastions: [], stirrupZones: [],
};

/** Valida forma y límites del borrador, sin evaluar geometría ni completar valores físicos. */
export { isBeamDetailDraft } from '../../../shared/project/designDetailValidation';

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
    if (!commitWorkbenchBatch(storage, batch).accepted) return false;
    setState(copy);
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

