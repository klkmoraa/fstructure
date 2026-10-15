/**
 * Resortes de apoyo y zonas rígidas contra soluciones cerradas de manual, y
 * su paso por el codec (esquema 5) y el validador. Cada valor esperado sale
 * de la fórmula indicada, no del propio motor.
 */
import { describe, expect, it } from 'vitest';

import { parseSpace3DProject, serializeSpace3DProject } from '../data/codec';
import { validateSpace3DProject } from '../model/validation';
import { analyzeSpace3DProject } from './solver';
import {
  SPACE3D_ANALYSIS_SPACE,
  SPACE3D_SCHEMA_VERSION,
  fixedSpace3DRestraints,
  freeSpace3DRestraints,
  type Space3DFrameMember,
  type Space3DMemberLoad,
  type Space3DNodalLoad,
  type Space3DNode,
  type Space3DProjectV1,
} from '../model/types';

const E = 200_000_000;
const Iz = 8e-5;
const Iy = 3e-5;
const A = 0.01;
const L = 4;
const P = 12;

const beam = (extra: Partial<Space3DFrameMember> = {}): Space3DFrameMember => ({
  id: 'M1', i: 'I', j: 'J', E, G: 80_000_000, A, Iy, Iz, J: 2e-5,
  orientation: { localYReferenceGlobal: [0, 1, 0], rollRadians: 0 },
  ...extra,
});

const tipLoad = (components: Partial<Space3DNodalLoad>): Space3DNodalLoad => ({
  id: 'P1', caseId: 'LC1', nodeId: 'J', fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0, ...components,
});

const project = (parts: Partial<Space3DProjectV1>): Space3DProjectV1 => ({
  analysisSpace: SPACE3D_ANALYSIS_SPACE,
  schemaVersion: SPACE3D_SCHEMA_VERSION,
  id: 'test', name: 'test', units: 'kN-m',
  nodes: [
    { id: 'I', x: 0, y: 0, z: 0, restraints: fixedSpace3DRestraints() },
    { id: 'J', x: L, y: 0, z: 0, restraints: freeSpace3DRestraints() },
  ],
  members: [beam()], nodalLoads: [],
  loadCases: [{ id: 'LC1', name: 'LC1' }],
  loadCombinations: [],
  prescribedDisplacements: [], memberLoads: [], memberInitialEffects: [], nodeLinks: [],
  multiPointConstraints: [], nodalMasses: [], generatedLoadSources: [], movingLoadCases: [],
  ...parts,
});

const run = (model: Space3DProjectV1) => {
  const result = analyzeSpace3DProject(model, 'LC1');
  expect(result.success, result.issues.map((issue) => `${issue.code}:${issue.entityId}:${issue.field}`).join(', ')).toBe(true);
  expect(result.diagnostics.equilibrium.normalized).toBeLessThan(1e-9);
  return result;
};
const nodeResult = (result: ReturnType<typeof run>, id: string) => result.nodeResults.find((item) => item.nodeId === id)!;
const close = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-9 * Math.abs(expected));

/** Empotramiento con el giro rz liberado y sostenido por un resorte. */
const springBase = (k: number): Space3DNode => ({
  id: 'I', x: 0, y: 0, z: 0, restraints: { ...fixedSpace3DRestraints(), rz: false }, springs: { rz: k },
});

