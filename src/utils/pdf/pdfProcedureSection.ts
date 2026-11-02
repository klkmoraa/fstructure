/**
 * La parte de análisis: el procedimiento con los números de esta estructura.
 *
 * Con el método matricial se escribe como una memoria de oficina: datos → planteamiento
 * (K U = F y la rigidez de una barra en símbolos) → rigidez de cada barra en una tabla →
 * cargas equivalentes → solución → fuerzas en las barras → comprobación. El detalle barra por
 * barra (matrices T, k y su contribución a K) queda en el anexo de la traza.
 *
 * Cuando el proyecto elige un método clásico, ese método escribe esta parte en su lugar.
 */
import { drawMethodSection } from './pdfMethodSection';
import { classifyStructure } from '../../analysis-methods/structureClassification';
import { clearNumber, number, unitFor } from './pdfFormat';
import { memoirCheck, memoirFormula, memoirNote, memoirResults, memoirStep, memoirWork } from './pdfMemoirKit';
import { drawRuns, mathRuns, measureRuns } from './pdfInlineMath';
import { mathFaces } from './pdfMath';
import { TYPE } from './pdfTheme';
import {
  agrees,
  dimensionalFigure,
  dimensionalUnit,
  elongation,
  memberGeometry,
  nodalLoadTotals,
  scaleOf,
  stiffnessExample,
  stiffnessTerms,
  trussAxial,
  trussForceExample,
  uniformLoadExample,
  type StiffnessTerms,
} from './pdfSubstitution';
import type { PdfTableColumn } from './pdfBuilder';
import type { ReportContext } from './reportContext';
import type { SolutionMethodId } from '../../analysis-methods/methodRegistry';
import type { ProjectModel, SupportDefinition } from '../../types';

export const METHOD_LABEL: Record<SolutionMethodId, string> = {
  'matrix-stiffness': 'Matriz de rigidez',
  'double-integration': 'Doble integración',
  'conjugate-beam': 'Viga conjugada',
  'three-moment': 'Teorema de los tres momentos',
  'hardy-cross': 'Distribución de momentos de Hardy Cross',
  'portal-method': 'Método del portal',
  'cantilever-method': 'Método del voladizo',
  'kani-frame': 'Método de Kani (sin traslación lateral)',
  'virtual-work': 'Trabajo virtual / carga unitaria',
  'method-of-sections': 'Cortes / secciones',
  'method-of-joints': 'Método de los nudos',
  'castigliano-truss': 'Castigliano / trabajo mínimo',
  'moment-distribution-frame': 'Cross (distribución de momentos) en marcos',
  'statics-sections': 'Método de secciones (estática y cortes)',
  'arch-least-work': 'Trabajo mínimo / Castigliano en arcos',
};

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };

/** El tipo de estructura y si su nombre es femenino, para concordar «isostática». */
const KIND: Record<string, readonly [string, boolean]> = {
  'simple-beam': ['Viga de un claro', true],
  'continuous-beam': ['Viga continua', true],
  frame: ['Marco plano', false],
  truss: ['Armadura plana', true],
  other: ['Estructura plana', true],
};

const SUPPORT_NAME: Record<SupportDefinition['type'], string> = {
  none: '—',
  pin: 'articulado',
  roller: 'rodillo',
  fixed: 'empotrado',
  custom: 'restricciones propias',
};

/** Componentes restringidas por un apoyo, en la notación de los grados de libertad. */
const restrainedComponents = (support: SupportDefinition): string[] => {
  if (support.type === 'fixed') return ['U_x', 'U_y', 'θ_z'];
  if (support.type === 'pin') return ['U_x', 'U_y'];
  if (support.type === 'roller') {
    const angle = ((support.angleDeg ?? 90) % 180 + 180) % 180;
    return [angle === 90 ? 'U_y' : angle === 0 ? 'U_x' : 'U_n'];
  }
  if (support.type === 'custom') {
    return [...(support.restrainX ? ['U_x'] : []), ...(support.restrainY ? ['U_y'] : []), ...(support.restrainR ? ['θ_z'] : [])];
  }
  return [];
};

