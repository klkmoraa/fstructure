/**
 * Resultados del análisis en una lectura: cifras que gobiernan, cuerpo libre con reacciones,
 * diagramas N, V y M, equilibrio global desarrollado, reacciones y calidad numérica.
 *
 * Todo fluye con el texto: la tabla de reacciones lleva todos los apoyos y las sumas de
 * equilibrio se escriben completas, aunque el modelo sea grande.
 */
import type { DiagramQuantity } from '../../types';
import { resolveNumericQualityState } from '../../engine/reliability';
import { clearCell, clearDisplay, clearNumber, display, unitFor } from './pdfFormat';
import { memoirNote, memoirWork } from './pdfMemoirKit';
import { drawGlobalDcl } from './pdfDiagrams';
import { drawResultDiagram, quantityExtreme } from './pdfResultDiagrams';
import { equilibriumSums } from './pdfSubstitution';
import { TYPE } from './pdfTheme';
import type { PdfTableColumn } from './pdfBuilder';
import type { ReportContext } from './reportContext';

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };

/** La formulación del análisis, en palabras. */
export const formulationLabel = (formulation: string | undefined): string => formulation === 'linear-static-mixed-beam'
  ? 'estático lineal, Euler–Bernoulli y Timoshenko'
  : formulation === 'linear-static-euler-bernoulli' ? 'estático lineal, Euler–Bernoulli' : 'estático lineal 2D';

/** Largest |value| of a quantity across the model, preferring the engine's critical points. */
const absoluteExtreme = (
  context: ReportContext,
  quantity: DiagramQuantity,
): { value: number; memberId: string; x: number } | undefined => {
  let best: { value: number; memberId: string; x: number } | undefined;
  for (const result of context.analysis.memberResults) {
    const critical = result.criticalPoints.filter((point) => point.quantity === quantity);
    const candidates = critical.length
      ? critical.map((point) => ({ value: point.value, memberId: result.memberId, x: point.x }))
      : result.diagram.map((point) => ({ value: point[quantity], memberId: result.memberId, x: point.x }));
    for (const candidate of candidates) {
      if (!best || Math.abs(candidate.value) > Math.abs(best.value)) best = candidate;
    }
  }
  return best;
};

