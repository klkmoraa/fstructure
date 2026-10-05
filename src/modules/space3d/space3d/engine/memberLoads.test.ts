/**
 * Cargas en barra, peso propio, liberaciones y armaduras contra soluciones
 * cerradas de manual. Cada valor esperado sale de la fórmula indicada, no del
 * propio motor.
 */
import { describe, expect, it } from 'vitest';
import { analyzeSpace3DProject } from './solver';
import {
  SPACE3D_ANALYSIS_SPACE,
  SPACE3D_SCHEMA_VERSION,
  fixedSpace3DRestraints,
  freeSpace3DRestraints,
  type Space3DFrameMember,
  type Space3DMemberLoad,
  type Space3DNode,
  type Space3DProjectV1,
  type Space3DRestraints,
} from '../model/types';

const E = 200_000_000;
const Iz = 8e-5;
const Iy = 3e-5;
const EIz = E * Iz;

const restraints = (fixed: readonly (keyof Space3DRestraints)[]): Space3DRestraints => ({
  ...freeSpace3DRestraints(),
  ...Object.fromEntries(fixed.map((key) => [key, true])),
});

const node = (id: string, x: number, y: number, z: number, fixed: Space3DRestraints = freeSpace3DRestraints()): Space3DNode => ({ id, x, y, z, restraints: fixed });

const member = (id: string, i: string, j: string, extra: Partial<Space3DFrameMember> = {}): Space3DFrameMember => ({
  id, i, j, E, G: 80_000_000, A: 0.01, Iy, Iz, J: 2e-5,
  orientation: { localYReferenceGlobal: [0, 1, 0], rollRadians: 0 },
  ...extra,
});

const project = (parts: Partial<Space3DProjectV1>): Space3DProjectV1 => ({
  analysisSpace: SPACE3D_ANALYSIS_SPACE,
  schemaVersion: SPACE3D_SCHEMA_VERSION,
  id: 'test', name: 'test', units: 'kN-m',
  nodes: [], members: [], nodalLoads: [],
  loadCases: [{ id: 'LC1', name: 'LC1' }],
  loadCombinations: [],
  prescribedDisplacements: [], memberLoads: [], memberInitialEffects: [], nodeLinks: [],
  multiPointConstraints: [], nodalMasses: [], generatedLoadSources: [], movingLoadCases: [],
  ...parts,
});

const uniform = (id: string, memberId: string, qy: number, extra: Partial<Space3DMemberLoad> = {}): Space3DMemberLoad => ({
  id, memberId, caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
  start: 0, end: 1, qyStart: qy, qyEnd: qy, ...extra,
});

/** Viga biapoyada estable en 3D: articulación en I (y torsión) y rodillo en J. */
const simpleSupports = () => [
  node('I', 0, 0, 0, restraints(['ux', 'uy', 'uz', 'rx'])),
  node('J', 6, 0, 0, restraints(['uy', 'uz'])),
];

const stationAt = (result: ReturnType<typeof analyzeSpace3DProject>, memberId: string, x: number) => {
  const stations = result.memberResults.find((item) => item.memberId === memberId)?.stations ?? [];
  return stations.reduce((best, station) => (Math.abs(station.x - x) < Math.abs(best.x - x) ? station : best), stations[0]);
};

const reaction = (result: ReturnType<typeof analyzeSpace3DProject>, nodeId: string) =>
  result.nodeResults.find((item) => item.nodeId === nodeId)!.reaction;
const displacement = (result: ReturnType<typeof analyzeSpace3DProject>, nodeId: string) =>
  result.nodeResults.find((item) => item.nodeId === nodeId)!.displacement;

