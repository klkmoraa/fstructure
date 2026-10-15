import { describe, expect, it } from 'vitest';
import { createDefaultProject, createSingleWork } from '../data/defaultProject';
import { createSpace3DPortalExample } from '../modules/space3d/space3d/model/defaultProject';
import { createUnifiedProjectBundle, type JsonValue, type UnifiedProjectBundleV1 } from '../shared/project/unifiedProjectBundle';
import type { SingleWorkTool } from '../types';
import { canonicalSerialize, validateBundle } from './bundleValidation';
import { promoteBundleToProject, promotedProjectName, savePromotedProject } from './promoteProject';
import { InMemoryUnifiedBundleRepository } from './unifiedBundleRepository';
import { UnifiedProjectSession } from './unifiedProjectSession';

const design: JsonValue = {
  kind: 'fstructure-design-workbench', schemaVersion: 8,
  entries: { element: 'beam', code: 'ntc-2023', beam: { b: '30', h: '60', fc: '25' } },
};

const singleBundle = (tool: SingleWorkTool, name = 'Viga V-1'): UnifiedProjectBundleV1 => {
  const project = createSingleWork(tool, name);
  const bundle = createUnifiedProjectBundle(project, 'v-original');
  bundle.design = structuredClone(design);
  bundle.space3d = {
    sourceProjectId: project.id, sourceVersion: 'v-original',
    model: JSON.parse(JSON.stringify({ ...createSpace3DPortalExample(), id: `space3d:${project.id}` })) as JsonValue,
  };
  bundle.fem = [{ document: { id: 'estudio-1' }, nodes: 3 }];
  return bundle;
};

describe('promoteBundleToProject', () => {
  it('copia todo con identidad nueva y sin workScope, sin tocar la entrada', () => {
    const source = singleBundle('beam');
    const before = canonicalSerialize(source);
    const copy = promoteBundleToProject(source, { projectId: 'copia-1', name: 'Viga V-1 · proyecto' });
    expect(canonicalSerialize(source)).toBe(before);
    expect(copy.manifest.projectId).toBe('copia-1');
    expect(copy.model2d.id).toBe('copia-1');
    expect(copy.model2d.name).toBe('Viga V-1 · proyecto');
    expect(copy.model2d.settings.workScope).toBeUndefined();
    expect(Object.hasOwn(copy.model2d.settings, 'workScope')).toBe(false);
    expect(copy.design).toEqual(source.design);
    expect(copy.fem).toEqual(source.fem);
    expect(copy.space3d?.sourceProjectId).toBe('copia-1');
    expect((copy.space3d?.model as { id: string }).id).toBe('space3d:copia-1');
    // Salvo el id, el modelo 3D es el mismo.
    const { id: _a, ...copyModel } = copy.space3d!.model as Record<string, JsonValue>;
    const { id: _b, ...sourceModel } = source.space3d!.model as Record<string, JsonValue>;
    expect(copyModel).toEqual(sourceModel);
    // El resultado es un bundle válido (identidades coherentes).
    expect(() => validateBundle(copy)).not.toThrow();
  });

  it('nombra la copia en el idioma de la superficie', () => {
    expect(promotedProjectName('Zapata Z-1', 'es')).toBe('Zapata Z-1 · proyecto');
    expect(promotedProjectName('Footing F-1', 'en')).toBe('Footing F-1 · project');
  });
});

