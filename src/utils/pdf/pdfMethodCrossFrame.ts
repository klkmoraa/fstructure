/**
 * Cross (distribución de momentos) en marcos, narrado paso a paso con los números de este
 * modelo: hipótesis, rigideces y factores de distribución, momentos de empotramiento, la tabla de
 * Cross sin desplazamiento, cada modo de desplazamiento con su propia tabla, las ecuaciones de
 * cortante de entrepiso (o de trabajo virtual) que fijan cuánto de cada modo ocurre, los momentos
 * finales, cada barra por secciones y la verificación contra el análisis matricial.
 *
 * Nada se calcula aquí: todo número viene de `solveMomentDistributionFrame`, que ya lo comprobó
 * contra una corrida matricial axialmente rígida. Este archivo sólo decide cómo se lee. La prosa
 * va en Helvetica (WinAnsi), así que las letras griegas y los índices viven en las relaciones
 * tipografiadas, no en el texto corrido.
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
import { REJECTION_MESSAGE, drawRelation, drawScenes, drawWorked } from './pdfMethodSection';
import { agrees, dimensionalFigure, dimensionalUnit } from './pdfSubstitution';
import { pdfText } from './pdfGlyphs';
import type { WorkedEquation } from './pdfEquation';
import type { ReportContext } from './reportContext';

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };
/** Columnas de extremo por tabla de Cross: más no caben a lo ancho de la página. */
const ENDS_PER_TABLE = 8;
const TABLE_SIZE = 6.8;
const PROSE = 8.3;

/** Un momento con signo, en las unidades de la memoria y sin unidad, plegado a cero junto a `reference`. */
const momentFigure = (context: ReportContext, value: number, reference = Math.abs(value)): string =>
  clearCell(context.project, value, 'moment', reference);

const lengthFigure = (context: ReportContext, value: number): string => dimensionalFigure(context.project, value, 0, 1);

/** Envuelve un operando negativo, para que `a + −b` no se lea como una resta. */
const operand = (text: string): string => (text.startsWith('−') || text.startsWith('-') ? `(${text})` : text);

const prose = (context: ReportContext, text: string): void => {
  context.layout.text(text, PROSE, context.layout.fonts.regular, undefined, 8);
};

const modeName = (solution: CrossFrameResult, index: number): string => {
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
      symbolI.push(`wL^2/${divisor}`);
      symbolJ.push(`wL^2/${divisor}`);
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
      described.push(`P${point} = ${P} ${dimensionalUnit(project, 1, 0)} a ${a} ${unitFor(project, 'length')} de i (${term.label})`);
    }
  }
  const unit = unitFor(project, 'moment');
  const pinned = proppedAtI ? `; extremo j (${member.nodeJ}) liberado: MEP_j = 0` : proppedAtJ ? `; extremo i (${member.nodeI}) liberado: MEP_i = 0` : '';
  return {
    caption: `Barra ${member.memberId} (L = ${L} ${unitFor(project, 'length')}): ${described.join('; ')}${pinned}.`,
    equations: [
      ...(proppedAtJ ? [] : [{
        lhs: `MEP_i(${member.memberId})`, symbolic: symbolI.join(' + '), substituted: valuesI.join(' + '),
        result: momentFigure(context, member.fixedEndMomentI, scale), unit,
      }]),
      ...(proppedAtI ? [] : [{
        // The j end carries the opposite sense: −(Σ …), written once rather than term by term.
        lhs: `MEP_j(${member.memberId})`, symbolic: `−(${symbolJ.join(' + ')})`, substituted: `−(${valuesJ.join(' + ')})`,
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
      legend: 'La barra aislada con sus cargas, los momentos de extremo que dejó Cross (antihorario positivo sobre la '
        + 'barra) y los cortantes de extremo que salen de su estática.',
    }];
  });
};

/** Barras con algún extremo liberado, y los nudos donde todos lo están, para nombrarlos. */
const releasedParts = (solution: CrossFrameResult): { members: CrossMember[]; hinges: CrossJoint[] } => ({
  members: solution.members.filter((member) => member.releasedI || member.releasedJ),
  hinges: solution.joints.filter((joint) => joint.hinged),
});

