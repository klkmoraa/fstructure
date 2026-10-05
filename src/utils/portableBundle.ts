
import { canonicalStringify, parsePortablePayload } from './portablePayload';
import {
  assertSafeArchivePath,
  assertWithinBudget,
  createArchiveBudgetTracker,
  FILE_BUDGETS,
  FileBudgetError,
} from './fileGuards';
import {
  PORTABLE_FORMAT_VERSION,
  type PortableBundleManifest,
  type PortablePayload,
} from './portableTypes';

export interface PortableBundleContents {
  manifest: PortableBundleManifest;
  payload: PortablePayload;
  reportBytes: Uint8Array;
}

const decodeJson = (bytes: Uint8Array, label: string): unknown => {
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error(`${label} no contiene JSON valido.`);
  }
};

const REQUIRED_MANIFEST_FILES = ['payload', 'project', 'analysis', 'report'] as const;

const assertManifest: (value: unknown) => asserts value is PortableBundleManifest = (value) => {
  if (typeof value !== 'object' || value === null
    || !('format' in value)
    || (value.format !== 'fusionstructure-bundle' && value.format !== 'structureco-bundle')
    || !('formatVersion' in value) || value.formatVersion !== PORTABLE_FORMAT_VERSION
    || !('payloadChecksum' in value) || typeof value.payloadChecksum !== 'string') {
    throw new Error('El paquete no tiene un manifest FusionStructure compatible.');
  }
  // `files` drives every lookup below, so it is validated here rather than crashing
  // with a TypeError on a hand-edited or truncated manifest.
  const files: unknown = 'files' in value ? value.files : undefined;
  if (typeof files !== 'object' || files === null || Array.isArray(files)) {
    throw new Error('El paquete no tiene un manifest FusionStructure compatible.');
  }
  for (const key of REQUIRED_MANIFEST_FILES) {
    const entry: unknown = (files as Record<string, unknown>)[key];
    if (typeof entry !== 'string' || entry === '') {
      throw new Error('El paquete no tiene un manifest FusionStructure compatible.');
    }
    assertSafeArchivePath(entry);
  }
};

export const readPortableBundle = async (
  input: ArrayBuffer | Uint8Array | Blob,
): Promise<PortableBundleContents> => {
  if (input instanceof Blob) assertWithinBudget(input.size, FILE_BUDGETS.bundleBytes, '.fusionstructure');
  const source = input instanceof Blob
    ? new Uint8Array(await input.arrayBuffer())
    : input instanceof Uint8Array
      ? input
      : new Uint8Array(input);
  assertWithinBudget(source.byteLength, FILE_BUDGETS.bundleBytes, '.fusionstructure');
  const { unzipSync } = await import('fflate');
  // The filter runs against each entry's declared header before it is inflated, so a
  // zip bomb is rejected on its claims instead of on the memory it would have taken.
  const budget = createArchiveBudgetTracker();
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(source, {
      filter: (entry) => {
        budget.accept(entry);
        return true;
      },
    });
  } catch (error) {
    if (error instanceof FileBudgetError) throw error;
    throw new Error('El archivo .fusionstructure no es un paquete ZIP valido.');
  }
  const manifestBytes = files['manifest.json'];
  if (!manifestBytes) throw new Error('El paquete no contiene manifest.json.');
  const manifestValue = decodeJson(manifestBytes, 'manifest.json');
  assertManifest(manifestValue);
  const manifest = manifestValue;
  const payloadBytes = files[manifest.files.payload];
  const projectBytes = files[manifest.files.project];
  const analysisBytes = files[manifest.files.analysis];
  const reportBytes = files[manifest.files.report];
  if (!payloadBytes || !projectBytes || !analysisBytes || !reportBytes) {
    throw new Error('El paquete FusionStructure esta incompleto.');
  }
  const payload = await parsePortablePayload(payloadBytes);
  if (payload.checksum.value !== manifest.payloadChecksum) throw new Error('El checksum del manifest no coincide con el expediente.');
  const project = decodeJson(projectBytes, 'project.json');
  const analysis = decodeJson(analysisBytes, 'analysis/result.json');
  if (canonicalStringify(project) !== canonicalStringify(payload.project)
    || canonicalStringify(analysis) !== canonicalStringify(payload.analysis)) {
    throw new Error('Los datos separados del paquete no coinciden con el expediente firmado.');
  }
  return { manifest, payload, reportBytes };
};
