import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../data/defaultProject';
import { withModelStart, MODEL_START_DEFAULTS, type ModelStartId } from '../data/modelStarts';
import { analyzeProject } from '../engine/solver';
import { SOLUTION_METHODS } from '../analysis-methods/methodRegistry';
import { createCalculationReport } from './calculationPdf';
import { inspectPdfMethodAvailability } from './pdf/pdfMethodSection';

const solved = (id: ModelStartId) => {
  const project = withModelStart(createBlankProject(), id, MODEL_START_DEFAULTS[id]);
  const combination = project.combinations.find((item) => item.id === 'SERV')!;
  const analysis = analyzeProject(project, combination, { includeEducationTrace: true });
  return { project, analysis, combination };
};

/** Texto de todas las páginas, con pdf.js como lo leería un visor. */
const extractText = async (bytes: Uint8Array): Promise<string> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: bytes.slice(), useWorkerFetch: false }).promise;
  const pages: string[] = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const content = await (await document.getPage(number)).getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return pages.join('\n');
};

describe('memoria de cálculo PDF', () => {
  it.each(['beam-simple', 'beam-continuous', 'frame-portal', 'truss-pratt'] as const)('se genera con cada método que aplica a %s', async (id) => {
    const { project, analysis, combination } = solved(id);
    const availability = inspectPdfMethodAvailability(project, analysis, { id: '__pdf_export__', name: 'x', factors: combination.factors });
    const methods = SOLUTION_METHODS.filter((method) => availability[method.id].available);
    expect(methods.length).toBeGreaterThan(1);
    for (const method of methods) {
      const report = await createCalculationReport(project, analysis, { solutionMethod: method.id, scenarioName: combination.name, scenarioFactors: combination.factors });
      expect(report.bytes.length, method.id).toBeGreaterThan(10_000);
    }
  }, 240_000);

  it('incrusta IBM Plex Sans y escribe las fórmulas sin LaTeX ni marcas crudas', async () => {
    const { project, analysis, combination } = solved('beam-simple');
    const report = await createCalculationReport(project, analysis, { solutionMethod: 'conjugate-beam', scenarioName: combination.name, scenarioFactors: combination.factors });
    const text = await extractText(report.bytes);
    // Con las fuentes estándar ξ se deletreaba «xi»: que esté es la prueba de la fuente incrustada.
    expect(text).toContain('ξ');
    expect(text).toContain('FStructure');
    expect(text).toContain('Viga conjugada');
    expect(text).not.toMatch(/\\(xi|dfrac|frac|cdot)/);
    expect(text).not.toMatch(/structureCo/);
    expect(text).not.toMatch(/[A-Za-zξ]\^[0-9]/);
  }, 120_000);
});
