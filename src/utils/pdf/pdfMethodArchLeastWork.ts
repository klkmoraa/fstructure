/**
 * Trabajo mínimo (Castigliano) en un arco circular, escrito como memoria de cálculo: datos y
 * geometría, estructura liberada con su cuerpo libre, el planteamiento ∂U/∂X = 0, M₀ y m por
 * estaciones, las integrales de energía con Simpson, las redundantes, las fuerzas finales y la
 * comprobación contra el análisis matricial.
 *
 * Nada se calcula aquí: todo viene de `solveArchLeastWork`, que ya lo comprobó contra el
 * análisis matricial con la tolerancia del arco mallado. Este archivo sólo decide cómo se lee.
 */
import { solveArchLeastWork, type ArchLeastWorkResult, type ArchReaction } from '../../analysis-methods/archLeastWork';
import { arcLoadsTotal, distributedCentroid, lineOfActionPoint, type ArcLoad } from '../../analysis-methods/arcStatics';
import { clearNumber, number, unitFor } from './pdfFormat';
import { signedSum } from './pdfSubstitution';
import { pdfText } from './pdfGlyphs';
import { arcFigures, cutFaceMarks, cutLine, drawArcScene } from './pdfMethodArcSections';
import { memoirCheck, memoirData, memoirFormula, memoirNote, memoirResults, memoirStep, memoirWork } from './pdfMemoirKit';
import type { SceneForce, SceneMoment } from './pdfFreeBody';
import type { EquationInput, WorkedEquation } from './pdfEquation';
import type { PdfTableColumn } from './pdfBuilder';
import { TYPE } from './pdfTheme';
import type { ReportContext } from './reportContext';

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };
const DEGREES = 180 / Math.PI;
const REJECTION_MESSAGE = 'El método elegido no aplica a esta estructura; el procedimiento se reporta con el método matricial.';

const paren = (text: string): string => `(${text})`;

const SUPPORT_NAME: Record<string, string> = { pin: 'pasador', fixed: 'empotramiento', custom: 'apoyo' };

type Scale = { force: number; moment: number };

const redundantMeaning = (solution: ArchLeastWorkResult, index: number): string => {
  const redundant = solution.redundants[index]!;
  if (solution.form === 'two-hinged') {
    return `empuje horizontal en ${redundant.nodeId}, positivo hacia el otro apoyo (${redundant.direction.x > 0 ? '+x' : '−x'})`;
  }
  if (redundant.kind === 'moment') return `momento de reacción en ${redundant.nodeId}, antihorario positivo`;
  return `reacción ${redundant.direction.x ? 'horizontal' : 'vertical'} en ${redundant.nodeId}, positiva hacia ${redundant.direction.x ? '+x' : '+y'}`;
};

const loadName = (load: ArcLoad): string => load.label === 'peso propio' ? 'Peso propio' : `Carga ${load.label}`;

/** Una comprobación en un renglón: la primera redacción que cabe a lo ancho de la página. */
const checkLine = (context: ReportContext, variants: readonly string[], ok: boolean): void => {
  const { layout } = context;
  const prefix = ok ? 'Comprobación: ' : 'Comprobación (revisar): ';
  const fits = (text: string) => layout.richWidth(prefix + text, layout.fonts.bold, TYPE.body) <= layout.contentWidth;
  memoirCheck(context, variants.find(fits) ?? variants[variants.length - 1], ok);
};

/** Una sustitución que es su propio resultado no se repite. */
const work = (context: ReportContext, equations: readonly EquationInput[], caption?: string): void => {
  if (!equations.length) return;
  if (caption) context.layout.ensure(TYPE.small * 1.5 + TYPE.math * 4);
  memoirWork(context, equations.map((input) => (typeof input !== 'string' && input.substituted !== undefined && input.substituted === input.result
    ? { lhs: input.lhs, result: input.result, unit: input.unit }
    : input)), caption);
};

