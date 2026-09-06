import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import type { ProjectModel } from '../../types';
import { splitDistributedLoadAcrossChain, straightMemberChain } from './memberLoadChain';

const projectWithStraightRun = (): ProjectModel => {
  const project = createDefaultProject();
  return {
    ...project,
    nodes: [
      { id: 'N1', x: 0, y: 0, support: { type: 'none' } },
      { id: 'N2', x: 4, y: 0, support: { type: 'none' } },
      { id: 'N3', x: 9, y: 0, support: { type: 'none' } },
      { id: 'N4', x: 9, y: 3, support: { type: 'none' } },
    ],
    members: [
      { id: 'M1', i: 'N1', j: 'N2', type: 'frame', E: 20000000, A: .02, I: .0001 },
      { id: 'M2', i: 'N2', j: 'N3', type: 'frame', E: 20000000, A: .02, I: .0001 },
      { id: 'M3', i: 'N3', j: 'N4', type: 'frame', E: 20000000, A: .02, I: .0001 },
    ],
    memberLoads: [{ id: 'ML1', memberId: 'M1', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qyStart: -10, qyEnd: -30 }],
  };
};

describe('cadena recta de cargas', () => {
  it('continúa por miembros colineales y se detiene en el cambio de dirección', () => {
    const chain = straightMemberChain(projectWithStraightRun(), 'M1');
    expect(chain.map((item) => item.member.id)).toEqual(['M1', 'M2']);
    expect(chain.at(-1)?.pathEnd).toBeCloseTo(9);
  });

  it('divide una carga lineal en tramos equivalentes sobre la cadena', () => {
    const next = splitDistributedLoadAcrossChain(projectWithStraightRun(), 'ML1');
    expect(next.memberLoads).toHaveLength(2);
    expect(next.memberLoads.map((load) => load.memberId)).toEqual(['M1', 'M2']);
    expect(next.memberLoads[0].qyStart).toBeCloseTo(-10);
    expect(next.memberLoads[1].qyEnd).toBeCloseTo(-30);
  });
});
