import { describe, expect, it } from 'vitest';
import { analyzeProject } from '../engine/solver';
import { createBlankProject } from '../data/defaultProject';
import { MODEL_START_DEFAULTS, withModelStart } from '../data/modelStarts';
import type { LoadCombination, MemberLoad, MemberModel, NodalLoad, NodeModel, ProjectModel } from '../types';
import { applicableMethods } from './methodRegistry';
import { solveMomentDistributionFrame, type CrossFrameResult } from './momentDistributionFrame';
import { solveHardyCross } from './hardyCross';

const E = 2e8;
const frame = (id: string, i: string, j: string, I = 1e-4, A = 0.01): MemberModel => ({ id, i, j, type: 'frame', E, A, I });
const node = (id: string, x: number, y: number, support: NodeModel['support'] = { type: 'none' }): NodeModel => ({ id, x, y, support });
const uniform = (memberId: string, qx: number, qy: number): MemberLoad => ({
  id: `q-${memberId}`, memberId, caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
  start: 0, end: 1, qxStart: qx, qxEnd: qx, qyStart: qy, qyEnd: qy,
});
const point = (memberId: string, py: number, position: number): MemberLoad => ({
  id: `p-${memberId}`, memberId, caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real',
  start: position, end: position, position, px: 0, py,
});
const nodal = (nodeId: string, fx: number, fy = 0, mz = 0): NodalLoad => ({ id: `n-${nodeId}`, nodeId, caseId: 'LC1', fx, fy, mz });
const model = (nodes: NodeModel[], members: MemberModel[], memberLoads: MemberLoad[] = [], nodalLoads: NodalLoad[] = []): ProjectModel => ({
  ...createBlankProject(), nodes, members, memberLoads, nodalLoads,
});

const solve = (project: ProjectModel, combination: LoadCombination | null = null): CrossFrameResult => {
  const analysis = analyzeProject(project, combination, { includeEducationTrace: false });
  expect(analysis.success).toBe(true);
  const outcome = solveMomentDistributionFrame(project, analysis, combination);
  if (!outcome.applicable) throw new Error(`Cross rejected the model: ${outcome.reasonKey}`);
  return outcome;
};

/**
 * Independent axially rigid reference, built here rather than trusted from the module: every A
 * multiplied by 1e6 and the density divided by the same, so self-weight is unchanged.
 */
const rigidReference = (project: ProjectModel, combination: LoadCombination | null = null) => {
  const rigid = analyzeProject({
    ...project,
    members: project.members.map((member) => ({
      ...member,
      A: member.A * 1e6,
      ...(member.density === undefined ? {} : { density: member.density / 1e6 }),
    })),
  }, combination, { includeEducationTrace: false });
  expect(rigid.success).toBe(true);
  return rigid;
};

/** Largest end-moment gap against the rigid run, relative to its largest end moment. */
const rigidGap = (project: ProjectModel, solution: CrossFrameResult, combination: LoadCombination | null = null): number => {
  const rigid = rigidReference(project, combination);
  let gap = 0;
  let scale = 0;
  for (const member of solution.members) {
    const forces = rigid.memberResults.find((entry) => entry.memberId === member.memberId)!.localEndForces;
    gap = Math.max(gap, Math.abs(member.finalMomentI - forces[2]), Math.abs(member.finalMomentJ - forces[5]));
    scale = Math.max(scale, Math.abs(forces[2]), Math.abs(forces[5]));
  }
  return gap / scale;
};

/** Σ(M_i + M_j)/h over a storey's columns: the storey shear the columns carry. */
const storeyShear = (solution: CrossFrameResult, columnIds: readonly string[], height: number): number => columnIds
  .map((id) => solution.members.find((member) => member.memberId === id)!)
  .reduce((sum, member) => sum + member.finalMomentI + member.finalMomentJ, 0) / height;

