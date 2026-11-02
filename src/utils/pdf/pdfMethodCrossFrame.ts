/**
 * Cross (distribución de momentos) en marcos, escrito como memoria de cálculo: datos, rigideces y
 * factores de distribución, momentos de empotramiento, la tabla de Cross sin desplazamiento, cada
 * modo de desplazamiento con su tabla, las ecuaciones que fijan cuánto de cada modo ocurre, los
 * momentos finales, cada barra por secciones y la comprobación contra el análisis matricial.
 *
 * Nada se calcula aquí: todo número viene de `solveMomentDistributionFrame`, que ya lo comprobó
 * contra una corrida matricial axialmente rígida. Cada etapa escribe su fórmula en símbolos y
 * después la sustitución; una sustitución sólo se imprime si sus propios números cierran.
 */
import {
  solveMomentDistributionFrame,
  type CrossDistribution,
  type CrossFrameResult,
  type CrossJoint,
  type CrossMember,
} from '../../analysis-methods/momentDistributionFrame';
import { fromDisplay } from '../../foundation/units';
import type { FreeBodyScene, SceneForce } from './pdfFreeBody';
import type { PdfTableColumn } from './pdfBuilder';
import { clearCell, clearNumber, displayCell, number, unitFor } from './pdfFormat';
import { REJECTION_MESSAGE, drawScenes } from './pdfMethodSection';
import { agrees, dimensionalFigure, dimensionalUnit, signedSum } from './pdfSubstitution';
import { pdfText } from './pdfGlyphs';
import { memoirCheck, memoirData, memoirFormula, memoirNote, memoirResults, memoirStep, memoirWork } from './pdfMemoirKit';
import type { WorkedEquation } from './pdfEquation';
import { TYPE } from './pdfTheme';
import type { ReportContext } from './reportContext';

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };
/** Columnas de extremo por tabla de Cross: más no caben a lo ancho de la página. */
const ENDS_PER_TABLE = 8;
const TABLE_SIZE = 6.8;

/** Un momento con signo, en las unidades de la memoria y sin unidad, plegado a cero junto a `reference`. */
const momentFigure = (context: ReportContext, value: number, reference = Math.abs(value)): string =>
  clearCell(context.project, value, 'moment', reference);

const lengthFigure = (context: ReportContext, value: number): string => dimensionalFigure(context.project, value, 0, 1);

/** Envuelve un operando negativo, para que `a + −b` no se lea como una resta. */
const operand = (text: string): string => (text.startsWith('−') || text.startsWith('-') ? `(${text})` : text);

const plural = (count: number, singular: string, many = `${singular}s`): string => `${count} ${count === 1 ? singular : many}`;

/** Una comprobación en un renglón: la primera redacción que cabe a lo ancho de la página. */
const checkLine = (context: ReportContext, variants: readonly string[], ok: boolean): void => {
  const { layout } = context;
  const prefix = ok ? 'Comprobación: ' : 'Comprobación (revisar): ';
  const fits = (text: string) => layout.richWidth(prefix + text, layout.fonts.bold, TYPE.body) <= layout.contentWidth;
  memoirCheck(context, variants.find(fits) ?? variants[variants.length - 1], ok);
};

/** `memoirWork`, sin dejar el pie de un bloque solo al final de una página ni un pie sin ecuaciones. */
const work = (context: ReportContext, equations: readonly WorkedEquation[], caption?: string): void => {
  if (!equations.length) return;
  if (caption) context.layout.ensure(TYPE.small * 1.5 + TYPE.math * 4);
  memoirWork(context, equations, caption);
};

/** Numeración de los pasos: 5.1, 5.2… en el orden en que se escriben. */
const stepNumbers = () => {
  let count = 0;
  return (title: string): string => `5.${(count += 1)} ${title}`;
};

const storeyLabel = (solution: CrossFrameResult, index: number): string => {
  const storey = solution.modes[index]?.storey;
  return storey ? `entrepiso ${storey.level}` : `modo ${index + 1}`;
};

/** Agrupa los extremos por nudo en tablas de a lo más `ENDS_PER_TABLE` columnas. */
const endChunks = (joints: readonly CrossJoint[]): number[][] => {
  const chunks: number[][] = [];
  let chunk: number[] = [];
  for (const joint of joints) {
    // A joint's columns stay together unless the joint alone is wider than a table.
    if (chunk.length && chunk.length + joint.endIndices.length > ENDS_PER_TABLE) {
      chunks.push(chunk);
      chunk = [];
    }
    for (const index of joint.endIndices) {
      if (chunk.length >= ENDS_PER_TABLE) {
        chunks.push(chunk);
        chunk = [];
      }
      chunk.push(index);
    }
  }
  if (chunk.length) chunks.push(chunk);
  return chunks;
};

/**
 * La tabla de Cross de una distribución: columnas = extremos de barra agrupados por nudo; filas =
 * nudo, factor de distribución, momento de partida, Equilibrio/Transporte de cada ciclo
 * registrado, lo que aportaron los ciclos restantes y la suma final.
 */
const drawCrossTable = (
  context: ReportContext,
  solution: CrossFrameResult,
  distribution: CrossDistribution,
  startLabel: string,
): void => {
  const reference = Math.max(
    1e-9,
    ...distribution.initial.map((value) => Math.abs(value)),
    ...distribution.final.map((value) => Math.abs(value)),
  );
  const cell = (value: number) => momentFigure(context, value, reference);
  const rotating = new Set(solution.joints.filter((joint) => joint.rotates).flatMap((joint) => joint.endIndices));
  const shown = (index: number) => distribution.initial[index]
    + distribution.cycles.reduce((sum, cycle) => sum + cycle.balance[index] + cycle.carryOver[index], 0);

  for (const chunk of endChunks(solution.joints)) {
    const columns: PdfTableColumn[] = [
      { header: 'Barra', width: 74 },
      ...chunk.map((index) => ({ header: solution.ends[index].memberId, ...NUMERIC })),
    ];
    const rows: string[][] = [
      ['Nudo', ...chunk.map((index) => solution.ends[index].nodeId)],
      ['FD', ...chunk.map((index) => (rotating.has(index) ? number(solution.ends[index].distributionFactor, 4) : '0'))],
      [startLabel, ...chunk.map((index) => cell(distribution.initial[index]))],
    ];
    distribution.cycles.forEach((cycle, c) => {
      rows.push([`Equilibrio ${c + 1}`, ...chunk.map((index) => (rotating.has(index) ? cell(cycle.balance[index]) : ''))]);
      rows.push([`Transporte ${c + 1}`, ...chunk.map((index) => cell(cycle.carryOver[index]))]);
    });
    if (distribution.cycleCount > distribution.cycles.length) {
      rows.push([
        `Ciclos ${distribution.cycles.length + 1} a ${distribution.cycleCount}`,
        ...chunk.map((index) => cell(distribution.final[index] - shown(index))),
      ]);
    }
    rows.push(['Suma final', ...chunk.map((index) => cell(distribution.final[index]))]);
    context.layout.table(columns, rows, { size: TABLE_SIZE });
  }
};

