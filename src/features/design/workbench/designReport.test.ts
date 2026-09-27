import { describe, expect, it } from 'vitest';
import { designColumn } from '../../../design/elements/column';
import { outOfScopeChecks, reviewState } from '../../../design/elements/scope';
import { memoText, snapshotHash, stableJson, type DesignReport } from './designReport';
import { buildDesignReportPdf } from './designReportPdf';

const column = designColumn({
  code: 'ntc-2023', widthMm: 400, depthMm: 400, coverMm: 40, fcMpa: 25, fyMpa: 420, barDiameterMm: 19.1, barsAlongWidth: 3, barsAlongDepth: 3,
  tieDiameterMm: 9.5, maxAggregateMm: 19, axialKn: 900, momentXKnm: 80, momentYKnm: 40, unbracedLengthM: 3, effectiveLengthFactor: 1,
  curvature: 'single', endMomentRatio: 1, shearXKn: 0, shearYKn: 0, group: 'B2', groundFloor: false, sustainedRatio: 0.6,
  braced: true, swayMomentXKnm: 0, swayMomentYKnm: 0, stabilityIndex: 0,
});
if (!column.ok) throw new Error(column.errors.join('; '));

const report: DesignReport = {
  element: 'column', title: 'Columna 40 × 40 cm', code: 'ntc-2023', status: column.status, governingRatio: column.governingRatio,
  memo: 'COLUMNA 40×40 cm\n✓ Flexocompresión\nFStructure · Diseño experimental; requiere revisión profesional.',
  checks: column.checks.filter((check) => check.status !== 'info'), notes: column.checks.filter((check) => check.status === 'info'),
  outOfScope: outOfScopeChecks('column', 'ntc-2023'), input: column.input,
};

describe('instantánea de diseño', () => {
  it('no llama «Cumple» a un elemento con verificaciones sin evaluar', () => {
    expect(reviewState('pass', report.outOfScope)).toBe('incomplete');
    expect(reviewState('pass', [])).toBe('pass');
    expect(reviewState('fail', report.outOfScope)).toBe('fail');
  });

  it('la huella no depende del orden de las llaves', async () => {
    expect(stableJson({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe('{"a":[2,{"c":4,"d":3}],"b":1}');
    const reordered = { ...report, input: Object.fromEntries(Object.entries(column.input).reverse()) };
    expect(await snapshotHash(reordered)).toBe(await snapshotHash(report));
    expect(await snapshotHash({ ...report, input: { ...column.input, axialKn: 901 } })).not.toBe(await snapshotHash(report));
  });

  it('la memoria copiada lista lo que no se evaluó antes de la firma', () => {
    const lines = memoText(report).split('\n');
    expect(lines.at(-2)).toMatch(/^○ Sin evaluar .*Concurrencia de Pu, Mux y Muy/);
    expect(lines.at(-1)).toMatch(/^FStructure · /);
  });

  it('genera un PDF', async () => {
    const bytes = await buildDesignReportPdf(report, new Date('2026-09-26T12:00:00Z'));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(4_000);
  });
});
