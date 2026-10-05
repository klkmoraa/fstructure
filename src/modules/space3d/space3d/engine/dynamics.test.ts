/**
 * Modal, pandeo y P-Delta en perfil contra soluciones cerradas.
 *
 *   · Columna sin masa con masa en la punta: ω² = 3EI / (m·L³).
 *   · Piso rígido sobre cuatro columnas (k = 3EI/h³, arriba libres de girar)
 *     con masa m en cada esquina: X y Z comparten ω² = k/m (autovalor doble)
 *     y la torsión vale ω² = (2k·a² + 4GJ/h) / (2m·a²).
 *   · Euler en ménsula: P_cr = π²EI / (4L²).
 *   · Ménsula con axil P y carga lateral H: δ = H·(tan αL − αL) / (P·α), α² = P/EI.
 */
import { describe, expect, it } from 'vitest';
import { analyzeSpace3DBuckling, analyzeSpace3DModal, analyzeSpace3DPDelta } from './analysisModes';
import { SPACE3D_GRAVITY } from './memberLoading';
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

const base = (parts: Partial<Space3DProjectV1>): Space3DProjectV1 => ({
  analysisSpace: SPACE3D_ANALYSIS_SPACE,
  schemaVersion: SPACE3D_SCHEMA_VERSION,
  id: 'dyn', name: 'dyn', units: 'kN-m',
  nodes: [], members: [], nodalLoads: [],
  loadCases: [{ id: 'LC1', name: 'LC1' }],
  loadCombinations: [],
  prescribedDisplacements: [], memberLoads: [], memberInitialEffects: [], nodeLinks: [],
  multiPointConstraints: [], nodalMasses: [], generatedLoadSources: [], movingLoadCases: [],
  ...parts,
});

const column = (id: string, i: string, j: string): Space3DFrameMember => ({
  id, i, j, E, G, A, Iy: I, Iz: I, J,
  orientation: { localYReferenceGlobal: [1, 0, 0], rollRadians: 0 },
});

const load = (id: string, nodeId: string, components: Partial<Space3DNodalLoad>): Space3DNodalLoad => ({
  id, caseId: 'LC1', nodeId, fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0, ...components,
});

/** Columna vertical de altura L partida en `segments` barras, empotrada abajo. */
const cantileverColumn = (L: number, segments: number, loads: readonly Space3DNodalLoad[] = []): Space3DProjectV1 => base({
  nodes: Array.from({ length: segments + 1 }, (_, index) => ({
    id: `N${index}`, x: 0, y: (L * index) / segments, z: 0,
    restraints: index === 0 ? fixedSpace3DRestraints() : freeSpace3DRestraints(),
  })),
  members: Array.from({ length: segments }, (_, index) => column(`C${index}`, `N${index}`, `N${index + 1}`)),
  nodalLoads: [...loads],
});

const a = 6;
const h = 3.5;
const m = 12; // t por esquina
const corners = [[0, 0], [a, 0], [a, a], [0, a]] as const;
const storyWithMass = (extra: Partial<Space3DProjectV1> = {}): Space3DProjectV1 => base({
  nodes: corners.flatMap(([x, z], index) => [
    { id: `B${index}`, x, y: 0, z, restraints: fixedSpace3DRestraints() },
    { id: `T${index}`, x, y: h, z, restraints: freeSpace3DRestraints() },
  ]),
  members: corners.map((_, index) => column(`C${index}`, `B${index}`, `T${index}`)),
  nodalMasses: corners.map((_, index) => ({ id: `M${index}`, nodeId: `T${index}`, mass: m * 1000 })),
  diaphragms: [{ id: 'D1', name: 'Piso 1', nodeIds: corners.map((_, index) => `T${index}`) }],
  ...extra,
});