/** Las fórmulas del libro para el MEP de una barra, cuando reproducen el análisis aislado. */
const femWorked = (context: ReportContext, member: CrossMember): { caption: string; equations: WorkedEquation[] } | undefined => {
  const { project } = context;
  const terms = member.femTerms ?? [];
  if (!terms.length) return undefined;
  const L = lengthFigure(context, member.length);
  const scale = Math.max(Math.abs(member.fixedEndMomentI), Math.abs(member.fixedEndMomentJ), 1e-9);
  const sumI = terms.reduce((sum, term) => sum + term.momentI, 0);
  const sumJ = terms.reduce((sum, term) => sum + term.momentJ, 0);
  if (!agrees(sumI, member.fixedEndMomentI, scale) || !agrees(sumJ, member.fixedEndMomentJ, scale)) return undefined;

  const symbolI: string[] = [];
  const symbolJ: string[] = [];
  const valuesI: string[] = [];
  const valuesJ: string[] = [];
  const described: string[] = [];
  // Fixed–fixed, or fixed at one end and pinned at the released one: the propped-cantilever
  // formulas, written only at the fixed end (the pinned one is zero, said once below).
  const proppedAtI = member.releasedJ && !member.releasedI;
  const proppedAtJ = member.releasedI && !member.releasedJ;
  let point = 0;
  for (const term of terms) {
    if (term.kind === 'uniform') {
      const w = dimensionalFigure(project, term.value, 1, -1);
      const divisor = proppedAtI || proppedAtJ ? 8 : 12;
      symbolI.push(`w L^2/${divisor}`);
      symbolJ.push(`w L^2/${divisor}`);
      valuesI.push(`(${w})(${L})^2/${divisor}`);
      valuesJ.push(`(${w})(${L})^2/${divisor}`);
      described.push(`w = ${w} ${dimensionalUnit(project, 1, -1)} (${term.label})`);
    } else {
      point += 1;
      const P = dimensionalFigure(project, term.value, 1, 0);
      const a = lengthFigure(context, term.a ?? 0);
      const b = lengthFigure(context, member.length - (term.a ?? 0));
      if (proppedAtI) {
        // Pinned at j: c = b, the distance from the load to the pinned end.
        symbolI.push(`P_${point} a_${point} b_${point}(L + b_${point})/(2L^2)`);
        valuesI.push(`(${P})(${a})(${b})((${L}) + (${b}))/(2(${L})^2)`);
      } else if (proppedAtJ) {
        // Pinned at i: c = a.
        symbolJ.push(`P_${point} a_${point} b_${point}(L + a_${point})/(2L^2)`);
        valuesJ.push(`(${P})(${a})(${b})((${L}) + (${a}))/(2(${L})^2)`);
      } else {
        symbolI.push(`P_${point} a_${point} b_${point}^2/L^2`);
        symbolJ.push(`P_${point} a_${point}^2 b_${point}/L^2`);
        valuesI.push(`(${P})(${a})(${b})^2/(${L})^2`);
        valuesJ.push(`(${P})(${a})^2(${b})/(${L})^2`);
      }
      described.push(`P_${point} = ${P} ${dimensionalUnit(project, 1, 0)} a ${a} ${unitFor(project, 'length')} de i (${term.label})`);
    }
  }
  const unit = unitFor(project, 'moment');
  const pinned = proppedAtI ? `; extremo ${member.nodeJ} liberado, MEP_j = 0` : proppedAtJ ? `; extremo ${member.nodeI} liberado, MEP_i = 0` : '';
  return {
    caption: `Barra ${member.memberId} (L = ${L} ${unitFor(project, 'length')}): ${described.join('; ')}${pinned}.`,
    equations: [
      ...(proppedAtJ ? [] : [{
        lhs: `MEP_i(${member.memberId})`, symbolic: symbolI.join(' + '), substituted: valuesI.join(' + '),
        result: momentFigure(context, member.fixedEndMomentI, scale), unit,
      }]),
      ...(proppedAtI ? [] : [{
        // The j end carries the opposite sense: −(Σ …), written once rather than term by term.
        lhs: `MEP_j(${member.memberId})`,
        symbolic: symbolJ.length === 1 ? `−${symbolJ[0]}` : `−(${symbolJ.join(' + ')})`,
        substituted: valuesJ.length === 1 ? `−${valuesJ[0]}` : `−(${valuesJ.join(' + ')})`,
        result: momentFigure(context, member.fixedEndMomentJ, scale), unit,
      }]),
    ],
  };
};

