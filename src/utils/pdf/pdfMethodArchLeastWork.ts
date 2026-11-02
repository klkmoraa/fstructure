/**
 * Trabajo mínimo (Castigliano) en un arco circular, narrado con los números del modelo:
 * hipótesis, geometría, estructura liberada con su cuerpo libre, M₀ y m (con sus expresiones y
 * por estaciones), las integrales de energía con Simpson, las redundantes, las fuerzas finales y
 * la verificación contra el análisis matricial.
 *
 * Nada se calcula aquí: todo viene de `solveArchLeastWork`, que ya lo comprobó contra el solver
 * con la tolerancia del arco mallado. Este archivo sólo decide cómo se lee.
 */
import { solveArchLeastWork, type ArchLeastWorkResult, type ArchReaction } from '../../analysis-methods/archLeastWork';
import { arcLoadsTotal, distributedCentroid, lineOfActionPoint, type ArcLoad } from '../../analysis-methods/arcStatics';
import { clearNumber, number, unitFor } from './pdfFormat';
import { pdfText } from './pdfGlyphs';
import {
  arcFigures,
  cutFaceMarks,
  cutLine,
  drawArcCutRelations,
  drawArcEquations,
  drawArcGeometry,
  drawArcScene,
  prose,
} from './pdfMethodArcSections';
import type { SceneForce, SceneMoment } from './pdfFreeBody';
import type { EquationInput } from './pdfEquation';
import type { PdfTableColumn } from './pdfBuilder';
import type { ReportContext } from './reportContext';

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };
const DEGREES = 180 / Math.PI;
const REJECTION_MESSAGE = 'El método elegido no aplica a esta estructura; el procedimiento se reporta con el método matricial.';

const paren = (text: string): string => `(${text})`;

const SUPPORT_NAME: Record<string, string> = { pin: 'pasador', fixed: 'empotramiento', custom: 'apoyo' };

const redundantMeaning = (solution: ArchLeastWorkResult, index: number): string => {
  const redundant = solution.redundants[index]!;
  if (solution.form === 'two-hinged') {
    return `empuje horizontal en ${redundant.nodeId}, positivo hacia el otro apoyo (hacia ${redundant.direction.x > 0 ? '+x' : '−x'})`;
  }
  if (redundant.kind === 'moment') return `momento de reacción en ${redundant.nodeId}, antihorario positivo`;
  return `reacción ${redundant.direction.x ? 'horizontal' : 'vertical'} en ${redundant.nodeId}, positiva hacia ${redundant.direction.x ? '+x' : '+y'}`;
};

const loadName = (load: ArcLoad): string => load.label === 'peso propio' ? 'peso propio' : `carga ${load.label}`;

