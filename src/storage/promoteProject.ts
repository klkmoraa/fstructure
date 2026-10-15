import type { JsonValue, UnifiedProjectBundleV1 } from '../shared/project/unifiedProjectBundle';
import type { StoredBundleRecord, UnifiedBundleRepository } from './unifiedBundleRepository';

/**
 * Promover un archivo individual a proyecto completo.
 *
 * El original no se toca: se arma una copia con identidad nueva (id del 2D, del
 * manifiesto y de la rama 3D) y sin `settings.workScope`, que es lo único que
 * distingue un archivo individual de un proyecto. Los datos —2D, 3D, Diseño y
 * los estudios FEM guardados— pasan tal cual. El formato del bundle no cambia
 * (`workScope` es opcional y su ausencia ya significa «proyecto completo»), así
 * que no hace falta versión ni migración nuevas.
 */
export function promoteBundleToProject(source: UnifiedProjectBundleV1, target: { projectId: string; name: string }): UnifiedProjectBundleV1 {
  const bundle = structuredClone(source);
  const { workScope: _single, ...settings } = bundle.model2d.settings;
  bundle.model2d = { ...bundle.model2d, id: target.projectId, name: target.name, settings };
  bundle.manifest = { ...bundle.manifest, projectId: target.projectId };
  if (bundle.space3d) {
    const { model } = bundle.space3d;
    // La rama 3D lleva el linaje del proyecto (`space3d:<id>`); el resto del modelo no cambia.
    const relinked: JsonValue = model && typeof model === 'object' && !Array.isArray(model)
      ? { ...model, id: `space3d:${target.projectId}` } : model;
    bundle.space3d = { ...bundle.space3d, sourceProjectId: target.projectId, model: relinked };
    if (bundle.space3d.sourceModel2D) bundle.space3d.sourceModel2D = { ...bundle.space3d.sourceModel2D, id: target.projectId };
  }
  return bundle;
}

/** Nombre de la copia: «<nombre> · proyecto». */
export const promotedProjectName = (name: string, language: 'es' | 'en') =>
  `${name} · ${language === 'en' ? 'project' : 'proyecto'}`;

/**
 * Guarda la copia como un proyecto nuevo (revisión 0 → 1). Conserva el apartado
 * del original: si estaba en Guardados, la copia también; un borrador queda en
 * Borradores. Nunca escribe sobre el registro del original.
 */
export async function savePromotedProject(
  repository: UnifiedBundleRepository,
  source: UnifiedProjectBundleV1,
  name: string,
  libraryState: StoredBundleRecord['libraryState'] = 'draft',
  projectId: string = crypto.randomUUID(),
): Promise<StoredBundleRecord> {
  if (source.manifest.projectId === projectId) throw new Error('La copia necesita un identificador distinto del original.');
  const promoted = promoteBundleToProject(source, { projectId, name });
  const record = await repository.saveBundle(promoted, 0);
  if (libraryState === 'saved' && record.libraryState !== 'saved') {
    await repository.setLibraryState([record.id], 'saved');
    return { ...record, libraryState: 'saved' };
  }
  return record;
}