/** Grados de libertad del modelo: dos por nudo de armadura, tres por nudo con barras de marco. */
const degreesOfFreedom = (project: ProjectModel): { total: number; restrained: number; rotations: boolean } => {
  let total = 0;
  let restrained = 0;
  let rotations = false;
  for (const node of project.nodes) {
    const bending = project.members.some((member) => member.type !== 'truss' && (member.i === node.id || member.j === node.id));
    rotations ||= bending;
    total += bending ? 3 : 2;
    restrained += restrainedComponents(node.support).filter((component) => bending || component !== 'θ_z').length;
  }
  return { total, restrained, rotations };
};

/**
 * Una matriz en símbolos, con sus corchetes: `k^l = [EA/L 0 0 …]`. La fórmula de una memoria
 * se escribe así, no como una lista de términos.
 */
const drawSymbolMatrix = (context: ReportContext, lhs: string, factor: string, rows: readonly (readonly string[])[]): void => {
  const { layout } = context;
  const size = TYPE.math;
  const faces = mathFaces(layout);
  const columns = rows[0]?.length ?? 0;
  if (!columns) return;
  const widths = Array.from({ length: columns }, (_, column) => Math.max(...rows.map((row) => measureRuns(mathRuns(row[column] ?? ''), faces, size))));
  const gutter = size * 1.2;
  const inner = size * 0.55;
  const matrixWidth = widths.reduce((sum, width) => sum + width, 0) + gutter * (columns - 1) + inner * 2;
  const rowHeight = size * 1.6;
  const height = rows.length * rowHeight + size * 0.3;
  const head = `${lhs} = ${factor}`;
  const headWidth = measureRuns(mathRuns(head), faces, size);
  layout.ensure(height + size * 2);
  layout.gap(1);
  const left = layout.margin + Math.max(18, (layout.contentWidth - headWidth - matrixWidth) / 2);
  const top = layout.y;
  const bottom = top - height;
  const { page, palette } = layout;
  drawRuns(page, mathRuns(head), left, (top + bottom) / 2 - size * 0.35, size, faces, palette.ink);
  const open = left + headWidth;
  const close = open + matrixWidth;
  for (const [x, tick] of [[open, 3], [close, -3]] as const) {
    page.drawLine({ start: { x, y: top }, end: { x, y: bottom }, thickness: 0.7, color: palette.ink });
    page.drawLine({ start: { x, y: top }, end: { x: x + tick, y: top }, thickness: 0.7, color: palette.ink });
    page.drawLine({ start: { x, y: bottom }, end: { x: x + tick, y: bottom }, thickness: 0.7, color: palette.ink });
  }
  rows.forEach((row, rowIndex) => {
    const baseline = top - size * 0.15 - (rowIndex + 1) * rowHeight + rowHeight * 0.32;
    let x = open + inner;
    row.forEach((cell, column) => {
      const runs = mathRuns(cell);
      drawRuns(page, runs, x + (widths[column]! - measureRuns(runs, faces, size)) / 2, baseline, size, faces, palette.ink);
      x += widths[column]! + gutter;
    });
  });
  layout.y = bottom - size * 0.6;
  layout.gap(1);
};

const FRAME_MATRIX = [
  ['EA/L', '0', '0', '−EA/L', '0', '0'],
  ['0', '12EI/L^3', '6EI/L^2', '0', '−12EI/L^3', '6EI/L^2'],
  ['0', '6EI/L^2', '4EI/L', '0', '−6EI/L^2', '2EI/L'],
  ['−EA/L', '0', '0', 'EA/L', '0', '0'],
  ['0', '−12EI/L^3', '−6EI/L^2', '0', '12EI/L^3', '−6EI/L^2'],
  ['0', '6EI/L^2', '2EI/L', '0', '−6EI/L^2', '4EI/L'],
] as const;

const TRUSS_MATRIX = [
  ['c^2', 'c s', '−c^2', '−c s'],
  ['c s', 's^2', '−c s', '−s^2'],
  ['−c^2', '−c s', 'c^2', 'c s'],
  ['−c s', '−s^2', 'c s', 's^2'],
] as const;