const drawHypotheses = (context: ReportContext, solution: CrossFrameResult): void => {
  const released = releasedParts(solution);
  const anyReleased = released.members.length > 0;
  context.layout.heading('5.1 Hipótesis', 2);
  context.layout.bullets([
    'Barras axialmente indeformables: ninguna barra cambia de longitud, así que sus dos extremos sólo pueden '
      + 'desplazarse uno respecto del otro en dirección perpendicular a la barra.',
    `EI constante en cada barra, nudos rígidos${anyReleased ? ' salvo los extremos liberados' : ''}, pequeños `
      + 'desplazamientos y análisis de primer orden.',
    'Rigidez de cada extremo 4EI/L y factor de transporte 1/2. Los nudos cuyo apoyo no restringe el giro (libres, '
      + 'articulados o deslizantes) se equilibran en cada ciclo; un apoyo articulado es un nudo con factor de '
      + 'distribución 1. Los empotramientos no se equilibran: sólo reciben transporte.',
    ...(anyReleased
      ? ['Extremos liberados (liberación de momento de la barra o articulación interna del nudo): su momento es nulo, '
        + 'no se equilibran ni reciben transporte. El otro extremo de esa barra tiene la rigidez modificada 3EI/L y '
        + 'no transporta nada, y los momentos de empotramiento de la barra son los de la barra empotrada en el '
        + 'extremo continuo y articulada en el liberado. Una barra liberada en sus dos extremos no toma momento. '
        + `Aquí: ${released.members.map((member) => `${member.memberId} (${[member.releasedI ? member.nodeI : '', member.releasedJ ? member.nodeJ : ''].filter(Boolean).join(' y ')})`).join(', ')}`
        + (released.hinges.length ? `; articulación en ${released.hinges.map((joint) => joint.nodeId).join(', ')}.` : '.')]
      : []),
    ...(solution.springs.length
      ? ['Resortes rotacionales de apoyo: el nudo gira y el resorte resiste con M_r = k_r·θ. En el reparto es una '
        + 'rigidez más del nudo, K = k_r: entra en ΣK, toma su parte k_r/ΣK de cada desequilibrio y no transporta nada, '
        + 'porque su otro extremo es el terreno. Como no se traslada, no entra en las ecuaciones de desplazamiento. La '
        + 'reacción de momento del apoyo es −M_r. Aquí: '
        + solution.springs.map((spring) => `${spring.nodeId} (k_r = ${dimensionalFigure(context.project, spring.stiffness, 1, 1)} `
          + `${dimensionalUnit(context.project, 1, 1)}/rad)`).join(', ') + '.']
      : []),
    'Signos: momentos de extremo sobre la barra, antihorarios positivos; giro de cuerda, antihorario positivo. '
      + 'Un desplazamiento relativo de los extremos produce en ambos un momento de empotramiento −6EI(giro)/L'
      + (anyReleased ? '; en una barra con un extremo liberado, −3EI(giro)/L en el continuo y 0 en el liberado.' : '.'),
  ]);
};