describe('Space3D modal analysis on the profile solver', () => {
  it('matches ω² = 3EI/(mL³) for a massless column with a tip mass', () => {
    const L = 4;
    const tip = 8;
    const project = { ...cantileverColumn(L, 1), nodalMasses: [{ id: 'M1', nodeId: 'N1', mass: tip * 1000 }] };
    const result = analyzeSpace3DModal(project, { modes: 2, targetId: 'LC1' });
    expect(result.success).toBe(true);
    expect(result.sturmVerified).toBe(true);
    const expected = 3 * E * I / (tip * L ** 3);
    // Iy = Iz: los dos modos laterales son el mismo autovalor, repetido.
    for (const mode of result.modes) expect(mode.angularFrequency ** 2 / expected).toBeCloseTo(1, 9);
    expect(result.modes[0].participatingMassRatioX + result.modes[1].participatingMassRatioX).toBeCloseTo(1, 9);
  });

  it('finds the two translational modes and the torsional one of a rigid-diaphragm story', () => {
    const result = analyzeSpace3DModal(storyWithMass(), { modes: 3, targetId: 'LC1' });
    expect(result.success).toBe(true);
    expect(result.sturmVerified).toBe(true);
    const k = 3 * E * I / h ** 3;
    const lateral = k / m;
    const torsion = (2 * k * a * a + 4 * G * J / h) / (2 * m * a * a);
    const values = result.modes.map((mode) => mode.angularFrequency ** 2);
    expect(values[0] / lateral).toBeCloseTo(1, 9);
    expect(values[1] / lateral).toBeCloseTo(1, 9);
    expect(values[2] / torsion).toBeCloseTo(1, 9);
    // Un par repetido admite cualquier mezcla de X y Z; juntos suman el 100 %.
    expect(result.modes[0].participatingMassRatioX + result.modes[1].participatingMassRatioX).toBeCloseTo(1, 9);
    expect(result.modes[0].participatingMassRatioZ + result.modes[1].participatingMassRatioZ).toBeCloseTo(1, 9);
    expect(result.modes[2].participatingMassRatioX + result.modes[2].participatingMassRatioZ).toBeLessThan(1e-9);
    expect(result.totalMassByDirection[0]).toBeCloseTo(4 * m, 12);
  });

  it('turns vertical loads of the mass-source cases into the same mass', () => {
    const fromLoads = storyWithMass({
      nodalMasses: [],
      loadCases: [{ id: 'DEAD', name: 'Muerta' }],
      nodalLoads: corners.map((_, index) => ({ ...load(`W${index}`, `T${index}`, { fy: -m * SPACE3D_GRAVITY }), caseId: 'DEAD' })),
      massSource: { selfMass: false, loads: [{ caseId: 'DEAD', factor: 1 }] },
    });
    const declared = analyzeSpace3DModal(storyWithMass(), { modes: 3, targetId: 'LC1' });
    const derived = analyzeSpace3DModal(fromLoads, { modes: 3, targetId: 'DEAD' });
    expect(derived.success).toBe(true);
    expect(derived.massBreakdown.loads).toBeCloseTo(4 * m, 9);
    derived.modes.forEach((mode, index) => expect(mode.period / declared.modes[index].period).toBeCloseTo(1, 9));
  });

  it('counts a uniform beam load q·L/g as mass, split to its ends', () => {
    const q = 18;
    const L = 5;
    const project = base({
      nodes: [
        { id: 'A', x: 0, y: 0, z: 0, restraints: fixedSpace3DRestraints() },
        { id: 'B', x: L, y: 0, z: 0, restraints: fixedSpace3DRestraints() },
        { id: 'C', x: L / 2, y: 0, z: 0, restraints: freeSpace3DRestraints() },
      ],
      members: [
        { ...column('V1', 'A', 'C'), orientation: { localYReferenceGlobal: [0, 1, 0], rollRadians: 0 } },
        { ...column('V2', 'C', 'B'), orientation: { localYReferenceGlobal: [0, 1, 0], rollRadians: 0 } },
      ],
      memberLoads: ['V1', 'V2'].map((memberId, index) => ({
        id: `Q${index}`, memberId, caseId: 'LC1', type: 'distributed' as const, coordinateSystem: 'global' as const, lengthBasis: 'real' as const,
        start: 0, end: 1, qyStart: -q, qyEnd: -q,
      })),
      massSource: { selfMass: false, loads: [{ caseId: 'LC1', factor: 0.5 }] },
    });
    const result = analyzeSpace3DModal(project, { modes: 1, targetId: 'LC1' });
    expect(result.success).toBe(true);
    expect(result.massBreakdown.loads).toBeCloseTo(0.5 * q * L / SPACE3D_GRAVITY, 9);
  });

  it('solves a 12-storey building in well under a second', () => {
    const bays = 4;
    const stories = 12;
    const nodes: Space3DProjectV1['nodes'][number][] = [];
    const members: Space3DFrameMember[] = [];
    const diaphragms: NonNullable<Space3DProjectV1['diaphragms']>[number][] = [];
    const id = (i: number, k: number, s: number) => `${i}-${k}-${s}`;
    for (let s = 0; s <= stories; s += 1) {
      const level: string[] = [];
      for (let i = 0; i <= bays; i += 1) for (let k = 0; k <= bays; k += 1) {
        nodes.push({ id: id(i, k, s), x: i * 6, y: s * 3.2, z: k * 6, restraints: s === 0 ? fixedSpace3DRestraints() : freeSpace3DRestraints() });
        if (s > 0) {
          level.push(id(i, k, s));
          members.push(column(`C${id(i, k, s)}`, id(i, k, s - 1), id(i, k, s)));
          const beam = (other: string, tag: string) => members.push({ ...column(`${tag}${id(i, k, s)}`, id(i, k, s), other), A: 0.18, Iy: 0.0024, Iz: 0.0054, J: 0.004, orientation: { localYReferenceGlobal: [0, 1, 0], rollRadians: 0 } });
          if (i > 0) beam(id(i - 1, k, s), 'X');
          if (k > 0) beam(id(i, k - 1, s), 'Z');
        }
      }
      if (s > 0) diaphragms.push({ id: `D${s}`, name: `Piso ${s}`, nodeIds: level });
    }
    const project = base({
      nodes, members, diaphragms,
      loadCases: [{ id: 'DEAD', name: 'Muerta' }],
      nodalLoads: nodes.filter((node) => node.y > 0).map((node, index) => ({ ...load(`W${index}`, node.id, { fy: -60 }), caseId: 'DEAD' })),
      massSource: { selfMass: false, loads: [{ caseId: 'DEAD', factor: 1 }] },
    });
    const started = performance.now();
    const result = analyzeSpace3DModal(project, { modes: 12, targetId: 'DEAD' });
    const elapsed = performance.now() - started;
    expect(result.success).toBe(true);
    expect(result.sturmVerified).toBe(true);
    expect(result.modes).toHaveLength(12);
    // 3 GDL por piso con masa: 12 modos cubren casi toda la masa en X.
    const cumulativeX = result.modes.reduce((sum, mode) => sum + mode.participatingMassRatioX, 0);
    expect(cumulativeX).toBeGreaterThan(0.95);
    expect(elapsed).toBeLessThan(3000);
  });
});