/** Flechas de un conjunto de reacciones, con su valor. */
const reactionMarks = (
  context: ReportContext,
  reactions: readonly ArchReaction[],
  scale: { force: number; moment: number },
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

const drawHypotheses = (context: ReportContext, solution: ArchLeastWorkResult): void => {
  context.layout.heading('5.1 Hipótesis', 2);
  context.layout.bullets([
    'Arco circular delgado de sección constante (EI y EA constantes), material elástico lineal, pequeños desplazamientos '
      + 'y análisis de primer orden; los apoyos no se mueven.',
    'Energía de deformación de flexión y axial: U = ∫ M²/(2EI) ds + ∫ N²/(2EA) ds a lo largo del arco. Se desprecian la '
      + 'deformación por cortante y el término de acoplamiento M·N/(EA·R) de las barras gruesas, como hace el solver con '
      + 'sus elementos rectos de Euler–Bernoulli.',
    `Teorema de Castigliano (trabajo mínimo): las redundantes hacen U mínima, ∂U/∂X = 0 para cada una. Aquí hay `
      + `${solution.redundants.length} redundante${solution.redundants.length === 1 ? '' : 's'}.`,
    'Convención del corte: N positiva a tensión a lo largo de la tangente (de i a j), V positiva hacia la izquierda de i→j y '
      + 'M = −ΣM(P) del cuerpo libre izquierdo, la misma del análisis matricial.',
  ]);
};

const drawReleased = (context: ReportContext, solution: ArchLeastWorkResult, scale: { force: number; moment: number }): void => {
  const { layout } = context;
  const { fig, unit } = arcFigures(context);
  const kept = context.index.node(solution.keptNodeId);
  const released = context.index.node(solution.releasedNodeId);
  layout.heading('5.3 Estructura liberada y redundantes', 2);
  const g = solution.redundants.length;
  prose(context, solution.form === 'two-hinged'
    ? `Con dos pasadores hay 4 reacciones y 3 ecuaciones: g = 1. Se libera la reacción horizontal de ${solution.releasedNodeId}, `
      + `que queda como rodillo vertical: la estructura liberada es un arco simplemente apoyado, isostático. La redundante es `
      + 'el empuje H, que se aplica como una carga más.'
    : `Con el ${SUPPORT_NAME[kept?.support.type ?? 'fixed'] ?? 'apoyo'} de ${solution.keptNodeId} completo y el apoyo de `
      + `${solution.releasedNodeId} suelto, la estructura liberada es un voladizo curvo, isostático. Las ${g} componentes de `
      + `reacción de ${solution.releasedNodeId} (${SUPPORT_NAME[released?.support.type ?? 'pin'] ?? 'apoyo'}) son las redundantes: g = ${g}.`);
  context.layout.keyValues(solution.redundants.map((redundant, index) => [redundant.symbol, redundantMeaning(solution, index)]), 60);

  prose(context, 'Cargas sobre la estructura liberada, reducidas a su resultante sobre el arco (F = ∫ q dL, con la base de cada '
    + 'carga: longitud de arco o proyección):');
  const origin = solution.geometry.start;
  context.layout.keyValues(solution.loads.map((load) => {
    const total = arcLoadsTotal(solution.geometry, [load], origin);
    if (load.kind === 'couple') return [load.label, `par ${fig(load.moment, 1, 1, scale.moment)} ${unit(1, 1)} en s = ${fig(load.t * solution.geometry.length, 0, 1)} ${unit(0, 1)}`];
    const centroid = load.kind === 'distributed' ? distributedCentroid(solution.geometry, load, 0, 1) : undefined;
    const at = load.kind === 'distributed' && centroid ? lineOfActionPoint(total, origin, centroid) : undefined;
    return [loadName(load), `F = (${fig(total.fx, 1, 0, scale.force)}, ${fig(total.fy, 1, 0, scale.force)}) ${unit(1, 0)}`
      + (load.kind === 'point'
        ? ` en s = ${fig(load.t * solution.geometry.length, 0, 1)} ${unit(0, 1)}`
        : at ? `; su recta de acción pasa por (${fig(at.x, 0, 1)}, ${fig(at.y, 0, 1)}) ${unit(0, 1)}` : '')
      + (load.kind === 'distributed' && load.basis !== 'real' ? `; por proyección ${load.basis === 'horizontal' ? 'horizontal' : 'vertical'}` : '')];
  }), 90);
  for (const load of solution.nodalLoads) {
    prose(context, `Carga en el nudo ${load.nodeId}: (${fig(load.fx, 1, 0, scale.force)}, ${fig(load.fy, 1, 0, scale.force)}) ${unit(1, 0)}`
      + (load.moment ? `, par ${fig(load.moment, 1, 1, scale.moment)} ${unit(1, 1)}` : '') + '.');
  }

  const reactionText = (reaction: ArchReaction) => `R_x = ${fig(reaction.fx, 1, 0, scale.force)}, R_y = ${fig(reaction.fy, 1, 0, scale.force)} ${unit(1, 0)}`
    + (Math.abs(reaction.moment) > 1e-12 ? `, M_R = ${fig(reaction.moment, 1, 1, scale.moment)} ${unit(1, 1)}` : '');
  prose(context, solution.form === 'two-hinged'
    ? 'Reacciones de la liberada bajo las cargas, por ΣF_x = 0, ΣM(A) = 0 (que da la vertical del rodillo) y ΣF_y = 0:'
    : `Reacciones de la liberada bajo las cargas: el ${SUPPORT_NAME[kept?.support.type ?? 'fixed'] ?? 'apoyo'} toma la resultante entera, con signo contrario.`);
  context.layout.keyValues(solution.basicReactions.map((reaction) => [reaction.nodeId, reactionText(reaction)]), 60);
  prose(context, 'Y por cada redundante unitaria aplicada en el extremo liberado:');
  context.layout.keyValues(solution.unitReactions.flatMap((reactions, k) => reactions.map((reaction) => [
    `${solution.redundants[k]!.symbol} = 1 → ${reaction.nodeId}`, reactionText(reaction),
  ])), 90);

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
    legend: 'La estructura liberada con sus cargas, sus reacciones bajo esas cargas (con valor) y las redundantes como '
      + 'cargas desconocidas en el extremo liberado, con el sentido supuesto positivo.',
  }, 'Diagrama de cuerpo libre de la estructura liberada, con las redundantes como cargas.');
};