const drawStiffness = (context: ReportContext, solution: CrossFrameResult, memberById: ReadonlyMap<string, CrossMember>): void => {
  const { layout, project } = context;
  layout.heading('5.2 Rigideces y factores de distribución', 2);
  const anyReleased = solution.ends.some((end) => end.released);
  const anySpring = solution.springs.length > 0;
  prose(context, 'Por nudo, la rigidez K = 4EI/L de cada extremo que concurre en él y su factor de distribución '
    + 'FD = K/ΣK. Un nudo que no gira tiene FD = 0 en todos sus extremos.'
    + (anyReleased
      ? ' Un extremo cuya barra está liberada en el otro extremo tiene K = 3EI/L; un extremo liberado, K = 0, y un '
        + 'nudo donde todos los extremos están liberados es una articulación: no reparte nada.'
      : '')
    + (anySpring ? ' Un resorte rotacional de apoyo suma su k_r a ΣK como una fila más, sin barra ni transporte.' : ''));
  const stiffnessUnit = dimensionalUnit(project, 1, 1);
  const jointLabel = (joint: CrossJoint) => (joint.rotates ? joint.nodeId : `${joint.nodeId} (${joint.hinged ? 'articulación' : 'empotrado'})`);
  const formula = (index: number) => {
    const end = solution.ends[index];
    if (end.spring) return 'resorte k_r';
    return end.stiffnessCoefficient === 0 ? 'liberado' : `${end.stiffnessCoefficient}EI/L`;
  };
  const showFormula = anyReleased || anySpring;
  layout.table(
    [
      { header: 'Nudo', width: 80 },
      { header: 'Barra', width: 50 },
      { header: `EI (${dimensionalUnit(project, 1, 2)})`, ...NUMERIC },
      { header: `L (${unitFor(project, 'length')})`, ...NUMERIC },
      ...(showFormula ? [{ header: 'Rigidez', width: 50 }] : []),
      { header: showFormula ? `K (${stiffnessUnit})` : `K = 4EI/L (${stiffnessUnit})`, ...NUMERIC },
      { header: 'FD', ...NUMERIC },
    ],
    solution.joints.flatMap((joint) => joint.endIndices.map((index) => {
      const end = solution.ends[index];
      const member = end.spring ? undefined : memberById.get(end.memberId);
      return [
        jointLabel(joint),
        end.memberId,
        member ? dimensionalFigure(project, member.EI, 1, 2) : '—',
        member ? lengthFigure(context, member.length) : '—',
        ...(showFormula ? [formula(index)] : []),
        dimensionalFigure(project, end.stiffness, 1, 1),
        joint.rotates ? number(end.distributionFactor, 4) : '0',
      ];
    })),
    { size: 7.2 },
  );
  const busiest = solution.joints
    .filter((joint) => joint.rotates && joint.endIndices.length > 1)
    .reduce<CrossJoint | undefined>((best, joint) => (!best || joint.endIndices.length > best.endIndices.length ? joint : best), undefined);
  if (!busiest) return;
  const stiffness = (value: number) => dimensionalFigure(project, value, 1, 1, busiest.stiffnessSum);
  drawWorked(context, `Nudo ${busiest.nodeId}, como ejemplo (rigideces en ${stiffnessUnit}):`, [
    {
      lhs: `ΣK(${busiest.nodeId})`, symbolic: busiest.endIndices.some((index) => solution.ends[index].stiffnessCoefficient !== 4) ? 'Σ K' : 'Σ 4EI/L',
      substituted: busiest.endIndices.map((index) => stiffness(solution.ends[index].stiffness)).join(' + '),
      result: stiffness(busiest.stiffnessSum), unit: stiffnessUnit,
    },
    ...busiest.endIndices.map((index) => ({
      lhs: `FD(${solution.ends[index].memberId})`, symbolic: 'K/ΣK',
      substituted: `(${stiffness(solution.ends[index].stiffness)})/(${stiffness(busiest.stiffnessSum)})`,
      result: number(solution.ends[index].distributionFactor, 6),
    })),
  ]);
};

