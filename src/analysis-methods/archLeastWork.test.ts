import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../data/defaultProject';
import { normalizeProject } from '../data/linearProjectMigration';
import { withModelStart } from '../data/modelStarts';
import { analyzeProject } from '../engine/solver';
import type { MemberLoad, ProjectModel, SupportDefinition } from '../types';
import { circularTwoHingedThrust, solveArchLeastWork, type ArchLeastWorkResult } from './archLeastWork';
import { applicableMethods } from './methodRegistry';

const E = 25e6;
const A = 0.15;
const I = 0.003125;

/** Arco circular de 10 m de claro entre A (0, 0) y B (10, 0); bulge 1 es el semicírculo de R = 5 m. */
const arch = (bulge: number, supports: [SupportDefinition, SupportDefinition], loads: MemberLoad[]): ProjectModel => ({
  ...createBlankProject(),
  nodes: [{ id: 'A', x: 0, y: 0, support: supports[0] }, { id: 'B', x: 10, y: 0, support: supports[1] }],
  members: [{ id: 'A1', i: 'A', j: 'B', type: 'frame', E, A, I, curve: { kind: 'circular-arc', bulge } }],
  memberLoads: loads,
  nodalLoads: [],
});

const uniform = (q: number, lengthBasis: MemberLoad['lengthBasis']): MemberLoad => ({
  id: 'w', memberId: 'A1', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis,
  start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: q, qyEnd: q,
});

const solve = (project: ProjectModel, combinationId?: string): ArchLeastWorkResult => {
  const combination = combinationId ? project.combinations.find((entry) => entry.id === combinationId)! : null;
  const analysis = analyzeProject(project, combination);
  expect(analysis.success).toBe(true);
  const outcome = solveArchLeastWork(project, analysis, combination);
  if (!outcome.applicable) throw new Error(`rechazado: ${outcome.reasonKey}`);
  return outcome;
};

const PIN: SupportDefinition = { type: 'pin' };
const FIXED: SupportDefinition = { type: 'fixed' };

