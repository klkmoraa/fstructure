import type { JsonValue } from './unifiedProjectBundle';
import { isBeamDetailDraft } from './designDetailValidation';

export const DESIGN_WORKBENCH_KIND = 'fstructure-design-workbench';
export const DESIGN_WORKBENCH_SCHEMA_VERSION = 7;
export const DESIGN_WORKBENCH_MAX_ENTRIES = 16;
export const DESIGN_WORKBENCH_MAX_DOCUMENT_CHARS = 240_000;
export const DESIGN_WORKBENCH_MAX_MEMORY_ITEMS = 60;
export const DESIGN_WORKBENCH_MAX_MEMORY_CHARS = 180_000;

export type DesignDocumentInspection = {
  status: 'empty' | 'supported' | 'future' | 'opaque' | 'invalid';
  schemaVersion: number | null;
  reason: string | null;
  entries: Record<string, JsonValue> | null;
};

const SUPPORTED = new Set([1, 2, 3, 4, 5, 6, 7]);
const ELEMENTS = ['beam', 'column', 'frame', 'footing', 'section', 'flexure'];
const KEY = /^[A-Za-z][A-Za-z0-9-]{0,31}$/;
const plainObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
  && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const shortString = (value: unknown): value is string => typeof value === 'string' && value.length <= 32;
const stringRecord = (value: unknown): value is Record<string, string> => plainObject(value)
  && Object.keys(value).length <= 96 && Object.entries(value).every(([key, item]) => KEY.test(key) && shortString(item));
const rows = (value: unknown): value is Record<string, string>[] => Array.isArray(value) && value.length <= 8 && value.every(stringRecord);
const steelMemory = (value: unknown): boolean => Array.isArray(value) && value.length <= 60 && value.every((item: unknown) => {
  if (!plainObject(item) || Object.keys(item).some((key) => !['memberId', 'combinationId', 'savedAt'].includes(key))) return false;
  return typeof item.memberId === 'string' && item.memberId.length <= 256
    && typeof item.combinationId === 'string' && item.combinationId.length > 0 && item.combinationId.length <= 256
    && typeof item.savedAt === 'string' && item.savedAt.length <= 32 && Number.isFinite(Date.parse(item.savedAt));
}) && new Set(value.map((item) => JSON.stringify([(item as Record<string, unknown>).memberId, (item as Record<string, unknown>).combinationId]))).size === value.length;
export const isDesignWorkbenchMemoryItem = (value: unknown): boolean => {
  if (!plainObject(value) || Object.keys(value).some((key) => !['id', 'element', 'code', 'savedAt', 'fields', 'rows', 'levels', 'details'].includes(key))) return false;
  return shortString(value.id) && ELEMENTS.includes(value.element as string) && shortString(value.code) && shortString(value.savedAt)
    && stringRecord(value.fields) && (value.rows === undefined || rows(value.rows)) && (value.levels === undefined || rows(value.levels))
    && (value.details === undefined || (value.element === 'beam' && isBeamDetailDraft(value.details)));
};
const memory = (value: unknown): boolean => Array.isArray(value) && value.length <= DESIGN_WORKBENCH_MAX_MEMORY_ITEMS
  && value.every(isDesignWorkbenchMemoryItem) && new Set(value.map((item) => (item as Record<string, unknown>).id)).size === value.length
  && JSON.stringify(value).length <= DESIGN_WORKBENCH_MAX_MEMORY_CHARS;
export function isDesignWorkbenchEntry(key: string, value: unknown): value is JsonValue {
  if (!KEY.test(key)) return false;
  if (key === 'beam-details') return isBeamDetailDraft(value);
  if (key === 'steel-memory') return steelMemory(value);
  if (key === 'memory') return memory(value);
  return shortString(value) || stringRecord(value) || rows(value);
}

function invalid(version: number | null, reason: string): DesignDocumentInspection {
  return { status: 'invalid', schemaVersion: version, reason, entries: null };
}

/** Inspect one complete Design branch without interpreting foreign or future JSON. */
export function inspectDesignDocument(value: unknown): DesignDocumentInspection {
  if (value === null || value === undefined || (plainObject(value) && Object.keys(value).length === 0)) {
    return { status: 'empty', schemaVersion: null, reason: null, entries: {} };
  }
  if (!plainObject(value) || value.kind !== DESIGN_WORKBENCH_KIND) {
    return { status: 'opaque', schemaVersion: null, reason: null, entries: null };
  }
  const version = Number.isInteger(value.schemaVersion) ? value.schemaVersion as number : null;
  if (version !== null && version > DESIGN_WORKBENCH_SCHEMA_VERSION) {
    return { status: 'future', schemaVersion: version, reason: `El documento de Diseño usa la versión ${version}, posterior a la compatible (${DESIGN_WORKBENCH_SCHEMA_VERSION}).`, entries: null };
  }
  if (version === null || !SUPPORTED.has(version)) return invalid(version, 'La versión del documento de Diseño no es compatible.');
  if (Object.keys(value).some((key) => !['kind', 'schemaVersion', 'entries'].includes(key))) {
    return invalid(version, 'El documento de Diseño contiene campos de envoltura desconocidos.');
  }
  if (!plainObject(value.entries)) return invalid(version, 'El documento de Diseño no contiene un mapa de entradas válido.');
  let serialized: string;
  try { serialized = JSON.stringify(value); } catch { return invalid(version, 'El documento de Diseño no se puede serializar.'); }
  if (serialized.length > DESIGN_WORKBENCH_MAX_DOCUMENT_CHARS) return invalid(version, 'El documento de Diseño supera el límite de 240000 caracteres.');
  const keys = Object.keys(value.entries);
  if (keys.length > DESIGN_WORKBENCH_MAX_ENTRIES) return invalid(version, 'El documento de Diseño supera el límite de 16 entradas.');
  for (const key of keys) {
    if (!isDesignWorkbenchEntry(key, value.entries[key])) return invalid(version, `La entrada «${key}» del documento de Diseño no es válida.`);
  }
  return { status: 'supported', schemaVersion: version, reason: null, entries: structuredClone(value.entries) as Record<string, JsonValue> };
}