const drawMatrixProcedure = (context: ReportContext): void => {
  const { layout, project, analysis, options } = context;
  const geometries = memberGeometry(context);
  if (!geometries.length) {
    memoirNote(context, 'El modelo no tiene barras que analizar.');
    return;
  }
  const lengthUnit = unitFor(project, 'length');
  const forceUnit = unitFor(project, 'force');
  const stiffnessUnit = dimensionalUnit(project, 1, -1);
  const momentUnit = dimensionalUnit(project, 1, 1);
  const frames = geometries.filter((entry) => entry.member.type === 'frame' && !entry.curved);
  const trusses = geometries.filter((entry) => entry.member.type === 'truss' && !entry.curved);
  const curved = geometries.filter((entry) => entry.curved);
  const rigid = geometries.filter((entry) => entry.member.type === 'rigid');
  const terms = new Map<string, StiffnessTerms>();
  for (const entry of geometries) {
    const found = stiffnessTerms(context, entry);
    if (found) terms.set(entry.member.id, found);
  }
  const classification = classifyStructure(project);
  const [kindName, feminine] = KIND[classification.kind] ?? KIND.other!;
  const ending = feminine ? 'a' : 'o';
  const degree = classification.indeterminacy === 0 ? `isostátic${ending}` : `hiperestátic${ending} de grado ${classification.indeterminacy}`;
  const dofs = degreesOfFreedom(project);
  const trace = analysis.educationTrace;
  const hasTracePart = options.includeAnnex !== false && options.includeEducationTrace !== false && Boolean(trace);
  let stepNumber = 0;
  const step = (title: string) => {
    // El título de un paso no se queda solo al pie: pide sitio para lo primero que encabeza.
    layout.ensure(150);
    memoirStep(context, `5.${++stepNumber} ${title}`);
  };
  const length = (value: number, reference = value) => dimensionalFigure(project, value, 0, 1, reference);
  const force = (value: number, reference = value) => dimensionalFigure(project, value, 1, 0, reference);
  const moment = (value: number, reference = value) => dimensionalFigure(project, value, 1, 1, reference);

  layout.heading('5. Método matricial de rigidez');
  memoirNote(context, `${kindName} ${degree}: ${project.nodes.length} nudos, ${geometries.length} barra${geometries.length === 1 ? '' : 's'} y `
    + `${dofs.total} grados de libertad (${dofs.restrained} restringidos). Se resuelve K U = F y se recuperan las fuerzas en las barras.`);

  // ── Datos ────────────────────────────────────────────────────────────────────────────
  step('Datos');
  memoirNote(context, 'Barras (de i a j), con sus cosenos directores c = cos θ, s = sen θ y las propiedades de su sección.');
  const bending = geometries.some((entry) => entry.member.type === 'frame');
  const lengthScale = scaleOf(geometries.map((entry) => entry.L));
  layout.table([
    { header: 'Barra', width: 54 },
    { header: 'Nudos', width: 64 },
    { header: `L (${lengthUnit})`, ...NUMERIC },
    { header: 'c', ...NUMERIC },
    { header: 's', ...NUMERIC },
    { header: `E (${dimensionalUnit(project, 1, -2)})`, width: 74, ...NUMERIC },
    { header: `A (${dimensionalUnit(project, 0, 2)})`, width: 66, ...NUMERIC },
    ...(bending ? [{ header: `I (${dimensionalUnit(project, 0, 4)})`, width: 74, ...NUMERIC }] : []),
  ], geometries.map(({ member, L, c, s, curved: isCurved }) => {
    const rigidLink = member.type === 'rigid';
    return [
      isCurved ? `${member.id} (curva)` : rigidLink ? `${member.id} (rígida)` : member.id,
      `${member.i} – ${member.j}`,
      length(L, lengthScale),
      number(c, 4),
      number(s, 4),
      rigidLink ? '—' : dimensionalFigure(project, member.E, 1, -2),
      rigidLink ? '—' : dimensionalFigure(project, member.A, 0, 2),
      ...(bending ? [member.type === 'frame' && member.I > 0 ? dimensionalFigure(project, member.I, 0, 4) : '—'] : []),
    ];
  }));

  const supports = project.nodes.filter((node) => node.support.type !== 'none' || node.support.spring);
  if (supports.length) {
    layout.table([
      { header: 'Apoyo', width: 54 },
      { header: 'Tipo', width: 110 },
      { header: 'Condición de borde', flex: 2 },
    ], supports.map((node) => {
      const components = restrainedComponents(node.support).filter((component) => dofs.rotations || component !== 'θ_z');
      const spring = node.support.spring;
      const springs = spring ? [
        spring.kx ? `k_x = ${dimensionalFigure(project, spring.kx, 1, -1)} ${stiffnessUnit}` : '',
        spring.ky ? `k_y = ${dimensionalFigure(project, spring.ky, 1, -1)} ${stiffnessUnit}` : '',
        spring.kr ? `k_θ = ${dimensionalFigure(project, spring.kr, 1, 1)} ${momentUnit}/rad` : '',
        spring.kNormal ? `k_n = ${dimensionalFigure(project, spring.kNormal, 1, -1)} ${stiffnessUnit}` : '',
      ].filter(Boolean) : [];
      return [
        node.id,
        `${SUPPORT_NAME[node.support.type]}${spring ? ' con resorte' : ''}`,
        [components.length ? `${components.join(' = ')} = 0` : '', ...springs].filter(Boolean).join(';  '),
      ];
    }));
  }

  const nodal = nodalLoadTotals(context);
  if (nodal.length) {
    memoirNote(context, 'Cargas en los nudos, ya multiplicadas por el factor de su caso:');
    const scale = scaleOf(nodal.flatMap((load) => [load.fx, load.fy]));
    layout.table([
      { header: 'Nudo', width: 54 },
      { header: `P_x (${forceUnit})`, ...NUMERIC },
      { header: `P_y (${forceUnit})`, ...NUMERIC },
      ...(dofs.rotations ? [{ header: `M (${momentUnit})`, ...NUMERIC }] : []),
    ], nodal.map((load) => [load.nodeId, force(load.fx, scale), force(load.fy, scale), ...(dofs.rotations ? [moment(load.mz)] : [])]));
  }

  // ── Planteamiento ────────────────────────────────────────────────────────────────────
  step('Planteamiento');
  const memberLoads = Boolean(trace?.elements.some((element) => element.localEquivalentLoadOriginal.some((value) => value !== 0)))
    || project.memberLoads.some((load) => (context.scenarioFactors[load.caseId] ?? 0) !== 0);
  memoirFormula(context, 'K U = F', [
    ['K', 'matriz de rigidez global: suma de la rigidez de cada barra en sus grados de libertad'],
    ['U', dofs.rotations ? 'desplazamientos de los nudos [U_x, U_y, θ_z]' : 'desplazamientos de los nudos [U_x, U_y]'],
    ['F', memberLoads ? 'cargas en los nudos más las equivalentes de las cargas en barras' : 'cargas en los nudos'],
  ]);
  if (frames.length || curved.length) {
    memoirNote(context, 'Rigidez de una barra de marco en ejes locales, para [u_i, v_i, θ_i, u_j, v_j, θ_j]:');
    drawSymbolMatrix(context, 'k^l', '', FRAME_MATRIX);
  }
  if (trusses.length) {
    memoirNote(context, 'Rigidez de una barra de armadura en ejes globales, para [u_i, v_i, u_j, v_j]:');
    drawSymbolMatrix(context, 'k', 'EA/L ', TRUSS_MATRIX);
  }
  const local = frames.length > 0 || curved.length > 0;
  memoirFormula(
    context,
    [local ? 'k = T^T k^l T' : '', 'K = Σ k', memberLoads ? 'F = P + Σ T^T f^l' : 'F = P'].filter(Boolean).join(',    '),
    [
      ...(local || memberLoads ? [['T', 'rotación de ejes locales a globales, con c y s de la barra'] as const] : []),
      ['P', 'cargas aplicadas en los nudos'],
      ...(memberLoads ? [['f^l', 'cargas equivalentes de las cargas en la barra'] as const] : []),
    ],
  );

  // ── Rigidez de cada barra ────────────────────────────────────────────────────────────
  step('Rigidez de cada barra');
  const exampleSource = [...frames, ...trusses].find((entry) => terms.has(entry.member.id) && stiffnessExample(context, entry, terms.get(entry.member.id)!).length);
  if (exampleSource) {
    memoirWork(context, stiffnessExample(context, exampleSource, terms.get(exampleSource.member.id)!), `Barra ${exampleSource.member.id}:`);
  }
  const frameRows = frames.filter((entry) => terms.has(entry.member.id));
  if (frameRows.length > 1 || (frameRows.length === 1 && frameRows[0] !== exampleSource)) {
    const scale = (pick: (entry: StiffnessTerms) => number) => scaleOf(frameRows.map((entry) => pick(terms.get(entry.member.id)!)));
    layout.table([
      { header: 'Barra', width: 54 },
      { header: `EA/L (${stiffnessUnit})`, ...NUMERIC },
      { header: `12EI/L^3 (${stiffnessUnit})`, ...NUMERIC },
      { header: `6EI/L^2 (${forceUnit})`, ...NUMERIC },
      { header: `4EI/L (${momentUnit})`, ...NUMERIC },
      { header: `2EI/L (${momentUnit})`, ...NUMERIC },
    ], frameRows.map((entry) => {
      const k = terms.get(entry.member.id)!;
      return [
        entry.member.id,
        dimensionalFigure(project, k.axial, 1, -1, scale((item) => item.axial)),
        dimensionalFigure(project, k.shear, 1, -1, scale((item) => item.shear)),
        dimensionalFigure(project, k.coupling, 1, 0, scale((item) => item.coupling)),
        dimensionalFigure(project, k.near, 1, 1, scale((item) => item.near)),
        dimensionalFigure(project, k.far, 1, 1, scale((item) => item.far)),
      ];
    }));
  }
  const trussRows = trusses.filter((entry) => terms.has(entry.member.id));
  if (trussRows.length > 1 || (trussRows.length === 1 && trussRows[0] !== exampleSource)) {
    const scale = scaleOf(trussRows.map((entry) => terms.get(entry.member.id)!.axial));
    layout.table([
      { header: 'Barra', width: 54 },
      { header: `EA/L (${stiffnessUnit})`, ...NUMERIC },
      { header: `(EA/L) c^2 (${stiffnessUnit})`, ...NUMERIC },
      { header: `(EA/L) c s (${stiffnessUnit})`, ...NUMERIC },
      { header: `(EA/L) s^2 (${stiffnessUnit})`, ...NUMERIC },
    ], trussRows.map((entry) => {
      const k = terms.get(entry.member.id)!.axial;
      return [
        entry.member.id,
        dimensionalFigure(project, k, 1, -1, scale),
        dimensionalFigure(project, k * entry.c * entry.c, 1, -1, scale),
        dimensionalFigure(project, k * entry.c * entry.s, 1, -1, scale),
        dimensionalFigure(project, k * entry.s * entry.s, 1, -1, scale),
      ];
    }));
  }
  const timoshenko = frames.filter((entry) => entry.member.beamTheory === 'timoshenko').map((entry) => entry.member.id);
  if (timoshenko.length) {
    memoirNote(context, `Barras de Timoshenko (${timoshenko.join(', ')}): los términos de flexión incluyen la deformación por cortante, φ = 12EI/(G A_s L^2).`);
  }
  const released = frames.filter((entry) => {
    const element = trace?.elements.find((item) => item.memberId === entry.member.id);
    return element ? element.releasedLocalDofs.length > 0
      : Boolean(entry.member.releases?.iMoment || entry.member.releases?.jMoment || context.index.node(entry.member.i)?.internalHinge || context.index.node(entry.member.j)?.internalHinge);
  }).map((entry) => entry.member.id);
  if (released.length) {
    memoirNote(context, `Barras con extremos liberados (${released.join(', ')}): se condensan, k^* = k_{aa} − k_{ab} k_{bb}^{−1} k_{ba}.`);
  }
  if (rigid.length) {
    memoirNote(context, `Vínculos rígidos (${rigid.map((entry) => entry.member.id).join(', ')}): se imponen como restricciones cinemáticas, sin rigidez propia.`);
  }
  if (curved.length) {
    memoirNote(context, `Barras curvas (${curved.map((entry) => entry.member.id).join(', ')}): se dividen, sólo para el cálculo, en tramos rectos cortos a lo largo del arco, cada uno con la rigidez k^l de una barra de marco.`);
  }

  // ── Cargas equivalentes ──────────────────────────────────────────────────────────────
  const loaded = (trace?.elements ?? []).filter((element) => element.localEquivalentLoadOriginal.some((value) => value !== 0));
  if (memberLoads) {
    step('Cargas equivalentes en los nudos');
    const uniform = uniformLoadExample(context);
    if (uniform) {
      memoirFormula(context, 'f^l = [0, q L/2, q L^2/12, 0, q L/2, −q L^2/12]^T', [
        ['q', `carga uniforme transversal sobre la barra, peso propio incluido (${dimensionalUnit(project, 1, -1)})`],
      ]);
      memoirWork(context, uniform.equations, `Barra ${uniform.memberId}:`);
    } else {
      memoirFormula(context, 'f^l = ∫ N^T(x) p(x) dx', [
        ['N(x)', 'funciones de forma de la barra'],
        ['p(x)', 'carga en la barra, en ejes locales'],
      ]);
    }
    if (loaded.length) {
      const forceScale = scaleOf(loaded.flatMap((element) => [0, 1, 3, 4].map((index) => element.localEquivalentLoadOriginal[index] ?? 0)));
      const momentScale = scaleOf(loaded.flatMap((element) => [2, 5].map((index) => element.localEquivalentLoadOriginal[index] ?? 0)));
      const showMoments = dofs.rotations;
      layout.table([
        { header: 'Barra', width: 54 },
        { header: `f_{x,i} (${forceUnit})`, ...NUMERIC },
        { header: `f_{y,i} (${forceUnit})`, ...NUMERIC },
        ...(showMoments ? [{ header: `m_i (${momentUnit})`, ...NUMERIC }] : []),
        { header: `f_{x,j} (${forceUnit})`, ...NUMERIC },
        { header: `f_{y,j} (${forceUnit})`, ...NUMERIC },
        ...(showMoments ? [{ header: `m_j (${momentUnit})`, ...NUMERIC }] : []),
      ], loaded.map((element) => {
        const f = element.localEquivalentLoadOriginal;
        return [
          element.memberId,
          force(f[0] ?? 0, forceScale),
          force(f[1] ?? 0, forceScale),
          ...(showMoments ? [moment(f[2] ?? 0, momentScale)] : []),
          force(f[3] ?? 0, forceScale),
          force(f[4] ?? 0, forceScale),
          ...(showMoments ? [moment(f[5] ?? 0, momentScale)] : []),
        ];
      }));
    }
  }

  // ── Ensamble y solución ──────────────────────────────────────────────────────────────
  step('Ensamble y solución');
  memoirNote(context, `Se ensambla K (${dofs.total} × ${dofs.total}) con las rigideces anteriores, se imponen las condiciones de apoyo y se resuelve U:`);
  const scale = scaleOf(analysis.nodeResults.flatMap((node) => [node.ux, node.uy]));
  const rotationScale = scaleOf(analysis.nodeResults.map((node) => node.rz));
  const moving = analysis.nodeResults.filter((node) => Math.abs(node.ux) > scale * 1e-9 || Math.abs(node.uy) > scale * 1e-9
    || (dofs.rotations && Math.abs(node.rz) > rotationScale * 1e-9));
  if (moving.length) {
    layout.table([
      { header: 'Nudo', width: 54 },
      { header: `U_x (${lengthUnit})`, ...NUMERIC },
      { header: `U_y (${lengthUnit})`, ...NUMERIC },
      ...(dofs.rotations ? [{ header: 'θ_z (rad)', ...NUMERIC }] : []),
    ], moving.map((node) => [
      node.nodeId,
      length(node.ux, scale),
      length(node.uy, scale),
      ...(dofs.rotations ? [clearNumber(node.rz, rotationScale)] : []),
    ]));
  }
  const reacting = analysis.nodeResults.filter((node) => Math.abs(node.rx) + Math.abs(node.ry) + Math.abs(node.rm) > 0);
  const reactionScale = scaleOf(reacting.flatMap((node) => [node.rx, node.ry]));
  memoirResults(context, 'Reacciones', reacting.flatMap((node) => {
    const support = context.index.node(node.nodeId)?.support;
    const components = support ? restrainedComponents(support) : [];
    const rows: Array<[string, string]> = [];
    const present = (value: number) => Math.abs(value) > reactionScale * 1e-9;
    if (components.includes('U_x') || components.includes('U_n') || present(node.rx)) rows.push([`R_x(${node.nodeId})`, `${force(node.rx, reactionScale)} ${forceUnit}`]);
    if (components.includes('U_y') || components.includes('U_n') || present(node.ry)) rows.push([`R_y(${node.nodeId})`, `${force(node.ry, reactionScale)} ${forceUnit}`]);
    if ((dofs.rotations && components.includes('θ_z')) || present(node.rm)) rows.push([`M(${node.nodeId})`, `${moment(node.rm)} ${momentUnit}`]);
    return rows;
  }));
  if (hasTracePart) memoirNote(context, 'K completa y la contribución de cada barra están en el anexo «Traza del sistema resuelto».');

  // ── Fuerzas en las barras ────────────────────────────────────────────────────────────
  step('Fuerzas en las barras');
  if (trusses.length) {
    memoirFormula(context, 'N = (EA/L) δ,    δ = (u_j − u_i) c + (v_j − v_i) s', [
      ['δ', `alargamiento de la barra (${lengthUnit})`],
      ['N', `fuerza axial (${forceUnit}), positiva en tensión`],
    ]);
    const governing = [...trusses].sort((left, right) => Math.abs(trussAxial(context, right.member.id)) - Math.abs(trussAxial(context, left.member.id)));
    const worked = governing.map((entry) => terms.has(entry.member.id) ? trussForceExample(context, entry, terms.get(entry.member.id)!) : undefined).find(Boolean);
    if (worked) memoirWork(context, [worked]);
    const axialScale = scaleOf(trusses.map((entry) => trussAxial(context, entry.member.id)));
    const elongations = trusses.map((entry) => elongation(context, entry) ?? 0);
    const elongationScale = scaleOf(elongations);
    layout.table([
      { header: 'Barra', width: 54 },
      { header: `δ (${lengthUnit})`, ...NUMERIC },
      { header: `N (${forceUnit})`, ...NUMERIC },
      { header: 'Estado', width: 96 },
    ], trusses.map((entry, position) => {
      const axial = trussAxial(context, entry.member.id);
      const k = terms.get(entry.member.id)?.axial;
      const closes = k !== undefined && agrees(k * elongations[position]!, axial, axialScale);
      return [
        entry.member.id,
        closes ? length(elongations[position]!, elongationScale) : '—',
        force(axial, axialScale),
        Math.abs(axial) <= axialScale * 1e-9 ? 'sin fuerza' : axial > 0 ? 'tensión' : 'compresión',
      ];
    }));
  }
  const frameResults = frames.flatMap((entry) => {
    const result = context.index.memberResult(entry.member.id);
    return result?.localEndForces.length === 6 ? [{ id: entry.member.id, q: result.localEndForces }] : [];
  });
  if (frameResults.length) {
    memoirFormula(context, 'q^l = k^l T U_e − f^l', [
      ['q^l', 'fuerzas en los extremos de la barra, en ejes locales'],
      ['U_e', 'desplazamientos globales de sus dos nudos'],
    ]);
    const forceScale = scaleOf(frameResults.flatMap((entry) => [0, 1, 3, 4].map((index) => entry.q[index]!)));
    const momentScale = scaleOf(frameResults.flatMap((entry) => [entry.q[2]!, entry.q[5]!]));
    layout.table([
      { header: 'Barra', width: 54 },
      { header: `F_{x,i} (${forceUnit})`, ...NUMERIC },
      { header: `F_{y,i} (${forceUnit})`, ...NUMERIC },
      { header: `M_i (${momentUnit})`, ...NUMERIC },
      { header: `F_{x,j} (${forceUnit})`, ...NUMERIC },
      { header: `F_{y,j} (${forceUnit})`, ...NUMERIC },
      { header: `M_j (${momentUnit})`, ...NUMERIC },
    ], frameResults.map(({ id, q }) => [
      id,
      force(q[0]!, forceScale), force(q[1]!, forceScale), moment(q[2]!, momentScale),
      force(q[3]!, forceScale), force(q[4]!, forceScale), moment(q[5]!, momentScale),
    ]));
  }
  if (curved.length && options.includeDiagrams !== false) {
    memoirNote(context, 'Las fuerzas de las barras curvas se dan por estaciones a lo largo del arco en «Cálculo por miembro y por tramo».');
  }

  // ── Diagramas y deformada ────────────────────────────────────────────────────────────
  const flexural = frames.flatMap((entry) => {
    const result = context.index.memberResult(entry.member.id);
    if (!result) return [];
    const momentPoint = result.criticalPoints.filter((point) => point.quantity === 'moment')
      .reduce<{ x: number; value: number } | undefined>((best, point) => !best || Math.abs(point.value) > Math.abs(best.value) ? point : best, undefined);
    const deflection = result.deformationCriticalPoints.filter((point) => point.quantity === 'v')
      .reduce<{ x: number; value: number } | undefined>((best, point) => !best || Math.abs(point.value) > Math.abs(best.value) ? point : best, undefined);
    return [{ id: entry.member.id, moment: momentPoint, deflection }];
  });
  if (flexural.length) {
    step('Diagramas y deformada');
    memoirFormula(context, 'dN/dx = −p_x,    dV/dx = p_y,    dM/dx = V,    dθ/dx = M/(EI),    dv/dx = θ', [
      ['p_x, p_y', 'carga distribuida en ejes locales'],
      ['v', 'flecha perpendicular al eje de la barra'],
    ]);
    memoirNote(context, options.includeDiagrams !== false
      ? 'Se integran tramo a tramo desde las fuerzas de extremo; las funciones de cada tramo están en «Cálculo por miembro y por tramo».'
      : 'Se integran tramo a tramo desde las fuerzas de extremo de cada barra.');
    const momentScale = scaleOf(flexural.map((entry) => entry.moment?.value ?? 0));
    const deflectionScale = scaleOf(flexural.map((entry) => entry.deflection?.value ?? 0));
    layout.table([
      { header: 'Barra', width: 54 },
      { header: `M máximo (${momentUnit})`, ...NUMERIC },
      { header: `en x (${lengthUnit})`, ...NUMERIC },
      { header: `Flecha máxima (${lengthUnit})`, ...NUMERIC },
      { header: `en x (${lengthUnit})`, ...NUMERIC },
    ], flexural.map((entry) => [
      entry.id,
      entry.moment ? moment(entry.moment.value, momentScale) : '—',
      entry.moment ? length(entry.moment.x) : '—',
      entry.deflection ? length(entry.deflection.value, deflectionScale) : '—',
      entry.deflection ? length(entry.deflection.x) : '—',
    ]));
  }

  // ── Comprobación ─────────────────────────────────────────────────────────────────────
  step('Comprobación');
  const residual = analysis.equilibrium.normalizedResidual;
  const audit = analysis.loadAudit;
  const closes = residual <= 1e-6 && (!audit || audit.normalizedResidual <= 1e-6);
  memoirCheck(
    context,
    `equilibrio global con residuo ${clearNumber(residual)}`
      + (audit ? `; cargas ensambladas contra declaradas, residuo ${clearNumber(audit.normalizedResidual)}.` : '.'),
    closes,
  );
  memoirNote(context, 'Las sumas ΣF_x, ΣF_y y ΣM, término a término, están en «Resultados del análisis».');
};

export const drawProcedurePart = (context: ReportContext): void => {
  const { layout, solutionMethod: method } = context;
  layout.part(
    `Análisis · ${METHOD_LABEL[method]}`,
    method === 'portal-method' || method === 'cantilever-method'
      ? 'Método aproximado para carga lateral; su diferencia con el análisis exacto se indica al final.'
      : method === 'matrix-stiffness'
        ? 'Rigidez de cada barra, solución de K U = F y fuerzas en las barras.'
        : 'Procedimiento con los números de esta estructura, comprobado contra el análisis matricial.',
  );
  if (method === 'matrix-stiffness') {
    drawMatrixProcedure(context);
    return;
  }
  // An explicit export choice must never silently turn into a different method. The preview
  // keeps incompatible methods disabled; this guard also protects direct API callers and
  // geometry-specific rejections discovered only by the method solver.
  if (!drawMethodSection(context)) {
    throw new Error('El método elegido no puede desarrollarse para este modelo. Elige otro método para la memoria PDF.');
  }
};