describe('resortes de apoyo', () => {
  it('voladizo sobre resorte rotacional: δ = PL³/3EI + PL²/k y M = −k·θ', () => {
    const k = 8000;
    const result = run(project({ nodes: [springBase(k), { id: 'J', x: L, y: 0, z: 0, restraints: freeSpace3DRestraints() }], nodalLoads: [tipLoad({ fy: -P })] }));
    close(nodeResult(result, 'J').displacement.uy, -(P * L ** 3 / (3 * E * Iz) + P * L ** 2 / k));
    const theta = nodeResult(result, 'I').displacement.rz;
    close(theta, -P * L / k);
    // El resorte devuelve el momento de empotramiento P·L.
    close(nodeResult(result, 'I').reaction.rz, P * L);
    close(nodeResult(result, 'I').reaction.uy, P);
  });

  it('resorte traslacional en serie con el axil: u = P/(EA/L + k)', () => {
    const k = 150_000;
    const result = run(project({
      nodes: [
        { id: 'I', x: 0, y: 0, z: 0, restraints: fixedSpace3DRestraints() },
        { id: 'J', x: L, y: 0, z: 0, restraints: freeSpace3DRestraints(), springs: { ux: k } },
      ],
      nodalLoads: [tipLoad({ fx: P })],
    }));
    const u = P / (E * A / L + k);
    close(nodeResult(result, 'J').displacement.ux, u);
    close(nodeResult(result, 'J').reaction.ux, -k * u);
    close(nodeResult(result, 'I').reaction.ux, -E * A / L * u);
  });

  it('un resorte basta para estabilizar un GDL que de otro modo sería mecanismo', () => {
    // Columna articulada en la base: sin resorte en rz es un mecanismo.
    const k = 20_000;
    const base: Space3DNode = { id: 'I', x: 0, y: 0, z: 0, restraints: { ...fixedSpace3DRestraints(), rz: false } };
    const loads = [tipLoad({ fy: -P })];
    expect(analyzeSpace3DProject(project({ nodes: [base, { id: 'J', x: L, y: 0, z: 0, restraints: freeSpace3DRestraints() }], nodalLoads: loads }), 'LC1').success).toBe(false);
    const sprung = run(project({ nodes: [{ ...base, springs: { rz: k } }, { id: 'J', x: L, y: 0, z: 0, restraints: freeSpace3DRestraints() }], nodalLoads: loads }));
    expect(nodeResult(sprung, 'J').displacement.uy).toBeLessThan(0);
  });

  it('un GDL restringido prevalece sobre su resorte', () => {
    const withSpring = run(project({
      nodes: [{ id: 'I', x: 0, y: 0, z: 0, restraints: fixedSpace3DRestraints(), springs: { rz: 10 } }, { id: 'J', x: L, y: 0, z: 0, restraints: freeSpace3DRestraints() }],
      nodalLoads: [tipLoad({ fy: -P })],
    }));
    close(nodeResult(withSpring, 'J').displacement.uy, -P * L ** 3 / (3 * E * Iz));
  });
});

