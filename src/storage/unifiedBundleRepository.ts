import type { Space3DProjectV1 } from '../modules/space3d/space3d/model/types';
import { parseSpace3DDraft } from '../modules/space3d/space3d/data/codec';
import type { UnifiedProjectBundleV1 } from '../shared/project/unifiedProjectBundle';
import { canonicalSerialize, sha256, validateBundle } from './bundleValidation';
import { prepareLegacyImports, type LegacyBundleStorage } from './legacyBundleSources';
export { canonicalSerialize, sha256 } from './bundleValidation';
export type { LegacyBundleStorage } from './legacyBundleSources';

export interface StoredBundleRecord {
  id: string;
  revision: number;
  checksum: string;
  updatedAt: string;
  bundle: UnifiedProjectBundleV1;
}
export interface BundleRecoveryRecord {
  id: string;
  projectId: string | null;
  reason: 'conflict' | 'migration' | 'unmatched-space3d';
  checksum: string;
  createdAt: string;
  bundle?: UnifiedProjectBundleV1;
  space3d?: Space3DProjectV1;
  sourceIds?: string[];
}
export interface MigrationRecord {
  id: string;
  sourceKey: string;
  sourceChecksum: string;
  status: 'imported' | 'recovered' | 'invalid';
  complete: boolean;
  diagnostic?: string;
  recoveryId?: string;
}
interface StoredLibrarySnapshot {
  bundles: StoredBundleRecord[];
  recoveries: BundleRecoveryRecord[];
  migrations: MigrationRecord[];
}
export interface BundleIntegrityDiagnostic {
  store: 'bundles' | 'recoveries';
  recordId: string;
  code: 'invalid-record';
  message: string;
}
/** Invalid records are excluded from usable arrays and identified without mutating storage. */
export interface BundleLibrarySnapshot extends StoredLibrarySnapshot {
  integrityDiagnostics: BundleIntegrityDiagnostic[];
}
export interface UnifiedBundleRepository {
  openBundle(id: string): Promise<StoredBundleRecord | null>;
  snapshot(): Promise<BundleLibrarySnapshot>;
  /** 0 means create; updates require the revision returned by openBundle. */
  saveBundle(bundle: UnifiedProjectBundleV1, expectedRevision: number): Promise<StoredBundleRecord>;
  migrateLegacy(storage: LegacyBundleStorage): Promise<BundleLibrarySnapshot>;
}
export class BundleConflictError extends Error {
  readonly projectId: string;
  readonly recoveryId: string;
  constructor(projectId: string, recoveryId: string) {
    super(`Bundle ${projectId} changed; the rejected edit is available in recovery ${recoveryId}`);
    this.name = 'BundleConflictError';
    this.projectId = projectId;
    this.recoveryId = recoveryId;
  }
}

type State = { [K in keyof StoredLibrarySnapshot]: Map<string, StoredLibrarySnapshot[K][number]> };
const stores = ['bundles', 'recoveries', 'migrations'] as const;
const emptyState = (): State => ({ bundles: new Map(), recoveries: new Map(), migrations: new Map() });
interface BundleDatabase {
  transaction<T>(write: boolean, operation: (state: State) => T): Promise<T>;
}

/** Share this database between memory repositories to model independent clients. */
export class InMemoryBundleDatabase implements BundleDatabase {
  private state = emptyState();
  private chain: Promise<unknown> = Promise.resolve();
  transaction<T>(write: boolean, operation: (state: State) => T): Promise<T> {
    const run = this.chain.then(() => {
      const staged = structuredClone(this.state);
      const result = operation(staged);
      const detached = structuredClone(result);
      if (write) this.state = structuredClone(staged);
      return detached;
    });
    this.chain = run.catch(() => undefined);
    return run;
  }
}