const drawDistributions = (context: ReportContext, solution: ArchLeastWorkResult, scale: { force: number; moment: number }): void => {
  const { layout, project } = context;
  const { fig } = arcFigures(context);
  layout.heading('5.4 M₀, N₀ y los estados unitarios m, n', 2);
  prose(context, 'M₀ y N₀ son el momento y la axial de la estructura liberada bajo las cargas, por cortes; m_k y n_k, los de la '
    + 'redundante k con valor unitario. Las relaciones del corte son las del método de secciones en un arco:');
  drawArcCutRelations(context, solution.startNodeId);
  const released = solution.releasedNodeId === solution.endNodeId ? 'j' : 'i';
  const end = released === 'j' ? 'B' : 'A';
  prose(context, `Una fuerza unitaria F en el extremo liberado ${solution.releasedNodeId} (punto ${end}) da, cortando por el lado de `
    + `${released === 'j' ? 'la derecha, que sólo la lleva a ella' : 'la izquierda, que la lleva junto con las reacciones de la liberada'}:`);
  drawArcEquations(context, undefined, released === 'j'
    ? [
      'm = (x_B − x)F_y − (y_B − y)F_x + C',
      'n = F_x cos φ + F_y sen φ',
    ]
    : [
      'm = −[(x_A − x)F_y − (y_A − y)F_x] − C',
      'n = −(F_x cos φ + F_y sen φ)',
    ]);
  prose(context, solution.form === 'two-hinged'
    ? 'Para el empuje, F = (∓1, 0) hacia el otro apoyo y C = 0; con la vertical del rodillo que ese empuje induce si los apoyos no están '
      + 'a la misma altura. Con los apoyos al mismo nivel, m = −y: el empuje resta momento en proporción a la altura del arco.'
    : 'X₁: F = (1, 0); X₂: F = (0, 1); X₃ (si el extremo es un empotramiento): un par unitario C = 1, con n = 0.');

  const length = unitFor(project, 'length');
  const force = unitFor(project, 'force');
  const moment = unitFor(project, 'moment');
  const columns: PdfTableColumn[] = [
    { header: `s (${length})`, ...NUMERIC },
    { header: `x (${length})`, ...NUMERIC },
    { header: `y (${length})`, ...NUMERIC },
    { header: 'φ (°)', ...NUMERIC },
    { header: `M₀ (${moment})`, ...NUMERIC },
    { header: `N₀ (${force})`, ...NUMERIC },
    ...solution.redundants.flatMap((redundant, k) => [
      { header: `m${k + 1} (${redundant.kind === 'moment' ? '1' : length})`, ...NUMERIC },
      ...(redundant.kind === 'force' ? [{ header: `n${k + 1}`, ...NUMERIC }] : []),
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
      redundant.kind === 'moment' ? number(station.m[k]!, 5) : fig(station.m[k]!, 0, 1),
      ...(redundant.kind === 'force' ? [number(station.n[k]!, 5)] : []),
    ]),
  ]), { size: 6.8 });
};

