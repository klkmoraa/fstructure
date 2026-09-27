import { createContext, useContext } from 'react';
import type { JsonValue } from '../../../shared/project/unifiedProjectBundle';

/**
 * Dónde viven los borradores del taller de diseño (norma, elemento y datos de
 * cada formulario). Dentro de un proyecto se guardan en la rama `design` del
 * bundle unificado; sin proyecto (pruebas, vista aislada) en el navegador.
 *
 * Los borradores no forman parte del modelo 2D: no invalidan el análisis ni
 * entran al historial de deshacer, igual que los estudios FEM.
 */
export interface WorkbenchStorage {
  read(key: string): unknown;
  write(key: string, value: JsonValue): void;
}

export const WORKBENCH_DOCUMENT_KIND = 'fstructure-design-workbench';
/**
 * v1: borradores (cadenas cortas, registros y listas de claros).
 * v2: además, la memoria del proyecto (`memory`): elementos guardados con su
 * borrador para recalcularlos al exportar. Un documento v1 se lee tal cual.
 */
const WORKBENCH_SCHEMA_VERSION = 2;
const MAX_DOCUMENT_CHARS = 240_000;
const MAX_ENTRIES = 16;
const MAX_FIELDS = 64;
const MAX_ROWS = 8;
/** Elementos que caben en la memoria del proyecto. */
export const MAX_MEMORY_ITEMS = 60;
const KEY = /^[A-Za-z][A-Za-z0-9-]{0,31}$/;

const isShortString = (value: unknown): value is string => typeof value === 'string' && value.length <= 32;
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const isRecord = (value: unknown): value is Record<string, string> =>
  isPlainObject(value) && Object.keys(value).length <= MAX_FIELDS
  && Object.entries(value).every(([field, item]) => KEY.test(field) && isShortString(item));

const isRows = (value: unknown): value is Record<string, string>[] =>
  Array.isArray(value) && value.length <= MAX_ROWS && value.every(isRecord);

/** Elemento guardado en la memoria del proyecto: su borrador, la norma y cuándo se guardó. */
export interface WorkbenchMemoryItem {
  readonly id: string;
  readonly element: 'beam' | 'column' | 'footing';
  readonly code: string;
  readonly savedAt: string;
  readonly fields: Record<string, string>;
  /** Filas del formulario (los claros de la viga). */
  readonly rows?: Record<string, string>[];
}

export const isMemoryItem = (value: unknown): value is WorkbenchMemoryItem => {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  if (keys.some((key) => !['id', 'element', 'code', 'savedAt', 'fields', 'rows'].includes(key))) return false;
  return isShortString(value.id) && (value.element === 'beam' || value.element === 'column' || value.element === 'footing')
    && isShortString(value.code) && isShortString(value.savedAt) && isRecord(value.fields)
    && (value.rows === undefined || isRows(value.rows));
};

const isMemory = (value: unknown): value is WorkbenchMemoryItem[] =>
  Array.isArray(value) && value.length <= MAX_MEMORY_ITEMS && value.every(isMemoryItem)
  && new Set(value.map((item) => item.id)).size === value.length;

/** Cadenas cortas, registros de cadenas, listas cortas de registros (los claros) y la memoria del proyecto. */
const isEntry = (key: string, value: unknown): value is JsonValue =>
  isShortString(value) || isRecord(value) || isRows(value) || (key === 'memory' && isMemory(value));

/** Lee un documento del taller; ante cualquier forma inesperada devuelve un borrador vacío, nunca lanza. */
export function parseWorkbenchDocument(raw: unknown): Record<string, JsonValue> {
  if (!isPlainObject(raw) || raw.kind !== WORKBENCH_DOCUMENT_KIND || (raw.schemaVersion !== 1 && raw.schemaVersion !== 2) || !isPlainObject(raw.entries)) return {};
  try {
    if (JSON.stringify(raw).length > MAX_DOCUMENT_CHARS) return {};
  } catch {
    return {};
  }
  const entries: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(raw.entries).slice(0, MAX_ENTRIES)) {
    if (KEY.test(key) && isEntry(key, value)) entries[key] = structuredClone(value);
  }
  return entries;
}

const workbenchDocument = (entries: Readonly<Record<string, JsonValue>>): JsonValue =>
  ({ kind: WORKBENCH_DOCUMENT_KIND, schemaVersion: WORKBENCH_SCHEMA_VERSION, entries: structuredClone(entries) as { [key: string]: JsonValue } });

const BROWSER_PREFIX = 'fstructure.design-workbench.';

/** Respaldo en el navegador: comodidad por dispositivo; la página funciona sin almacenamiento. */
export const browserWorkbenchStorage: WorkbenchStorage = {
  read(key) {
    try {
      const raw = window.localStorage.getItem(BROWSER_PREFIX + key);
      if (!raw || raw.length > (key === 'memory' ? MAX_DOCUMENT_CHARS : 8_000)) return undefined;
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        // Versiones anteriores guardaban la norma y el elemento como texto plano.
        return raw;
      }
    } catch {
      return undefined;
    }
  },
  write(key, value) {
    try { window.localStorage.setItem(BROWSER_PREFIX + key, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
  },
};

interface ProjectWorkbenchStorage extends WorkbenchStorage {
  /** Escribe de inmediato lo pendiente (al cerrar la superficie). */
  flush(): void;
  dispose(): void;
}

/**
 * Borradores guardados en el proyecto: se leen de la rama `design` y cada cambio
 * se agrupa (`delayMs`) antes de llamar a `persist` con el documento completo.
 */
export function createProjectWorkbenchStorage(
  initial: unknown,
  persist: (document: JsonValue) => void,
  delayMs = 600,
): ProjectWorkbenchStorage {
  const entries = parseWorkbenchDocument(initial);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dirty = false;
  const flush = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (!dirty) return;
    dirty = false;
    persist(workbenchDocument(entries));
  };
  return {
    read: (key) => entries[key],
    write(key, value) {
      if (!KEY.test(key) || !isEntry(key, value)) return;
      if (JSON.stringify(entries[key]) === JSON.stringify(value)) return;
      entries[key] = structuredClone(value);
      dirty = true;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    dispose() {
      flush();
    },
  };
}

export const WorkbenchStorageContext = createContext<WorkbenchStorage>(browserWorkbenchStorage);

export const useWorkbenchStorage = () => useContext(WorkbenchStorageContext);
