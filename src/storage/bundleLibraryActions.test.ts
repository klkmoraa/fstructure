import { describe, expect, it } from 'vitest';
import { createDefaultProject, createSingleWork } from '../data/defaultProject';
import { normalizeProject } from '../data/migrate';
import { createSpace3DPortalExample } from '../modules/space3d/space3d/model/defaultProject';
import { createUnifiedProjectBundle, type JsonValue, type UnifiedProjectBundleV1 } from '../shared/project/unifiedProjectBundle';
import type { ProjectModel } from '../types';
import { renameBundleProject, restoreBundleRecovery, restoreModel2DIntoBundle } from './bundleLibraryActions';
import { saveDuplicatedProject } from './promoteProject';
import { BundleConflictError, InMemoryBundleDatabase, InMemoryUnifiedBundleRepository } from './unifiedBundleRepository';
import { UnifiedProjectSession } from './unifiedProjectSession';

const storage = { length: 0, key: () => null, getItem: () => null };
/** Una edición válida del 2D: el primer nodo se mueve `dx` metros. */
const shifted = <T extends ProjectModel>(project: T, dx: number): T => ({ ...project, nodes: project.nodes.map((node, index) => index === 0 ? { ...node, x: node.x + dx } : node) });
const firstX = (project: ProjectModel) => project.nodes[0]?.x;

const fullBundle = (project: ProjectModel): UnifiedProjectBundleV1 => {
  const bundle = createUnifiedProjectBundle(project, 'v1');
  bundle.space3d = {
    sourceProjectId: project.id, sourceVersion: 'v1',
    model: JSON.parse(JSON.stringify({ ...createSpace3DPortalExample(), id: `space3d:${project.id}` })) as JsonValue,
  };
  bundle.design = {
    kind: 'fstructure-design-workbench', schemaVersion: 8,
    entries: { element: 'beam', code: 'ntc-2023', beam: { b: '30', h: '60', fc: '25' } },
  };
  bundle.fem = [{ document: { id: 'estudio-1' }, nodes: 3 }];
  return bundle;
};

describe('duplicar', () => {
  it('copia 3D, Diseño y FEM con id nuevo y deja el original intacto', async () => {
    const repo = new InMemoryUnifiedBundleRepository();
    const project = { ...createDefaultProject(), name: 'Nave' };
    const original = await repo.saveBundle(fullBundle(project), 0);
    await repo.setLibraryState([project.id], 'saved');
    const session = new UnifiedProjectSession(repo);
    await session.initialize(storage, project);

    const copy = await session.duplicateProject(project.id, 'Nave (copia)');
    expect(copy.id).not.toBe(project.id);
    expect(copy.bundle.model2d.id).toBe(copy.id);
    expect(copy.bundle.model2d.name).toBe('Nave (copia)');
    expect(copy.bundle.design).toEqual(original.bundle.design);
    expect(copy.bundle.fem).toEqual(original.bundle.fem);
    expect(copy.bundle.space3d?.sourceProjectId).toBe(copy.id);
    expect((copy.bundle.space3d!.model as { id: string }).id).toBe(`space3d:${copy.id}`);
    expect(copy.libraryState).toBe('saved');
    expect((await repo.openBundle(project.id))?.checksum).toBe(original.checksum);
  });

  it('un archivo individual sigue siendo individual y toma el 2D de la mesa', async () => {
    const repo = new InMemoryUnifiedBundleRepository();
    const single = createSingleWork('beam', 'Viga V-1');
    await repo.saveBundle(fullBundle(single), 0);
    const live = { ...single, name: 'En la mesa' };
    const session = new UnifiedProjectSession(repo);
    const copy = await session.duplicateProject(single.id, 'Viga V-1 (copia)', live);
    expect(copy.bundle.model2d.settings.workScope).toEqual(single.settings.workScope);
    expect(copy.bundle.model2d.name).toBe('Viga V-1 (copia)');
    expect(copy.bundle.model2d.settings).toEqual(normalizeProject(live).settings);
    expect(copy.bundle.fem).toHaveLength(1);
    // Sin sesión (repositorio directo) el resultado es el mismo bundle completo.
    const direct = await saveDuplicatedProject(repo, (await repo.openBundle(single.id))!.bundle, 'Otra copia');
    expect(direct.bundle.space3d).not.toBeNull();
    expect(direct.bundle.model2d.settings.workScope).toEqual(single.settings.workScope);
  });
});

describe('renombrar', () => {
  it('cambia model2d.name con revisión y sobrevive al siguiente guardado 2D', async () => {
    const repo = new InMemoryUnifiedBundleRepository();
    const project = { ...createDefaultProject(), name: 'Viejo' };
    await repo.saveBundle(fullBundle(project), 0);
    const session = new UnifiedProjectSession(repo);
    await session.initialize(storage, project);

    const renamed = await session.renameProject(project.id, 'Nuevo');
    expect(renamed.revision).toBe(2);
    expect(renamed.bundle.manifest.sourceVersion).toBe('v1');
    expect(renamed.bundle.space3d).not.toBeNull();

    // La mesa abre lo guardado, edita y guarda: el nombre se queda y no hay conflicto.
    const opened = (await session.open(project.id))!;
    expect(opened.name).toBe('Nuevo');
    await session.save2D(shifted(opened, 1));
    const after = (await repo.openBundle(project.id))!;
    expect(after.bundle.model2d.name).toBe('Nuevo');
    expect(firstX(after.bundle.model2d)).toBe(firstX(project) + 1);
    expect(after.bundle.design).toEqual(fullBundle(project).design);
    expect(session.status.issue).toBeNull();
  });

  it('actualiza la revisión que la sesión conoce: su siguiente guardado no choca', async () => {
    const repo = new InMemoryUnifiedBundleRepository();
    const project = { ...createDefaultProject(), name: 'Viejo' };
    await repo.saveBundle(fullBundle(project), 0);
    const session = new UnifiedProjectSession(repo);
    await session.initialize(storage, project);
    await session.renameProject(project.id, 'Nuevo');
    await expect(session.save2D({ ...normalizeProject(project), name: 'Nuevo', nodes: shifted(project, 2).nodes })).resolves.toMatchObject({ revision: 3 });
    expect((await repo.snapshot()).recoveries).toHaveLength(0);
  });

  it('sin sesión renombra con el repositorio directo', async () => {
    const database = new InMemoryBundleDatabase();
    const repo = new InMemoryUnifiedBundleRepository(database);
    const project = createDefaultProject();
    await repo.saveBundle(fullBundle(project), 0);
    expect((await renameBundleProject(repo, project.id, 'Nuevo')).bundle.model2d.name).toBe('Nuevo');
  });
});