describe('Cross (distribución de momentos) en marcos', () => {
  it('reproduce a mano una viga empotrada–apoyada–empotrada, sin desplazamiento', () => {
    // A (empotrado) — 6 m, w = 20 kN/m — B (rodillo) — 4 m, P = 30 kN al centro — C (empotrado), EI igual.
    // MEP: wL²/12 = 60, PL/8 = 15. FD en B: (1/6)/(1/6 + 1/4) = 0.4 y 0.6. Desequilibrio en B con
    // momentos antihorarios sobre la barra: −60 + 15 = −45; se reparten +18 y +27 y se transportan
    // +9 a A y +13.5 a C. Un solo ciclo basta: sólo B gira.
    const project = model(
      [node('A', 0, 0, { type: 'fixed' }), node('B', 6, 0, { type: 'roller', angleDeg: 90 }), node('C', 10, 0, { type: 'fixed' })],
      [frame('AB', 'A', 'B'), frame('BC', 'B', 'C')],
      [uniform('AB', 0, -20), point('BC', -30, 0.5)],
    );
    const solution = solve(project);
    expect(solution.modes).toHaveLength(0);
    expect(solution.nonSway.cycleCount).toBe(1);
    const [ab, bc] = solution.members;
    expect(ab.fixedEndMomentI).toBeCloseTo(60, 9);
    expect(ab.fixedEndMomentJ).toBeCloseTo(-60, 9);
    expect(bc.fixedEndMomentI).toBeCloseTo(15, 9);
    expect(bc.fixedEndMomentJ).toBeCloseTo(-15, 9);
    // The textbook formulas reproduce those FEMs, so the report can print them.
    expect(ab.femTerms?.map((term) => term.kind)).toEqual(['uniform']);
    expect(ab.femTerms?.[0].value).toBeCloseTo(20, 12);
    expect(bc.femTerms?.[0]).toMatchObject({ kind: 'point', a: 2 });
    const factors = solution.joints.find((joint) => joint.nodeId === 'B')!.endIndices.map((index) => solution.ends[index].distributionFactor);
    expect(factors[0]).toBeCloseTo(0.4, 12);
    expect(factors[1]).toBeCloseTo(0.6, 12);
    expect(solution.nonSway.cycles[0].balance.filter((value) => value !== 0)).toEqual([expect.closeTo(18, 9), expect.closeTo(27, 9)]);
    expect(ab.finalMomentI).toBeCloseTo(69, 9);
    expect(ab.finalMomentJ).toBeCloseTo(-42, 9);
    expect(bc.finalMomentI).toBeCloseTo(42, 9);
    expect(bc.finalMomentJ).toBeCloseTo(-1.5, 9);
    // Por secciones: R_A = wL/2 + (M_i + M_j)/L = 60 + 27/6 = 64.5 kN.
    expect(ab.shearStart).toBeCloseTo(64.5, 9);
    expect(ab.shearEnd).toBeCloseTo(64.5 - 120, 9);
    // M máximo positivo de AB donde V = 0: x = 64.5/20 = 3.225 m, M = −69 + 64.5·x − 10x².
    expect(ab.spanMaximum.x).toBeCloseTo(3.225, 9);
    expect(ab.spanMaximum.value).toBeCloseTo(-69 + 64.5 * 3.225 - 10 * 3.225 ** 2, 9);
    // A beam has no axial–bending coupling: the real solver lands exactly too.
    expect(solution.verification.solverResidual).toBeLessThan(1e-8);
    expect(solution.verification.rigidResidual).toBeLessThan(1e-8);
    // `hardy-cross` refuses fixed ends; this method is what covers them.
    expect(solveHardyCross(project, analyzeProject(project)).applicable).toBe(false);
    expect(applicableMethods(project).map((method) => method.id)).toContain('moment-distribution-frame');
  });

  it('resuelve un pórtico empotrado con carga lateral: forma cerrada y referencia axialmente rígida', () => {
    const P = 20;
    const h = 4;
    const L = 6;
    const project = model(
      [node('A', 0, 0, { type: 'fixed' }), node('B', 0, h), node('C', L, h), node('D', L, 0, { type: 'fixed' })],
      [frame('AB', 'A', 'B', 1e-4), frame('BC', 'B', 'C', 2e-4), frame('DC', 'D', 'C', 1e-4)],
      [],
      [nodal('B', P)],
    );
    const solution = solve(project);
    expect(solution.modes).toHaveLength(1);
    expect(solution.storeyForm).toBe(true);
    expect(solution.modes[0].storey).toMatchObject({ level: 1, height: h });
    // Sin cargas de barra la etapa sin desplazamiento es nula y todo lo hace el modo.
    expect(solution.nonSway.final.every((value) => value === 0)).toBe(true);
    // Forma cerrada (antisimétrica), k = (I_v/L)/(I_c/h):
    //   M_base = (Ph/2)(3k + 1)/(6k + 1),  M_cabeza = (Ph/2)·3k/(6k + 1).
    const k = (2e-4 / L) / (1e-4 / h);
    const base = (P * h / 2) * (3 * k + 1) / (6 * k + 1);
    const top = (P * h / 2) * (3 * k) / (6 * k + 1);
    const [ab, bc, dc] = solution.members;
    for (const column of [ab, dc]) {
      expect(column.finalMomentI).toBeCloseTo(base, 8);
      expect(column.finalMomentJ).toBeCloseTo(top, 8);
      // Local y of a column drawn upwards points to −x: the leftward base reaction is +P/2.
      expect(column.shearStart).toBeCloseTo(P / 2, 8);
    }
    expect(bc.finalMomentI).toBeCloseTo(-top, 8);
    expect(bc.finalMomentJ).toBeCloseTo(-top, 8);
    // Ecuación de cortante del entrepiso, con los momentos finales.
    expect(storeyShear(solution, ['AB', 'DC'], h)).toBeCloseTo(P, 9);
    expect(solution.equations[0].nodalLoadTerm).toBeCloseTo(P, 12);
    expect(rigidGap(project, solution)).toBeLessThan(1e-6);
    // El análisis real se separa un poco: la deformación axial, informada, no ocultada.
    expect(solution.verification.solverResidual).toBeGreaterThan(solution.verification.rigidResidual);
  });

  it('superpone dos modos en un pórtico de 2 crujías y 2 niveles con gravedad, viento en columnas y cargas laterales', () => {
    const project = model(
      [
        node('A0', 0, 0, { type: 'fixed' }), node('B0', 5, 0, { type: 'fixed' }), node('C0', 11, 0, { type: 'pin' }),
        node('A1', 0, 3.5), node('B1', 5, 3.5), node('C1', 11, 3.5),
        node('A2', 0, 6.5), node('B2', 5, 6.5), node('C2', 11, 6.5),
      ],
      [
        frame('CA1', 'A0', 'A1', 2e-4), frame('CB1', 'B0', 'B1', 3e-4), frame('CC1', 'C0', 'C1', 2e-4),
        frame('CA2', 'A1', 'A2', 1.5e-4), frame('CB2', 'B1', 'B2', 2e-4), frame('CC2', 'C1', 'C2', 1.5e-4),
        frame('V1a', 'A1', 'B1', 4e-4), frame('V1b', 'B1', 'C1', 5e-4),
        frame('V2a', 'A2', 'B2', 3e-4), frame('V2b', 'B2', 'C2', 3.5e-4),
      ],
      [uniform('V1a', 0, -25), uniform('V1b', 0, -30), uniform('V2a', 0, -18), point('V2b', -40, 0.35), uniform('CA1', 4, 0), uniform('CA2', 4, 0)],
      [nodal('A1', 30), nodal('A2', 15), nodal('C2', 0, 0, 12)],
    );
    const solution = solve(project);
    expect(solution.modes).toHaveLength(2);
    expect(solution.storeyForm).toBe(true);
    expect(solution.modes.map((mode) => mode.storey?.columnIds)).toEqual([['CA1', 'CB1', 'CC1'], ['CA2', 'CB2', 'CC2']]);
    // Both storeys genuinely sway, and neither mode is negligible.
    expect(solution.swayFactors.every((value) => Math.abs(value) > 1e-3)).toBe(true);
    expect(rigidGap(project, solution)).toBeLessThan(1e-6);
    // Cortante de entrepiso: la cabeza de las columnas de viento lleva wh/2 al nivel, el resto pasa
    // entero al entrepiso de abajo.
    expect(storeyShear(solution, ['CA2', 'CB2', 'CC2'], 3)).toBeCloseTo(15 + 4 * 3 / 2, 8);
    expect(storeyShear(solution, ['CA1', 'CB1', 'CC1'], 3.5) - (4 * 3.5) / 2).toBeCloseTo(30 + 15 + 4 * 3, 8);
    // The sway-state coefficient matrix is symmetric (Maxwell–Betti): a sign slip would break it.
    const [first, second] = solution.equations;
    expect(first.coefficients[1] / solution.modes[1].assumedDisplacement)
      .toBeCloseTo(second.coefficients[0] / solution.modes[0].assumedDisplacement, 6);
    // Joint moment equilibrium at every rotating joint, with the applied moment at C2.
    for (const joint of solution.joints.filter((entry) => entry.rotates)) {
      const sum = joint.endIndices.reduce((total, index) => total + solution.final[index], 0);
      expect(sum).toBeCloseTo(joint.appliedMoment, 8);
    }
  });

  it('usa la forma de trabajo virtual en un marco a dos aguas, con cargas de barra que trabajan en el modo', () => {
    const project = model(
      [node('A', 0, 0, { type: 'fixed' }), node('B', 0, 4), node('C', 5, 6), node('D', 10, 4), node('E', 10, 0, { type: 'fixed' })],
      [frame('AB', 'A', 'B'), frame('BC', 'B', 'C'), frame('CD', 'C', 'D'), frame('DE', 'D', 'E')],
      [uniform('BC', 0, -10), uniform('CD', 0, -10), uniform('AB', 4, 0)],
      [nodal('C', 5)],
    );
    const solution = solve(project);
    expect(solution.storeyForm).toBe(false);
    expect(solution.modes).toHaveLength(2);
    expect(solution.equations.some((equation) => Math.abs(equation.memberLoadTerm) > 1)).toBe(true);
    expect(rigidGap(project, solution)).toBeLessThan(1e-6);
  });

  it('resuelve el pórtico de inicio de la app (2 crujías, 2 niveles) en U2 y en servicio', () => {
    const project = withModelStart(createBlankProject(), 'frame-portal', { ...MODEL_START_DEFAULTS['frame-portal'], count: 2, levels: 2 });
    expect(applicableMethods(project).map((method) => method.id)).toContain('moment-distribution-frame');
    for (const id of ['U2', 'SERV']) {
      const combination = project.combinations.find((entry) => entry.id === id)!;
      const solution = solve(project, combination);
      expect(solution.storeyForm).toBe(true);
      expect(solution.modes).toHaveLength(2);
      expect(rigidGap(project, solution, combination)).toBeLessThan(1e-6);
      expect(solution.verification.rigidResidual / solution.verification.referenceMoment).toBeLessThan(1e-6);
      // The real (axially deformable) solver differs by a few percent at most: reported, not hidden.
      expect(solution.verification.solverResidual / solution.verification.solverReferenceMoment).toBeLessThan(0.05);
      // Self-weight reaches the beams' formulas: w = CM + CV + ρgA under the combination factors.
      const beam = solution.members.find((member) => member.memberId === 'V11')!;
      expect(beam.femTerms?.[0].label).toContain('peso propio');
      if (id === 'SERV') {
        // Symmetric gravity: the sway factors vanish.
        expect(solution.swayFactors.every((value) => Math.abs(value) < 1e-9)).toBe(true);
      } else {
        const lateral = project.nodalLoads.filter((load) => load.caseId === 'S');
        const top = lateral.filter((load) => load.nodeId.endsWith('2')).reduce((sum, load) => sum + load.fx, 0);
        const total = lateral.reduce((sum, load) => sum + load.fx, 0);
        const [storey1, storey2] = solution.modes.map((mode) => mode.storey!);
        expect(storeyShear(solution, storey2.columnIds, storey2.height)).toBeCloseTo(top, 7);
        expect(storeyShear(solution, storey1.columnIds, storey1.height)).toBeCloseTo(total, 7);
      }
    }
  });

  it('se retira ante una articulación interna, una liberación o una barra curva', () => {
    const base = (): ProjectModel => model(
      [node('A', 0, 0, { type: 'fixed' }), node('B', 0, 4), node('C', 6, 4), node('D', 6, 0, { type: 'fixed' })],
      [frame('AB', 'A', 'B'), frame('BC', 'B', 'C'), frame('DC', 'D', 'C')],
      [uniform('BC', 0, -10)],
      [nodal('B', 10)],
    );
    const outcome = (project: ProjectModel) => solveMomentDistributionFrame(project, analyzeProject(project));

    const hinged = base();
    hinged.nodes[1] = { ...hinged.nodes[1], internalHinge: true };
    expect(outcome(hinged)).toEqual({ applicable: false, reasonKey: 'method.rejectedContinuityRequired' });

    const released = base();
    released.members[1] = { ...released.members[1], releases: { jMoment: true } };
    expect(outcome(released)).toEqual({ applicable: false, reasonKey: 'method.rejectedContinuityRequired' });

    const curved = base();
    curved.members[1] = { ...curved.members[1], curve: { kind: 'circular-arc', bulge: 0.3 } };
    expect(outcome(curved)).toEqual({ applicable: false, reasonKey: 'method.rejectedCurvedMember' });

    // A determinate beam has nothing to distribute and is not offered.
    const simple = model(
      [node('A', 0, 0, { type: 'pin' }), node('B', 6, 0, { type: 'roller', angleDeg: 90 })],
      [frame('AB', 'A', 'B')],
      [uniform('AB', 0, -10)],
    );
    expect(applicableMethods(simple).map((method) => method.id)).not.toContain('moment-distribution-frame');
    expect(outcome(simple)).toEqual({ applicable: false, reasonKey: 'method.rejectedStaticallyDeterminate' });
  });
});
