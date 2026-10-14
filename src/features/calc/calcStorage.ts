import { isDesignCodeId, type DesignCodeId } from '../../design/elements/codes';
import type { ExerciseValues } from '../../design/exercises/types';
import type { UnitSystem } from '../../design/exercises/units';

/**
 * Preferencias y borradores del apartado Cálculo, en este navegador. No son del
 * proyecto: un ejercicio suelto no toca el modelo abierto. El documento lleva
 * versión; si el guardado es ilegible o de otra versión se conserva intacto: la
 * sesión trabaja en memoria y no lo sobrescribe.
 */
const KEY = 'fstructure.calc.v1';
let foreign = false;

export interface CalcState {
  readonly version: 1;
  readonly units: UnitSystem;
  readonly code: DesignCodeId;
  /** Borradores por problema, en unidades internas. */
  readonly drafts: Readonly<Record<string, ExerciseValues>>;
}

const DEFAULT_STATE: CalcState = { version: 1, units: 'kgf', code: 'ntc-2023', drafts: {} };

const isValues = (value: unknown): value is ExerciseValues =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  && Object.values(value as Record<string, unknown>).every((item) => item === null || typeof item === 'number');

export function readCalcState(): CalcState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<CalcState>;
    if (!parsed || parsed.version !== 1) { foreign = true; return DEFAULT_STATE; }
    const drafts: Record<string, ExerciseValues> = {};
    for (const [id, values] of Object.entries(parsed.drafts ?? {})) {
      if (isValues(values)) drafts[id] = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value ?? undefined]));
    }
    return {
      version: 1,
      units: parsed.units === 'si' ? 'si' : 'kgf',
      code: isDesignCodeId(parsed.code) ? parsed.code : 'ntc-2023',
      drafts,
    };
  } catch {
    foreign = true;
    return DEFAULT_STATE;
  }
}

/** `false` si no se pudo escribir o si hay un guardado ajeno que se conserva. */
export function writeCalcState(state: CalcState): boolean {
  if (foreign) return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
