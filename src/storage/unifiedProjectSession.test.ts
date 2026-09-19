import { expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { normalizeProject } from '../data/migrate';
import { createUnifiedProjectBundle } from '../shared/project/unifiedProjectBundle';
import { InMemoryBundleDatabase, InMemoryUnifiedBundleRepository, type StoredBundleRecord } from './unifiedBundleRepository';
import { UnifiedProjectSession } from './unifiedProjectSession';
import { buildPlanar2DToSpace3DHandoff } from '../integrations/planar2dToSpace3d';
import type { JsonValue, UnifiedProjectBundleV1 } from '../shared/project/unifiedProjectBundle';

class FailOnceRepository extends InMemoryUnifiedBundleRepository {
  private failNext = false;
  failNextSave() { this.failNext = true; }
  override async saveBundle(bundle: UnifiedProjectBundleV1, expectedRevision: number): Promise<StoredBundleRecord> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Disk unavailable');
    }
    return super.saveBundle(bundle, expectedRevision);
  }
}

const storage = { length: 0, key: () => null, getItem: () => null };
it('retains the canonical fallback revision when a requested project is absent', async () => {
  const repo = new InMemoryUnifiedBundleRepository();
  const project = createDefaultProject();
  await repo.saveBundle(createUnifiedProjectBundle({ ...project, name: 'Canonical fallback' }, 'v1'), 0);
  const session = new UnifiedProjectSession(repo);
  const opened = await session.initialize(storage, project, 'missing');
  expect(opened.name).toBe('Canonical fallback');
  await session.save2D({ ...opened, name: 'edited' });
  expect((await repo.snapshot()).recoveries).toHaveLength(0);
});
it('opens canonical data, serializes edits, and preserves independent tool branches', async () => {
  const repo = new InMemoryUnifiedBundleRepository();
  const project = createDefaultProject();
  const bundle = createUnifiedProjectBundle(project, 'v1');
  bundle.design = { retained: 'design' }; bundle.fem = [{ retained: 'fem' }];
  await repo.saveBundle(bundle, 0);
  const session = new UnifiedProjectSession(repo);
  const opened = await session.initialize(storage, { ...project, name: 'stale legacy' });
  expect(opened.name).toBe(project.name);
  await Promise.all([session.save2D({ ...opened, name: 'first' }), session.save2D({ ...opened, name: 'second' })]);
  const saved = await repo.openBundle(project.id);
  expect(saved?.bundle.model2d.name).toBe('second');
  expect(saved?.bundle.design).toEqual({ retained: 'design' });
  expect(saved?.bundle.fem).toEqual([{ retained: 'fem' }]);
  expect(saved?.revision).toBe(3);
});
it('keeps a rejected edit in recovery and blocks stale saves until explicitly reopened', async () => {
  const database = new InMemoryBundleDatabase();
  const repo = new InMemoryUnifiedBundleRepository(database);
  const other = new InMemoryUnifiedBundleRepository(database);
  const project = createDefaultProject();
  await repo.saveBundle(createUnifiedProjectBundle(project, 'v1'), 0);
  const session = new UnifiedProjectSession(repo);
  await session.initialize(storage, project);
  await other.saveBundle(createUnifiedProjectBundle({ ...project, name: 'remote' }, 'v2'), 1);
  await expect(session.save2D({ ...project, name: 'local' })).rejects.toThrow(/changed/);
  expect(session.status.issue).toBe('conflict');
  expect(session.status.message).toContain('recovery');
  await expect(session.save2D(project)).rejects.toThrow();
  expect((await repo.snapshot()).recoveries).toHaveLength(1);
  await session.open(project.id);
  await session.save2D({ ...project, name: 'reviewed' });
  expect((await repo.openBundle(project.id))?.bundle.model2d.name).toBe('reviewed');
});

it('serializes 3D and 2D edits through one revision owner without overwriting either branch', async () => {
  const repo = new InMemoryUnifiedBundleRepository();
  const project = createDefaultProject();
  const session = new UnifiedProjectSession(repo);
  await session.initialize(storage, project);
  const model = JSON.parse(JSON.stringify(buildPlanar2DToSpace3DHandoff(project).candidateModel)) as JsonValue;
  const fresh = await session.saveSpace3D(project, { sourceProjectId: project.id, sourceVersion: 'source-1', model });
  expect(fresh.bundle.space3d?.sourceVersion).toBe(fresh.bundle.manifest.sourceVersion);
  await session.save2D({ ...project, name: 'Edited 2D' });
  const saved = await repo.openBundle(project.id);
  expect(saved?.bundle.space3d?.model).toEqual(model);
  expect(saved?.bundle.space3d?.sourceVersion).toBe('source-1');
  expect(saved?.bundle.manifest.sourceVersion).not.toBe('source-1');
  expect(saved?.bundle.model2d.name).toBe('Edited 2D');
  expect(saved?.revision).toBe(2);
});