const drawIntegrals = (context: ReportContext, solution: ArchLeastWorkResult): void => {
  const { layout } = context;
  const { fig, unit } = arcFigures(context);
  layout.heading('5.5 Integrales de energía', 2);
  prose(context, `Cada integral sobre el arco se evalúa con la regla de Simpson compuesta, con ${solution.panels} intervalos en total, `
    + 'partidos en los bordes de las cargas (donde el integrando deja de ser liso) y en número par en cada tramo; en un borde con '
    + 'una carga concentrada el integrando se lee a cada lado:');
  drawArcEquations(context, undefined, [
    '∫ f ds ≈ (h/3)[f_0 + 4f_1 + 2f_2 + 4f_3 + … + f_n]',
    `EI = ${fig(solution.EI, 1, 2)} ${unit(1, 2)}`,
    `EA = ${fig(solution.EA, 1, 0)} ${unit(1, 0)}`,
  ]);
  const count = solution.redundants.length;
  // δ_jk and δ_j0 in their own units: length/force for force–force, 1/force for force–moment…
  const power = (j: number, k?: number) => {
    const kinds = [solution.redundants[j]!.kind, ...(k === undefined ? [] : [solution.redundants[k]!.kind])];
    const moments = kinds.filter((kind) => kind === 'moment').length;
    return k === undefined ? { force: 0, length: moments ? 0 : 1 } : { force: -1, length: 1 - moments };
  };
  const flexibility: EquationInput[] = [];
  for (let j = 0; j < count; j += 1) {
    for (let k = j; k < count; k += 1) {
      const p = power(j, k);
      const total = solution.bending[j]![k]! + solution.axial[j]![k]!;
      flexibility.push({
        lhs: `δ_${j + 1}${k + 1}`, symbolic: `∫ m_${j + 1} m_${k + 1} ds/EI + ∫ n_${j + 1} n_${k + 1} ds/EA`,
        substituted: `${fig(solution.bending[j]![k]!, p.force, p.length, total)} + ${fig(solution.axial[j]![k]!, p.force, p.length, total)}`,
        result: fig(total, p.force, p.length), unit: unit(p.force, p.length),
      });
    }
  }
  drawArcEquations(context, 'Coeficientes de flexibilidad (simétricos, δ_jk = δ_kj):', flexibility);
  drawArcEquations(context, 'Términos de carga:', solution.loadBending.map((value, j) => {
    const p = power(j);
    const total = value + solution.loadAxial[j]!;
    return {
      lhs: `δ_${j + 1}0`, symbolic: `∫ M₀ m_${j + 1} ds/EI + ∫ N₀ n_${j + 1} ds/EA`,
      substituted: `${fig(value, p.force, p.length, total)} + ${fig(solution.loadAxial[j]!, p.force, p.length, total)}`,
      result: fig(total, p.force, p.length), unit: unit(p.force, p.length),
    };
  }));
};