describe('restaurar', () => {
  /** Un conflicto real: otra pestaña guarda y la edición local queda en recuperación del bundle. */
  const conflicted = async () => {
    const database = new InMemoryBundleDatabase();
    const repo = new InMemoryUnifiedBundleRepository(database);
    const otherTab = new InMemoryUnifiedBundleRepository(database);
    const project = { ...createDefaultProject(), name: 'Pórtico' };
    await repo.saveBundle(fullBundle(project), 0);
    const session = new UnifiedProjectSession(repo);
    await session.initialize(storage, project);
    const remote = (await otherTab.openBundle(project.id))!;
    await otherTab.saveBundle({ ...remote.bundle, model2d: { ...remote.bundle.model2d, name: 'Remoto' } }, remote.revision);
    const local = shifted({ ...normalizeProject(project), name: 'Local' }, 2);
    await expect(session.save2D(local)).rejects.toBeInstanceOf(BundleConflictError);
    const [recovery] = (await repo.snapshot()).recoveries;
    return { repo, session, project, local, recovery };
  };

  it('la recuperación del bundle pasa a ser canónica y sobrevive al siguiente autoguardado', async () => {
    const { repo, session, project, local, recovery } = await conflicted();
    expect(recovery.bundle?.model2d.name).toBe('Local');

    const restored = await session.restoreRecovery(recovery.id, local);
    expect(restored.revision).toBe(3);
    expect(restored.bundle.model2d.name).toBe('Local');
    expect(restored.bundle.design).toEqual(fullBundle(project).design);
    const snapshot = await repo.snapshot();
    // La restaurada se consumió; la versión remota reemplazada quedó como respaldo.
    expect(snapshot.recoveries.map((item) => [item.reason, item.bundle?.model2d.name])).toEqual([['manual', 'Remoto']]);

    // Un autoguardado pendiente de la mesa vieja no pisa lo restaurado…
    await expect(session.save2D({ ...local, name: 'Rancio' })).rejects.toThrow();
    // …y tras reabrir (lo que hace «Restaurar» al abrir el proyecto) se guarda encima.
    const reopened = (await session.open(project.id))!;
    await session.save2D({ ...reopened, name: 'Local editado' });
    const after = (await repo.openBundle(project.id))!;
    expect(after.bundle.model2d.name).toBe('Local editado');
    expect(firstX(after.bundle.model2d)).toBe(firstX(project) + 2);
    expect(after.bundle.fem).toEqual(fullBundle(project).fem);
  });

  it('conserva como respaldo lo que la mesa tenía sin guardar', async () => {
    const { repo, session, local, recovery } = await conflicted();
    const later = { ...local, name: 'Local, más tarde' };
    await session.restoreRecovery(recovery.id, later);
    const names = (await repo.snapshot()).recoveries.map((item) => item.bundle?.model2d.name).sort();
    expect(names).toEqual(['Local, más tarde', 'Remoto']);
  });

  it('si el proyecto cambió antes de restaurar no escribe nada ni consume la recuperación', async () => {
    const { repo, recovery } = await conflicted();
    const current = (await repo.openBundle(recovery.projectId!))!;
    await expect(repo.restoreBundle(recovery.bundle!, current.revision - 1, { consumedRecoveryId: recovery.id })).rejects.toThrow(/changed/);
    expect((await repo.openBundle(recovery.projectId!))?.checksum).toBe(current.checksum);
    expect((await repo.snapshot()).recoveries.map((item) => item.id)).toEqual([recovery.id]);
  });

  it('un 2D del espejo se restaura dentro del bundle conservando 3D, Diseño y FEM', async () => {
    const repo = new InMemoryUnifiedBundleRepository();
    const project = { ...createDefaultProject(), name: 'Actual' };
    await repo.saveBundle(fullBundle(project), 0);
    const restored = await restoreModel2DIntoBundle(repo, shifted({ ...project, name: 'Recuperado' }, 1));
    expect(restored.bundle.model2d.name).toBe('Recuperado');
    expect(restored.bundle.space3d).not.toBeNull();
    expect(restored.bundle.fem).toHaveLength(1);
    expect((await repo.snapshot()).recoveries.map((item) => item.bundle?.model2d.name)).toEqual(['Actual']);
  });

  it('sin sesión también consume la recuperación sólo junto con la revisión restaurada', async () => {
    const { repo, recovery } = await conflicted();
    await restoreBundleRecovery(repo, recovery.id);
    expect((await repo.openBundle(recovery.projectId!))?.bundle.model2d.name).toBe('Local');
    expect((await repo.snapshot()).recoveries.some((item) => item.id === recovery.id)).toBe(false);
  });
});