describe('Space3D member loads against closed forms', () => {
  it('simply supported beam with a uniform gravity load: wL/2, wL²/8 and 5wL⁴/384EI', () => {
    const w = 10;
    const L = 6;
    const result = analyzeSpace3DProject(project({
      nodes: simpleSupports(),
      members: [member('M1', 'I', 'J')],
      memberLoads: [uniform('Q1', 'M1', -w)],
    }), 'LC1');

    expect(result.success).toBe(true);
    expect(reaction(result, 'I').uy).toBeCloseTo(w * L / 2, 8);
    expect(reaction(result, 'J').uy).toBeCloseTo(w * L / 2, 8);
    expect(displacement(result, 'I').rz).toBeCloseTo(-w * L ** 3 / (24 * EIz), 10);
    const mid = stationAt(result, 'M1', L / 2);
    expect(mid.Mz).toBeCloseTo(w * L ** 2 / 8, 8);
    expect(mid.Vy).toBeCloseTo(0, 8);
    expect(mid.v).toBeCloseTo(-5 * w * L ** 4 / (384 * EIz), 6);
    expect(result.diagnostics.equilibrium.normalized).toBeLessThan(1e-9);
  });

  it('cantilever with a uniform load: wL⁴/8EI at the tip and −wL²/2 at the root', () => {
    const w = 10;
    const L = 2;
    const result = analyzeSpace3DProject(project({
      nodes: [node('I', 0, 0, 0, fixedSpace3DRestraints()), node('J', L, 0, 0)],
      members: [member('M1', 'I', 'J')],
      memberLoads: [uniform('Q1', 'M1', -w)],
    }), 'LC1');

    expect(result.success).toBe(true);
    expect(displacement(result, 'J').uy).toBeCloseTo(-w * L ** 4 / (8 * EIz), 10);
    expect(reaction(result, 'I').uy).toBeCloseTo(w * L, 8);
    expect(reaction(result, 'I').rz).toBeCloseTo(w * L ** 2 / 2, 8);
    expect(stationAt(result, 'M1', 0).Mz).toBeCloseTo(-w * L ** 2 / 2, 8);
    expect(stationAt(result, 'M1', L).Mz).toBeCloseTo(0, 8);
  });

  it('fixed-fixed beam with a point load at midspan: PL/8 at ends and midspan', () => {
    const P = 40;
    const L = 6;
    const load: Space3DMemberLoad = { id: 'P1', memberId: 'M1', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, py: -P, position: 0.5 };
    const result = analyzeSpace3DProject(project({
      nodes: [node('I', 0, 0, 0, fixedSpace3DRestraints()), node('J', L, 0, 0, fixedSpace3DRestraints())],
      members: [member('M1', 'I', 'J')],
      memberLoads: [load],
    }), 'LC1');

    expect(result.success).toBe(true);
    expect(stationAt(result, 'M1', 0).Mz).toBeCloseTo(-P * L / 8, 8);
    const stations = result.memberResults[0].stations!.filter((station) => Math.abs(station.x - L / 2) < 1e-9);
    // Salto de cortante bajo la carga: +P/2 a la izquierda, −P/2 a la derecha.
    expect(stations).toHaveLength(2);
    expect(stations[0].Vy).toBeCloseTo(-P / 2, 8);
    expect(stations[1].Vy).toBeCloseTo(P / 2, 8);
    expect(stations[0].Mz).toBeCloseTo(P * L / 8, 8);
  });

  it('a triangular load gives wL/6 and wL/3 reactions and wL²/(9√3) peak moment', () => {
    const w = 12;
    const L = 6;
    const result = analyzeSpace3DProject(project({
      nodes: simpleSupports(),
      members: [member('M1', 'I', 'J')],
      memberLoads: [{ ...uniform('Q1', 'M1', 0), qyStart: 0, qyEnd: -w }],
    }), 'LC1', { stationSegments: 60 });

    expect(result.success).toBe(true);
    expect(reaction(result, 'I').uy).toBeCloseTo(w * L / 6, 8);
    expect(reaction(result, 'J').uy).toBeCloseTo(w * L / 3, 8);
    const peak = Math.max(...result.memberResults[0].stations!.map((station) => station.Mz));
    expect(peak).toBeCloseTo(w * L ** 2 / (9 * Math.sqrt(3)), 2);
  });

  it('a partial uniform load keeps global equilibrium and its resultant', () => {
    const w = 8;
    const result = analyzeSpace3DProject(project({
      nodes: simpleSupports(),
      members: [member('M1', 'I', 'J')],
      memberLoads: [{ ...uniform('Q1', 'M1', -w), start: 0.25, end: 0.75 }],
    }), 'LC1');

    // Resultante w·3 m centrada: reparto simétrico.
    expect(reaction(result, 'I').uy).toBeCloseTo(12, 8);
    expect(reaction(result, 'J').uy).toBeCloseTo(12, 8);
    // Momento máximo: R·3 − w·1.5²/2.
    expect(stationAt(result, 'M1', 3).Mz).toBeCloseTo(12 * 3 - w * 1.5 ** 2 / 2, 8);
  });

  it('a couple at midspan of a simple beam jumps the moment diagram by M0', () => {
    const M0 = 30;
    const L = 6;
    const load: Space3DMemberLoad = { id: 'C1', memberId: 'M1', caseId: 'LC1', type: 'moment', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, mz: M0, position: 0.5 };
    const result = analyzeSpace3DProject(project({ nodes: simpleSupports(), members: [member('M1', 'I', 'J')], memberLoads: [load] }), 'LC1');

    expect(result.success).toBe(true);
    expect(reaction(result, 'I').uy).toBeCloseTo(M0 / L, 8);
    const stations = result.memberResults[0].stations!.filter((station) => Math.abs(station.x - L / 2) < 1e-9);
    expect(stations[0].Mz).toBeCloseTo(M0 / 2, 8);
    expect(stations[1].Mz).toBeCloseTo(-M0 / 2, 8);
  });

  it('a local load on an inclined beam equals the same load expressed globally', () => {
    const inclined = [node('I', 0, 0, 0, fixedSpace3DRestraints()), node('J', 3, 4, 0, fixedSpace3DRestraints())];
    const base = { nodes: inclined, members: [member('M1', 'I', 'J')] };
    // Local −y de la barra (3,4)/5 con referencia Y: y_local = (−0.8, 0.6, 0).
    const local = analyzeSpace3DProject(project({ ...base, memberLoads: [{ ...uniform('Q1', 'M1', -5), coordinateSystem: 'local' }] }), 'LC1');
    const global = analyzeSpace3DProject(project({ ...base, memberLoads: [{ ...uniform('Q1', 'M1', -3), qxStart: 4, qxEnd: 4 }] }), 'LC1');

    expect(local.success && global.success).toBe(true);
    expect(reaction(local, 'I').ux).toBeCloseTo(reaction(global, 'I').ux, 8);
    expect(reaction(local, 'I').uy).toBeCloseTo(reaction(global, 'I').uy, 8);
    expect(reaction(local, 'I').rz).toBeCloseTo(reaction(global, 'I').rz, 8);
    expect(reaction(local, 'I').uy + reaction(local, 'J').uy).toBeCloseTo(3 * 5, 8);
  });

  it('a load per horizontal metre on an inclined beam totals q times the plan length', () => {
    const q = 4;
    const result = analyzeSpace3DProject(project({
      nodes: [node('I', 0, 0, 0, fixedSpace3DRestraints()), node('J', 3, 4, 0, fixedSpace3DRestraints())],
      members: [member('M1', 'I', 'J')],
      memberLoads: [{ ...uniform('Q1', 'M1', -q), lengthBasis: 'horizontal' }],
    }), 'LC1');

    expect(reaction(result, 'I').uy + reaction(result, 'J').uy).toBeCloseTo(q * 3, 8);
  });
});