/** Separate database avoids changing the existing 2D repository's public contract. */
class IndexedDbBundleDatabase implements BundleDatabase {
  private readonly factory: IDBFactory;
  private database?: Promise<IDBDatabase>;
  constructor(factory: IDBFactory) { this.factory = factory; }
  private open(): Promise<IDBDatabase> {
    if (!this.database) {
      this.database = new Promise<IDBDatabase>((resolve, reject) => {
        const request = this.factory.open('structureCo.unified-bundles', 1);
        request.onupgradeneeded = () => {
          for (const name of stores) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' });
        };
        request.onerror = () => reject(request.error ?? new Error('Cannot open bundle database'));
        request.onblocked = () => reject(new Error('Bundle database upgrade is blocked by another connection'));
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); this.database = undefined; };
          resolve(db);
        };
      }).catch((error: unknown) => { this.database = undefined; throw error; });
    }
    return this.database;
  }
  async transaction<T>(write: boolean, operation: (state: State) => T): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction([...stores], write ? 'readwrite' : 'readonly');
      const state = emptyState();
      let pending = stores.length;
      let result: T;
      let failure: unknown;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('Bundle transaction aborted'));
      tx.onerror = () => { failure ??= tx.error; };
      for (const name of stores) {
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => {
          for (const record of request.result) state[name].set(record.id, record);
          if (--pending !== 0) return;
          try {
            // Reference snapshots identify changed records without hashing inside the transaction.
            const before = Object.fromEntries(stores.map((key) => [key, new Map(state[key] as Map<string, unknown>)])) as Record<typeof stores[number], Map<string, unknown>>;
            result = operation(state);
            if (write) {
              for (const store of stores) {
                for (const [id, record] of state[store]) {
                  if (before[store].get(id) !== record) tx.objectStore(store).put(record);
                }
              }
            }
          } catch (error) { failure = error; tx.abort(); }
        };
      }
    });
  }
}