/** Una escena por barra: momentos finales, cortantes de extremo y las cargas de la barra. */
const memberScenes = (context: ReportContext, solution: CrossFrameResult): FreeBodyScene[] => {
  const { project } = context;
  const momentUnit = unitFor(project, 'moment');
  const forceUnit = unitFor(project, 'force');
  return solution.members.flatMap((member): FreeBodyScene[] => {
    if (!context.index.member(member.memberId)) return [];
    // Transverse force on the member: +V(0) along local +y at i, −V(L) along local +y at j.
    const normal = { x: -member.sin, y: member.cos };
    const shearScale = Math.max(1, Math.abs(member.shearStart), Math.abs(member.shearEnd));
    const forces: SceneForce[] = [
      { value: member.shearStart, nodeId: member.nodeI, label: 'V_i' },
      { value: -member.shearEnd, nodeId: member.nodeJ, label: 'V_j' },
    ]
      .filter((entry) => Math.abs(entry.value) > 1e-9 * shearScale)
      .map((entry): SceneForce => ({
        place: { nodeId: entry.nodeId },
        fx: normal.x * Math.sign(entry.value),
        fy: normal.y * Math.sign(entry.value),
        tone: 'shear',
        length: 22,
        label: `${entry.label} = ${clearCell(project, Math.abs(entry.value), 'force', shearScale)} ${forceUnit}`,
      }));
    return [{
      title: `barra ${member.memberId}`,
      keptNodeIds: [member.nodeI, member.nodeJ],
      keptMemberIds: [member.memberId],
      includeMemberLoads: true,
      forces,
      moments: [
        { place: { nodeId: member.nodeI }, sign: member.finalMomentI, label: `M_i = ${displayCell(project, member.finalMomentI, 'moment')} ${momentUnit}`, tone: 'moment' },
        { place: { nodeId: member.nodeJ }, sign: member.finalMomentJ, label: `M_j = ${displayCell(project, member.finalMomentJ, 'moment')} ${momentUnit}`, tone: 'moment' },
      ],
      legend: 'Barra aislada con sus cargas, los momentos finales de extremo (antihorario positivo sobre la barra) y los '
        + 'cortantes de extremo por estática.',
    }];
  });
};

/** El nudo que gira con más extremos: el ejemplo que se desarrolla con números. */
const busiestJoint = (solution: CrossFrameResult): CrossJoint | undefined => solution.joints
  .filter((joint) => joint.rotates && joint.endIndices.length > 1)
  .reduce<CrossJoint | undefined>((best, joint) => (!best || joint.endIndices.length > best.endIndices.length ? joint : best), undefined);

const drawData = (context: ReportContext, solution: CrossFrameResult, step: string): void => {
  const { layout, project } = context;
  const released = solution.members.filter((member) => member.releasedI || member.releasedJ);
  const hinges = solution.joints.filter((joint) => joint.hinged);
  memoirStep(context, step);
  layout.table(
    [
      { header: 'Barra', width: 54 },
      { header: 'Nudos i – j', width: 96 },
      { header: `L (${unitFor(project, 'length')})`, ...NUMERIC },
      { header: `EI (${dimensionalUnit(project, 1, 2)})`, ...NUMERIC },
      ...(released.length ? [{ header: 'Extremo liberado', width: 96 }] : []),
    ],
    solution.members.map((member) => [
      member.memberId,
      `${member.nodeI} – ${member.nodeJ}`,
      lengthFigure(context, member.length),
      dimensionalFigure(project, member.EI, 1, 2),
      ...(released.length ? [[member.releasedI ? member.nodeI : '', member.releasedJ ? member.nodeJ : ''].filter(Boolean).join(' y ') || '—'] : []),
    ]),
  );
  const loaded = solution.joints.filter((joint) => joint.rotates && joint.appliedMoment !== 0);
  memoirData(context, [
    ...solution.springs.map((spring) => [
      `Resorte rotacional en ${spring.nodeId}`, 'k_r', dimensionalFigure(project, spring.stiffness, 1, 1), `${dimensionalUnit(project, 1, 1)}/rad`,
    ] as const),
    ...loaded.map((joint) => [
      `Momento aplicado en ${joint.nodeId} (antihorario)`, `M_0(${joint.nodeId})`, displayCell(project, joint.appliedMoment, 'moment'), unitFor(project, 'moment'),
    ] as const),
  ]);
  memoirNote(context, 'Signos: momento de extremo sobre la barra y giro de cuerda ψ, antihorarios positivos.');
  if (released.length) {
    memoirNote(context, `Extremos liberados: ${released.map((member) => `${member.memberId} en ${[member.releasedI ? member.nodeI : '', member.releasedJ ? member.nodeJ : ''].filter(Boolean).join(' y ')}`).join('; ')}`
      + `${hinges.length ? ` (articulación en ${hinges.map((joint) => joint.nodeId).join(', ')})` : ''}. `
      + 'Su momento es nulo y no reciben transporte; el otro extremo trabaja con 3EI/L.');
  }
  if (solution.springs.length) {
    memoirNote(context, 'Resortes rotacionales de apoyo: el nudo gira y el resorte entra al reparto como una rigidez más, K = k_r, '
      + 'sin transporte; la reacción de momento del apoyo es −M_r.');
  }
};

const drawStiffness = (context: ReportContext, solution: CrossFrameResult, memberById: ReadonlyMap<string, CrossMember>, step: string): void => {
  const { layout, project } = context;
  const anyReleased = solution.ends.some((end) => end.released);
  const anySpring = solution.springs.length > 0;
  const stiffnessUnit = dimensionalUnit(project, 1, 1);
  memoirStep(context, step);
  memoirFormula(context, 'FD_{ij} = K_{ij}/ΣK_i', [
    ['K_{ij}', anyReleased ? 'rigidez del extremo: 4EI/L, o 3EI/L si el otro extremo está liberado' : 'rigidez del extremo, 4EI/L'],
    ...(anySpring ? [['k_r', 'resorte rotacional de apoyo: suma a ΣK_i como un extremo más'] as const] : []),
    ['ΣK_i', 'suma de las rigideces que concurren en el nudo i'],
    ['FD_{ij}', 'factor de distribución; 0 en un nudo que no gira'],
  ]);

  const busiest = busiestJoint(solution);
  if (busiest) {
    const stiffness = (value: number) => dimensionalFigure(project, value, 1, 1, busiest.stiffnessSum);
    const ownStiffness: WorkedEquation[] = busiest.endIndices.flatMap((index) => {
      const end = solution.ends[index];
      if (end.spring) return [{ lhs: `K(${end.memberId}) = k_r`, result: stiffness(end.stiffness), unit: stiffnessUnit }];
      const member = memberById.get(end.memberId);
      if (!member || end.stiffnessCoefficient === 0) return [];
      if (!agrees((end.stiffnessCoefficient * member.EI) / member.length, end.stiffness, busiest.stiffnessSum)) return [];
      return [{
        lhs: `K(${end.memberId})`, symbolic: `${end.stiffnessCoefficient}EI/L`,
        substituted: `${end.stiffnessCoefficient}(${dimensionalFigure(project, member.EI, 1, 2)})/(${lengthFigure(context, member.length)})`,
        result: stiffness(end.stiffness), unit: stiffnessUnit,
      }];
    });
    work(context, [
      ...ownStiffness,
      {
        lhs: `ΣK(${busiest.nodeId})`, symbolic: 'ΣK',
        substituted: busiest.endIndices.map((index) => stiffness(solution.ends[index].stiffness)).join(' + '),
        result: stiffness(busiest.stiffnessSum), unit: stiffnessUnit,
      },
      ...busiest.endIndices.map((index) => ({
        lhs: `FD(${solution.ends[index].memberId})`, symbolic: 'K/ΣK',
        substituted: `(${stiffness(solution.ends[index].stiffness)})/(${stiffness(busiest.stiffnessSum)})`,
        result: number(solution.ends[index].distributionFactor, 4),
      })),
    ], `Nudo ${busiest.nodeId}:`);
  }

  const jointLabel = (joint: CrossJoint) => (joint.rotates ? joint.nodeId : `${joint.nodeId} (${joint.hinged ? 'articulación' : 'empotrado'})`);
  const formula = (index: number) => {
    const end = solution.ends[index];
    if (end.spring) return 'resorte k_r';
    return end.stiffnessCoefficient === 0 ? 'liberado' : `${end.stiffnessCoefficient}EI/L`;
  };
  const showFormula = anyReleased || anySpring;
  layout.table(
    [
      { header: 'Nudo', width: 96 },
      { header: 'Barra', width: 60 },
      ...(showFormula ? [{ header: 'Rigidez', width: 70 }] : []),
      { header: `K (${stiffnessUnit})`, ...NUMERIC },
      { header: 'FD', ...NUMERIC },
    ],
    solution.joints.flatMap((joint) => joint.endIndices.map((index) => {
      const end = solution.ends[index];
      return [
        jointLabel(joint),
        end.memberId,
        ...(showFormula ? [formula(index)] : []),
        dimensionalFigure(project, end.stiffness, 1, 1),
        joint.rotates ? number(end.distributionFactor, 4) : '0',
      ];
    })),
  );
};

