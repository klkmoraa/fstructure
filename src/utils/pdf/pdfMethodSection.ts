/**
 * The chosen solution method, written out with this project's own numbers.
 *
 * Section 5 used to state the matrix method's generic relations and stop there: true, but not
 * a procedure anyone could follow to this beam. When a method is selected, this section takes
 * its place and develops it the way a textbook does — static classification, redundants,
 * moment per stretch, the two integrations, the conditions that close the system, the solved
 * constants, the reactions checked against the solver, and the elastic curve.
 *
 * Every figure printed here was solved by `src/analysis-methods/`, and every one of them is
 * required to agree with the analysis the rest of the document reports. The verification row
 * is not decoration: it is the reader's evidence that the two paths met.
 */
import { solveCantileverMethod, type CantileverMethodResult } from '../../analysis-methods/cantileverMethod';
import { solveDoubleIntegration, type DoubleIntegrationResult } from '../../analysis-methods/doubleIntegration';
import { solveConjugateBeam, type ConjugateBeamResult, type ConjugateSupportKind } from '../../analysis-methods/conjugateBeam';
import { solveThreeMoment, type ThreeMomentResult } from '../../analysis-methods/threeMoment';
import { solveHardyCross, type HardyCrossResult } from '../../analysis-methods/hardyCross';
import { solveKaniFrame, type KaniResult } from '../../analysis-methods/kaniFrame';
import { solvePortalMethod, type PortalMethodResult } from '../../analysis-methods/portalMethod';
import { solveVirtualWork, type VirtualWorkResult } from '../../analysis-methods/virtualWork';
import { solveMethodOfSections, type MethodOfSectionsResult } from '../../analysis-methods/methodOfSections';
import { solveMethodOfJoints, type MethodOfJointsResult } from '../../analysis-methods/methodOfJoints';
import { solveCastiglianoTruss, type CastiglianoTrussResult } from '../../analysis-methods/castiglianoTruss';
import { solveMomentDistributionFrame } from '../../analysis-methods/momentDistributionFrame';
import { solveStaticsSections } from '../../analysis-methods/staticsSections';
import { drawStaticsSections } from './pdfMethodStaticsSections';
import { solveArchLeastWork } from '../../analysis-methods/archLeastWork';
import { drawArchLeastWorkSection } from './pdfMethodArchLeastWork';
import { drawElasticCurve } from './pdfDiagrams';
import { drawCrossFrameSection } from './pdfMethodCrossFrame';
import { drawLateralBaseCheck, drawLateralConversions, drawLateralScope, drawStoreyData, levelLoad, lineLabel } from './pdfMethodLateralScope';
import { drawFreeBodyScene, sceneHeightFor, type FreeBodyScene } from './pdfFreeBody';
import {
  cantileverScenes,
  castiglianoScenes,
  conjugateBeamScenes,
  doubleIntegrationScenes,
  hardyCrossScenes,
  jointScenes,
  kaniScenes,
  portalScenes,
  sectionCutScenes,
  threeMomentScenes,
  virtualWorkScenes,
} from './pdfMethodScenes';
import { clearNumber, displayCell, number, unitFor } from './pdfFormat';
import {
  agrees,
  dimensionalFigure,
  dimensionalUnit,
  dimensionalValue,
  freeBodyEquations,
  signedSum,
} from './pdfSubstitution';
import { pdfText } from './pdfGlyphs';
import { memoirCheck, memoirFormula, memoirNote, memoirResults, memoirStep, memoirWork } from './pdfMemoirKit';
import { asWorkedEquation, drawWorkedEquation, measureWorkedEquation, type EquationInput } from './pdfEquation';
import type { PdfTableColumn, PdfTableOptions } from './pdfBuilder';
import type { ReportContext } from './reportContext';
import { TYPE } from './pdfTheme';
import { SOLUTION_METHODS, applicableMethods, type SolutionMethodId } from '../../analysis-methods/methodRegistry';
import type { AnalysisResult, LoadCombination, ProjectModel } from '../../types';

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };

/** Height of a free-body figure. Tall enough for a truss, short enough that two share a page. */
const SCENE_HEIGHT = 186;

type PdfMethodAvailability = Record<SolutionMethodId, { available: boolean; reasonKey?: string }>;

/**
 * Applies the same load-aware checks as the actual procedure renderer. Geometry alone is not
 * enough for Kani, Portal, Cantilever, the continuous-beam procedures, or truss statics.
 */
export const inspectPdfMethodAvailability = (
  project: ProjectModel,
  analysis: AnalysisResult,
  combination: LoadCombination,
): PdfMethodAvailability => {
  const shallow = new Set(applicableMethods(project).map((method) => method.id));
  const availability = Object.fromEntries(SOLUTION_METHODS.map((method) => [
    method.id,
    method.id === 'matrix-stiffness'
      ? { available: true }
      : { available: false, reasonKey: 'method.unavailableForModel' },
  ])) as PdfMethodAvailability;

  const inspect = (method: SolutionMethodId, outcome: { applicable: boolean; reasonKey?: string }) => {
    availability[method] = outcome.applicable
      ? { available: true }
      : { available: false, reasonKey: outcome.reasonKey ?? 'method.unavailableForModel' };
  };
  if (shallow.has('double-integration')) inspect('double-integration', solveDoubleIntegration(project, analysis, combination));
  if (shallow.has('conjugate-beam')) inspect('conjugate-beam', solveConjugateBeam(project, analysis, combination));
  if (shallow.has('three-moment')) inspect('three-moment', solveThreeMoment(project, analysis, combination));
  if (shallow.has('hardy-cross')) inspect('hardy-cross', solveHardyCross(project, analysis, combination));
  if (shallow.has('portal-method')) inspect('portal-method', solvePortalMethod(project, combination));
  if (shallow.has('cantilever-method')) inspect('cantilever-method', solveCantileverMethod(project, combination));
  if (shallow.has('kani-frame')) inspect('kani-frame', solveKaniFrame(project, analysis, combination));
  if (shallow.has('virtual-work')) inspect('virtual-work', solveVirtualWork(project, analysis, combination));
  if (shallow.has('method-of-sections')) inspect('method-of-sections', solveMethodOfSections(project, analysis, combination));
  if (shallow.has('method-of-joints')) inspect('method-of-joints', solveMethodOfJoints(project, analysis, combination));
  if (shallow.has('castigliano-truss')) inspect('castigliano-truss', solveCastiglianoTruss(project, analysis, combination));
  if (shallow.has('moment-distribution-frame')) inspect('moment-distribution-frame', solveMomentDistributionFrame(project, analysis, combination));
  if (shallow.has('statics-sections')) inspect('statics-sections', solveStaticsSections(project, analysis, combination));
  if (shallow.has('arch-least-work')) inspect('arch-least-work', solveArchLeastWork(project, analysis, combination));
  return availability;
};

/**
 * Draws the free bodies of one method step, or nothing when the reader dropped them.
 *
 * Every scene goes through `layout.figure`, so it is numbered, captioned and page-broken by the
 * same primitive as every other drawing in the document — a method figure can be referred to
 * from the prose exactly like the free-body diagram of part one.
 */
export const drawScenes = (
  context: ReportContext,
  scenes: readonly FreeBodyScene[],
  caption: (scene: FreeBodyScene, index: number) => string,
): void => {
  if (context.options.includeMethodFreeBodies === false) return;
  for (const [index, scene] of scenes.entries()) {
    context.layout.figure(
      sceneHeightFor(context, SCENE_HEIGHT),
      (rect) => drawFreeBodyScene(context, rect, scene),
      caption(scene, index),
    );
  }
};

/** `32.5 − 5x + 0.5x²` from coefficient array, in the global axis variable. */
const expression = (coefficients: readonly number[], variable = 'x'): string => {
  const reference = coefficients.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);
  const terms: string[] = [];
  coefficients.forEach((coefficient, power) => {
    if (Math.abs(coefficient) <= Math.max(reference, 1) * 1e-10) return;
    const magnitude = clearNumber(Math.abs(coefficient), Math.max(reference, 1), 5);
    const factor = power === 0 ? magnitude : power === 1 ? `${magnitude} ${variable}` : `${magnitude} ${variable}^${power}`;
    const sign = coefficient < 0 ? '−' : '+';
    terms.push(terms.length === 0 ? `${coefficient < 0 ? '−' : ''}${factor}` : `${sign} ${factor}`);
  });
  return terms.join(' ') || '0';
};

/**
 * A worked block: the caption naming what the arithmetic belongs to, then the numbered
 * display equations. Every method section reaches for this, so that "the real calculation"
 * looks the same wherever the reader finds it.
 */
export const drawWorked = (context: ReportContext, caption: string | undefined, equations: readonly EquationInput[]): void => {
  if (!equations.length) return;
  const { layout } = context;
  if (caption) layout.text(caption, 7.9, layout.fonts.bold, layout.palette.ink, 12);
  for (const input of equations) {
    const equation = asWorkedEquation(input);
    layout.ensure(measureWorkedEquation(layout, equation, TYPE.math, 16));
    layout.y -= drawWorkedEquation(layout, equation, TYPE.math, 16, layout.palette.ink, `(${layout.nextEquationNumber()})`);
  }
};

/** A single relation drawn the same way, for the sections that write one at a time. */
export const drawRelation = (context: ReportContext, equation: EquationInput): void => {
  const { layout } = context;
  const worked = asWorkedEquation(equation);
  layout.ensure(measureWorkedEquation(layout, worked, TYPE.math, 16));
  layout.y -= drawWorkedEquation(layout, worked, TYPE.math, 16, layout.palette.ink, `(${layout.nextEquationNumber()})`);
};

/**
 * Datos del método. Sin fórmulas son una tabla: cada fila un nudo, un tramo o una condición, y
 * cada columna se compara de un vistazo (antes cada dato ocupaba dos renglones y una condición
 * de cuatro valores llenaba media página). Con fórmulas, cada fila es un bloque compacto: el
 * identificador, los datos cortos en una línea y cada relación en la suya, alineada.
 */
const drawCalculationRecords = (
  context: ReportContext,
  columns: readonly PdfTableColumn[],
  rows: readonly (readonly string[])[],
  options: PdfTableOptions = {},
): void => {
  if (!columns.length || !rows.length) return;
  const { layout } = context;
  const size = options.size ?? TYPE.small;
  const indent = options.indent ?? 0;
  if (!columns.some((column) => column.math)) {
    layout.table(columns, rows, { ...options, size });
    return;
  }
  for (const row of rows) {
    layout.ensure(size * 5);
    layout.text(`${columns[0]?.header ?? 'Dato'}: ${row[0] ?? '—'}`, size + 0.6, layout.fonts.bold, layout.palette.ink, indent);
    const facts = columns.slice(1).flatMap((column, offset) => column.math ? [] : [`${column.header}: ${String(row[offset + 1] ?? '—')}`]);
    if (facts.length) layout.text(facts.join('   ·   '), size, layout.fonts.regular, layout.palette.inkSoft, indent + 12);
    columns.forEach((column, index) => {
      if (!column.math || index === 0) return;
      const value = String(row[index] ?? '—');
      const relation = value.includes('=') ? value : `${column.header} = ${value}`;
      layout.ensure(layout.measureMathBlock(relation, size + 0.6, indent + 12));
      layout.y -= layout.drawMathBlockAt(relation, size + 0.6, indent + 12, layout.palette.ink);
    });
    layout.gap(2);
  }
};

/**
 * Both approximate frame methods close a beam the same way: the two end moments over the span.
 * The quotient is printed only where it really returns the shear the method reported, so a
 * beam whose ends were resolved by some other route never gets a made-up derivation.
 */
interface ApproximateBeam {
  readonly bayIndex: number;
  readonly story: number;
  readonly span: number;
  readonly moment: number;
  readonly shear: number;
}

const beamShearEquations = (
  context: ReportContext,
  beams: readonly ApproximateBeam[],
  lineLabel: (index: number) => string,
): EquationInput[] => {
  const { project } = context;
  const scale = Math.max(1, ...beams.map((beam) => Math.abs(beam.shear)));
  return beams.flatMap((beam) => {
    if (!(beam.span > 0)) return [];
    const derived = 2 * beam.moment / beam.span;
    if (!agrees(Math.abs(derived), Math.abs(beam.shear), scale)) return [];
    return [{
      lhs: `V(${lineLabel(beam.bayIndex)}–${lineLabel(beam.bayIndex + 1)}, planta ${beam.story})`,
      symbolic: '2M/L',
      substituted: `2(${dimensionalFigure(project, Math.abs(beam.moment), 1, 1)})/(${dimensionalFigure(project, beam.span, 0, 1)})`,
      result: dimensionalFigure(project, Math.abs(beam.shear), 1, 0, scale),
      unit: unitFor(project, 'force'),
    }];
  });
};

// ---------------------------------------------------------------------------------------
// Elástica por tramos: doble integración y viga conjugada comparten la escritura.
// ---------------------------------------------------------------------------------------

type Dimension = readonly [force: number, length: number];

/** Horner, para leer un polinomio de la elástica en un punto. */
const valueAt = (coefficients: readonly number[], x: number): number =>
  coefficients.reduceRight((total, coefficient) => total * x + coefficient, 0);

/** Una cifra de tabla con el signo menos tipográfico, como en las fórmulas. */
const cellText = (text: string): string => text.replace(/^-(?=[\d.])/, '−');

/** Dos lecturas de la misma cifra: iguales salvo el redondeo de la máquina. */
const closeTo = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-6 * Math.max(Math.abs(a), Math.abs(b)) + 1e-15;

/** `x_1`, `x_{12}`: índice de tramo listo para la notación del kit. */
const stretchIndex = (k: number): string => (k + 1 < 10 ? `${k + 1}` : `{${k + 1}}`);

/** `49.74 x − 13.27 x^2` en las unidades de presentación: cada coeficiente con su dimensión. */
const unitPolynomial = (project: ProjectModel, coefficients: readonly number[], dimension: Dimension, span: number): string => {
  const magnitudes = coefficients.map((coefficient, power) => Math.abs(coefficient) * Math.max(1, span) ** power);
  const reference = Math.max(0, ...magnitudes);
  const terms: string[] = [];
  coefficients.forEach((coefficient, power) => {
    if (!(magnitudes[power]! > reference * 1e-9)) return;
    const value = dimensionalValue(project, coefficient, dimension[0], dimension[1] - power);
    const magnitude = number(Math.abs(value));
    const factor = power === 0 ? magnitude : power === 1 ? `${magnitude} x` : `${magnitude} x^${power}`;
    terms.push(terms.length ? `${value < 0 ? '−' : '+'} ${factor}` : `${value < 0 ? '−' : ''}${factor}`);
  });
  return terms.join(' ') || '0';
};

/**
 * Con EI constante las expresiones se escriben como EI θ y EI y (kN·m², kN·m³); si EI cambia
 * entre tramos, como θ e y.
 */
interface ElasticFamily {
  readonly prefix: string;
  readonly slope: Dimension;
  readonly deflection: Dimension;
}

const elasticFamily = (uniformEI: boolean): ElasticFamily => (uniformEI
  ? { prefix: 'EI ', slope: [1, 2], deflection: [1, 3] }
  : { prefix: '', slope: [0, 0], deflection: [0, 1] });