/** Flechas de un conjunto de reacciones, con su valor. */
const reactionMarks = (
  context: ReportContext,
  reactions: readonly ArchReaction[],
  scale: Scale,
): { forces: SceneForce[]; moments: SceneMoment[] } => {
  const { fig, unit } = arcFigures(context);
  const forces: SceneForce[] = [];
  const moments: SceneMoment[] = [];
  for (const reaction of reactions) {
    for (const [component, fx, fy] of [['x', 1, 0], ['y', 0, 1]] as const) {
      const value = component === 'x' ? reaction.fx : reaction.fy;
      if (Math.abs(value) <= 1e-9 * scale.force) continue;
      forces.push({
        place: { nodeId: reaction.nodeId }, fx: fx * Math.sign(value), fy: fy * Math.sign(value), tone: 'reaction', length: 24,
        label: `R_${component}(${reaction.nodeId}) = ${fig(Math.abs(value), 1, 0, scale.force)} ${unit(1, 0)}`,
      });
    }
    if (Math.abs(reaction.moment) > 1e-9 * scale.moment) {
      moments.push({
        place: { nodeId: reaction.nodeId }, sign: reaction.moment, tone: 'reaction',
        label: `M_R(${reaction.nodeId}) = ${fig(Math.abs(reaction.moment), 1, 1, scale.moment)} ${unit(1, 1)}`,
      });
    }
  }
  return { forces, moments };
};

/** Reacciones en tabla: una fila por estado y nudo. */
const reactionTable = (context: ReportContext, rows: ReadonlyArray<readonly [state: string, reaction: ArchReaction]>, scale: Scale): void => {
  const { fig, unit } = arcFigures(context);
  const withMoment = rows.some(([, reaction]) => Math.abs(reaction.moment) > 1e-9 * scale.moment);
  context.layout.table(
    [
      { header: 'Estado', width: 110 },
      { header: 'Nudo', width: 60 },
      { header: `R_x (${unit(1, 0)})`, ...NUMERIC },
      { header: `R_y (${unit(1, 0)})`, ...NUMERIC },
      ...(withMoment ? [{ header: `M_R (${unit(1, 1)})`, ...NUMERIC }] : []),
    ],
    rows.map(([state, reaction]) => [
      state,
      reaction.nodeId,
      fig(reaction.fx, 1, 0, scale.force),
      fig(reaction.fy, 1, 0, scale.force),
      ...(withMoment ? [fig(reaction.moment, 1, 1, scale.moment)] : []),
    ]),
  );
};

const drawData = (context: ReportContext, solution: ArchLeastWorkResult, scale: Scale): void => {
  const { layout } = context;
  const { fig, unit } = arcFigures(context);
  const arc = solution.geometry;
  const bulge = context.index.member(solution.memberId)?.curve?.bulge ?? 0;
  const sweep = Math.abs(arc.sweep);
  memoirStep(context, '5.1 Datos y geometría');
  memoirData(context, [
    ['Cuerda', 'c', fig(arc.chord, 0, 1), unit(0, 1)],
    ['Flecha relativa del modelo', 'b', number(bulge, 4), '—'],
    ['Flecha', 'f', fig(solution.verification.rise, 0, 1), unit(0, 1)],
    ['Rigidez a flexión', 'EI', fig(solution.EI, 1, 2), unit(1, 2)],
    ['Rigidez axial', 'EA', fig(solution.EA, 1, 0), unit(1, 0)],
  ]);
  memoirFormula(context, 'R = c(1 + b^2)/(4|b|),     Δθ = 4 arctan|b|,     L = R Δθ', [
    ['R, Δθ, L', 'radio, ángulo abarcado y longitud del arco'],
    ['θ', 'punto a la distancia s: x = x_c + R cos θ, y = y_c + R sen θ, con θ = θ_i ± (s/L)Δθ'],
    ['φ', 'inclinación de la tangente, de i hacia j'],
  ]);
  work(context, [
    {
      lhs: 'R', symbolic: 'c(1 + b^2)/(4|b|)',
      substituted: `${paren(fig(arc.chord, 0, 1))}(1 + ${paren(number(bulge, 4))}^2)/(4·${number(Math.abs(bulge), 4)})`,
      result: fig(arc.radius, 0, 1), unit: unit(0, 1),
    },
    { lhs: 'Δθ', symbolic: '4 arctan|b|', substituted: `4 arctan(${number(Math.abs(bulge), 4)})`, result: `${number(sweep, 4)} rad = ${number(sweep * DEGREES, 4)}°` },
    { lhs: 'L', symbolic: 'R Δθ', substituted: `${paren(fig(arc.radius, 0, 1))}${paren(number(sweep, 4))}`, result: fig(arc.length, 0, 1), unit: unit(0, 1) },
  ], `Arco ${solution.memberId}, centro (${fig(arc.center.x, 0, 1)}, ${fig(arc.center.y, 0, 1)}) ${unit(0, 1)}:`);

  memoirNote(context, 'Cargas sobre el arco, reducidas a su resultante F = ∫ q dL (con la base de cada carga: longitud de arco o proyección):');
  const origin = arc.start;
  layout.table(
    [
      { header: 'Carga', width: 110 },
      { header: `F_x (${unit(1, 0)})`, ...NUMERIC },
      { header: `F_y (${unit(1, 0)})`, ...NUMERIC },
      { header: 'Punto de aplicación', width: 190 },
    ],
    [
      ...solution.loads.map((load) => {
        const total = arcLoadsTotal(arc, [load], origin);
        if (load.kind === 'couple') {
          return [loadName(load), '0', '0', `par ${fig(load.moment, 1, 1, scale.moment)} ${unit(1, 1)} en s = ${fig(load.t * arc.length, 0, 1)} ${unit(0, 1)}`];
        }
        const centroid = load.kind === 'distributed' ? distributedCentroid(arc, load, 0, 1) : undefined;
        const at = load.kind === 'distributed' && centroid ? lineOfActionPoint(total, origin, centroid) : undefined;
        const basis = load.kind === 'distributed' && load.basis !== 'real' ? ` (por proyección ${load.basis === 'horizontal' ? 'horizontal' : 'vertical'})` : '';
        return [
          `${loadName(load)}${basis}`,
          fig(total.fx, 1, 0, scale.force),
          fig(total.fy, 1, 0, scale.force),
          load.kind === 'point'
            ? `s = ${fig(load.t * arc.length, 0, 1)} ${unit(0, 1)}`
            : at ? `recta por (${fig(at.x, 0, 1)}, ${fig(at.y, 0, 1)}) ${unit(0, 1)}` : '—',
        ];
      }),
      ...solution.nodalLoads.map((load) => [
        `En el nudo ${load.nodeId}`,
        fig(load.fx, 1, 0, scale.force),
        fig(load.fy, 1, 0, scale.force),
        load.moment ? `par ${fig(load.moment, 1, 1, scale.moment)} ${unit(1, 1)}` : 'en el nudo',
      ]),
    ],
  );
};

