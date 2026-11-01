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

  it('rechaza un marco hiperestático y una barra curva', () => {
    const fixedPortal = model({
      nodes: [node('A', 0, 0, { type: 'fixed' }), node('B', 0, 4), node('C', 6, 4), node('D', 6, 0, { type: 'fixed' })],
      members: [bar('C1', 'A', 'B'), bar('V1', 'B', 'C'), bar('C2', 'C', 'D')],
      nodalLoads: [nodal('H', 'B', 20, 0)],
    });
    expect(solveStaticsSections(fixedPortal, analyzeProject(fixedPortal))).toEqual({ applicable: false, reasonKey: 'method.rejectedIndeterminateStatics' });
    expect(applicableMethods(fixedPortal).map((method) => method.id)).not.toContain('statics-sections');

    const curved = model({
      nodes: [node('A', 0, 0, { type: 'pin' }), node('B', 8, 0, { type: 'roller' })],
      members: [bar('A1', 'A', 'B', { curve: { kind: 'circular-arc', bulge: 0.5 } })],
      memberLoads: [uniform('q', 'A1', -5)],
    });
    expect(solveStaticsSections(curved, analyzeProject(curved))).toEqual({ applicable: false, reasonKey: 'method.rejectedCurvedMember' });
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
