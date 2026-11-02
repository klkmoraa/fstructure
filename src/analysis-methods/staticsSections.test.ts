import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../data/defaultProject';
import { normalizeProject } from '../data/linearProjectMigration';
import { withModelStart } from '../data/modelStarts';
import { analyzeProject } from '../engine/solver';
import type { MemberLoad, MemberModel, NodalLoad, NodeModel, ProjectModel } from '../types';
import { applicableMethods } from './methodRegistry';
import { solveStaticsSections, type StaticsSectionsResult } from './staticsSections';

const SECTION = { E: 2e8, A: 0.02, I: 8e-5 };

const node = (id: string, x: number, y: number, support: NodeModel['support'] = { type: 'none' }, extra: Partial<NodeModel> = {}): NodeModel =>
  ({ id, x, y, support, ...extra });
const bar = (id: string, i: string, j: string, extra: Partial<MemberModel> = {}): MemberModel =>
  ({ id, i, j, type: 'frame', ...SECTION, ...extra });
const uniform = (id: string, memberId: string, qy: number, extra: Partial<MemberLoad> = {}): MemberLoad => ({
  id, memberId, caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
  start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: qy, qyEnd: qy, ...extra,
});
const point = (id: string, memberId: string, position: number, py: number, px = 0): MemberLoad => ({
  id, memberId, caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position, px, py,
});
const nodal = (id: string, nodeId: string, fx: number, fy: number, mz = 0): NodalLoad => ({ id, nodeId, caseId: 'LC1', fx, fy, mz });

const model = (parts: Pick<ProjectModel, 'nodes' | 'members'> & Partial<Pick<ProjectModel, 'memberLoads' | 'nodalLoads'>>): ProjectModel => ({
  ...createBlankProject(),
  memberLoads: [],
  nodalLoads: [],
  ...parts,
});

const solve = (project: ProjectModel): StaticsSectionsResult => {
  const analysis = analyzeProject(project);
  expect(analysis.success).toBe(true);
  const outcome = solveStaticsSections(project, analysis);
  if (!outcome.applicable) throw new Error(`rechazado: ${outcome.reasonKey}`);
  return outcome;
};

const reaction = (solution: StaticsSectionsResult, symbol: string): number => {
  const unknown = solution.unknowns.find((entry) => entry.symbol === symbol);
  if (!unknown) throw new Error(`sin ${symbol}`);
  // Every reaction must be the matrix analysis's own.
  expect(unknown.value).toBeCloseTo(unknown.solverValue, 6);
  return unknown.value;
};

const momentAt = (solution: StaticsSectionsResult, memberId: string, s: number): number => {
  const member = solution.members.find((entry) => entry.memberId === memberId)!;
  const stretch = member.stretches.find((entry) => s >= entry.s0 && s <= entry.s1)!;
  return stretch.moment.reduceRight((value, coefficient) => value * s + coefficient, 0);
};

