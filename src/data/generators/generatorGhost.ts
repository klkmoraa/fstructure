import { generateStructure } from './structureGenerators';
import type { CircularMemberCurve } from '../../graphics/memberCurve';
import type { GeneratedMemberRole, GeneratedNodeRole, GeneratedStructureSummary, GeneratorKind, GeneratorParams, GeneratorWarning } from './generatorTypes';
export interface StructureGenerationGhostNode { readonly key: string; readonly role: GeneratedNodeRole; readonly x: number; readonly y: number; readonly supported: boolean }
export interface StructureGenerationGhostMember { readonly key: string; readonly role: GeneratedMemberRole; readonly iKey: string; readonly jKey: string; readonly curve?: CircularMemberCurve }
export interface StructureGenerationGhost { readonly kind: GeneratorKind; readonly description: string; readonly nodes: readonly StructureGenerationGhostNode[]; readonly members: readonly StructureGenerationGhostMember[]; readonly summary: GeneratedStructureSummary; readonly warnings: readonly GeneratorWarning[] }
const deepFreeze = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (!value || typeof value !== 'object' || seen.has(value as object)) return value;
  seen.add(value as object);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested, seen);
  return Object.freeze(value);
};
export const createStructureGenerationGhost = (params: GeneratorParams): StructureGenerationGhost => {
  const structure = generateStructure(params), supported = new Set(structure.supportedNodeIds);
  const keyOf = (id: string) => `structure-generation-ghost-${id}`;
  return deepFreeze({ kind: structure.kind, description: structure.description,
    nodes: structure.nodes.map(n => ({ key: keyOf(n.id), role: structure.nodeRoles[n.id], x: n.x, y: n.y, supported: supported.has(n.id) })),
    members: structure.members.map(m => ({ key: keyOf(m.id), role: structure.memberRoles[m.id], iKey: keyOf(m.i), jKey: keyOf(m.j), ...(m.curve ? { curve: { ...m.curve } } : {}) })),
    summary: structuredClone(structure.summary), warnings: structure.warnings.map(w => ({ ...w })) });
};
