import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../../data/defaultProject';
import { withModelStart } from '../../data/modelStarts';
import { analyzeProject } from '../../engine/solver';
import type { ProjectModel } from '../../types';
import { createCalculationReport } from '../calculationPdf';

const SECTION = { E: 2e8, A: 0.02, I: 8e-5, type: 'frame' as const };

/** Pórtico sobre pasador y rodillo, con carga repartida en la viga y una lateral en el nudo. */
const pinRollerPortal = (): ProjectModel => ({
  ...createBlankProject(),
  name: 'Pórtico isostático',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 0, y: 4, support: { type: 'none' } },
    { id: 'C', x: 6, y: 4, support: { type: 'none' } },
    { id: 'D', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [
    { id: 'C1', i: 'A', j: 'B', ...SECTION },
    { id: 'V1', i: 'B', j: 'C', ...SECTION },
    { id: 'C2', i: 'D', j: 'C', ...SECTION },
  ],
  memberLoads: [{
    id: 'q', memberId: 'V1', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
    start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -10, qyEnd: -10,
  }],
  nodalLoads: [{ id: 'H', nodeId: 'B', caseId: 'LC1', fx: 20, fy: 0, mz: 0 }],
});

const report = async (project: ProjectModel) => {
  const analysis = analyzeProject(project);
  expect(analysis.success).toBe(true);
  return createCalculationReport(project, analysis, { solutionMethod: 'statics-sections', appVersion: 'test' });
};

describe('memoria PDF con el método de secciones', () => {
  it('desarrolla la viga simple del inicio de la app', async () => {
    const artifact = await report(withModelStart(createBlankProject(), 'beam-simple'));
    expect(artifact.methodAvailability['statics-sections']).toEqual({ available: true });
    expect(artifact.solutionMethod).toBe('statics-sections');
    expect(artifact.filename).toMatch(/-memoria-secciones\.pdf$/);
    expect(artifact.bytes.length).toBeGreaterThan(10_000);
    expect(new TextDecoder().decode(artifact.bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('desarrolla un pórtico sobre pasador y rodillo', async () => {
    const artifact = await report(pinRollerPortal());
    expect(artifact.methodAvailability['statics-sections']).toEqual({ available: true });
    expect(artifact.bytes.length).toBeGreaterThan(10_000);
  });

  it('no ofrece el método a un pórtico empotrado', async () => {
    const fixed = pinRollerPortal();
    fixed.nodes = fixed.nodes.map((node) => node.support.type === 'none' ? node : { ...node, support: { type: 'fixed' } });
    const analysis = analyzeProject(fixed);
    const artifact = await createCalculationReport(fixed, analysis, { appVersion: 'test' });
    expect(artifact.methodAvailability['statics-sections'].available).toBe(false);
    await expect(createCalculationReport(fixed, analysis, { solutionMethod: 'statics-sections' })).rejects.toThrow();
  });
});
