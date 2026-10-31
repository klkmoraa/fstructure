import type { AnalysisResult, DeformationPoint, DeformationSegment, DeformationCriticalPoint, DiagramSegment, MemberLoad, MemberModel, MemberResult, ProjectModel } from '../types';
import { circularMemberGeometry, curvePointAt, curveTangentAt, type CircularArcGeometry } from '../graphics/memberCurve';
import { evaluatePolynomial } from './diagram';

interface Piece { memberId: string; t0: number; t1: number; chord: number; c: number; s: number }
interface CurvedGroup { member: MemberModel; arc: CircularArcGeometry; pieces: Piece[] }
export interface CurvedAnalysisMesh { project: ProjectModel; groups: CurvedGroup[]; physicalId: ReadonlyMap<string, string> }

/** This mesh is disposable solver input, never a saved or editable project. */
export const prepareCurvedAnalysis = (source: ProjectModel): CurvedAnalysisMesh => {
  const project = structuredClone(source);
  const nodes = new Map(project.nodes.map(n => [n.id, n]));
  const curved = new Set(project.members.filter(m => m.curve).map(m => m.id));
  if ((project.generatedLoadSources ?? []).some(s => s.memberIds.some(id => curved.has(id)))) {
    throw new Error('Las cargas generadas y fundaciones elásticas sobre curvas aún no están verificadas. Usa cargas nodales o cargas explícitas de barra.');
  }
  if (project.members.some(m => m.axialBehavior && m.axialBehavior !== 'both')
    || (project.nodeLinks ?? []).some(l => l.behavior !== 'linear')) {
    throw new Error('Las barras curvas admiten análisis estático lineal; los contactos y miembros unilaterales requieren otra formulación.');
  }
  const used = new Set([...project.nodes, ...project.members, ...project.memberLoads, ...project.nodalLoads, ...(project.memberInitialEffects ?? [])].map(v => v.id));
  const physicalId = new Map<string, string>();
  let index = 0;
  const allocate = (parent: string) => {
    let id: string;
    do { id = `__curve_internal_${++index}`; } while (used.has(id));
    used.add(id); physicalId.set(id, parent); return id;
  };
  const groups: CurvedGroup[] = [];
  const output: MemberModel[] = [];
  for (const member of project.members) {
    if (!member.curve) { output.push(member); continue; }
    if (member.type !== 'frame') throw new Error(`${member.id}: una barra curva necesita rigidez de marco, no de armadura axial.`);
    if ((member.rigidOffsetI ?? 0) !== 0 || (member.rigidOffsetJ ?? 0) !== 0
      || member.releases?.iAxial || member.releases?.iShear || member.releases?.jAxial || member.releases?.jShear) {
      throw new Error(`${member.id}: las zonas rígidas y liberaciones traslacionales en curvas aún no están verificadas. No se sustituyen por una cuerda recta.`);
    }
    const ni = nodes.get(member.i), nj = nodes.get(member.j);
    if (!ni || !nj) throw new Error(`${member.id}: falta un nudo extremo de la curva.`);
    const arc = circularMemberGeometry(member, ni, nj)!;
    const count = Math.max(8, Math.ceil(Math.abs(arc.sweep) / (Math.PI / 64)));
    const locations = new Set(Array.from({ length: count + 1 }, (_, i) => i / count));
    for (const load of source.memberLoads.filter(l => l.memberId === member.id)) {
      for (const t of load.type === 'distributed' ? [load.start, load.end] : [load.position ?? 0.5]) {
        if (!Number.isFinite(t) || t < 0 || t > 1) throw new Error(`${load.id}: la posición de la carga debe estar entre 0 y 1.`);
        locations.add(t);
      }
    }
    const stations = [...locations].sort((a, b) => a - b).filter((t, i, a) => !i || t - a[i - 1] > 1e-12);
    const ids = stations.map((t, i) => {
      if (i === 0) return ni.id;
      if (i === stations.length - 1) return nj.id;
      const id = allocate(member.id);
      project.nodes.push({ id, ...curvePointAt(arc, t), support: { type: 'none' } });
      return id;
    });
    const pieces: Piece[] = [];
    for (let i = 0; i < stations.length - 1; i++) {
      const t0 = stations[i], t1 = stations[i + 1];
      const a = curvePointAt(arc, t0), b = curvePointAt(arc, t1);
      const chord = Math.hypot(b.x - a.x, b.y - a.y), id = allocate(member.id);
      const first = i === 0, last = i === stations.length - 2;
      output.push({ ...member, id, i: ids[i], j: ids[i + 1], curve: undefined, density: undefined,
        releases: member.releases ? { ...(first ? { iMoment: member.releases.iMoment } : {}), ...(last ? { jMoment: member.releases.jMoment } : {}) } : undefined,
        rotationalSpringI: first ? member.rotationalSpringI : undefined,
        rotationalSpringJ: last ? member.rotationalSpringJ : undefined, rigidOffsetI: 0, rigidOffsetJ: 0 });
      pieces.push({ memberId: id, t0, t1, chord, c: (b.x - a.x) / chord, s: (b.y - a.y) / chord });
    }
    groups.push({ member, arc, pieces });
  }
  if (project.nodes.length - source.nodes.length > 1500) throw new Error('La malla interna de curvas excede el presupuesto de cálculo. Reduce la cantidad de curvas en este análisis.');
  project.members = output;
  const byParent = new Map(groups.map(g => [g.member.id, g]));
  const loads: MemberLoad[] = [];
  for (const load of source.memberLoads) {
    const group = byParent.get(load.memberId);
    if (!group) { loads.push(structuredClone(load)); continue; }
    if (load.type !== 'distributed') {
      const t = load.position ?? 0.5;
      const piece = group.pieces.find(p => t < p.t1 - 1e-12) ?? group.pieces.at(-1)!;
      let mapped = { ...load, id: allocate(load.id), memberId: piece.memberId, position: Math.max(0, Math.min(1, (t - piece.t0) / (piece.t1 - piece.t0))) };
      if (load.type === 'point' && load.coordinateSystem === 'local') {
        const tangent = curveTangentAt(group.arc, t);
        mapped = { ...mapped, coordinateSystem: 'global', px: tangent.x * (load.px ?? 0) - tangent.y * (load.py ?? 0), py: tangent.y * (load.px ?? 0) + tangent.x * (load.py ?? 0) };
      }
      loads.push(mapped); continue;
    }
    if (!(load.end > load.start)) throw new Error(`${load.id}: el intervalo de la carga debe tener longitud positiva.`);
    const at = (a: number | undefined, b: number | undefined, t: number) => (a ?? 0) + ((b ?? a ?? 0) - (a ?? 0)) * (t - load.start) / (load.end - load.start);
    for (const piece of group.pieces) {
      const a = Math.max(load.start, piece.t0), b = Math.min(load.end, piece.t1);
      if (b - a <= 1e-12) continue;
      const factor = load.lengthBasis === 'horizontal' || load.lengthBasis === 'vertical' ? 1 : group.arc.length * (piece.t1 - piece.t0) / piece.chord;
      loads.push({ ...load, id: allocate(load.id), memberId: piece.memberId,
        start: (a - piece.t0) / (piece.t1 - piece.t0), end: (b - piece.t0) / (piece.t1 - piece.t0),
        qxStart: at(load.qxStart, load.qxEnd, a) * factor, qxEnd: at(load.qxStart, load.qxEnd, b) * factor,
        qyStart: at(load.qyStart, load.qyEnd, a) * factor, qyEnd: at(load.qyStart, load.qyEnd, b) * factor });
    }
  }
  // Arc weight, not the shorter polygonal length. Child density is cleared.
  for (const group of groups) {
    const weight = (group.member.density ?? 0) * group.member.A * 9.80665 / 1000;
    for (const loadCase of project.loadCases) {
      if (!weight || !loadCase.selfWeightFactor) continue;
      for (const piece of group.pieces) {
        const q = -weight * loadCase.selfWeightFactor * group.arc.length * (piece.t1 - piece.t0) / piece.chord;
        loads.push({ id: allocate(group.member.id), memberId: piece.memberId, caseId: loadCase.id,
          type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1,
          qxStart: 0, qxEnd: 0, qyStart: q, qyEnd: q });
      }
    }
  }
  project.memberLoads = loads;
  project.memberInitialEffects = (source.memberInitialEffects ?? []).flatMap(effect => {
    const group = byParent.get(effect.memberId);
    return group ? group.pieces.map(p => ({ ...effect, id: allocate(effect.id), memberId: p.memberId })) : [structuredClone(effect)];
  });
  project.designAssignments = (project.designAssignments ?? []).filter(a => !byParent.has(a.memberId));
  return { project, groups, physicalId };
};