interface ElasticStretch {
  readonly x0: number;
  readonly x1: number;
  readonly EI: number;
  readonly moment: readonly number[];
  readonly slope: readonly number[];
  readonly deflection: readonly number[];
  readonly constantSymbols: readonly [string, string];
}

interface ElasticCondition {
  readonly statement: string;
  readonly kind: 'deflection' | 'slope' | 'continuity';
  readonly x: number;
}

/** Lo que sale de integrar M, sin constantes: el giro sin C₁ y la flecha sin C₁ x + C₂. */
const particularSlope = (stretch: ElasticStretch): number[] => [0, ...stretch.slope.slice(1)];
const particularDeflection = (stretch: ElasticStretch): number[] => [0, 0, ...stretch.deflection.slice(2)];
const slopeConstant = (stretch: ElasticStretch): number => stretch.slope[0] ?? 0;
const deflectionConstant = (stretch: ElasticStretch): number => stretch.deflection[0] ?? 0;

/**
 * Las constantes se leen de los polinomios ya resueltos: el término independiente del giro es
 * C₁ y reaparece como coeficiente de x en la flecha. Si no coincide, nada de lo que sigue se
 * escribe con constantes.
 */
const constantsReadable = (stretches: readonly ElasticStretch[]): boolean => stretches.every((stretch) => {
  const constant = slopeConstant(stretch);
  const linear = stretch.deflection[1] ?? 0;
  return Math.abs(constant - linear) <= 1e-9 * Math.max(Math.abs(constant), Math.abs(linear)) + 1e-300;
});

const withConstants = (particular: string, constants: string): string => (particular === '0' ? constants : `${particular} + ${constants}`);

/** Integración de un tramo: M dado, giro y flecha con sus dos constantes todavía como símbolos. */
const integrationEquations = (
  project: ProjectModel,
  family: ElasticFamily,
  stretch: ElasticStretch,
  k: number,
  span: number,
  names: { readonly slope: string; readonly deflection: string; readonly load: (k: number) => string },
): EquationInput[] => {
  const [c1, c2] = stretch.constantSymbols;
  return [
    `M_${stretchIndex(k)}(x) = ${unitPolynomial(project, stretch.moment, [1, 1], span)}`,
    {
      lhs: `${names.slope}_${stretchIndex(k)}(x)`,
      symbolic: `∫ ${names.load(k)} dx + ${c1}`,
      substituted: withConstants(unitPolynomial(project, particularSlope(stretch), family.slope, span), c1),
    },
    {
      lhs: `${names.deflection}_${stretchIndex(k)}(x)`,
      symbolic: `∫ ${names.slope}_${stretchIndex(k)}(x) dx + ${c2}`,
      substituted: withConstants(unitPolynomial(project, particularDeflection(stretch), family.deflection, span), `${c1} x + ${c2}`),
    },
  ];
};

/**
 * Cada condición escrita con los polinomios del tramo: término conocido + constantes = 0. Se
 * comprueba con las constantes ya resueltas antes de imprimirla; si una no cierra, no se
 * imprime ninguna (`undefined`).
 */
const conditionEquations = (
  project: ProjectModel,
  family: ElasticFamily,
  stretches: readonly ElasticStretch[],
  conditions: readonly ElasticCondition[],
  names: { readonly slope: string; readonly deflection: string },
): EquationInput[] | undefined => {
  const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  const stretchAt = (x: number) => {
    const found = stretches.findIndex((stretch) => x >= stretch.x0 - 1e-9 && x <= stretch.x1 + 1e-9);
    return found < 0 ? stretches.length - 1 : found;
  };
  const equations: EquationInput[] = [];
  for (const condition of conditions) {
    const quantity = condition.kind === 'slope' || (condition.kind === 'continuity' && condition.statement.startsWith('θ'))
      ? 'slope' as const
      : 'deflection' as const;
    const dimension = family[quantity];
    const x = condition.x;
    let known = 0;
    const unknowns: { coefficient: number; symbol: string; value: number; length: boolean }[] = [];
    const add = (k: number, sign: 1 | -1) => {
      const stretch = stretches[k]!;
      const [c1, c2] = stretch.constantSymbols;
      if (quantity === 'slope') {
        known += sign * valueAt(particularSlope(stretch), x);
        unknowns.push({ coefficient: sign, symbol: c1, value: slopeConstant(stretch), length: false });
        return;
      }
      known += sign * valueAt(particularDeflection(stretch), x);
      unknowns.push({ coefficient: sign * x, symbol: c1, value: slopeConstant(stretch), length: true });
      unknowns.push({ coefficient: sign, symbol: c2, value: deflectionConstant(stretch), length: false });
    };
    const xText = dimensionalFigure(project, x, 0, 1);
    let lhs: string;
    if (condition.kind === 'continuity') {
      const k = stretches.findIndex((stretch) => near(stretch.x1, x));
      if (k < 0 || k + 1 >= stretches.length) return undefined;
      add(k, 1);
      add(k + 1, -1);
      lhs = `${names[quantity]}_${stretchIndex(k)}(${xText}) − ${names[quantity]}_${stretchIndex(k + 1)}(${xText})`;
    } else {
      const k = stretchAt(x);
      add(k, 1);
      lhs = `${names[quantity]}_${stretchIndex(k)}(${xText})`;
    }
    const parts = [known, ...unknowns.map((unknown) => unknown.coefficient * unknown.value)];
    const scale = Math.max(...parts.map((part) => Math.abs(part)));
    const total = parts.reduce((sum, part) => sum + part, 0);
    if (!(Math.abs(total) <= 1e-6 * scale + 1e-14)) return undefined;
    const terms: string[] = [];
    if (Math.abs(known) > 1e-9 * scale) terms.push(dimensionalFigure(project, known, dimension[0], dimension[1], scale));
    for (const unknown of unknowns) {
      if (Math.abs(unknown.coefficient) <= 1e-12) continue;
      const magnitude = Math.abs(unknown.coefficient);
      const factor = unknown.length ? dimensionalFigure(project, magnitude, 0, 1) : number(magnitude);
      const text = factor === '1' ? unknown.symbol : `${factor} ${unknown.symbol}`;
      terms.push(unknown.coefficient < 0 ? `−${text}` : text);
    }
    equations.push({ lhs, substituted: signedSum(terms), result: '0' });
  }
  return equations;
};

/** El enunciado de las condiciones que aplican, en símbolos. */
const conditionFormula = (conditions: readonly ElasticCondition[], names: { readonly slope: string; readonly deflection: string }, conjugate: boolean): string => {
  const parts: string[] = [];
  if (conditions.some((condition) => condition.kind === 'deflection')) parts.push(conjugate ? `${names.deflection}(x_a) = 0` : 'y(x_a) = 0');
  if (conditions.some((condition) => condition.kind === 'slope')) parts.push(conjugate ? `${names.slope}(x_e) = 0` : 'θ(x_e) = 0');
  if (conditions.some((condition) => condition.kind === 'continuity')) {
    parts.push(`${names.slope}_k(x_k) = ${names.slope}_{k+1}(x_k)`, `${names.deflection}_k(x_k) = ${names.deflection}_{k+1}(x_k)`);
  }
  return parts.join(',   ');
};

const conditionWhere = (conditions: readonly ElasticCondition[], conjugate: boolean): [string, string][] => [
  ...(conditions.some((condition) => condition.kind === 'deflection')
    ? [['x_a', conjugate ? 'extremo con flecha nula en la viga real: la conjugada no tiene momento ahí' : 'abscisa de cada apoyo (flecha nula)'] as [string, string]]
    : []),
  ...(conditions.some((condition) => condition.kind === 'slope')
    ? [['x_e', conjugate ? 'empotramiento real: extremo libre de la conjugada, sin cortante' : 'abscisa de cada empotramiento (giro nulo)'] as [string, string]]
    : []),
  ...(conditions.some((condition) => condition.kind === 'continuity')
    ? [['x_k', 'frontera entre los tramos k y k + 1'] as [string, string]]
    : []),
];

/** Constantes con su unidad, para el recuadro de resultados. */
const constantRows = (project: ProjectModel, family: ElasticFamily, stretches: readonly ElasticStretch[]): [string, string][] => {
  const unitOf = (dimension: Dimension) => (dimension[0] === 0 && dimension[1] === 0 ? 'rad' : dimensionalUnit(project, dimension[0], dimension[1]));
  return stretches.flatMap((stretch) => [
    [stretch.constantSymbols[0], `${dimensionalFigure(project, slopeConstant(stretch), family.slope[0], family.slope[1])} ${unitOf(family.slope)}`],
    [stretch.constantSymbols[1], `${dimensionalFigure(project, deflectionConstant(stretch), family.deflection[0], family.deflection[1])} ${unitOf(family.deflection)}`],
  ] as [string, string][]);
};

/** La elástica con las constantes sustituidas y la flecha máxima, cuando su cociente cierra. */
const elasticCurveEquations = (
  project: ProjectModel,
  family: ElasticFamily,
  stretches: readonly ElasticStretch[],
  span: number,
  EI: number,
  maxDeflection: { x: number; value: number },
  deflectionName: string,
): EquationInput[] => {
  const lengthUnit = unitFor(project, 'length');
  const curves: EquationInput[] = stretches.map((stretch, k) => `${deflectionName}_${stretchIndex(k)}(x) = ${unitPolynomial(project, stretch.deflection, family.deflection, span)}`);
  const presentation = family.prefix ? EI : 1;
  const k = stretches.findIndex((stretch) => maxDeflection.x >= stretch.x0 - 1e-9 && maxDeflection.x <= stretch.x1 + 1e-9
    && closeTo(valueAt(stretch.deflection, maxDeflection.x) / presentation, maxDeflection.value));
  if (k < 0) return curves;
  const at = dimensionalFigure(project, maxDeflection.x, 0, 1);
  const raw = valueAt(stretches[k]!.deflection, maxDeflection.x);
  const result = displayCell(project, maxDeflection.value, 'length');
  return [
    ...curves,
    family.prefix
      ? {
        lhs: 'y_{máx}', symbolic: `${deflectionName}_${stretchIndex(k)}(${at})/EI`,
        substituted: `(${dimensionalFigure(project, raw, 1, 3)})/(${dimensionalFigure(project, EI, 1, 2)})`,
        result, unit: lengthUnit,
      }
      : { lhs: 'y_{máx}', substituted: `${deflectionName}_${stretchIndex(k)}(${at})`, result, unit: lengthUnit },
  ];
};

const elasticCurveFigure = (context: ReportContext, stretches: readonly ElasticStretch[], length: number): void => {
  const { layout } = context;
  layout.ensure(120);
  layout.y -= 8;
  drawElasticCurve(
    layout,
    stretches.map((stretch) => ({ x0: stretch.x0, x1: stretch.x1, deflection: [...stretch.deflection] })),
    length,
    layout.margin,
    layout.y - 104,
    layout.contentWidth,
    104,
    layout.palette.quantity.moment,
  );
  layout.y -= 112;
};

const SUPPORT_NAME: Record<string, string> = {
  pin: 'articulado',
  roller: 'rodillo',
  fixed: 'empotramiento',
  custom: 'apoyo',
};

/** Tabla de tramos: dónde vale cada polinomio, su rigidez y sus dos constantes. */
const stretchTable = (context: ReportContext, stretches: readonly ElasticStretch[]): void => {
  const { project } = context;
  const lengthUnit = unitFor(project, 'length');
  context.layout.table([
    { header: 'Tramo' },
    { header: `x inicial (${lengthUnit})`, ...NUMERIC },
    { header: `x final (${lengthUnit})`, ...NUMERIC },
    { header: `EI (${dimensionalUnit(project, 1, 2)})`, ...NUMERIC },
    { header: 'Constantes' },
  ], stretches.map((stretch, k) => [
    String(k + 1),
    dimensionalFigure(project, stretch.x0, 0, 1),
    dimensionalFigure(project, stretch.x1, 0, 1),
    dimensionalFigure(project, stretch.EI, 1, 2),
    stretch.constantSymbols.join(', '),
  ]));
};