const drawFixedEndMoments = (context: ReportContext, solution: CrossFrameResult): void => {
  const { layout, project } = context;
  const momentUnit = unitFor(project, 'moment');
  layout.heading('5.3 Momentos de empotramiento perfecto', 2);
  prose(context, 'Cada barra aislada y empotrada en sus dos extremos, bajo sus propias cargas de esta combinación (peso '
    + 'propio incluido). Donde la carga es uniforme en toda la barra o puntual, el valor se escribe además con la '
    + 'fórmula del libro; w y P se miden perpendiculares a la barra, positivos hacia −y local (hacia abajo en una viga '
    + 'dibujada de izquierda a derecha), con a y b medidos desde los extremos i y j.'
    + (solution.members.some((member) => member.releasedI || member.releasedJ)
      ? ' Una barra con un extremo liberado se aísla empotrada en el continuo y articulada en el liberado: su MEP es '
        + 'wL²/8, o Pab(L + c)/(2L²) con c la distancia de la carga al extremo articulado, en el extremo empotrado, y '
        + 'nulo en el articulado.'
      : ''));
  layout.table(
    [
      { header: 'Barra', width: 54 },
      { header: 'Nudos i-j', width: 90 },
      { header: `L (${unitFor(project, 'length')})`, ...NUMERIC },
      { header: `MEP i (${momentUnit})`, ...NUMERIC },
      { header: `MEP j (${momentUnit})`, ...NUMERIC },
    ],
    solution.members.map((member) => {
      const scale = Math.max(Math.abs(member.fixedEndMomentI), Math.abs(member.fixedEndMomentJ));
      return [
        member.memberId,
        `${member.nodeI} - ${member.nodeJ}`,
        lengthFigure(context, member.length),
        momentFigure(context, member.fixedEndMomentI, scale),
        momentFigure(context, member.fixedEndMomentJ, scale),
      ];
    }),
    { size: 7.2 },
  );
  const withoutFormula: string[] = [];
  for (const member of solution.members) {
    const worked = femWorked(context, member);
    if (worked) {
      drawWorked(context, worked.caption, worked.equations);
      continue;
    }
    const scale = Math.max(Math.abs(member.fixedEndMomentI), Math.abs(member.fixedEndMomentJ));
    if (scale > 1e-9) withoutFormula.push(member.memberId);
  }
  if (withoutFormula.length) {
    layout.note(`Sin fórmula cerrada en ${withoutFormula.join(', ')}: su carga no es uniforme en toda la barra ni `
      + 'puntual, y el MEP es el que da el análisis de esa barra aislada y empotrada.', 8);
  }
};