/** Componentes (x, y, giro) de un vector expresadas en la base girada δ. */
const toEndTangent = (values: readonly number[], { cos, sin }: { cos: number; sin: number }) => {
  const [x = 0, y = 0, z = 0] = values;
  return [x * cos + y * sin, -x * sin + y * cos, z];
};

/** Extremos, ceros y saltos de la barra curva completa, sobre la longitud del arco. */
const curvedCriticalPoints = (segments: readonly DiagramSegment[], length: number, jumps: MemberResult['criticalPoints']): MemberResult['criticalPoints'] => {
  const points: MemberResult['criticalPoints'] = [...jumps];
  if (!segments.length) return points;
  const samples: Array<{ x: number; axial: number; shear: number; moment: number }> = [];
  for (const segment of segments) {
    const h = segment.x1 - segment.x0;
    samples.push({ x: segment.x0, axial: segment.axial[0], shear: segment.shear[0], moment: evaluatePolynomial(segment.moment, 0) });
    const shearEnd = evaluatePolynomial(segment.shear, h);
    // El momento es extremo donde V cruza cero dentro del segmento.
    if (Math.sign(segment.shear[0]) !== Math.sign(shearEnd) && segment.shear[1] !== 0) {
      const xi = -segment.shear[0] / segment.shear[1];
      if (xi > 0 && xi < h) {
        samples.push({ x: segment.x0 + xi, axial: evaluatePolynomial(segment.axial, xi), shear: 0, moment: evaluatePolynomial(segment.moment, xi) });
        points.push({ x: segment.x0 + xi, quantity: 'shear', value: 0, kind: 'zero' });
      }
    }
    samples.push({ x: segment.x1, axial: evaluatePolynomial(segment.axial, h), shear: shearEnd, moment: evaluatePolynomial(segment.moment, h) });
  }
  for (const quantity of ['axial', 'shear', 'moment'] as const) {
    const start = samples[0], end = samples.at(-1)!;
    points.push({ x: 0, quantity, value: start[quantity], kind: 'end' }, { x: length, quantity, value: end[quantity], kind: 'end' });
    const max = samples.reduce((a, b) => b[quantity] > a[quantity] ? b : a);
    const min = samples.reduce((a, b) => b[quantity] < a[quantity] ? b : a);
    points.push({ x: max.x, quantity, value: max[quantity], kind: 'maximum' }, { x: min.x, quantity, value: min[quantity], kind: 'minimum' });
  }
  return points;
};