const drawDoubleIntegration = (context: ReportContext, solution: DoubleIntegrationResult): void => {
  const { layout, project } = context;
  const lengthUnit = unitFor(project, 'length');
  const forceUnit = unitFor(project, 'force');
  const momentUnit = unitFor(project, 'moment');
  const family = elasticFamily(solution.uniformEI);
  const names = {
    slope: `${family.prefix}θ`,
    deflection: `${family.prefix}y`,
    load: (k: number) => (family.prefix ? `M_${stretchIndex(k)}(x)` : `M_${stretchIndex(k)}(x)/(EI)_${stretchIndex(k)}`),
  };
  const stretches: ElasticStretch[] = solution.segments;
  const span = solution.axis.length;
  const degree = solution.classification.indeterminacy;
  const redundantNames = solution.redundants.map((redundant) => redundant.symbol).join(', ');

  layout.heading('5. Método de la doble integración');
  memoirNote(context, `Viga de ${dimensionalFigure(project, span, 0, 1)} ${lengthUnit}, `
    + `${degree === 0 ? 'isostática' : `hiperestática de grado ${degree}`}. Incógnitas: `
    + `${degree ? `${degree === 1 ? 'la redundante' : 'las redundantes'} ${redundantNames} y ` : ''}`
    + `las ${2 * stretches.length} constantes de integración, dos por tramo.`);

  memoirStep(context, '5.1 Datos');
  const redundantAt = new Map(solution.redundants.map((redundant) => [redundant.nodeId, redundant.symbol]));
  const supports = new Map<string, { x: number; conditions: string[] }>();
  for (const condition of solution.conditions) {
    if (condition.kind === 'continuity') continue;
    const nodeId = /en (\S+)$/.exec(condition.statement)?.[1];
    if (!nodeId) continue;
    const entry = supports.get(nodeId) ?? { x: condition.x, conditions: [] };
    entry.conditions.push(condition.kind === 'slope' ? 'θ = 0' : 'y = 0');
    supports.set(nodeId, entry);
  }
  layout.table([
    { header: 'Apoyo' },
    { header: `x (${lengthUnit})`, ...NUMERIC },
    { header: 'Tipo' },
    { header: 'Condición' },
  ], [...supports].map(([nodeId, entry]) => [
    nodeId,
    dimensionalFigure(project, entry.x, 0, 1),
    SUPPORT_NAME[context.index.node(nodeId)?.support.type ?? ''] ?? 'apoyo',
    `${entry.conditions.join(', ')}${redundantAt.has(nodeId) ? ` (redundante ${redundantAt.get(nodeId)})` : ''}`,
  ]));
  stretchTable(context, stretches);
  memoirNote(context, `x se mide desde ${solution.axis.stations[0]?.nodeId ?? 'el extremo izquierdo'}; y positiva hacia arriba, M positivo con tracción abajo.`);

  memoirStep(context, '5.2 Planteamiento');
  memoirFormula(context, 'EI d^{2}y/dx^{2} = M(x)', [
    ['y(x)', `flecha (${lengthUnit})`],
    ['θ(x) = dy/dx', 'giro (rad)'],
    ['M(x)', `momento flector del tramo (${momentUnit})`],
    ['EI', `rigidez a flexión (${dimensionalUnit(project, 1, 2)})`],
  ]);
  memoirFormula(context, family.prefix
    ? 'EI θ(x) = ∫ M(x) dx + C_1,    EI y(x) = ∫ EI θ(x) dx + C_2'
    : 'θ(x) = ∫ M(x)/EI dx + C_1,    y(x) = ∫ θ(x) dx + C_2', [
    ['C_1, C_2', 'constantes de integración de cada tramo'],
  ]);
  if (solution.redundants.length) {
    memoirNote(context, `M(x) incluye ${redundantNames} como carga en ${solution.redundants.map((redundant) => redundant.nodeId).join(', ')}; `
      + 'su apoyo aporta la condición y = 0 que la determina.');
  }

  drawScenes(
    context,
    doubleIntegrationScenes(context, solution),
    (_scene, k) => `Tramo ${k + 1}: corte en x y momento M(x) de la porción izquierda.`,
  );

  memoirStep(context, '5.3 Desarrollo');
  memoirNote(context, `x en ${lengthUnit}; M en ${momentUnit}, ${names.slope} en ${family.prefix ? dimensionalUnit(project, 1, 2) : 'rad'} `
    + `y ${names.deflection} en ${family.prefix ? dimensionalUnit(project, 1, 3) : lengthUnit}.`);
  for (const [k, stretch] of stretches.entries()) {
    memoirWork(
      context,
      integrationEquations(project, family, stretch, k, span, names),
      `Tramo ${k + 1}: ${dimensionalFigure(project, stretch.x0, 0, 1)} ≤ x ≤ ${dimensionalFigure(project, stretch.x1, 0, 1)} ${lengthUnit}`,
    );
  }

  memoirStep(context, '5.4 Condiciones de contorno');
  memoirFormula(context, conditionFormula(solution.conditions, names, false), conditionWhere(solution.conditions, false));
  const conditionWork = constantsReadable(stretches)
    ? conditionEquations(project, family, stretches, solution.conditions, names)
    : undefined;
  if (conditionWork) {
    memoirNote(context, `${solution.conditions.length} ecuaciones para ${solution.conditions.length} incógnitas`
      + `${degree ? `; se escriben con ${redundantNames} ya sustituida en M(x)` : ''}:`);
    memoirWork(context, conditionWork);
  }
  memoirResults(context, degree ? 'Redundantes y constantes de integración' : 'Constantes de integración', [
    ...solution.redundants.map((redundant): [string, string] => [`${redundant.symbol} (${redundant.nodeId})`, `${displayCell(project, redundant.value, 'force')} ${forceUnit}`]),
    ...(constantsReadable(stretches) ? constantRows(project, family, stretches) : []),
  ]);

  memoirStep(context, '5.5 Resultados');
  memoirWork(context, elasticCurveEquations(project, family, stretches, span, solution.EI, solution.maxDeflection, names.deflection), 'Elástica con las constantes sustituidas:');
  memoirResults(context, 'Flecha máxima', [
    ['y_{máx}', `${displayCell(project, solution.maxDeflection.value, 'length')} ${lengthUnit}`],
    ['x', `${dimensionalFigure(project, solution.maxDeflection.x, 0, 1)} ${lengthUnit}`],
  ]);
  elasticCurveFigure(context, stretches, solution.axis.length);

  memoirStep(context, '5.6 Comprobación');
  const deflectionScale = Math.max(1e-12, Math.abs(solution.maxDeflection.value));
  const reactionScale = Math.max(1, ...solution.redundants.map((redundant) => Math.abs(redundant.value)));
  const worstRedundant = solution.redundants.reduce<typeof solution.redundants[number] | undefined>(
    (worst, redundant) => !worst || Math.abs(redundant.value - redundant.solverReaction) > Math.abs(worst.value - worst.solverReaction) ? redundant : worst,
    undefined,
  );
  const deflectionGap = `${displayCell(project, solution.deflectionResidual, 'length')} ${lengthUnit}`;
  memoirCheck(
    context,
    worstRedundant
      ? `${worstRedundant.symbol} = ${displayCell(project, worstRedundant.value, 'force')} ${forceUnit}; análisis matricial `
        + `${displayCell(project, worstRedundant.solverReaction, 'force')} ${forceUnit}; flecha: diferencia ${deflectionGap}.`
      : `flecha contra el análisis matricial, diferencia máxima ${deflectionGap}.`,
    solution.deflectionResidual <= 1e-3 * deflectionScale + 1e-12 && solution.reactionResidual <= 1e-3 * reactionScale,
  );
};

const CONJUGATE_KIND_LABEL: Record<ConjugateSupportKind, string> = {
  fixed: 'empotramiento',
  simple: 'apoyo simple',
  guided: 'apoyo deslizante (guía)',
  free: 'extremo libre',
};

const drawConjugateBeam = (context: ReportContext, solution: ConjugateBeamResult): void => {
  const { layout, project } = context;
  const lengthUnit = unitFor(project, 'length');
  const momentUnit = unitFor(project, 'moment');
  const family = elasticFamily(solution.uniformEI);
  const names = {
    slope: 'V^*',
    deflection: 'M^*',
    load: (k: number) => `${family.prefix ? 'M' : 'w^*'}_${stretchIndex(k)}(x)`,
  };
  const stretches: ElasticStretch[] = solution.segments.map((segment) => ({
    x0: segment.x0,
    x1: segment.x1,
    EI: segment.EI,
    moment: segment.moment,
    slope: segment.conjugateShear,
    deflection: segment.conjugateMoment,
    constantSymbols: segment.constantSymbols,
  }));
  const span = solution.axis.length;

  layout.heading('5. Método de la viga conjugada');
  memoirNote(context, `Viga isostática de ${dimensionalFigure(project, span, 0, 1)} ${lengthUnit}, sin apoyos intermedios. `
    + `Incógnitas: el giro y la flecha, que son el cortante y el momento de la viga conjugada cargada con M/EI.`);

  memoirStep(context, '5.1 Datos');
  layout.table([
    { header: 'Nudo' },
    { header: `x (${lengthUnit})`, ...NUMERIC },
    { header: 'Apoyo real' },
    { header: 'Apoyo conjugado' },
  ], solution.ends.map((end) => [
    end.nodeId,
    dimensionalFigure(project, end.x, 0, 1),
    CONJUGATE_KIND_LABEL[end.realKind],
    CONJUGATE_KIND_LABEL[end.conjugateKind],
  ]));
  stretchTable(context, stretches);
  memoirNote(context, `x se mide desde ${solution.ends[0].nodeId}; y positiva hacia arriba, M positivo con tracción abajo.`);

  memoirStep(context, '5.2 Planteamiento');
  memoirFormula(context, 'w^*(x) = M(x)/EI,    θ(x) = V^*(x),    y(x) = M^*(x)', [
    ['w^*', 'carga de la viga conjugada'],
    ['V^*, M^*', 'cortante y momento de la viga conjugada'],
    ['θ, y', 'giro y flecha de la viga real'],
  ]);
  memoirFormula(context, family.prefix
    ? 'V^*(x) = ∫ M(x) dx + C_1,    M^*(x) = ∫ V^*(x) dx + C_2'
    : 'V^*(x) = ∫ w^*(x) dx + C_1,    M^*(x) = ∫ V^*(x) dx + C_2', [
    ['C_1, C_2', 'constantes de cada tramo, fijadas por los apoyos de la conjugada'],
  ]);
  if (family.prefix) memoirNote(context, 'Con EI constante la conjugada se carga con M(x): su cortante es EI θ y su momento EI y.');

  drawScenes(
    context,
    conjugateBeamScenes(context, solution),
    (_scene, k) => `Tramo ${k + 1}: corte en x; M(x) de la porción izquierda es la carga de la conjugada.`,
  );

  memoirStep(context, '5.3 Desarrollo');
  memoirNote(context, `x en ${lengthUnit}; M en ${momentUnit}, V* en ${family.prefix ? dimensionalUnit(project, 1, 2) : 'rad'} `
    + `y M* en ${family.prefix ? dimensionalUnit(project, 1, 3) : lengthUnit}.`);
  for (const [k, stretch] of stretches.entries()) {
    const equations = integrationEquations(project, family, stretch, k, span, names);
    const load = family.prefix
      ? []
      : [`w^*_${stretchIndex(k)}(x) = M_${stretchIndex(k)}(x)/(EI)_${stretchIndex(k)} = (${unitPolynomial(project, stretch.moment, [1, 1], span)})/`
        + `(${dimensionalFigure(project, stretch.EI, 1, 2)}) = ${unitPolynomial(project, solution.segments[k]!.fictitiousLoad, [0, -1], span)}`];
    memoirWork(
      context,
      [equations[0]!, ...load, ...equations.slice(1)],
      `Tramo ${k + 1}: ${dimensionalFigure(project, stretch.x0, 0, 1)} ≤ x ≤ ${dimensionalFigure(project, stretch.x1, 0, 1)} ${lengthUnit}`,
    );
  }

  memoirStep(context, '5.4 Apoyos de la viga conjugada');
  memoirFormula(context, conditionFormula(solution.conditions, names, true), conditionWhere(solution.conditions, true));
  const readable = constantsReadable(stretches);
  const conditionWork = readable ? conditionEquations(project, family, stretches, solution.conditions, names) : undefined;
  if (conditionWork) memoirWork(context, conditionWork);
  if (readable) memoirResults(context, 'Constantes de integración', constantRows(project, family, stretches));

  memoirStep(context, '5.5 Resultados');
  // Las reacciones de la conjugada son el giro y la flecha reales en los extremos.
  const presentation = family.prefix ? solution.EI : 1;
  const EIText = dimensionalFigure(project, solution.EI, 1, 2);
  const endWork: EquationInput[] = solution.ends.flatMap((end) => {
    const k = end.x <= stretches[0]!.x0 + 1e-9 ? 0 : stretches.length - 1;
    const stretch = stretches[k]!;
    const at = dimensionalFigure(project, end.x, 0, 1);
    const out: EquationInput[] = [];
    const shear = valueAt(stretch.slope, end.x);
    if (end.reactionForce !== undefined && closeTo(shear / presentation, end.reactionForce)) {
      out.push(family.prefix
        ? { lhs: `θ(${end.nodeId})`, symbolic: `V^*_${stretchIndex(k)}(${at})/EI`, substituted: `(${dimensionalFigure(project, shear, 1, 2)})/(${EIText})`, result: number(end.reactionForce), unit: 'rad' }
        : { lhs: `θ(${end.nodeId})`, substituted: `V^*_${stretchIndex(k)}(${at})`, result: number(end.reactionForce), unit: 'rad' });
    }
    const bending = valueAt(stretch.deflection, end.x);
    if (end.reactionMoment !== undefined && closeTo(bending / presentation, end.reactionMoment)) {
      out.push(family.prefix
        ? { lhs: `y(${end.nodeId})`, symbolic: `M^*_${stretchIndex(k)}(${at})/EI`, substituted: `(${dimensionalFigure(project, bending, 1, 3)})/(${EIText})`, result: displayCell(project, end.reactionMoment, 'length'), unit: lengthUnit }
        : { lhs: `y(${end.nodeId})`, substituted: `M^*_${stretchIndex(k)}(${at})`, result: displayCell(project, end.reactionMoment, 'length'), unit: lengthUnit });
    }
    return out;
  });
  memoirWork(context, endWork, 'Reacciones de la conjugada: giro y flecha reales en los extremos.');
  memoirWork(context, elasticCurveEquations(project, family, stretches, span, solution.EI, solution.maxDeflection, 'M^*'), 'Elástica con las constantes sustituidas:');
  memoirResults(context, 'Giros y flecha máxima', [
    ...solution.ends.flatMap((end): [string, string][] => [
      ...(end.reactionForce !== undefined ? [[`θ(${end.nodeId})`, `${number(end.reactionForce)} rad`] as [string, string]] : []),
      ...(end.reactionMoment !== undefined ? [[`y(${end.nodeId})`, `${displayCell(project, end.reactionMoment, 'length')} ${lengthUnit}`] as [string, string]] : []),
    ]),
    ['y_{máx}', `${displayCell(project, solution.maxDeflection.value, 'length')} ${lengthUnit} en x = ${dimensionalFigure(project, solution.maxDeflection.x, 0, 1)} ${lengthUnit}`],
  ]);
  elasticCurveFigure(context, stretches, solution.axis.length);

  memoirStep(context, '5.6 Comprobación');
  const slopeScale = Math.max(1e-12, ...solution.ends.map((end) => Math.abs(end.reactionForce ?? 0)));
  const deflectionScale = Math.max(1e-12, Math.abs(solution.maxDeflection.value));
  memoirCheck(
    context,
    `giro y flecha contra el análisis matricial: diferencias ${number(solution.slopeResidual)} rad `
    + `y ${displayCell(project, solution.deflectionResidual, 'length')} ${lengthUnit}.`,
    solution.slopeResidual <= 1e-3 * slopeScale + 1e-12 && solution.deflectionResidual <= 1e-3 * deflectionScale + 1e-12,
  );
};

