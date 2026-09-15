import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { createBlankProject, createDefaultProject } from '../data/defaultProject';
import { createBlankSpace3DProject } from '../modules/space3d/space3d/model/defaultProject';
import { createUnifiedProjectBundle, type UnifiedProjectBundleV1 } from '../shared/project/unifiedProjectBundle';
import {
  BundleConflictError, IndexedDbUnifiedBundleRepository, InMemoryBundleDatabase,
  InMemoryUnifiedBundleRepository, canonicalSerialize, sha256,
} from './unifiedBundleRepository';

const bundle = (name = 'Original') => {
  const project = createBlankProject();
  project.id = 'p1';
  project.name = name;
  return createUnifiedProjectBundle(project, 'source-1');
};
const model3d = (id = 'space3d:p1') => ({ ...createBlankSpace3DProject(), id });
class LegacyStorage {
  readonly bytes: Map<string, string>;
  constructor(entries: [string, string][]) { this.bytes = new Map(entries); }
  get length() { return this.bytes.size; }
  key(index: number) { return [...this.bytes.keys()][index] ?? null; }
  getItem(key: string) { return this.bytes.get(key) ?? null; }
}
const sources = () => new LegacyStorage([
  ['structureCo.project', JSON.stringify(bundle().model2d, null, 2)],
  ['structureco:space3d:v1:p1', JSON.stringify(model3d())],
  ['structureCo.theme', 'dark'], ['structureCo.classroom', 'private'],
  ['structureCo.remote-endpoint', 'https://example.test'],
]);
const implementations = [
  { name: 'IndexedDB', setup: () => { const db = new IDBFactory(); return () => new IndexedDbUnifiedBundleRepository(db); } },
  { name: 'memory', setup: () => { const db = new InMemoryBundleDatabase(); return () => new InMemoryUnifiedBundleRepository(db); } },
];