const drawRedundants = (context: ReportContext, solution: ArchLeastWorkResult, scale: { force: number; moment: number }): void => {
  const { layout } = context;
  const { fig, unit } = arcFigures(context);
  layout.heading('5.6 Redundantes: ∂U/∂X = 0', 2);
  const count = solution.redundants.length;
  if (count === 1) {
    const [H] = solution.redundants;
    const d11 = solution.bending[0]![0]! + solution.axial[0]![0]!;
    const d10 = solution.loadBending[0]! + solution.loadAxial[0]!;
    prose(context, 'Con una sola redundante, ∂U/∂H = δ_10 + H δ_11 = 0:');
    drawArcEquations(context, undefined, [
      {
        lhs: H!.symbol, symbolic: '−(∫M₀ m ds/EI + ∫N₀ n ds/EA)/(∫m² ds/EI + ∫n² ds/EA)',
        substituted: `−${paren(fig(d10, 0, 1, d10))}/${paren(fig(d11, -1, 1, d11))}`,
        result: fig(H!.value, 1, 0, scale.force), unit: unit(1, 0),
      },
      {
        lhs: `${H!.symbol}'`, symbolic: '−(∫M₀ m ds/EI)/(∫m² ds/EI)',
        substituted: `−${paren(fig(solution.loadBending[0]!, 0, 1))}/${paren(fig(solution.bending[0]![0]!, -1, 1))}`,
        result: fig(H!.bendingOnlyValue, 1, 0, scale.force), unit: unit(1, 0),
      },
    ]);
    prose(context, `La segunda línea omite la deformación axial: con ella el ${solution.form === 'two-hinged' ? 'empuje' : 'valor'} cambia `
      + `${number((100 * (H!.value - H!.bendingOnlyValue)) / H!.bendingOnlyValue, 3)} %.`);
  } else {
    prose(context, `Las ${count} condiciones ∂U/∂X_j = 0 forman el sistema Σ_k δ_jk X_k = −δ_j0, que se resuelve directamente:`);
    // Every coefficient in the presentation units: δ_jk carries 1/force and length^(1 − number of moments).
    const lengthPower = (...indices: number[]) => 1 - indices.filter((index) => solution.redundants[index]!.kind === 'moment').length;
    drawArcEquations(context, undefined, solution.redundants.map((_, j) => {
      const row = solution.redundants.map((__, k) => solution.bending[j]![k]! + solution.axial[j]![k]!);
      const reference = Math.max(...row.map((value) => Math.abs(value)));
      const terms = row.map((value, k) => `${paren(fig(value, -1, lengthPower(j, k), reference))}X_${k + 1}`);
      return `${terms.join(' + ')} = ${fig(-(solution.loadBending[j]! + solution.loadAxial[j]!), 0, lengthPower(j))}`;
    }));
    drawArcEquations(context, 'Solución (y, entre paréntesis, la que da omitir la deformación axial):', solution.redundants.map((redundant) => {
      const power = redundant.kind === 'moment' ? 1 : 0;
      const reference = power ? scale.moment : scale.force;
      return {
        lhs: redundant.symbol,
        result: `${fig(redundant.value, 1, power, reference)} (${fig(redundant.bendingOnlyValue, 1, power, reference)})`,
        unit: unit(1, power),
      };
    }));
  }
  const closed = solution.closedForm;
  if (closed) {
    prose(context, 'Referencia clásica, aplicable aquí: arco circular biarticulado con apoyos al mismo nivel, EI constante y una carga '
      + 'vertical uniforme w por proyección horizontal en todo el claro. Despreciando la deformación axial, con x = R sen θ, '
      + 'y = R(cos θ − cos α), ds = R dθ y M₀ = (wR²/2)(sen²α − sen²θ), las integrales son cerradas:');
    drawArcEquations(context, undefined, [
      { lhs: 'I₁', symbolic: '(4/3)sen³α − 2α sen²α cos α + α cos α − sen α cos²α', result: number(closed.numerator, 6) },
      { lhs: 'I₂', symbolic: 'α + 2α cos²α − 3 sen α cos α', result: number(closed.denominator, 6) },
      {
        lhs: 'H_ref', symbolic: '(wR/2)·I₁/I₂',
        substituted: `${paren(fig(closed.w, 1, -1))}${paren(fig(closed.radius, 0, 1))}/2 · ${number(closed.numerator, 6)}/${number(closed.denominator, 6)}`,
        result: fig(closed.thrust, 1, 0, scale.force), unit: unit(1, 0),
      },
    ]);
    prose(context, `Con α = ${number(closed.alpha * DEGREES, 5)}°. Coincide con H' (sin axial) de arriba; la diferencia con H es el efecto `
      + 'de la deformación axial que la fórmula desprecia.');
  }
};

const drawFinal = (context: ReportContext, solution: ArchLeastWorkResult, scale: { force: number; moment: number }): void => {
  const { layout, project } = context;
  const { fig, unit } = arcFigures(context);
  layout.heading('5.7 Fuerzas internas finales', 2);
  prose(context, 'Por superposición en la estructura liberada:');
  drawArcEquations(context, undefined, ['M = M₀ + Σ X_k m_k', 'N = N₀ + Σ X_k n_k', 'V = V₀ + Σ X_k v_k']);
  const length = unitFor(project, 'length');
  const force = unitFor(project, 'force');
  const moment = unitFor(project, 'moment');
  layout.table(
    [
      { header: `s (${length})`, ...NUMERIC },
      { header: `M₀ (${moment})`, ...NUMERIC },
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
    { size: 7 },
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
    legend: 'El cuerpo libre izquierdo en la estación de la tabla más cercana al mayor momento: las reacciones finales del nudo '
      + 'inicial, el trozo de arco hasta el corte y N, V, M en la cara del corte.',
  }, `Corte del arco en s = ${fig(station.s, 0, 1)} ${unit(0, 1)}, con las fuerzas finales.`, { arc: solution.geometry, from: 0, to: station.t });
  layout.keyValues([...reactions.values()].map((reaction) => [
    `Reacción en ${reaction.nodeId}`,
    `R_x = ${fig(reaction.fx, 1, 0, scale.force)}, R_y = ${fig(reaction.fy, 1, 0, scale.force)} ${unit(1, 0)}`
      + (Math.abs(reaction.moment) > 1e-9 * scale.moment ? `, M_R = ${fig(reaction.moment, 1, 1, scale.moment)} ${unit(1, 1)}` : ''),
  ]), 110);
  layout.text(
    `Momento de mayor valor absoluto: M = ${fig(solution.peak.value, 1, 1, scale.moment)} ${unit(1, 1)} en s = ${fig(solution.peak.s, 0, 1)} ${unit(0, 1)}.`,
    8.7, layout.fonts.bold, layout.palette.ink, 8,
  );
};

