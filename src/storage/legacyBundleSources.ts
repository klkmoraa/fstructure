import { normalizeProject } from '../data/migrate';
import { PROJECT_BACKUP_KEY, PROJECT_RECOVERY_KEY, PROJECT_STORAGE_KEY } from '../data/projectStorage';
import { parseSpace3DDraft } from '../modules/space3d/space3d/data/codec';
import { SPACE3D_STORAGE_KEY, SPACE3D_BACKUP_STORAGE_KEY } from '../modules/space3d/space3d/data/storage';
import type { Space3DProjectV1 } from '../modules/space3d/space3d/model/types';
import { createUnifiedProjectBundle, type JsonValue, type UnifiedProjectBundleV1 } from '../shared/project/unifiedProjectBundle';
import { canonicalSerialize, sha256, validateBundle } from './bundleValidation';
import type { StoredBundleRecord, MigrationRecord } from './unifiedBundleRepository';

/** Read-only by construction: migration never rotates or rewrites legacy bytes. */
export type LegacyBundleStorage = Pick<Storage, 'getItem' | 'key' | 'length'>;
export interface LegacyImportPlan {
  sources: MigrationRecord[];
  bundle?: UnifiedProjectBundleV1;
  space3d?: Space3DProjectV1;
  checksum: string;
  baseChecksum?: string;
}

export async function prepareLegacyImports(storage: LegacyBundleStorage, existing: StoredBundleRecord[]): Promise<LegacyImportPlan[]> {
  const keys2d = [PROJECT_STORAGE_KEY, PROJECT_BACKUP_KEY, PROJECT_RECOVERY_KEY];
  const keys3d = new Set([SPACE3D_STORAGE_KEY, SPACE3D_BACKUP_STORAGE_KEY]);
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(`${SPACE3D_STORAGE_KEY}:`)) keys3d.add(key);
  }
  const plans: LegacyImportPlan[] = [];
  const groups = new Map<string, LegacyImportPlan>();
  const candidates3d: { source: MigrationRecord; model: Space3DProjectV1; namespace?: string }[] = [];
  for (const key of [...keys2d, ...[...keys3d].sort((a, b) => Number(a.endsWith(':backup')) - Number(b.endsWith(':backup')) || a.localeCompare(b))]) {
    const raw = storage.getItem(key);
    if (raw === null) continue;
    const checksum = await sha256(raw);
    const source: MigrationRecord = { id: `${key}:${checksum}`, sourceKey: key, sourceChecksum: checksum, status: 'invalid', complete: false };
    try {
      if (keys2d.includes(key)) {
        const parsed = JSON.parse(raw) as unknown;
        // Older valid projects without ids need stable identity on every retry.
        const input = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? { ...parsed, id: (parsed as { id?: unknown }).id ?? `legacy-${checksum}` } : parsed;
        const project = JSON.parse(JSON.stringify(normalizeProject(input)));
        const modelChecksum = await sha256(canonicalSerialize(project));
        const groupKey = `${project.id}:${modelChecksum}`;
        const group = groups.get(groupKey);
        if (group) group.sources.push(source);
        else {
          const plan: LegacyImportPlan = { sources: [source], checksum: '', bundle: createUnifiedProjectBundle(project, `legacy:${modelChecksum}`) };
          groups.set(groupKey, plan);
          plans.push(plan);
        }
      } else {
        const model = parseSpace3DDraft(raw);
        const suffix = key.slice(SPACE3D_STORAGE_KEY.length + 1);
        const namespace = key === SPACE3D_STORAGE_KEY || key === SPACE3D_BACKUP_STORAGE_KEY ? undefined : suffix.replace(/:backup$/, '');
        candidates3d.push({ source, model, namespace });
      }
    } catch (error) {
      source.diagnostic = error instanceof Error ? error.message : String(error);
      plans.push({ sources: [source], checksum });
    }
  }

  for (const { source, model, namespace } of candidates3d) {
    let target = namespace && model.id === `space3d:${namespace}`
      ? plans.find((plan) => plan.bundle?.manifest.projectId === namespace) : undefined;
    if (!target && namespace && model.id === `space3d:${namespace}`) {
      const current = existing.find((record) => record.id === namespace);
      if (current) {
        target = { sources: [], bundle: structuredClone(current.bundle), checksum: '', baseChecksum: current.checksum };
        plans.push(target);
      }
    }
    if (target?.bundle && !target.baseChecksum) {
      const current = existing.find((record) => record.id === namespace && record.bundle.space3d === null);
      if (current && canonicalSerialize(JSON.parse(JSON.stringify(normalizeProject(current.bundle.model2d)))) === canonicalSerialize(target.bundle.model2d)) {
        // A later 3D source can join an unchanged 2D model without losing tools edited since migration.
        target.bundle = structuredClone(current.bundle);
        target.baseChecksum = current.checksum;
      }
    }
    const candidate = target?.bundle;
    if (candidate && (!candidate.space3d || canonicalSerialize(candidate.space3d.model) === canonicalSerialize(model))) {
      candidate.space3d = { sourceProjectId: candidate.manifest.projectId, sourceVersion: candidate.manifest.sourceVersion, model: JSON.parse(JSON.stringify(model)) as JsonValue };
      target!.sources.push(source);
    } else {
      plans.push({ sources: [source], space3d: model, checksum: await sha256(canonicalSerialize(model)) });
    }
  }
  // Await crypto before opening IDB transactions, which otherwise can auto-commit.
  for (const plan of plans) {
    if (plan.bundle) {
      plan.bundle = validateBundle(plan.bundle);
      plan.checksum = await sha256(canonicalSerialize(plan.bundle));
    }
  }
  return plans.filter((plan) => plan.sources.length > 0);
}