const drawFixedEndMoments = (context: ReportContext, solution: CrossFrameResult, step: string): void => {
  const terms = solution.members.flatMap((member) => member.femTerms ?? []);
  const uniform = terms.some((term) => term.kind === 'uniform');
  const point = terms.some((term) => term.kind === 'point');
  const anyReleased = solution.members.some((member) => member.releasedI || member.releasedJ);
  memoirStep(context, step);
  if (uniform || point) {
    const [termI, termJ] = uniform && point
      ? ['w L^2/12 + ΣP a b^2/L^2', '−(w L^2/12 + ΣP a^2 b/L^2)']
      : uniform ? ['w L^2/12', '−w L^2/12'] : ['ΣP a b^2/L^2', '−ΣP a^2 b/L^2'];
    memoirFormula(context, `MEP_i = ${termI},     MEP_j = ${termJ}`, [
      ...(uniform ? [['w', 'carga uniforme perpendicular a la barra, positiva hacia −y local'] as const] : []),
      ...(point ? [['P, a, b', 'carga puntual y sus distancias a los extremos i y j'] as const] : []),
      ...(anyReleased && point ? [['c', 'distancia de la carga puntual al extremo liberado'] as const] : []),
    ]);
    if (anyReleased) {
      memoirNote(context, `Barra con un extremo liberado: en el continuo, MEP = w L^2/8${point ? ' o P a b(L + c)/(2L^2)' : ''}; en el liberado, 0.`);
    }
  } else {
    memoirNote(context, 'MEP: momento de cada barra aislada y empotrada en sus dos extremos, bajo sus propias cargas.');
  }
  const withoutFormula: string[] = [];
  const unloaded: string[] = [];
  for (const member of solution.members) {
    const worked = femWorked(context, member);
    if (worked) {
      work(context, worked.equations, worked.caption);
      continue;
    }
    const scale = Math.max(Math.abs(member.fixedEndMomentI), Math.abs(member.fixedEndMomentJ));
    if (scale > 1e-9) withoutFormula.push(member.memberId);
    else unloaded.push(member.memberId);
  }
  if (unloaded.length) memoirNote(context, `Sin carga de barra, MEP = 0: ${unloaded.join(', ')}.`);
  if (withoutFormula.length) {
    memoirNote(context, `Sin fórmula cerrada en ${withoutFormula.join(', ')} (carga no uniforme ni puntual): su MEP es el de la barra `
      + 'aislada y empotrada, en la fila MEP de la tabla siguiente.');
  }
};