const drawVerification = (context: ReportContext, solution: ArchLeastWorkResult, scale: { force: number; moment: number }): void => {
  const { layout, project } = context;
  const { fig, unit } = arcFigures(context);
  const { verification } = solution;
  layout.heading('5.8 Verificación contra el análisis matricial', 2);
  prose(context, `El análisis matricial sustituye el arco por ${verification.chords} cuerdas rectas; la mayor separación entre una cuerda y `
    + `el arco es δ = ${fig(verification.sagitta, 0, 1)} ${unit(0, 1)} para una flecha f = ${fig(verification.rise, 0, 1)} ${unit(0, 1)}. `
    + `Este procedimiento integra sobre el arco verdadero, así que la diferencia admitida es relativa, ${number(verification.tolerance, 3)}: `
    + 'el mayor entre 0.001 y 2δ/f, sobre la fuerza de referencia (carga total o redundante mayor) y, en momento, sobre esa fuerza por la '
    + 'flecha.');
  layout.keyValues(solution.redundants.map((redundant) => {
    const power = redundant.kind === 'moment' ? 1 : 0;
    const reference = power ? scale.moment : scale.force;
    return [redundant.symbol, `${fig(redundant.value, 1, power, reference)} ${unit(1, power)} por trabajo mínimo · `
      + `${fig(redundant.solverValue, 1, power, reference)} ${unit(1, power)} por el análisis matricial`];
  }), 60);
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
    { size: 7 },
  );
  layout.keyValues([
    ['Redundantes (relativa)', clearNumber(verification.redundant, 1)],
    ['N y V (máx.)', `${fig(verification.force, 1, 0, scale.force)} ${force} · relativa ${clearNumber(verification.force / verification.forceScale, 1)}`],
    ['M (máx.)', `${fig(verification.moment, 1, 1, scale.moment)} ${moment} · relativa ${clearNumber(verification.moment / verification.momentScale, 1)}`],
  ], 150);
};

export const drawArchLeastWork = (context: ReportContext, solution: ArchLeastWorkResult): void => {
  const { layout } = context;
  const scale = { force: solution.verification.forceScale, moment: solution.verification.momentScale };
  layout.heading('5. Procedimiento: Trabajo mínimo (Castigliano) en el arco');
  prose(context, 'El arco es hiperestático: la estática sola no da sus reacciones. Se suelta lo que sobra hasta dejar una '
    + 'estructura isostática, se calcula por cortes, y lo soltado vuelve como redundantes cuyo valor hace mínima la energía '
    + 'de deformación del arco. Las integrales a lo largo de la curva son numéricas; el resultado se contrasta con el '
    + 'análisis matricial en el mismo arco.', 8.7);
  drawHypotheses(context, solution);
  layout.heading('5.2 Geometría', 2);
  drawArcGeometry(context, solution.geometry, context.index.member(solution.memberId)?.curve?.bulge ?? 0, solution.memberId);
  drawReleased(context, solution, scale);
  drawDistributions(context, solution, scale);
  drawIntegrals(context, solution);
  drawRedundants(context, solution, scale);
  drawFinal(context, solution, scale);
  drawVerification(context, solution, scale);
};

/** Resuelve y narra el método; si no aplica, lo dice y devuelve `false`, como los demás métodos. */
export const drawArchLeastWorkSection = (context: ReportContext): boolean => {
  const { project, analysis, combination, layout } = context;
  const solution = solveArchLeastWork(project, analysis, combination);
  if (!solution.applicable) {
    layout.text(pdfText(REJECTION_MESSAGE), 8.3, layout.fonts.regular, undefined, 8);
    return false;
  }
  drawArchLeastWork(context, solution);
  return true;
};