describe('Space3D self-weight', () => {
  it('a vertical column weighs ρ·g·A·L and compresses its base', () => {
    const density = 7850;
    const A = 0.01;
    const L = 3;
    const weight = density * 9.80665 * A * L / 1000;
    const result = analyzeSpace3DProject(project({
      nodes: [node('B', 0, 0, 0, fixedSpace3DRestraints()), node('T', 0, L, 0)],
      members: [member('C1', 'B', 'T', { density, A, orientation: { localYReferenceGlobal: [0, 0, 1], rollRadians: 0 } })],
      loadCases: [{ id: 'DEAD', name: 'Muerta', selfWeightFactor: 1 }],
    }), 'DEAD');

    expect(result.success).toBe(true);
    expect(reaction(result, 'B').uy).toBeCloseTo(weight, 8);
    expect(stationAt(result, 'C1', 0).N).toBeCloseTo(-weight, 8);
    expect(stationAt(result, 'C1', L).N).toBeCloseTo(0, 8);
  });

  it('scales with the combination factor and the case multiplier', () => {
    const density = 7850;
    const result = analyzeSpace3DProject(project({
      nodes: [node('B', 0, 0, 0, fixedSpace3DRestraints()), node('T', 0, 2, 0)],
      members: [member('C1', 'B', 'T', { density, orientation: { localYReferenceGlobal: [0, 0, 1], rollRadians: 0 } })],
      loadCases: [{ id: 'DEAD', name: 'Muerta', selfWeightFactor: 1 }, { id: 'LIVE', name: 'Viva' }],
      loadCombinations: [{ id: 'U1', name: '1.4D', terms: [{ caseId: 'DEAD', factor: 1.4 }, { caseId: 'LIVE', factor: 1.7 }] }],
    }), 'U1');

    expect(reaction(result, 'B').uy).toBeCloseTo(1.4 * density * 9.80665 * 0.01 * 2 / 1000, 8);
  });
});