const drawSway = (context: ReportContext, solution: CrossFrameResult, memberById: ReadonlyMap<string, CrossMember>): void => {
  const { layout, project } = context;
  const lengthUnit = unitFor(project, 'length');
  const momentUnit = unitFor(project, 'moment');
  const forceUnit = unitFor(project, 'force');
  const count = solution.modes.length;
  const plural = count === 1 ? '' : 's';

  layout.heading('5.5 Desplazamiento de los nudos', 2);
  if (solution.storeyForm) {
    prose(context, `El marco tiene ${count} grado${plural} de desplazamiento lateral, uno por entrepiso. En el modo de cada `
      + 'entrepiso, su nivel superior y todo lo que está encima se trasladan juntos una distancia horizontal; sólo giran '
      + 'las columnas de ese entrepiso, con un giro de cuerda igual a menos el desplazamiento entre la altura:');
    drawRelation(context, 'ψ = −Δ/h');
  } else {
    prose(context, `Con las barras indeformables, las traslaciones de nudo posibles forman un espacio de ${count} `
      + `modo${plural} independiente${plural}: los movimientos que no alargan ninguna barra ni mueven ningún apoyo. `
      + 'Cada modo hace girar la cuerda de algunas barras (n es la normal unitaria de la barra):');
    drawRelation(context, 'ψ = (δu_j − δu_i)·n/L');
  }
  prose(context, 'En cada modo se impone un desplazamiento arbitrario, elegido para que el mayor momento de empotramiento '
    + `por desplazamiento valga 100 ${momentUnit}, y se distribuye igual que antes, sin cargas. Al final cada modo entra `
    + 'multiplicado por un factor c que lo lleva al desplazamiento real.');

  for (const [k, mode] of solution.modes.entries()) {
    layout.heading(mode.storey
      ? `Modo ${k + 1}: entrepiso ${mode.storey.level} (h = ${lengthFigure(context, mode.storey.height)} ${lengthUnit})`
      : `Modo ${k + 1}`, 3);
    prose(context, `Desplazamiento supuesto: ${lengthFigure(context, mode.assumedDisplacement)} ${lengthUnit}. `
      + (mode.storey
        ? `Se trasladan horizontalmente los nudos ${mode.storey.nodeIds.join(', ')}.`
        : `Traslación (x, y) de los nudos, en ${lengthUnit}: ${mode.translations
          .map((entry) => `${entry.nodeId} (${lengthFigure(context, entry.ux)}, ${lengthFigure(context, entry.uy)})`)
          .join('; ')}.`));
    const anyReleased = solution.members.some((member) => member.releasedI || member.releasedJ);
    drawWorked(context, anyReleased
      ? 'Giro de cuerda y momento de empotramiento por desplazamiento: igual en ambos extremos de una barra continua; '
        + 'en una barra con un extremo liberado, sólo en el continuo (una barra liberada en los dos no toma momento):'
      : 'Giro de cuerda y momento de empotramiento por desplazamiento, igual en ambos extremos:',
    mode.chordRotations.flatMap((entry) => {
      const member = memberById.get(entry.memberId)!;
      if (member.releasedI && member.releasedJ) return [];
      const coefficient = member.releasedI || member.releasedJ ? 3 : 6;
      const at = member.releasedJ ? `, ${member.nodeI}` : member.releasedI ? `, ${member.nodeJ}` : '';
      return [{
        lhs: `MEP_Δ(${entry.memberId}${at})`,
        symbolic: `−${coefficient}EIψ/L`,
        substituted: `−${coefficient}(${dimensionalFigure(project, member.EI, 1, 2)})(${number(entry.psi, 5)})/(${lengthFigure(context, member.length)})`,
        result: momentFigure(context, (-coefficient * member.EI * entry.psi) / member.length),
        unit: momentUnit,
      }];
    }));
    drawCrossTable(context, solution, mode.distribution, 'MEP despl.');
  }

  if (solution.storeyForm) {
    prose(context, 'Ecuación de cortante de cada entrepiso: la suma de los cortantes de sus columnas iguala la fuerza '
      + 'lateral que actúa por encima del corte (cargas nodales y la parte de las cargas de barra que llega a ese '
      + 'nivel). El cortante de una columna es la suma de sus dos momentos de extremo entre su altura:');
    drawRelation(context, 'Σ(M_inf + M_sup)/h = H');
    prose(context, `La tabla da esa suma para cada estado, en ${forceUnit}. Por superposición, la del estado sin `
      + 'desplazamiento más c veces la de cada modo tiene que igualar H en cada entrepiso.');
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
      { size: 7.2 },
    );
    drawWorked(context, 'Una ecuación por entrepiso:', solution.equations.map((equation, k) => ({
      lhs: `ΣV(entrepiso ${solution.modes[k].storey?.level ?? k + 1})`,
      substituted: [
        clearCell(project, -equation.nonSwayMomentTerm, 'force', reference),
        ...equation.coefficients.map((value, l) => `c_${l + 1}(${clearCell(project, -value, 'force', reference)})`),
      ].join(' + '),
      result: clearCell(project, equation.nodalLoadTerm + equation.memberLoadTerm, 'force', reference),
      unit: forceUnit,
    })));
  } else {
    prose(context, 'Ecuación de trabajo virtual de cada modo k: el marco se mueve como mecanismo según ese modo (barras '
      + 'rígidas, nudos articulados) y el trabajo de todas las acciones tiene que ser nulo. W es el trabajo de las '
      + 'cargas de cada barra, igual a menos el de las reacciones de esa barra empotrada'
      + (solution.ends.some((end) => end.released)
        ? ' (empotrada–articulada si tiene un extremo liberado; ahí M = 0 y Mr = 0, y el extremo entra sólo por sus fuerzas)'
        : '')
      + `; con el modo normalizado a desplazamiento unitario cada término queda en ${forceUnit}.`);
    drawRelation(context, 'G_k = Σ(M_i + M_j)ψ^k + ΣW^k + ΣP·δu^k = 0');
    drawRelation(context, 'W^k = −[R_i·δu_i^k + R_j·δu_j^k + (Mr_i + Mr_j)ψ^k]');
    const reference = Math.max(1e-9, ...solution.equations.flatMap((equation) => [
      Math.abs(equation.nonSwayMomentTerm), Math.abs(equation.memberLoadTerm), Math.abs(equation.nodalLoadTerm),
      ...equation.coefficients.map((value) => Math.abs(value)),
    ]));
    const figure = (value: number) => clearCell(project, value, 'force', reference);
    prose(context, 'En orden: el término de momentos del estado sin desplazamiento, c veces el de cada modo, el trabajo de '
      + 'las cargas de barra y el de las cargas nodales.');
    drawWorked(context, undefined, solution.equations.map((equation, k) => ({
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
  drawWorked(context, 'Resolviendo el sistema:', solution.swayFactors.map((value, k) => ({
    lhs: `c_${k + 1}`,
    result: clearNumber(value, cScale, 6),
  })));
  prose(context, `Desplazamiento real de cada modo, c por el supuesto: ${solution.modes.map((mode, k) => (
    `${modeName(solution, k)}, ${lengthFigure(context, solution.swayFactors[k] * mode.assumedDisplacement)} ${lengthUnit}`
  )).join('; ')}.`);
};

const drawFinalMoments = (context: ReportContext, solution: CrossFrameResult, memberById: ReadonlyMap<string, CrossMember>, number_: string): void => {
  const { layout, project } = context;
  const momentUnit = unitFor(project, 'moment');
  const hasSway = solution.modes.length > 0;
  layout.heading(`${number_} Momentos finales`, 2);
  if (hasSway) {
    prose(context, 'En cada extremo, la distribución sin desplazamiento más cada modo escalado por su factor:');
    drawRelation(context, 'M = M^0 + Σ c_k M^k');
  } else {
    prose(context, 'Los momentos de extremo son la suma final de la tabla de Cross.');
  }
  const reference = Math.max(1e-9, ...solution.final.map((value) => Math.abs(value)));
  const separate = solution.modes.length <= 3;
  layout.table(
    [
      { header: 'Barra', width: 54 },
      { header: 'Nudo', width: 54 },
      ...(hasSway ? [{ header: `M0 (${momentUnit})`, ...NUMERIC }] : []),
      ...(hasSway
        ? separate
          ? solution.modes.map((_, k) => ({ header: `c${k + 1} M${k + 1} (${momentUnit})`, ...NUMERIC }))
          : [{ header: `Suma c M (${momentUnit})`, ...NUMERIC }]
        : []),
      { header: `M final (${momentUnit})`, ...NUMERIC },
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
    { size: 7.2 },
  );
  if (!solution.storeyForm) return;
  // Closing check with the final moments alone: each storey's column shears add up to H.
  drawWorked(context, 'Comprobación del cortante de cada entrepiso con los momentos finales:', solution.modes.flatMap((mode, k) => {
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
      symbolic: 'Σ(M_inf + M_sup)/h',
      substituted: `(${columns.map((member) => `${operand(momentFigure(context, member.finalMomentI, reference))} + ${operand(momentFigure(context, member.finalMomentJ, reference))}`).join(' + ')})/(${lengthFigure(context, storey.height)})`,
      result: clearCell(project, total, 'force', scale),
      unit: unitFor(project, 'force'),
    }];
  }));
};

const drawSections = (context: ReportContext, solution: CrossFrameResult, number_: string): void => {
  const { layout, project } = context;
  const lengthUnit = unitFor(project, 'length');
  const momentUnit = unitFor(project, 'moment');
  const forceUnit = unitFor(project, 'force');
  layout.heading(`${number_} Cada barra por secciones`, 2);
  prose(context, 'Con los momentos de extremo ya conocidos, cada barra es una viga simplemente apoyada con sus cargas y '
    + 'dos momentos aplicados en sus extremos. V0 y M0 son el cortante y el momento de esa viga isostática; x se mide '
    + 'desde el nudo i, y el diagrama usa la convención del resto de la memoria (y local hacia arriba), en la que el '
    + 'momento de extremo i aparece con el signo cambiado:');
  drawRelation(context, 'V(x) = V_0(x) + (M_i + M_j)/L');
  drawRelation(context, 'M(x) = M_0(x) − M_i + (M_i + M_j)x/L');
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
    const where = extremes.map((entry) => `x = ${lengthFigure(context, entry.x)} ${lengthUnit}`).join(' y ');
    const label = extremes.length === 1 ? 'momento extremo' : 'momentos extremos';
    drawWorked(context, `Barra ${member.memberId} (${member.nodeI} - ${member.nodeJ}, L = ${L} ${lengthUnit}); ${label} en ${where}:`, [
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
      ...extremes.map((entry) => ({ lhs: `M(${lengthFigure(context, entry.x)})`, result: displayCell(project, entry.value, 'moment'), unit: momentUnit })),
    ]);
  }
  layout.table(
    [
      { header: 'Barra', width: 50 },
      { header: `V(0) (${forceUnit})`, ...NUMERIC },
      { header: `V(L) (${forceUnit})`, ...NUMERIC },
      { header: `M max. (${momentUnit})`, ...NUMERIC },
      { header: `en x (${lengthUnit})`, ...NUMERIC },
      { header: `M min. (${momentUnit})`, ...NUMERIC },
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
    { size: 7 },
  );
  drawScenes(
    context,
    memberScenes(context, solution),
    (scene) => `${scene.title ?? 'barra'}: momentos finales de Cross y cortantes de extremo por estática.`,
  );
};

const drawVerification = (context: ReportContext, solution: CrossFrameResult, number_: string): void => {
  const { layout, project } = context;
  const { fonts, palette } = layout;
  const momentUnit = unitFor(project, 'moment');
  const { verification } = solution;
  layout.heading(`${number_} Verificación contra el análisis matricial`, 2);
  prose(context, 'El análisis matricial del resto de la memoria incluye el acortamiento y el alargamiento de las barras; '
    + 'Cross no. Por eso el resultado se compara primero contra el mismo análisis matricial sobre una copia del modelo '
    + `con el área de cada barra multiplicada por ${number(verification.axialStiffnessFactor, 3)} (y su densidad dividida `
    + 'por lo mismo, para que el peso propio no cambie): una referencia prácticamente indeformable axialmente, que tiene '
    + 'que coincidir. Después, contra el análisis real: esa diferencia no es un error del método sino el efecto de la '
    + 'deformación axial que la hipótesis desprecia.');
  const reference = Math.max(1e-9, verification.referenceMoment, verification.solverReferenceMoment);
  layout.table(
    [
      { header: 'Barra', width: 46 },
      { header: `Cross i (${momentUnit})`, ...NUMERIC },
      { header: `Rígido i (${momentUnit})`, ...NUMERIC },
      { header: `Real i (${momentUnit})`, ...NUMERIC },
      { header: `Cross j (${momentUnit})`, ...NUMERIC },
      { header: `Rígido j (${momentUnit})`, ...NUMERIC },
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
    { size: 7 },
  );
  if (solution.springs.length) {
    prose(context, 'Resortes rotacionales: la reacción de momento del apoyo es −M_r, contra la de las dos corridas matriciales.');
    layout.table(
      [
        { header: 'Apoyo', width: 46 },
        { header: `M_r Cross (${momentUnit})`, ...NUMERIC },
        { header: 'Giro θ (rad)', ...NUMERIC },
        { header: `−M_r (${momentUnit})`, ...NUMERIC },
        { header: `Rígido (${momentUnit})`, ...NUMERIC },
        { header: `Real (${momentUnit})`, ...NUMERIC },
      ],
      solution.springs.map((spring) => [
        spring.nodeId,
        momentFigure(context, spring.moment, reference),
        number(spring.rotation, 5),
        momentFigure(context, -spring.moment, reference),
        momentFigure(context, spring.rigidReaction, reference),
        momentFigure(context, spring.solverReaction, reference),
      ]),
      { size: 7 },
    );
  }
  const relative = (value: number, scale: number) => (scale > 0 ? value / scale : 0);
  const display = (value: number) => clearCell(project, value, 'moment', 1);
  layout.text(
    `Contra la referencia axialmente rígida: diferencia máxima ${display(verification.rigidResidual)} ${momentUnit} `
    + `(${number(relative(verification.rigidResidual, verification.referenceMoment), 2)} del mayor momento).`,
    8.7, fonts.bold, palette.ink, 8,
  );
  layout.text(
    `Contra el análisis real: diferencia máxima ${display(verification.solverResidual)} ${momentUnit} `
    + `(${number(100 * relative(verification.solverResidual, verification.solverReferenceMoment), 3)} % del mayor `
    + 'momento), el efecto de la deformación axial de las barras.',
    8.7, fonts.bold, palette.ink, 8,
  );
};

export const drawCrossFrame = (context: ReportContext, solution: CrossFrameResult): void => {
  const { layout } = context;
  const memberById = new Map(solution.members.map((member) => [member.memberId, member]));
  const hasSway = solution.modes.length > 0;
  const anyReleased = solution.ends.some((end) => end.released);

  layout.heading('5. Procedimiento: Cross (distribución de momentos) en marcos');
  layout.text(
    'Cada barra se empotra en imaginación en sus dos extremos y se calcula el momento que desarrollaría así bajo sus '
    + 'propias cargas. Después se sueltan los nudos que pueden girar: cada uno reparte su desequilibrio entre las '
    + 'barras que concurren en él, en proporción a su rigidez, y transmite la mitad de lo repartido al otro extremo de '
    + 'cada barra. Ciclo tras ciclo el desequilibrio desaparece, sin resolver un sistema de ecuaciones. '
    + (anyReleased
      ? 'Los extremos liberados de este modelo (articulaciones y liberaciones de momento) no se empotran: la barra se '
        + 'empotra sólo en su extremo continuo, que trabaja con rigidez 3EI/L y no transmite nada al liberado. '
      : '')
    + (hasSway
      ? 'Este modelo, además, puede trasladar sus nudos: cada modo de desplazamiento se distribuye por separado y la '
        + 'proporción correcta de cada uno se fija con una ecuación de equilibrio por modo.'
      : 'Los nudos de este modelo no pueden trasladarse sin alargar una barra, así que basta una sola distribución.'),
    8.7, layout.fonts.regular, undefined, 8,
  );

  drawHypotheses(context, solution);
  drawStiffness(context, solution, memberById);
  drawFixedEndMoments(context, solution);

  layout.heading(hasSway ? '5.4 Distribución sin desplazamiento' : '5.4 Distribución de momentos', 2);
  const shownCycles = solution.nonSway.cycles.length;
  prose(context, (hasSway ? 'Con los nudos impedidos de trasladarse, se' : 'Se')
    + ' equilibran a la vez todos los nudos que giran y luego se transporta la mitad de lo repartido al otro extremo '
    + (anyReleased ? 'de cada barra, salvo hacia un extremo liberado, que no recibe nada. ' : 'de cada barra. ')
    + (solution.nonSway.cycleCount > shownCycles
      ? `Se muestran los primeros ${shownCycles} ciclos; el reparto convergió en ${solution.nonSway.cycleCount} y la fila `
        + '«Ciclos» suma lo que aportaron los restantes. '
      : `El reparto convergió en ${solution.nonSway.cycleCount} ciclo${solution.nonSway.cycleCount === 1 ? '' : 's'}, todos en la tabla. `)
    + `Momentos en ${unitFor(context.project, 'moment')}.`);
  const loaded = solution.joints.filter((joint) => joint.rotates && joint.appliedMoment !== 0);
  if (loaded.length) {
    prose(context, 'Momentos aplicados en nudos (antihorario positivo): el desequilibrio que se reparte en ellos es la '
      + 'suma de los momentos de extremo menos el momento aplicado. '
      + loaded.map((joint) => `${joint.nodeId}: ${displayCell(context.project, joint.appliedMoment, 'moment')} ${unitFor(context.project, 'moment')}`).join('; ')
      + '.');
  }
  drawCrossTable(context, solution, solution.nonSway, 'MEP');

  if (hasSway) drawSway(context, solution, memberById);
  drawFinalMoments(context, solution, memberById, hasSway ? '5.6' : '5.5');
  drawSections(context, solution, hasSway ? '5.7' : '5.6');
  drawVerification(context, solution, hasSway ? '5.8' : '5.7');
};

/**
 * Resuelve y narra el método; si no aplica, lo dice y devuelve `false` para que la memoria
 * vuelva al procedimiento genérico, igual que los demás métodos.
 */
export const drawCrossFrameSection = (context: ReportContext): boolean => {
  const { project, analysis, combination, layout } = context;
  const solution = solveMomentDistributionFrame(project, analysis, combination, {
    // The textbook's arbitrary «100» is a round number in the units the reader sees.
    referenceSwayMoment: fromDisplay(100, project.settings.units, 'moment'),
  });
  if (!solution.applicable) {
    layout.text(pdfText(REJECTION_MESSAGE), PROSE, layout.fonts.regular, undefined, 8);
    return false;
  }
  drawCrossFrame(context, solution);
  return true;
};
