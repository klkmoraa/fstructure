import { CURRENT_SCHEMA_VERSION } from '../data/defaultProject';
import { normalizeProject } from '../data/migrate';
import { parseSpace3DDraft } from '../modules/space3d/space3d/data/codec';
import type { UnifiedProjectBundleV1 } from '../shared/project/unifiedProjectBundle';

function jsonArrayValues(item: unknown[]): unknown[] {
  const keys = Reflect.ownKeys(item);
  if (keys.length !== item.length + 1 || keys.some((key) => key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)))) throw new Error('Only dense JSON arrays are supported');
  return Array.from({ length: item.length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
    if (!descriptor || !('value' in descriptor)) throw new Error('Runtime array properties cannot be persisted');
    return descriptor.value;
  });
}

/** Stable JSON; rejects runtime objects, cycles and lossy numeric serialization. */
export function canonicalSerialize(value: unknown): string {
  const ancestors = new Set<object>();
  const visit = (item: unknown): string => {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== 'object' || item === null || ancestors.has(item)) throw new Error('Expected finite, acyclic JSON data');
    ancestors.add(item);
    let result: string;
    if (Array.isArray(item)) {
      result = `[${jsonArrayValues(item).map(visit).join(',')}]`;
    }
    else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) throw new Error('Runtime objects cannot be persisted');
      if (Object.getOwnPropertySymbols(item).length) throw new Error('Symbol keys cannot be persisted');
      const descriptors = Object.getOwnPropertyDescriptors(item);
      result = `{${Object.keys(descriptors).sort().map((key) => {
        const descriptor = descriptors[key];
        if (!('value' in descriptor) || !descriptor.enumerable) throw new Error('Only enumerable JSON properties are supported');
        return `${JSON.stringify(key)}:${visit(descriptor.value)}`;
      }).join(',')}}`;
    }
    ancestors.delete(item);
    return result;
  };
  return visit(value);
}

export async function sha256(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is required for bundle checksums');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object');
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) throw new Error('Unsupported bundle fields');
}
function nonempty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }

/**
 * Domain normalizers may emit optional undefined properties; omit them wherever
 * a persisted branch embeds a domain model (`model2d`, y el `sourceModel2D` de
 * la rama 3D). Sigue siendo estricto: getters, símbolos, ciclos y objetos de
 * runtime se rechazan más adelante en `canonicalSerialize`.
 */
function modelJson(value: unknown, ancestors = new Set<object>()): unknown {
  if (!value || typeof value !== 'object') return value;
  if (ancestors.has(value)) throw new Error('Cyclic model cannot be persisted');
  ancestors.add(value);
  let result: unknown = value;
  if (Array.isArray(value)) result = jsonArrayValues(value).map((item) => modelJson(item, ancestors));
  else if (Object.getPrototypeOf(value) === Object.prototype) {
    const fields: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') throw new Error('Symbol keys cannot be persisted');
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!('value' in descriptor) || !descriptor.enumerable) throw new Error('Runtime model properties cannot be persisted');
      if (descriptor.value !== undefined) Object.defineProperty(fields, key, { value: modelJson(descriptor.value, ancestors), enumerable: true });
    }
    result = fields;
  }
  ancestors.delete(value);
  return result;
}

/**
 * Clave de comparación estable para bundles y ramas aún en memoria.
 *
 * `canonicalSerialize` rechaza `undefined` a propósito: nada con ese valor debe
 * llegar a IndexedDB. Pero los normalizadores de dominio sí emiten propiedades
 * opcionales en `undefined` (p. ej. `support.angleDeg`), y la persistencia las
 * omite vía `modelJson` antes de escribir. Comparar la copia de trabajo cruda
 * contra lo ya comprometido exige la misma omisión; de lo contrario un proyecto
 * normal aborta el guardado.
 */
export function canonicalJsonKey(value: unknown): string {
  return canonicalSerialize(modelJson(value));
}

export function validateBundle(input: unknown): UnifiedProjectBundleV1 {
  const raw = object(input);
  exact(raw, ['manifest', 'model2d', 'space3d', 'design', 'fem']);
  // Inspect descriptors before reading any value: spread would execute root getters.
  if (Object.getOwnPropertySymbols(raw).length || (Object.getPrototypeOf(raw) !== Object.prototype && Object.getPrototypeOf(raw) !== null)) throw new Error('Runtime bundle objects cannot be persisted');
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  for (const descriptor of Object.values(descriptors)) {
    if (!('value' in descriptor) || !descriptor.enumerable) throw new Error('Only enumerable bundle data properties are supported');
  }
  const detached = Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, modelJson(descriptor.value)]));
  const copy = JSON.parse(canonicalSerialize(detached)) as UnifiedProjectBundleV1;
  const manifest = object(copy.manifest);
  exact(manifest, ['schemaVersion', 'projectId', 'sourceVersion', 'authoritativeModel']);
  if (manifest.schemaVersion !== 1 || manifest.authoritativeModel !== 'model2d') throw new Error('Unsupported manifest schema or authority');
  if (!nonempty(manifest.projectId) || !nonempty(manifest.sourceVersion)) throw new Error('Project identity and source version are required');
  const model = object(copy.model2d);
  if (model.id !== manifest.projectId || model.schemaVersion !== CURRENT_SCHEMA_VERSION) throw new Error('Unsupported model schema or mismatched project identity');
  // Persist the validated domain representation, including required defaults.
  copy.model2d = JSON.parse(canonicalSerialize(modelJson(normalizeProject(copy.model2d))));
  if (!Array.isArray(copy.fem)) throw new Error('FEM must be a list of serializable branches');
  if (copy.space3d !== null) {
    const branch = object(copy.space3d);
    const branchKeys = Object.keys(branch);
    const legacy = branchKeys.length === 3 && ['sourceProjectId', 'sourceVersion', 'model'].every((key) => Object.hasOwn(branch, key));
    const linked = branchKeys.length === 5 && ['sourceProjectId', 'sourceVersion', 'sourceModel2D', 'baselineStatus', 'model'].every((key) => Object.hasOwn(branch, key));
    if (!legacy && !linked) throw new Error('Unsupported Space3D branch fields');
    // A 2D edit must retain the original provenance of its now-stale 3D branch.
    if (branch.sourceProjectId !== manifest.projectId || typeof branch.sourceVersion !== 'string' || !branch.sourceVersion.trim()) throw new Error('Space3D source link does not match the manifest');
    const space3d = parseSpace3DDraft(canonicalSerialize(branch.model));
    if (space3d.id !== `space3d:${manifest.projectId}`) throw new Error('Space3D identity does not match project lineage');
    if (linked) {
      if (branch.baselineStatus !== 'exact') throw new Error('Unsupported Space3D baseline status');
      const baseline = normalizeProject(branch.sourceModel2D);
      if (baseline.id !== manifest.projectId) throw new Error('Space3D baseline identity does not match project lineage');
      branch.sourceModel2D = JSON.parse(canonicalSerialize(modelJson(baseline)));
    }
  }
  return copy;
}
