import { createContext, useContext } from 'react';
import type { JsonValue } from '../../../shared/project/unifiedProjectBundle';
import type { BeamDetailDraft } from '../../../shared/project/designDetailValidation';
import type { LinkedPieceOrigin } from './LinkedPieceOrigin';
import {
  DESIGN_WORKBENCH_KIND, DESIGN_WORKBENCH_MAX_DOCUMENT_CHARS, DESIGN_WORKBENCH_MAX_ENTRIES,
  DESIGN_WORKBENCH_MAX_MEMORY_ITEMS, DESIGN_WORKBENCH_SCHEMA_VERSION, inspectDesignDocument,
  isDesignWorkbenchEntry, isDesignWorkbenchMemoryItem,
} from '../../../shared/project/designWorkbenchCodec';

export { DESIGN_WORKBENCH_SCHEMA_VERSION } from '../../../shared/project/designWorkbenchCodec';
export const WORKBENCH_DOCUMENT_KIND = DESIGN_WORKBENCH_KIND;
export const MAX_MEMORY_ITEMS = DESIGN_WORKBENCH_MAX_MEMORY_ITEMS;

export interface WorkbenchMemoryItem {
  readonly id: string; readonly element: 'beam' | 'column' | 'frame' | 'footing' | 'section' | 'flexure';
  readonly code: string; readonly savedAt: string; readonly fields: Record<string, string>;
  readonly rows?: Record<string, string>[]; readonly levels?: Record<string, string>[]; readonly details?: BeamDetailDraft; readonly origin?: LinkedPieceOrigin;
}
export const isMemoryItem = isDesignWorkbenchMemoryItem as (value: unknown) => value is WorkbenchMemoryItem;

export type BatchResult = { accepted: true } | { accepted: false; reason: string };
export type WorkbenchSaveState = { status: 'saved' | 'pending' | 'failed'; pending: boolean; error?: string };
export interface WorkbenchStorage {
  readonly historyScope?: object;
  readonly readOnlyReason?: string;
  readonly writeNotice?: string | null;
  setWriteNotice?(message: string | null): void;
  subscribe?(listener: () => void): () => void;
  read(key: string): unknown;
  /** Optional only for old isolated mocks; production providers implement commitBatch. */
  commitBatch?(writes: Readonly<Record<string, JsonValue>>): BatchResult;
  write(key: string, value: JsonValue): boolean | void;
  canWrite?(writes: Readonly<Record<string, JsonValue>>): boolean;
}

export function commitWorkbenchBatch(storage: WorkbenchStorage, writes: Readonly<Record<string, JsonValue>>): BatchResult {
  const result = storage.commitBatch ? storage.commitBatch(writes) : storage.canWrite && !storage.canWrite(writes)
    ? { accepted: false as const, reason: 'La capacidad del almacenamiento está llena.' }
    : (Object.entries(writes).forEach(([key, value]) => storage.write(key, value)), { accepted: true as const });
  storage.setWriteNotice?.(result.accepted ? null : `No se guardó el cambio; se conserva el valor anterior. ${result.reason}`);
  return result;
}

/** Returns no partial draft when a known schema contains an invalid key. */
export function parseWorkbenchDocument(raw: unknown): Record<string, JsonValue> {
  const inspection = inspectDesignDocument(raw);
  return inspection.status === 'supported' ? inspection.entries! : {};
}

const workbenchDocument = (entries: Readonly<Record<string, JsonValue>>): JsonValue =>
  ({ kind: WORKBENCH_DOCUMENT_KIND, schemaVersion: DESIGN_WORKBENCH_SCHEMA_VERSION, entries: structuredClone(entries) as { [key: string]: JsonValue } });
const BROWSER_PREFIX = 'fstructure.design-workbench.';
const browserListeners = new Set<() => void>();
let browserWriteNotice: string | null = null;

const browserValue = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(BROWSER_PREFIX + key);
    if (!raw || raw.length > ((key === 'memory' || key === 'steel-memory' || key === 'beam-details') ? DESIGN_WORKBENCH_MAX_DOCUMENT_CHARS : 8_000)) return undefined;
    try { return JSON.parse(raw) as unknown; } catch { return raw; }
  } catch { return undefined; }
};
const browserEntries = (): Record<string, JsonValue> => {
  const entries: Record<string, JsonValue> = {};
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const storageKey = window.localStorage.key(index);
      if (!storageKey?.startsWith(BROWSER_PREFIX)) continue;
      const key = storageKey.slice(BROWSER_PREFIX.length);
      const value = browserValue(key);
      if (isDesignWorkbenchEntry(key, value)) entries[key] = value as JsonValue;
    }
  } catch { /* quota/private mode is reported by commitBatch */ }
  return entries;
};

