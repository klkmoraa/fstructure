/**
 * Piezas comunes del Método del Portal y del Método del Voladizo: lo que no reparten (dicho antes
 * de sus números), la conversión de las cargas laterales sobre columnas en cargas de nudo, los
 * datos de la retícula y el contraste de la base con el análisis matricial.
 *
 * Los dos métodos reparten sólo carga lateral. Cuando la combinación también lleva gravedad
 * —y la de un edificio siempre la lleva— el método sigue aplicando, pero hay que decir qué
 * acciones no se repartieron y que su efecto se superpone: una tabla de momentos de columna sin
 * esa frase se leería como los momentos de diseño del marco, y no lo son.
 */
import type { FrameGrid } from '../../analysis-methods/frameGeometry';
import type { ExcludedAction, LateralConversion } from '../../analysis-methods/lateralActions';
import type { EquationInput } from './pdfEquation';
import { number, unitFor } from './pdfFormat';
import { memoirCheck, memoirFormula, memoirNote, memoirResults, memoirStep, memoirWork } from './pdfMemoirKit';
import { dimensionalFigure, dimensionalUnit } from './pdfSubstitution';
import { TYPE } from './pdfTheme';
import type { PdfTableColumn } from './pdfBuilder';
import type { ReportContext } from './reportContext';

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };

/** Eje de columnas: A, B, C… de izquierda a derecha. */
export const lineLabel = (index: number): string => String.fromCharCode(65 + index);

const GROUPS: ReadonlyArray<{ kind: ExcludedAction['kind']; label: string }> = [
  { kind: 'beam-gravity', label: 'Cargas verticales sobre las vigas' },
  { kind: 'column-axial', label: 'Cargas a lo largo del eje de las columnas' },
  { kind: 'self-weight', label: 'Peso propio de las barras' },
  { kind: 'nodal-vertical', label: 'Componente vertical de las cargas en nudos' },
  { kind: 'nodal-moment', label: 'Momentos aplicados en nudos' },
  { kind: 'initial-effect', label: 'Efectos iniciales (temperatura o deformación impuesta)' },
  { kind: 'imposed-displacement', label: 'Desplazamientos impuestos en apoyos' },
];

const describe = (action: ExcludedAction): string => {
  const where = action.memberId ?? action.nodeId;
  const factor = action.factor !== 1 ? `factor ${number(action.factor, 4)}` : '';
  const detail = [where, factor].filter(Boolean).join(', ');
  return detail ? `${action.loadId} (${detail})` : action.loadId;
};

/** Una comprobación en un renglón: la primera redacción que cabe a lo ancho de la página. */
const checkLine = (context: ReportContext, variants: readonly string[], ok: boolean): void => {
  const { layout } = context;
  const prefix = ok ? 'Comprobación: ' : 'Comprobación (revisar): ';
  const fits = (text: string) => layout.richWidth(prefix + text, layout.fonts.bold, TYPE.body) <= layout.contentWidth;
  memoirCheck(context, variants.find(fits) ?? variants[variants.length - 1], ok);
};

/** Lo que el método deja fuera, y que su efecto se superpone. */
export const drawLateralScope = (context: ReportContext, excluded: readonly ExcludedAction[], methodName: string): void => {
  const { layout } = context;
  if (!excluded.length) {
    memoirNote(context, `La combinación sólo lleva carga lateral: el ${methodName} la reparte entera.`);
    return;
  }
  memoirNote(context, `El ${methodName} reparte sólo la carga lateral. Estas acciones quedan fuera de este análisis; su efecto se `
    + 'obtiene aparte (Cross o análisis matricial) y se superpone:');
  layout.bullets(GROUPS.flatMap(({ kind, label }) => {
    const actions = excluded.filter((action) => action.kind === kind);
    if (!actions.length) return [];
    if (kind === 'self-weight') return [`${label}: ${actions.map((action) => `factor ${number(action.factor, 4)}`).join(', ')}.`];
    return [`${label}: ${actions.map(describe).join('; ')}.`];
  }));
  layout.text('Los esfuerzos de esta sección son sólo los de la carga lateral.', TYPE.body, layout.fonts.bold, layout.palette.ink);
};

/**
 * Cargas horizontales sobre las columnas, llevadas a los nudos de sus niveles, con los números
 * del modelo, antes de los cortantes de planta que las reciben.
 */
