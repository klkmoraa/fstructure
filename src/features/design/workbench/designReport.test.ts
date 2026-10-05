import { describe, expect, it } from 'vitest';
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { designBeam } from '../../../design/elements/beam';
import { reviewState } from '../../../design/elements/scope';
import { barMassKgPerM } from '../../../design/elements/takeoff';
import { BEAM_DEFAULTS, DEFAULT_SPANS, beamReportFromDraft, beamToInput } from './beamModel';
import { COLUMN_DEFAULTS, columnReportFromDraft } from './columnModel';
import { reportFromMemoryItem } from './designMemory';
import { memoText, snapshotHash, stableJson, type DesignReport } from './designReport';
import { buildDesignMemoriaPdf } from './designReportPdf';
import { FOOTING_DEFAULTS, footingReportFromDraft } from './footingModel';

const unwrap = (outcome: { ok: true; report: DesignReport } | { ok: false; errors: readonly string[] }) => {
  if (!outcome.ok) throw new Error(outcome.errors.join('; '));
  return outcome.report;
};

const column = unwrap(columnReportFromDraft('ntc-2023', { ...COLUMN_DEFAULTS, tag: 'C-1', place: 'Eje A-1 · PB' }));
const beam = unwrap(beamReportFromDraft('ntc-2023', { ...BEAM_DEFAULTS, tag: 'V-1' }, DEFAULT_SPANS));
const footing = unwrap(footingReportFromDraft('ntc-2023', FOOTING_DEFAULTS));

describe('instantánea de diseño', () => {
  it('no llama «Cumple» a un elemento con verificaciones sin evaluar', () => {
    expect(reviewState('pass', column.outOfScope)).toBe('incomplete');
    expect(reviewState('pass', [])).toBe('pass');
    expect(reviewState('fail', column.outOfScope)).toBe('fail');
  });

  it('la huella no depende del orden de las llaves', async () => {
    expect(stableJson({ b: 1, a: [2, { d: 3, c: 4 }], z: undefined })).toBe('{"a":[2,{"c":4,"d":3}],"b":1}');
    const input = column.input as Record<string, unknown>;
    const reordered = { ...column, input: Object.fromEntries(Object.entries(input).reverse()) };
    expect(await snapshotHash(reordered)).toBe(await snapshotHash(column));
    expect(await snapshotHash({ ...column, input: { ...input, axialKn: 901 } })).not.toBe(await snapshotHash(column));
  });

  it('la memoria copiada abre con la identificación y lista lo no evaluado antes de la firma', () => {
    const lines = memoText(column).split('\n');
    expect(lines[0]).toBe('C-1 · Eje A-1 · PB');
    expect(lines.at(-2)).toMatch(/^○ Sin evaluar .*Concurrencia de Pu, Mux y Muy/);
    expect(lines.at(-1)).toMatch(/^FStructure · /);
  });

  it('trae datos, armado, valores intermedios, cuantificación y láminas de cada elemento', () => {
    for (const report of [beam, column, footing]) {
      expect(report.data.length).toBeGreaterThan(1);
      expect(report.reinforcement.length).toBeGreaterThan(0);
      expect(report.values.length).toBeGreaterThan(5);
      expect(report.figures.length).toBeGreaterThanOrEqual(2);
      expect(report.takeoff.steelKg).toBeCloseTo(report.takeoff.lines.reduce((total, line) => total + line.massKg, 0), 9);
      expect(report.takeoff.concreteM3).toBeGreaterThan(0);
    }
    expect(beam.tables[0]!.rows).toHaveLength(2);
  });
});

describe('cuantificación', () => {
  it('usa la masa lineal de la varilla (#5: 1.559 kg/m)', () => {
    expect(barMassKgPerM(15.9)).toBeCloseTo(1.559, 3);
  });

  it('cuenta el concreto con las dimensiones del elemento', () => {
    // Viga 25 × 50 con claros de 5 y 4 m.
    expect(beam.takeoff.concreteM3).toBeCloseTo(0.25 * 0.5 * 9, 6);
    // Columna 40 × 40 con 3 m de altura libre.
    expect(column.takeoff.concreteM3).toBeCloseTo(0.4 * 0.4 * 3, 6);
  });
});

