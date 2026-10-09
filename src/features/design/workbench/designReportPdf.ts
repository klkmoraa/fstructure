/**
 * Memoria de diseño en PDF, de un elemento o de todos los guardados en la
 * memoria del proyecto. Se carga sólo al exportar (import dinámico) y usa el
 * maquetador de la memoria del Modelo 2D. Cada elemento lleva datos, armado,
 * láminas, comprobaciones con su trazabilidad, valores intermedios,
 * cuantificación, alcance e instantánea: lo que dice el PDF es exactamente lo
 * que mostraba la mesa.
 */
import { concatTransformationMatrix, PDFDocument, popGraphicsState, pushGraphicsState, rgb, StandardFonts, type PDFImage } from 'pdf-lib';
import { APP_VERSION } from '../../../appVersion';
import { designCode } from '../../../design/elements/codes';
import { rebarLabel, type ElementCheck } from '../../../design/elements/shared';
import { takeoffBarUsage } from '../../../design/elements/takeoff';
import { PdfLayout } from '../../../utils/pdf/pdfBuilder';
import { createPalette } from '../../../utils/pdf/pdfTheme';
import { reportHeading, snapshotHash, stableJson, type DesignReport, type ReportFigure } from './designReport';
import { rasterizeFigure, type RasterFigure } from './figureRaster';

const DOCUMENT_TITLE = 'Memoria de diseño · Experimental';
const STATUS_TEXT: Record<ElementCheck['status'], string> = {
  pass: 'Cumple', fail: 'No cumple', warning: 'Revisar', info: 'Nota', 'out-of-scope': 'Sin evaluar',
};
const ELEMENT_NAME = { beam: 'Viga', column: 'Columna', frame: 'Estructura', footing: 'Cimentación', section: 'Sección experimental' } as const;

const number = (value: number | undefined, unit: string | undefined) =>
  value === undefined || !Number.isFinite(value) ? '—' : `${value.toLocaleString('es-MX', { maximumFractionDigits: unit === '' ? 2 : 1 })}${unit ? ` ${unit}` : ''}`;
