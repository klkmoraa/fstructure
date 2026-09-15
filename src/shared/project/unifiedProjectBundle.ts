import type { ProjectModel } from '../../types';

/** Tool branches contain public JSON data only, never runtime/worker objects. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface UnifiedProjectManifestV1 {
  schemaVersion: 1;
  projectId: string;
  sourceVersion: string;
  authoritativeModel: 'model2d';
}

export interface LinkedSpace3DBranchV1<T extends JsonValue = JsonValue> {
  sourceProjectId: string;
  sourceVersion: string;
  model: T;
}

/** 2D remains authoritative. Each domain supplies its stable serializable DTO. */
export interface UnifiedProjectBundleV1<
  TSpace3D extends JsonValue = JsonValue,
  TDesign extends JsonValue = JsonValue,
  TFemStudy extends JsonValue = JsonValue,
> {
  manifest: UnifiedProjectManifestV1;
  model2d: ProjectModel;
  space3d: LinkedSpace3DBranchV1<TSpace3D> | null;
  design: TDesign;
  fem: TFemStudy[];
}

/** Snapshot for persistence/export; creating the envelope never mutates inputs. */
export function createUnifiedProjectBundle(project: ProjectModel, sourceVersion: string): UnifiedProjectBundleV1 {
  return {
    manifest: { schemaVersion: 1, projectId: project.id, sourceVersion, authoritativeModel: 'model2d' },
    model2d: structuredClone(project),
    space3d: null,
    design: {},
    fem: [],
  };
}