/** Coeficientes de p(ξ) reescritos en ζ = (ξ − a)·ratio: el mismo polinomio, otro origen y otra escala. */
const shiftPolynomial = (coefficients: readonly number[], a: number, ratio: number): number[] => {
  const shifted = coefficients.map(() => 0);
  coefficients.forEach((value, power) => {
    let binomial = 1;
    for (let k = 0; k <= power; k++) {
      shifted[k] += value * binomial * a ** (power - k);
      binomial = binomial * (power - k) / (k + 1);
    }
  });
  return shifted.map((value, power) => value / ratio ** power);
};

/** Muestras por segmento de cada tramo interno; con tramos de ≤ 2.8° la lectura es continua. */
const SAMPLES_PER_SEGMENT = 4;

/**
 * Los tramos internos son cuerdas: cada uno reporta N y V en su propia
 * dirección, y al unirlos el cortante saltaba en cada cuerda (dientes de
 * sierra). Aquí N y V se giran a la tangente real del arco en cada punto y se
 * recalculan los extremos de la barra completa, no los del primer tramo.
 */
const combineMemberResult = (group: CurvedGroup, results: ReadonlyMap<string, MemberResult>): MemberResult | undefined => {
  const children = group.pieces.map(p => results.get(p.memberId));
  if (children.some(r => !r)) return undefined;
  const first = children[0]!, last = children.at(-1)!;
  const arcLength = group.arc.length;
  const diagramSegments: DiagramSegment[] = [], deformation: DeformationPoint[] = [], deformationSegments: DeformationSegment[] = [];
  const diagram: MemberResult['diagram'] = [], diagramJumps: MemberResult['diagramJumps'] = [], jumpPoints: MemberResult['criticalPoints'] = [];
  // Giro de la cuerda del tramo a la tangente del arco en la fracción t de la barra.
  const turn = (piece: Piece, t: number) => {
    const tangent = curveTangentAt(group.arc, t);
    return { cos: piece.c * tangent.x + piece.s * tangent.y, sin: piece.c * tangent.y - piece.s * tangent.x };
  };
  group.pieces.forEach((piece, index) => {
    const result = children[index]!, offset = piece.t0 * arcLength;
    const ratio = (piece.t1 - piece.t0) * arcLength / result.length;
    const tAt = (x: number) => piece.t0 + (piece.t1 - piece.t0) * Math.min(1, Math.max(0, x / result.length));
    const toArc = (x: number, axial: number, shear: number) => {
      const { cos, sin } = turn(piece, tAt(x));
      return { axial: axial * cos - shear * sin, shear: shear * cos + axial * sin };
    };
    for (const segment of result.diagramSegments) {
      const h = segment.x1 - segment.x0;
      const samples = Array.from({ length: SAMPLES_PER_SEGMENT + 1 }, (_, k) => {
        const xi = h * k / SAMPLES_PER_SEGMENT;
        return { xi, ...toArc(segment.x0 + xi, evaluatePolynomial(segment.axial, xi), evaluatePolynomial(segment.shear, xi)) };
      });
      for (let k = 0; k < SAMPLES_PER_SEGMENT; k++) {
        const a = samples[k], b = samples[k + 1], width = (b.xi - a.xi) * ratio;
        if (!(width > 0)) continue;
        const axialSlope = (b.axial - a.axial) / width, shearSlope = (b.shear - a.shear) / width;
        const moment = shiftPolynomial(segment.moment, a.xi, ratio);
        diagramSegments.push({
          x0: offset + (segment.x0 + a.xi) * ratio, x1: offset + (segment.x0 + b.xi) * ratio,
          axial: [a.axial, axialSlope, 0], shear: [a.shear, shearSlope, 0],
          moment: [moment[0] ?? 0, moment[1] ?? 0, moment[2] ?? 0, moment[3] ?? 0],
          distributedAxial: [-axialSlope, 0], distributedTransverse: [shearSlope, 0],
        });
      }
    }
    diagram.push(...result.diagram.map(p => ({ ...p, ...toArc(p.x, p.axial, p.shear), x: offset + p.x * ratio })));
    diagramJumps.push(...result.diagramJumps.map(p => {
      const rotated = toArc(p.x, p.axialDelta, p.shearDelta);
      return { ...p, x: offset + p.x * ratio, axialDelta: rotated.axial, shearDelta: rotated.shear };
    }));
    // Un salto (carga puntual) sigue siendo un punto crítico; los extremos de cada cuerda no.
    for (const point of result.criticalPoints) {
      if (point.kind !== 'jump') continue;
      const value = point.quantity === 'moment' ? point.value
        : (() => {
          const at = result.diagramSegments.find(s => point.x >= s.x0 - 1e-12 && point.x <= s.x1 + 1e-12);
          if (!at) return point.value;
          const xi = point.x - at.x0;
          const rotated = toArc(point.x, evaluatePolynomial(at.axial, xi), evaluatePolynomial(at.shear, xi));
          return point.quantity === 'axial' ? rotated.axial : rotated.shear;
        })();
      jumpPoints.push({ ...point, x: offset + point.x * ratio, value });
    }
    const cosine = group.arc.c * piece.c + group.arc.s * piece.s, sine = group.arc.c * piece.s - group.arc.s * piece.c;
    for (const segment of result.deformationSegments) {
      const samples = Array.from({ length: 5 }, (_, sample) => {
        const x = (segment.x1 - segment.x0) * sample / 4;
        const u = evaluatePolynomial(segment.u, x), v = evaluatePolynomial(segment.v, x);
        return { x: offset + (segment.x0 + x) * ratio, u: cosine * u - sine * v,
          v: sine * u + cosine * v, theta: evaluatePolynomial(segment.theta, x) };
      });
      deformation.push(...samples);
      for (let k = 0; k < samples.length - 1; k++) {
        const a = samples[k], b = samples[k + 1], h = b.x - a.x;
        if (!(h > 0)) continue;
        deformationSegments.push({ x0: a.x, x1: b.x, u: [a.u, (b.u - a.u) / h, 0, 0],
          v: [a.v, (b.v - a.v) / h, 0, 0, 0, 0], theta: [a.theta, (b.theta - a.theta) / h, 0, 0, 0] });
      }
    }
  });
  const criticalPoints = curvedCriticalPoints(diagramSegments, arcLength, jumpPoints);
  const turn0 = turn(group.pieces[0], 0), turn1 = turn(group.pieces.at(-1)!, 1);
  const deformationCriticalPoints: DeformationCriticalPoint[] = [];
  if (deformation.length) for (const quantity of ['u', 'v', 'theta'] as const) {
    const max = deformation.reduce((a, b) => b[quantity] > a[quantity] ? b : a);
    const min = deformation.reduce((a, b) => b[quantity] < a[quantity] ? b : a);
    for (const point of [deformation[0], deformation.at(-1)!]) deformationCriticalPoints.push({ x: point.x, quantity, value: point[quantity], kind: 'end' });
    deformationCriticalPoints.push({ x: max.x, quantity, value: max[quantity], kind: 'maximum' }, { x: min.x, quantity, value: min[quantity], kind: 'minimum' });
  }
  const extremes = (key: 'axial' | 'shear' | 'moment', maximum: boolean) => {
    const values = criticalPoints.filter(p => p.quantity === key).map(p => p.value);
    return maximum ? Math.max(...values) : Math.min(...values);
  };
  return { ...first, memberId: group.member.id, length: group.arc.length, totalLength: group.arc.length, startOffset: 0, endOffset: 0,
    // Cada extremo en la tangente del arco en ese extremo (antes, la cuerda del primer y del último tramo).
    localDisplacements: [...toEndTangent(first.localDisplacements.slice(0, 3), turn0), ...toEndTangent(last.localDisplacements.slice(3, 6), turn1)],
    localEndForces: [...toEndTangent(first.localEndForces.slice(0, 3), turn0), ...toEndTangent(last.localEndForces.slice(3, 6), turn1)],
    diagram, diagramSegments, diagramJumps, criticalPoints, deformation, deformationSegments, deformationCriticalPoints,
    maxAxial: extremes('axial', true), minAxial: extremes('axial', false), maxShear: extremes('shear', true), minShear: extremes('shear', false),
    maxMoment: extremes('moment', true), minMoment: extremes('moment', false),
    compatibilityError: Math.max(...children.map(r => r!.compatibilityError ?? 0)),
    endCompatibilityError: Math.max(...children.map(r => r!.endCompatibilityError ?? 0)), endCompatibility: undefined, compatibilityComponents: undefined };
};