const drawReleased = (context: ReportContext, solution: ArchLeastWorkResult, scale: Scale): void => {
  const kept = context.index.node(solution.keptNodeId);
  const released = context.index.node(solution.releasedNodeId);
  const g = solution.redundants.length;
  memoirStep(context, '5.2 Estructura liberada y redundantes');
  memoirNote(context, solution.form === 'two-hinged'
    ? `Dos pasadores: 4 reacciones y 3 ecuaciones, g = 1. Se suelta la reacción horizontal de ${solution.releasedNodeId} (rodillo `
      + 'vertical): la liberada es un arco simplemente apoyado, y la redundante, el empuje H.'
    : `Se conserva el ${SUPPORT_NAME[kept?.support.type ?? 'fixed'] ?? 'apoyo'} de ${solution.keptNodeId} y se suelta el `
      + `${SUPPORT_NAME[released?.support.type ?? 'pin'] ?? 'apoyo'} de ${solution.releasedNodeId}: la liberada es un voladizo curvo, `
      + `y sus ${g} componentes de reacción son las redundantes, g = ${g}.`);
  memoirNote(context, solution.form === 'two-hinged'
    ? 'Reacciones de la liberada por ΣF_x = 0, ΣM_A = 0 y ΣF_y = 0, bajo las cargas y bajo cada redundante unitaria:'
    : 'Reacciones de la liberada (el apoyo conservado toma la resultante con signo contrario), bajo las cargas y bajo cada redundante unitaria:');
  reactionTable(context, [
    ...solution.basicReactions.map((reaction) => ['Cargas', reaction] as const),
    ...solution.unitReactions.flatMap((reactions, k) => reactions.map((reaction) => [`${solution.redundants[k]!.symbol} = 1`, reaction] as const)),
  ], scale);

  const marks = reactionMarks(context, solution.basicReactions, scale);
  const redundantForces: SceneForce[] = solution.redundants.filter((entry) => entry.kind === 'force').map((entry) => ({
    place: { nodeId: entry.nodeId }, fx: entry.direction.x, fy: entry.direction.y, tone: 'reaction', length: 26, label: entry.symbol,
  }));
  const redundantMoments: SceneMoment[] = solution.redundants.filter((entry) => entry.kind === 'moment').map((entry) => ({
    place: { nodeId: entry.nodeId }, sign: 1, tone: 'reaction', label: entry.symbol,
  }));
  drawArcScene(context, {
    title: 'estructura liberada',
    includeMemberLoads: true,
    forces: [...marks.forces, ...redundantForces],
    moments: [...marks.moments, ...redundantMoments],
    notes: [{ place: { nodeId: solution.releasedNodeId }, text: solution.form === 'two-hinged' ? 'rodillo vertical' : 'extremo libre', tone: 'faint' }],
    legend: 'La estructura liberada con sus cargas, sus reacciones bajo esas cargas y las redundantes como cargas en el '
      + 'extremo liberado, con el sentido supuesto positivo.',
  }, 'Diagrama de cuerpo libre de la estructura liberada, con las redundantes como cargas.');
};

