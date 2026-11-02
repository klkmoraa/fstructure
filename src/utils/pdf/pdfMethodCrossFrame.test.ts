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

  it('narra un marco con articulación interna en la viga y una base liberada', async () => {
    const frame = (id: string, i: string, j: string) => ({ id, i, j, type: 'frame' as const, E: 2e8, A: 0.01, I: 1e-4 });
    const project: ProjectModel = {
      ...createBlankProject(),
      nodes: [
        { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
        { id: 'B', x: 0, y: 4, support: { type: 'none' } },
        { id: 'H', x: 3, y: 4, support: { type: 'none' }, internalHinge: true },
        { id: 'C', x: 6, y: 4, support: { type: 'none' } },
        { id: 'D', x: 6, y: 0, support: { type: 'fixed' } },
      ],
      members: [{ ...frame('AB', 'A', 'B'), releases: { iMoment: true } }, frame('BH', 'B', 'H'), frame('HC', 'H', 'C'), frame('DC', 'D', 'C')],
      memberLoads: [
        { id: 'w1', memberId: 'BH', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -10, qyEnd: -10 },
        { id: 'P', memberId: 'HC', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0.5, end: 0.5, position: 0.5, px: 0, py: -20 },
      ],
      nodalLoads: [{ id: 'H1', nodeId: 'B', caseId: 'LC1', fx: 12, fy: 0, mz: 0 }],
    };
    const artifact = await report(project, { LC1: 1 }, 'Caso 1');
    expect(artifact.methodAvailability['moment-distribution-frame']).toEqual({ available: true });
    expect(artifact.solutionMethod).toBe('moment-distribution-frame');
    expect(isPdf(artifact.bytes)).toBe(true);
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const document = await pdfjs.getDocument({ data: artifact.bytes.slice(), useWorkerFetch: false }).promise;
    const pages: string[] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const content = await (await document.getPage(number)).getTextContent();
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
    }
    const text = pages.join(' ').replace(/\s+/g, ' ');
    expect(text).toContain('Procedimiento: Cross');
    expect(text).toContain('Extremos liberados');
    expect(text).toContain('H (articulación)');
    expect(text).toContain('3EI/L');
  }, 30_000);

  it('narra un pórtico con bases articuladas sobre resortes rotacionales', async () => {
    const frame = (id: string, i: string, j: string) => ({ id, i, j, type: 'frame' as const, E: 2e8, A: 0.01, I: 1e-4 });
    const project: ProjectModel = {
      ...createBlankProject(),
      nodes: [
        { id: 'A', x: 0, y: 0, support: { type: 'pin', spring: { kr: 8000 } } },
        { id: 'B', x: 0, y: 4, support: { type: 'none' } },
        { id: 'C', x: 6, y: 4, support: { type: 'none' } },
        { id: 'D', x: 6, y: 0, support: { type: 'pin', spring: { kr: 8000 } } },
      ],
      members: [frame('AB', 'A', 'B'), frame('BC', 'B', 'C'), frame('DC', 'D', 'C')],
      memberLoads: [
        { id: 'w', memberId: 'BC', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -10, qyEnd: -10 },
      ],
      nodalLoads: [{ id: 'H1', nodeId: 'B', caseId: 'LC1', fx: 20, fy: 0, mz: 0 }],
    };
    const artifact = await report(project, { LC1: 1 }, 'Caso 1');
    expect(artifact.methodAvailability['moment-distribution-frame']).toEqual({ available: true });
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const document = await pdfjs.getDocument({ data: artifact.bytes.slice(), useWorkerFetch: false }).promise;
    const pages: string[] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const content = await (await document.getPage(number)).getTextContent();
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
    }
    const text = pages.join(' ').replace(/\s+/g, ' ');
    expect(text).toContain('Resortes rotacionales de apoyo');
    expect(text).toMatch(/resorte k_?\s?r/);
    expect(text).toMatch(/M_?\s?r Cross/);
  }, 30_000);
});
