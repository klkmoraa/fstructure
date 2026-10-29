import { normalizeProject as normalizeBase } from './linearProjectMigration';
import { circularMemberGeometry, validateMemberCurve } from '../graphics/memberCurve';
import type { ProjectModel } from '../types';

/** Preserve curve geometry explicitly; never infer it from legacy chains. */
export const normalizeProject = (input: unknown): ProjectModel => {
  const project = normalizeBase(input);
  const raw = input as { members?: Array<{ id?: string; curve?: unknown }> };
  const original = new Map((raw.members ?? []).map(member => [member.id, member]));
  const nodes = new Map(project.nodes.map(node => [node.id, node]));
  for (const member of project.members) {
    const curve = original.get(member.id)?.curve;
    if (curve === undefined) continue;
    if (member.type !== 'frame') throw new Error(`${member.id}: una curva debe ser un miembro de marco.`);
    member.curve = validateMemberCurve(curve);
    circularMemberGeometry(member, nodes.get(member.i)!, nodes.get(member.j)!);
  }
  return project;
};