/** Collapse solver-only entities back to physical identities before publishing. */
export const restoreCurvedAnalysis = (source: ProjectModel, mesh: CurvedAnalysisMesh, result: AnalysisResult): AnalysisResult => {
  const nodes = new Map(result.nodeResults.map(n => [n.nodeId, n]));
  const members = new Map(result.memberResults.map(m => [m.memberId, m]));
  const groups = new Map(mesh.groups.map(g => [g.member.id, g]));
  const nodeResults = source.nodes.flatMap(n => nodes.has(n.id) ? [nodes.get(n.id)!] : []);
  const memberResults = source.members.flatMap(m => {
    const group = groups.get(m.id), value = group ? combineMemberResult(group, members) : members.get(m.id);
    return value ? [value] : [];
  });
  const replaceIds = (text: string): string => text.replace(/__curve_internal_\d+/g, id => mesh.physicalId.get(id) ?? 'barra curva');
  const note = 'Cada curva conserva dos nudos y un miembro. El análisis lineal usa una malla privada; diagramas y deformada son aproximaciones numéricas sobre la longitud del arco, no nuevos objetos del modelo.';
  return { ...result, nodeResults, memberResults, displacements: nodeResults.flatMap(n => [n.ux, n.uy, n.rz]),
    issues: [...result.issues.map(issue => ({ ...issue, id: replaceIds(issue.id), title: replaceIds(issue.title), message: replaceIds(issue.message),
      objectId: issue.objectId ? mesh.physicalId.get(issue.objectId) ?? issue.objectId : undefined,
      suggestedFix: issue.suggestedFix ? replaceIds(issue.suggestedFix) : undefined })),
      { id: 'curved-numerical-analysis', severity: 'info', title: 'Barra curva · cálculo interno experimental', message: note }],
    educationTrace: undefined, explanation: [{ id: 'curve-analysis', title: 'Geometría física y cálculo interno', category: 'geometry', summary: note, equations: [], relatedMemberIds: [...groups.keys()] }],
    mechanism: result.mechanism ? { ...result.mechanism, nodes: result.mechanism.nodes.filter(n => source.nodes.some(s => s.id === n.nodeId)) } : undefined,
    loadAudit: result.loadAudit ? { ...result.loadAudit, memberAudits: result.loadAudit.memberAudits.filter(a => !mesh.physicalId.has(a.memberId)) } : undefined };
};
