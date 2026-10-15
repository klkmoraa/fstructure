/**
 * Corpus de referencia del Modelo 3D: los mismos modelos resueltos por un
 * programa independiente (PyNite, MIT; sólo sus números, en
 * `referenceCorpus.json`). El generador vive en
 * `validation/python/space3d_reference_corpus.py`, requiere PyNite y no corre
 * en CI; esta prueba sólo lee el JSON.
 *
 * Tolerancia: |FStructure − PyNite| ≤ rtol·|PyNite| + piso·escala, donde la
 * escala es el mayor valor absoluto de la misma familia (traslaciones, giros,
 * fuerzas, momentos) en el caso. Ambos programas resuelven el mismo elemento
 * Euler–Bernoulli con las mismas cargas consistentes, así que sólo los separa
 * el redondeo (≈ 1e-12 con estos números de condición) y las 12 cifras del
 * JSON: rtol = 1e-6 y piso = 1e-9 dejan margen de sobra y aun así detectan
 * cualquier cambio de formulación (la deformación por cortante, por ejemplo,
 * mueve estos casos más de un 0,1 %). En el diafragma, PyNite no tiene la
 * restricción y se aproxima con barras de penalización; el generador publica
 * su error estimado (`referenceUncertainty`) y la tolerancia lo absorbe ×10.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { analyzeSpace3DProject } from './solver';
import {
  SPACE3D_ANALYSIS_SPACE,
  SPACE3D_DOF_KEYS,
  SPACE3D_SCHEMA_VERSION,
  type Space3DAnalysisResult,
  type Space3DDofKey,
  type Space3DMemberLoad,
  type Space3DMemberRelease,
  type Space3DProjectV1,
  type Space3DVector,
} from '../model/types';

type Vec = [number, number, number];

interface CorpusMember {
  readonly id: string;
  readonly i: string;
  readonly j: string;
  readonly type: 'frame' | 'truss';
  readonly E: number;
  readonly G: number;
  readonly A: number;
  readonly Iy: number;
  readonly Iz: number;
  readonly J: number;
  readonly localYReferenceGlobal: Vec;
  readonly rollDegrees: number;
  readonly releases?: Space3DMemberRelease;
}

interface CorpusCase {
  readonly id: string;
  readonly description: string;
  readonly referenceUncertainty: number;
  readonly model: {
    readonly nodes: readonly { id: string; x: number; y: number; z: number; restraints: Space3DDofKey[] }[];
    readonly members: readonly CorpusMember[];
    readonly nodalLoads: Space3DProjectV1['nodalLoads'];
    readonly memberLoads: readonly Space3DMemberLoad[];
    readonly loadCases: Space3DProjectV1['loadCases'];
    readonly loadCombinations: Space3DProjectV1['loadCombinations'];
    readonly diaphragms?: Space3DProjectV1['diaphragms'];
    readonly target: string;
  };
  readonly expected: {
    readonly nodes: Record<string, { displacement: number[]; reaction: number[] }>;
    readonly members: Record<string, { basis: { x: Vec; y: Vec; z: Vec }; start: number[]; end: number[] }>;
  };
}

interface Corpus {
  readonly source: string;
  readonly generatedAt: string;
  readonly cases: readonly CorpusCase[];
}

const corpus = JSON.parse(readFileSync(new URL('./referenceCorpus.json', import.meta.url), 'utf8')) as Corpus;

const RELATIVE = 1e-6;
const FLOOR = 1e-9;
const tolerance = (item: CorpusCase) => Math.max(RELATIVE, 10 * item.referenceUncertainty);
const floor = (item: CorpusCase) => Math.max(FLOOR, 10 * item.referenceUncertainty);

const toProject = (item: CorpusCase): Space3DProjectV1 => ({
  analysisSpace: SPACE3D_ANALYSIS_SPACE,
  schemaVersion: SPACE3D_SCHEMA_VERSION,
  id: item.id,
  name: item.id,
  units: 'kN-m',
  nodes: item.model.nodes.map((node) => ({
    id: node.id, x: node.x, y: node.y, z: node.z,
    restraints: Object.fromEntries(SPACE3D_DOF_KEYS.map((key) => [key, node.restraints.includes(key)])) as unknown as Space3DProjectV1['nodes'][number]['restraints'],
  })),
  members: item.model.members.map((member) => ({
    id: member.id, i: member.i, j: member.j, type: member.type,
    E: member.E, G: member.G, A: member.A, Iy: member.Iy, Iz: member.Iz, J: member.J,
    orientation: { localYReferenceGlobal: member.localYReferenceGlobal, rollRadians: (member.rollDegrees * Math.PI) / 180 },
    ...(member.releases ? { releases: member.releases } : {}),
  })),
  nodalLoads: item.model.nodalLoads,
  loadCases: item.model.loadCases,
  loadCombinations: item.model.loadCombinations,
  ...(item.model.diaphragms ? { diaphragms: item.model.diaphragms } : {}),
  prescribedDisplacements: [], memberLoads: item.model.memberLoads, memberInitialEffects: [], nodeLinks: [],
  multiPointConstraints: [], nodalMasses: [], generatedLoadSources: [], movingLoadCases: [],
});

const maxAbs = (values: readonly number[]) => values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);

/** Compara una familia de valores con su propia escala; devuelve los que fallan. */
const compareFamily = (item: CorpusCase, label: string, pairs: readonly [string, number, number][]): string[] => {
  const scale = maxAbs(pairs.map(([, , expected]) => expected));
  return pairs
    .filter(([, actual, expected]) => !(Math.abs(actual - expected) <= tolerance(item) * Math.abs(expected) + floor(item) * scale))
    .map(([where, actual, expected]) => `${label} ${where}: ${actual} ≠ ${expected} (escala ${scale})`);
};

