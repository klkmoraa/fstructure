import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../../data/defaultProject';
import { withModelStart } from '../../data/modelStarts';
import { analyzeProject } from '../../engine/solver';
import type { LoadCombination, ProjectModel, SupportDefinition } from '../../types';
import { createCalculationReport } from '../calculationPdf';

const textOf = async (bytes: Uint8Array): Promise<string> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: bytes.slice(), useWorkerFetch: false }).promise;
  const pages: string[] = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const content = await (await document.getPage(number)).getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return pages.join(' ').replace(/\s+/g, ' ');
};

const report = async (project: ProjectModel, combination: LoadCombination | null) => {
  const analysis = analyzeProject(project, combination);
  expect(analysis.success).toBe(true);
  return createCalculationReport(project, analysis, {
    solutionMethod: 'arch-least-work', appVersion: 'test',
    ...(combination ? { scenarioName: combination.name, scenarioFactors: combination.factors } : {}),
  });
};

const semicircle = (supports: [SupportDefinition, SupportDefinition]): ProjectModel => ({
  ...createBlankProject(),
  name: 'Arco semicircular',
  nodes: [{ id: 'A', x: 0, y: 0, support: supports[0] }, { id: 'B', x: 10, y: 0, support: supports[1] }],
  members: [{ id: 'A1', i: 'A', j: 'B', type: 'frame', E: 25e6, A: 0.15, I: 0.003125, curve: { kind: 'circular-arc', bulge: 1 } }],
  memberLoads: [{
    id: 'w', memberId: 'A1', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'horizontal',
    start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -20, qyEnd: -20,
  }],
  nodalLoads: [],
});

describe('memoria PDF con trabajo mínimo en arcos', () => {
  it('desarrolla el arco biarticulado del inicio de la app', async () => {
    const project = withModelStart(createBlankProject(), 'arch');
    const serv = project.combinations.find((entry) => entry.id === 'SERV')!;
    const artifact = await report(project, serv);
    expect(artifact.methodAvailability['arch-least-work']).toEqual({ available: true });
    expect(artifact.solutionMethod).toBe('arch-least-work');
    expect(artifact.filename).toMatch(/-memoria-trabajo-minimo-arco\.pdf$/);
    const text = await textOf(artifact.bytes);
    expect(text).toContain('Trabajo mínimo (Castigliano) en el arco');
    expect(text).toContain('Estructura liberada y redundantes');
    expect(text).toContain('Simpson');
    expect(text).toContain('Verificación contra el análisis matricial');
    // Carga por metro de arco: la fórmula cerrada de proyección horizontal no se imprime.
    expect(text).not.toContain('Referencia clásica');
  }, 60_000);

  it('imprime la fórmula clásica sólo donde aplica, y el arco empotrado con tres redundantes', async () => {
    const twoHinged = await textOf((await report(semicircle([{ type: 'pin' }, { type: 'pin' }]), null)).bytes);
    expect(twoHinged).toContain('Referencia clásica');
    const fixed = await report(semicircle([{ type: 'fixed' }, { type: 'fixed' }]), null);
    expect(fixed.methodAvailability['arch-least-work']).toEqual({ available: true });
    const text = await textOf(fixed.bytes);
    expect(text).toContain('voladizo curvo');
    expect(text).toMatch(/X_?3/);
  }, 60_000);
});