const drawThreeMoment = (context: ReportContext, solution: ThreeMomentResult): void => {
  const { layout, project } = context;
  const lengthUnit = unitFor(project, 'length');
  const momentUnit = unitFor(project, 'moment');
  const supports = solution.supportMoments;
  const momentScale = Math.max(1, ...supports.map((entry) => Math.abs(entry.value)));
  const moment = (value: number) => clearNumber(value, momentScale);

  layout.heading('5. Método de los tres momentos (ecuación de Clapeyron)');
  memoirNote(context, `Viga continua de ${solution.spans.length} vanos, hiperestática de grado ${solution.classification.indeterminacy}. `
    + 'Incógnitas: los momentos en los apoyos interiores. Se escribe una ecuación de Clapeyron por cada apoyo interior.');

  memoirStep(context, '5.1 Datos de los vanos');
  memoirNote(context, 'Cada vano se toma como viga simplemente apoyada bajo sus propias cargas (momento libre M₀). '
    + 'A·ā y A·b̄ son los momentos estáticos del diagrama M₀/EI respecto a cada extremo.');
  layout.table([
    { header: 'Vano' },
    { header: `L (${lengthUnit})`, align: 'right' },
    { header: 'EI (kN·m²)', align: 'right' },
    { header: 'A·ā (kN·m³)', align: 'right' },
    { header: 'A·b̄ (kN·m³)', align: 'right' },
  ], solution.spans.map((span, index) => [
    `${index + 1}  (${span.leftNodeId} – ${span.rightNodeId})`,
    number(span.length),
    number(span.EI),
    clearNumber(span.firstMomentLeft, Math.max(1, Math.abs(span.firstMomentLeft))),
    clearNumber(span.firstMomentRight, Math.max(1, Math.abs(span.firstMomentRight))),
  ]));

  memoirStep(context, '5.2 Planteamiento');
  memoirFormula(context, 'M_{i−1} L_i/(EI)_i + 2 M_i (L_i/(EI)_i + L_{i+1}/(EI)_{i+1}) + M_{i+1} L_{i+1}/(EI)_{i+1} = −6 (A_i ā_i/(EI L)_i + A_{i+1} b̄_{i+1}/(EI L)_{i+1})', [
    ['M_i', `momento en el apoyo interior i (${momentUnit})`],
    ['L_i, (EI)_i', 'longitud y rigidez del vano a la izquierda del apoyo i'],
    ['A ā, A b̄', 'momento estático del diagrama de momento libre respecto al extremo lejano'],
  ]);

  memoirStep(context, '5.3 Desarrollo');
  const equations: EquationInput[] = [];
  for (const [k, left] of solution.spans.slice(0, -1).entries()) {
    const right = solution.spans[k + 1]!;
    const [mPrev, mHere, mNext] = [supports[k]?.value ?? 0, supports[k + 1]?.value ?? 0, supports[k + 2]?.value ?? 0];
    const fl = left.length / left.EI;
    const fr = right.length / right.EI;
    const lhs = fl * mPrev + 2 * (fl + fr) * mHere + fr * mNext;
    const rhs = -6 * (left.firstMomentLeft / (left.EI * left.length) + right.firstMomentRight / (right.EI * right.length));
    if (Math.abs(lhs - rhs) > 1e-6 * Math.max(1, Math.abs(rhs))) continue;
    const node = supports[k + 1]?.nodeId ?? String(k + 1);
    const [sPrev, sHere, sNext] = [supports[k]?.symbol ?? `M_${k}`, supports[k + 1]?.symbol ?? `M_${k + 1}`, supports[k + 2]?.symbol ?? `M_${k + 2}`];
    equations.push(`Apoyo ${node}:  ${number(fl)} ${sPrev} + 2(${number(fl)} + ${number(fr)}) ${sHere} + ${number(fr)} ${sNext} = −6(${number(left.firstMomentLeft)}/${number(left.EI * left.length)} + ${number(right.firstMomentRight)}/${number(right.EI * right.length)}) = ${number(rhs)}`);
  }
  const known = supports.filter((_entry, index) => index === 0 || index === supports.length - 1)
    .map((entry) => `${entry.symbol} = ${moment(entry.value)} ${momentUnit}`).join(';  ');
  if (known) memoirNote(context, `Extremos simplemente apoyados: ${known}.`);
  memoirWork(context, equations);

  memoirResults(context, 'Momentos en los apoyos', supports.map((entry) => [`${entry.symbol} (${entry.nodeId})`, `${moment(entry.value)} ${momentUnit}`]));

  drawScenes(
    context,
    threeMomentScenes(context, solution),
    (_scene, index) => `Vano ${index + 1} aislado con sus cargas y los momentos de apoyo obtenidos.`,
  );

  memoirStep(context, '5.4 Momento flector en cada vano');
  memoirFormula(context, 'M(x) = M_0(x) + M_{izq} (1 − x/L) + M_{der} x/L');
  memoirWork(context, solution.segments.map((segment, index) => `M_{${index + 1}}(x) = ${expression(segment.moment)}  (${number(segment.x0)} ≤ x ≤ ${number(segment.x1)} ${lengthUnit})`));

  memoirStep(context, '5.5 Comprobación');
  const worst = supports.reduce((largest, entry) => Math.max(largest, Math.abs(entry.value - entry.solverMoment)), 0);
  memoirCheck(context, `momentos de apoyo contra el análisis matricial, diferencia máxima ${clearNumber(worst, momentScale)} ${momentUnit}.`, worst <= 1e-3 * momentScale);
};

const drawVirtualWork = (context: ReportContext, solution: VirtualWorkResult): void => {
  const { layout, project } = context;
  const { fonts, palette } = layout;
  const lengthUnit = unitFor(project, 'length');
  const forceUnit = unitFor(project, 'force');
  const componentLabel = (component: 'ux' | 'uy') => (component === 'ux' ? 'horizontal' : 'vertical');

  layout.heading('5. Procedimiento: Trabajo Virtual (carga unitaria)');
  layout.text(
    'Para hallar el desplazamiento de un nudo se retira la carga real, se aplica una única carga '
    + 'virtual unitaria en ese nudo y en la dirección de interés, y se halla la fuerza que esa '
    + 'carga virtual produce en cada barra. El desplazamiento es la suma, en toda la armadura, de '
    + 'la fuerza real de cada barra por su fuerza virtual y su longitud, entre su rigidez axial:',
    8.7, fonts.regular, undefined, 8,
  );
  // The identity `Δ = Σ nNL/AE` is replaced by the sum this truss actually adds up: one
  // quotient per bar, with its own virtual force, real force, length and axial stiffness,
  // and the total that came out. The sum is checked against the value the method solved for
  // before it is printed, so what appears is arithmetic that closes.
  const contributions = solution.narrated.contributions;
  const contributionTotal = contributions.reduce((sum, entry) => sum + entry.contribution, 0);
  if (contributions.length && Math.abs(contributionTotal - solution.narrated.total) <= 1e-8 * Math.max(1, Math.abs(solution.narrated.total))) {
    const forceScale = Math.max(1, ...contributions.map((entry) => Math.abs(entry.axialForce)));
    const terms = contributions.slice(0, 8).map((entry) => (
      `(${number(entry.virtualForce, 5)})(${dimensionalFigure(project, entry.axialForce, 1, 0, forceScale)})`
      + `(${dimensionalFigure(project, entry.length, 0, 1)})/`
      + `((${dimensionalFigure(project, entry.A, 0, 2)})(${dimensionalFigure(project, entry.E, 1, -2)}))`
    ));
    const shown = contributions.length > 8 ? [...terms, '...'] : terms;
    const equation = {
      lhs: 'Δ',
      symbolic: 'Σ nNL/AE',
      substituted: shown.join(' + '),
      result: dimensionalFigure(project, solution.narrated.total, 0, 1),
      unit: lengthUnit,
    };
    layout.text(
      `Nudo ${solution.narrated.nodeId}, componente ${componentLabel(solution.narrated.component)}:`
      + ` fuerzas en ${forceUnit}, longitudes en ${lengthUnit}, áreas en ${dimensionalUnit(project, 0, 2)}, E en ${dimensionalUnit(project, 1, -2)}.`,
      7.9, fonts.bold, palette.ink, 12,
    );
    drawRelation(context, equation);
  }

  layout.heading('5.1 Desplazamientos en cada nudo libre', 2);
  layout.text(
    'La última columna es lo que el análisis matricial reporta en ese mismo grado de libertad: '
    + 'el método y el solver tienen que coincidir.',
    8.3, fonts.regular, undefined, 8,
  );
  drawCalculationRecords(context,
    [
      { header: 'Nudo', width: 60 },
      { header: 'Componente', width: 90 },
      { header: `Trabajo virtual (${lengthUnit})`, ...NUMERIC },
      { header: `Análisis matricial (${lengthUnit})`, ...NUMERIC },
    ],
    solution.displacements.map((entry) => [
      entry.nodeId,
      componentLabel(entry.component),
      displayCell(project, entry.value, 'length'),
      displayCell(project, entry.solverValue, 'length'),
    ]),
    { size: 7.8 },
  );

  drawScenes(
    context,
    virtualWorkScenes(context, solution),
    (scene) => scene.title === 'sistema real'
      ? 'Sistema real: la armadura bajo las cargas del proyecto, con la fuerza axial N de cada barra.'
      : `Sistema virtual: la misma armadura con una única carga unitaria en ${solution.narrated.nodeId}, con la fuerza n de cada barra.`,
  );

  layout.heading(`5.2 Detalle por barra: ${solution.narrated.nodeId}, componente ${componentLabel(solution.narrated.component)}`, 2);
  layout.text(
    'El nudo con mayor desplazamiento, desarrollado barra por barra: Nᵢ es la fuerza bajo la '
    + 'carga real, nᵢ la fuerza bajo la carga virtual unitaria.',
    8.3, fonts.regular, undefined, 8,
  );
  drawCalculationRecords(context,
    [
      { header: 'Barra', width: 56 },
      { header: `L (${lengthUnit})`, ...NUMERIC },
      { header: `Nᵢ (${forceUnit})`, ...NUMERIC, math: true },
      { header: 'nᵢ', ...NUMERIC, math: true },
      { header: `Aporte (${lengthUnit})`, ...NUMERIC },
    ],
    solution.narrated.contributions.map((entry) => [
      entry.memberId,
      number(entry.length, 5),
      displayCell(project, entry.axialForce, 'force'),
      clearNumber(entry.virtualForce, Math.max(1, Math.abs(entry.virtualForce))),
      displayCell(project, entry.contribution, 'length'),
    ]),
    { size: 7.6 },
  );

  layout.heading('5.3 Verificación contra el análisis matricial', 2);
  layout.text(
    `Diferencia máxima entre este método y el análisis matricial, en cualquier grado de libertad: ${clearNumber(solution.residual, 1)} ${lengthUnit}.`,
    8.7, fonts.bold, palette.ink, 8,
  );
};

const drawCastiglianoTruss = (context: ReportContext, solution: CastiglianoTrussResult): void => {
  const { layout, project } = context;
  const { fonts, palette } = layout;
  const lengthUnit = unitFor(project, 'length');
  const forceUnit = unitFor(project, 'force');
  const componentLabel = (component: 'ux' | 'uy') => (component === 'ux' ? 'horizontal' : 'vertical');

  layout.heading('5. Procedimiento: Castigliano (teorema del trabajo mínimo)');
  layout.text(
    'La armadura tiene más reacciones de las que el equilibrio por sí solo puede fijar. El '
    + 'teorema del trabajo mínimo dice que la energía de deformación es estacionaria respecto de '
    + 'cada reacción redundante — y para una armadura articulada, esa condición es exactamente el '
    + 'trabajo virtual: el desplazamiento de la estructura liberada en la dirección de cada '
    + 'redundante, bajo las cargas reales y el resto de redundantes, tiene que ser cero, porque en '
    + 'la estructura real ese apoyo no se mueve.',
    8.7, fonts.regular, undefined, 8,
  );
  // The stationarity condition is stated in the paragraph above; printing `∂U/∂Xₖ = 0` again
  // as symbols added no figure. What each redundant actually came out as, and the force it
  // leaves in every bar, are the tables of §5.2 and §5.3 below — all of them real values,
  // each next to what the matrix analysis reports at the same place.

  layout.heading('5.1 Clasificación estática', 2);
  layout.text(
    `g = ${solution.classification.indeterminacy}: la armadura es externamente hiperestática de ese grado. Se liberan esas reacciones para dejar una armadura isostática —la estructura primaria— cuya fuerza de barra bajo las cargas reales se puede seguir.`,
    8.7, fonts.regular, undefined, 8,
  );

  layout.heading('5.2 Redundantes elegidas y verificadas', 2);
  layout.text(
    'La última columna es lo que el análisis matricial obtiene en ese mismo apoyo, sobre la '
    + 'estructura original: el método y el solver tienen que coincidir.',
    8.3, fonts.regular, undefined, 8,
  );
  drawCalculationRecords(context,
    [
      { header: 'Redundante', width: 60, math: true },
      { header: 'Apoyo', width: 60 },
      { header: 'Dirección', width: 76 },
      { header: `Castigliano (${forceUnit})`, ...NUMERIC },
      { header: `Análisis matricial (${forceUnit})`, ...NUMERIC },
    ],
    solution.redundants.map((redundant) => [
      redundant.symbol,
      redundant.nodeId,
      componentLabel(redundant.component),
      displayCell(project, redundant.value, 'force'),
      displayCell(project, redundant.solverReaction, 'force'),
    ]),
    { size: 7.8 },
  );

  drawScenes(
    context,
    castiglianoScenes(context, solution),
    (scene) => scene.title === 'estructura primaria'
      ? 'Estructura primaria: la armadura con las redundantes liberadas, con la fuerza N₀ de cada barra.'
      : `${scene.title}: la incógnita que la condición de desplazamiento nulo en ese apoyo determina.`,
  );

  layout.heading('5.3 Fuerza final en cada barra', 2);
  layout.text(
    'Fuerza en la estructura primaria bajo las cargas reales, más la contribución de cada '
    + 'redundante ya resuelta — contrastada, barra por barra, contra el análisis matricial de la '
    + 'estructura original.',
    8.3, fonts.regular, undefined, 8,
  );
  drawCalculationRecords(context,
    [
      { header: 'Barra', width: 56 },
      { header: `L (${lengthUnit})`, ...NUMERIC },
      { header: `Primaria N₀ (${forceUnit})`, ...NUMERIC, math: true },
      { header: `Final (${forceUnit})`, ...NUMERIC },
      { header: `Análisis matricial (${forceUnit})`, ...NUMERIC },
    ],
    solution.members.map((member) => [
      member.memberId,
      number(member.length, 5),
      displayCell(project, member.primaryForce, 'force'),
      displayCell(project, member.force, 'force'),
      displayCell(project, member.solverForce, 'force'),
    ]),
    { size: 7.4 },
  );

  // The final force of every bar, as the sum that produced it. With a single redundant the
  // influence coefficient is recoverable exactly — it is the change per unit of X — so the
  // product is written out; with several redundants only their combined contribution is
  // separable, and that is what gets printed rather than a factor nobody could check.
  const single = solution.redundants.length === 1 ? solution.redundants[0] : undefined;
  const forceScale = Math.max(1, ...solution.members.map((member) => Math.abs(member.force)));
  drawWorked(
    context,
    single
      ? `Fuerza final de cada barra: la primaria más la contribución de ${single.symbol} = ${displayCell(project, single.value, 'force')} ${forceUnit}.`
      : `Fuerza final de cada barra: la primaria más la contribución conjunta de las ${solution.redundants.length} redundantes, en ${forceUnit}.`,
    solution.members.slice(0, 10).map((member) => {
      const contribution = member.force - member.primaryForce;
      const primary = dimensionalFigure(project, member.primaryForce, 1, 0, forceScale);
      const total = dimensionalFigure(project, member.force, 1, 0, forceScale);
      if (single && Math.abs(single.value) > 1e-9) {
        const influence = contribution / single.value;
        return `N(${member.memberId}) = ${primary} + (${number(influence, 6)})(${dimensionalFigure(project, single.value, 1, 0, forceScale)}) = ${total} ${forceUnit}`;
      }
      return `N(${member.memberId}) = ${primary} + ${dimensionalFigure(project, contribution, 1, 0, forceScale)} = ${total} ${forceUnit}`;
    }),
  );

  layout.heading('5.4 Verificación contra el análisis matricial', 2);
  layout.text(
    `Diferencia máxima: ${clearNumber(solution.reactionResidual, 1)} ${forceUnit} en las reacciones redundantes, `
    + `${clearNumber(solution.forceResidual, 1)} ${forceUnit} en la fuerza de barra.`,
    8.7, fonts.bold, palette.ink, 8,
  );
};

/** Un renglón de la tabla de Cross: un valor por extremo de vano, vacío donde no actúa. */
interface CrossRow {
  readonly label: string;
  readonly values: readonly (number | undefined)[];
}

/**
 * La tabla de Cross, rehecha con las mismas operaciones y en el mismo orden que
 * `solveHardyCross`: liberación de los extremos articulados de la orilla y, ciclo a ciclo, el
 * equilibrio de cada nudo interior con su transmisión. Devuelve `undefined` si su suma no
 * coincide con los momentos que el método reporta: entonces no se imprime.
 */
