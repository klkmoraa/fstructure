import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../../data/defaultProject';
import { ensureNodeAtPoint } from '../../data/modelOperations';
import type { MemberModel, NodeModel, ProjectModel } from '../../types';
import {
  buildIntersectionSnapCandidates,
  buildMidpointSnapCandidates,
  buildPerpendicularSnapCandidates,
} from '../../utils/snapping';
import { memberSnapSegments } from './snapSegments';

const frame = { type: 'frame' as const, E: 200e6, A: 0.02, I: 1e-4 };

/** Semicírculo de claro 2 sobre (0,0)–(2,0): centro (1,0), radio 1, clave en (1,1). */
const arch = (extra: { nodes?: NodeModel[]; members?: MemberModel[] } = {}): ProjectModel => ({
  ...createBlankProject(),
  nodes: [
    { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'N2', x: 2, y: 0, support: { type: 'pin' } },
    ...(extra.nodes ?? []),
  ],
  members: [
    { id: 'A', i: 'N1', j: 'N2', ...frame, curve: { kind: 'circular-arc', bulge: 1 } },
    ...(extra.members ?? []),
  ],
});
const segmentsOf = (project: ProjectModel) => memberSnapSegments(project.members, new Map(project.nodes.map((node) => [node.id, node])));
const incident = (project: ProjectModel, nodeId: string) => project.members.filter((member) => member.i === nodeId || member.j === nodeId);

describe('snaps sobre barras curvas', () => {
  it('el punto medio de un arco es su clave y el nudo que cae ahí queda conectado', () => {
    const project = arch();
    const [midpoint] = buildMidpointSnapCandidates(segmentsOf(project));
    expect(midpoint!.x).toBeCloseTo(1, 12);
    expect(midpoint!.y).toBeCloseTo(1, 12);
    const { nodeId } = ensureNodeAtPoint(project, midpoint!);
    expect(project.members).toHaveLength(2);
    expect(incident(project, nodeId).map((member) => member.id).sort()).toEqual(project.members.map((member) => member.id).sort());
    expect(project.members.every((member) => member.curve)).toBe(true);
  });

  it('el cruce con una recta se toma sobre el arco y une las dos barras en un nudo', () => {
    const project = arch({
      nodes: [{ id: 'P', x: 0.5, y: -0.5, support: { type: 'none' } }, { id: 'Q', x: 0.5, y: 2, support: { type: 'none' } }],
      members: [{ id: 'R', i: 'P', j: 'Q', ...frame }],
    });
    const crossings = buildIntersectionSnapCandidates(segmentsOf(project));
    expect(crossings).toHaveLength(1);
    expect(crossings[0]!.x).toBeCloseTo(0.5, 12);
    expect(crossings[0]!.y).toBeCloseTo(Math.sqrt(0.75), 12);
    expect(crossings[0]!.sourceIds).toEqual(['A', 'R']);
    const { nodeId } = ensureNodeAtPoint(project, crossings[0]!);
    expect(project.members).toHaveLength(4);
    expect(incident(project, nodeId)).toHaveLength(4);
  });

  it('dos arcos se cortan sobre sus curvas, no sobre sus cuerdas colineales', () => {
    const project = arch({
      nodes: [{ id: 'N3', x: 3, y: 0, support: { type: 'pin' } }],
      members: [{ id: 'B', i: 'N1', j: 'N3', ...frame, curve: { kind: 'circular-arc', bulge: 1 } }],
    });
    // Sus cuerdas se solapan, pero los arcos sólo se tocan (tangentes) en el
    // nudo común N1: un extremo no es un cruce.
    const crossings = buildIntersectionSnapCandidates(segmentsOf(project));
    expect(crossings).toHaveLength(0);
    const offset = arch({
      nodes: [{ id: 'N3', x: 1, y: 0, support: { type: 'none' } }, { id: 'N4', x: 3, y: 0, support: { type: 'none' } }],
      members: [{ id: 'B', i: 'N3', j: 'N4', ...frame, curve: { kind: 'circular-arc', bulge: 1 } }],
    });
    const [crossing, ...rest] = buildIntersectionSnapCandidates(segmentsOf(offset));
    expect(rest).toHaveLength(0);
    expect(crossing!.x).toBeCloseTo(1.5, 12);
    expect(crossing!.y).toBeCloseTo(Math.sqrt(0.75), 12);
  });

  it('la perpendicular a un arco sigue el radio y sólo ofrece pies sobre el barrido', () => {
    const segments = segmentsOf(arch());
    const above = buildPerpendicularSnapCandidates({ x: 1, y: 3 }, segments);
    expect(above).toHaveLength(1);
    expect(above[0]!.x).toBeCloseTo(1, 12);
    expect(above[0]!.y).toBeCloseTo(1, 12);
    const side = buildPerpendicularSnapCandidates({ x: 3, y: 2 }, segments);
    expect(side).toHaveLength(1);
    expect(Math.hypot(side[0]!.x - 1, side[0]!.y)).toBeCloseTo(1, 12);
    expect(side[0]!.y / (side[0]!.x - 1)).toBeCloseTo(1, 12);
  });

  it('no ofrece snaps sobre una curva con zonas rígidas: dividirla no está verificado', () => {
    const project = arch();
    project.members[0] = { ...project.members[0]!, rigidOffsetI: 0.1 };
    expect(segmentsOf(project)).toEqual([]);
  });
});