/** Local fallback commits all keys together and restores the prior values on quota failure. */
export const browserWorkbenchStorage: WorkbenchStorage = {
  get writeNotice() { return browserWriteNotice; },
  setWriteNotice(message) { browserWriteNotice = message; browserListeners.forEach((listener) => listener()); },
  subscribe(listener) { browserListeners.add(listener); return () => browserListeners.delete(listener); },
  read: browserValue,
  commitBatch(writes) {
    let next: Record<string, JsonValue>;
    try {
      next = { ...browserEntries() };
      for (const [key, value] of Object.entries(writes)) {
        if (!isDesignWorkbenchEntry(key, value)) return { accepted: false, reason: 'La entrada del borrador no tiene un formato válido.' };
        next[key] = structuredClone(value);
      }
      if (Object.keys(next).length > DESIGN_WORKBENCH_MAX_ENTRIES || JSON.stringify(workbenchDocument(next)).length > DESIGN_WORKBENCH_MAX_DOCUMENT_CHARS) {
        return { accepted: false, reason: 'El borrador superaría el límite local de Diseño.' };
      }
    } catch { return { accepted: false, reason: 'No se pudo validar el borrador local.' }; }
    const previous = new Map<string, string | null>();
    try {
      for (const key of Object.keys(writes)) {
        previous.set(key, window.localStorage.getItem(BROWSER_PREFIX + key));
        window.localStorage.setItem(BROWSER_PREFIX + key, JSON.stringify(writes[key]));
      }
      return { accepted: true };
    } catch {
      for (const [key, value] of previous) {
        try { if (value === null) window.localStorage.removeItem(BROWSER_PREFIX + key); else window.localStorage.setItem(BROWSER_PREFIX + key, value); } catch { /* best-effort rollback */ }
      }
      return { accepted: false, reason: 'No se pudo guardar el borrador local; se conserva el valor anterior.' };
    }
  },
  write(key, value) { return commitWorkbenchBatch(this, { [key]: value }).accepted; },
};

export interface ProjectWorkbenchStorage extends WorkbenchStorage {
  readonly rawDocument: unknown;
  readonly saveState: WorkbenchSaveState;
  subscribe(listener: () => void): () => void;
  flush(): Promise<void>;
  retry(): Promise<void>;
  dispose(): void;
}

export function createProjectWorkbenchStorage(
  initial: unknown,
  persist: (document: JsonValue) => unknown | Promise<unknown>,
  delayMs = 600,
  historyScope?: object,
): ProjectWorkbenchStorage {
  const source = structuredClone(initial);
  const inspection = inspectDesignDocument(source);
  const readOnlyReason = inspection.status === 'future' || inspection.status === 'opaque' || inspection.status === 'invalid'
    ? inspection.reason ?? (inspection.status === 'opaque' ? 'La rama de Diseño no pertenece a este formato y se conserva en solo lectura.' : 'La rama de Diseño no es válida y se conserva en solo lectura.')
    : undefined;
  const entries = inspection.status === 'supported' ? inspection.entries! : {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  let revision = 0;
  let pending = false;
  let inFlight: Promise<void> | undefined;
  let state: WorkbenchSaveState = { status: 'saved', pending: false };
  let writeNotice: string | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: WorkbenchSaveState) => { state = next; listeners.forEach((listener) => listener()); };
  const schedule = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => { void flush().catch(() => undefined); }, delayMs);
  };
  const flush = async (): Promise<void> => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (readOnlyReason || !pending) return inFlight;
    if (inFlight) {
      await inFlight.catch(() => undefined);
      // Several callers can wait for the same sink. Re-enter through the guard
      // so only one of them persists the latest revision after it completes.
      return flush();
    }
    if (!pending || readOnlyReason) return;
    const snapshotRevision = revision;
    const snapshot = structuredClone(entries);
    const document = workbenchDocument(snapshot);
    const validation = inspectDesignDocument(document);
    if (validation.status !== 'supported') {
      const error = validation.reason ?? 'El documento de Diseño no es válido.';
      publish({ status: 'failed', pending: true, error });
      throw new Error(error);
    }
    let persisted: unknown | Promise<unknown>;
    try { persisted = persist(document); } catch (error) { persisted = Promise.reject(error); }
    const saving = Promise.resolve(persisted).then(() => {
      if (revision === snapshotRevision) {
        pending = false;
        publish({ status: 'saved', pending: false });
      } else publish({ status: 'pending', pending: true });
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      publish({ status: 'failed', pending: true, error: message });
      throw error;
    }).finally(() => { if (inFlight === saving) inFlight = undefined; });
    inFlight = saving;
    return saving;
  };
  return {
    historyScope, readOnlyReason, rawDocument: source,
    get writeNotice() { return writeNotice; },
    setWriteNotice(message) { writeNotice = message; listeners.forEach((listener) => listener()); },
    get saveState() { return state; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    read: (key) => entries[key],
    canWrite(writes) {
      if (readOnlyReason) return false;
      try {
        const next = { ...entries };
        for (const [key, value] of Object.entries(writes)) {
          if (!isDesignWorkbenchEntry(key, value)) return false;
          next[key] = structuredClone(value);
        }
        return Object.keys(next).length <= DESIGN_WORKBENCH_MAX_ENTRIES && JSON.stringify(workbenchDocument(next)).length <= DESIGN_WORKBENCH_MAX_DOCUMENT_CHARS;
      } catch { return false; }
    },
    commitBatch(writes) {
      if (readOnlyReason) return { accepted: false, reason: readOnlyReason };
      if (Object.keys(writes).length === 0) return { accepted: true };
      const currentCanWrite = this.canWrite!(writes);
      if (!currentCanWrite) return { accepted: false, reason: 'El cambio superaría los límites o el formato compatible del borrador de Diseño.' };
      let changed = false;
      for (const [key, value] of Object.entries(writes)) {
        if (JSON.stringify(entries[key]) !== JSON.stringify(value)) changed = true;
      }
      if (!changed) return { accepted: true };
      for (const [key, value] of Object.entries(writes)) entries[key] = structuredClone(value);
      revision += 1;
      pending = true;
      publish({ status: 'pending', pending: true });
      schedule();
      return { accepted: true };
    },
    write(key, value) { return commitWorkbenchBatch(this, { [key]: value }).accepted; },
    flush,
    retry: flush,
    dispose() { if (timer !== undefined) clearTimeout(timer); void flush().catch(() => undefined); },
  };
}

export const WorkbenchStorageContext = createContext<WorkbenchStorage>(browserWorkbenchStorage);
export const useWorkbenchStorage = () => useContext(WorkbenchStorageContext);