const crossTable = (solution: HardyCrossResult): { columns: string[]; factors: (number | undefined)[]; rows: CrossRow[]; final: number[] } | undefined => {
  const { spans } = solution;
  const spanCount = spans.length;
  const interior = spanCount - 1;
  if (interior < 1) return undefined;
  const width = 2 * interior;
  const column = (joint: number, side: 0 | 1) => 2 * (joint - 1) + side;
  const empty = () => new Array<number | undefined>(width).fill(undefined);
  const columns = Array.from({ length: interior }, (_, offset) => {
    const left = spans[offset]!;
    const right = spans[offset + 1]!;
    return [`${left.rightNodeId}–${left.leftNodeId}`, `${right.leftNodeId}–${right.rightNodeId}`];
  }).flat();
  const left = spans.map((span, s) => (s > 0 ? span.fixedEndMomentLeft : 0));
  const right = spans.map((span, s) => (s < spanCount - 1 ? span.fixedEndMomentRight : 0));
  const factors = empty();
  const fixedEnd = empty();
  for (let joint = 1; joint <= interior; joint += 1) {
    const kLeft = spans[joint - 1]!.stiffnessRight;
    const kRight = spans[joint]!.stiffnessLeft;
    const total = kLeft + kRight;
    if (total > 0) {
      factors[column(joint, 0)] = kLeft / total;
      factors[column(joint, 1)] = kRight / total;
    }
    fixedEnd[column(joint, 0)] = right[joint - 1];
    fixedEnd[column(joint, 1)] = left[joint];
  }
  const rows: CrossRow[] = [{ label: 'MEP', values: fixedEnd }];
  const release = empty();
  release[column(1, 0)] = -0.5 * spans[0]!.fixedEndMomentLeft;
  right[0]! += release[column(1, 0)]!;
  const lastRelease = -0.5 * spans[spanCount - 1]!.fixedEndMomentRight;
  release[column(interior, 1)] = (release[column(interior, 1)] ?? 0) + lastRelease;
  left[spanCount - 1]! += lastRelease;
  rows.push({ label: `Liberación de ${spans[0]!.leftNodeId} y ${spans[spanCount - 1]!.rightNodeId}`, values: release });

  const TOLERANCE = 1e-9;
  for (let sweep = 0; sweep < 2000; sweep += 1) {
    let unbalancedMax = 0;
    for (let joint = 1; joint <= interior; joint += 1) {
      const unbalanced = right[joint - 1]! + left[joint]!;
      unbalancedMax = Math.max(unbalancedMax, Math.abs(unbalanced));
      if (Math.abs(unbalanced) <= TOLERANCE) continue;
      const kLeft = spans[joint - 1]!.stiffnessRight;
      const kRight = spans[joint]!.stiffnessLeft;
      const total = kLeft + kRight;
      if (!(total > 0)) continue;
      const toLeft = (-unbalanced * kLeft) / total;
      const toRight = (-unbalanced * kRight) / total;
      const values = empty();
      right[joint - 1]! += toLeft;
      left[joint]! += toRight;
      values[column(joint, 0)] = toLeft;
      values[column(joint, 1)] = toRight;
      if (joint - 1 > 0) {
        left[joint - 1]! += 0.5 * toLeft;
        values[column(joint - 1, 1)] = 0.5 * toLeft;
      }
      if (joint < spanCount - 1) {
        right[joint]! += 0.5 * toRight;
        values[column(joint + 1, 0)] = 0.5 * toRight;
      }
      rows.push({ label: `Ciclo ${sweep + 1}, nudo ${spans[joint - 1]!.rightNodeId}`, values });
    }
    if (unbalancedMax <= TOLERANCE) break;
  }

  const final = empty().map((_, position) => {
    const joint = Math.floor(position / 2) + 1;
    return position % 2 === 0 ? right[joint - 1]! : left[joint]!;
  });
  const scale = Math.max(1, ...spans.map((span) => Math.max(Math.abs(span.fixedEndMomentLeft), Math.abs(span.fixedEndMomentRight))));
  for (let joint = 1; joint <= interior; joint += 1) {
    if (!agrees(final[column(joint, 0)]!, -spans[joint - 1]!.finalMomentRight, scale)) return undefined;
    if (!agrees(final[column(joint, 1)]!, spans[joint]!.finalMomentLeft, scale)) return undefined;
  }
  return { columns, factors, rows, final };
};

const drawHardyCross = (context: ReportContext, solution: HardyCrossResult): void => {
  const { layout, project } = context;
  const lengthUnit = unitFor(project, 'length');
  const momentUnit = unitFor(project, 'moment');
  const stiffnessUnit = dimensionalUnit(project, 1, 1);
  const { spans } = solution;
  const momentScale = Math.max(1, ...spans.map((span) => Math.max(Math.abs(span.fixedEndMomentLeft), Math.abs(span.fixedEndMomentRight))));
  const moment = (value: number) => dimensionalFigure(project, value, 1, 1, momentScale);

  layout.heading('5. Método de Hardy Cross (distribución de momentos)');
  memoirNote(context, `Viga continua de ${spans.length} vanos, hiperestática de grado ${solution.classification.indeterminacy}. `
    + 'Incógnitas: los momentos en los apoyos interiores, que se obtienen por reparto sucesivo sin resolver sistemas.');

  memoirStep(context, '5.1 Datos');
  layout.table([
    { header: 'Vano' },
    { header: `L (${lengthUnit})`, ...NUMERIC },
    { header: `EI (${dimensionalUnit(project, 1, 2)})`, ...NUMERIC },
    { header: `MEP extremo izq. (${momentUnit})`, ...NUMERIC },
    { header: `MEP extremo der. (${momentUnit})`, ...NUMERIC },
  ], spans.map((span) => [
    `${span.leftNodeId}–${span.rightNodeId}`,
    dimensionalFigure(project, span.length, 0, 1),
    dimensionalFigure(project, span.EI, 1, 2),
    cellText(moment(span.fixedEndMomentLeft)),
    cellText(moment(span.fixedEndMomentRight)),
  ]));
  memoirNote(context, 'MEP: momento de empotramiento perfecto del vano bajo sus cargas, con los dos extremos fijos; horario positivo.');

  memoirStep(context, '5.2 Planteamiento');
  memoirFormula(context, 'M_{ij} = MEP_{ij} + Σ ΔM_{ij} + (1/2) Σ ΔM_{ji}', [
    ['M_{ij}', `momento final en el extremo i del vano ij (${momentUnit}), horario positivo`],
    ['ΔM_{ij} = −FD_{ij} ΣM_i', 'parte del desequilibrio ΣM_i que toma el extremo al equilibrar el nudo i'],
    ['(1/2) ΔM_{ji}', 'transmisión desde el extremo opuesto del mismo vano'],
  ]);

  memoirStep(context, '5.3 Rigideces y factores de distribución');
  memoirFormula(context, 'FD_{ij} = K_{ij}/ΣK_i,    K_{ij} = 4EI/L', [
    ['K_{ij}', `rigidez del extremo i (${stiffnessUnit}); 3EI/L si el extremo opuesto es el apoyo articulado de la orilla`],
    ['ΣK_i', 'suma de las rigideces de los extremos que llegan al nudo i'],
  ]);
  const stiffnessWork: EquationInput[] = [];
  const outerEnd = (span: HardyCrossResult['spans'][number], side: 'left' | 'right') => (side === 'left' ? span.spanIndex === 0 : span.spanIndex === spans.length - 1);
  const stiffnessLabel = (near: string, far: string) => `K_{${near}–${far}}`;
  for (const span of spans) {
    for (const side of ['left', 'right'] as const) {
      if (outerEnd(span, side)) continue;
      const value = side === 'left' ? span.stiffnessLeft : span.stiffnessRight;
      const factor = outerEnd(span, side === 'left' ? 'right' : 'left') ? 3 : 4;
      if (!agrees(factor * span.EI / span.length, value, value)) continue;
      const [near, far] = side === 'left' ? [span.leftNodeId, span.rightNodeId] : [span.rightNodeId, span.leftNodeId];
      stiffnessWork.push({
        lhs: stiffnessLabel(near, far), symbolic: `${factor}EI/L`,
        substituted: `${factor}(${dimensionalFigure(project, span.EI, 1, 2)})/(${dimensionalFigure(project, span.length, 0, 1)})`,
        result: dimensionalFigure(project, value, 1, 1), unit: stiffnessUnit,
      });
    }
  }
  for (const [k, span] of spans.slice(0, -1).entries()) {
    const right = spans[k + 1]!;
    const node = span.rightNodeId;
    const kLeft = span.stiffnessRight;
    const kRight = right.stiffnessLeft;
    const total = kLeft + kRight;
    if (!(total > 0)) continue;
    const stiffness = (value: number) => dimensionalFigure(project, value, 1, 1, total);
    const leftLabel = stiffnessLabel(node, span.leftNodeId);
    const rightLabel = stiffnessLabel(node, right.rightNodeId);
    stiffnessWork.push(
      { lhs: `ΣK_{${node}}`, symbolic: `${leftLabel} + ${rightLabel}`, substituted: `${stiffness(kLeft)} + ${stiffness(kRight)}`, result: stiffness(total), unit: stiffnessUnit },
      { lhs: `FD_{${node}–${span.leftNodeId}}`, symbolic: `${leftLabel}/ΣK_{${node}}`, substituted: `(${stiffness(kLeft)})/(${stiffness(total)})`, result: number(kLeft / total) },
      { lhs: `FD_{${node}–${right.rightNodeId}}`, symbolic: `${rightLabel}/ΣK_{${node}}`, substituted: `(${stiffness(kRight)})/(${stiffness(total)})`, result: number(kRight / total) },
    );
  }
  memoirWork(context, stiffnessWork);

  memoirStep(context, '5.4 Reparto de momentos');
  const table = spans.length - 1 <= 5 ? crossTable(solution) : undefined;
  if (table) {
    memoirNote(context, `Los extremos articulados de la orilla se liberan una vez: su MEP pasa al nudo vecino con factor −1/2. `
      + 'Cada ciclo equilibra un nudo y transmite la mitad de lo repartido al extremo opuesto.');
    // Lo que ya no cambia la cuarta cifra se suma en un solo renglón, para que la tabla cierre.
    const significant = (row: CrossRow) => row.values.some((value) => value !== undefined && Math.abs(value) >= 5e-5 * momentScale);
    // MEP y liberación siempre; después, los ciclos mientras muevan la cuarta cifra.
    const shown: CrossRow[] = table.rows.slice(0, 2);
    const cycles = table.rows.slice(2);
    const rest = new Array<number>(table.columns.length).fill(0);
    let restCount = 0;
    for (const row of cycles) {
      if (!restCount && shown.length < 16 && significant(row)) {
        shown.push(row);
        continue;
      }
      restCount += 1;
      row.values.forEach((value, position) => { rest[position]! += value ?? 0; });
    }
    const cell = (value: number | undefined) => (value === undefined ? '' : cellText(moment(value)));
    layout.table(
      [{ header: `Extremo (${momentUnit})`, width: 128 }, ...table.columns.map((header) => ({ header, ...NUMERIC }))],
      [
        ['FD', ...table.factors.map((value) => (value === undefined ? '' : number(value)))],
        ...shown.map((row) => [row.label, ...row.values.map(cell)]),
        ...(restCount ? [[`Resto (${restCount} equilibrios)`, ...rest.map(cell)]] : []),
        ['M final', ...table.final.map(cell)],
      ],
      { size: TYPE.small - 0.6 },
    );
    memoirNote(context, `${solution.iterationCount
      ? `El reparto converge en ${solution.iterationCount} ciclo${solution.iterationCount === 1 ? '' : 's'}.`
      : 'Tras la liberación los nudos ya están en equilibrio.'} El momento flector en cada apoyo es el del extremo del vano a su derecha.`);
  } else {
    layout.table([
      { header: 'Apoyo' },
      { header: `M (${momentUnit})`, ...NUMERIC },
    ], solution.joints.map((joint) => [joint.nodeId, cellText(moment(joint.value))]));
  }
  const supportIds = [spans[0]!.leftNodeId, ...spans.map((span) => span.rightNodeId)];
  const jointMoment = new Map(solution.joints.map((joint) => [joint.nodeId, joint.value]));
  memoirResults(context, 'Momentos en los apoyos', supportIds.map((nodeId) => [`M(${nodeId})`, `${moment(jointMoment.get(nodeId) ?? 0)} ${momentUnit}`]));

  drawScenes(
    context,
    hardyCrossScenes(context, solution),
    (_scene, k) => `Vano ${k + 1} con los momentos de extremo después del reparto.`,
  );

  memoirStep(context, '5.5 Momento flector en cada vano');
  memoirFormula(context, 'M(x) = M_0(x) + M_i + (M_j − M_i)(x − x_i)/L', [
    ['M_0(x)', 'momento del vano simplemente apoyado bajo sus cargas'],
    ['M_i, M_j', 'momentos en los apoyos izquierdo y derecho del vano'],
    ['x_i', 'abscisa del apoyo izquierdo'],
  ]);
  const positionOf = new Map(solution.axis.stations.map((station) => [station.nodeId, station.x]));
  const span = solution.axis.length;
  memoirNote(context, `x en ${lengthUnit}, M en ${momentUnit}.`);
  for (const [k, segment] of solution.segments.entries()) {
    const lhs = `M_${stretchIndex(k)}(x)`;
    const final = unitPolynomial(project, segment.moment, [1, 1], span);
    const owner = spans.find((entry) => {
      const x0 = positionOf.get(entry.leftNodeId);
      const x1 = positionOf.get(entry.rightNodeId);
      return x0 !== undefined && x1 !== undefined && segment.x0 >= x0 - 1e-9 && segment.x1 <= x1 + 1e-9;
    });
    const xi = owner ? positionOf.get(owner.leftNodeId) : undefined;
    const range = `${dimensionalFigure(project, segment.x0, 0, 1)} ≤ x ≤ ${dimensionalFigure(project, segment.x1, 0, 1)} ${lengthUnit}`;
    if (!owner || xi === undefined || !(owner.length > 0)) {
      memoirWork(context, [`${lhs} = ${final}`], range);
      continue;
    }
    // M₀ es lo que queda al quitar la corrección lineal entre los dos momentos de apoyo.
    const slope = (owner.finalMomentRight - owner.finalMomentLeft) / owner.length;
    const free = segment.moment.map((coefficient, power) => coefficient - (power === 0 ? owner.finalMomentLeft - slope * xi : power === 1 ? slope : 0));
    const operand = (value: number) => {
      const text = moment(value);
      return text.startsWith('−') || text.startsWith('-') ? `(${text})` : text;
    };
    memoirWork(context, [{
      lhs,
      symbolic: 'M_0(x) + M_i + (M_j − M_i)(x − x_i)/L',
      substituted: `(${unitPolynomial(project, free, [1, 1], span)}) + ${operand(owner.finalMomentLeft)} `
        + `+ (${operand(owner.finalMomentRight)} − ${operand(owner.finalMomentLeft)})(x − ${dimensionalFigure(project, xi, 0, 1)})/${dimensionalFigure(project, owner.length, 0, 1)}`,
      result: final,
    }], `Vano ${owner.leftNodeId}–${owner.rightNodeId}: ${range}`);
  }

  memoirStep(context, '5.6 Comprobación');
  memoirCheck(
    context,
    `momentos de apoyo contra el análisis matricial, diferencia máxima ${moment(solution.momentResidual)} ${momentUnit}.`,
    solution.momentResidual <= 1e-3 * momentScale,
  );
};