const solve = (item: CorpusCase): Space3DAnalysisResult => {
  const result = analyzeSpace3DProject(toProject(item), item.model.target);
  expect(result.success, result.issues.map((issue) => `${issue.code}:${issue.entityId}:${issue.field}`).join(', ')).toBe(true);
  return result;
};

const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (target: Vec, value: Vec, factor = 1) => { for (let axis = 0; axis < 3; axis += 1) target[axis] += factor * value[axis]; };
const toGlobal = (basis: { x: Vec; y: Vec; z: Vec }, local: Vec): Vec => [0, 1, 2].map((axis) =>
  basis.x[axis] * local[0] + basis.y[axis] * local[1] + basis.z[axis] * local[2]) as Vec;

/**
 * Resultante y momento respecto al origen de todas las cargas del objetivo,
 * calculados aquí desde la definición del modelo (no desde el motor).
 */
const appliedLoads = (item: CorpusCase): { force: Vec; moment: Vec } => {
  const factors = new Map<string, number>();
  if (item.model.loadCases.some((loadCase) => loadCase.id === item.model.target)) factors.set(item.model.target, 1);
  for (const combination of item.model.loadCombinations.filter((entry) => entry.id === item.model.target)) {
    for (const term of combination.terms) factors.set(term.caseId, (factors.get(term.caseId) ?? 0) + term.factor);
  }
  const nodes = new Map(item.model.nodes.map((node) => [node.id, [node.x, node.y, node.z] as Vec]));
  const force: Vec = [0, 0, 0];
  const moment: Vec = [0, 0, 0];
  for (const load of item.model.nodalLoads) {
    const factor = factors.get(load.caseId) ?? 0;
    const f: Vec = [load.fx * factor, load.fy * factor, load.fz * factor];
    add(force, f);
    add(moment, [load.mx * factor, load.my * factor, load.mz * factor]);
    add(moment, cross(nodes.get(load.nodeId)!, f));
  }
  for (const load of item.model.memberLoads) {
    const factor = factors.get(load.caseId) ?? 0;
    const member = item.model.members.find((entry) => entry.id === load.memberId)!;
    const start = nodes.get(member.i)!;
    const end = nodes.get(member.j)!;
    const L = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
    const basis = item.expected.members[member.id].basis;
    const orient = (vector: Vec): Vec => (load.coordinateSystem === 'local' ? toGlobal(basis, vector) : vector);
    const at = (s: number): Vec => [start[0] + basis.x[0] * s, start[1] + basis.x[1] * s, start[2] + basis.x[2] * s];
    if (load.type === 'distributed') {
      const a = load.start * L;
      const b = load.end * L;
      const q1: Vec = [load.qxStart ?? 0, load.qyStart ?? 0, load.qzStart ?? 0];
      const q2: Vec = [load.qxEnd ?? 0, load.qyEnd ?? 0, load.qzEnd ?? 0];
      // Trapecio: resultante (q1 + q2)/2·ℓ aplicada en su centroide.
      for (let axis = 0; axis < 3; axis += 1) {
        const resultant = ((q1[axis] + q2[axis]) / 2) * (b - a);
        if (resultant === 0) continue;
        const centroid = a + ((b - a) * (q1[axis] + 2 * q2[axis])) / (3 * (q1[axis] + q2[axis]));
        const component: Vec = [0, 0, 0];
        component[axis] = resultant * factor;
        const f = orient(component);
        add(force, f);
        add(moment, cross(at(centroid), f));
      }
    } else if (load.type === 'point') {
      const f = orient([(load.px ?? 0) * factor, (load.py ?? 0) * factor, (load.pz ?? 0) * factor]);
      add(force, f);
      add(moment, cross(at((load.position ?? 0.5) * L), f));
    } else {
      add(moment, orient([(load.mx ?? 0) * factor, (load.my ?? 0) * factor, ((load.mz ?? 0) + (load.moment ?? 0)) * factor]));
    }
  }
  return { force, moment };
};

