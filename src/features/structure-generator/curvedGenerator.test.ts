import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../../data/defaultProject';
import { circularArch } from '../../data/generators/curvedGeometry';
import { generateStructure } from '../../data/generators/structureGenerators';
import { prepareStructureGeneration, applyPreparedStructureGeneration } from '../../commands/structureGeneration';
import { applyProjectPatch, projectCommandSnapshot } from '../../commands/projectCommand';
import { buildGeneratorParams, DEFAULT_GENERATOR_FORM, GENERATOR_FAMILIES } from './structureGeneratorForm';

const archForm = {
  ...DEFAULT_GENERATOR_FORM,
  family: 'circular-arch' as const,
  curveSpan: '10', curveRise: '5', curveRadius: '5', curveSegments: '24',
};
const ringForm = { ...archForm, family: 'circular-ring' as const };
const portalForm = {
  ...archForm, family: 'pitched-portal' as const,
  portalSpan: '8', leftHeight: '3', rightHeight: '4',
  roofKind: 'gable' as const, ridgeX: '3', ridgeY: '6',
};

describe('curved generator integration', () => {
  it('offers each new family in the existing generator', () => {
    expect(GENERATOR_FAMILIES).toEqual(expect.arrayContaining(['circular-arch', 'circular-ring', 'pitched-portal']));
  });

  it('puts a semicircle above the support chord', () => {
    const result = circularArch(10, 5, 24);
    expect(result.points[0]).toEqual({ x: 0, y: 0 });
    expect(result.points[12]).toEqual({ x: 5, y: 5 });
    expect(result.points[24]).toEqual({ x: 10, y: 0 });
    expect(result.points.every((point) => point.y >= 0)).toBe(true);
  });

  it('converts curved geometry from feet to internal metres once', () => {
    const result = buildGeneratorParams(archForm, 'kip-ft');
    expect(result.ok).toBe(true);
    if (!result.ok || result.params.kind !== 'circular-arch') throw new Error('Missing arc parameters');
    expect(result.params.span).toBeCloseTo(3.048, 10);
    expect(result.params.rise).toBeCloseTo(1.524, 10);
    expect(result.params.segments).toBe(24);
  });

  it('does not inherit portal supports for a ring', () => {
    const result = buildGeneratorParams({ ...ringForm, support: 'fixed' }, 'kN-m');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Missing ring parameters');
    expect(result.params.baseSupport).toBeUndefined();
    expect(generateStructure(result.params).supportedNodeIds).toEqual([]);
  });

  it('builds a pitched portal with column and roof roles', () => {
    const result = buildGeneratorParams(portalForm, 'kN-m');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Missing portal parameters');
    const geometry = generateStructure(result.params);
    expect(geometry.nodes).toHaveLength(5);
    expect(geometry.summary.memberCountsByRole.column).toBe(2);
    expect(geometry.summary.memberCountsByRole.roof).toBe(2);
  });

  it('rejects blank or fractional segment counts and ignores hidden ridge fields', () => {
    for (const curveSegments of ['', '2.5', '201', 'NaN']) {
      expect(buildGeneratorParams({ ...archForm, curveSegments }, 'kN-m').ok).toBe(false);
    }
    expect(buildGeneratorParams({ ...portalForm, roofKind: 'mono', ridgeX: '', ridgeY: '' }, 'kN-m').ok).toBe(true);
  });

  it('accepts decimal comma and leaves inactive fields alone', () => {
    const result = buildGeneratorParams({ ...ringForm, curveRadius: '2,5', curveRise: '', portalSpan: '' }, 'kN-m');
    expect(result.ok).toBe(true);
    if (!result.ok || result.params.kind !== 'circular-ring') throw new Error('Missing ring parameters');
    expect(result.params.radius).toBe(2.5);
  });

  it.each([archForm, ringForm, portalForm])('previews without mutation and supports undo, redo and serialization ($family)', (form) => {
    const project = createBlankProject();
    const before = projectCommandSnapshot(project);
    const built = buildGeneratorParams(form, 'kN-m');
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Missing generator parameters');
    const prepared = prepareStructureGeneration(project, built.params);
    expect(projectCommandSnapshot(project)).toBe(before);
    const applied = applyPreparedStructureGeneration(project, prepared);
    expect(projectCommandSnapshot(applied)).toBe(prepared.previewSnapshot);
    const undone = applyProjectPatch(applied, prepared.inverse);
    expect(projectCommandSnapshot(undone)).toBe(before);
    expect(projectCommandSnapshot(applyProjectPatch(undone, prepared.forward))).toBe(prepared.previewSnapshot);
    expect(projectCommandSnapshot(JSON.parse(JSON.stringify(applied)))).toBe(prepared.previewSnapshot);
  });
});