export const drawLateralConversions = (
  context: ReportContext,
  conversions: readonly LateralConversion[],
  jointLoads: ReadonlyMap<string, number>,
): void => {
  if (!conversions.length) return;
  const { layout, project } = context;
  const fig = (value: number, forcePower: number, lengthPower: number, reference = value) => dimensionalFigure(project, value, forcePower, lengthPower, reference);
  const unit = (forcePower: number, lengthPower: number) => dimensionalUnit(project, forcePower, lengthPower);
  memoirNote(context, 'Cargas laterales sobre las columnas: el tramo cargado se toma como viga simplemente apoyada entre sus dos '
    + 'niveles y su resultante pasa a los nudos por estática.');
  memoirFormula(context, 'F_{sup} = W z̄/h,     F_{inf} = W − F_{sup}', [
    ['W, z̄', 'resultante de la carga del tramo y su altura sobre el nivel inferior'],
    ['h', 'altura del tramo de columna'],
  ]);
  for (const conversion of conversions) {
    const factor = conversion.factor !== 1 ? `, factor ${number(conversion.factor, 4)}` : '';
    const h = fig(conversion.height, 0, 1);
    const reference = Math.max(Math.abs(conversion.resultant), Math.abs(conversion.toTop), Math.abs(conversion.toBottom), 1e-9);
    const equations: EquationInput[] = [];
    if (conversion.kind === 'distributed') {
      const q1 = fig(conversion.intensityLow ?? 0, 1, -1);
      const q2 = fig(conversion.intensityHigh ?? 0, 1, -1);
      equations.push({
        lhs: 'W', symbolic: '(q_1 + q_2)/2 · (z_2 − z_1)',
        substituted: `((${q1}) + (${q2}))/2 · (${fig(conversion.to, 0, 1)} − ${fig(conversion.from, 0, 1)})`,
        result: fig(conversion.resultant, 1, 0, reference), unit: unit(1, 0),
      });
      if (conversion.centroid !== undefined) {
        equations.push({
          lhs: 'z̄', symbolic: '∫ q z dz/W',
          substituted: `(${fig(conversion.momentAboutBottom, 1, 1, reference)})/(${fig(conversion.resultant, 1, 0, reference)})`,
          result: fig(conversion.centroid, 0, 1), unit: unit(0, 1),
        });
      }
    }
    equations.push(
      {
        lhs: `F(${conversion.topNodeId})`, symbolic: 'W z̄/h',
        substituted: `(${fig(conversion.momentAboutBottom, 1, 1, reference)})/(${h})`,
        result: fig(conversion.toTop, 1, 0, reference), unit: unit(1, 0),
      },
      {
        lhs: `F(${conversion.bottomNodeId})`, symbolic: 'W − F_{sup}',
        substituted: `${fig(conversion.resultant, 1, 0, reference)} − (${fig(conversion.toTop, 1, 0, reference)})`,
        result: fig(conversion.toBottom, 1, 0, reference), unit: unit(1, 0),
      },
    );
    const what = conversion.kind === 'point'
      ? `W = ${fig(conversion.resultant, 1, 0, reference)} ${unit(1, 0)} a z̄ = ${fig(conversion.from, 0, 1)} ${unit(0, 1)}`
      : `repartida de ${fig(conversion.intensityLow ?? 0, 1, -1)} a ${fig(conversion.intensityHigh ?? 0, 1, -1)} ${unit(1, -1)} `
        + `entre z = ${fig(conversion.from, 0, 1)} y ${fig(conversion.to, 0, 1)} ${unit(0, 1)}`;
    context.layout.ensure(TYPE.small * 3 + TYPE.math * 4);
    memoirWork(context, equations, `Carga ${conversion.loadId} sobre la columna ${conversion.memberId} (${conversion.bottomNodeId} → `
      + `${conversion.topNodeId}, h = ${h} ${unit(0, 1)}): ${what}${factor}; +x positiva.`);
  }
  const loads = [...jointLoads].filter(([, value]) => value !== 0);
  if (loads.length) {
    memoirNote(context, 'Fuerza lateral en cada nudo tras la conversión, la que reparte el método:');
    layout.table(
      [{ header: 'Nudo', width: 90 }, { header: `F (${unit(1, 0)})`, ...NUMERIC }],
      loads.map(([nodeId, value]) => [nodeId, fig(value, 1, 0)]),
    );
  }
  memoirNote(context, 'Este reparto es parte de la aproximación: la comparación final usa la carga real sobre la columna.');
};

/** Fuerza lateral en un nivel de la retícula, tras la conversión. */
export const levelLoad = (grid: FrameGrid, jointLoads: ReadonlyMap<string, number>, level: number): number =>
  grid.nodeGrid.reduce((sum, line) => sum + (jointLoads.get(line[level]) ?? 0), 0);