describe('trabajo mínimo (Castigliano) en arcos circulares', () => {
  it('semicírculo biarticulado con w por proyección horizontal: H = 4wR/(3π) sin axial, y el solver con axial', () => {
    const solution = solve(arch(1, [PIN, PIN], [uniform(-20, 'horizontal')]));
    expect(solution.form).toBe('two-hinged');
    const [H] = solution.redundants;
    // A mano, sin deformación axial: H = 4wR/(3π) = 4·20·5/(3π) = 42.4413 kN.
    const reference = (4 * 20 * 5) / (3 * Math.PI);
    expect(solution.closedForm!.thrust).toBeCloseTo(reference, 10);
    // Simpson con 192 intervalos: a 1e-8 relativo.
    expect(H!.bendingOnlyValue).toBeCloseTo(reference, 5);
    // ∫ m² ds/EI con m = −y = −R sen θ: R³π/(2EI).
    expect(solution.bending[0]![0]!).toBeCloseTo((125 * Math.PI) / 2 / (E * I), 12);
    // Con el término axial el empuje baja un poco, y es el del análisis matricial.
    expect(H!.value).toBeLessThan(H!.bendingOnlyValue);
    expect(Math.abs(H!.value - H!.solverValue) / H!.value).toBeLessThan(1e-3);
    // En la clave: M = wL²/8 − H·R.
    const crown = solution.stations.find((station) => Math.abs(station.t - 0.5) < 1e-12)!;
    expect(crown.M).toBeCloseTo(250 - H!.value * 5, 8);
    expect(Math.abs(crown.M - crown.solver!.moment)).toBeLessThan(solution.verification.tolerance * solution.verification.momentScale);
  });

  it('semicírculo biarticulado con carga puntual en la clave: H = P/π sin axial', () => {
    const point: MemberLoad = { id: 'P', memberId: 'A1', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 0.5, px: 0, py: -100 };
    const solution = solve(arch(1, [PIN, PIN], [point]));
    const [H] = solution.redundants;
    expect(H!.bendingOnlyValue).toBeCloseTo(100 / Math.PI, 5);
    expect(solution.closedForm).toBeUndefined();
    expect(Math.abs(H!.value - H!.solverValue) / H!.value).toBeLessThan(1e-3);
  });

  it('arco empotrado (tres redundantes): la simetría da X₂ = W/2 y todo cae en el solver', () => {
    const solution = solve(arch(0.6, [FIXED, FIXED], [uniform(-20, 'real')]));
    expect(solution.form).toBe('cantilever');
    expect(solution.redundants.map((entry) => entry.symbol)).toEqual(['X_1', 'X_2', 'X_3']);
    const weight = 20 * solution.geometry.length;
    expect(solution.redundants[1]!.value).toBeCloseTo(weight / 2, 8);
    // La matriz de flexibilidad es simétrica y la de un voladizo: ∫ 1² ds/EI = L/EI.
    expect(solution.bending[2]![2]!).toBeCloseTo(solution.geometry.length / (E * I), 14);
    expect(solution.bending[0]![2]!).toBeCloseTo(solution.bending[2]![0]!, 18);
    const { verification } = solution;
    expect(verification.redundant).toBeLessThan(verification.tolerance);
    expect(verification.moment / verification.momentScale).toBeLessThan(verification.tolerance);
  });

  it('empotrado en un extremo y articulado en el otro: dos redundantes en el pasador', () => {
    const solution = solve(arch(0.6, [PIN, FIXED], [uniform(-20, 'horizontal')]));
    expect(solution.releasedNodeId).toBe('A');
    expect(solution.redundants).toHaveLength(2);
    expect(solution.verification.redundant).toBeLessThan(solution.verification.tolerance);
  });

  it('el arco del inicio de la app (dos pasadores, peso propio y dos casos) se ofrece y coincide', () => {
    const project = withModelStart(createBlankProject(), 'arch');
    const methods = applicableMethods(project).map((method) => method.id);
    expect(methods).toContain('arch-least-work');
    expect(methods).not.toContain('statics-sections');
    const solution = solve(project, 'SERV');
    expect(solution.loads.some((load) => load.label === 'peso propio')).toBe(true);
    const [H] = solution.redundants;
    expect(Math.abs(H!.value - H!.solverValue) / H!.value).toBeLessThan(solution.verification.tolerance);
    // Carga por metro de arco: la fórmula cerrada de proyección horizontal no aplica y se omite.
    expect(solution.closedForm).toBeUndefined();

    const saved = JSON.parse(JSON.stringify({ ...project, settings: { ...project.settings, solutionMethod: 'arch-least-work' } }));
    expect(normalizeProject(saved).settings.solutionMethod).toBe('arch-least-work');
  });

  it('la fórmula cerrada reproduce el semicírculo y tiende a wL²/(8f) en un arco rebajado', () => {
    expect(circularTwoHingedThrust(20, 5, Math.PI / 2).thrust).toBeCloseTo(400 / (3 * Math.PI), 12);
    // Muy rebajado (f/L = 1/50) el círculo es casi una parábola: H → wL²/(8f).
    const span = 10;
    const rise = 0.2;
    const radius = (span * span / 4 + rise * rise) / (2 * rise);
    const thrust = circularTwoHingedThrust(20, radius, Math.asin(span / 2 / radius)).thrust;
    expect(thrust / ((20 * span * span) / (8 * rise))).toBeCloseTo(1, 3);
  });

  it('rechaza lo que no es un arco hiperestático de una sola barra', () => {
    const roller = arch(0.6, [{ type: 'roller', angleDeg: 90 }, FIXED], [uniform(-20, 'real')]);
    expect(solveArchLeastWork(roller, analyzeProject(roller))).toEqual({ applicable: false, reasonKey: 'method.rejectedArchSupports' });
    const sprung = arch(0.6, [{ type: 'pin', spring: { kr: 1000 } }, PIN], [uniform(-20, 'real')]);
    expect(solveArchLeastWork(sprung, analyzeProject(sprung))).toEqual({ applicable: false, reasonKey: 'method.rejectedModelFeature' });
    const portal = withModelStart(createBlankProject(), 'frame-portal');
    expect(solveArchLeastWork(portal, analyzeProject(portal))).toEqual({ applicable: false, reasonKey: 'method.rejectedArchShape' });
    expect(applicableMethods(portal).map((method) => method.id)).not.toContain('arch-least-work');
  });
});