const drawNonSway = (context: ReportContext, solution: CrossFrameResult, step: string): void => {
  const { project } = context;
  const momentUnit = unitFor(project, 'moment');
  const anyReleased = solution.ends.some((end) => end.released);
  const anyApplied = solution.joints.some((joint) => joint.rotates && joint.appliedMoment !== 0);
  memoirStep(context, step);
  memoirFormula(context, anyApplied ? 'E_{ij} = −FD_{ij} (ΣM_i − M_{0i}),     T_{ji} = (1/2) E_{ij}' : 'E_{ij} = −FD_{ij} ΣM_i,     T_{ji} = (1/2) E_{ij}', [
    ['ΣM_i', 'suma de los momentos de extremo en el nudo i al empezar el ciclo'],
    ...(anyApplied ? [['M_{0i}', 'momento aplicado en el nudo, antihorario'] as const] : []),
    ['E_{ij}', 'momento de equilibrio repartido al extremo ij'],
    ['T_{ji}', anyReleased || solution.springs.length ? 'transporte al otro extremo de la barra; 0 hacia un extremo liberado o un resorte' : 'transporte al otro extremo de la barra'],
  ]);
  const distribution = solution.nonSway;
  const shownCycles = distribution.cycles.length;
  memoirNote(context, (solution.modes.length ? 'Con los nudos impedidos de trasladarse, convergió' : 'Convergió')
    + ` en ${plural(distribution.cycleCount, 'ciclo')}`
    + (distribution.cycleCount > shownCycles ? `; se muestran ${shownCycles} y la fila «Ciclos» suma los restantes.` : '.'));

  // The first balance at the most unbalanced joint, written out: its unbalance, each share, each carry-over.
  const unbalanceOf = (joint: CrossJoint) => joint.endIndices.reduce((sum, index) => sum + distribution.initial[index], 0) - joint.appliedMoment;
  const busiest = solution.joints
    .filter((joint) => joint.rotates && joint.endIndices.length > 1)
    .reduce<CrossJoint | undefined>((best, joint) => (!best || Math.abs(unbalanceOf(joint)) > Math.abs(unbalanceOf(best)) * (1 + 1e-9) ? joint : best), undefined);
  const first = distribution.cycles[0];
  if (busiest && first) {
    const scale = Math.max(1e-9, ...busiest.endIndices.map((index) => Math.abs(distribution.initial[index])), Math.abs(busiest.appliedMoment));
    const figure = (value: number) => momentFigure(context, value, scale);
    const unbalance = unbalanceOf(busiest);
    const closes = busiest.endIndices.every((index) => agrees(-solution.ends[index].distributionFactor * unbalance, first.balance[index], scale));
    if (closes && Math.abs(unbalance) > 1e-9 * scale) {
      const terms = busiest.endIndices.map((index) => figure(distribution.initial[index]));
      const equations: WorkedEquation[] = [{
        lhs: `ΣM(${busiest.nodeId})`, symbolic: busiest.appliedMoment ? 'ΣMEP − M_0' : 'ΣMEP',
        substituted: busiest.appliedMoment ? `${signedSum(terms)} − ${operand(figure(busiest.appliedMoment))}` : signedSum(terms),
        result: figure(unbalance), unit: momentUnit,
      }];
      for (const index of busiest.endIndices) {
        const end = solution.ends[index];
        equations.push({
          lhs: `E(${end.memberId}, ${end.nodeId})`, symbolic: '−FD ΣM',
          substituted: `−(${number(end.distributionFactor, 4)})(${figure(unbalance)})`,
          result: figure(first.balance[index]), unit: momentUnit,
        });
      }
      for (const index of busiest.endIndices) {
        const end = solution.ends[index];
        if (end.spring || end.carryOverFactor === 0 || !agrees(end.carryOverFactor * first.balance[index], first.carryOver[end.partner], scale)) continue;
        equations.push({
          lhs: `T(${end.memberId}, ${end.farNodeId})`, symbolic: '(1/2) E',
          substituted: `(1/2)(${figure(first.balance[index])})`,
          result: figure(first.carryOver[end.partner]), unit: momentUnit,
        });
      }
      work(context, equations, `Primer ciclo en el nudo ${busiest.nodeId}:`);
    }
  }
  drawCrossTable(context, solution, distribution, 'MEP');
};

const drawSwayModes = (context: ReportContext, solution: CrossFrameResult, memberById: ReadonlyMap<string, CrossMember>, step: string): void => {
  const { layout, project } = context;
  const lengthUnit = unitFor(project, 'length');
  const momentUnit = unitFor(project, 'moment');
  const count = solution.modes.length;
  const anyReleased = solution.members.some((member) => member.releasedI || member.releasedJ);
  memoirStep(context, step);
  memoirNote(context, (solution.storeyForm
    ? `${plural(count, 'grado')} de desplazamiento lateral, uno por entrepiso. `
    : `${plural(count, 'modo')} de traslación de nudos que no alargan ninguna barra. `)
    + `Cada modo se distribuye sin cargas, con un Δ supuesto cuyo mayor MEP vale 100 ${momentUnit}.`);
  memoirFormula(context, solution.storeyForm ? 'MEP_Δ = −6EI ψ/L,     ψ = −Δ/h' : 'MEP_Δ = −6EI ψ/L,     ψ = (δu_j − δu_i)·n/L', [
    ['ψ', 'giro de cuerda de la barra, antihorario positivo'],
    ...(solution.storeyForm
      ? [['Δ, h', 'desplazamiento supuesto del entrepiso y su altura'] as const]
      : [['δu, n', 'traslación de los nudos en el modo y normal unitaria de la barra'] as const]),
    ...(anyReleased ? [['3EI', 'en lugar de 6EI en el extremo continuo de una barra con el otro liberado'] as const] : []),
  ]);

  for (const [k, mode] of solution.modes.entries()) {
    layout.heading(mode.storey
      ? `Modo ${k + 1}: entrepiso ${mode.storey.level} (h = ${lengthFigure(context, mode.storey.height)} ${lengthUnit}, Δ = ${lengthFigure(context, mode.assumedDisplacement)} ${lengthUnit})`
      : `Modo ${k + 1} (Δ = ${lengthFigure(context, mode.assumedDisplacement)} ${lengthUnit})`, 3);
    if (mode.storey) {
      memoirNote(context, `Se trasladan horizontalmente ${mode.storey.nodeIds.join(', ')}.`);
    } else {
      layout.table(
        [{ header: 'Nudo', width: 80 }, { header: `δu_x (${lengthUnit})`, ...NUMERIC }, { header: `δu_y (${lengthUnit})`, ...NUMERIC }],
        mode.translations.map((entry) => [entry.nodeId, lengthFigure(context, entry.ux), lengthFigure(context, entry.uy)]),
      );
    }
    work(context, mode.chordRotations.flatMap((entry) => {
      const member = memberById.get(entry.memberId);
      if (!member || (member.releasedI && member.releasedJ)) return [];
      const coefficient = member.releasedI || member.releasedJ ? 3 : 6;
      const at = member.releasedJ ? `, ${member.nodeI}` : member.releasedI ? `, ${member.nodeJ}` : '';
      return [{
        lhs: `MEP_Δ(${entry.memberId}${at})`,
        symbolic: `−${coefficient}EI ψ/L`,
        substituted: `−${coefficient}(${dimensionalFigure(project, member.EI, 1, 2)})(${number(entry.psi, 4)})/(${lengthFigure(context, member.length)})`,
        result: momentFigure(context, (-coefficient * member.EI * entry.psi) / member.length),
        unit: momentUnit,
      }];
    }));
    drawCrossTable(context, solution, mode.distribution, 'MEP despl.');
  }
};