abstract class BundleRepository implements UnifiedBundleRepository {
  private readonly database: BundleDatabase;
  constructor(database: BundleDatabase) { this.database = database; }
  private async validateStoredBundle(record: StoredBundleRecord): Promise<void> {
    const validated = validateBundle(record.bundle);
    if (record.id !== validated.manifest.projectId || !Number.isInteger(record.revision) || record.revision < 1 || canonicalSerialize(validated) !== canonicalSerialize(record.bundle) || await sha256(canonicalSerialize(record.bundle)) !== record.checksum) {
      throw new Error(`Bundle ${record.id} failed stored integrity verification`);
    }
  }
  private async validateRecovery(record: BundleRecoveryRecord): Promise<void> {
    if (record.bundle) {
      const validated = validateBundle(record.bundle);
      if (record.projectId !== validated.manifest.projectId || record.space3d || canonicalSerialize(validated) !== canonicalSerialize(record.bundle)) throw new Error('Recovery identity failed integrity verification');
    } else if (record.space3d) parseSpace3DDraft(canonicalSerialize(record.space3d));
    else throw new Error('Recovery content failed integrity verification');
    if (await sha256(canonicalSerialize(record.bundle ?? record.space3d)) !== record.checksum) throw new Error(`Recovery ${record.id} failed stored integrity verification`);
  }
  async snapshot(): Promise<BundleLibrarySnapshot> {
    const stored = await this.database.transaction(false, (state) => ({
      bundles: [...state.bundles.values()], recoveries: [...state.recoveries.values()], migrations: [...state.migrations.values()],
    }));
    const snapshot: BundleLibrarySnapshot = { bundles: [], recoveries: [], migrations: stored.migrations, integrityDiagnostics: [] };
    for (const record of stored.bundles) {
      try {
        await this.validateStoredBundle(record);
        snapshot.bundles.push(record);
      } catch (error) {
        snapshot.integrityDiagnostics.push({ store: 'bundles', recordId: record.id, code: 'invalid-record', message: error instanceof Error ? error.message : String(error) });
      }
    }
    for (const record of stored.recoveries) {
      try {
        await this.validateRecovery(record);
        snapshot.recoveries.push(record);
      } catch (error) {
        snapshot.integrityDiagnostics.push({ store: 'recoveries', recordId: record.id, code: 'invalid-record', message: error instanceof Error ? error.message : String(error) });
      }
    }
    return snapshot;
  }
  async openBundle(id: string): Promise<StoredBundleRecord | null> {
    const record = await this.database.transaction(false, (state) => state.bundles.get(id) ?? null);
    if (record) {
      try { await this.validateStoredBundle(record); }
      catch (error) { throw new Error(`Bundle ${id} integrity failure: ${error instanceof Error ? error.message : String(error)}`); }
    }
    return record;
  }
  async saveBundle(input: UnifiedProjectBundleV1, expectedRevision: number): Promise<StoredBundleRecord> {
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error('An explicit nonnegative expected revision is required');
    const bundle = validateBundle(input);
    const checksum = await sha256(canonicalSerialize(bundle));
    const id = bundle.manifest.projectId;
    const timestamp = new Date().toISOString();
    const recoveryId = crypto.randomUUID();
    const outcome = await this.database.transaction(true, (state) => {
      const current = state.bundles.get(id);
      if ((current?.revision ?? 0) !== expectedRevision) {
        state.recoveries.set(recoveryId, { id: recoveryId, projectId: id, reason: 'conflict', createdAt: timestamp, checksum, bundle });
        return { conflict: true as const };
      }
      const record: StoredBundleRecord = { id, revision: expectedRevision + 1, updatedAt: timestamp, checksum, bundle };
      state.bundles.set(id, record);
      return { conflict: false as const, record };
    });
    // Throw only AFTER the recovery transaction has committed.
    if (outcome.conflict) throw new BundleConflictError(id, recoveryId);
    return structuredClone(outcome.record);
  }
  async migrateLegacy(storage: LegacyBundleStorage): Promise<BundleLibrarySnapshot> {
    const snapshot = await this.snapshot();
    const corruptIds = new Set(snapshot.integrityDiagnostics.filter((diagnostic) => diagnostic.store === 'bundles').map((diagnostic) => diagnostic.recordId));
    const corruptRecoveryIds = new Set(snapshot.integrityDiagnostics.filter((diagnostic) => diagnostic.store === 'recoveries').map((diagnostic) => diagnostic.recordId));
    const plans = await prepareLegacyImports(storage, snapshot.bundles);
    const timestamp = new Date().toISOString();
    await this.database.transaction(true, (state) => {
      for (const plan of plans) {
        const pending = plan.sources.filter((source) => {
          const marker = state.migrations.get(source.id);
          if (!marker?.complete) return true;
          // A completed source remains usable if its committed destination is now corrupt.
          // Updating the marker to the new recovery makes concurrent/repeated rescue idempotent.
          return marker.status === 'imported' ? !!plan.bundle && corruptIds.has(plan.bundle.manifest.projectId)
            : !!marker.recoveryId && corruptRecoveryIds.has(marker.recoveryId);
        });
        if (pending.length === 0) continue;
        if (!plan.bundle && !plan.space3d) {
          for (const source of pending) state.migrations.set(source.id, source);
          continue;
        }
        const id = plan.bundle?.manifest.projectId ?? null;
        const current = id ? state.bundles.get(id) : undefined;
        const canImport = plan.bundle && id !== null && !corruptIds.has(id) && (!current || current.checksum === plan.checksum || current.checksum === plan.baseChecksum);
        let recoveryId: string | undefined;
        if (canImport && plan.bundle && id) {
          if (current?.checksum !== plan.checksum) state.bundles.set(id, {
            id, revision: (current?.revision ?? 0) + 1, checksum: plan.checksum, updatedAt: timestamp, bundle: plan.bundle,
          });
        } else {
          recoveryId = crypto.randomUUID();
          state.recoveries.set(recoveryId, {
            id: recoveryId, projectId: id, reason: plan.bundle ? 'migration' : 'unmatched-space3d',
            createdAt: timestamp, checksum: plan.checksum,
            ...(plan.bundle ? { bundle: plan.bundle } : { space3d: plan.space3d }), sourceIds: pending.map((source) => source.id),
          });
        }
        for (const source of pending) state.migrations.set(source.id, {
          ...source, complete: true, status: canImport ? 'imported' : 'recovered', ...(recoveryId ? { recoveryId } : {}),
        });
      }
    });
    return this.snapshot();
  }
}
export class InMemoryUnifiedBundleRepository extends BundleRepository {
  constructor(database = new InMemoryBundleDatabase()) { super(database); }
}
export class IndexedDbUnifiedBundleRepository extends BundleRepository {
  constructor(factory: IDBFactory = globalThis.indexedDB) {
    if (!factory) throw new Error('IndexedDB is unavailable');
    super(new IndexedDbBundleDatabase(factory));
  }
}
