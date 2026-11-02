import { IDBFactory } from 'fake-indexeddb';
import { expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { createUnifiedProjectBundle } from '../shared/project/unifiedProjectBundle';
import { IndexedDbProjectRepository } from './projectRepository';
import { IndexedDbUnifiedBundleRepository } from './unifiedBundleRepository';

const openRaw = (factory: IDBFactory, name: string, version: number) => new Promise<IDBDatabase>((resolve, reject) => {
  const request = factory.open(name, version);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
/** `deleteDatabase` es lo que hace otra pestaña al borrar o actualizar la base: dispara `versionchange`. */
const deleteDatabase = (factory: IDBFactory, name: string) => new Promise<'deleted' | 'blocked'>((resolve, reject) => {
  const request = factory.deleteDatabase(name);
  request.onsuccess = () => resolve('deleted');
  request.onblocked = () => resolve('blocked');
  request.onerror = () => reject(request.error);
});

it('una apertura bloqueada por otra pestaña no deja la biblioteca rechazada: al liberarse, la siguiente llamada abre', async () => {
  const factory = new IDBFactory();
  // Una pestaña con la versión anterior de la base (1) que no cierra al pedírselo.
  const older = await openRaw(factory, 'structureCo.projects', 1);
  const repository = new IndexedDbProjectRepository(factory);
  await expect(repository.listProjects()).rejects.toThrow(/bloqueado por otra pestaña/);
  older.close();
  const project = createDefaultProject();
  await repository.saveProject(project);
  expect((await repository.listProjects()).map((record) => record.id)).toEqual([project.id]);
});

it('la biblioteca cierra su conexión ante `versionchange` y vuelve a abrir en la siguiente llamada', async () => {
  const factory = new IDBFactory();
  const repository = new IndexedDbProjectRepository(factory);
  await repository.saveProject(createDefaultProject());
  expect(await deleteDatabase(factory, 'structureCo.projects')).toBe('deleted');
  expect(await repository.listProjects()).toEqual([]);
  const project = createDefaultProject();
  await repository.saveProject(project);
  expect((await repository.openProject(project.id))?.revision).toBe(1);
});

it('el bundle unificado tampoco bloquea a otra pestaña ni se queda con la conexión cerrada', async () => {
  const factory = new IDBFactory();
  const repository = new IndexedDbUnifiedBundleRepository(factory);
  const project = createDefaultProject();
  await repository.saveBundle(createUnifiedProjectBundle(project, 'v1'), 0);
  expect(await deleteDatabase(factory, 'structureCo.unified-bundles')).toBe('deleted');
  expect(await repository.openBundle(project.id)).toBeNull();
  expect((await repository.saveBundle(createUnifiedProjectBundle(project, 'v2'), 0)).revision).toBe(1);
});