it('persists a failed 3D working branch when a later 2D save succeeds', async () => {
  const repo = new FailOnceRepository();
  const project = createDefaultProject();
  const session = new UnifiedProjectSession(repo);
  await session.initialize(storage, project);
  const model = JSON.parse(JSON.stringify(buildPlanar2DToSpace3DHandoff(project).candidateModel)) as JsonValue;
  const branch = { sourceProjectId: project.id, sourceVersion: 'source-1', model };

  repo.failNextSave();
  await expect(session.saveSpace3D(project, branch)).rejects.toThrow('Disk unavailable');
  expect(session.currentBundle(project.id)?.space3d).toEqual(branch);

  const saved = await session.save2D({ ...project, name: 'Edited 2D' });
  expect(saved.bundle.space3d).toEqual(branch);
  expect(saved.bundle.model2d.name).toBe('Edited 2D');
  expect(session.status.issue).toBe('save-failed');
  expect((await repo.openBundle(project.id))?.bundle.space3d).toEqual(branch);
});

it('persists a failed FEM working branch when a later 2D save succeeds', async () => {
  const repo = new FailOnceRepository();
  const project = createDefaultProject();
  const session = new UnifiedProjectSession(repo);
  await session.initialize(storage, project);
  const study = JSON.parse(JSON.stringify({
    format: 'fstructure-fem-bundle', formatVersion: 1,
    document: { kind: 'fem-document', schemaVersion: 1, id: 'study-1', name: 'Mesh 1' },
  })) as JsonValue;

  repo.failNextSave();
  await expect(session.saveFem(project, study)).rejects.toThrow('Disk unavailable');
  expect(session.currentBundle(project.id)?.fem).toEqual([study]);

  const saved = await session.save2D({ ...project, name: 'Edited 2D' });
  expect(saved.bundle.fem).toEqual([study]);
  expect(saved.bundle.model2d.name).toBe('Edited 2D');
  expect(session.status.issue).toBe('save-failed');
  expect((await repo.openBundle(project.id))?.bundle.fem).toEqual([study]);
});

it('persists and upserts FEM study snapshots without overwriting the other tool branches', async () => {
  const repo = new InMemoryUnifiedBundleRepository();
  const project = createDefaultProject();
  const session = new UnifiedProjectSession(repo);
  await session.initialize(storage, project);
  const first = JSON.parse(JSON.stringify({
    format: 'fstructure-fem-bundle', formatVersion: 1,
    document: { kind: 'fem-document', schemaVersion: 1, id: 'study-1', name: 'Mesh 1' },
  })) as JsonValue;
  const second = JSON.parse(JSON.stringify({
    format: 'fstructure-fem-bundle', formatVersion: 1,
    document: { kind: 'fem-document', schemaVersion: 1, id: 'study-1', name: 'Mesh 1 revised' },
    analysis: { success: true },
  })) as JsonValue;

  await session.saveFem(project, first);
  await session.saveFem(project, second);

  const saved = await repo.openBundle(project.id);
  expect(saved?.bundle.fem).toEqual([second]);
  expect(saved?.bundle.space3d).toBeNull();
  expect(saved?.bundle.design).toEqual({});
  expect(saved?.revision).toBe(2);
});

it('guarda proyectos normalizados que traen propiedades opcionales en undefined', async () => {
  // `normalizeProject` materializa claves opcionales como `support.angleDeg` con
  // valor `undefined`. La persistencia las omite, así que la comparación de la
  // copia de trabajo debe omitirlas también: antes abortaba todo guardado real.
  const project = normalizeProject(createDefaultProject());
  expect(project.nodes.some((node) => node.support && 'angleDeg' in node.support && node.support.angleDeg === undefined)).toBe(true);

  const repo = new InMemoryUnifiedBundleRepository();
  const session = new UnifiedProjectSession(repo);
  await session.initialize(storage, project);

  await expect(session.save2D(project)).resolves.toBeDefined();
  await expect(session.saveFem(project, { document: { id: 'study-1' } } as JsonValue)).resolves.toBeDefined();
  const handoff = buildPlanar2DToSpace3DHandoff(project);
  await expect(session.saveSpace3D(project, {
    sourceProjectId: project.id, sourceVersion: 'v1', sourceModel2D: structuredClone(project),
    baselineStatus: 'exact', model: handoff.candidateModel as unknown as JsonValue,
  })).resolves.toBeDefined();

  expect(session.status).toEqual({ issue: null, message: null });
  const saved = await repo.openBundle(project.id);
  expect(saved?.bundle.model2d.id).toBe(project.id);
});
