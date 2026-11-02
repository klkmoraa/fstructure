/**
 * What the Portal and Cantilever methods leave out, said in the report before their numbers.
 *
 * Both methods distribute lateral load only. When the combination also carries gravity — and a
 * building frame always does — the method still applies, but the reader has to be told, in so
 * many words, which actions were not distributed and that their effect is obtained separately
 * and superposed. A table of column moments without that sentence would read as the design
 * moments of the frame, which it is not.
 */
import type { ExcludedAction, LateralConversion } from '../../analysis-methods/lateralActions';
import { asWorkedEquation, drawWorkedEquation, measureWorkedEquation, type EquationInput } from './pdfEquation';
import { number } from './pdfFormat';
import { dimensionalFigure, dimensionalUnit } from './pdfSubstitution';
import type { ReportContext } from './reportContext';

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

/** One paragraph and a list: what was left out, and that it has to be superposed. */
export const drawLateralScope = (context: ReportContext, excluded: readonly ExcludedAction[], methodName: string): void => {
  const { layout } = context;
  if (!excluded.length) {
    layout.text(
      `Esta combinación sólo lleva carga lateral: el ${methodName} la reparte entera y no queda ninguna `
      + 'acción vertical que superponer.',
      8.3, layout.fonts.regular, undefined, 8,
    );
    return;
  }
  layout.text(
    `El ${methodName} reparte sólo la carga lateral en los nudos. Las acciones siguientes de esta combinación quedan `
    + 'fuera de este análisis: ninguna empuja el pórtico de lado en esta idealización (las vigas llevan su carga a las '
    + 'columnas como fuerzas verticales, y las columnas la transmiten a lo largo de su eje). No se pierden: su efecto se '
    + 'obtiene aparte, con un análisis de cargas verticales —Cross en marcos o el análisis matricial— y se superpone al de '
    + 'esta sección.',
    8.3, layout.fonts.regular, undefined, 8,
  );
  layout.bullets(GROUPS.flatMap(({ kind, label }) => {
    const actions = excluded.filter((action) => action.kind === kind);
    if (!actions.length) return [];
    if (kind === 'self-weight') return [`${label}: ${actions.map((action) => `factor ${number(action.factor, 4)}`).join(', ')}.`];
    return [`${label}: ${actions.map(describe).join('; ')}.`];
  }));
  layout.text(
    'Por eso cortantes, momentos y axiales de las tablas siguientes son sólo los de la carga lateral; los de la '
    + 'combinación completa son su suma con los del análisis vertical.',
    8.3, layout.fonts.bold, layout.palette.ink, 8,
  );
};

const drawEquations = (context: ReportContext, caption: string, equations: readonly EquationInput[]): void => {
  const { layout } = context;
  layout.text(caption, 7.9, layout.fonts.bold, layout.palette.ink, 12);
  for (const input of equations) {
    const equation = asWorkedEquation(input);
    layout.ensure(measureWorkedEquation(layout, equation, 8.4, 16));
    layout.y -= drawWorkedEquation(layout, equation, 8.4, 16, layout.rgb(0.24, 0.28, 0.34), `(${layout.nextEquationNumber()})`);
  }
};

/**
 * Horizontal loads on the columns, turned into joint loads at the levels — said, and worked with
 * this model's numbers, before the storey shears that carry them.
 */