/** `memoirWork` para los marcos: ni un pie solo al final de una página ni un pie sin ecuaciones. */
const keptWork = (context: ReportContext, equations: readonly EquationInput[], caption?: string): void => {
  if (!equations.length) return;
  if (caption) context.layout.ensure(TYPE.small * 1.5 + TYPE.math * 4);
  memoirWork(context, equations, caption);
};

const drawKaniFrame = (context: ReportContext, solution: KaniResult): void => {
  const { layout, project } = context;
  const lengthUnit = unitFor(project, 'length');
  const momentUnit = unitFor(project, 'moment');
  const stiffnessUnit = dimensionalUnit(project, 1, 1);
  const restrained = (nodeId: string): boolean => {
    const support = context.index.node(nodeId)?.support;
    return support?.type === 'fixed' || (support?.type === 'custom' && Boolean(support.restrainR));
  };
  // Kani's sign: the moment on the bar end, clockwise positive — the diagram value at i, its
  // negative at j. Every relation below is written in it, so M_ij = MEP_ij + 2M′_ij + M′_ji holds
  // at both ends alike.
  const ends = solution.members.flatMap((member) => [
    { member, nodeId: member.nodeI, farNodeId: member.nodeJ, fem: member.fixedEndMomentI, final: member.finalMomentI, solver: member.solverMomentI },
    { member, nodeId: member.nodeJ, farNodeId: member.nodeI, fem: -member.fixedEndMomentJ, final: -member.finalMomentJ, solver: -member.solverMomentJ },
  ]);
  const scale = Math.max(1e-9, ...ends.flatMap((end) => [Math.abs(end.final), Math.abs(end.fem)]));
  const moment = (value: number) => dimensionalFigure(project, value, 1, 1, scale);
  const key = (memberId: string, nodeId: string) => `${memberId}@${nodeId}`;
  // The converged rotation moments, recovered from the final moments: at both ends of a bar,
  // M − MEP = 2M′(here) + M′(far), two equations in the bar's two M′.
  const rotation = new Map<string, number>();
  for (const member of solution.members) {
    const di = member.finalMomentI - member.fixedEndMomentI;
    const dj = -member.finalMomentJ + member.fixedEndMomentJ;
    rotation.set(key(member.memberId, member.nodeI), (2 * di - dj) / 3);
    rotation.set(key(member.memberId, member.nodeJ), (2 * dj - di) / 3);
  }
  const rotationOf = (memberId: string, nodeId: string) => rotation.get(key(memberId, nodeId)) ?? 0;
  const joints = [...new Set(ends.map((end) => end.nodeId))]
    .filter((nodeId) => !restrained(nodeId))
    .map((nodeId) => {
      const here = ends.filter((end) => end.nodeId === nodeId);
      const stiffness = here.reduce((sum, end) => sum + end.member.EI / end.member.length, 0);
      return { nodeId, ends: here, stiffness, fem: here.reduce((sum, end) => sum + end.fem, 0) };
    });
  // A restrained end never rotates: if the recovery says otherwise, the worked iteration is not printed.
  const recovered = ends.every((end) => !restrained(end.nodeId) || Math.abs(rotationOf(end.member.memberId, end.nodeId)) <= 1e-6 * scale);

  layout.heading('5. Método de Kani (iteración de giros)');
  memoirNote(context, `Marco sin desplazamiento lateral, hiperestático de grado ${solution.classification.indeterminacy}. `
    + `Incógnitas: los momentos de giro M′ de ${joints.length} nudo${joints.length === 1 ? '' : 's'}, por iteración. EI constante por barra, primer orden.`);

  memoirStep(context, '5.1 Datos');
  layout.table([
    { header: 'Barra', width: 54 },
    { header: 'Nudos i – j', width: 96 },
    { header: `L (${lengthUnit})`, ...NUMERIC },
    { header: `EI (${dimensionalUnit(project, 1, 2)})`, ...NUMERIC },
    { header: `K = EI/L (${stiffnessUnit})`, ...NUMERIC },
  ], solution.members.map((member) => [
    member.memberId,
    `${member.nodeI} – ${member.nodeJ}`,
    dimensionalFigure(project, member.length, 0, 1),
    dimensionalFigure(project, member.EI, 1, 2),
    dimensionalFigure(project, member.EI / member.length, 1, 1),
  ]));
  memoirNote(context, 'Signos: momento sobre el extremo de la barra, horario positivo. Sin desplazamiento lateral: lo confirma la comprobación final.');

  memoirStep(context, '5.2 Factores de giro');
  memoirFormula(context, 'μ_{ij} = −(1/2) K_{ij}/ΣK_i', [
    ['K_{ij}', 'rigidez relativa de la barra ij, EI/L'],
    ['ΣK_i', 'suma de las rigideces de las barras que llegan al nudo i'],
    ['μ_{ij}', 'factor de giro; en cada nudo suman −1/2'],
  ]);
  const busiest = joints.reduce<(typeof joints)[number] | undefined>((best, joint) => (!best || joint.ends.length > best.ends.length ? joint : best), undefined);
  if (busiest && busiest.ends.length > 1) {
    const stiffness = (value: number) => dimensionalFigure(project, value, 1, 1, busiest.stiffness);
    keptWork(context, [
      {
        lhs: `ΣK(${busiest.nodeId})`, symbolic: 'Σ EI/L',
        substituted: busiest.ends.map((end) => stiffness(end.member.EI / end.member.length)).join(' + '),
        result: stiffness(busiest.stiffness), unit: stiffnessUnit,
      },
      ...busiest.ends.map((end) => ({
        lhs: `μ(${end.member.memberId}, ${busiest.nodeId})`, symbolic: '−(1/2) K/ΣK',
        substituted: `−(1/2)(${stiffness(end.member.EI / end.member.length)})/(${stiffness(busiest.stiffness)})`,
        result: number((-0.5 * end.member.EI) / end.member.length / busiest.stiffness, 4),
      })),
    ], `Nudo ${busiest.nodeId}:`);
  }
  layout.table([
    { header: 'Nudo', width: 70 },
    { header: 'Barra', width: 70 },
    { header: `K (${stiffnessUnit})`, ...NUMERIC },
    { header: `ΣK (${stiffnessUnit})`, ...NUMERIC },
    { header: 'μ', ...NUMERIC },
  ], joints.flatMap((joint) => joint.ends.map((end) => [
    joint.nodeId,
    end.member.memberId,
    dimensionalFigure(project, end.member.EI / end.member.length, 1, 1),
    dimensionalFigure(project, joint.stiffness, 1, 1),
    number((-0.5 * end.member.EI) / end.member.length / joint.stiffness, 4),
  ])));

  memoirStep(context, '5.3 Momentos de empotramiento y de sujeción');
  memoirFormula(context, 'ΣMEP_i = Σ_j MEP_{ij}', [
    ['MEP_{ij}', 'momento de empotramiento perfecto del extremo ij (barra aislada y empotrada)'],
    ['ΣMEP_i', 'momento de sujeción del nudo i'],
  ]);
  layout.table([
    { header: 'Barra', width: 70 },
    { header: 'Nudos i – j', width: 110 },
    { header: `MEP_ij (${momentUnit})`, ...NUMERIC },
    { header: `MEP_ji (${momentUnit})`, ...NUMERIC },
  ], solution.members.map((member) => [
    member.memberId,
    `${member.nodeI} – ${member.nodeJ}`,
    moment(member.fixedEndMomentI),
    moment(-member.fixedEndMomentJ),
  ]));
  keptWork(context, joints.map((joint) => (joint.ends.length > 1
    ? { lhs: `ΣMEP(${joint.nodeId})`, substituted: signedSum(joint.ends.map((end) => moment(end.fem))), result: moment(joint.fem), unit: momentUnit }
    : { lhs: `ΣMEP(${joint.nodeId})`, result: moment(joint.fem), unit: momentUnit })));

  memoirStep(context, '5.4 Iteración de los momentos de giro');
  memoirFormula(context, 'M′_{ij} = μ_{ij} R_i,     R_i = ΣMEP_i + Σ M′_{ji}', [
    ['M′_{ij}', 'momento de giro del extremo ij'],
    ['ΣM′_{ji}', 'momentos de giro del otro extremo de las barras que llegan a i (0 si está empotrado)'],
  ]);
  memoirNote(context, `Se recorre nudo por nudo con los valores más recientes; convergió en ${solution.iterationCount} pasada${solution.iterationCount === 1 ? '' : 's'}. Valores convergidos:`);
  if (recovered) {
    const equations: EquationInput[] = [];
    for (const joint of joints) {
      const far = joint.ends.map((end) => rotationOf(end.member.memberId, end.farNodeId));
      const R = joint.fem + far.reduce((sum, value) => sum + value, 0);
      const closes = joint.ends.every((end) => agrees(
        (-0.5 * end.member.EI) / end.member.length / joint.stiffness * R,
        rotationOf(end.member.memberId, joint.nodeId),
        scale,
      ));
      if (!closes) continue;
      equations.push({
        lhs: `R(${joint.nodeId})`, symbolic: 'ΣMEP + ΣM′_{ji}',
        substituted: signedSum([moment(joint.fem), ...far.map((value) => moment(value))]),
        result: moment(R), unit: momentUnit,
      });
      for (const end of joint.ends) {
        const mu = (-0.5 * end.member.EI) / end.member.length / joint.stiffness;
        equations.push({
          lhs: `M′(${end.member.memberId}, ${joint.nodeId})`, symbolic: 'μ R',
          substituted: `(${number(mu, 4)})(${moment(R)})`,
          result: moment(rotationOf(end.member.memberId, joint.nodeId)), unit: momentUnit,
        });
      }
    }
    keptWork(context, equations);
  }

  memoirStep(context, '5.5 Momentos finales');
  memoirFormula(context, 'M_{ij} = MEP_{ij} + 2M′_{ij} + M′_{ji}');
  if (recovered) {
    keptWork(context, ends.flatMap((end) => {
      const here = rotationOf(end.member.memberId, end.nodeId);
      const far = rotationOf(end.member.memberId, end.farNodeId);
      if (!agrees(end.fem + 2 * here + far, end.final, scale)) return [];
      return [{
        lhs: `M(${end.member.memberId}, ${end.nodeId})`, symbolic: 'MEP + 2M′_{ij} + M′_{ji}',
        substituted: `${moment(end.fem)} + 2(${moment(here)}) + (${moment(far)})`,
        result: moment(end.final), unit: momentUnit,
      }];
    }));
  }
  const governing = solution.members.length <= 6
    ? ends
    : solution.members.map((member) => ends.filter((end) => end.member === member).reduce((a, b) => (Math.abs(b.final) > Math.abs(a.final) ? b : a)));
  memoirResults(context, solution.members.length <= 6 ? 'Momentos finales de extremo' : 'Momento de extremo mayor por barra',
    governing.map((end) => [`M(${end.member.memberId}, ${end.nodeId})`, `${moment(end.final)} ${momentUnit}`] as const));

  drawScenes(
    context,
    kaniScenes(context, solution),
    (_scene, index) => `Barra ${solution.members[index]?.memberId ?? index + 1}: momentos finales (signos del diagrama) y MEP de partida.`,
  );

  memoirStep(context, '5.6 Comprobación');
  layout.table([
    { header: 'Barra', width: 70 },
    { header: `M_ij Kani (${momentUnit})`, ...NUMERIC },
    { header: `M_ji Kani (${momentUnit})`, ...NUMERIC },
    { header: `M_ij matricial (${momentUnit})`, ...NUMERIC },
    { header: `M_ji matricial (${momentUnit})`, ...NUMERIC },
  ], solution.members.map((member) => [
    member.memberId,
    moment(member.finalMomentI),
    moment(-member.finalMomentJ),
    moment(member.solverMomentI),
    moment(-member.solverMomentJ),
  ]));
  const reference = Math.max(...ends.map((end) => Math.abs(end.solver)));
  memoirCheck(
    context,
    `Kani frente al análisis matricial, diferencia máxima ${dimensionalFigure(project, solution.momentResidual, 1, 1, 1)} ${momentUnit}.`,
    solution.momentResidual <= Math.max(1e-6, reference * 1e-4),
  );
};

const drawMethodOfSections = (context: ReportContext, solution: MethodOfSectionsResult): void => {
  const { layout, project, index } = context;
  const { fonts, palette } = layout;
  const forceUnit = unitFor(project, 'force');

  layout.heading('5. Procedimiento: Cortes / secciones');
  layout.text(
    'Cada corte atraviesa tres barras o menos. El DCL conserva un lado de la armadura y resuelve '
    + 'ΣFx = 0, ΣFy = 0 y ΣM = 0 con sus cargas, reacciones y cosenos directores reales.',
    8.7, fonts.regular, undefined, 8,
  );

  layout.heading('5.1 Cortes y fuerzas de barra', 2);
  layout.text(
    'La última columna es lo que el análisis matricial obtiene para esa misma barra: el método '
    + 'y el solver tienen que coincidir.',
    8.3, fonts.regular, undefined, 8,
  );
  for (const [cutIndex, cut] of solution.cuts.entries()) {
    layout.ensure(40);
    layout.text(
      `Corte ${cutIndex + 1}: lado conservado {${cut.keptNodeIds.join(', ')}}`,
      8, fonts.bold, palette.ink, 8,
    );
    drawCalculationRecords(context,
      [
        { header: 'Barra', width: 70 },
        { header: `Método de cortes (${forceUnit})`, ...NUMERIC },
        { header: `Análisis matricial (${forceUnit})`, ...NUMERIC },
      ],
      cut.members.map((member) => [
        member.memberId,
        displayCell(project, member.value, 'force'),
        displayCell(project, member.solverValue, 'force'),
      ]),
      { size: 7.6 },
    );
    // The cut itself, before its arithmetic: which side was kept, where the imaginary line
    // runs, and the axial force each severed bar exerts on that side.
    drawScenes(
      context,
      sectionCutScenes(context, { ...solution, cuts: [cut] }),
      () => `Corte ${cutIndex + 1}: cuerpo libre de {${cut.keptNodeIds.join(', ')}} y las fuerzas de barra que el corte expone.`,
    );
    // The same equilibrium the cut was solved with, added up: each severed bar's force times
    // its own direction cosine, plus the reactions and loads of the retained nodes.
    const kept = new Set(cut.keptNodeIds);
    const bars = cut.members.flatMap((member) => {
      const model = index.member(member.memberId);
      if (!model) return [];
      const nodeId = kept.has(model.i) ? model.i : kept.has(model.j) ? model.j : undefined;
      return nodeId ? [{ memberId: member.memberId, nodeId, force: member.value }] : [];
    });
    drawWorked(context, undefined, freeBodyEquations(context, cut.keptNodeIds, bars));
  }
  if (solution.unresolvedMemberIds.length) {
    layout.text(
      `Sin un corte de tres barras o menos que las aísle: ${solution.unresolvedMemberIds.join(', ')}.`,
      7.8, fonts.regular, undefined, 8,
    );
  }

  layout.heading('5.2 Verificación contra el análisis matricial', 2);
  layout.text(
    `Diferencia máxima, en cualquier barra resuelta: ${clearNumber(solution.residual, 1)} ${forceUnit}.`,
    8.7, fonts.bold, palette.ink, 8,
  );
};