const drawStatement = (context: ReportContext, solution: ArchLeastWorkResult): void => {
  const single = solution.redundants.length === 1;
  memoirStep(context, '5.3 Planteamiento');
  memoirFormula(context, '∂U/∂X_k = ∫ M (∂M/∂X_k) ds/EI + ∫ N (∂N/∂X_k) ds/EA = 0', [
    ['U', 'energía de deformación, ∫ M^2/(2EI) ds + ∫ N^2/(2EA) ds a lo largo del arco'],
    ['M, N', 'M = M_0 + ΣX_k m_k y N = N_0 + ΣX_k n_k: liberada bajo las cargas más cada redundante'],
    ...solution.redundants.map((redundant, index) => [redundant.symbol, redundantMeaning(solution, index)] as const),
  ]);
  memoirFormula(context, single ? `${solution.redundants[0]!.symbol} = −δ_{10}/δ_{11}` : 'Σ_k δ_{jk} X_k = −δ_{j0}', [
    [single ? 'δ_{11}' : 'δ_{jk}', single ? '∫ m^2 ds/EI + ∫ n^2 ds/EA' : '∫ m_j m_k ds/EI + ∫ n_j n_k ds/EA, coeficientes de flexibilidad'],
    [single ? 'δ_{10}' : 'δ_{j0}', single ? '∫ M_0 m ds/EI + ∫ N_0 n ds/EA' : '∫ M_0 m_j ds/EI + ∫ N_0 n_j ds/EA, términos de carga'],
  ]);
};

const drawDistributions = (context: ReportContext, solution: ArchLeastWorkResult, scale: Scale): void => {
  const { layout, project } = context;
  const { fig } = arcFigures(context);
  const releasedAtJ = solution.releasedNodeId === solution.endNodeId;
  memoirStep(context, '5.4 Esfuerzos de la liberada: M₀, N₀ y estados unitarios m, n');
  memoirFormula(context, 'M_0(s) = −ΣM_P,     N_0(s) = −(ΣF_x cos φ + ΣF_y sen φ)', [
    ['ΣM_P, ΣF', `momento respecto a P y fuerzas del cuerpo libre izquierdo (lado de ${solution.startNodeId} y trozo [0, s])`],
  ]);
  memoirFormula(context, releasedAtJ
    ? 'm = (x_B − x)F_y − (y_B − y)F_x + C,     n = F_x cos φ + F_y sen φ'
    : 'm = −[(x_A − x)F_y − (y_A − y)F_x] − C,     n = −(F_x cos φ + F_y sen φ)', [
    ['F, C', `fuerza o par unitario en el extremo liberado ${solution.releasedNodeId} (punto ${releasedAtJ ? 'B' : 'A'})`
      + (solution.form === 'two-hinged'
        ? ': H, F = (±1, 0) hacia el otro apoyo y C = 0'
        : ': X_1, F = (1, 0); X_2, F = (0, 1); X_3, C = 1')],
  ]);
  if (solution.form === 'two-hinged') memoirNote(context, 'Con los apoyos al mismo nivel, m = −y: el empuje resta momento en proporción a la altura del arco.');
  const length = unitFor(project, 'length');
  const force = unitFor(project, 'force');
  const moment = unitFor(project, 'moment');
  const columns: PdfTableColumn[] = [
    { header: `s (${length})`, ...NUMERIC },
    { header: `x (${length})`, ...NUMERIC },
    { header: `y (${length})`, ...NUMERIC },
    { header: 'φ (°)', ...NUMERIC },
    { header: `M_0 (${moment})`, ...NUMERIC },
    { header: `N_0 (${force})`, ...NUMERIC },
    ...solution.redundants.flatMap((redundant, k) => [
      { header: `m_${k + 1} (${redundant.kind === 'moment' ? '1' : length})`, ...NUMERIC },
      ...(redundant.kind === 'force' ? [{ header: `n_${k + 1}`, ...NUMERIC }] : []),
    ]),
  ];
  layout.table(columns, solution.stations.map((station) => [
    fig(station.s, 0, 1),
    fig(station.point.x, 0, 1),
    fig(station.point.y, 0, 1),
    number(station.slope * DEGREES, 4),
    fig(station.M0, 1, 1, scale.moment),
    fig(station.N0, 1, 0, scale.force),
    ...solution.redundants.flatMap((redundant, k) => [
      redundant.kind === 'moment' ? number(station.m[k]!, 4) : fig(station.m[k]!, 0, 1),
      ...(redundant.kind === 'force' ? [number(station.n[k]!, 4)] : []),
    ]),
  ]), { size: 6.8 });
};