describe(`corpus de referencia del Modelo 3D (${corpus.source}, ${corpus.generatedAt})`, () => {
  it('trae entre seis y ocho casos con resultados de todos los nudos y barras', () => {
    expect(corpus.cases.length).toBeGreaterThanOrEqual(6);
    expect(corpus.cases.length).toBeLessThanOrEqual(8);
    for (const item of corpus.cases) {
      expect(Object.keys(item.expected.nodes).sort()).toEqual(item.model.nodes.map((node) => node.id).sort());
      expect(Object.keys(item.expected.members).sort()).toEqual(item.model.members.map((member) => member.id).sort());
    }
  });

  describe.each(corpus.cases.map((item) => [item.id, item] as const))('%s', (_id, item) => {
    it('usa la misma triada local que la referencia', () => {
      const result = solve(item);
      for (const member of result.memberResults) {
        const expected = item.expected.members[member.memberId].basis;
        for (const axis of ['x', 'y', 'z'] as const) {
          const actual: Space3DVector = member.basis[axis];
          for (let component = 0; component < 3; component += 1) {
            expect(Math.abs(actual[component] - expected[axis][component]), `${member.memberId}.${axis}`).toBeLessThan(1e-9);
          }
        }
      }
    });

    it('coincide en desplazamientos, reacciones y fuerzas de extremo', () => {
      const result = solve(item);
      const translations: [string, number, number][] = [];
      const rotations: [string, number, number][] = [];
      const forces: [string, number, number][] = [];
      const moments: [string, number, number][] = [];
      for (const node of result.nodeResults) {
        const expected = item.expected.nodes[node.nodeId];
        SPACE3D_DOF_KEYS.forEach((key, index) => {
          (index < 3 ? translations : rotations).push([`${node.nodeId}.u.${key}`, node.displacement[key], expected.displacement[index]]);
          (index < 3 ? forces : moments).push([`${node.nodeId}.R.${key}`, node.reaction[key], expected.reaction[index]]);
        });
      }
      for (const member of result.memberResults) {
        const expected = item.expected.members[member.memberId];
        for (const [end, values] of [['i', expected.start], ['j', expected.end]] as const) {
          const actual = end === 'i' ? member.start : member.end;
          (['N', 'Vy', 'Vz', 'T', 'My', 'Mz'] as const).forEach((key, index) => {
            (index === 0 || index === 1 || index === 2 ? forces : moments).push([`${member.memberId}.${end}.${key}`, actual[key], values[index]]);
          });
        }
      }
      const failures = [
        ...compareFamily(item, 'traslación', translations),
        ...compareFamily(item, 'giro', rotations),
        ...compareFamily(item, 'fuerza', forces),
        ...compareFamily(item, 'momento', moments),
      ];
      expect(failures).toEqual([]);
    });

    it('cierra el equilibrio global: ΣF y ΣM de reacciones contra cargas', () => {
      const result = solve(item);
      const { force, moment } = appliedLoads(item);
      const nodes = new Map(item.model.nodes.map((node) => [node.id, [node.x, node.y, node.z] as Vec]));
      const reactionForce: Vec = [0, 0, 0];
      const reactionMoment: Vec = [0, 0, 0];
      for (const node of result.nodeResults) {
        const r = node.reaction;
        const f: Vec = [r.ux, r.uy, r.uz];
        add(reactionForce, f);
        add(reactionMoment, [r.rx, r.ry, r.rz]);
        add(reactionMoment, cross(nodes.get(node.nodeId)!, f));
      }
      const forceScale = Math.max(1, maxAbs(force), maxAbs(reactionForce));
      const momentScale = Math.max(1, maxAbs(moment), maxAbs(reactionMoment));
      for (let axis = 0; axis < 3; axis += 1) {
        expect(Math.abs(force[axis] + reactionForce[axis]) / forceScale).toBeLessThan(1e-9);
        expect(Math.abs(moment[axis] + reactionMoment[axis]) / momentScale).toBeLessThan(1e-9);
      }
      expect(result.diagnostics.equilibrium.normalized).toBeLessThan(1e-9);
    });
  });
});