describe('armado propio de la viga', () => {
  const input = (patch: Partial<typeof BEAM_DEFAULTS>) => beamToInput('ntc-2023', { ...BEAM_DEFAULTS, rebarMode: 'own', ...patch }, DEFAULT_SPANS);

  it('respeta las corridas y quita bastones cuando ya alcanzan', () => {
    const result = designBeam(input({ topCount: '4', topBar: '19.1', bottomCount: '4', bottomBar: '19.1' }));
    if (!result.ok) throw new Error(result.errors.join('; '));
    expect(result.continuousTop.continuous).toEqual({ count: 4, diameterMm: 19.1 });
    expect(result.bastions).toHaveLength(0);
    expect(result.checks.find((check) => check.id === 'flexure-positive')!.status).toBe('pass');
  });

  it('sin bastones, la flexión se revisa sólo con las corridas y puede no cumplir', () => {
    const result = designBeam(input({ topCount: '2', topBar: '12.7', bottomCount: '2', bottomBar: '12.7', ownBastions: 'none' }));
    if (!result.ok) throw new Error(result.errors.join('; '));
    expect(result.bastions).toHaveLength(0);
    expect(result.status).toBe('fail');
  });

  it('aplica la separación de estribos pedida y la revisa contra la máxima', () => {
    const result = designBeam(input({ stirrupSpacing: '40' }));
    if (!result.ok) throw new Error(result.errors.join('; '));
    expect(result.spans.every((span) => span.stirrups.denseSpacingMm === 400 && span.stirrups.denseZones.length === 0)).toBe(true);
    expect(result.checks.find((check) => check.id === 'stirrup-spacing')!.status).toBe('fail');
    expect(designBeam(input({ stirrupSpacing: '3' })).ok).toBe(false);
  });

  it('compara el propio con el propuesto en la memoria', () => {
    const report = unwrap(beamReportFromDraft('ntc-2023', { ...BEAM_DEFAULTS, rebarMode: 'own', topCount: '4', topBar: '19.1', bottomCount: '4', bottomBar: '19.1' }, DEFAULT_SPANS));
    expect(report.alternative?.label).toMatch(/propuesto/);
    expect(report.takeoff.steelKg).toBeGreaterThan(report.alternative!.steelKg);
  });
});

describe('memoria del proyecto', () => {
  it('recalcula secciones guardadas con su geometría, filosofía y factores propios', async () => {
    const item = { id: 's1', element: 'section' as const, code: 'ntc-2023', savedAt: '2026-10-01', fields: {
      tag: 'S-1', shape: 'triangle', width: '60', height: '70', barCount: '6',
      philosophy: 'limit-state', gammaConcrete: '1.6', gammaSteel: '1.2', axial: '200', moment: '-30',
    } };
    const section = unwrap(reportFromMemoryItem(item));
    expect(section.element).toBe('section');
    expect(section.tag).toBe('S-1');
    expect(section.basisLabel).toMatch(/Estados límite/);
    expect(section.input).toMatchObject({ shape: 'triangle', widthMm: 600, heightMm: 700, philosophy: 'limit-state', gammaConcrete: 1.6, gammaSteel: 1.2, momentKnm: -30 });
    expect(section.takeoff.concreteM3).toBeCloseTo(0.6 * 0.7 / 2 * 3, 8);
    const changed = unwrap(reportFromMemoryItem({ ...item, fields: { ...item.fields, gammaConcrete: '1.5' } }));
    expect(await snapshotHash(section)).not.toBe(await snapshotHash(changed));
    expect(reportFromMemoryItem({ ...item, fields: { ...item.fields, cover: '50' } }).ok).toBe(false);
    const bytes = await buildDesignMemoriaPdf([column, section], { figures: false });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(2);
  });

  it('identifica el modelo experimental en el PDF sin atribuirlo a la norma seleccionada', async () => {
    const model = { ...column, basisLabel: 'Resistencia ultima · Modelo experimental', code: 'e060' as const };
    const bytes = await buildDesignMemoriaPdf([model], { figures: false });
    const pdf = await PDFDocument.load(bytes);
    const texts = pdf.getPages().flatMap((page) => {
      const contents = page.node.Contents();
      const streams = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
      return streams.flatMap((ref) => {
        const stream = pdf.context.lookup(ref);
        if (!(stream instanceof PDFRawStream)) return [];
        const decoded = new TextDecoder().decode(decodePDFRawStream(stream).decode());
        return [...decoded.matchAll(/<([0-9A-F]+)>\s*Tj/gi)].map((match) => Buffer.from(match[1]!, 'hex').toString('latin1'));
      });
    }).join(' ');
    expect(texts).toContain('Resistencia ultima');
    expect(texts).toContain('Modelo experimental');
    expect(texts).not.toContain('E.060');
  });

  it('recalcula un elemento guardado desde su borrador', () => {
    const outcome = reportFromMemoryItem({ id: 'v1', element: 'beam', code: 'nsr-10', savedAt: '2026-09-27T00:00:00.000Z', fields: { tag: 'V-7', width: '30' }, rows: [{ length: '6', dead: '12', live: '8', pointDead: '0', pointLive: '0', pointAt: '3' }] });
    const report = unwrap(outcome);
    expect(report.tag).toBe('V-7');
    expect(report.code).toBe('nsr-10');
    expect(report.title).toBe('Viga 30 × 50 cm');
    expect(reportFromMemoryItem({ id: 'c1', element: 'column', code: 'ntc-2023', savedAt: '', fields: { width: '0' } }).ok).toBe(false);
  });

  it('genera el PDF de un elemento y el de toda la memoria', async () => {
    const single = await buildDesignMemoriaPdf([column], { generatedAt: new Date('2026-09-27T12:00:00Z'), figures: false });
    expect(new TextDecoder().decode(single.slice(0, 5))).toBe('%PDF-');
    const all = await buildDesignMemoriaPdf([beam, column, footing], { projectName: 'Casa Morales', figures: false });
    expect(all.length).toBeGreaterThan(single.length);
    await expect(buildDesignMemoriaPdf([])).rejects.toThrow();
  });
});