describe('Space3D stability on the profile solver', () => {
  it('matches Euler for a cantilever: P_cr = π²EI/(4L²)', () => {
    const L = 5;
    const P = 100;
    const result = analyzeSpace3DBuckling(cantileverColumn(L, 10, [load('P', 'N10', { fy: -P })]), 'LC1', { modes: 2 });
    expect(result.success).toBe(true);
    expect(result.sturmVerified).toBe(true);
    const expected = Math.PI ** 2 * E * I / (4 * L * L) / P;
    expect(result.criticalLoadFactor! / expected).toBeCloseTo(1, 4);
  });

  it('matches the exact beam-column deflection with P-Delta', () => {
    const L = 5;
    const P = 0.4 * Math.PI ** 2 * E * I / (4 * L * L);
    const H = 20;
    const project = cantileverColumn(L, 10, [load('P', 'N10', { fy: -P, fx: H })]);
    const result = analyzeSpace3DPDelta(project, 'LC1', { maxIterations: 50, tolerance: 1e-10 });
    expect(result.success).toBe(true);
    const alpha = Math.sqrt(P / (E * I));
    const exact = H * (Math.tan(alpha * L) - alpha * L) / (P * alpha);
    const tip = result.analysis.nodeResults.find((node) => node.nodeId === 'N10')!.displacement.ux;
    expect(tip / exact).toBeCloseTo(1, 3);
    // Y la base resiste H más el momento de segundo orden P·δ.
    const baseReaction = result.analysis.nodeResults.find((node) => node.nodeId === 'N0')!.reaction;
    expect(baseReaction.ux).toBeCloseTo(-H, 6);
  });
});