describe.each(implementations)('$name bundle transaction conformance', ({ setup }) => {
  it('catches lost committed bundles across instances and leaked mutable references', async () => {
    const reopen = setup();
    const repository = reopen();
    const input = bundle();
    const saved = await repository.saveBundle(input, 0);
    expect(saved.revision).toBe(1);
    input.model2d.name = 'Outside mutation';
    saved.bundle.model2d.name = 'Returned mutation';
    const read = await reopen().openBundle('p1');
    expect(read?.bundle.model2d.name).toBe('Original');
    expect(read?.checksum).toMatch(/^[a-f0-9]{64}$/);
    const updated = await reopen().saveBundle(bundle('Next'), 1);
    expect(updated.revision).toBe(2);
    expect(updated.checksum).not.toBe(read?.checksum);
    expect((await repository.openBundle('p1'))?.bundle.model2d.name).toBe('Next');
  });

  it('catches an existing structural project losing nodes, loads or units when opened and saved', async () => {
    const reopen = setup();
    const project = createDefaultProject();
    project.id = 'frame';
    const original = JSON.stringify(project);
    await reopen().saveBundle(createUnifiedProjectBundle(project, 'frame-v1'), 0);
    const opened = (await reopen().openBundle('frame'))!;
    expect(opened.bundle.model2d.nodes.map((node) => [node.id, node.x, node.y])).toEqual([
      ['N1', 0, 0], ['N2', 6, 0], ['N3', 0, 4], ['N4', 6, 4],
    ]);
    expect(opened.bundle.model2d.nodalLoads.map((load) => load.fy)).toEqual([-20, -20]);
    expect(opened.bundle.model2d.settings.units).toBe('kN-m');
    await reopen().saveBundle(opened.bundle, 1);
    expect((await reopen().openBundle('frame'))?.bundle.model2d).toEqual(JSON.parse(original));
  });

  it('catches discarded normalization leaving required fields undefined after reopening', async () => {
    const reopen = setup();
    const input = bundle();
    input.model2d.nodes = [{ id: 'N1', x: 5, y: 9, support: { type: 'fixed' } }];
    Reflect.deleteProperty(input.model2d, 'settings');
    Reflect.deleteProperty(input.model2d.nodes[0], 'x');
    const saved = await reopen().saveBundle(input, 0);
    expect(saved.bundle.model2d.nodes[0]).toEqual({ id: 'N1', x: 0, y: 9, support: { type: 'fixed' } });
    const read = (await reopen().openBundle('p1'))!;
    expect(read.bundle.model2d.settings.units).toBe('kN-m');
    expect(read.bundle.model2d.settings.gridSize).toBe(1);
    expect(read.bundle.model2d.nodes[0].x).toBe(0);
    expect(read.checksum).toBe(await sha256(canonicalSerialize(read.bundle)));
  });

  it('catches normalization discarding supported optional engineering fields', async () => {
    const reopen = setup();
    const input = createUnifiedProjectBundle(createDefaultProject(), 'optional-v1');
    input.model2d.settings.analysisMode = 'p-delta';
    input.model2d.settings.solutionMethod = 'kani-frame';
    input.model2d.members[0].G = 80_000_000;
    input.model2d.members[0].shearArea = 0.004;
    input.model2d.members[0].rotationalSpringI = 120;
    const saved = await reopen().saveBundle(input, 0);
    const read = (await reopen().openBundle(saved.id))!;
    expect(read.bundle.model2d.settings).toMatchObject({ analysisMode: 'p-delta', solutionMethod: 'kani-frame' });
    expect(read.bundle.model2d.members[0]).toMatchObject({ G: 80_000_000, shearArea: 0.004, rotationalSpringI: 120 });
  });

  it.each(['manifest', 'model2d', 'design'] as const)('catches a root %s accessor being materialized before validation', async (field) => {
    const repository = setup()();
    await repository.saveBundle(bundle(), 0);
    const input = bundle('Accessor');
    let readCount = 0;
    const original = input[field];
    Object.defineProperty(input, field, { enumerable: true, get() {
      readCount++;
      if (field === 'manifest' && readCount > 1) return { ...(original as object), schemaVersion: 999 };
      return original;
    } });
    await expect(repository.saveBundle(input, 1)).rejects.toThrow();
    expect(readCount).toBe(0);
    expect((await repository.openBundle('p1'))?.bundle.model2d.name).toBe('Original');
  });

  it('catches concurrent stale saves overwriting the winner or losing the rejected edit', async () => {
    const reopen = setup();
    await reopen().saveBundle(bundle(), 0);
    const results = await Promise.allSettled([
      reopen().saveBundle(bundle('Writer A'), 1), reopen().saveBundle(bundle('Writer B'), 1),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(BundleConflictError);
    const snapshot = await reopen().snapshot();
    expect(snapshot.bundles[0].revision).toBe(2);
    expect(snapshot.recoveries).toHaveLength(1);
    expect(snapshot.recoveries[0]).toMatchObject({ reason: 'conflict', projectId: 'p1' });
    expect([snapshot.bundles[0].bundle.model2d.name, snapshot.recoveries[0].bundle?.model2d.name].sort())
      .toEqual(['Writer A', 'Writer B']);
  });

  it.each([
    ['future manifest', (b: UnifiedProjectBundleV1) => { (b.manifest as { schemaVersion: number }).schemaVersion = 9; }],
    ['future 2D schema', (b: UnifiedProjectBundleV1) => { b.model2d.schemaVersion = 999; }],
    ['wrong identity', (b: UnifiedProjectBundleV1) => { b.manifest.projectId = 'other'; }],
    ['wrong authority', (b: UnifiedProjectBundleV1) => { Object.assign(b.manifest, { authoritativeModel: 'space3d' }); }],
    ['empty version', (b: UnifiedProjectBundleV1) => { b.manifest.sourceVersion = ''; }],
    ['broken 2D model', (b: UnifiedProjectBundleV1) => { Object.assign(b.model2d, { nodes: null }); }],
    ['non-JSON design', (b: UnifiedProjectBundleV1) => { Object.assign(b, { design: { runtime: () => 1 } }); }],
    ['nonfinite FEM', (b: UnifiedProjectBundleV1) => { b.fem = [{ value: Infinity }]; }],
    ['malformed FEM list', (b: UnifiedProjectBundleV1) => { Object.assign(b, { fem: {} }); }],
    ['bad Space3D shape', (b: UnifiedProjectBundleV1) => { b.space3d = { sourceProjectId: 'p1', sourceVersion: 'source-1', model: {} }; }],
    ['wrong 3D source', (b: UnifiedProjectBundleV1) => { b.space3d = { sourceProjectId: 'other', sourceVersion: 'source-1', model: JSON.parse(JSON.stringify(model3d())) }; }],
    ['wrong 3D version', (b: UnifiedProjectBundleV1) => { b.space3d = { sourceProjectId: 'p1', sourceVersion: 'other', model: JSON.parse(JSON.stringify(model3d())) }; }],
    ['wrong 3D identity', (b: UnifiedProjectBundleV1) => { b.space3d = { sourceProjectId: 'p1', sourceVersion: 'source-1', model: JSON.parse(JSON.stringify(model3d('space3d:other'))) }; }],
    ['array runtime properties', (b: UnifiedProjectBundleV1) => { Object.assign(b.fem, { runtime: () => 1 }); }],
    ['nested model array runtime properties', (b: UnifiedProjectBundleV1) => { Object.assign(b.model2d.nodes, { runtime: () => 1 }); }],
    ['cyclic 2D model', (b: UnifiedProjectBundleV1) => { Object.assign(b.model2d, { cycle: b.model2d }); }],
  ])('catches %s reaching storage', async (_name, corrupt) => {
    const repository = setup()();
    await repository.saveBundle(bundle(), 0);
    const bad = bundle('Invalid');
    corrupt(bad);
    await expect(repository.saveBundle(bad, 1)).rejects.toThrow();
    expect((await repository.openBundle('p1'))?.bundle.model2d.name).toBe('Original');
    expect((await repository.snapshot()).recoveries).toEqual([]);
  });

  it('catches duplicate migrations, unrelated key imports, and modified original bytes', async () => {
    const reopen = setup();
    const storage = sources();
    const original = [...storage.bytes];
    await reopen().migrateLegacy(storage);
    await reopen().migrateLegacy(storage);
    const snapshot = await reopen().snapshot();
    expect(snapshot.bundles).toHaveLength(1);
    expect(snapshot.bundles[0].revision).toBe(1);
    expect(snapshot.bundles[0].bundle.space3d).toMatchObject({ sourceProjectId: 'p1', model: { id: 'space3d:p1' } });
    expect(snapshot.bundles[0].bundle.space3d?.sourceVersion).toBe(snapshot.bundles[0].bundle.manifest.sourceVersion);
    expect(snapshot.migrations.map((m) => m.status)).toEqual(['imported', 'imported']);
    expect(snapshot.recoveries).toEqual([]);
    expect([...storage.bytes]).toEqual(original);
  });

  it('catches concurrent migrations duplicating bundles or recovery records', async () => {
    const reopen = setup();
    await Promise.all([reopen().migrateLegacy(sources()), reopen().migrateLegacy(sources())]);
    const snapshot = await reopen().snapshot();
    expect(snapshot.bundles).toHaveLength(1);
    expect(snapshot.bundles[0].revision).toBe(1);
    expect(snapshot.recoveries).toEqual([]);
    expect(snapshot.migrations).toHaveLength(2);
  });

  it('catches standalone, absent-namespace, and mismatched-lineage 3D silently disappearing or attaching', async () => {
    const repository = setup()();
    const storage = new LegacyStorage([
      ['structureCo.project', JSON.stringify(bundle().model2d)],
      ['structureco:space3d:v1', JSON.stringify(model3d('standalone'))],
      ['structureco:space3d:v1:missing', JSON.stringify(model3d('space3d:missing'))],
      ['structureco:space3d:v1:p1', JSON.stringify(model3d('space3d:other'))],
    ]);
    await repository.migrateLegacy(storage);
    await repository.migrateLegacy(storage);
    const snapshot = await repository.snapshot();
    expect(snapshot.bundles[0].bundle.space3d).toBeNull();
    expect(snapshot.recoveries.map((r) => r.space3d?.id).sort()).toEqual(['space3d:missing', 'space3d:other', 'standalone']);
    expect(snapshot.migrations.filter((m) => m.status === 'recovered')).toHaveLength(3);
  });

  it('catches corrupt primaries hiding valid backups or diagnostics marking invalid sources complete', async () => {
    const repository = setup()();
    const storage = new LegacyStorage([
      ['structureCo.project', '{broken'], ['structureCo.project.backup', JSON.stringify(bundle('Backup').model2d)],
      ['structureco:space3d:v1:p1', '{broken3d'], ['structureco:space3d:v1:p1:backup', JSON.stringify(model3d())],
      ['structureCo.project.recovery', 'forensic bytes'],
    ]);
    const original = [...storage.bytes];
    await repository.migrateLegacy(storage);
    const snapshot = await repository.snapshot();
    expect(snapshot.bundles[0].bundle.model2d.name).toBe('Backup');
    expect(snapshot.bundles[0].bundle.space3d?.model).toMatchObject({ id: 'space3d:p1' });
    expect(snapshot.migrations.filter((m) => m.status === 'invalid')).toHaveLength(3);
    expect(snapshot.migrations.filter((m) => m.status === 'invalid').every((m) => m.complete === false && !!m.diagnostic)).toBe(true);
    expect([...storage.bytes]).toEqual(original);
    storage.bytes.set('structureCo.project', JSON.stringify(bundle('Repaired').model2d));
    await repository.migrateLegacy(storage);
    expect((await repository.snapshot()).recoveries[0].bundle?.model2d.name).toBe('Repaired');
  });

  it('catches migration conflicts replacing canonical bundles or duplicating recoveries on retry', async () => {
    const repository = setup()();
    await repository.saveBundle(bundle('Canonical'), 0);
    await repository.migrateLegacy(sources());
    await repository.migrateLegacy(sources());
    const snapshot = await repository.snapshot();
    expect(snapshot.bundles[0]).toMatchObject({ revision: 1, bundle: { model2d: { name: 'Canonical' }, space3d: null } });
    expect(snapshot.recoveries.filter((r) => r.bundle)).toHaveLength(1);
    expect(snapshot.recoveries.find((r) => r.bundle)?.bundle).toMatchObject({ model2d: { name: 'Original' }, space3d: { model: { id: 'space3d:p1' } } });
    expect(snapshot.migrations.every((m) => m.complete)).toBe(true);
  });

  it('catches late matching 3D imports being stranded after the same 2D source was already migrated', async () => {
    const repository = setup()();
    const storage = new LegacyStorage([['structureCo.project', JSON.stringify(bundle().model2d)]]);
    await repository.migrateLegacy(storage);
    const current = (await repository.openBundle('p1'))!;
    current.bundle.design = { annotation: 'Keep this' };
    await repository.saveBundle(current.bundle, 1);
    storage.bytes.set('structureco:space3d:v1:p1', JSON.stringify(model3d()));
    await repository.migrateLegacy(storage);
    const snapshot = await repository.snapshot();
    expect(snapshot.bundles[0].revision).toBe(3);
    expect(snapshot.bundles[0].bundle.design).toEqual({ annotation: 'Keep this' });
    expect(snapshot.bundles[0].bundle.space3d?.model).toMatchObject({ id: 'space3d:p1' });
    expect(snapshot.recoveries).toEqual([]);
  });

  it('catches valid backup alternatives being discarded after a valid primary', async () => {
    const repository = setup()();
    const storage = sources();
    storage.bytes.set('structureCo.project.backup', JSON.stringify(bundle('Earlier 2D').model2d));
    storage.bytes.set('structureco:space3d:v1:p1:backup', JSON.stringify({ ...model3d(), name: 'Earlier 3D' }));
    const original = [...storage.bytes];
    await repository.migrateLegacy(storage);
    await repository.migrateLegacy(storage);
    const snapshot = await repository.snapshot();
    expect(snapshot.bundles[0].bundle.model2d.name).toBe('Original');
    expect(snapshot.recoveries.find((r) => r.bundle)?.bundle?.model2d.name).toBe('Earlier 2D');
    expect(snapshot.recoveries.find((r) => r.space3d)?.space3d?.name).toBe('Earlier 3D');
    expect(snapshot.recoveries).toHaveLength(2);
    expect([...storage.bytes]).toEqual(original);
  });
});

describe('IndexedDB abort boundaries', () => {
  const originalPut = IDBObjectStore.prototype.put;
  afterEach(() => { IDBObjectStore.prototype.put = originalPut; });

  function abortAfterBundleWrite() {
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      const request = originalPut.apply(this, args);
      if (this.name === 'bundles') request.addEventListener('success', () => this.transaction.abort());
      return request;
    };
  }

  it('catches an aborted replacement destroying the last committed bundle', async () => {
    const factory = new IDBFactory();
    const repository = new IndexedDbUnifiedBundleRepository(factory);
    await repository.saveBundle(bundle(), 0);
    abortAfterBundleWrite();
    await expect(repository.saveBundle(bundle('Must roll back'), 1)).rejects.toThrow();
    expect((await new IndexedDbUnifiedBundleRepository(factory).openBundle('p1'))?.bundle.model2d.name).toBe('Original');
  });

  it('catches partial migration committing a bundle or marker before all writes succeed', async () => {
    const factory = new IDBFactory();
    const repository = new IndexedDbUnifiedBundleRepository(factory);
    const storage = sources();
    const original = [...storage.bytes];
    abortAfterBundleWrite();
    await expect(repository.migrateLegacy(storage)).rejects.toThrow();
    expect(await new IndexedDbUnifiedBundleRepository(factory).snapshot()).toEqual({ bundles: [], recoveries: [], migrations: [], integrityDiagnostics: [] });
    expect([...storage.bytes]).toEqual(original);
    IDBObjectStore.prototype.put = originalPut;
    await repository.migrateLegacy(storage);
    expect((await repository.snapshot()).bundles).toHaveLength(1);
    expect((await repository.snapshot()).migrations).toHaveLength(2);
  });

  it('catches migration markers surviving an abort after recovery and metadata writes', async () => {
    const factory = new IDBFactory();
    const repository = new IndexedDbUnifiedBundleRepository(factory);
    await repository.saveBundle(bundle('Canonical'), 0);
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      const request = originalPut.apply(this, args);
      if (this.name === 'migrations') request.addEventListener('success', () => this.transaction.abort(), { once: true });
      return request;
    };
    await expect(repository.migrateLegacy(sources())).rejects.toThrow();
    const snapshot = await new IndexedDbUnifiedBundleRepository(factory).snapshot();
    expect(snapshot.bundles[0].bundle.model2d.name).toBe('Canonical');
    expect(snapshot.recoveries).toEqual([]);
    expect(snapshot.migrations).toEqual([]);
    IDBObjectStore.prototype.put = originalPut;
    await repository.migrateLegacy(sources());
    expect((await repository.snapshot()).recoveries).toHaveLength(1);
  });
});