const drawIntegrals = (context: ReportContext, solution: ArchLeastWorkResult): void => {
  const { fig, unit } = arcFigures(context);
  memoirStep(context, '5.5 Integrales de energía (regla de Simpson)');
  memoirFormula(context, '∫ f ds ≈ (h/3)[f_0 + 4f_1 + 2f_2 + … + 4f_{n−1} + f_n]', [
    ['n', `${solution.panels} intervalos, partidos en los bordes de las cargas y en número par en cada tramo`],
    ['h', 'paso de cada tramo; junto a una carga concentrada el integrando se lee a cada lado'],
  ]);
  const count = solution.redundants.length;
  // A dimensionless coefficient carries no unit at all, not a «1».
  const unitOf = (forcePower: number, lengthPower: number) => (forcePower || lengthPower ? unit(forcePower, lengthPower) : undefined);
  // δ_jk and δ_j0 in their own units: length/force for force–force, 1/force for force–moment…
  const power = (j: number, k?: number) => {
    const kinds = [solution.redundants[j]!.kind, ...(k === undefined ? [] : [solution.redundants[k]!.kind])];
    const moments = kinds.filter((kind) => kind === 'moment').length;
    return k === undefined ? { force: 0, length: moments ? 0 : 1 } : { force: -1, length: 1 - moments };
  };
  const flexibility: WorkedEquation[] = [];
  for (let j = 0; j < count; j += 1) {
    for (let k = j; k < count; k += 1) {
      const p = power(j, k);
      const total = solution.bending[j]![k]! + solution.axial[j]![k]!;
      flexibility.push({
        lhs: `δ_{${j + 1}${k + 1}}`, symbolic: `∫ m_${j + 1} m_${k + 1} ds/EI + ∫ n_${j + 1} n_${k + 1} ds/EA`,
        substituted: signedSum([fig(solution.bending[j]![k]!, p.force, p.length, total), fig(solution.axial[j]![k]!, p.force, p.length, total)]),
        result: fig(total, p.force, p.length), unit: unitOf(p.force, p.length),
      });
    }
  }
  work(context, flexibility, count > 1 ? 'Coeficientes de flexibilidad (simétricos, δ_jk = δ_kj):' : 'Coeficiente de flexibilidad:');
  work(context, solution.loadBending.map((value, j) => {
    const p = power(j);
    const total = value + solution.loadAxial[j]!;
    return {
      lhs: `δ_{${j + 1}0}`, symbolic: `∫ M_0 m_${j + 1} ds/EI + ∫ N_0 n_${j + 1} ds/EA`,
      substituted: signedSum([fig(value, p.force, p.length, total), fig(solution.loadAxial[j]!, p.force, p.length, total)]),
      result: fig(total, p.force, p.length), unit: unitOf(p.force, p.length),
    };
  }), count > 1 ? 'Términos de carga:' : 'Término de carga:');
};