describe('Space3D releases and trusses', () => {
  it('a beam released in bending at both ends behaves as simply supported between fixed nodes', () => {
    const w = 10;
    const L = 6;
    const result = analyzeSpace3DProject(project({
      nodes: [node('I', 0, 0, 0, fixedSpace3DRestraints()), node('J', L, 0, 0, fixedSpace3DRestraints())],
      members: [member('M1', 'I', 'J', { releases: { iRy: true, iRz: true, jRy: true, jRz: true } })],
      memberLoads: [uniform('Q1', 'M1', -w)],
    }), 'LC1');

    expect(result.success).toBe(true);
    expect(reaction(result, 'I').rz).toBeCloseTo(0, 8);
    expect(result.memberResults[0].start.Mz).toBeCloseTo(0, 8);
    const mid = stationAt(result, 'M1', L / 2);
    expect(mid.Mz).toBeCloseTo(w * L ** 2 / 8, 8);
    expect(mid.v).toBeCloseTo(-5 * w * L ** 4 / (384 * EIz), 6);
  });

  it('a propped cantilever made with one released end carries wL²/8 at the fixed end', () => {
    const w = 10;
    const L = 6;
    const result = analyzeSpace3DProject(project({
      nodes: [node('I', 0, 0, 0, fixedSpace3DRestraints()), node('J', L, 0, 0, fixedSpace3DRestraints())],
      members: [member('M1', 'I', 'J', { releases: { jRz: true } })],
      memberLoads: [uniform('Q1', 'M1', -w)],
    }), 'LC1');

    expect(result.success).toBe(true);
    expect(stationAt(result, 'M1', 0).Mz).toBeCloseTo(-w * L ** 2 / 8, 8);
    expect(reaction(result, 'I').uy).toBeCloseTo(5 * w * L / 8, 8);
    expect(reaction(result, 'J').uy).toBeCloseTo(3 * w * L / 8, 8);
  });

  it('rejects releases that leave the member as a mechanism', () => {
    const result = analyzeSpace3DProject(project({
      nodes: [node('I', 0, 0, 0, fixedSpace3DRestraints()), node('J', 6, 0, 0, fixedSpace3DRestraints())],
      members: [member('M1', 'I', 'J', { releases: { iRx: true, jRx: true } })],
      nodalLoads: [],
    }), 'LC1');

    expect(result.success).toBe(false);
    expect(result.issues).toContainEqual({ code: 'mechanism', entityKind: 'member', entityId: 'M1', field: 'releases' });
  });

  it('solves a plane truss by the method of joints and fixes the rotations by itself', () => {
    const truss = (id: string, i: string, j: string) => member(id, i, j, { type: 'truss', Iy: 0, Iz: 0, J: 0, G: 0 });
    const result = analyzeSpace3DProject(project({
      nodes: [
        node('A', 0, 0, 0, restraints(['ux', 'uy', 'uz'])),
        node('B', 4, 0, 0, restraints(['uy', 'uz'])),
        node('C', 2, 2, 0),
      ],
      members: [truss('AB', 'A', 'B'), truss('AC', 'A', 'C'), truss('BC', 'B', 'C')],
      nodalLoads: [{ id: 'P', caseId: 'LC1', nodeId: 'C', fx: 0, fy: -10, fz: 0, mx: 0, my: 0, mz: 0 }],
    }), 'LC1');

    expect(result.success).toBe(true);
    const axial = (id: string) => stationAt(result, id, 0).N;
    expect(axial('AC')).toBeCloseTo(-10 / Math.SQRT2, 8);
    expect(axial('BC')).toBeCloseTo(-10 / Math.SQRT2, 8);
    expect(axial('AB')).toBeCloseTo(5, 8);
    // Nueve giros y la traslación fuera del plano de C: sin rigidez ni carga.
    expect(result.diagnostics.autoRestrainedDofCount).toBe(10);
  });

  it('reports a load on a degree of freedom with no stiffness as a mechanism at that node', () => {
    const truss = (id: string, i: string, j: string) => member(id, i, j, { type: 'truss', Iy: 0, Iz: 0, J: 0, G: 0 });
    const result = analyzeSpace3DProject(project({
      nodes: [node('A', 0, 0, 0, fixedSpace3DRestraints()), node('B', 2, 0, 0, restraints(['uy', 'uz']))],
      members: [truss('AB', 'A', 'B')],
      nodalLoads: [{ id: 'P', caseId: 'LC1', nodeId: 'B', fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 5 }],
    }), 'LC1');

    expect(result.success).toBe(false);
    expect(result.issues).toContainEqual({ code: 'mechanism', entityKind: 'node', entityId: 'B', field: 'rz' });
  });
});