describe('zonas rígidas en los extremos', () => {
  it('zona rígida junto al empotramiento: sólo flexa la parte libre L′ = L − a', () => {
    const a = 0.6;
    const flexible = L - a;
    const result = run(project({ members: [beam({ rigidOffsetI: a })], nodalLoads: [tipLoad({ fy: -P })] }));
    close(nodeResult(result, 'J').displacement.uy, -P * flexible ** 3 / (3 * E * Iz));
    close(nodeResult(result, 'J').displacement.rz, -P * flexible ** 2 / (2 * E * Iz));
    // Las fuerzas de extremo se informan en los nudos: el momento en I es P·L.
    const member = result.memberResults[0];
    close(Math.abs(member.start.Mz), P * L);
    close(nodeResult(result, 'I').reaction.rz, P * L);
  });

  it('zona rígida en la punta: la cara recibe P y P·b; la punta suma b·θ', () => {
    const b = 0.5;
    const flexible = L - b;
    const result = run(project({ members: [beam({ rigidOffsetJ: b })], nodalLoads: [tipLoad({ fz: P })] }));
    const face = P * flexible ** 3 / (3 * E * Iy) + P * b * flexible ** 2 / (2 * E * Iy);
    const theta = P * flexible ** 2 / (2 * E * Iy) + P * b * flexible / (E * Iy);
    close(nodeResult(result, 'J').displacement.uz, face + b * theta);
    close(Math.abs(nodeResult(result, 'J').displacement.ry), theta);
  });

  it('una carga dentro de la zona rígida pasa a la cara con su brazo', () => {
    const b = 0.8;
    const flexible = L - b;
    const load: Space3DMemberLoad = {
      id: 'Q1', memberId: 'M1', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real',
      start: 0, end: 1, position: (L - b / 2) / L, py: -P,
    };
    const result = run(project({ members: [beam({ rigidOffsetJ: b })], memberLoads: [load] }));
    const arm = b / 2;
    const face = P * flexible ** 3 / (3 * E * Iz) + P * arm * flexible ** 2 / (2 * E * Iz);
    const theta = P * flexible ** 2 / (2 * E * Iz) + P * arm * flexible / (E * Iz);
    close(nodeResult(result, 'J').displacement.uy, -(face + b * theta));
    close(nodeResult(result, 'I').reaction.rz, P * (L - arm));
    // La elástica de las estaciones es recta en la zona rígida y llega a la punta.
    const stations = result.memberResults[0].stations ?? [];
    expect(stations[stations.length - 1].v).toBeCloseTo(nodeResult(result, 'J').displacement.uy, 12);
  });

  it('una carga distribuida sobre toda la barra con zonas en ambos extremos cierra el equilibrio', () => {
    const uniform: Space3DMemberLoad = {
      id: 'Q1', memberId: 'M1', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
      start: 0, end: 1, qyStart: -5, qyEnd: -9,
    };
    const result = run(project({ members: [beam({ rigidOffsetI: 0.3, rigidOffsetJ: 0.4 })], memberLoads: [uniform] }));
    close(nodeResult(result, 'I').reaction.uy, (5 + 9) / 2 * L);
  });
});

describe('codec y validación de resortes y zonas rígidas', () => {
  const sprung = project({ nodes: [springBase(8000), { id: 'J', x: L, y: 0, z: 0, restraints: freeSpace3DRestraints() }], members: [beam({ rigidOffsetJ: 0.4 })] });

  it('guarda y reabre los resortes y las zonas rígidas en el esquema 5', () => {
    const reopened = parseSpace3DProject(serializeSpace3DProject(sprung));
    expect(reopened.schemaVersion).toBe(5);
    expect(reopened.nodes[0].springs).toEqual({ rz: 8000 });
    expect(reopened.members[0].rigidOffsetJ).toBe(0.4);
  });

  it('migra un archivo del esquema 4 sin perder nada y rechaza resortes en él', () => {
    const { springs: _omit, ...plainNode } = sprung.nodes[0];
    const v4 = { ...sprung, schemaVersion: 4, nodes: [plainNode, sprung.nodes[1]] };
    expect(parseSpace3DProject(JSON.stringify(v4)).schemaVersion).toBe(SPACE3D_SCHEMA_VERSION);
    expect(() => parseSpace3DProject(JSON.stringify({ ...sprung, schemaVersion: 4 }))).toThrow();
  });

  it('rechaza rigideces negativas y zonas rígidas imposibles', () => {
    const negative = { ...sprung, nodes: [{ ...sprung.nodes[0], springs: { rz: -1 } }, sprung.nodes[1]] };
    expect(validateSpace3DProject(negative)).toContainEqual(expect.objectContaining({ entityId: 'I', field: 'springs.rz' }));
    const tooLong = { ...sprung, members: [beam({ rigidOffsetI: 2, rigidOffsetJ: 2 })] };
    expect(validateSpace3DProject(tooLong)).toContainEqual(expect.objectContaining({ entityId: 'M1', code: 'invalid-property' }));
    const truss = { ...sprung, members: [beam({ type: 'truss', rigidOffsetI: 0.2 })] };
    expect(validateSpace3DProject(truss)).toContainEqual(expect.objectContaining({ entityId: 'M1', field: 'rigidOffsetI' }));
  });
});
