import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../../data/defaultProject';
import { MODEL_START_DEFAULTS, withModelStart } from '../../data/modelStarts';
import { analyzeProject } from '../../engine/solver';
import { createCalculationReport } from '../calculationPdf';
import { inspectPdfMethodAvailability } from './pdfMethodSection';
import { CALCULATION_PDF_EXPORT_DEFAULTS } from './reportContext';

/** Texto de todas las páginas, con pdf.js como lo leería un visor. */
const extractText = async (bytes: Uint8Array): Promise<string> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: bytes.slice(), useWorkerFetch: false }).promise;
  const pages: string[] = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const content = await (await document.getPage(number)).getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return pages.join('\n').replace(/\s+/g, ' ');
};

describe('Portal y Voladizo en la memoria: lo que no reparten se declara', () => {
  const project = withModelStart(createBlankProject(), 'frame-portal', MODEL_START_DEFAULTS['frame-portal']);
  const u2 = project.combinations.find((entry) => entry.id === 'U2')!;
  const analysis = analyzeProject(project, u2);

  it('el inicio de pórtico en U2 ofrece ambos métodos', () => {
    expect(analysis.success).toBe(true);
    const availability = inspectPdfMethodAvailability(project, analysis, { id: '__pdf_export__', name: u2.name, factors: u2.factors });
    expect(availability['portal-method']).toEqual({ available: true });
    expect(availability['cantilever-method']).toEqual({ available: true });
  });

  it.each([
    ['portal-method', 'Método del Portal'],
    ['cantilever-method', 'Método del Voladizo'],
  ] as const)('%s nombra las cargas excluidas y pide superponerlas', async (solutionMethod, name) => {
    const report = await createCalculationReport(project, analysis, {
      ...CALCULATION_PDF_EXPORT_DEFAULTS,
      solutionMethod,
      scenarioName: u2.name,
      scenarioFactors: u2.factors,
    });
    expect(report.solutionMethod).toBe(solutionMethod);
    const text = await extractText(report.bytes);
    expect(text).toContain(name);
    expect(text).toContain('quedan fuera de este análisis');
    expect(text).toContain('Cargas verticales sobre las vigas: CM-V11 (V11, factor 1.2); CV-V11 (V11)');
    expect(text).toContain('Peso propio de las barras: factor 1.2');
    expect(text).toContain('se superpone');
  }, 60_000);

  it.each(['portal-method', 'cantilever-method'] as const)('%s convierte el viento sobre una columna y lo narra', async (solutionMethod) => {
    const windy = {
      ...project,
      memberLoads: [...project.memberLoads, {
        id: 'viento', memberId: 'C11', caseId: 'S', type: 'distributed' as const, coordinateSystem: 'global' as const, lengthBasis: 'real' as const,
        start: 0, end: 1, qxStart: 2, qxEnd: 2, qyStart: 0, qyEnd: 0,
      }],
    };
    const windyAnalysis = analyzeProject(windy, u2);
    const availability = inspectPdfMethodAvailability(windy, windyAnalysis, { id: '__pdf_export__', name: u2.name, factors: u2.factors });
    expect(availability[solutionMethod]).toEqual({ available: true });
    const report = await createCalculationReport(windy, windyAnalysis, {
      ...CALCULATION_PDF_EXPORT_DEFAULTS, solutionMethod, scenarioName: u2.name, scenarioFactors: u2.factors,
    });
    const text = await extractText(report.bytes);
    expect(text).toContain('Cargas laterales sobre las columnas');
    expect(text).toContain('Carga viento sobre la columna C11');
    expect(text).toContain('parte de la aproximación');
    expect(text).toContain('tras la conversión');
  }, 60_000);
});
