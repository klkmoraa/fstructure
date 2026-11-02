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

  it('desarrolla un arco sobre pasador y rodillo, y uno triarticulado, corte por corte', async () => {
    const pinRoller: ProjectModel = {
      ...createBlankProject(),
      name: 'Arco isostático',
      nodes: [{ id: 'A', x: 0, y: 0, support: { type: 'pin' } }, { id: 'B', x: 10, y: 0, support: { type: 'roller', angleDeg: 90 } }],
      members: [{ id: 'A1', i: 'A', j: 'B', ...SECTION, curve: { kind: 'circular-arc', bulge: 0.6 } }],
      memberLoads: [{
        id: 'w', memberId: 'A1', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
        start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -15, qyEnd: -15,
      }],
      nodalLoads: [],
    };
    const artifact = await report(pinRoller);
    expect(artifact.methodAvailability['statics-sections']).toEqual({ available: true });
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const document = await pdfjs.getDocument({ data: artifact.bytes.slice(), useWorkerFetch: false }).promise;
    const pages: string[] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const content = await (await document.getPage(number)).getTextContent();
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
    }
    const text = pages.join(' ').replace(/\s+/g, ' ');
    expect(text).toContain('(arco circular)');
    expect(text).toContain('Corte de |M| máximo');
    expect(text).toContain('M mat.');

    const bulge = Math.tan(Math.asin(5 / (34 / 6)) / 4);
    const threeHinged = await report({
      ...pinRoller,
      nodes: [
        { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
        { id: 'C', x: 5, y: 3, support: { type: 'none' }, internalHinge: true },
        { id: 'B', x: 10, y: 0, support: { type: 'pin' } },
      ],
      members: [
        { id: 'A1', i: 'A', j: 'C', ...SECTION, curve: { kind: 'circular-arc', bulge } },
        { id: 'A2', i: 'C', j: 'B', ...SECTION, curve: { kind: 'circular-arc', bulge } },
      ],
      memberLoads: ['A1', 'A2'].map((memberId) => ({
        id: `w-${memberId}`, memberId, caseId: 'LC1', type: 'distributed' as const, coordinateSystem: 'global' as const, lengthBasis: 'horizontal' as const,
        start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -20, qyEnd: -20,
      })),
    });
    expect(threeHinged.methodAvailability['statics-sections']).toEqual({ available: true });
    expect(threeHinged.bytes.length).toBeGreaterThan(10_000);
  }, 60_000);

  it('no ofrece el método a un pórtico empotrado', async () => {
    const fixed = pinRollerPortal();
    fixed.nodes = fixed.nodes.map((node) => node.support.type === 'none' ? node : { ...node, support: { type: 'fixed' } });
    const analysis = analyzeProject(fixed);
    const artifact = await createCalculationReport(fixed, analysis, { appVersion: 'test' });
    expect(artifact.methodAvailability['statics-sections'].available).toBe(false);
    await expect(createCalculationReport(fixed, analysis, { solutionMethod: 'statics-sections' })).rejects.toThrow();
  });
});
