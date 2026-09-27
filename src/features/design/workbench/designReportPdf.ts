/**
 * Memoria de diseño en PDF. Se carga sólo al exportar (import dinámico) y usa el
 * mismo maquetador que la memoria del Modelo 2D, con la instantánea del taller:
 * lo que dice el PDF es exactamente lo que mostraba la mesa.
 */
import { concatTransformationMatrix, PDFDocument, popGraphicsState, pushGraphicsState, rgb, StandardFonts } from 'pdf-lib';
import { APP_VERSION } from '../../../appVersion';
import { designCode } from '../../../design/elements/codes';
import type { ElementCheck } from '../../../design/elements/shared';
import { PdfLayout } from '../../../utils/pdf/pdfBuilder';
import { createPalette } from '../../../utils/pdf/pdfTheme';
import { memoText, snapshotHash, stableJson, type DesignReport } from './designReport';

const DOCUMENT_TITLE = 'Memoria de diseño · Experimental';
const STATUS_TEXT: Record<ElementCheck['status'], string> = {
  pass: 'Cumple', fail: 'No cumple', warning: 'Revisar', info: 'Nota', 'out-of-scope': 'Sin evaluar',
};

const number = (value: number | undefined, unit: string | undefined) =>
  value === undefined || !Number.isFinite(value) ? '—' : `${value.toLocaleString('es-MX', { maximumFractionDigits: unit === '' ? 2 : 1 })}${unit ? ` ${unit}` : ''}`;
const percent = (ratio: number | undefined) => ratio === undefined || !Number.isFinite(ratio) ? '—' : `${Math.round(ratio * 100)} %`;

export async function buildDesignReportPdf(report: DesignReport, generatedAt = new Date()): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${report.title} · ${DOCUMENT_TITLE}`);
  pdf.setProducer(`FStructure ${APP_VERSION}`);
  pdf.setCreationDate(generatedAt);
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    mathRegular: await pdf.embedFont(StandardFonts.TimesRoman),
    mathItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    mathSymbol: await pdf.embedFont(StandardFonts.Symbol),
  };
  const layout = new PdfLayout(pdf, fonts, createPalette(rgb), rgb, { concatTransformationMatrix, pushGraphicsState, popGraphicsState });
  const { palette } = layout;
  const code = designCode(report.code);
  const incomplete = report.outOfScope.length > 0;
  const hash = await snapshotHash(report);

  // Resumen en la primera página, que `PdfLayout` ya abrió.
  layout.label(`${code.name} · ${code.country}`);
  layout.heading(report.title);
  layout.note('Cálculo preliminar para revisión profesional; no es un documento de construcción.');
  layout.gap(2);
  const headline = report.status === 'fail' ? 'No cumple' : report.status === 'warning' ? 'Observado' : 'Cumple';
  layout.metrics([
    { label: 'Estado', value: headline, detail: incomplete && report.status !== 'fail' ? 'lo evaluado · revisión incompleta' : undefined, color: report.status === 'fail' ? palette.danger : report.status === 'warning' ? palette.warn : palette.ok },
    { label: 'Utilización que rige', value: percent(report.governingRatio) },
    { label: 'Comprobaciones', value: String(report.checks.length), detail: `${report.checks.filter((check) => check.status === 'fail').length} no cumplen` },
    { label: 'Sin evaluar', value: String(report.outOfScope.length), detail: 'fuera del alcance' },
  ]);
  if (incomplete) {
    layout.callout('warn', 'Revisión incompleta',
      `Lo evaluado ${report.status === 'fail' ? 'no cumple' : 'cumple'}, pero ${report.outOfScope.length} verificaciones que la norma pide quedan fuera del alcance del taller (apartado «Fuera de alcance»). El elemento no puede declararse conforme sin revisarlas.`);
  }
  layout.heading('Datos y resultado');
  layout.bullets(report.memo.split('\n').filter((line) => line && !line.startsWith('FStructure · ') && !/^[✓✗!] /.test(line)));

  // 2 · Comprobaciones con veredicto.
  layout.heading('Comprobaciones');
  layout.note('Demanda frente a capacidad de diseño. * = criterio complementario, no cláusula con evidencia en el registro normativo.');
  layout.table([
    { header: 'Comprobación', flex: 2.2 },
    { header: 'Estado', width: 58 },
    { header: 'Demanda', width: 66, align: 'right' },
    { header: 'Capacidad', width: 66, align: 'right' },
    { header: '%', width: 36, align: 'right' },
    { header: 'Referencia', flex: 1.2 },
  ], report.checks.map((check) => [
    check.label,
    STATUS_TEXT[check.status],
    number(check.demand, check.unit),
    number(check.capacity, check.unit),
    percent(check.ratio),
    `${check.reference.standard === 'complementary' ? '* ' : ''}${check.reference.label}`,
  ]));
  const traced = report.checks.filter((check) => check.location || check.combination || check.note);
  if (traced.length) {
    layout.heading('Trazabilidad');
    layout.note('Dónde rige cada comprobación y de qué combinación sale la demanda.');
    for (const check of traced) {
      layout.heading(check.label, 3);
      layout.keyValues([
        ...(check.location ? [['Rige en', check.location] as const] : []),
        ...(check.combination ? [['Demanda', check.combination] as const] : []),
        ...(check.note ? [['Nota', check.note] as const] : []),
        ...(check.reference.clauseIds.length ? [['Cláusulas', check.reference.clauseIds.join(', ')] as const] : []),
      ], 90);
    }
  }

  // 3 · Notas del cálculo.
  if (report.notes.length) {
    layout.heading('Notas del cálculo');
    layout.keyValues(report.notes.map((check) => [check.label, `${check.note ?? ''} (${check.reference.label})`] as const), 150);
  }

  // 4 · Alcance.
  layout.heading('Fuera de alcance');
  layout.note('Verificaciones que la norma pide y el taller no calcula. Deben resolverse aparte.');
  if (report.outOfScope.length) layout.keyValues(report.outOfScope.map((check) => [check.label, check.note ?? ''] as const), 150);
  else layout.text('Todas las verificaciones declaradas para este elemento se evaluaron.');

  // 5 · Instantánea reproducible.
  layout.heading('Instantánea');
  layout.note('La huella identifica la entrada exacta: la misma entrada, norma y versión reproducen este documento.');
  layout.keyValues([
    ['Elemento', report.title],
    ['Norma', `${code.name} · ${code.country}`],
    ['FStructure', APP_VERSION],
    ['Generado', generatedAt.toISOString()],
    ['Huella SHA-256', hash],
  ], 110);
  layout.heading('Entrada del motor, en sus unidades internas', 2);
  layout.note(stableJson(report.input));
  layout.heading('Memoria de texto', 2);
  layout.note(memoText(report));

  layout.stampChrome('FStructure · Diseño', DOCUMENT_TITLE);
  return pdf.save();
}
