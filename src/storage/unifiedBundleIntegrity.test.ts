import { canonicalSerialize, sha256 } from './bundleValidation';
import { UnifiedProjectSession } from './unifiedProjectSession';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { setStiffnessDefaults } from '../data/memberStiffness';
import { createBlankProject, createDefaultProject, CURRENT_SCHEMA_VERSION } from '../data/defaultProject';
import { createUnifiedProjectBundle } from '../shared/project/unifiedProjectBundle';
import {
  InMemoryBundleDatabase, InMemoryUnifiedBundleRepository, IndexedDbUnifiedBundleRepository,
  type StoredBundleRecord, type BundleRecoveryRecord,
} from './unifiedBundleRepository';

const bundle = (id: string) => createUnifiedProjectBundle({ ...createBlankProject(), id, name: id }, 'v1');
type Store = 'bundles' | 'recoveries';
type RecordValue = StoredBundleRecord | BundleRecoveryRecord;

function indexedDbAccess(factory: IDBFactory, store: Store, change?: (record: RecordValue) => void): Promise<RecordValue[]> {
  return new Promise((resolve, reject) => {
    const request = factory.open('structureCo.unified-bundles', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(store, change ? 'readwrite' : 'readonly');
      let records: RecordValue[];
      transaction.oncomplete = () => { database.close(); resolve(records); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
      const read = transaction.objectStore(store).getAll();
      read.onsuccess = () => {
        records = read.result;
        if (change) for (const record of records) { change(record); transaction.objectStore(store).put(record); }
      };
    };
  });
}

const implementations = [
  { name: 'memory', setup: () => {
    const database = new InMemoryBundleDatabase();
    return {
      repository: () => new InMemoryUnifiedBundleRepository(database),
      access: (store: Store, change?: (record: RecordValue) => void) => database.transaction(!!change, (state) => {
        const records = [...state[store].values()];
        if (change) records.forEach(change);
        return records;
      }),
    };
  } },
  { name: 'IndexedDB', setup: () => {
    const factory = new IDBFactory();
    return { repository: () => new IndexedDbUnifiedBundleRepository(factory), access: (store: Store, change?: (record: RecordValue) => void) => indexedDbAccess(factory, store, change) };
  } },
];

describe.each(implementations)('$name corruption isolation', ({ setup }) => {
  it('opens a checksummed older project when current defaults only add fields, then migrates on save', async () => {
    const { repository, access } = setup();
    const original = bundle('older-defaults');
    await repository().saveBundle(original, 0);
    const record = (await access('bundles'))[0] as StoredBundleRecord;
    record.bundle.model2d.schemaVersion = 8;
    delete (record.bundle.model2d.settings as Partial<typeof record.bundle.model2d.settings>).showResultValues;
    record.checksum = await sha256(canonicalSerialize(record.bundle));
    await access('bundles', (stored) => Object.assign(stored, record));
    const before = await access('bundles');
    expect((await repository().snapshot()).integrityDiagnostics).toEqual([]);
    const session = new UnifiedProjectSession(repository());
    const opened = await session.open('older-defaults');
    expect(opened?.settings.showResultValues).toBe(true);
    expect(await access('bundles')).toEqual(before);
    await session.save2D(opened!);
    expect((await repository().openBundle('older-defaults'))?.bundle.model2d.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('still blocks a checksummed field that normalization would discard', async () => {
    const { repository, access } = setup();
    await repository().saveBundle(bundle('unknown-field'), 0);
    const record = (await access('bundles'))[0] as StoredBundleRecord;
    (record.bundle.model2d.settings as unknown as Record<string, unknown>).futureOption = { value: 1 };
    record.checksum = await sha256(canonicalSerialize(record.bundle));
    await access('bundles', (stored) => Object.assign(stored, record));
    expect((await repository().snapshot()).integrityDiagnostics).toEqual([
      expect.objectContaining({ store: 'bundles', recordId: 'unknown-field', code: 'invalid-record' }),
    ]);
    await expect(repository().openBundle('unknown-field')).rejects.toThrow(/integrity/);
  });

  it.each([8, 9])('abre bundles v%s sin borrar ni reescribir el original y migra al guardar', async (version) => {
    const { repository, access } = setup();
    const original = bundle(`legacy-v${version}`);
    delete original.model2d.settings.stiffnessDefaults;
    if (version === 9) original.model2d = setStiffnessDefaults({ ...createDefaultProject(), id: original.model2d.id }, { mode: 'EI', value: 16000, factor: 3 }, true);
    await repository().saveBundle(original, 0);
    const record = (await access('bundles'))[0] as StoredBundleRecord;
    record.bundle.model2d.schemaVersion = version;
    record.checksum = await sha256(canonicalSerialize(record.bundle));
    await access('bundles', (stored) => Object.assign(stored, record));
    const before = await access('bundles');
    expect((await repository().snapshot()).integrityDiagnostics).toEqual([]);
    const session = new UnifiedProjectSession(repository());
    const opened = await session.open(`legacy-v${version}`);
    expect(opened?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    if (version === 8) expect(opened?.settings.stiffnessDefaults).toBeUndefined();
    else {
      expect(opened?.settings.stiffnessDefaults).toEqual({ mode: 'EI', value: 16000, factor: 3 });
      expect(opened?.members.every(member => member.stiffnessFactor === 3)).toBe(true);
    }
    expect(await access('bundles')).toEqual(before);
    await session.save2D(opened!);
    expect((await repository().openBundle(`legacy-v${version}`))?.bundle.model2d.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it.each(['bundles', 'recoveries'] as const)('catches corrupt %s blocking healthy projects or causing mutation during reads', async (store) => {
    const { repository, access } = setup();
    await repository().saveBundle(bundle('healthy'), 0);
    await repository().saveBundle(bundle('damaged'), 0);
    await expect(repository().saveBundle(bundle('damaged'), 0)).rejects.toThrow();
    await access(store, (record) => {
      if (record.bundle?.manifest.projectId === 'damaged') record.bundle.model2d.name = 'Tampered';
    });
    const before = await access(store);
    expect((await repository().openBundle('healthy'))?.bundle.model2d.name).toBe('healthy');
    const snapshot = await repository().snapshot();
    expect(snapshot.integrityDiagnostics).toEqual([expect.objectContaining({ store, code: 'invalid-record', recordId: before.find((record) => record.bundle?.manifest.projectId === 'damaged')!.id })]);
    expect(snapshot.integrityDiagnostics[0].message).toMatch(/integrity/);
    expect(snapshot.bundles.map((record) => record.id).sort()).toEqual(store === 'bundles' ? ['healthy'] : ['damaged', 'healthy']);
    expect(snapshot.recoveries).toHaveLength(store === 'recoveries' ? 0 : 1);
    expect(await access(store)).toEqual(before);
    if (store === 'bundles') await expect(repository().openBundle('damaged')).rejects.toThrow(/integrity/);
  });

  it('catches corrupt canonical data being treated as already imported by its old checksum', async () => {
    const { repository, access } = setup();
    const legacy = JSON.stringify(bundle('damaged').model2d);
    const storage = { length: 1, key: () => 'structureCo.project', getItem: (key: string) => key === 'structureCo.project' ? legacy : null };
    // Seed the exact migration checksum, then alter its bytes without changing that checksum.
    await repository().migrateLegacy(storage);
    await access('bundles', (record) => { record.bundle!.model2d.name = 'Tampered'; });
    const before = await access('bundles');
    // A different source key with identical valid content is still pending.
    const backup = { length: 1, key: () => 'structureCo.project.backup', getItem: (key: string) => key === 'structureCo.project.backup' ? legacy : null };
    const result = await repository().migrateLegacy(backup);
    expect(result.integrityDiagnostics).toEqual([expect.objectContaining({ store: 'bundles', recordId: 'damaged', code: 'invalid-record' })]);
    expect(result.recoveries).toHaveLength(1);
    expect(result.recoveries[0].bundle?.model2d.name).toBe('damaged');
    expect(result.migrations.find((record) => record.sourceKey.endsWith('.backup'))?.status).toBe('recovered');
    expect(await access('bundles')).toEqual(before);
    await expect(repository().openBundle('damaged')).rejects.toThrow(/integrity/);
  });

  it('catches unrelated corrupt records preventing valid legacy imports', async () => {
    const { repository, access } = setup();
    await repository().saveBundle(bundle('damaged'), 0);
    await expect(repository().saveBundle(bundle('damaged'), 0)).rejects.toThrow();
    await access('bundles', (record) => { record.bundle!.manifest.schemaVersion = 999 as 1; });
    await access('recoveries', (record) => { record.bundle!.model2d.name = 'Tampered'; });
    const legacy = JSON.stringify(bundle('new-import').model2d);
    const result = await repository().migrateLegacy({ length: 1, key: () => 'structureCo.project', getItem: (key: string) => key === 'structureCo.project' ? legacy : null });
    expect(result.integrityDiagnostics.map((diagnostic) => diagnostic.store).sort()).toEqual(['bundles', 'recoveries']);
    expect(result.bundles.map((record) => record.id)).toEqual(['new-import']);
    expect(result.migrations[0]).toMatchObject({ status: 'imported', complete: true });
    expect((await repository().openBundle('new-import'))?.bundle.model2d.name).toBe('new-import');
  });

  it('catches completed markers hiding a valid legacy recovery after their destination is corrupted', async () => {
    const { repository, access } = setup();
    const legacy = JSON.stringify(bundle('damaged').model2d);
    const storage = { length: 1, key: () => 'structureCo.project', getItem: (key: string) => key === 'structureCo.project' ? legacy : null };
    await repository().migrateLegacy(storage);
    await access('bundles', (record) => { record.bundle!.model2d.name = 'Tampered'; });
    const repaired = await repository().migrateLegacy(storage);
    expect(repaired.recoveries).toHaveLength(1);
    expect(repaired.recoveries[0].bundle?.model2d.name).toBe('damaged');
    expect(repaired.migrations[0].status).toBe('recovered');
    expect((await repository().migrateLegacy(storage)).recoveries).toHaveLength(1);
    // A damaged recovery destination can also be rescued once from its unchanged source.
    await access('recoveries', (record) => { record.bundle!.model2d.name = 'Tampered again'; });
    const rescued = await repository().migrateLegacy(storage);
    expect(rescued.recoveries).toHaveLength(1);
    expect(rescued.recoveries[0].bundle?.model2d.name).toBe('damaged');
    expect(rescued.integrityDiagnostics.map((diagnostic) => diagnostic.store).sort()).toEqual(['bundles', 'recoveries']);
    expect((await repository().migrateLegacy(storage)).recoveries).toHaveLength(1);
  });
});