const drawRedundants = (context: ReportContext, solution: ArchLeastWorkResult, scale: Scale): void => {
  const { fig, unit } = arcFigures(context);
  memoirStep(context, '5.6 Redundantes');
  const count = solution.redundants.length;
  const valueOf = (redundant: ArchLeastWorkResult['redundants'][number], value: number) => {
    const power = redundant.kind === 'moment' ? 1 : 0;
    return `${fig(value, 1, power, power ? scale.moment : scale.force)} ${unit(1, power)}`;
  };
  if (count === 1) {
    const [H] = solution.redundants;
    const d11 = solution.bending[0]![0]! + solution.axial[0]![0]!;
    const d10 = solution.loadBending[0]! + solution.loadAxial[0]!;
    work(context, [
      {
        lhs: H!.symbol, symbolic: '−δ_{10}/δ_{11}',
        substituted: `−${paren(fig(d10, 0, 1, d10))}/${paren(fig(d11, -1, 1, d11))}`,
        result: fig(H!.value, 1, 0, scale.force), unit: unit(1, 0),
      },
      {
        lhs: `${H!.symbol}′`, symbolic: '−(∫M_0 m ds/EI)/(∫m^2 ds/EI)',
        substituted: `−${paren(fig(solution.loadBending[0]!, 0, 1))}/${paren(fig(solution.bending[0]![0]!, -1, 1))}`,
        result: fig(H!.bendingOnlyValue, 1, 0, scale.force), unit: unit(1, 0),
      },
    ]);
    memoirNote(context, `${H!.symbol}′ omite la deformación axial; con ella el ${solution.form === 'two-hinged' ? 'empuje' : 'valor'} cambia `
      + `${number((100 * (H!.value - H!.bendingOnlyValue)) / H!.bendingOnlyValue, 3).replace(/^-/, '−')} %.`);
  } else {
    // Every coefficient in the presentation units: δ_jk carries 1/force and length^(1 − number of moments).
    const lengthPower = (...indices: number[]) => 1 - indices.filter((index) => solution.redundants[index]!.kind === 'moment').length;
    work(context, solution.redundants.map((_, j) => {
      const row = solution.redundants.map((__, k) => solution.bending[j]![k]! + solution.axial[j]![k]!);
      const reference = Math.max(...row.map((value) => Math.abs(value)));
      const terms = row.map((value, k) => `${paren(fig(value, -1, lengthPower(j, k), reference))}X_${k + 1}`);
      return `${terms.join(' + ')} = ${fig(-(solution.loadBending[j]! + solution.loadAxial[j]!), 0, lengthPower(j))}`;
    }), `Las ${count} condiciones ∂U/∂X_j = 0, resueltas directamente:`);
  }
  memoirResults(context, count === 1 ? 'Redundante' : 'Redundantes', solution.redundants.flatMap((redundant) => [
    [redundant.symbol, valueOf(redundant, redundant.value)] as const,
    ...(count > 1 ? [[`${redundant.symbol}′ (sin axial)`, valueOf(redundant, redundant.bendingOnlyValue)] as const] : []),
  ]));

  const closed = solution.closedForm;
  if (closed) {
    memoirNote(context, 'Referencia clásica: biarticulado circular con apoyos al mismo nivel, EI constante y w uniforme por proyección '
      + 'horizontal en todo el claro, sin deformación axial (x = R sen θ, y = R(cos θ − cos α), ds = R dθ):');
    memoirFormula(context, 'H = (w R/2) I_1/I_2', [
      ['I_1', '(4/3)sen^{3}α − 2α sen^{2}α cos α + α cos α − sen α cos^{2}α'],
      ['I_2', 'α + 2α cos^{2}α − 3 sen α cos α'],
      ['α', `semiángulo del arco, ${number(closed.alpha * DEGREES, 4)}°`],
    ]);
    work(context, [
      { lhs: 'I_1', result: number(closed.numerator, 4) },
      { lhs: 'I_2', result: number(closed.denominator, 4) },
      {
        lhs: 'H_{ref}', symbolic: '(w R/2) I_1/I_2',
        substituted: `${paren(fig(closed.w, 1, -1))}${paren(fig(closed.radius, 0, 1))}/2 · ${number(closed.numerator, 4)}/${number(closed.denominator, 4)}`,
        result: fig(closed.thrust, 1, 0, scale.force), unit: unit(1, 0),
      },
    ]);
    memoirNote(context, 'Coincide con H′; la diferencia con H es la deformación axial que la fórmula desprecia.');
  }
};

