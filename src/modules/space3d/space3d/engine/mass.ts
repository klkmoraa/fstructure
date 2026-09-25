/**
 * Masa concentrada del análisis dinámico, con la «Mass Source» de ETABS:
 *
 *   · masa propia de las barras (densidad · área · longitud), mitad a cada
 *     extremo, si la fuente la incluye;
 *   · masas nodales declaradas, siempre;
 *   · cargas verticales de los casos elegidos, W/g por su factor. Las cargas
 *     en barra se llevan a los extremos con su vector nodal equivalente, así
 *     que la resultante es exacta; el peso propio de esos casos no se cuenta
 *     otra vez porque ya es masa propia.
 *
 * La masa va a las tres traslaciones del nudo (es isótropa). Unidades: kN,
 * m y s ⇒ la masa sale en t (kN·s²/m), la misma escala que usa la rigidez.
 */
import { resolveSpace3DMemberLoads, SPACE3D_GRAVITY, space3DFixedEndForces, hasSpace3DLocalLoads } from './memberLoading';
import type { assembleSpace3DStaticModel } from './solver';
import type { Space3DMassSource, Space3DProjectV1 } from '../model/types';

const DOF_PER_NODE = 6;
const KILOGRAM_TO_TONNE = 1e-3;

export const SPACE3D_DEFAULT_MASS_SOURCE: Space3DMassSource = Object.freeze({ selfMass: true, loads: Object.freeze([]) });

export interface Space3DMassDistribution {
  /** Masa global por GDL (diagonal), t y t·m². */
  readonly diagonal: Float64Array;
  /** Masa traslacional total por dirección X, Y, Z, t. */
  readonly total: readonly [number, number, number];
  readonly fromSelf: number;
  readonly fromNodal: number;
  readonly fromLoads: number;
}

export const assembleSpace3DMassDistribution = (
  project: Space3DProjectV1,
  assembly: ReturnType<typeof assembleSpace3DStaticModel>,
): Space3DMassDistribution => {
  const source = project.massSource ?? SPACE3D_DEFAULT_MASS_SOURCE;
  const diagonal = new Float64Array(assembly.totalDofs);
  const nodeIndex = new Map(project.nodes.map((node, index) => [node.id, index]));
  const memberById = new Map(project.members.map((member) => [member.id, member]));
  const addTranslational = (node: number, mass: number) => {
    if (!(mass > 0) || !Number.isFinite(mass)) return;
    for (let dof = 0; dof < 3; dof += 1) diagonal[node * DOF_PER_NODE + dof] += mass;
  };

  let fromSelf = 0;
  if (source.selfMass) {
    for (const element of assembly.elements) {
      const member = memberById.get(element.memberId);
      if (!member || !(member.density && member.density > 0) || !(member.A > 0)) continue;
      const mass = member.density * member.A * element.length * KILOGRAM_TO_TONNE;
      if (!(mass > 0) || !Number.isFinite(mass)) continue;
      fromSelf += mass;
      addTranslational(nodeIndex.get(element.nodeI)!, mass / 2);
      addTranslational(nodeIndex.get(element.nodeJ)!, mass / 2);
    }
  }

  let fromNodal = 0;
  for (const nodalMass of project.nodalMasses) {
    const index = nodeIndex.get(nodalMass.nodeId);
    if (index === undefined || !(nodalMass.mass > 0) || !Number.isFinite(nodalMass.mass)) continue;
    const base = index * DOF_PER_NODE;
    const add = (dof: number, value: number | undefined) => {
      const mass = (value ?? 0) * KILOGRAM_TO_TONNE;
      if (mass > 0 && Number.isFinite(mass)) diagonal[base + dof] += mass;
    };
    add(0, nodalMass.massX ?? nodalMass.mass);
    add(1, nodalMass.massY ?? nodalMass.mass);
    add(2, nodalMass.massZ ?? nodalMass.mass);
    add(3, nodalMass.inertiaX ?? nodalMass.rotationalInertia);
    add(4, nodalMass.inertiaY ?? nodalMass.rotationalInertia);
    add(5, nodalMass.inertiaZ ?? nodalMass.rotationalInertia);
    fromNodal += nodalMass.mass * KILOGRAM_TO_TONNE;
  }

  let fromLoads = 0;
  if (source.loads.length > 0) {
    const factors = new Map<string, number>();
    for (const term of source.loads) factors.set(term.caseId, (factors.get(term.caseId) ?? 0) + term.factor);
    // Fuerza vertical neta por nudo: una carga hacia arriba descuenta, pero un
    // nudo nunca acaba con masa negativa.
    const vertical = new Float64Array(project.nodes.length);
    for (const load of project.nodalLoads) {
      const factor = factors.get(load.caseId);
      const index = nodeIndex.get(load.nodeId);
      if (!factor || index === undefined) continue;
      vertical[index] += load.fy * factor;
    }
    const loadsByMember = new Map<string, Space3DProjectV1['memberLoads'][number][]>();
    for (const load of project.memberLoads) {
      if (!factors.has(load.caseId)) continue;
      const list = loadsByMember.get(load.memberId);
      if (list) list.push(load);
      else loadsByMember.set(load.memberId, [load]);
    }
    for (const element of assembly.elements) {
      const memberLoads = loadsByMember.get(element.memberId);
      const member = memberById.get(element.memberId);
      if (!memberLoads || !member) continue;
      const nodeI = project.nodes[nodeIndex.get(element.nodeI)!];
      const nodeJ = project.nodes[nodeIndex.get(element.nodeJ)!];
      const loads = resolveSpace3DMemberLoads({
        member,
        memberLoads,
        start: [nodeI.x, nodeI.y, nodeI.z],
        end: [nodeJ.x, nodeJ.y, nodeJ.z],
        basis: element.basis,
        factors,
        selfWeightFactor: 0,
      });
      if (!hasSpace3DLocalLoads(loads)) continue;
      const fixedEnd = space3DFixedEndForces(loads, element.length, element.kind);
      // Fuerza nodal equivalente global: −Tᵀ·f_F; sólo su componente Y.
      const verticalAt = (offset: number) => {
        let value = 0;
        for (let k = 0; k < 12; k += 1) value -= element.transformation[k][offset + 1] * fixedEnd[k];
        return value;
      };
      vertical[nodeIndex.get(element.nodeI)!] += verticalAt(0);
      vertical[nodeIndex.get(element.nodeJ)!] += verticalAt(6);
    }
    vertical.forEach((force, index) => {
      const mass = -force / SPACE3D_GRAVITY;
      if (!(mass > 0)) return;
      fromLoads += mass;
      addTranslational(index, mass);
    });
  }

  const total: [number, number, number] = [0, 0, 0];
  for (let node = 0; node < project.nodes.length; node += 1) {
    for (let axis = 0; axis < 3; axis += 1) total[axis] += diagonal[node * DOF_PER_NODE + axis];
  }
  return Object.freeze({ diagonal, total, fromSelf, fromNodal, fromLoads });
};