const drawMethodOfJoints = (context: ReportContext, solution: MethodOfJointsResult): void => {
  const { layout, project } = context;
  const { fonts, palette } = layout;
  const forceUnit = unitFor(project, 'force');

  layout.heading('5. Procedimiento: Método de los Nudos');
  layout.text(
    'Cada nudo de la armadura tiene sólo dos ecuaciones de equilibrio —la suma horizontal y la '
    + 'vertical de las fuerzas que concurren en él—, así que '
    + 'un nudo sólo se resuelve de una vez cuando le quedan como mucho dos fuerzas de barra por '
    + 'conocer. El procedimiento recorre los nudos en el orden en que esa condición se va '
    + 'cumpliendo —normalmente empezando en un apoyo o un extremo libre— resolviendo en cada uno '
    + 'las fuerzas que aún faltan a partir de las reacciones, las cargas y las barras ya resueltas '
    + 'que concurren ahí, y repite hasta agotar la armadura.',
    8.7, fonts.regular, undefined, 8,
  );

  layout.heading('5.1 Nudos y fuerzas de barra', 2);
  layout.text(
    'La última columna es lo que el análisis matricial obtiene para esa misma barra: el método y '
    + 'el solver tienen que coincidir. El orden de los nudos es el orden en que el procedimiento '
    + 'pudo resolverlos, no el orden en que aparecen en el modelo.',
    8.3, fonts.regular, undefined, 8,
  );
  for (const [stepIndex, step] of solution.steps.entries()) {
    layout.ensure(40);
    layout.text(`Nudo ${stepIndex + 1}: ${step.nodeId}`, 8, fonts.bold, palette.ink, 8);
    drawCalculationRecords(context,
      [
        { header: 'Barra', width: 70 },
        { header: `Método de los nudos (${forceUnit})`, ...NUMERIC },
        { header: `Análisis matricial (${forceUnit})`, ...NUMERIC },
      ],
      step.members.map((member) => [
        member.memberId,
        displayCell(project, member.value, 'force'),
        displayCell(project, member.solverValue, 'force'),
      ]),
      { size: 7.6 },
    );
    drawScenes(
      context,
      jointScenes(context, { ...solution, steps: [step] }),
      () => `Nudo ${step.nodeId}: cuerpo libre del nudo con cada barra concurrente, su reacción y su carga.`,
    );
    // Every bar meeting this joint — the ones just solved and the ones already known — times
    // its direction cosine, plus the reaction and the load applied there: the two sums the
    // reader would write by hand, closed on zero.
    const meeting = project.members
      .filter((member) => member.i === step.nodeId || member.j === step.nodeId)
      .flatMap((member) => {
        const force = solution.steps
          .flatMap((entry) => entry.members)
          .find((entry) => entry.memberId === member.id);
        return force ? [{ memberId: member.id, nodeId: step.nodeId, force: force.value }] : [];
      });
    drawWorked(context, undefined, freeBodyEquations(context, [step.nodeId], meeting));
  }
  if (solution.unresolvedMemberIds.length) {
    layout.text(
      `Ningún nudo llegó a tener dos o menos incógnitas para resolver: ${solution.unresolvedMemberIds.join(', ')}.`,
      7.8, fonts.regular, undefined, 8,
    );
  }

  layout.heading('5.2 Verificación contra el análisis matricial', 2);
  layout.text(
    `Diferencia máxima, en cualquier barra resuelta: ${clearNumber(solution.residual, 1)} ${forceUnit}.`,
    8.7, fonts.bold, palette.ink, 8,
  );
};

export const REJECTION_MESSAGE = 'El método elegido no aplica a esta estructura; el procedimiento se reporta con el método matricial.';

const drawPortalMethod = (context: ReportContext, solution: PortalMethodResult): void => {
  const { layout, project } = context;
  const lengthUnit = unitFor(project, 'length');
  const forceUnit = unitFor(project, 'force');
  const momentUnit = unitFor(project, 'moment');
  const { grid } = solution;
  const stories = grid.storyLevels.length - 1;
  const forceScale = Math.max(1e-9, ...solution.storyShear.map((value) => Math.abs(value)));
  const momentScale = Math.max(1e-9, ...solution.columns.flatMap((column) => [Math.abs(column.bottomMoment), Math.abs(column.topMoment)]), ...solution.beams.map((beam) => Math.abs(beam.moment)));
  const force = (value: number) => dimensionalFigure(project, value, 1, 0, forceScale);
  const moment = (value: number) => dimensionalFigure(project, value, 1, 1, momentScale);
  const length = (value: number) => dimensionalFigure(project, value, 0, 1);
  const where = (column: { columnIndex: number; story: number }) => `${lineLabel(column.columnIndex)}, planta ${column.story}`;
  const beamAt = (bay: number, story: number) => solution.beams.find((beam) => beam.bayIndex === bay && beam.story === story);

  layout.heading('5. Método del Portal');
  memoirNote(context, `Pórtico de ${grid.columnLines.length} ejes y ${stories} planta${stories === 1 ? '' : 's'} bajo carga lateral. Método aproximado: `
    + 'dos hipótesis lo vuelven isostático y su diferencia con el análisis matricial se declara al final.');
  layout.bullets([
    'Punto de inflexión a media altura de cada columna y a media luz de cada viga (en el apoyo si éste no restringe el giro).',
    'El cortante de cada planta se reparte entre sus columnas en proporción a su ancho tributario.',
  ]);
  drawLateralScope(context, solution.excluded, 'Método del Portal');

  memoirStep(context, '5.1 Datos');
  drawLateralConversions(context, solution.conversions, solution.jointLoads);
  const widths = grid.columnLines.map((_, index) => solution.columns.find((column) => column.columnIndex === index)?.tributaryWidth ?? 0);
  layout.table([
    { header: 'Eje', width: 60 },
    { header: `x (${lengthUnit})`, ...NUMERIC },
    { header: `Ancho tributario a (${lengthUnit})`, ...NUMERIC },
  ], grid.columnLines.map((x, index) => [lineLabel(index), length(x), length(widths[index] ?? 0)]));
  drawStoreyData(context, grid, solution.jointLoads);

  memoirStep(context, '5.2 Cortante de planta');
  memoirFormula(context, 'V_n = Σ_{k ≥ n} F_k', [
    ['F_k', 'fuerza lateral en el nivel superior de la planta k'],
    ['V_n', 'cortante de la planta n'],
  ]);
  keptWork(context, solution.storyShear.map((shear, position) => {
    const above = Array.from({ length: stories - position }, (_, offset) => levelLoad(grid, solution.jointLoads, position + 1 + offset));
    return above.length > 1
      ? { lhs: `V_${position + 1}`, substituted: signedSum(above.map((value) => force(value))), result: force(shear), unit: forceUnit }
      : { lhs: `V_${position + 1}`, result: force(shear), unit: forceUnit };
  }));

  memoirStep(context, '5.3 Cortante y momentos en columnas');
  memoirFormula(context, 'V_c = V_n a_c/Σa,     M_{inf} = V_c y_0,     M_{sup} = V_c (h − y_0)', [
    ['a_c, Σa', 'ancho tributario de la columna y suma de la planta'],
    ['y_0', 'altura del punto de inflexión: h/2, o 0 sobre un apoyo que no restringe el giro'],
  ]);
  memoirNote(context, 'Los momentos se escriben en valor absoluto; en la tabla, con su signo (momento sobre el nudo, antihorario positivo).');
  for (let story = 1; story <= stories; story += 1) {
    const columns = solution.columns.filter((column) => column.story === story);
    const widthTotal = columns.reduce((sum, column) => sum + column.tributaryWidth, 0);
    const storyShear = solution.storyShear[story - 1] ?? 0;
    if (!(widthTotal > 0)) continue;
    const equations: EquationInput[] = [];
    for (const column of columns) {
      if (agrees(storyShear * column.tributaryWidth / widthTotal, column.shear, forceScale)) {
        equations.push({
          lhs: `V(${where(column)})`, symbolic: 'V_n a_c/Σa',
          substituted: `(${force(storyShear)})(${length(column.tributaryWidth)})/(${length(widthTotal)})`,
          result: force(column.shear), unit: forceUnit,
        });
      }
      const y0 = column.height * column.inflectionFraction;
      if (Math.abs(column.bottomMoment) > 1e-9 * momentScale && agrees(Math.abs(column.bottomMoment), Math.abs(column.shear * y0), momentScale)) {
        equations.push({
          lhs: `M_{inf}(${where(column)})`, symbolic: 'V_c y_0',
          substituted: `(${force(Math.abs(column.shear))})(${length(y0)})`,
          result: moment(Math.abs(column.bottomMoment)), unit: momentUnit,
        });
      }
      if (agrees(Math.abs(column.topMoment), Math.abs(column.shear * (column.height - y0)), momentScale)
        && Math.abs(column.inflectionFraction - 0.5) > 1e-9) {
        equations.push({
          lhs: `M_{sup}(${where(column)})`, symbolic: 'V_c (h − y_0)',
          substituted: `(${force(Math.abs(column.shear))})(${length(column.height - y0)})`,
          result: moment(Math.abs(column.topMoment)), unit: momentUnit,
        });
      }
    }
    keptWork(context, equations, `Planta ${story}: Σa = ${length(widthTotal)} ${lengthUnit}.`);
  }
  drawScenes(
    context,
    portalScenes(context, solution),
    (scene) => scene.title?.startsWith('planta') === true
      ? `${scene.title}: corte por los puntos de inflexión, con el cortante de planta y lo que toma cada columna.`
      : `${scene.title}: la columna aislada con su cortante y los momentos que produce en sus extremos.`,
  );

  memoirStep(context, '5.4 Vigas: momento y cortante');
  memoirFormula(context, 'M_{der} = −(M_{sup} + M′_{inf}) − M_{izq},     V_v = −2M/L', [
    ['M_{sup}, M′_{inf}', 'momentos sobre el nudo de la columna de abajo y de la de arriba'],
    ['M_{izq}, M_{der}', 'momentos sobre el nudo de las vigas a su izquierda (0 en el eje exterior) y a su derecha'],
    ['L', 'luz de la viga; momentos antihorarios positivos'],
  ]);
  keptWork(context, solution.beams.flatMap((beam) => {
    const below = solution.columns.find((column) => column.columnIndex === beam.bayIndex && column.story === beam.story);
    const above = solution.columns.find((column) => column.columnIndex === beam.bayIndex && column.story === beam.story + 1);
    const left = beamAt(beam.bayIndex - 1, beam.story)?.moment ?? 0;
    if (!below) return [];
    const value = -(below.topMoment + (above?.bottomMoment ?? 0)) - left;
    if (!agrees(value, beam.moment, momentScale)) return [];
    return [{
      lhs: `M(${lineLabel(beam.bayIndex)}–${lineLabel(beam.bayIndex + 1)}, planta ${beam.story})`, symbolic: '−(M_{sup} + M′_{inf}) − M_{izq}',
      substituted: `−((${moment(below.topMoment)}) + (${moment(above?.bottomMoment ?? 0)})) − (${moment(left)})`,
      result: moment(beam.moment), unit: momentUnit,
    }];
  }));
  keptWork(context, beamShearEquations(context, solution.beams, lineLabel), 'Cortante de cada viga, en valor absoluto, |V| = 2|M|/L:');
  layout.table([
    { header: 'Vano', width: 70 },
    { header: 'Planta', width: 50 },
    { header: `L (${lengthUnit})`, ...NUMERIC },
    { header: `M (${momentUnit})`, ...NUMERIC },
    { header: `V (${forceUnit})`, ...NUMERIC },
  ], solution.beams.map((beam) => [
    `${lineLabel(beam.bayIndex)}–${lineLabel(beam.bayIndex + 1)}`,
    String(beam.story),
    length(beam.span),
    moment(beam.moment),
    force(beam.shear),
  ]));

  memoirStep(context, '5.5 Axiales de columna');
  memoirFormula(context, 'N = N′ − 2M_{izq}/L_{izq} + 2M_{der}/L_{der}', [
    ['N′', 'axial de la columna de arriba (0 bajo la cubierta); se recorre de arriba abajo'],
    ['M_{izq}, M_{der}', 'momento de la viga a la izquierda y a la derecha del nudo'],
    ['N', 'axial de la columna, positiva en tensión'],
  ]);
  const axialScale = Math.max(forceScale, ...solution.columns.map((column) => Math.abs(column.axial)));
  keptWork(context, [...solution.columns].sort((a, b) => a.columnIndex - b.columnIndex || b.story - a.story).flatMap((column) => {
    const above = solution.columns.find((entry) => entry.columnIndex === column.columnIndex && entry.story === column.story + 1);
    const left = beamAt(column.columnIndex - 1, column.story);
    const right = beamAt(column.columnIndex, column.story);
    const value = (above?.axial ?? 0) - (left ? (2 * left.moment) / left.span : 0) + (right ? (2 * right.moment) / right.span : 0);
    if (!agrees(value, column.axial, axialScale)) return [];
    const terms = [
      dimensionalFigure(project, above?.axial ?? 0, 1, 0, axialScale),
      ...(left ? [`− 2(${moment(left.moment)})/(${length(left.span)})`] : []),
      ...(right ? [`+ 2(${moment(right.moment)})/(${length(right.span)})`] : []),
    ];
    return [{
      lhs: `N(${where(column)})`, symbolic: 'N′ − 2M_{izq}/L_{izq} + 2M_{der}/L_{der}',
      substituted: terms.join(' '),
      result: dimensionalFigure(project, column.axial, 1, 0, axialScale), unit: forceUnit,
    }];
  }));
  layout.table([
    { header: 'Columna', width: 60 },
    { header: 'Planta', width: 50 },
    { header: `a (${lengthUnit})`, ...NUMERIC },
    { header: `V (${forceUnit})`, ...NUMERIC },
    { header: `M_inf (${momentUnit})`, ...NUMERIC },
    { header: `M_sup (${momentUnit})`, ...NUMERIC },
    { header: `N (${forceUnit})`, ...NUMERIC },
  ], solution.columns.map((column) => [
    `${lineLabel(column.columnIndex)} (${column.memberId})`,
    String(column.story),
    length(column.tributaryWidth),
    force(column.shear),
    moment(column.bottomMoment),
    moment(column.topMoment),
    dimensionalFigure(project, column.axial, 1, 0, axialScale),
  ]));

  drawLateralBaseCheck(context, solution.baseChecks, solution.reactionGap, 'Portal', '5.6 Comprobación');
};

