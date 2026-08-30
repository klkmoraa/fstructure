import { describe, expect, it } from 'vitest';
import { createBlankProject } from './defaultProject';
import { normalizeProject } from './migrate';
import {
  loadProjectFromStorage,
  PROJECT_BACKUP_KEY,
  PROJECT_STORAGE_KEY,
  saveProjectToStorage,
  type StorageLike,
} from './projectStorage';

/** `localStorage` en memoria: sin depender de un DOM para probar persistencia. */
const memoryStorage = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
  };
};

/**
 * Pruebas mínimas: esta es la única frontera entre el proyecto del usuario y
 * el disco. Un fallo aquí no lanza una excepción visible — pierde trabajo en
 * silencio, así que lo que importa comprobar es la degradación, no el camino
 * feliz solo.
 */
describe('loadProjectFromStorage / saveProjectToStorage', () => {
  it('guarda y recupera el mismo proyecto', () => {
    const storage = memoryStorage();
    const project = normalizeProject(createBlankProject());
    saveProjectToStorage(storage, project);
    const loaded = loadProjectFromStorage(storage);
    expect(loaded.project).toEqual(project);
    expect(loaded.recoveredFromBackup).toBe(false);
  });

  it('si el primario está dañado, recupera desde la copia de respaldo', () => {
    const storage = memoryStorage();
    const project = normalizeProject(createBlankProject());
    storage.setItem(PROJECT_BACKUP_KEY, JSON.stringify(project));
    storage.setItem(PROJECT_STORAGE_KEY, '{ esto no es JSON válido');

    const loaded = loadProjectFromStorage(storage);
    expect(loaded.recoveredFromBackup).toBe(true);
    expect(loaded.project).toEqual(project);
  });

  it('si primario y respaldo están dañados, entrega un proyecto en blanco en vez de fallar', () => {
    const storage = memoryStorage();
    storage.setItem(PROJECT_STORAGE_KEY, '{ dañado');
    storage.setItem(PROJECT_BACKUP_KEY, '{ también dañado');

    const loaded = loadProjectFromStorage(storage);
    expect(loaded.project.nodes).toEqual([]);
    expect(loaded.recoveryMessage).toBeTruthy();
  });

  it('al guardar, la copia primaria previa pasa a ser el respaldo', () => {
    const storage = memoryStorage();
    const first = normalizeProject({ ...createBlankProject(), name: 'Primero' });
    const second = normalizeProject({ ...createBlankProject(), name: 'Segundo' });
    saveProjectToStorage(storage, first);
    saveProjectToStorage(storage, second);

    expect(JSON.parse(storage.data.get(PROJECT_BACKUP_KEY)!).name).toBe('Primero');
    expect(JSON.parse(storage.data.get(PROJECT_STORAGE_KEY)!).name).toBe('Segundo');
  });
});