const drawFinal = (context: ReportContext, solution: ArchLeastWorkResult, scale: Scale): void => {
  const { layout, project } = context;
  const { fig, unit } = arcFigures(context);
  memoirStep(context, '5.7 Fuerzas internas finales');
  memoirFormula(context, 'M = M_0 + Σ X_k m_k,     N = N_0 + Σ X_k n_k,     V = V_0 + Σ X_k v_k');
  const length = unitFor(project, 'length');
  const force = unitFor(project, 'force');
  const moment = unitFor(project, 'moment');
  layout.table(
    [
      { header: `s (${length})`, ...NUMERIC },
      { header: `M_0 (${moment})`, ...NUMERIC },
      { header: `ΣX m (${moment})`, ...NUMERIC },
      { header: `M (${moment})`, ...NUMERIC },
      { header: `N (${force})`, ...NUMERIC },
      { header: `V (${force})`, ...NUMERIC },
    ],
    solution.stations.map((station) => [
      fig(station.s, 0, 1),
      fig(station.M0, 1, 1, scale.moment),
      fig(station.M - station.M0, 1, 1, scale.moment),
      fig(station.M, 1, 1, scale.moment),
      fig(station.N, 1, 0, scale.force),
      fig(station.V, 1, 0, scale.force),
    ]),
  );
  // The final reactions: the released structure's, plus every redundant times its unit case.
  const reactions = new Map<string, ArchReaction>();
  const add = (reaction: ArchReaction, factor: number) => {
    const current = reactions.get(reaction.nodeId) ?? { nodeId: reaction.nodeId, fx: 0, fy: 0, moment: 0 };
    reactions.set(reaction.nodeId, {
      nodeId: reaction.nodeId, fx: current.fx + factor * reaction.fx, fy: current.fy + factor * reaction.fy, moment: current.moment + factor * reaction.moment,
    });
  };
  solution.basicReactions.forEach((reaction) => add(reaction, 1));
  solution.unitReactions.forEach((entries, k) => entries.forEach((reaction) => add(reaction, solution.redundants[k]!.value)));
  for (const redundant of solution.redundants) {
    add({
      nodeId: redundant.nodeId,
      fx: redundant.kind === 'force' ? redundant.direction.x : 0,
      fy: redundant.kind === 'force' ? redundant.direction.y : 0,
      moment: redundant.kind === 'moment' ? 1 : 0,
    }, redundant.value);
  }
  const marks = reactionMarks(context, [...reactions.values()], scale);
  // The worked cut: where the final |M| peaks, with the arc up to it in ink.
  const peakT = solution.peak.s / solution.geometry.length;
  const station = solution.stations.reduce((best, entry) => (Math.abs(entry.t - peakT) < Math.abs(best.t - peakT) ? entry : best), solution.stations[0]!);
  const face = cutFaceMarks(context, station.point, { x: Math.cos(station.slope), y: Math.sin(station.slope) }, { axial: station.N, shear: station.V, moment: station.M }, scale);
  drawArcScene(context, {
    title: `arco con sus reacciones · corte en s = ${fig(station.s, 0, 1)} ${unit(0, 1)}`,
    keptNodeIds: [solution.startNodeId],
    keptMemberIds: [],
    includeMemberLoads: false,
    cut: cutLine(solution.geometry, station.point, { x: Math.cos(station.slope), y: Math.sin(station.slope) }, 's'),
    forces: [...marks.forces.filter((entry) => 'nodeId' in entry.place && entry.place.nodeId === solution.startNodeId), ...face.forces],
    moments: [...marks.moments.filter((entry) => 'nodeId' in entry.place && entry.place.nodeId === solution.startNodeId), ...face.moments],
    legend: 'Cuerpo libre izquierdo en la estación de la tabla más cercana al mayor momento: reacciones finales del nudo '
      + 'inicial, el trozo de arco hasta el corte y N, V, M en la cara del corte.',
  }, `Corte del arco en s = ${fig(station.s, 0, 1)} ${unit(0, 1)}, con las fuerzas finales.`, { arc: solution.geometry, from: 0, to: station.t });
  memoirNote(context, 'Reacciones finales: las de la liberada bajo las cargas más cada redundante por su estado unitario.');
  memoirResults(context, 'Reacciones finales y momento máximo', [
    ...[...reactions.values()].flatMap((reaction) => [
      [`R_x(${reaction.nodeId})`, `${fig(reaction.fx, 1, 0, scale.force)} ${unit(1, 0)}`] as const,
      [`R_y(${reaction.nodeId})`, `${fig(reaction.fy, 1, 0, scale.force)} ${unit(1, 0)}`] as const,
      ...(Math.abs(reaction.moment) > 1e-9 * scale.moment ? [[`M_R(${reaction.nodeId})`, `${fig(reaction.moment, 1, 1, scale.moment)} ${unit(1, 1)}`] as const] : []),
    ]),
    ['M_{máx}', `${fig(solution.peak.value, 1, 1, scale.moment)} ${unit(1, 1)} (s = ${fig(solution.peak.s, 0, 1)} ${unit(0, 1)})`],
  ]);
};