describe('savePromotedProject', () => {
  it('deja el original intacto byte a byte y guarda una copia con id distinto', async () => {
    const repository = new InMemoryUnifiedBundleRepository();
    const original = await repository.saveBundle(singleBundle('space3d', 'Nave 3D'), 0);
    await repository.setLibraryState([original.id], 'saved');
    const stored = await repository.openBundle(original.id);
    const before = canonicalSerialize(stored);

    const copy = await savePromotedProject(repository, stored!.bundle, 'Nave 3D · proyecto', stored!.libraryState);

    expect(canonicalSerialize(await repository.openBundle(original.id))).toBe(before);
    expect(copy.id).not.toBe(original.id);
    expect(copy.revision).toBe(1);
    expect(copy.libraryState).toBe('saved');
    const reopened = await repository.openBundle(copy.id);
    expect(reopened?.bundle.model2d.settings.workScope).toBeUndefined();
    expect(reopened?.bundle.design).toEqual(stored!.bundle.design);
    expect((reopened?.bundle.space3d?.model as { members: unknown[] }).members).toEqual((stored!.bundle.space3d?.model as { members: unknown[] }).members);
    const snapshot = await repository.snapshot();
    expect(snapshot.integrityDiagnostics).toEqual([]);
    expect(snapshot.bundles).toHaveLength(2);
  });

  it('un borrador da una copia en Borradores y nunca reutiliza el id del original', async () => {
    const repository = new InMemoryUnifiedBundleRepository();
    const original = await repository.saveBundle(singleBundle('model2d'), 0);
    expect((await savePromotedProject(repository, original.bundle, 'copia')).libraryState).toBe('draft');
    await expect(savePromotedProject(repository, original.bundle, 'copia', 'draft', original.id)).rejects.toThrow('distinto');
  });
});

describe('UnifiedProjectSession.promoteToProject', () => {
  const storage = { length: 0, key: () => null, getItem: () => null };

  it('abre → guarda → reabre la copia sin workScope y con los datos de Diseño y 3D', async () => {
    const repository = new InMemoryUnifiedBundleRepository();
    const source = singleBundle('column', 'Columna C-1');
    await repository.saveBundle(source, 0);
    const session = new UnifiedProjectSession(repository);
    const opened = await session.initialize(storage, source.model2d, source.model2d.id);
    const before = canonicalSerialize(await repository.openBundle(opened.id));

    const copy = await session.promoteToProject(opened.id, 'Columna C-1 · proyecto', opened);
    expect(canonicalSerialize(await repository.openBundle(opened.id))).toBe(before);

    const reopened = await session.open(copy.id);
    expect(reopened?.settings.workScope).toBeUndefined();
    expect(reopened?.name).toBe('Columna C-1 · proyecto');
    await session.save2D({ ...reopened!, nodes: createDefaultProject().nodes });
    const fresh = new UnifiedProjectSession(repository);
    const again = await fresh.open(copy.id);
    expect(again?.nodes).toHaveLength(createDefaultProject().nodes.length);
    expect(again?.settings.workScope).toBeUndefined();
    expect(fresh.currentBundle(copy.id)?.design).toEqual(design);
    expect((fresh.currentBundle(copy.id)?.space3d?.model as { id: string }).id).toBe(`space3d:${copy.id}`);
    // El original sigue siendo individual.
    expect((await fresh.open(opened.id))?.settings.workScope).toEqual({ kind: 'single', tool: 'column' });
  });

  it('usa el 2D vivo de la mesa y lo guarda antes en el original si el autoguardado no alcanzó', async () => {
    const repository = new InMemoryUnifiedBundleRepository();
    const source = singleBundle('model2d', 'Pórtico');
    await repository.saveBundle(source, 0);
    const session = new UnifiedProjectSession(repository);
    const opened = await session.initialize(storage, source.model2d, source.model2d.id);
    const live = { ...opened, nodes: createDefaultProject().nodes };
    const copy = await session.promoteToProject(opened.id, 'Pórtico · proyecto', live);
    expect(copy.bundle.model2d.nodes).toHaveLength(live.nodes.length);
    expect((await repository.openBundle(opened.id))?.bundle.model2d.nodes).toHaveLength(live.nodes.length);
  });

  it('rechaza un archivo inválido o inexistente sin crear nada', async () => {
    const repository = new InMemoryUnifiedBundleRepository();
    const session = new UnifiedProjectSession(repository);
    await expect(session.promoteToProject('no-existe', 'x')).rejects.toThrow('No existe');
    const broken = singleBundle('beam');
    broken.design = { kind: 'fstructure-design-workbench', schemaVersion: 8, entries: { beam: 42 } } as unknown as JsonValue;
    await expect(savePromotedProject(repository, broken, 'x')).rejects.toThrow();
    expect((await repository.snapshot()).bundles).toHaveLength(0);
  });
});