describe('método de secciones para vigas y marcos isostáticos', () => {
  it('viga simple con carga uniforme y puntual: reacciones y momento máximo a mano', () => {
    // q = 10 kN/m en 6 m y P = 20 kN a 4 m: R_B = (60·3 + 20·4)/6 = 130/3, R_A = 110/3.
    const solution = solve(model({
      nodes: [node('A', 0, 0, { type: 'pin' }), node('B', 6, 0, { type: 'roller', angleDeg: 90 })],
      members: [bar('V1', 'A', 'B')],
      memberLoads: [uniform('q', 'V1', -10), point('P', 'V1', 4 / 6, -20)],
    }));
    expect(reaction(solution, 'R_y(B)')).toBeCloseTo(130 / 3, 9);
    expect(reaction(solution, 'R_y(A)')).toBeCloseTo(110 / 3, 9);
    expect(reaction(solution, 'R_x(A)')).toBeCloseTo(0, 9);
    // ΣM respecto al pasador A, y dos tramos separados por la carga puntual.
    expect(solution.equations[2]).toMatchObject({ kind: 'moment', centreNodeId: 'A' });
    const [beam] = solution.members;
    expect(beam!.stretches.map((stretch) => [stretch.s0, stretch.s1])).toEqual([[0, 4], [4, 6]]);
    // V = 0 en x = 11/3: M máx = 605/9 kN·m.
    const [zero] = beam!.stretches[0]!.shearZeros;
    expect(zero!.s).toBeCloseTo(11 / 3, 9);
    expect(zero!.moment).toBeCloseTo(605 / 9, 9);
    expect(solution.peakMoment.value).toBeCloseTo(605 / 9, 9);
    expect(momentAt(solution, 'V1', 4)).toBeCloseTo(110 / 3 * 4 - 80, 9);
    expect(solution.loadCheck!.residual).toBeLessThan(1e-9);
    expect(solution.diagramResidual.moment).toBeLessThan(1e-6);
  });

  it('voladizo: el empotramiento toma la fuerza y el momento', () => {
    const solution = solve(model({
      nodes: [node('A', 0, 0, { type: 'fixed' }), node('B', 3, 0)],
      members: [bar('V1', 'A', 'B')],
      memberLoads: [uniform('q', 'V1', -12)],
      nodalLoads: [nodal('P', 'B', 0, -6)],
    }));
    expect(reaction(solution, 'R_y(A)')).toBeCloseTo(42, 9);
    expect(reaction(solution, 'M_R(A)')).toBeCloseTo(72, 9);
    expect(momentAt(solution, 'V1', 0)).toBeCloseTo(-72, 9);
    expect(momentAt(solution, 'V1', 3)).toBeCloseTo(0, 9);
  });

  it('viga con voladizo: momento negativo sobre el apoyo', () => {
    const solution = solve(model({
      nodes: [node('A', 0, 0, { type: 'pin' }), node('B', 6, 0, { type: 'roller' }), node('C', 8, 0)],
      members: [bar('V1', 'A', 'B'), bar('V2', 'B', 'C')],
      memberLoads: [uniform('q', 'V1', -10)],
      nodalLoads: [nodal('P', 'C', 0, -20)],
    }));
    expect(reaction(solution, 'R_y(B)')).toBeCloseTo(340 / 6, 9);
    expect(reaction(solution, 'R_y(A)')).toBeCloseTo(80 - 340 / 6, 9);
    expect(momentAt(solution, 'V1', 6)).toBeCloseTo(-40, 9);
    expect(momentAt(solution, 'V2', 0)).toBeCloseTo(-40, 9);
  });

  it('viga Gerber: la articulación aporta ΣM = 0 de un lado', () => {
    const solution = solve(model({
      nodes: [node('A', 0, 0, { type: 'fixed' }), node('H', 4, 0, { type: 'none' }, { internalHinge: true }), node('C', 10, 0, { type: 'roller' })],
      members: [bar('V1', 'A', 'H'), bar('V2', 'H', 'C')],
      memberLoads: [uniform('q1', 'V1', -10), uniform('q2', 'V2', -10)],
    }));
    const hinge = solution.equations.find((equation) => equation.kind === 'hinge' && equation.independent);
    expect(hinge).toMatchObject({ centreNodeId: 'H' });
    // La parte con menos incógnitas es la del rodillo: el tramo H–C con su carga.
    expect(hinge!.nodeIds).toEqual(['H', 'C']);
    expect(hinge!.memberIds).toEqual(['V2']);
    expect(reaction(solution, 'R_y(C)')).toBeCloseTo(30, 9);
    expect(reaction(solution, 'R_y(A)')).toBeCloseTo(70, 9);
    expect(reaction(solution, 'M_R(A)')).toBeCloseTo(200, 9);
    expect(momentAt(solution, 'V1', 4)).toBeCloseTo(0, 9);
    expect(momentAt(solution, 'V2', 3)).toBeCloseTo(45, 9);
  });

  it('pórtico sobre pasador y rodillo con carga lateral', () => {
    const solution = solve(model({
      nodes: [node('A', 0, 0, { type: 'pin' }), node('B', 0, 4), node('C', 6, 4), node('D', 6, 0, { type: 'roller', angleDeg: 90 })],
      members: [bar('C1', 'A', 'B'), bar('V1', 'B', 'C'), bar('C2', 'D', 'C')],
      memberLoads: [uniform('q', 'V1', -10)],
      nodalLoads: [nodal('H', 'B', 20, 0)],
    }));
    expect(reaction(solution, 'R_x(A)')).toBeCloseTo(-20, 9);
    expect(reaction(solution, 'R_y(D)')).toBeCloseTo(260 / 6, 9);
    expect(reaction(solution, 'R_y(A)')).toBeCloseTo(60 - 260 / 6, 9);
    // La columna A–B: M(s) = 20·s en la base volteada… en ejes locales, M(4) = −R_x·4 = 80.
    expect(Math.abs(momentAt(solution, 'C1', 4))).toBeCloseTo(80, 9);
    // La columna D→C declarada desde abajo sólo lleva compresión.
    const column = solution.members.find((entry) => entry.memberId === 'C2')!;
    expect(column.stretches[0]!.start.axial).toBeCloseTo(-260 / 6, 9);
    expect(momentAt(solution, 'C2', 4)).toBeCloseTo(0, 9);
  });

  it('pórtico triarticulado: el sistema se cierra con la articulación de la clave', () => {
    const solution = solve(model({
      nodes: [
        node('A', 0, 0, { type: 'pin' }), node('B', 0, 4), node('C', 3, 4, { type: 'none' }, { internalHinge: true }),
        node('D', 6, 4), node('E', 6, 0, { type: 'pin' }),
      ],
      members: [bar('C1', 'A', 'B'), bar('V1', 'B', 'C'), bar('V2', 'C', 'D'), bar('C2', 'D', 'E')],
      memberLoads: [uniform('q1', 'V1', -10), uniform('q2', 'V2', -10)],
      nodalLoads: [nodal('H', 'B', 20, 0)],
    }));
    expect(reaction(solution, 'R_y(E)')).toBeCloseTo(260 / 6, 9);
    expect(reaction(solution, 'R_y(A)')).toBeCloseTo(60 - 260 / 6, 9);
    expect(reaction(solution, 'R_x(A)')).toBeCloseTo(1.25, 9);
    expect(reaction(solution, 'R_x(E)')).toBeCloseTo(-21.25, 9);
    expect(solution.equations.filter((equation) => equation.independent)).toHaveLength(4);
    expect(momentAt(solution, 'V1', 3)).toBeCloseTo(0, 9);
  });

  it('articulación donde concurren tres barras: n − 1 = 2 condiciones, y la estática se cierra', () => {
    // Pórtico de dos crujías con la articulación C en lo alto de la columna central: llegan a C la
    // viga izquierda, la derecha y la columna G–C. Apoyos: pasador en A y en G, rodillo en E.
    // g = 5 + 3·5 − 3·6 − (3 − 1) = 0; con una sola condición por la articulación se leería g = 1.
    const project = model({
      nodes: [
        node('A', 0, 0, { type: 'pin' }), node('B', 0, 4), node('C', 4, 4, { type: 'none' }, { internalHinge: true }),
        node('D', 8, 4), node('E', 8, 0, { type: 'roller', angleDeg: 90 }), node('G', 4, 0, { type: 'pin' }),
      ],
      members: [bar('C1', 'A', 'B'), bar('V1', 'B', 'C'), bar('V2', 'C', 'D'), bar('C2', 'D', 'E'), bar('C3', 'G', 'C')],
      memberLoads: [uniform('q1', 'V1', -10), uniform('q2', 'V2', -10)],
      nodalLoads: [nodal('H', 'B', 20, 0)],
    });
    expect(applicableMethods(project).map((method) => method.id)).toContain('statics-sections');
    const solution = solve(project);
    expect(solution.classification.indeterminacy).toBe(0);
    // A mano. Parte D–E respecto a C: 4·R_y(E) − 40·2 = 0 → R_y(E) = 20. La columna G–C, biarticulada
    // y sin carga, sólo toma axial: R_x(G) = 0. ΣFx: R_x(A) = −20. Parte A–B respecto a C:
    // 4·R_x(A) − 4·R_y(A) + 40·2 = 0 → R_y(A) = 0. ΣFy: R_y(G) = 80 − 20 − 0 = 60.
    expect(reaction(solution, 'R_y(E)')).toBeCloseTo(20, 9);
    expect(reaction(solution, 'R_x(G)')).toBeCloseTo(0, 9);
    expect(reaction(solution, 'R_x(A)')).toBeCloseTo(-20, 9);
    expect(reaction(solution, 'R_y(A)')).toBeCloseTo(0, 9);
    expect(reaction(solution, 'R_y(G)')).toBeCloseTo(60, 9);
    // Tres ecuaciones de articulación en C, una por barra; dos independientes y la tercera, comprobación.
    const hinges = solution.equations.filter((equation) => equation.kind === 'hinge');
    expect(hinges.map((equation) => equation.release)).toEqual([
      { memberId: 'V1', nodeId: 'C' }, { memberId: 'V2', nodeId: 'C' }, { memberId: 'C3', nodeId: 'C' },
    ]);
    expect(hinges.filter((equation) => equation.independent)).toHaveLength(2);
    expect(solution.equations.filter((equation) => equation.independent)).toHaveLength(5);
    // Momento nulo en los tres extremos que llegan a C; 20·4 = 80 en la cabeza de la columna A–B y
    // wL²/8 = 20 al centro de C–D, que trabaja como viga simple.
    expect(momentAt(solution, 'V1', 4)).toBeCloseTo(0, 9);
    expect(momentAt(solution, 'V2', 0)).toBeCloseTo(0, 9);
    expect(momentAt(solution, 'C3', 4)).toBeCloseTo(0, 9);
    expect(Math.abs(momentAt(solution, 'C1', 4))).toBeCloseTo(80, 9);
    expect(momentAt(solution, 'V2', 2)).toBeCloseTo(20, 9);
    expect(solution.diagramResidual.moment).toBeLessThan(1e-6);
  });

  it('rodillo inclinado, barra declarada al revés, trapecio local parcial, proyección horizontal y par', () => {
    // No hay cifra a mano aquí: lo que se prueba es que cada lectura de las cargas coincide con
    // la del solver (reacciones, auditoría de cargas y diagramas), o el método se rechazaría.
    const solution = solve(model({
      nodes: [node('A', 0, 0, { type: 'pin' }), node('B', 4, 3), node('C', 9, 3, { type: 'roller', angleDeg: 60 })],
      members: [bar('M1', 'B', 'A'), bar('M2', 'B', 'C')],
      memberLoads: [
        { ...uniform('T', 'M1', 0), coordinateSystem: 'local', start: 0.2, end: 0.7, qxStart: 1, qxEnd: -2, qyStart: -3, qyEnd: -8 },
        uniform('H', 'M1', -5, { lengthBasis: 'horizontal' }),
        { ...point('Mo', 'M2', 0.3, 0), type: 'moment', moment: 12 },
        { ...point('P0', 'M2', 0, -7, 3), coordinateSystem: 'local' },
        point('P1', 'M2', 1, -4, 2),
      ],
      nodalLoads: [nodal('N', 'B', 6, -2, 5)],
    }));
    const roller = solution.unknowns.find((entry) => entry.symbol === 'R_n(C)')!;
    expect(roller.direction.x).toBeCloseTo(0.5, 12);
    expect(roller.value).toBeCloseTo(roller.solverValue, 6);
    expect(solution.reactionResidual.force).toBeLessThan(1e-9);
    expect(solution.diagramResidual.moment).toBeLessThan(1e-9);
    expect(solution.loadCheck!.residual).toBeLessThan(1e-12);
    // El trapecio se parte en bloque uniforme y triángulo; la barra M1 tiene tres tramos.
    expect(solution.resultants.filter((entry) => entry.sourceId === 'T').map((entry) => entry.kind)).toEqual(['uniform', 'triangular']);
    expect(solution.members.find((entry) => entry.memberId === 'M1')!.stretches).toHaveLength(3);
  });

  it('rechaza un marco hiperestático; un arco hiperestático (biarticulado) tampoco', () => {
    const fixedPortal = model({
      nodes: [node('A', 0, 0, { type: 'fixed' }), node('B', 0, 4), node('C', 6, 4), node('D', 6, 0, { type: 'fixed' })],
      members: [bar('C1', 'A', 'B'), bar('V1', 'B', 'C'), bar('C2', 'C', 'D')],
      nodalLoads: [nodal('H', 'B', 20, 0)],
    });
    expect(solveStaticsSections(fixedPortal, analyzeProject(fixedPortal))).toEqual({ applicable: false, reasonKey: 'method.rejectedIndeterminateStatics' });
    expect(applicableMethods(fixedPortal).map((method) => method.id)).not.toContain('statics-sections');

    // El arco del inicio de la app: dos pasadores, g = 1. La estática sola no lo resuelve.
    const twoHinged = withModelStart(createBlankProject(), 'arch');
    expect(applicableMethods(twoHinged).map((method) => method.id)).not.toContain('statics-sections');
    expect(solveStaticsSections(twoHinged, analyzeProject(twoHinged))).toEqual({ applicable: false, reasonKey: 'method.rejectedIndeterminateStatics' });
  });

  describe('barras curvas (arcos circulares)', () => {
    /** Valores de un arco en la fracción t, por estática y por el solver. */
    const arcAt = (solution: StaticsSectionsResult, memberId: string, t: number) => {
      const member = solution.members.find((entry) => entry.memberId === memberId)!;
      return member.arc!.stations.find((station) => Math.abs(station.t - t) < 1e-12)!;
    };

    it('arco semicircular sobre pasador y rodillo, carga por proyección horizontal: la viga equivalente', () => {
      // R = 5 m, claro 10 m, w = 20 kN/m de proyección horizontal. Sin empuje, las reacciones y el
      // momento son los de la viga simple: R = wL/2 = 100 kN y M(x) = w x (L − x)/2; en la clave
      // M = wL²/8 = 250 kN·m. El corte en φ (inclinación de la tangente) con V_b = w(L/2 − x):
      // N = −V_b sen φ, V = V_b cos φ.
      const project = model({
        nodes: [node('A', 0, 0, { type: 'pin' }), node('B', 10, 0, { type: 'roller', angleDeg: 90 })],
        members: [bar('A1', 'A', 'B', { curve: { kind: 'circular-arc', bulge: 1 } })],
        memberLoads: [uniform('w', 'A1', -20, { lengthBasis: 'horizontal' })],
      });
      expect(applicableMethods(project).map((method) => method.id)).toContain('statics-sections');
      const solution = solve(project);
      expect(reaction(solution, 'R_y(A)')).toBeCloseTo(100, 6);
      expect(reaction(solution, 'R_y(B)')).toBeCloseTo(100, 6);
      expect(reaction(solution, 'R_x(A)')).toBeCloseTo(0, 6);
      // La resultante sobre el arco: W = w·(proyección horizontal) = 200 kN en x̄ = 5 m.
      const [w] = solution.resultants;
      expect(w).toMatchObject({ kind: 'arc', intensity: 20 });
      expect(w!.basisLength).toBeCloseTo(10, 12);
      expect(w!.fy).toBeCloseTo(-200, 12);
      expect(w!.at.x).toBeCloseTo(5, 12);
      for (const t of [1 / 12, 3 / 12, 5 / 12, 6 / 12, 8 / 12, 11 / 12]) {
        const station = arcAt(solution, 'A1', t);
        const x = station.point.x;
        const beamShear = 20 * (5 - x);
        expect(station.moment).toBeCloseTo(10 * x * (10 - x), 9);
        expect(station.axial).toBeCloseTo(-beamShear * Math.sin(station.slope), 9);
        expect(station.shear).toBeCloseTo(beamShear * Math.cos(station.slope), 9);
        // Y el solver, que malla el arco con cuerdas, cae a menos de 1e-3 de M máx.
        expect(Math.abs(station.moment - station.solver.moment)).toBeLessThan(1e-3 * 250);
      }
      expect(solution.peakMoment.value).toBeCloseTo(250, 6);
      expect(solution.peakMoment.s).toBeCloseTo(5 * Math.PI / 2, 4);
      expect(solution.members[0]!.arc!.solverChords).toBe(64);
    });

    it('arco triarticulado circular: H = wL²/(8f) y M = M_viga − H·y', () => {
      // Claro 10 m, flecha f = 3 m: R = (25 + 9)/6 = 5.667 m; cada mitad abre α = asen(5/R).
      const R = 34 / 6;
      const half = Math.asin(5 / R);
      const bulge = Math.tan(half / 4);
      const project = model({
        nodes: [node('A', 0, 0, { type: 'pin' }), node('C', 5, 3, { type: 'none' }, { internalHinge: true }), node('B', 10, 0, { type: 'pin' })],
        members: [bar('A1', 'A', 'C', { curve: { kind: 'circular-arc', bulge } }), bar('A2', 'C', 'B', { curve: { kind: 'circular-arc', bulge } })],
        memberLoads: [uniform('w1', 'A1', -20, { lengthBasis: 'horizontal' }), uniform('w2', 'A2', -20, { lengthBasis: 'horizontal' })],
      });
      const solution = solve(project);
      expect(solution.classification.indeterminacy).toBe(0);
      const H = 20 * 100 / (8 * 3);
      expect(reaction(solution, 'R_x(A)')).toBeCloseTo(H, 6);
      expect(reaction(solution, 'R_x(B)')).toBeCloseTo(-H, 6);
      expect(reaction(solution, 'R_y(A)')).toBeCloseTo(100, 6);
      expect(solution.equations.filter((equation) => equation.kind === 'hinge' && equation.independent)).toHaveLength(1);
      for (const memberId of ['A1', 'A2']) {
        for (const station of solution.members.find((entry) => entry.memberId === memberId)!.arc!.stations) {
          const { x, y } = station.point;
          expect(station.moment).toBeCloseTo(10 * x * (10 - x) - H * y, 8);
        }
      }
      // Momento nulo en la articulación de la clave, por los dos lados.
      expect(arcAt(solution, 'A1', 1).moment).toBeCloseTo(0, 8);
      expect(arcAt(solution, 'A2', 0).moment).toBeCloseTo(0, 8);
    });

    it('cargas locales, parciales, puntuales y peso propio sobre un arco: todo cae en el solver', () => {
      const project = model({
        nodes: [node('A', 0, 0, { type: 'pin' }), node('B', 8, 1, { type: 'roller', angleDeg: 90 })],
        members: [bar('A1', 'A', 'B', { curve: { kind: 'circular-arc', bulge: 0.45 }, density: 2400 })],
        memberLoads: [
          { ...uniform('T', 'A1', 0), coordinateSystem: 'local', start: 0.1, end: 0.6, qxStart: 1, qxEnd: -2, qyStart: -3, qyEnd: -8 },
          uniform('V', 'A1', -4, { lengthBasis: 'vertical', start: 0.3, end: 0.9 }),
          point('P', 'A1', 0.7, -15, 4),
          { ...point('Mo', 'A1', 0.4, 0), type: 'moment', moment: 9 },
        ],
      });
      project.loadCases = project.loadCases.map((loadCase) => ({ ...loadCase, selfWeightFactor: 1 }));
      const solution = solve(project);
      const arc = solution.members[0]!.arc!;
      expect(solution.resultants.map((entry) => entry.kind)).toEqual(['arc', 'arc', 'point', 'couple', 'self-weight']);
      expect(arc.residual.moment).toBeLessThan(arc.tolerance * 100);
      expect(solution.loadCheck!.residual).toBeLessThan(arc.tolerance);
      expect(solution.reactionResidual.force).toBeLessThan(arc.tolerance * 100);
    });

    it('marco con cubierta en arco sobre dos columnas: rectas y curva cortadas en el mismo cálculo', () => {
      // Pasador en A, rodillo en D: g = 0. Con w = 10 kN/m por proyección horizontal en 10 m y H = 20 kN
      // en B, ΣM(A): 10·R_y(D) − 100·5 − 20·3 = 0 → R_y(D) = 56 kN; R_x(A) = −20 kN.
      const solution = solve(model({
        nodes: [node('A', 0, 0, { type: 'pin' }), node('B', 0, 3), node('C', 10, 3), node('D', 10, 0, { type: 'roller', angleDeg: 90 })],
        members: [bar('C1', 'A', 'B'), bar('R1', 'B', 'C', { curve: { kind: 'circular-arc', bulge: 0.4 } }), bar('C2', 'D', 'C')],
        memberLoads: [uniform('w', 'R1', -10, { lengthBasis: 'horizontal' })],
        nodalLoads: [nodal('H', 'B', 20, 0)],
      }));
      expect(reaction(solution, 'R_y(D)')).toBeCloseTo(56, 6);
      expect(reaction(solution, 'R_x(A)')).toBeCloseTo(-20, 6);
      // La columna A–B: M(3) = −R_x(A)·3 en ejes locales, 60 kN·m en valor.
      expect(Math.abs(momentAt(solution, 'C1', 3))).toBeCloseTo(60, 6);
      expect(solution.members.find((entry) => entry.memberId === 'R1')!.arc!.stations[0]!.moment).toBeCloseTo(momentAt(solution, 'C1', 3), 6);
    });

    it('el método de secciones en un arco rechaza lo que no es suyo', () => {
      const project = model({
        nodes: [node('A', 0, 0, { type: 'pin' }), node('B', 8, 0, { type: 'roller' })],
        members: [bar('A1', 'A', 'B', { curve: { kind: 'circular-arc', bulge: 0.5 } })],
        memberLoads: [uniform('q', 'A1', -5)],
      });
      expect(solve(project).members[0]!.arc!.stations).toHaveLength(13);
      const sprung = { ...project, nodes: project.nodes.map((entry) => entry.id === 'A' ? { ...entry, support: { type: 'pin' as const, spring: { kr: 100 } } } : entry) };
      expect(solveStaticsSections(sprung, analyzeProject(sprung))).toEqual({ applicable: false, reasonKey: 'method.rejectedStaticsSupports' });
    });
  });

  it('un proyecto guardado con este método lo conserva al reabrirse', () => {
    const project = withModelStart(createBlankProject(), 'beam-simple');
    const saved = JSON.parse(JSON.stringify({ ...project, settings: { ...project.settings, solutionMethod: 'statics-sections' } }));
    expect(normalizeProject(saved).settings.solutionMethod).toBe('statics-sections');
    expect(() => normalizeProject({ ...saved, settings: { ...saved.settings, solutionMethod: 'cortes-inventados' } })).toThrow();
  });

  it('los inicios de la app: viga simple y voladizo, con peso propio y dos casos', () => {
    const simple = withModelStart(createBlankProject(), 'beam-simple');
    expect(applicableMethods(simple).map((method) => method.id)).toContain('statics-sections');
    const simpleSolution = solve(simple);
    // Peso propio incluido: la resultante coincide con la auditoría del solver.
    expect(simpleSolution.resultants.some((entry) => entry.kind === 'self-weight')).toBe(true);
    const total = simpleSolution.resultants.reduce((sum, entry) => sum + entry.fy, 0);
    expect(reaction(simpleSolution, 'R_y(N1)') + reaction(simpleSolution, 'R_y(N2)')).toBeCloseTo(-total, 9);
    expect(reaction(simpleSolution, 'R_y(N1)')).toBeCloseTo(-total / 2, 9);

    const cantilever = withModelStart(createBlankProject(), 'beam-cantilever');
    const cantileverSolution = solve(cantilever);
    const weight = cantileverSolution.resultants.reduce((sum, entry) => sum + entry.fy, 0);
    expect(reaction(cantileverSolution, 'R_y(N1)')).toBeCloseTo(-weight, 9);
    // Carga uniforme en 3 m: el momento de empotramiento es W·L/2.
    expect(reaction(cantileverSolution, 'M_R(N1)')).toBeCloseTo(-weight * 1.5, 9);
  });
});