/** Los datos de la retícula: cada planta con su altura y la fuerza lateral en su nivel superior. */
export const drawStoreyData = (context: ReportContext, grid: FrameGrid, jointLoads: ReadonlyMap<string, number>): void => {
  const { layout, project } = context;
  const lengthUnit = unitFor(project, 'length');
  const stories = grid.storyLevels.length - 1;
  const loads = Array.from({ length: stories }, (_, index) => levelLoad(grid, jointLoads, index + 1));
  const reference = Math.max(1e-9, ...loads.map((value) => Math.abs(value)));
  layout.table(
    [
      { header: 'Planta', width: 60 },
      { header: `Nivel superior z (${lengthUnit})`, ...NUMERIC },
      { header: `h (${lengthUnit})`, ...NUMERIC },
      { header: `F en el nivel (${unitFor(project, 'force')})`, ...NUMERIC },
    ],
    loads.map((load, index) => [
      String(index + 1),
      dimensionalFigure(project, grid.storyLevels[index + 1], 0, 1),
      dimensionalFigure(project, grid.storyLevels[index + 1] - grid.storyLevels[index], 0, 1),
      dimensionalFigure(project, load, 1, 0, reference),
    ]),
  );
};

interface BaseCheck {
  readonly columnIndex: number;
  readonly nodeId: string;
  readonly approxRx: number;
  readonly approxRy: number;
  readonly approxRm: number;
  readonly solverRx: number;
  readonly solverRy: number;
  readonly solverRm: number;
}

/**
 * Las reacciones de la base por el método (recuadro de resultados) y el contraste con el mismo
 * pórtico resuelto por análisis matricial sólo con la carga lateral: la diferencia es el precio
 * de la aproximación, dicho en cifras.
 */
export const drawLateralBaseCheck = (
  context: ReportContext,
  checks: readonly BaseCheck[],
  gap: { force: number; moment: number },
  shortName: string,
  step: string,
): void => {
  const { layout, project } = context;
  const forceUnit = unitFor(project, 'force');
  const momentUnit = unitFor(project, 'moment');
  const forceScale = Math.max(1e-9, ...checks.flatMap((check) => [Math.abs(check.solverRx), Math.abs(check.solverRy)]));
  const momentScale = Math.max(1e-9, ...checks.map((check) => Math.abs(check.solverRm)));
  const force = (value: number) => dimensionalFigure(project, value, 1, 0, forceScale);
  const moment = (value: number) => dimensionalFigure(project, value, 1, 1, momentScale);
  memoirResults(context, `Reacciones en la base por el ${shortName === 'Portal' ? 'Método del Portal' : 'Método del Voladizo'}`, checks.flatMap((check) => [
    [`R_x(${check.nodeId})`, `${force(check.approxRx)} ${forceUnit}`] as const,
    [`R_y(${check.nodeId})`, `${force(check.approxRy)} ${forceUnit}`] as const,
    [`M(${check.nodeId})`, `${moment(check.approxRm)} ${momentUnit}`] as const,
  ]));

  memoirStep(context, step);
  memoirNote(context, 'Referencia: el mismo pórtico sólo con la carga lateral, por análisis matricial.');
  layout.table(
    [
      { header: 'Base', width: 54 },
      { header: `R_x ${shortName} (${forceUnit})`, ...NUMERIC },
      { header: `R_x mat. (${forceUnit})`, ...NUMERIC },
      { header: `R_y ${shortName} (${forceUnit})`, ...NUMERIC },
      { header: `R_y mat. (${forceUnit})`, ...NUMERIC },
      { header: `M ${shortName} (${momentUnit})`, ...NUMERIC },
      { header: `M mat. (${momentUnit})`, ...NUMERIC },
    ],
    checks.map((check) => [
      `${lineLabel(check.columnIndex)} (${check.nodeId})`,
      force(check.approxRx),
      force(check.solverRx),
      force(check.approxRy),
      force(check.solverRy),
      moment(check.approxRm),
      moment(check.solverRm),
    ]),
  );
  const relativeForce = gap.force / forceScale;
  const relativeMoment = gap.moment / momentScale;
  const forceGap = `${dimensionalFigure(project, gap.force, 1, 0, 1)} ${forceUnit}`;
  const momentGap = `${dimensionalFigure(project, gap.moment, 1, 1, 1)} ${momentUnit}`;
  // An approximate method is not expected to match; the line turns amber past a quarter of the largest reaction.
  checkLine(context, [
    `reacciones en la base, diferencia máxima ${forceGap} (${number(100 * relativeForce, 3)} % de la mayor).`,
    `reacciones, diferencia máx. ${forceGap} (${number(100 * relativeForce, 3)} %).`,
  ], relativeForce <= 0.25);
  checkLine(context, [
    `momentos en la base, diferencia máxima ${momentGap} (${number(100 * relativeMoment, 3)} % del mayor).`,
    `momentos, diferencia máx. ${momentGap} (${number(100 * relativeMoment, 3)} %).`,
  ], relativeMoment <= 0.25);
};
