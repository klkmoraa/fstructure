import { describe, expect, expectTypeOf, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import type { AnalysisBudget, AnalysisJobRequest, AnalysisQuality, SyncPatchV1, ToolId } from '../contracts';
import { createUnifiedProjectBundle, type UnifiedProjectBundleV1 } from './unifiedProjectBundle';

describe('shared contracts and unified bundle', () => {
  it('retains the authoritative 2D project losslessly in a serializable versioned envelope', () => {
    const project = createDefaultProject();
    const bundle = createUnifiedProjectBundle(project, 'v1');
    expect(bundle.manifest).toEqual({ schemaVersion: 1, projectId: project.id, sourceVersion: 'v1', authoritativeModel: 'model2d' });
    expect(JSON.parse(JSON.stringify(bundle)).model2d).toEqual(JSON.parse(JSON.stringify(project)));
    expect(bundle.space3d).toBeNull();
    expect(bundle.design).toEqual({});
    expect(bundle.fem).toEqual([]);
    bundle.model2d.name = 'changed copy';
    expect(project.name).not.toBe('changed copy');
    expectTypeOf(bundle).toExtend<UnifiedProjectBundleV1>();
    expectTypeOf<AnalysisJobRequest<{ count: number }>['tool']>().toEqualTypeOf<ToolId>();
    expectTypeOf<AnalysisJobRequest<unknown>['budget']>().toEqualTypeOf<AnalysisBudget>();
    expectTypeOf<AnalysisQuality['level']>().toEqualTypeOf<'stable' | 'limited' | 'unreliable' | 'failed'>();
    expectTypeOf<SyncPatchV1['compatibility']>().toEqualTypeOf<'exact' | 'requires-review' | 'unsupported'>();
  });
});
