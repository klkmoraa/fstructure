import type { ProjectModel } from '../types';
import { createUnifiedProjectBundle } from '../shared/project/unifiedProjectBundle';
import type { LinkedSpace3DBranchV1, UnifiedProjectBundleV1 } from '../shared/project/unifiedProjectBundle';
import { canonicalSerialize } from './bundleValidation';
import { BundleConflictError, IndexedDbUnifiedBundleRepository, type LegacyBundleStorage, type StoredBundleRecord, type UnifiedBundleRepository } from './unifiedBundleRepository';

export type UnifiedStorageStatus = { issue: 'conflict' | 'load-failed' | 'save-failed' | 'recovered' | null; message: string | null };

/** One revision owner and ordered writes per mounted editor. Never writes legacy storage. */
export class UnifiedProjectSession {
  private records = new Map<string, StoredBundleRecord>();
  // Session working copies include pending/failed writes; committed records alone own revisions.
  private working = new Map<string, UnifiedProjectBundleV1>();
  private blocked = new Set<string>();
  private chain: Promise<unknown> = Promise.resolve();
  private initialization?: Promise<ProjectModel>;
  private storageStatus: UnifiedStorageStatus = { issue: null, message: null };
  private failedWrite?: { projectId: string; space3d: boolean };
  private statusListeners = new Set<() => void>();
  get status() { return this.storageStatus; }
  private set status(value: UnifiedStorageStatus) {
    this.storageStatus = value;
    this.statusListeners.forEach((listener) => listener());
  }
  subscribeStatus(listener: () => void) {
    this.statusListeners.add(listener);
    return () => { this.statusListeners.delete(listener); };
  }
  readonly repository: UnifiedBundleRepository;
  constructor(repository: UnifiedBundleRepository) { this.repository = repository; }
  currentBundle(id: string) { return structuredClone(this.working.get(id) ?? this.records.get(id)?.bundle ?? null); }

  initialize(storage: LegacyBundleStorage, fallback: ProjectModel, projectId = fallback.id): Promise<ProjectModel> {
    return this.initialization ??= (async () => {
      const snapshot = await this.repository.migrateLegacy(storage);
      const diagnostics = [...snapshot.integrityDiagnostics.map((item) => item.message),
        ...snapshot.migrations.filter((item) => item.status === 'invalid').map((item) => item.diagnostic ?? item.sourceKey)];
      if (diagnostics.length) this.status = { issue: 'load-failed', message: diagnostics.join(' · ') };
      else if (snapshot.recoveries.length) this.status = { issue: 'recovered', message: `${snapshot.recoveries.length} recuperaciones conservadas en el proyecto local.` };
      return await this.open(projectId) ?? (projectId !== fallback.id ? await this.open(fallback.id) : null) ?? fallback;
    })();
  }

  async open(id: string): Promise<ProjectModel | null> {
    await this.chain.catch(() => undefined);
    try {
      const record = await this.repository.openBundle(id);
      if (!record) return null;
      this.records.set(id, record);
      this.working.delete(id);
      this.blocked.delete(id);
      if (this.status.issue === 'conflict') this.status = { issue: null, message: null };
      return structuredClone(record.bundle.model2d);
    } catch (error) {
      this.blocked.add(id);
      this.status = { issue: 'load-failed', message: String(error) };
      throw error;
    }
  }

  save2D(project: ProjectModel): Promise<StoredBundleRecord> {
    return this.save(project);
  }
  saveSpace3D(project: ProjectModel, branch: LinkedSpace3DBranchV1): Promise<StoredBundleRecord> {
    return this.save(project, structuredClone(branch));
  }
  private save(project: ProjectModel, branch?: LinkedSpace3DBranchV1): Promise<StoredBundleRecord> {
    const detached = structuredClone(project);
    if (this.blocked.has(detached.id)) return Promise.reject(new Error(this.status.message ?? 'Reopen the canonical project before saving.'));
    const working = this.currentBundle(detached.id) ?? createUnifiedProjectBundle(detached, branch?.sourceVersion ?? crypto.randomUUID());
    if (branch) working.space3d = branch;
    else {
      if (JSON.stringify(working.model2d) !== JSON.stringify(detached)) working.manifest.sourceVersion = crypto.randomUUID();
      working.model2d = detached;
    }
    this.working.set(detached.id, working);
    const clearWorking = (committed: UnifiedProjectBundleV1) => {
      // An unrelated successful write must not discard another branch's failed working copy.
      if (this.working.get(detached.id) === working && canonicalSerialize(committed) === canonicalSerialize(working)) this.working.delete(detached.id);
    };
    const clearFailure = () => {
      if (this.status.issue === 'save-failed' && this.failedWrite?.projectId === detached.id && this.failedWrite.space3d === Boolean(branch)) {
        this.failedWrite = undefined;
        this.status = { issue: null, message: null };
      }
    };
    const write = this.chain.catch(() => undefined).then(async () => {
      if (this.blocked.has(detached.id)) throw new Error(this.status.message ?? 'Reopen the canonical project before saving.');
      const current = this.records.get(detached.id);
      const bundle = current ? structuredClone(current.bundle) : createUnifiedProjectBundle(detached, working.manifest.sourceVersion);
      if (branch && current?.bundle.space3d && canonicalSerialize(current.bundle.space3d) === canonicalSerialize(branch)) {
        clearWorking(current.bundle);
        clearFailure();
        return structuredClone(current);
      }
      if (branch) bundle.space3d = branch;
      else {
        bundle.manifest.sourceVersion = working.manifest.sourceVersion;
        bundle.model2d = detached;
      }
      try {
        const record = await this.repository.saveBundle(bundle, current?.revision ?? 0);
        this.records.set(detached.id, record);
        clearWorking(record.bundle);
        clearFailure();
        return record;
      } catch (error) {
        if (error instanceof BundleConflictError) this.blocked.add(detached.id);
        else this.failedWrite = { projectId: detached.id, space3d: Boolean(branch) };
        this.status = { issue: error instanceof BundleConflictError ? 'conflict' : 'save-failed', message: error instanceof Error ? error.message : String(error) };
        throw error;
      }
    });
    this.chain = write;
    return write;
  }
}

export const createUnifiedProjectSession = () => new UnifiedProjectSession(new IndexedDbUnifiedBundleRepository());
