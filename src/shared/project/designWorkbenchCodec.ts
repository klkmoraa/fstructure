import type { JsonValue } from './unifiedProjectBundle';
import { isBeamDetailDraft } from './designDetailValidation';

export const DESIGN_WORKBENCH_KIND = 'fstructure-design-workbench';
export const DESIGN_WORKBENCH_SCHEMA_VERSION = 8;
export const DESIGN_WORKBENCH_MAX_ENTRIES = 16;
export const DESIGN_WORKBENCH_MAX_DOCUMENT_CHARS = 240_000;
export const DESIGN_WORKBENCH_MAX_MEMORY_ITEMS = 60;
const DESIGN_WORKBENCH_MAX_MEMORY_CHARS = 180_000;

type DesignDocumentInspection = {
  status: 'empty' | 'supported' | 'future' | 'opaque' | 'invalid';
  schemaVersion: number | null;
  reason: string | null;
  entries: Record<string, JsonValue> | null;
};

const SUPPORTED = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
const ELEMENTS = ['beam', 'column', 'frame', 'footing', 'section', 'flexure'];
const KEY = /^[A-Za-z][A-Za-z0-9-]{0,31}$/;
const plainObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
  && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const shortString = (value: unknown): value is string => typeof value === 'string' && value.length <= 32;
const stringRecord = (value: unknown): value is Record<string, string> => plainObject(value)
  && Object.keys(value).length <= 96 && Object.entries(value).every(([key, item]) => KEY.test(key) && shortString(item));
const rows = (value: unknown): value is Record<string, string>[] => Array.isArray(value) && value.length <= 8 && value.every(stringRecord);
const idString = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;
const labelString = (value: unknown): value is string => typeof value === 'string' && value.length <= 256;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const vector3 = (value: unknown): boolean => Array.isArray(value) && value.length === 3 && value.every(finite);
const linkedOrigin = (value: unknown): boolean => {
  if (!plainObject(value) || Object.keys(value).some((key) => !['version', 'snapshot', 'copiedFields'].includes(key)) || value.version !== 1 || !plainObject(value.snapshot) || !plainObject(value.copiedFields)) return false;
  const snapshot = value.snapshot;
  if (Object.keys(snapshot).some((key) => !['version', 'source', 'target', 'station', 'units', 'axes', 'actions', 'member'].includes(key)) || snapshot.version !== 1 || snapshot.units !== 'kN-m') return false;
  const source = snapshot.source, target = snapshot.target, station = snapshot.station, axes = snapshot.axes, actions = snapshot.actions, member = snapshot.member;
  if (!plainObject(source) || !['model2d', 'model3d'].includes(String(source.kind)) || !idString(source.projectId) || !idString(source.revision) || !idString(source.memberId) || (source.axisId !== undefined && !idString(source.axisId))) return false;
  if (!plainObject(target) || !idString(target.id) || !labelString(target.label) || !['case', 'combination'].includes(String(target.kind)) || !Array.isArray(target.factors) || target.factors.length > 64 || !target.factors.every((factor) => plainObject(factor) && idString(factor.caseId) && finite(factor.factor))) return false;
  if (!plainObject(station) || !finite(station.xM) || !['left', 'right'].includes(String(station.side)) || !finite(station.lengthM) || station.lengthM <= 0 || station.xM < 0 || station.xM > station.lengthM + Math.max(1, station.lengthM) * 1e-9) return false;
  if (!plainObject(axes) || !labelString(axes.convention) || !Array.isArray(axes.localBasis) || axes.localBasis.length > 3 || !axes.localBasis.every(vector3)) return false;
  if (!plainObject(actions) || !['nKn', 'vyKn', 'vzKn', 'torsionKnm', 'myKnm', 'mzKnm'].every((key) => finite(actions[key]))) return false;
  if (!plainObject(member) || !idString(member.id) || !labelString(member.label) || !['beam', 'column', 'other'].includes(String(member.family)) || !(member.levelId === null || idString(member.levelId)) || !Array.isArray(member.axisIds) || member.axisIds.length > 16 || !member.axisIds.every(idString) || !finite(member.lengthM) || !vector3(member.start) || !vector3(member.end) || !plainObject(member.section) || !['rectangular', 'circular', 'other'].includes(String(member.section.shape)) || !(member.section.widthMm === null || finite(member.section.widthMm)) || !(member.section.depthMm === null || finite(member.section.depthMm)) || !(member.section.fcMpa === null || finite(member.section.fcMpa)) || !labelString(member.section.materialLabel)) return false;
  const copied = value.copiedFields;
  return Object.keys(copied).length <= 64 && Object.entries(copied).every(([key, field]) => KEY.test(key) && typeof field === 'string' && field.length <= 256);
};
const steelMemory = (value: unknown): boolean => Array.isArray(value) && value.length <= 60 && value.every((item: unknown) => {
  if (!plainObject(item) || Object.keys(item).some((key) => !['memberId', 'combinationId', 'savedAt'].includes(key))) return false;
  return typeof item.memberId === 'string' && item.memberId.length <= 256
    && typeof item.combinationId === 'string' && item.combinationId.length > 0 && item.combinationId.length <= 256
    && typeof item.savedAt === 'string' && item.savedAt.length <= 32 && Number.isFinite(Date.parse(item.savedAt));
}) && new Set(value.map((item) => JSON.stringify([(item as Record<string, unknown>).memberId, (item as Record<string, unknown>).combinationId]))).size === value.length;
export const isDesignWorkbenchMemoryItem = (value: unknown): boolean => {
  if (!plainObject(value) || Object.keys(value).some((key) => !['id', 'element', 'code', 'savedAt', 'fields', 'rows', 'levels', 'details', 'origin'].includes(key))) return false;
  return shortString(value.id) && ELEMENTS.includes(value.element as string) && shortString(value.code) && shortString(value.savedAt)
    && stringRecord(value.fields) && (value.rows === undefined || rows(value.rows)) && (value.levels === undefined || rows(value.levels))
    && (value.details === undefined || (value.element === 'beam' && isBeamDetailDraft(value.details)))
    && (value.origin === undefined || ((value.element === 'column' || value.element === 'flexure') && linkedOrigin(value.origin)));
};
const memory = (value: unknown): boolean => Array.isArray(value) && value.length <= DESIGN_WORKBENCH_MAX_MEMORY_ITEMS
  && value.every(isDesignWorkbenchMemoryItem) && new Set(value.map((item) => (item as Record<string, unknown>).id)).size === value.length
  && JSON.stringify(value).length <= DESIGN_WORKBENCH_MAX_MEMORY_CHARS;
export function isDesignWorkbenchEntry(key: string, value: unknown): value is JsonValue {
  if (!KEY.test(key)) return false;
  if (key === 'beam-details') return isBeamDetailDraft(value);
  if (key === 'piece-origin') return plainObject(value) && Object.keys(value).every((field) => ['version', 'byElement'].includes(field)) && value.version === 1 && plainObject(value.byElement) && Object.keys(value.byElement).every((field) => ['column', 'flexure'].includes(field)) && Object.values(value.byElement).every(linkedOrigin);
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