const drawSwayEquations = (context: ReportContext, solution: CrossFrameResult, step: string): void => {
  const { layout, project } = context;
  const lengthUnit = unitFor(project, 'length');
  const forceUnit = unitFor(project, 'force');
  memoirStep(context, step);
  if (solution.storeyForm) {
    memoirFormula(context, 'Σ(M_{inf} + M_{sup})/h = H', [
      ['M_{inf}, M_{sup}', 'momentos de extremo de cada columna del entrepiso'],
      ['h', 'altura del entrepiso'],
      ['H', 'fuerza lateral sobre el corte: cargas en nudos y lo que llega de las cargas de barra'],
    ]);
    memoirNote(context, 'Por superposición, S^0 + Σc_k S^k = H en cada entrepiso, con S el valor de Σ(M_{inf} + M_{sup})/h en cada estado:');
    const sums = solution.equations.map((equation) => [-equation.nonSwayMomentTerm, ...equation.coefficients.map((value) => -value)]);
    const reference = Math.max(1e-9, ...sums.flat().map((value) => Math.abs(value)));
    layout.table(
      [
        { header: 'Estado', width: 120 },
        ...solution.modes.map((_, k) => ({ header: `Entrepiso ${solution.modes[k].storey?.level ?? k + 1} (${forceUnit})`, ...NUMERIC })),
      ],
      ['Sin desplazamiento', ...solution.modes.map((_, l) => `Modo ${l + 1}`)].map((state, l) => [
        state,
        ...sums.map((row) => clearCell(project, row[l], 'force', reference)),
      ]),
    );
    work(context, solution.equations.map((equation, k) => ({
      lhs: `ΣV(entrepiso ${solution.modes[k].storey?.level ?? k + 1})`,
      substituted: [
        clearCell(project, -equation.nonSwayMomentTerm, 'force', reference),
        ...equation.coefficients.map((value, l) => `c_${l + 1}(${clearCell(project, -value, 'force', reference)})`),
      ].join(' + '),
      result: clearCell(project, equation.nodalLoadTerm + equation.memberLoadTerm, 'force', reference),
      unit: forceUnit,
    })));
  } else {
    memoirFormula(context, 'G_k = Σ(M_i + M_j)ψ^k + ΣW^k + ΣP·δu^k = 0', [
      ['ψ^k', 'giro de cuerda de cada barra en el modo k, normalizado a desplazamiento unitario'],
      ['W^k', 'trabajo de las cargas de barra: −[R_i·δu_i + R_j·δu_j + (Mr_i + Mr_j)ψ]^k'],
      ['R, Mr', 'reacciones de la barra aislada y empotrada'],
      ['P', 'cargas en nudos'],
    ]);
    memoirNote(context, 'Términos de cada ecuación, en orden: momentos sin desplazamiento, c_l por los de cada modo, cargas de barra y '
      + `cargas en nudos, en ${forceUnit}.`);
    const reference = Math.max(1e-9, ...solution.equations.flatMap((equation) => [
      Math.abs(equation.nonSwayMomentTerm), Math.abs(equation.memberLoadTerm), Math.abs(equation.nodalLoadTerm),
      ...equation.coefficients.map((value) => Math.abs(value)),
    ]));
    const figure = (value: number) => clearCell(project, value, 'force', reference);
    work(context, solution.equations.map((equation, k) => ({
      lhs: `G_${k + 1}`,
      substituted: [
        figure(equation.nonSwayMomentTerm),
        ...equation.coefficients.map((value, l) => `c_${l + 1}(${figure(value)})`),
        operand(figure(equation.memberLoadTerm)),
        operand(figure(equation.nodalLoadTerm)),
      ].join(' + '),
      result: '0',
    })));
  }
  const cScale = Math.max(1, ...solution.swayFactors.map((value) => Math.abs(value)));
  memoirResults(context, 'Factores de desplazamiento', [
    ...solution.swayFactors.map((value, k) => [`c_${k + 1}`, clearNumber(value, cScale, 4)] as const),
    ...solution.modes.map((mode, k) => [
      `Δ_${k + 1} (${storeyLabel(solution, k)})`,
      `${lengthFigure(context, solution.swayFactors[k] * mode.assumedDisplacement)} ${lengthUnit}`,
    ] as const),
  ]);
};

const drawFinalMoments = (context: ReportContext, solution: CrossFrameResult, memberById: ReadonlyMap<string, CrossMember>, step: string): void => {
  const { layout, project } = context;
  const momentUnit = unitFor(project, 'moment');
  const hasSway = solution.modes.length > 0;
  memoirStep(context, step);
  const reference = Math.max(1e-9, ...solution.final.map((value) => Math.abs(value)));
  const governing = solution.final.reduce((best, value, index) => (Math.abs(value) > Math.abs(solution.final[best]) ? index : best), 0);
  if (hasSway) {
    memoirFormula(context, 'M = M^0 + Σ c_k M^k', [
      ['M^0', 'suma final de la distribución sin desplazamiento'],
      ['M^k', 'suma final del modo k'],
    ]);
    const parts = solution.modes.map((mode) => mode.distribution.final[governing]);
    const end = solution.ends[governing];
    const total = solution.nonSway.final[governing] + parts.reduce((sum, value, k) => sum + solution.swayFactors[k] * value, 0);
    if (end && agrees(total, solution.final[governing], reference)) {
      work(context, [{
        lhs: `M(${end.memberId}, ${end.nodeId})`, symbolic: `M^0 + ${solution.modes.map((_, k) => `c_${k + 1} M^${k + 1}`).join(' + ')}`,
        substituted: `${momentFigure(context, solution.nonSway.final[governing], reference)} + ${parts.map((value, k) => `(${clearNumber(solution.swayFactors[k], 1, 4)})(${momentFigure(context, value, reference)})`).join(' + ')}`,
        result: momentFigure(context, solution.final[governing], reference), unit: momentUnit,
      }], 'Extremo de mayor momento:');
    }
  } else {
    memoirNote(context, 'Los momentos finales de extremo son la suma final de la tabla de Cross.');
  }
  const separate = solution.modes.length <= 3;
  layout.table(
    [
      { header: 'Barra', width: 54 },
      { header: 'Nudo', width: 54 },
      ...(hasSway ? [{ header: `M^0 (${momentUnit})`, ...NUMERIC }] : []),
      ...(hasSway
        ? separate
          ? solution.modes.map((_, k) => ({ header: `c_${k + 1} M^${k + 1} (${momentUnit})`, ...NUMERIC }))
          : [{ header: `Σ c M (${momentUnit})`, ...NUMERIC }]
        : []),
      { header: `M (${momentUnit})`, ...NUMERIC },
    ],
    solution.joints.flatMap((joint) => joint.endIndices.map((index) => {
      const end = solution.ends[index];
      const parts = solution.modes.map((mode, k) => solution.swayFactors[k] * mode.distribution.final[index]);
      return [
        end.memberId,
        end.nodeId,
        ...(hasSway ? [momentFigure(context, solution.nonSway.final[index], reference)] : []),
        ...(hasSway
          ? separate
            ? parts.map((value) => momentFigure(context, value, reference))
            : [momentFigure(context, parts.reduce((sum, value) => sum + value, 0), reference)]
          : []),
        momentFigure(context, solution.final[index], reference),
      ];
    })),
  );
  if (solution.storeyForm) {
    // Closing check with the final moments alone: each storey's column shears add up to H.
    work(context, solution.modes.flatMap((mode, k) => {
      const storey = mode.storey;
      if (!storey) return [];
      const equation = solution.equations[k];
      const H = equation.nodalLoadTerm + equation.memberLoadTerm;
      const columns = storey.columnIds.map((id) => memberById.get(id)).filter((member): member is CrossMember => Boolean(member));
      const total = columns.reduce((sum, member) => sum + member.finalMomentI + member.finalMomentJ, 0) / storey.height;
      const scale = Math.max(1, Math.abs(H), ...columns.map((member) => Math.abs(member.finalMomentI + member.finalMomentJ) / storey.height));
      if (!agrees(total, H, scale)) return [];
      return [{
        lhs: `ΣV(entrepiso ${storey.level})`,
        symbolic: 'Σ(M_{inf} + M_{sup})/h',
        substituted: `(${columns.map((member) => `${operand(momentFigure(context, member.finalMomentI, reference))} + ${operand(momentFigure(context, member.finalMomentJ, reference))}`).join(' + ')})/(${lengthFigure(context, storey.height)})`,
        result: clearCell(project, total, 'force', scale),
        unit: unitFor(project, 'force'),
      }];
    }), 'Cortante de cada entrepiso con los momentos finales (debe dar H):');
  }
  // Per bar, the end that governs it.
  memoirResults(context, 'Momento de extremo mayor por barra', solution.members.map((member) => {
    const atI = Math.abs(member.finalMomentI) >= Math.abs(member.finalMomentJ);
    return [
      `M(${member.memberId}, ${atI ? member.nodeI : member.nodeJ})`,
      `${momentFigure(context, atI ? member.finalMomentI : member.finalMomentJ, reference)} ${momentUnit}`,
    ] as const;
  }));
};

