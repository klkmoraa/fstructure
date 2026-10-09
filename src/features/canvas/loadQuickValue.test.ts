import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import type { MemberLoad, ProjectModel as Project } from '../../types';
import { readLoadQuickValue, withLoadDirection, withLoadFlipped, withLoadMagnitude } from './loadQuickValue';

const base = (): Project => {
  const project = createDefaultProject();
  project.nodalLoads = [{ id: 'NL1', nodeId: 'N1', caseId: 'LC1', fx: 3, fy: -4, mz: 0 }];
  const member: Omit<MemberLoad, 'id' | 'type'> = { memberId: 'M1', caseId: 'LC1', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1 };
  project.memberLoads = [
    { ...member, id: 'ML1', type: 'distributed', qyStart: -10, qyEnd: -20 },
    { ...member, id: 'ML2', type: 'moment', moment: -15, position: 0.5 },
  ];
  return project;
};

describe('valor rápido de una carga', () => {
  it('lee la magnitud y la dirección de una fuerza nodal inclinada', () => {
    const value = readLoadQuickValue(base(), { kind: 'nodalLoad', id: 'NL1' });
    expect(value?.quantity).toBe('force');
    expect(value?.magnitude).toBeCloseTo(5, 12);
    expect(value?.direction).toBeCloseTo(Math.atan2(-4, 3) * 180 / Math.PI, 12);
  });

  it('cambia la magnitud y conserva la dirección (3-4-5 → 10)', () => {
    const project = withLoadMagnitude(base(), { kind: 'nodalLoad', id: 'NL1' }, 10);
    expect(project.nodalLoads[0].fx).toBeCloseTo(6, 12);
    expect(project.nodalLoads[0].fy).toBeCloseTo(-8, 12);
  });

  it('una distribuida trapecial conserva su forma: el extremo mayor toma el valor', () => {
    const project = withLoadMagnitude(base(), { kind: 'memberLoad', id: 'ML1' }, 30);
    const load = project.memberLoads[0];
    expect(load.qyStart).toBeCloseTo(-15, 12);
    expect(load.qyEnd).toBeCloseTo(-30, 12);
  });

  it('invertir cambia el sentido sin tocar la magnitud', () => {
    const project = withLoadFlipped(base(), { kind: 'memberLoad', id: 'ML2' });
    expect(project.memberLoads[1].moment).toBe(15);
    expect(readLoadQuickValue(project, { kind: 'memberLoad', id: 'ML2' })).toMatchObject({ quantity: 'moment', magnitude: 15, direction: 1 });
  });

  it('una magnitud escrita con signo se toma en valor absoluto: el sentido lo da invertir', () => {
    const project = withLoadMagnitude(base(), { kind: 'memberLoad', id: 'ML2' }, -7);
    expect(project.memberLoads[1].moment).toBe(-7);
  });

  it('apuntar a la derecha vuelve horizontal una carga vertical sin cambiar su magnitud', () => {
    const project = withLoadDirection(base(), { kind: 'nodalLoad', id: 'NL1' }, 0);
    expect(project.nodalLoads[0].fx).toBeCloseTo(5, 12);
    expect(project.nodalLoads[0].fy).toBeCloseTo(0, 12);
  });

  it('una distribuida horizontal conserva la forma trapecial', () => {
    const project = withLoadDirection(base(), { kind: 'memberLoad', id: 'ML1' }, 180);
    const load = project.memberLoads[0];
    expect(load.qxStart).toBeCloseTo(-10, 12);
    expect(load.qxEnd).toBeCloseTo(-20, 12);
    expect(load.qyStart).toBeCloseTo(0, 12);
  });
});