const percent = (ratio: number | undefined) => ratio === undefined || !Number.isFinite(ratio) ? '—' : `${Math.round(ratio * 100)} %`;
const kg = (value: number) => `${value.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
const headline = (report: DesignReport) => report.status === 'fail' ? 'No cumple'
  : report.status === 'warning' ? 'Con observaciones' : report.outOfScope.length ? 'Cumple lo evaluado' : 'Cumple';

interface DesignMemoriaOptions {
  readonly projectName?: string;
  readonly generatedAt?: Date;
  /** Rasteriza las láminas; en pruebas o sin navegador se omiten. */
  readonly figures?: boolean;
}

/**
 * Los volados de unidades (cm², m³) se escriben en línea: la transliteración común
 * del PDF los convierte en marcas de fórmula (^2), que en una tabla se leen mal.
 */
const inline = (text: string) => text.replaceAll('²', '2').replaceAll('³', '3');
function plain<T>(value: T): T {
  if (typeof value === 'string') return inline(value) as T;
  if (Array.isArray(value)) return value.map(plain) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === 'input' ? item : plain(item)])) as T;
  }
  return value;
}

type EmbeddedFigure = { readonly figure: ReportFigure; readonly raster: RasterFigure; readonly image: PDFImage };

/** Rasteriza y embebe las láminas; las que no se pueden dibujar se omiten sin romper la memoria. */
async function embedFigures(pdf: PDFDocument, figures: readonly ReportFigure[]): Promise<EmbeddedFigure[]> {
  const embedded: EmbeddedFigure[] = [];
  for (const figure of figures) {
    const raster = await rasterizeFigure(figure.render());
    if (!raster) continue;
    embedded.push({ figure, raster, image: await pdf.embedPng(raster.png) });
  }
  return embedded;
}

const caption = (item: EmbeddedFigure) => `${item.figure.title}${item.figure.note ? ` (${item.figure.note})` : ''}`;

/** Las láminas angostas (secciones) van de dos en dos; las anchas, solas. */
function drawFigures(layout: PdfLayout, figures: readonly EmbeddedFigure[]) {
  const narrow = (item: EmbeddedFigure) => item.raster.width <= 320;
  for (let index = 0; index < figures.length; index += 1) {
    const item = figures[index]!;
    const next = figures[index + 1];
    if (narrow(item) && next && narrow(next)) {
      const gutter = 24;
      const cell = (layout.contentWidth - gutter) / 2;
      const size = (entry: EmbeddedFigure) => {
        const width = Math.min(cell, entry.raster.width * 0.8);
        return { width, height: width * entry.raster.height / entry.raster.width };
      };
      const [a, b] = [size(item), size(next)];
      const height = Math.max(a.height, b.height);
      layout.figure(height, (rect) => {
        layout.page.drawImage(item.image, { x: rect.x + (cell - a.width) / 2, y: rect.y + height - a.height, width: a.width, height: a.height });
        layout.page.drawImage(next.image, { x: rect.x + cell + gutter + (cell - b.width) / 2, y: rect.y + height - b.height, width: b.width, height: b.height });
      }, `izquierda, ${caption(item)}; derecha, ${caption(next)}`);
      index += 1;
      continue;
    }
    const width = Math.min(layout.contentWidth, item.raster.width * (narrow(item) ? 0.8 : 0.62));
    const height = Math.min(520, width * item.raster.height / item.raster.width);
    const drawnWidth = height * item.raster.width / item.raster.height;
    layout.figure(height, (rect) => {
      layout.page.drawImage(item.image, { x: rect.x + (rect.width - drawnWidth) / 2, y: rect.y, width: drawnWidth, height });
    }, caption(item));
  }
}

async function drawElement(layout: PdfLayout, pdf: PDFDocument, source: DesignReport, options: DesignMemoriaOptions) {
  const { palette } = layout;
  const report = plain(source);
  const code = designCode(report.code);
  const incomplete = report.outOfScope.length > 0;
  const hash = await snapshotHash(source);
  layout.part(reportHeading(report), [ELEMENT_NAME[report.element], report.place, report.basisLabel ?? `${code.name} · ${code.country}`].filter(Boolean).join(' · '));

  layout.metrics([
    { label: 'Estado', value: report.status === 'fail' ? 'No cumple' : report.status === 'warning' ? 'Observado' : 'Cumple',
      detail: incomplete && report.status !== 'fail' ? 'lo evaluado · revisión incompleta' : undefined,
      color: report.status === 'fail' ? palette.danger : report.status === 'warning' ? palette.warn : palette.ok },
    { label: 'Utilización que rige', value: percent(report.governingRatio) },
    { label: 'Acero', value: kg(report.takeoff.steelKg), detail: `${report.takeoff.steelRatioKgM3.toFixed(0)} kg/m3 de concreto` },
    { label: 'Sin evaluar', value: String(report.outOfScope.length), detail: 'fuera del alcance' },
  ]);
  if (incomplete) {
    layout.callout('warn', 'Revisión incompleta',
      `Lo evaluado ${report.status === 'fail' ? 'no cumple' : 'cumple'}, pero ${report.outOfScope.length} verificaciones que la norma pide quedan fuera del alcance del taller (apartado «Fuera de alcance»). El elemento no puede declararse conforme sin revisarlas.`);
  }

  layout.heading('Datos de entrada');
  for (const group of report.data) {
    layout.heading(group.title, 3);
    layout.keyValues(group.rows.map((row) => [row.label, row.value] as const), 150);
  }

  layout.heading('Armado');
  layout.keyValues(report.reinforcement.map((row) => [row.label, row.value] as const), 150);
  if (report.alternative) {
    layout.heading('Armado propio frente al propuesto', 3);
    layout.table([
      { header: 'Armado', flex: 2 },
      { header: 'Estado', width: 70 },
      { header: 'Rige', width: 50, align: 'right' },
      { header: 'Acero', width: 70, align: 'right' },
    ], [
      ['Propio (el de esta memoria)', STATUS_TEXT[report.status], percent(report.governingRatio), kg(report.takeoff.steelKg)],
      [report.alternative.label, STATUS_TEXT[report.alternative.status], percent(report.alternative.governingRatio), kg(report.alternative.steelKg)],
    ]);
  }

  if (options.figures !== false && report.figures.length) {
    const figures = await embedFigures(pdf, report.figures);
    if (figures.length) {
      layout.heading('Láminas');
      drawFigures(layout, figures);
    }
  }

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
    layout.heading('Trazabilidad', 2);
    layout.note('Dónde rige cada comprobación, de qué combinación sale la demanda y qué cláusulas la respaldan.');
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

  layout.heading('Valores intermedios');
  layout.table([
    { header: 'Símbolo', width: 80 },
    { header: 'Concepto', flex: 2 },
    { header: 'Valor', flex: 1.3, align: 'right' },
  ], report.values.map((row) => [row.symbol, row.label, row.value]));
  for (const table of report.tables) {
    layout.heading(table.title, 3);
    layout.table(table.columns.map((header, index) => ({ header, flex: 1, align: index === 0 ? 'left' as const : 'right' as const })), table.rows);
  }

  layout.heading('Cuantificación');
  layout.table([
    { header: 'Pieza', flex: 2.4 },
    { header: 'Varilla', width: 50 },
    { header: 'Piezas', width: 48, align: 'right' },
    { header: 'Long. (m)', width: 58, align: 'right' },
    { header: 'Masa', width: 66, align: 'right' },
  ], [
    ...report.takeoff.lines.map((item) => [item.mark, rebarLabel(item.diameterMm, takeoffBarUsage(item.mark)), String(item.count), item.pieceLengthM.toFixed(2), kg(item.massKg)]),
    ['Total de acero', '', '', '', kg(report.takeoff.steelKg)],
  ]);
  layout.keyValues([
    ['Concreto', `${report.takeoff.concreteM3.toFixed(3)} m3`],
    ['Cuantía', `${report.takeoff.steelRatioKgM3.toFixed(0)} kg de acero por m3 de concreto`],
  ], 150);
  layout.note(report.takeoff.basis);

  if (report.notes.length) {
    layout.heading('Notas del cálculo');
    layout.keyValues(report.notes.map((check) => [check.label, `${check.note ?? ''} (${check.reference.label})`] as const), 150);
  }

  layout.heading('Fuera de alcance');
  layout.note(report.basisLabel ? 'Verificaciones fuera del modelo experimental. Deben resolverse aparte.' : 'Verificaciones que la norma pide y el taller no calcula. Deben resolverse aparte.');
  if (report.outOfScope.length) layout.keyValues(report.outOfScope.map((check) => [check.label, check.note ?? ''] as const), 150);
  else layout.text('Todas las verificaciones declaradas para este elemento se evaluaron.');

  layout.heading('Instantánea');
  layout.note('La huella identifica la entrada exacta: la misma entrada, norma y versión reproducen este cálculo.');
  layout.keyValues([
    [report.basisLabel ? 'Modelo' : 'Norma', report.basisLabel ?? `${code.name} · ${code.country}`],
    ['FStructure', APP_VERSION],
    ['Huella SHA-256', hash],
  ], 110);
  layout.heading('Entrada del motor, en sus unidades internas', 3);
  layout.note(stableJson(report.input));
}

/** Portada: proyecto, índice de elementos, totales y el bloque de responsiva. */
function drawCover(layout: PdfLayout, reports: readonly DesignReport[], options: DesignMemoriaOptions, generatedAt: Date) {
  const bases = [...new Set(reports.map((report) => report.basisLabel ?? `${designCode(report.code).name} · ${designCode(report.code).country}`))];
  layout.label('Memoria de cálculo · Diseño de elementos de concreto');
  layout.heading(options.projectName?.trim() || 'Proyecto sin título');
  layout.keyValues([
    ['Bases de cálculo', bases.join('; ')],
    ['Elementos', String(reports.length)],
    ['Fecha', generatedAt.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })],
    ['Programa', `FStructure ${APP_VERSION} · FS-A04 Diseño (experimental)`],
  ], 110);
  layout.callout('neutral', 'Alcance',
    'Cálculo preliminar para revisión profesional; no es un documento de construcción. Cada elemento declara lo que el taller no evalúa. La responsabilidad del diseño es de quien lo firma.');

  layout.heading('Índice de elementos');
  layout.table([
    { header: 'Clave', width: 60 },
    { header: 'Elemento', flex: 1.6 },
    { header: 'Ubicación', flex: 1.3 },
    { header: 'Estado', flex: 1.1 },
    { header: 'Rige', width: 42, align: 'right' },
    { header: 'Acero', width: 64, align: 'right' },
  ], reports.map((report) => [report.tag || '—', report.title, report.place || '—', headline(report), percent(report.governingRatio), kg(report.takeoff.steelKg)]));
  const steel = reports.reduce((total, report) => total + report.takeoff.steelKg, 0);
  const concrete = reports.reduce((total, report) => total + report.takeoff.concreteM3, 0);
  const failing = reports.filter((report) => report.status === 'fail').length;
  layout.keyValues([
    ['Acero total', kg(steel)],
    ['Concreto total', `${concrete.toFixed(3)} m3`],
    ['No cumplen', failing ? `${failing} de ${reports.length}` : 'ninguno'],
  ], 110);

  layout.heading('Responsiva');
  layout.keyValues([
    ['Elaboró', '_____________________________________   Cédula: ______________'],
    ['Revisó', '_____________________________________   Cédula: ______________'],
    ['Fecha y firma', '_____________________________________'],
  ], 110);
}

export async function buildDesignMemoriaPdf(reports: readonly DesignReport[], options: DesignMemoriaOptions = {}): Promise<Uint8Array> {
  if (!reports.length) throw new Error('La memoria necesita al menos un elemento.');
  const generatedAt = options.generatedAt ?? new Date();
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${reports.length === 1 ? reportHeading(reports[0]!) : options.projectName?.trim() || 'Memoria de diseño'} · ${DOCUMENT_TITLE}`);
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
  drawCover(layout, reports, options, generatedAt);
  for (const report of reports) await drawElement(layout, pdf, report, options);
  layout.stampChrome(options.projectName?.trim() || 'FStructure · Diseño', DOCUMENT_TITLE);
  return pdf.save();
}