const drawSections = (context: ReportContext, solution: CrossFrameResult, step: string): void => {
  const { layout, project } = context;
  const lengthUnit = unitFor(project, 'length');
  const momentUnit = unitFor(project, 'moment');
  const forceUnit = unitFor(project, 'force');
  memoirStep(context, step);
  memoirFormula(context, 'V(x) = V_0(x) + (M_i + M_j)/L,     M(x) = M_0(x) − M_i + (M_i + M_j) x/L', [
    ['V_0, M_0', 'cortante y momento de la barra simplemente apoyada con sus cargas'],
    ['x', 'distancia desde el nudo i; diagrama con y local hacia arriba (M_i cambia de signo)'],
  ]);
  const reference = Math.max(1e-9, ...solution.final.map((value) => Math.abs(value)));
  for (const member of solution.members) {
    const L = lengthFigure(context, member.length);
    const shearScale = Math.max(1, Math.abs(member.shearStart), Math.abs(member.shearEnd), Math.abs(member.isostaticShearStart), Math.abs(member.isostaticShearEnd));
    const sum = `${operand(momentFigure(context, member.finalMomentI, reference))} + ${operand(momentFigure(context, member.finalMomentJ, reference))}`;
    // The governing moment, plus the span maximum where the shear crosses zero when that is a
    // different, interior point — the two numbers a beam is designed for.
    const governing = Math.abs(member.spanMaximum.value) >= Math.abs(member.spanMinimum.value) ? member.spanMaximum : member.spanMinimum;
    const interior = [member.spanMaximum, member.spanMinimum].find((entry) => (
      entry !== governing && entry.x > member.length * 1e-6 && entry.x < member.length * (1 - 1e-6)
      && Math.abs(entry.value) > 1e-9 * Math.max(1, Math.abs(governing.value))
    ));
    const extremes = [governing, ...(interior ? [interior] : [])].sort((a, b) => a.x - b.x);
    work(context, [
      {
        lhs: 'V(0)', symbolic: 'V_0(0) + (M_i + M_j)/L',
        substituted: `${clearCell(project, member.isostaticShearStart, 'force', shearScale)} + (${sum})/(${L})`,
        result: clearCell(project, member.shearStart, 'force', shearScale), unit: forceUnit,
      },
      {
        lhs: 'V(L)', symbolic: 'V_0(L) + (M_i + M_j)/L',
        substituted: `${clearCell(project, member.isostaticShearEnd, 'force', shearScale)} + (${sum})/(${L})`,
        result: clearCell(project, member.shearEnd, 'force', shearScale), unit: forceUnit,
      },
      ...extremes.map((entry) => ({ lhs: `M(${lengthFigure(context, entry.x)} ${lengthUnit})`, result: displayCell(project, entry.value, 'moment'), unit: momentUnit })),
    ], `Barra ${member.memberId} (${member.nodeI} – ${member.nodeJ}, L = ${L} ${lengthUnit}):`);
  }
  layout.table(
    [
      { header: 'Barra', width: 50 },
      { header: `V(0) (${forceUnit})`, ...NUMERIC },
      { header: `V(L) (${forceUnit})`, ...NUMERIC },
      { header: `M máx. (${momentUnit})`, ...NUMERIC },
      { header: `en x (${lengthUnit})`, ...NUMERIC },
      { header: `M mín. (${momentUnit})`, ...NUMERIC },
      { header: `en x (${lengthUnit})`, ...NUMERIC },
    ],
    solution.members.map((member) => [
      member.memberId,
      displayCell(project, member.shearStart, 'force'),
      displayCell(project, member.shearEnd, 'force'),
      displayCell(project, member.spanMaximum.value, 'moment'),
      lengthFigure(context, member.spanMaximum.x),
      displayCell(project, member.spanMinimum.value, 'moment'),
      lengthFigure(context, member.spanMinimum.x),
    ]),
  );
  drawScenes(
    context,
    memberScenes(context, solution),
    (scene) => `${scene.title ?? 'barra'}: momentos finales de Cross y cortantes de extremo por estática.`,
  );
};

