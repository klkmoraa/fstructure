import { describe, expect, it } from 'vitest';
import { analyzeProject } from '../../engine/solver';
import { createBlankProject } from '../../data/defaultProject';
import { MODEL_START_DEFAULTS, withModelStart } from '../../data/modelStarts';
import type { ProjectModel } from '../../types';
import { createCalculationReport } from '../calculationPdf';
import { CALCULATION_PDF_EXPORT_DEFAULTS } from './reportContext';

const report = async (project: ProjectModel, factors: Record<string, number>, name: string) => {
  const combination = { id: 'pdf', name, factors };
  const analysis = analyzeProject(project, combination);
  expect(analysis.success).toBe(true);
  return createCalculationReport(project, analysis, {
    ...CALCULATION_PDF_EXPORT_DEFAULTS,
    solutionMethod: 'moment-distribution-frame',
    scenarioFactors: factors,
    scenarioName: name,
  });
};

const isPdf = (bytes: Uint8Array) => new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';

describe('memoria con Cross en marcos', () => {
  it('narra el pórtico de inicio con carga lateral', async () => {
    const project = withModelStart(createBlankProject(), 'frame-portal', { ...MODEL_START_DEFAULTS['frame-portal'], count: 2, levels: 2 });
    const u2 = project.combinations.find((entry) => entry.id === 'U2')!;
    const artifact = await report(project, u2.factors, u2.name);
    expect(artifact.methodAvailability['moment-distribution-frame']).toEqual({ available: true });
    expect(artifact.solutionMethod).toBe('moment-distribution-frame');
    expect(artifact.filename).toMatch(/-memoria-cross-marcos\.pdf$/);
    expect(isPdf(artifact.bytes)).toBe(true);
    expect(artifact.bytes.length).toBeGreaterThan(10_000);
  }, 30_000);

  it('narra una viga empotrada en sus extremos con un apoyo interior', async () => {
    const project: ProjectModel = {
      ...createBlankProject(),
      nodes: [
        { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
        { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
        { id: 'C', x: 10, y: 0, support: { type: 'fixed' } },
      ],
      members: [
        { id: 'AB', i: 'A', j: 'B', type: 'frame', E: 2e8, A: 0.01, I: 1e-4 },
        { id: 'BC', i: 'B', j: 'C', type: 'frame', E: 2e8, A: 0.01, I: 1e-4 },
      ],
      memberLoads: [
        { id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -20, qyEnd: -20 },
        { id: 'P', memberId: 'BC', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0.5, end: 0.5, position: 0.5, px: 0, py: -30 },
      ],
    };
    const artifact = await report(project, { LC1: 1 }, 'Caso 1');
    expect(artifact.methodAvailability['moment-distribution-frame']).toEqual({ available: true });
    // Hardy Cross refuses the fixed ends; this is the method that narrates them.
    expect(artifact.methodAvailability['hardy-cross'].available).toBe(false);
    expect(isPdf(artifact.bytes)).toBe(true);
  }, 30_000);
});