export const drawSummaryPart = (context: ReportContext): void => {
  const { layout, project, analysis } = context;
  const { palette, fonts } = layout;

  layout.part('Resultados del análisis', 'Cifras gobernantes, cuerpo libre con reacciones, diagramas N, V y M, equilibrio y calidad numérica.');

  const axial = absoluteExtreme(context, 'axial');
  const shear = absoluteExtreme(context, 'shear');
  const moment = absoluteExtreme(context, 'moment');
  const reactionMaximum = analysis.nodeResults.reduce(
    (best, result) => Math.max(best, Math.abs(result.rx), Math.abs(result.ry)),
    0,
  );

  const station = (entry: typeof axial): string | undefined =>
    entry ? `${entry.memberId} · x = ${display(project, entry.x, 'length')}` : undefined;

  layout.metrics([
    {
      label: 'Reacción máxima',
      value: clearDisplay(project, reactionMaximum, 'force', reactionMaximum),
      detail: `${analysis.nodeResults.filter((node) => Math.abs(node.rx) + Math.abs(node.ry) + Math.abs(node.rm) > 0).length} apoyos con reacción`,
      color: palette.reaction,
    },
    {
      label: '|N| máximo',
      value: axial ? clearDisplay(project, Math.abs(axial.value), 'force', Math.abs(axial.value)) : 'n/d',
      detail: station(axial),
      color: palette.quantity.axial,
    },
    {
      label: '|V| máximo',
      value: shear ? clearDisplay(project, Math.abs(shear.value), 'force', Math.abs(shear.value)) : 'n/d',
      detail: station(shear),
      color: palette.quantity.shear,
    },
    {
      label: '|M| máximo',
      value: moment ? clearDisplay(project, Math.abs(moment.value), 'moment', Math.abs(moment.value)) : 'n/d',
      detail: station(moment),
      color: palette.quantity.moment,
    },
  ]);

  layout.figure(
    206,
    (rect) => drawGlobalDcl(context, rect, true),
    'Diagrama de cuerpo libre: geometría, apoyos, acciones aplicadas y reacciones obtenidas.',
  );

  // Diagramas de fuerzas internas: la respuesta entera de un vistazo, antes de los números.
  const diagramHeight = Math.min(230, Math.max(170, layout.contentWidth * 0.42));
  const quantities = (['axial', 'shear', 'moment'] as const).filter((quantity) => quantityExtreme(context, quantity) > 1e-9
    && (quantity === 'axial' || project.members.some((member) => member.type !== 'truss')));
  if (quantities.length) {
    layout.heading('Diagramas de fuerzas internas');
    const names = { axial: 'fuerza axial N (+ tensión)', shear: 'fuerza cortante V', moment: 'momento flector M' } as const;
    for (const quantity of quantities) {
      layout.figure(
        diagramHeight,
        (rect) => drawResultDiagram(context, rect, quantity),
        `Diagrama de ${names[quantity]} en ${unitFor(project, quantity === 'moment' ? 'moment' : 'force')}; misma escala en todas las barras, `
        + 'positivo a la izquierda de cada barra (de i a j).',
      );
    }
  }

  layout.heading('Equilibrio global');
  memoirNote(context, 'Se suman la resultante de las cargas y, término a término, la reacción de cada apoyo.');
  memoirWork(context, equilibriumSums(context).map((sum) => sum.worked));
  layout.table([
    { header: 'Residuo del cierre', ...NUMERIC },
    { header: 'Residuo del sistema', ...NUMERIC },
    { header: 'Número de condición', ...NUMERIC },
  ], [[clearNumber(analysis.equilibrium.normalizedResidual), clearNumber(analysis.residualNorm), clearNumber(analysis.conditionEstimate)]]);

  layout.heading('Reacciones en los apoyos');
  const supported = analysis.nodeResults.filter((node) => Math.abs(node.rx) + Math.abs(node.ry) + Math.abs(node.rm) > 1e-10);
  if (!supported.length) {
    layout.note('El modelo no reporta ninguna reacción distinta de cero.');
  } else {
    const momentReference = moment ? Math.abs(moment.value) : 1;
    const withMoments = supported.some((node) => Math.abs(node.rm) > 0) || project.members.some((member) => member.type !== 'truss');
    layout.table([
      { header: 'Apoyo', width: 70 },
      { header: `R_x (${unitFor(project, 'force')})`, ...NUMERIC },
      { header: `R_y (${unitFor(project, 'force')})`, ...NUMERIC },
      ...(withMoments ? [{ header: `M (${unitFor(project, 'moment')})`, ...NUMERIC }] : []),
    ], supported.map((node) => [
      node.nodeId,
      clearCell(project, node.rx, 'force', reactionMaximum),
      clearCell(project, node.ry, 'force', reactionMaximum),
      ...(withMoments ? [clearCell(project, node.rm, 'moment', momentReference)] : []),
    ]));
  }

  const quality = resolveNumericQualityState(analysis);
  const qualityLabel = {
    stable: 'estable',
    limited: 'limitada',
    unreliable: 'no confiable',
    failed: 'fallida',
    unavailable: 'no disponible',
  }[quality];
  const tone = quality === 'stable' ? 'ok' : quality === 'limited' ? 'warn' : 'danger';
  layout.callout(
    tone,
    `Calidad numérica: ${qualityLabel}`,
    `Número de condición estimado ${clearNumber(analysis.conditionEstimate)}; residuo lineal `
    + `${clearNumber(analysis.linearResidual ?? analysis.residualNorm)}; cota de error `
    + `${clearNumber(analysis.forwardErrorBound ?? Number.NaN)}. Mide la fiabilidad de la aritmética, `
    + 'no la seguridad de la estructura.',
  );

  layout.heading('Hipótesis del análisis', 2);
  layout.text(
    `${analysis.pDelta?.experimental ? 'P-Delta experimental; ' : ''}Análisis ${formulationLabel(analysis.educationTrace?.formulation)}; `
    + 'pequeñas deformaciones; propiedades constantes en cada barra.',
    TYPE.small,
    fonts.regular,
    palette.inkSoft,
  );
};