it('catches memory transactions exposing half-written bundles and metadata after failure', async () => {
  const database = new InMemoryBundleDatabase();
  const repository = new InMemoryUnifiedBundleRepository(database);
  await repository.saveBundle(bundle(), 0);
  await expect(database.transaction(true, (state) => {
    state.bundles.get('p1')!.bundle.model2d.name = 'Uncommitted';
    state.migrations.set('partial', { id: 'partial', sourceKey: 'source', sourceChecksum: 'checksum', complete: true, status: 'imported' });
    throw new Error('Abort after staging metadata');
  })).rejects.toThrow('Abort after staging metadata');
  expect((await repository.openBundle('p1'))?.bundle.model2d.name).toBe('Original');
  expect((await repository.snapshot()).migrations).toEqual([]);
});

it('catches modified stored bytes being returned as a checksum-verified project', async () => {
  const database = new InMemoryBundleDatabase();
  const repository = new InMemoryUnifiedBundleRepository(database);
  await repository.saveBundle(bundle(), 0);
  await database.transaction(true, (state) => { state.bundles.get('p1')!.bundle.model2d.name = 'Tampered'; });
  await expect(repository.openBundle('p1')).rejects.toThrow(/integrity/);
});

it('catches tampered recovery bytes being offered as a verified recoverable import', async () => {
  const database = new InMemoryBundleDatabase();
  const repository = new InMemoryUnifiedBundleRepository(database);
  await repository.migrateLegacy(new LegacyStorage([['structureco:space3d:v1', JSON.stringify(model3d('standalone'))]]));
  await database.transaction(true, (state) => { Object.assign([...state.recoveries.values()][0].space3d!, { name: 'Tampered' }); });
  const snapshot = await repository.snapshot();
  expect(snapshot.recoveries).toEqual([]);
  expect(snapshot.integrityDiagnostics).toEqual([expect.objectContaining({ store: 'recoveries', code: 'invalid-record', message: expect.stringMatching(/integrity/) })]);
});

it('catches noncanonical object ordering and verifies SHA-256 against the standard abc vector', async () => {
  expect(canonicalSerialize({ z: [2, 1], a: { y: true, x: null } })).toBe('{"a":{"x":null,"y":true},"z":[2,1]}');
  expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
