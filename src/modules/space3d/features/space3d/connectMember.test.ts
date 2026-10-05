import { describe, expect, it } from 'vitest';
import { analyzeSpace3DModal } from '../../space3d/engine/analysisModes';
import { generateSpace3DFrame } from '../../space3d/engine/space3dGenerative';
import type { Space3DProjectV1 } from '../../space3d/model/types';
import { buildConnectingMember, nextSpace3DMemberId } from './connectMember';

const baseProject = (): Space3DProjectV1 => generateSpace3DFrame({
  baysX: 1, bayWidthX: 4, storiesY: 1, storyHeightY: 3, baysZ: 1, bayDepthZ: 4,
});

/** Proyecto cuya primera barra declara catálogo completo y densidad. */
const catalogProject = (): Space3DProjectV1 => {
  const project = baseProject();
  const [first, ...rest] = project.members;
  return {
    ...project,
    members: [
      {
        ...first,
        density: 7850,
        materialId: 'steel-a36',
        materialOrigin: 'catalog',
        sectionId: 'IPE 300',
        sectionOrigin: 'catalog',
      },
      ...rest,
    ],
  };
};

describe('buildConnectingMember', () => {
  it('carries density and provenance from the reference member', () => {
    const project = catalogProject();
    const member = buildConnectingMember(project, project.nodes[0], project.nodes[3]);

    expect(member.density).toBe(7850);
    expect(member.materialId).toBe('steel-a36');
    expect(member.materialOrigin).toBe('catalog');
    expect(member.sectionId).toBe('IPE 300');
    expect(member.sectionOrigin).toBe('catalog');
    // La rigidez sigue viniendo de la misma referencia.
    expect(member.E).toBe(project.members[0].E);
    expect(member.A).toBe(project.members[0].A);
  });

  // El ensamblaje de masa omite las barras sin densidad: copiar sólo la
  // rigidez dejaba la barra nueva sin peso en el análisis modal.
  it('adds mass to the modal study once it is in the project', () => {
    const project = catalogProject();
    const member = buildConnectingMember(project, project.nodes[0], project.nodes[3]);
    const connected: Space3DProjectV1 = { ...project, members: [...project.members, member] };

    const before = analyzeSpace3DModal(project);
    const after = analyzeSpace3DModal(connected);

    expect(before.totalMass).toBeGreaterThan(0);
    expect(after.totalMass).toBeGreaterThan(before.totalMass);

    // Una barra sin densidad no habría pesado nada.
    const { density: _dropped, ...weightless } = member;
    const withoutDensity: Space3DProjectV1 = {
      ...project,
      members: [...project.members, weightless],
    };
    expect(analyzeSpace3DModal(withoutDensity).totalMass).toBeCloseTo(before.totalMass, 9);
  });

  it('omits fields the reference member does not declare', () => {
    const project = baseProject();
    expect(project.members[0].sectionId).toBeUndefined();

    const member = buildConnectingMember(project, project.nodes[0], project.nodes[3]);
    expect('sectionId' in member).toBe(false);
    expect('materialOrigin' in member).toBe(false);
  });

  it('never reuses an existing member id', () => {
    const project = baseProject();
    const taken = new Set(project.members.map((item) => item.id));
    expect(taken.has(nextSpace3DMemberId(project.members))).toBe(false);
  });
});