export const drawLateralConversions = (
  context: ReportContext,
  conversions: readonly LateralConversion[],
  jointLoads: ReadonlyMap<string, number>,
  methodName: string,
): void => {
  if (!conversions.length) return;
  const { layout, project } = context;
  const fig = (value: number, forcePower: number, lengthPower: number, reference = value) => dimensionalFigure(project, value, forcePower, lengthPower, reference);
  const unit = (forcePower: number, lengthPower: number) => dimensionalUnit(project, forcePower, lengthPower);
  layout.text(
    `Cargas laterales sobre las columnas. El ${methodName} sólo reparte fuerzas aplicadas en los niveles, así que cada carga `
    + 'horizontal sobre un tramo de columna se convierte en dos fuerzas equivalentes en los nudos de sus extremos: el tramo '
    + 'se lee como una viga simplemente apoyada entre sus dos niveles y su resultante W, a la altura z̄ sobre el nivel '
    + 'inferior, se reparte por estática: W·z̄/h al nivel superior y el resto al inferior. Lo que cae en el nivel de la '
    + 'cimentación pasa directo al apoyo.',
    8.3, layout.fonts.regular, undefined, 8,
  );
  layout.text(
    'Este reparto es parte de la aproximación: dentro de la columna cargada el cortante y el momento no son los de esta '
    + 'idealización, y la comparación con el análisis matricial se hace con la carga real sobre la columna, así que la '
    + 'diferencia que se declara al final también lo incluye.',
    8.3, layout.fonts.bold, layout.palette.ink, 8,
  );
  for (const conversion of conversions) {
    const factor = conversion.factor !== 1 ? `, factor ${number(conversion.factor, 4)}` : '';
    const h = fig(conversion.height, 0, 1);
    const reference = Math.max(Math.abs(conversion.resultant), Math.abs(conversion.toTop), Math.abs(conversion.toBottom), 1e-9);
    const equations: EquationInput[] = [];
    if (conversion.kind === 'point') {
      equations.push(
        { lhs: 'W', result: fig(conversion.resultant, 1, 0, reference), unit: unit(1, 0) },
        { lhs: 'z̄', result: fig(conversion.from, 0, 1), unit: unit(0, 1) },
      );
    } else {
      const q1 = fig(conversion.intensityLow ?? 0, 1, -1);
      const q2 = fig(conversion.intensityHigh ?? 0, 1, -1);
      const span = `(${fig(conversion.to, 0, 1)} − ${fig(conversion.from, 0, 1)})`;
      equations.push({
        lhs: 'W', symbolic: '(q_1 + q_2)/2 · (z_2 − z_1)',
        substituted: `((${q1}) + (${q2}))/2 · ${span}`,
        result: fig(conversion.resultant, 1, 0, reference), unit: unit(1, 0),
      });
      if (conversion.centroid !== undefined) {
        equations.push({
          lhs: 'z̄', symbolic: '∫ q z dz / W',
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
        lhs: `F(${conversion.bottomNodeId})`, symbolic: 'W − W z̄/h',
        substituted: `${fig(conversion.resultant, 1, 0, reference)} − (${fig(conversion.toTop, 1, 0, reference)})`,
        result: fig(conversion.toBottom, 1, 0, reference), unit: unit(1, 0),
      },
    );
    const what = conversion.kind === 'point'
      ? `puntual a z = ${fig(conversion.from, 0, 1)} ${unit(0, 1)}`
      : `repartida de ${fig(conversion.intensityLow ?? 0, 1, -1)} a ${fig(conversion.intensityHigh ?? 0, 1, -1)} ${unit(1, -1)} `
        + `entre z = ${fig(conversion.from, 0, 1)} y ${fig(conversion.to, 0, 1)} ${unit(0, 1)}`;
    drawEquations(context, `Carga ${conversion.loadId} sobre la columna ${conversion.memberId} (entrepiso ${conversion.story}, `
      + `h = ${h} ${unit(0, 1)}, de ${conversion.bottomNodeId} a ${conversion.topNodeId}): ${what}${factor}. Horizontal, +x positiva.`, equations);
  }
  const loads = [...jointLoads].filter(([, value]) => value !== 0);
  if (loads.length) {
    layout.text(
      `Fuerza lateral en cada nudo tras la conversión, que es la que el método reparte: ${loads
        .map(([nodeId, value]) => `${nodeId}: ${fig(value, 1, 0)} ${unit(1, 0)}`).join('; ')}.`,
      8.3, layout.fonts.regular, undefined, 8,
    );
  }
};
