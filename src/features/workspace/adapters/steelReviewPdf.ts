import { concatTransformationMatrix, PDFDocument, popGraphicsState, pushGraphicsState, rgb, StandardFonts } from 'pdf-lib';
import { APP_VERSION } from '../../../appVersion';
import type { summarizeNtcSteelTensionDesign } from '../../../design/ntcSteel2023';
import type { LoadCombination, ProjectModel } from '../../../types';
import { PdfLayout } from '../../../utils/pdf/pdfBuilder';
import { createPalette } from '../../../utils/pdf/pdfTheme';

export interface SteelReviewReport {
  readonly projectName: string;
  readonly combination: LoadCombination;
  readonly summary: ReturnType<typeof summarizeNtcSteelTensionDesign>;
  readonly model: ProjectModel;
}

/** Informe del componente existente, con cobertura y exclusiones; no declara cumplimiento global. */
export async function buildSteelReviewPdf(report: SteelReviewReport, generatedAt = new Date()): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${report.projectName} · Acero · revisión parcial`);
  pdf.setProducer(`FStructure ${APP_VERSION}`);
  pdf.setCreationDate(generatedAt);
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    mathRegular: await pdf.embedFont(StandardFonts.TimesRoman), mathItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic), mathSymbol: await pdf.embedFont(StandardFonts.Symbol),
  };
  const layout = new PdfLayout(pdf, fonts, createPalette(rgb), rgb, { concatTransformationMatrix, pushGraphicsState, popGraphicsState });
  layout.heading('Acero · revisión parcial', 1);
  layout.text('NO CONCLUYENTE · Experimental. Este informe sólo documenta la fluencia de la sección total; no concluye el diseño del miembro ni del proyecto.');
  layout.keyValues([['Proyecto', report.projectName], ['Generado', generatedAt.toISOString()], ['Combinación del modelo', report.combination.name]], 140);
  layout.heading('Demanda y procedencia');
  layout.text(Object.entries(report.combination.factors).map(([id, factor]) => `${factor} × ${id}`).join(' + '));
  layout.keyValues([['Jurisdicción', report.combination.jurisdiction ?? 'No indicada'], ['Edición', report.combination.edition ?? 'No indicada'], ['Estado límite', report.combination.stateLimit ?? 'No indicado'], ['Procedencia', report.combination.source ?? 'No indicada'], ['Fuente', report.combination.sourceUrl ?? 'No indicada']], 100);
  const { summary } = report;
  layout.heading('Cobertura');
  layout.text(`${summary.status === 'available' ? summary.results.length : 0} barras evaluadas; ${summary.skipped.length} fuera del alcance o con datos insuficientes.`);
  if (summary.status === 'available') for (const result of summary.results) {
    layout.heading(`Barra ${result.subject.memberId}`, 2);
    layout.keyValues([['Material / sección', `${result.subject.materialId} / ${result.subject.sectionId}`], ['Demanda Pu', `${result.demand.value.toFixed(3)} kN`], ['Resistencia Rt,y', `${result.resistance.value.toFixed(3)} kN`], ['Pu/Rt,y', result.ratio.value.toFixed(4)], ['Componente', result.componentStatus === 'within-component' ? 'Dentro de este componente' : 'Fuera de este componente'], ['Conclusión', 'No concluyente']], 140);
    layout.text(result.check.equation);
    layout.table([{ header: 'Variable', width: 65 }, { header: 'Valor', width: 100 }, { header: 'Unidad', width: 70 }, { header: 'Procedencia', flex: 1 }], result.substitutions.map((v) => [v.symbol, String(v.value), v.unit, v.source]));
    layout.heading('Fuente y trazabilidad', 3);
    layout.keyValues([['Norma', result.standard.title], ['Cláusula', result.check.clause], ['Página PDF / impresa', `${result.standard.pdfPage} / ${result.standard.printedPage}`], ['Fuente oficial', result.standard.sourceUrl], ['SHA-256 de la fuente', result.standard.sourceSha256], ['Motor / versión', `${result.module.id} / ${result.module.version}`]], 140);
    layout.heading('Hipótesis', 3);
    result.assumptions.forEach((note) => layout.text(note));
    layout.heading('Comprobaciones pendientes y límites', 3);
    layout.text('Fractura neta, conexiones, compresión/pandeo, flexión/cortante e interacciones no evaluadas.');
    result.limitations.forEach((note) => layout.text(note));
  }
  if (summary.skipped.length) {
    layout.heading('Barras no evaluadas');
    layout.table([{ header: 'Barra', width: 100 }, { header: 'Bloqueos del motor', flex: 1 }], summary.skipped.map((s) => [s.memberId, s.blockers.join(', ')]));
  }
  layout.stampChrome(report.projectName, 'FStructure · Acero · No concluyente');
  await pdf.attach(new TextEncoder().encode(JSON.stringify({ model: report.model, selection: { memberIds: [...(summary.status === 'available' ? summary.results.map((r) => r.subject.memberId) : []), ...summary.skipped.map((s) => s.memberId)] }, combinationId: report.combination.id, summary: report.summary }, null, 2)), 'revision-acero.json', { mimeType: 'application/json', description: 'Modelo y revisión derivados al exportar; no modifica el proyecto local.' });
  return pdf.save();
}
