/**
 * Diafragma rígido contra soluciones cerradas: cuatro columnas empotradas en
 * la base y libres de girar arriba (sin vigas) valen k = 3EI/h³ cada una; el
 * diafragma las obliga a trasladarse juntas y a girar alrededor de su centro
 * con K_θ = Σ k·r² + Σ GJ/h.
 */
import { describe, expect, it } from 'vitest';
import { analyzeSpace3DProject } from './solver';
import {
  SPACE3D_ANALYSIS_SPACE,
  SPACE3D_SCHEMA_VERSION,
  fixedSpace3DRestraints,
  freeSpace3DRestraints,
  type Space3DFrameMember,
  type Space3DNodalLoad,
  type Space3DProjectV1,
} from '../model/types';

const E = 30_000_000;
const G = 12_500_000;
const I = 0.0054;
const J = 0.0091;
const A = 0.25;
const h = 3.5;
const a = 6;
const k = 3 * E * I / h ** 3;

const column = (id: string, i: string, j: string): Space3DFrameMember => ({
  id, i, j, E, G, A, Iy: I, Iz: I, J,
  orientation: { localYReferenceGlobal: [1, 0, 0], rollRadians: 0 },
});

const load = (id: string, nodeId: string, fx: number, fz = 0): Space3DNodalLoad => ({
  id, caseId: 'LC1', nodeId, fx, fy: 0, fz, mx: 0, my: 0, mz: 0,
});

const corners = [[0, 0], [a, 0], [a, a], [0, a]] as const;

const story = (loads: readonly Space3DNodalLoad[], extra: Partial<Space3DProjectV1> = {}): Space3DProjectV1 => ({
  analysisSpace: SPACE3D_ANALYSIS_SPACE,
  schemaVersion: SPACE3D_SCHEMA_VERSION,
  id: 'diaphragm', name: 'diaphragm', units: 'kN-m',
  nodes: corners.flatMap(([x, z], index) => [
    { id: `B${index}`, x, y: 0, z, restraints: fixedSpace3DRestraints() },
    { id: `T${index}`, x, y: h, z, restraints: freeSpace3DRestraints() },
  ]),
  members: corners.map((_, index) => column(`C${index}`, `B${index}`, `T${index}`)),
  nodalLoads: [...loads],
  loadCases: [{ id: 'LC1', name: 'LC1' }],
  loadCombinations: [],
  prescribedDisplacements: [], memberLoads: [], memberInitialEffects: [], nodeLinks: [],
  multiPointConstraints: [], nodalMasses: [], generatedLoadSources: [], movingLoadCases: [],
  diaphragms: [{ id: 'D1', name: 'Piso 1', nodeIds: ['T0', 'T1', 'T2', 'T3'] }],
  ...extra,
});

const displacement = (result: ReturnType<typeof analyzeSpace3DProject>, nodeId: string) =>
  result.nodeResults.find((item) => item.nodeId === nodeId)!.displacement;

describe('Space3D rigid diaphragm', () => {
  it('moves the story as a rigid body: a centred load translates it by P/(4k)', () => {
    const P = 120;
    // P/2 en dos nudos con el mismo x y z simétricos: la resultante pasa por el centro.
    const result = analyzeSpace3DProject(story([load('L1', 'T0', P / 2), load('L2', 'T3', P / 2)]), 'LC1');
    expect(result.success).toBe(true);
    for (const id of ['T0', 'T1', 'T2', 'T3']) {
      expect(displacement(result, id).ux).toBeCloseTo(P / (4 * k), 10);
      expect(Math.abs(displacement(result, id).uz)).toBeLessThan(1e-12);
      expect(Math.abs(displacement(result, id).ry)).toBeLessThan(1e-12);
    }
    expect(result.diagnostics.constrainedDofCount).toBe(12);
    expect(result.diagnostics.equilibrium.normalized).toBeLessThan(1e-9);
  });

  it('twists the story about its centre under an eccentric load', () => {
    const P = 100;
    const result = analyzeSpace3DProject(story([load('L1', 'T2', P)]), 'LC1');
    expect(result.success).toBe(true);
    // T2 en (a, a): dz = +a/2 respecto del centro ⇒ torsor P·a/2 alrededor de +Y.
    const Ktheta = 4 * k * (a * a / 2) + 4 * G * J / h;
    const theta = (P * a / 2) / Ktheta;
    const Ux = P / (4 * k);
    expect(displacement(result, 'T2').ry).toBeCloseTo(theta, 12);
    expect(displacement(result, 'T2').ux).toBeCloseTo(Ux + theta * (a / 2), 10);
    expect(displacement(result, 'T0').ux).toBeCloseTo(Ux - theta * (a / 2), 10);
    // uz = −θ·dx: T1 en (a, 0) tiene dx = +a/2.
    expect(displacement(result, 'T1').uz).toBeCloseTo(-theta * (a / 2), 10);
    const reactionX = result.nodeResults.reduce((sum, item) => sum + item.reaction.ux, 0);
    expect(reactionX).toBeCloseTo(-P, 8);
    expect(result.diagnostics.equilibrium.normalized).toBeLessThan(1e-9);
  });

  it('leaves in-plane beams without axial force, as ETABS does', () => {
    const beams: Space3DFrameMember[] = [[0, 1], [1, 2], [2, 3], [3, 0]].map(([i, j], index) => ({
      id: `V${index}`, i: `T${i}`, j: `T${j}`, E, G, A: 0.18, Iy: 0.0024, Iz: 0.0054, J: 0.004,
      orientation: { localYReferenceGlobal: [0, 1, 0], rollRadians: 0 },
    }));
    const base = story([load('L1', 'T2', 80, 30)]);
    const result = analyzeSpace3DProject({ ...base, members: [...base.members, ...beams] }, 'LC1');
    expect(result.success).toBe(true);
    const scale = Math.max(...result.memberResults.flatMap((item) => [Math.abs(item.start.Vy), Math.abs(item.start.Vz)]));
    for (const beam of result.memberResults.filter((item) => item.memberId.startsWith('V'))) {
      expect(Math.abs(beam.start.N)).toBeLessThan(scale * 1e-9);
    }
    expect(result.diagnostics.equilibrium.normalized).toBeLessThan(1e-9);
  });

  it('reports a support inside the diaphragm plane instead of guessing', () => {
    const project = story([load('L1', 'T0', 10)]);
    const restrained = { ...project, nodes: project.nodes.map((node) => (node.id === 'T1' ? { ...node, restraints: { ...node.restraints, ux: true } } : node)) };
    const result = analyzeSpace3DProject(restrained, 'LC1');
    expect(result.success).toBe(false);
    expect(result.issues).toEqual([expect.objectContaining({ code: 'constraint-conflict', entityId: 'T1', field: 'ux' })]);
  });

  it('matches the unconstrained model when the diaphragm only joins one node per column line', () => {
    // Sin diafragma, cada columna carga su parte: con la carga repartida igual
    // el resultado debe coincidir con el del diafragma (no hay torsión).
    const loads = corners.map((_, index) => load(`L${index}`, `T${index}`, 25));
    const withDiaphragm = analyzeSpace3DProject(story(loads), 'LC1');
    const { diaphragms: _omit, ...plain } = story(loads);
    const without = analyzeSpace3DProject(plain, 'LC1');
    expect(withDiaphragm.success && without.success).toBe(true);
    expect(displacement(withDiaphragm, 'T1').ux).toBeCloseTo(displacement(without, 'T1').ux, 12);
  });
});