const drawVerification = (context: ReportContext, solution: CrossFrameResult, step: string): void => {
  const { layout, project } = context;
  const momentUnit = unitFor(project, 'moment');
  const { verification } = solution;
  memoirStep(context, step);
  memoirNote(context, `Dos referencias por análisis matricial: la «rígida», con cada área × ${number(verification.axialStiffnessFactor, 3)} `
    + '(mismo peso propio), que cumple la hipótesis de Cross, y la «real», con la deformación axial que Cross desprecia.');
  const reference = Math.max(1e-9, verification.referenceMoment, verification.solverReferenceMoment);
  layout.table(
    [
      { header: 'Barra', width: 46 },
      { header: `Cross i (${momentUnit})`, ...NUMERIC },
      { header: `Rígida i (${momentUnit})`, ...NUMERIC },
      { header: `Real i (${momentUnit})`, ...NUMERIC },
      { header: `Cross j (${momentUnit})`, ...NUMERIC },
      { header: `Rígida j (${momentUnit})`, ...NUMERIC },
      { header: `Real j (${momentUnit})`, ...NUMERIC },
    ],
    solution.members.map((member) => [
      member.memberId,
      momentFigure(context, member.finalMomentI, reference),
      momentFigure(context, member.rigidMomentI, reference),
      momentFigure(context, member.solverMomentI, reference),
      momentFigure(context, member.finalMomentJ, reference),
      momentFigure(context, member.rigidMomentJ, reference),
      momentFigure(context, member.solverMomentJ, reference),
    ]),
  );
  if (solution.springs.length) {
    memoirNote(context, 'Resortes: la reacción de momento del apoyo es −M_r, con M_r = k_r θ.');
    layout.table(
      [
        { header: 'Apoyo', width: 46 },
        { header: `M_r Cross (${momentUnit})`, ...NUMERIC },
        { header: 'θ (rad)', ...NUMERIC },
        { header: `−M_r (${momentUnit})`, ...NUMERIC },
        { header: `Rígida (${momentUnit})`, ...NUMERIC },
        { header: `Real (${momentUnit})`, ...NUMERIC },
      ],
      solution.springs.map((spring) => [
        spring.nodeId,
        momentFigure(context, spring.moment, reference),
        number(spring.rotation, 4),
        momentFigure(context, -spring.moment, reference),
        momentFigure(context, spring.rigidReaction, reference),
        momentFigure(context, spring.solverReaction, reference),
      ]),
    );
  }
  const relative = (value: number, scale: number) => (scale > 0 ? value / scale : 0);
  const display = (value: number) => clearCell(project, value, 'moment', 1);
  const rigid = relative(verification.rigidResidual, verification.referenceMoment);
  const real = relative(verification.solverResidual, verification.solverReferenceMoment);
  const rigidGap = `${display(verification.rigidResidual)} ${momentUnit}`;
  const realGap = `${display(verification.solverResidual)} ${momentUnit}`;
  checkLine(context, [
    `Cross frente a la referencia rígida, diferencia máxima ${rigidGap} (${number(100 * rigid, 2)} %).`,
    `Cross frente a la rígida, diferencia máx. ${rigidGap} (${number(100 * rigid, 2)} %).`,
    `rígida, diferencia máx. ${rigidGap}.`,
  ], rigid <= 1e-3);
  checkLine(context, [
    `Cross frente al análisis real, diferencia máxima ${realGap} (${number(100 * real, 2)} %), deformación axial.`,
    `Cross frente al análisis real, diferencia máx. ${realGap} (${number(100 * real, 2)} %).`,
    `real, diferencia máx. ${realGap}.`,
  ], real <= 0.05);
};

export const drawCrossFrame = (context: ReportContext, solution: CrossFrameResult): void => {
  const { layout } = context;
  const memberById = new Map(solution.members.map((member) => [member.memberId, member]));
  const hasSway = solution.modes.length > 0;
  const step = stepNumbers();
  const rotating = solution.joints.filter((joint) => joint.rotates).length;
  const kind = solution.classification.kind;
  const what = kind === 'frame' ? 'Marco hiperestático' : kind === 'continuous-beam' || kind === 'simple-beam' ? 'Viga hiperestática' : 'Estructura hiperestática';
  const unknowns = hasSway
    ? `los giros de ${plural(rotating, 'nudo')} (por reparto) y ${solution.modes.map((_, k) => `c_${k + 1}`).join(', ')}, uno por modo de desplazamiento`
    : `los giros de ${plural(rotating, 'nudo')}, por reparto; los nudos no se trasladan`;

  layout.heading('5. Método de Cross (distribución de momentos) en marcos');
  memoirNote(context, `${what} de grado ${solution.classification.indeterminacy}. Incógnitas: ${unknowns}. `
    + 'Barras axialmente indeformables, EI constante por barra, primer orden.');

  drawData(context, solution, step('Datos'));
  drawStiffness(context, solution, memberById, step('Rigideces y factores de distribución'));
  drawFixedEndMoments(context, solution, step('Momentos de empotramiento perfecto'));
  drawNonSway(context, solution, step(hasSway ? 'Distribución sin desplazamiento' : 'Distribución de momentos'));
  if (hasSway) {
    drawSwayModes(context, solution, memberById, step('Modos de desplazamiento'));
    drawSwayEquations(context, solution, step(solution.storeyForm ? 'Ecuaciones de cortante de entrepiso' : 'Ecuaciones de trabajo virtual'));
  }
  drawFinalMoments(context, solution, memberById, step('Momentos finales'));
  drawSections(context, solution, step('Cada barra por secciones'));
  drawVerification(context, solution, step('Comprobación'));
};

/**
 * Resuelve y narra el método; si no aplica, lo dice y devuelve `false` para que la memoria
 * vuelva al procedimiento genérico, igual que los demás métodos.
 */
export const drawCrossFrameSection = (context: ReportContext): boolean => {
  const { project, analysis, combination } = context;
  const solution = solveMomentDistributionFrame(project, analysis, combination, {
    // The textbook's arbitrary «100» is a round number in the units the reader sees.
    referenceSwayMoment: fromDisplay(100, project.settings.units, 'moment'),
  });
  if (!solution.applicable) {
    memoirNote(context, pdfText(REJECTION_MESSAGE));
    return false;
  }
  drawCrossFrame(context, solution);
  return true;
};
