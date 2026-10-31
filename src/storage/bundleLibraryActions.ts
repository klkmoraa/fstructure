import { normalizeProject } from '../data/migrate';
import type { ProjectModel } from '../types';
import { createUnifiedProjectBundle, type UnifiedProjectBundleV1 } from '../shared/project/unifiedProjectBundle';
import { canonicalJsonKey } from './bundleValidation';
import type { StoredBundleRecord, UnifiedBundleRepository } from './unifiedBundleRepository';

/**
 * Acciones de la biblioteca (Proyectos) sobre el bundle canónico. El espejo
 * `projectRepository` se reescribe desde el bundle en cada autoguardado, así
 * que renombrar, restaurar o duplicar sólo en el espejo se perdía: aquí todo
 * pasa por guardados con revisión del bundle.
 */

/** Cambia `model2d.name` con un guardado revisado; el resto del bundle no cambia. */
export async function renameBundleProject(repository: UnifiedBundleRepository, id: string, name: string): Promise<StoredBundleRecord> {
  const record = await repository.openBundle(id);
  if (!record) throw new Error(`No existe el proyecto ${id}.`);
  if (record.bundle.model2d.name === name) return record;
  const bundle = structuredClone(record.bundle);
  // El nombre no cambia la estructura: `sourceVersion` se conserva y el 3D no queda desactualizado.
  bundle.model2d = { ...bundle.model2d, name };
  return repository.saveBundle(bundle, record.revision);
}

/**
 * Lo que la mesa tiene abierto y aún no coincide con lo guardado (el
 * autoguardado no corrió, o el proyecto está bloqueado por un conflicto) se
 * conserva como respaldo antes de reemplazar la versión canónica.
 */
const liveBackups = (current: StoredBundleRecord | null, target: UnifiedProjectBundleV1, live?: ProjectModel): UnifiedProjectBundleV1[] => {
  if (!live || live.id !== target.manifest.projectId) return [];
  const model = normalizeProject(structuredClone(live));
  const key = canonicalJsonKey(model);
  if (key === canonicalJsonKey(normalizeProject(target.model2d))) return [];
  if (current && key === canonicalJsonKey(normalizeProject(current.bundle.model2d))) return [];
  const base = current ? structuredClone(current.bundle) : createUnifiedProjectBundle(model, crypto.randomUUID());
  return [{ ...base, model2d: model }];
};

/**
 * Restaura una recuperación del bundle como versión canónica con revisión
 * nueva. La versión reemplazada queda como recuperación `manual` y la
 * restaurada se consume en la misma transacción que la escribe.
 */
export async function restoreBundleRecovery(repository: UnifiedBundleRepository, recoveryId: string, live?: ProjectModel): Promise<StoredBundleRecord> {
  const recovery = (await repository.snapshot()).recoveries.find((item) => item.id === recoveryId);
  if (!recovery?.bundle) throw new Error(`La recuperación ${recoveryId} no tiene un proyecto restaurable.`);
  const target = structuredClone(recovery.bundle);
  const current = await repository.openBundle(target.manifest.projectId);
  return repository.restoreBundle(target, current?.revision ?? 0, { consumedRecoveryId: recoveryId, backups: liveBackups(current, target, live) });
}

/**
 * Restaura un Modelo 2D (recuperación o versión del espejo, que sólo guardan
 * el 2D) dentro del bundle canónico: 3D, Diseño y FEM se conservan.
 */
export async function restoreModel2DIntoBundle(repository: UnifiedBundleRepository, model: ProjectModel, live?: ProjectModel): Promise<StoredBundleRecord> {
  const restored = normalizeProject(structuredClone(model));
  const current = await repository.openBundle(restored.id);
  const target = current
    ? { ...structuredClone(current.bundle), model2d: restored, manifest: { ...current.bundle.manifest, sourceVersion: crypto.randomUUID() } }
    : createUnifiedProjectBundle(restored, crypto.randomUUID());
  if (current && canonicalJsonKey(normalizeProject(current.bundle.model2d)) === canonicalJsonKey(restored)) target.manifest = current.bundle.manifest;
  return repository.restoreBundle(target, current?.revision ?? 0, { backups: liveBackups(current, target, live) });
}