const drawCantileverMethod = (context: ReportContext, solution: CantileverMethodResult): void => {
  const { layout, project, index } = context;
  const lengthUnit = unitFor(project, 'length');
  const forceUnit = unitFor(project, 'force');
  const momentUnit = unitFor(project, 'moment');
  const { grid } = solution;
  const stories = grid.storyLevels.length - 1;
  const forceScale = Math.max(1e-9, ...solution.columns.flatMap((column) => [Math.abs(column.shear), Math.abs(column.axial)]));
  const momentScale = Math.max(1e-9, ...solution.columns.flatMap((column) => [Math.abs(column.bottomMoment), Math.abs(column.topMoment)]), ...solution.beams.map((beam) => Math.abs(beam.moment)));
  const force = (value: number) => dimensionalFigure(project, value, 1, 0, forceScale);
  const moment = (value: number) => dimensionalFigure(project, value, 1, 1, momentScale);
  const length = (value: number) => dimensionalFigure(project, value, 0, 1);
  const area = (value: number) => dimensionalFigure(project, value, 0, 2);
  const where = (column: { columnIndex: number; story: number }) => `${lineLabel(column.columnIndex)}, planta ${column.story}`;
  const beamAt = (bay: number, story: number) => solution.beams.find((beam) => beam.bayIndex === bay && beam.story === story);
  const columnAt = (line: number, story: number) => solution.columns.find((column) => column.columnIndex === line && column.story === story);
  const areaOf = (memberId: string) => index.member(memberId)?.A ?? 0;

  layout.heading('5. Método del Voladizo');
  memoirNote(context, `Pórtico de ${grid.columnLines.length} ejes y ${stories} planta${stories === 1 ? '' : 's'} bajo carga lateral. Método aproximado: `
    + 'dos hipótesis lo vuelven isostático y su diferencia con el análisis matricial se declara al final.');
  layout.bullets([
    'Punto de inflexión a media altura de cada columna y a media luz de cada viga (en el apoyo si éste no restringe el giro).',
    'En cada planta, la axial de cada columna es proporcional a su área y a su distancia al centroide de las áreas: la fila de '
      + 'columnas trabaja como la sección de un voladizo.',
  ]);
  drawLateralScope(context, solution.excluded, 'Método del Voladizo');

  memoirStep(context, '5.1 Datos');
  drawLateralConversions(context, solution.conversions, solution.jointLoads);
  layout.table([
    { header: 'Columna', width: 80 },
    { header: 'Planta', width: 50 },
    { header: `x (${lengthUnit})`, ...NUMERIC },
    { header: `A (${dimensionalUnit(project, 0, 2)})`, ...NUMERIC },
  ], solution.columns.map((column) => [
    `${lineLabel(column.columnIndex)} (${column.memberId})`,
    String(column.story),
    length(grid.columnLines[column.columnIndex] ?? 0),
    area(areaOf(column.memberId)),
  ]));
  drawStoreyData(context, grid, solution.jointLoads);

  // The flexure analogy, storey by storey: centroid, ΣA·d², overturning moment, and the axial of
  // every column from them. Printed only where it rebuilds the axial forces the method found.
  const storeys = Array.from({ length: stories }, (_, offset) => {
    const story = offset + 1;
    const columns = solution.columns.filter((column) => column.story === story);
    const areas = columns.map((column) => areaOf(column.memberId));
    const totalArea = areas.reduce((sum, value) => sum + value, 0);
    const centroid = totalArea > 0 ? columns.reduce((sum, column, k) => sum + areas[k] * (grid.columnLines[column.columnIndex] ?? 0), 0) / totalArea : 0;
    const inertia = columns.reduce((sum, column, k) => sum + areas[k] * column.centroidDistance ** 2, 0);
    const cut = grid.storyLevels[story - 1] + (columns[0]?.inflectionFraction ?? 0.5) * (grid.storyLevels[story] - grid.storyLevels[story - 1]);
    const levels = Array.from({ length: stories - story + 1 }, (_, k) => story + k);
    const overturning = levels.reduce((sum, level) => sum + levelLoad(grid, solution.jointLoads, level) * (grid.storyLevels[level] - cut), 0);
    const closes = inertia > 0 && columns.every((column, k) => agrees(-overturning * areas[k] * column.centroidDistance / inertia, column.axial, forceScale))
      && columns.every((column) => agrees(column.centroidDistance, (grid.columnLines[column.columnIndex] ?? 0) - centroid, 1));
    return { story, columns, areas, totalArea, centroid, inertia, cut, levels, overturning, closes };
  });

  memoirStep(context, '5.2 Centroide y momento de vuelco');
  memoirFormula(context, 'x̄ = ΣA x/ΣA,     M_v = Σ_{k ≥ n} F_k (z_k − z_c)', [
    ['x̄', 'centroide de las áreas de las columnas de la planta'],
    ['F_k, z_k', 'fuerza lateral y altura de cada nivel por encima del corte'],
    ['z_c', 'altura del corte: el punto de inflexión de las columnas de la planta'],
  ]);
  for (const storey of storeys) {
    if (!storey.closes) continue;
    keptWork(context, [
      {
        lhs: `x̄_${storey.story}`, symbolic: 'ΣA x/ΣA',
        substituted: `(${storey.columns.map((column, k) => `(${area(storey.areas[k])})(${length(grid.columnLines[column.columnIndex] ?? 0)})`).join(' + ')})/(${area(storey.totalArea)})`,
        result: length(storey.centroid), unit: lengthUnit,
      },
      {
        lhs: `ΣA d^2`, symbolic: 'ΣA (x − x̄)^2',
        substituted: storey.columns.map((column, k) => `(${area(storey.areas[k])})(${length(column.centroidDistance)})^2`).join(' + '),
        result: dimensionalFigure(project, storey.inertia, 0, 4), unit: dimensionalUnit(project, 0, 4),
      },
      {
        lhs: `M_{v${storey.story}}`, symbolic: 'Σ F_k (z_k − z_c)',
        substituted: storey.levels.map((level) => `(${force(levelLoad(grid, solution.jointLoads, level))})(${length(grid.storyLevels[level])} − ${length(storey.cut)})`).join(' + '),
        result: moment(storey.overturning), unit: momentUnit,
      },
    ], `Planta ${storey.story} (z_c = ${length(storey.cut)} ${lengthUnit}):`);
  }

  memoirStep(context, '5.3 Axial de columnas');
  memoirFormula(context, 'N_c = −M_v A_c d_c/Σ(A d^2)', [
    ['d_c', 'distancia de la columna al centroide, x_c − x̄, positiva hacia +x'],
    ['N_c', 'axial, positiva en tensión: con carga hacia +x queda a tensión el lado de −x'],
  ]);
  for (const storey of storeys) {
    if (storey.closes) {
      keptWork(context, storey.columns.map((column, k) => ({
        lhs: `N(${where(column)})`, symbolic: '−M_v A d/ΣA d^2',
        substituted: `−(${moment(storey.overturning)})(${area(storey.areas[k])})(${length(column.centroidDistance)})/(${dimensionalFigure(project, storey.inertia, 0, 4)})`,
        result: force(column.axial), unit: forceUnit,
      })));
      continue;
    }
    // Without the overturning moment rebuilt, the hypothesis is still shown: N/(A·d) is one number per storey.
    const quotients = storey.columns.flatMap((column, k) => {
      const denominator = storey.areas[k] * column.centroidDistance;
      return Math.abs(denominator) < 1e-12 ? [] : [{ column, area: storey.areas[k], quotient: column.axial / denominator }];
    });
    if (quotients.length < 2) continue;
    keptWork(context, quotients.map(({ column, area: value, quotient }) => ({
      lhs: `N/(A d)(${where(column)})`,
      substituted: `(${force(column.axial)})/((${area(value)})(${length(column.centroidDistance)}))`,
      result: number(dimensionalValue(project, quotient, 1, -3), 4), unit: dimensionalUnit(project, 1, -3),
    })), `Planta ${storey.story}: N/(A d) es el mismo en cada columna, la hipótesis del método.`);
  }

  memoirStep(context, '5.4 Vigas: momento y cortante');
  memoirFormula(context, 'M = (L/2)(N − N′ + 2M_{izq}/L_{izq}),     V_v = −2M/L', [
    ['N, N′', 'axial de la columna bajo el nudo izquierdo de la viga y de la de arriba (0 bajo la cubierta)'],
    ['M_{izq}, L_{izq}', 'momento y luz de la viga a la izquierda del nudo (0 en el eje exterior)'],
  ]);
  keptWork(context, solution.beams.flatMap((beam) => {
    const below = columnAt(beam.bayIndex, beam.story);
    const above = columnAt(beam.bayIndex, beam.story + 1);
    const left = beamAt(beam.bayIndex - 1, beam.story);
    if (!below) return [];
    const value = (beam.span / 2) * (below.axial - (above?.axial ?? 0) + (left ? (2 * left.moment) / left.span : 0));
    if (!agrees(value, beam.moment, momentScale)) return [];
    return [{
      lhs: `M(${lineLabel(beam.bayIndex)}–${lineLabel(beam.bayIndex + 1)}, planta ${beam.story})`, symbolic: '(L/2)(N − N′ + 2M_{izq}/L_{izq})',
      substituted: `(${length(beam.span)}/2)((${force(below.axial)}) − (${force(above?.axial ?? 0)})`
        + (left ? ` + 2(${moment(left.moment)})/(${length(left.span)}))` : ')'),
      result: moment(beam.moment), unit: momentUnit,
    }];
  }));
  keptWork(context, beamShearEquations(context, solution.beams, lineLabel), 'Cortante de cada viga, en valor absoluto, |V| = 2|M|/L:');
  layout.table([
    { header: 'Vano', width: 70 },
    { header: 'Planta', width: 50 },
    { header: `L (${lengthUnit})`, ...NUMERIC },
    { header: `M (${momentUnit})`, ...NUMERIC },
    { header: `V (${forceUnit})`, ...NUMERIC },
  ], solution.beams.map((beam) => [
    `${lineLabel(beam.bayIndex)}–${lineLabel(beam.bayIndex + 1)}`,
    String(beam.story),
    length(beam.span),
    moment(beam.moment),
    force(beam.shear),
  ]));

  memoirStep(context, '5.5 Columnas: momentos y cortante');
  memoirFormula(context, 'M_{sup} = −(M′_{inf} + M_{izq} + M_{der}),     V = −M_{sup}/(h − y_0),     M_{inf} = −V y_0', [
    ['M′_{inf}', 'momento sobre el nudo de la columna de arriba (0 bajo la cubierta), de arriba abajo'],
    ['M_{izq}, M_{der}', 'momentos sobre el nudo de las vigas a su izquierda y a su derecha'],
    ['y_0', 'altura del punto de inflexión: h/2, o 0 sobre un apoyo que no restringe el giro'],
  ]);
  keptWork(context, [...solution.columns].sort((a, b) => a.columnIndex - b.columnIndex || b.story - a.story).flatMap((column) => {
    const above = columnAt(column.columnIndex, column.story + 1);
    const left = beamAt(column.columnIndex - 1, column.story);
    const right = beamAt(column.columnIndex, column.story);
    const top = -((above?.bottomMoment ?? 0) + (left?.moment ?? 0) + (right?.moment ?? 0));
    const clearance = column.height * (1 - column.inflectionFraction);
    if (!agrees(top, column.topMoment, momentScale) || !(clearance > 0) || !agrees(-column.topMoment / clearance, column.shear, forceScale)) return [];
    return [
      {
        lhs: `M_{sup}(${where(column)})`, symbolic: '−(M′_{inf} + M_{izq} + M_{der})',
        substituted: `−((${moment(above?.bottomMoment ?? 0)}) + (${moment(left?.moment ?? 0)}) + (${moment(right?.moment ?? 0)}))`,
        result: moment(column.topMoment), unit: momentUnit,
      },
      {
        lhs: `V(${where(column)})`, symbolic: '−M_{sup}/(h − y_0)',
        substituted: `−(${moment(column.topMoment)})/(${length(clearance)})`,
        result: force(column.shear), unit: forceUnit,
      },
    ];
  }));
  layout.table([
    { header: 'Columna', width: 60 },
    { header: 'Planta', width: 50 },
    { header: `d (${lengthUnit})`, ...NUMERIC },
    { header: `N (${forceUnit})`, ...NUMERIC },
    { header: `V (${forceUnit})`, ...NUMERIC },
    { header: `M_inf (${momentUnit})`, ...NUMERIC },
    { header: `M_sup (${momentUnit})`, ...NUMERIC },
  ], solution.columns.map((column) => [
    `${lineLabel(column.columnIndex)} (${column.memberId})`,
    String(column.story),
    length(column.centroidDistance),
    force(column.axial),
    force(column.shear),
    moment(column.bottomMoment),
    moment(column.topMoment),
  ]));
  drawScenes(
    context,
    cantileverScenes(context, solution),
    (scene) => scene.title?.startsWith('planta') === true
      ? `${scene.title}: corte por los puntos de inflexión, con la resultante lateral y lo que toma cada columna.`
      : `${scene.title}: la columna aislada con su cortante y los momentos que produce en sus extremos.`,
  );

  drawLateralBaseCheck(context, solution.baseChecks, solution.reactionGap, 'Voladizo', '5.6 Comprobación');
};

/**
 * Draws the selected method's section, or reports that it could not.
 *
 * Returns `false` when no method-specific section was written, so the caller can fall back to
 * the generic procedure rather than leaving the document with a hole where section 5 was.
 */
export const drawMethodSection = (context: ReportContext): boolean => {
  const { project, analysis, solutionMethod, combination } = context;
  if (solutionMethod === 'double-integration') {
    const solution = solveDoubleIntegration(project, analysis, combination);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawDoubleIntegration(context, solution);
    return true;
  }
  if (solutionMethod === 'conjugate-beam') {
    const solution = solveConjugateBeam(project, analysis, combination);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawConjugateBeam(context, solution);
    return true;
  }
  if (solutionMethod === 'portal-method') {
    const solution = solvePortalMethod(project, combination);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawPortalMethod(context, solution);
    return true;
  }
  if (solutionMethod === 'cantilever-method') {
    const solution = solveCantileverMethod(project, combination);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawCantileverMethod(context, solution);
    return true;
  }
  if (solutionMethod === 'three-moment') {
    const solution = solveThreeMoment(project, analysis, combination);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawThreeMoment(context, solution);
    return true;
  }
  if (solutionMethod === 'hardy-cross') {
    const solution = solveHardyCross(project, analysis, combination);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawHardyCross(context, solution);
    return true;
  }
  if (solutionMethod === 'kani-frame') {
    const solution = solveKaniFrame(project, analysis, combination);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawKaniFrame(context, solution);
    return true;
  }
  if (solutionMethod === 'virtual-work') {
    const solution = solveVirtualWork(project, analysis, combination);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawVirtualWork(context, solution);
    return true;
  }
  if (solutionMethod === 'method-of-sections') {
    const solution = solveMethodOfSections(project, analysis, combination);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawMethodOfSections(context, solution);
    return true;
  }
  if (solutionMethod === 'method-of-joints') {
    const solution = solveMethodOfJoints(project, analysis, combination);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawMethodOfJoints(context, solution);
    return true;
  }
  if (solutionMethod === 'castigliano-truss') {
    const solution = solveCastiglianoTruss(project, analysis, combination);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawCastiglianoTruss(context, solution);
    return true;
  }
  if (solutionMethod === 'moment-distribution-frame') return drawCrossFrameSection(context);
  if (solutionMethod === 'arch-least-work') return drawArchLeastWorkSection(context);
  if (solutionMethod === 'statics-sections') {
    const solution = solveStaticsSections(project, analysis, combination);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawStaticsSections(context, solution);
    return true;
  }
  return false;
};