const drawVerification = (context: ReportContext, solution: ArchLeastWorkResult, scale: Scale): void => {
  const { layout, project } = context;
  const { fig, unit } = arcFigures(context);
  const { verification } = solution;
  memoirStep(context, '5.8 Comprobación');
  memoirNote(context, `El análisis matricial usa ${verification.chords} cuerdas rectas, a lo más δ = ${fig(verification.sagitta, 0, 1)} ${unit(0, 1)} `
    + `del arco (flecha f = ${fig(verification.rise, 0, 1)} ${unit(0, 1)}): se admite una diferencia relativa ε = máx(0.001, 2δ/f) = `
    + `${number(verification.tolerance, 3)}.`);
  const force = unitFor(project, 'force');
  const moment = unitFor(project, 'moment');
  const length = unitFor(project, 'length');
  layout.table(
    [
      { header: `s (${length})`, ...NUMERIC },
      { header: `M (${moment})`, ...NUMERIC },
      { header: `M mat. (${moment})`, ...NUMERIC },
      { header: `N (${force})`, ...NUMERIC },
      { header: `N mat. (${force})`, ...NUMERIC },
      { header: `V (${force})`, ...NUMERIC },
      { header: `V mat. (${force})`, ...NUMERIC },
    ],
    solution.stations.map((station) => [
      fig(station.s, 0, 1),
      fig(station.M, 1, 1, scale.moment),
      fig(station.solver?.moment ?? Number.NaN, 1, 1, scale.moment),
      fig(station.N, 1, 0, scale.force),
      fig(station.solver?.axial ?? Number.NaN, 1, 0, scale.force),
      fig(station.V, 1, 0, scale.force),
      fig(station.solver?.shear ?? Number.NaN, 1, 0, scale.force),
    ]),
  );
  for (const redundant of solution.redundants) {
    const power = redundant.kind === 'moment' ? 1 : 0;
    const reference = power ? scale.moment : scale.force;
    const relative = Math.abs(redundant.value - redundant.solverValue) / reference;
    const value = `${fig(redundant.value, 1, power, reference)} ${unit(1, power)}`;
    const matrix = `${fig(redundant.solverValue, 1, power, reference)} ${unit(1, power)}`;
    checkLine(context, [
      `${redundant.symbol} = ${value} frente a ${matrix} matricial (relativa ${clearNumber(relative, 1, 2)}).`,
      `${redundant.symbol} = ${value} frente a ${matrix} matricial.`,
    ], relative <= verification.tolerance);
  }
  const forceRelative = verification.force / verification.forceScale;
  const momentRelative = verification.moment / verification.momentScale;
  checkLine(context, [
    `N y V por estaciones, diferencia máxima ${fig(verification.force, 1, 0, scale.force)} ${force} (relativa ${clearNumber(forceRelative, 1, 2)}).`,
    `N y V, diferencia máx. ${fig(verification.force, 1, 0, scale.force)} ${force}.`,
  ], forceRelative <= verification.tolerance);
  checkLine(context, [
    `M por estaciones, diferencia máxima ${fig(verification.moment, 1, 1, scale.moment)} ${moment} (relativa ${clearNumber(momentRelative, 1, 2)}).`,
    `M, diferencia máx. ${fig(verification.moment, 1, 1, scale.moment)} ${moment}.`,
  ], momentRelative <= verification.tolerance);
};

export const drawArchLeastWork = (context: ReportContext, solution: ArchLeastWorkResult): void => {
  const { layout } = context;
  const scale = { force: solution.verification.forceScale, moment: solution.verification.momentScale };
  const kept = context.index.node(solution.keptNodeId);
  const released = context.index.node(solution.releasedNodeId);
  const supports = solution.form === 'two-hinged'
    ? 'biarticulado'
    : kept?.support.type === released?.support.type
      ? `con ${SUPPORT_NAME[kept?.support.type ?? 'fixed'] ?? 'apoyo'} en sus dos extremos`
      : `con ${SUPPORT_NAME[kept?.support.type ?? 'fixed'] ?? 'apoyo'} en ${solution.keptNodeId} y ${SUPPORT_NAME[released?.support.type ?? 'pin'] ?? 'apoyo'} en ${solution.releasedNodeId}`;
  const g = solution.redundants.length;
  layout.heading('5. Método del trabajo mínimo (Castigliano) en el arco');
  memoirNote(context, `Arco circular ${supports}, hiperestático de grado ${g}. Incógnita${g === 1 ? '' : 's'}: `
    + `${solution.redundants.map((redundant) => redundant.symbol).join(', ')}. Sección constante, elástico lineal, primer orden; `
    + 'se desprecia la deformación por cortante.');
  drawData(context, solution, scale);
  drawReleased(context, solution, scale);
  drawStatement(context, solution);
  drawDistributions(context, solution, scale);
  drawIntegrals(context, solution);
  drawRedundants(context, solution, scale);
  drawFinal(context, solution, scale);
  drawVerification(context, solution, scale);
};

/** Resuelve y narra el método; si no aplica, lo dice y devuelve `false`, como los demás métodos. */
export const drawArchLeastWorkSection = (context: ReportContext): boolean => {
  const { project, analysis, combination } = context;
  const solution = solveArchLeastWork(project, analysis, combination);
  if (!solution.applicable) {
    memoirNote(context, pdfText(REJECTION_MESSAGE));
    return false;
  }
  drawArchLeastWork(context, solution);
  return true;
};
