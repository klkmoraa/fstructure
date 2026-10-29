import type { MemberModel, NodeModel } from '../../types';
import { circularMemberGeometry, curveBoundsPoints } from '../../graphics/memberCurve';
import { generateStructure as generateLinearStructure } from './linearStructureGenerators';
import { resolveGeneratorMemberProperties } from './generatorProperties';
import { validateGeneratedStructure } from './generatorValidation';
import type { GeneratedStructure, GeneratorParams } from './generatorTypes';

/** Drafting topology is physical: one circular member between its two end nodes. */
export const generateStructure = (params: GeneratorParams): GeneratedStructure => {
  if (params.kind !== 'circular-arch' && params.kind !== 'circular-ring') return generateLinearStructure(params);
  if (params.memberType && params.memberType !== 'frame') throw new Error('Una barra curva trabaja a flexión: elige un miembro de marco, no una barra de armadura axial.');
  const origin = params.origin ?? { x: 0, y: 0 };
  if (![origin.x, origin.y].every(Number.isFinite)) throw new Error('El origen debe contener coordenadas finitas.');
  const properties = resolveGeneratorMemberProperties(params.properties);
  const ring = params.kind === 'circular-ring';
  const span = params.kind === 'circular-arch' ? params.span : 2 * params.radius;
  const rise = params.kind === 'circular-arch' ? params.rise : params.radius;
  if (!Number.isFinite(span) || !Number.isFinite(rise) || span <= 0 || rise <= 0 || rise > span / 2) {
    throw new Error('El claro y la flecha deben ser positivos; la flecha no puede superar la mitad del claro.');
  }
  const support = ring ? { type: 'none' as const } : params.baseSupport ?? { type: 'none' as const };
  const nodes: NodeModel[] = [
    { id: 'N1', x: origin.x - (ring ? span / 2 : 0), y: origin.y, support: structuredClone(support) },
    { id: 'N2', x: origin.x + (ring ? span / 2 : span), y: origin.y, support: structuredClone(support) },
  ];
  const member: MemberModel = { id: 'M1', i: 'N1', j: 'N2', type: 'frame', ...properties,
    curve: { kind: 'circular-arc', bulge: 2 * rise / span } };
  const members = ring ? [member, { ...member, id: 'M2', curve: { kind: 'circular-arc' as const, bulge: -1 } }] : [member];
  const arcs = members.map(m => circularMemberGeometry(m, nodes[0], nodes[1])!);
  const points = arcs.flatMap(curveBoundsPoints);
  const supportedNodeIds = nodes.filter(n => n.support.type !== 'none').map(n => n.id);
  const role = ring ? 'ring-segment' as const : 'arc-segment' as const;
  const structure: GeneratedStructure = {
    kind: params.kind, description: ring ? 'Anillo circular (dos arcos)' : 'Barra curva circular', nodes, members,
    nodeRoles: { N1: ring ? 'joint' : 'base', N2: ring ? 'joint' : 'base' },
    memberRoles: Object.fromEntries(members.map(m => [m.id, role])), supportedNodeIds,
    summary: { nodeCount: 2, memberCount: members.length, supportedNodeCount: supportedNodeIds.length,
      memberCountsByRole: { [role]: members.length }, totalMemberLength: arcs.reduce((sum, a) => sum + a.length, 0),
      bounds: { minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
        minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)) },
      properties: { E: properties.E, A: properties.A, I: properties.I,
        ...(properties.materialId ? { materialId: properties.materialId } : {}),
        ...(properties.sectionId ? { sectionId: properties.sectionId } : {}) } },
    warnings: supportedNodeIds.length ? [] : [{ code: 'no-supports', message: 'Sin apoyos: asigna las restricciones a los nudos extremos antes de analizar.' }],
  };
  validateGeneratedStructure(structure);
  return structure;
};
