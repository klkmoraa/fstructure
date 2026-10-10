import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../../data/defaultProject';
import type { ProjectModel } from '../../types';
import { analyzeModel2dSupport, analyzeModel2dTarget, model2dResultInventory } from './model2dResultSnapshot';

function beamProject(): ProjectModel {
  const project = createBlankProject();
  project.id = 'beam-5m'; project.name = 'Viga L5';
  project.nodes = [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 5, y: 0, support: { type: 'roller' } },
  ];
  project.members = [{ id: 'M1', i: 'A', j: 'B', type: 'frame', E: 25e6, A: 0.06, I: 0.00045, label: 'Viga L5' }];
  project.loadCases = [
    { id: 'D', name: 'Servicio', category: 'permanent', active: true, selfWeightFactor: 0 },
    { id: 'L', name: 'Viva', category: 'variable', active: true, selfWeightFactor: 0 },
  ];
  project.memberLoads = [
    { id: 'q', memberId: 'M1', caseId: 'D', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 0.2, qyStart: -4, qyEnd: -4 },
    { id: 'P', memberId: 'M1', caseId: 'L', type: 'point', coordinateSystem: 'local', lengthBasis: 'real', start: 0.6, end: 0.6, position: 0.6, py: -10 },
  ];
  project.combinations = [
    { id: 'SERV', name: 'Servicio', factors: { D: 1, L: 1 } },
    { id: 'ULT', name: 'Ultimate', factors: { D: 1.3, L: 1.5 } },
  ];
  return project;
}

describe('modelo 2D: inventario y demanda nativa', () => {
  it('resuelve un objetivo con vector simultáneo, factores exactos y saltos por lado', () => {
    const project = beamProject();
    const inventory = model2dResultInventory(project);
    expect(inventory.targets).toEqual([
      { id: 'D', label: 'Servicio', kind: 'case', factors: [{ caseId: 'D', factor: 1 }] },
      { id: 'L', label: 'Viva', kind: 'case', factors: [{ caseId: 'L', factor: 1 }] },
      { id: 'SERV', label: 'Servicio', kind: 'combination', factors: [{ caseId: 'D', factor: 1 }, { caseId: 'L', factor: 1 }] },
      { id: 'ULT', label: 'Ultimate', kind: 'combination', factors: [{ caseId: 'D', factor: 1.3 }, { caseId: 'L', factor: 1.5 }] },
    ]);
    const service = analyzeModel2dTarget(project, inventory, { memberId: 'M1', targetId: 'SERV', xM: 3, side: 'right' });
    const ultimate = analyzeModel2dTarget(project, inventory, { memberId: 'M1', targetId: 'ULT', xM: 3, side: 'right' });
    expect(service.actions.nKn).toBeCloseTo(0, 10);
    expect(service.actions.mzKnm).toBeCloseTo(12.8, 8);
    expect(ultimate.actions.vyKn).toBeCloseTo(-9.52, 8);
    expect(ultimate.actions.mzKnm).toBeCloseTo(19.04, 8);
    expect(ultimate.target.factors).toEqual([{ caseId: 'D', factor: 1.3 }, { caseId: 'L', factor: 1.5 }]);
    const left = analyzeModel2dTarget(project, inventory, { memberId: 'M1', targetId: 'L', xM: 3, side: 'left' });
    const right = analyzeModel2dTarget(project, inventory, { memberId: 'M1', targetId: 'L', xM: 3, side: 'right' });
    expect(right.actions.vyKn - left.actions.vyKn).toBeCloseTo(-10, 8);
    expect(right.actions.mzKnm).toBeCloseTo(left.actions.mzKnm, 8);
  });

  it('conserva reacciones globales de un objetivo y rechaza entidad u objetivo inexistente y estaciones fuera de rango', () => {
    const project = beamProject();
    const inventory = model2dResultInventory(project);
    const support = analyzeModel2dSupport(project, inventory, { nodeId: 'A', targetId: 'SERV' });
    expect(support.reactionGlobal.fyKn).toBeCloseTo(7.6, 7);
    expect(analyzeModel2dSupport(project, inventory, { nodeId: 'A', targetId: 'ULT' }).reactionGlobal.fyKn).toBeCloseTo(10.68, 7);
    expect(() => analyzeModel2dTarget(project, inventory, { memberId: 'missing', targetId: 'D', xM: 1, side: 'right' })).toThrow(/barra/);
    expect(() => analyzeModel2dTarget(project, inventory, { memberId: 'M1', targetId: 'missing', xM: 1, side: 'right' })).toThrow(/objetivo/);
    expect(() => analyzeModel2dTarget(project, inventory, { memberId: 'M1', targetId: 'D', xM: 5.1, side: 'right' })).toThrow(/fuera/);
  });

  it('la revisión cambia con la geometría, el caso o la carga', () => {
    const project = beamProject();
    const first = model2dResultInventory(project).revision;
    project.memberLoads[0]!.qyStart = -5;
    expect(model2dResultInventory(project).revision).not.toBe(first);
  });

  it('declara método nativo de primer orden o P-Delta y mantiene el texto de ejes acotado', () => {
    const project = beamProject();
    const inventory = model2dResultInventory(project);
    const firstOrder = analyzeModel2dTarget(project, inventory, { memberId: 'M1', targetId: 'SERV', xM: 2, side: 'right' });
    expect(firstOrder.axes.convention).toContain('primer orden nativo');
    project.settings = { ...project.settings, analysisMode: 'p-delta' };
    const secondOrder = analyzeModel2dTarget(project, model2dResultInventory(project), { memberId: 'M1', targetId: 'SERV', xM: 2, side: 'right' });
    expect(secondOrder.axes.convention).toContain('P-Δ nativo');
    expect(secondOrder.axes.convention.length).toBeLessThanOrEqual(256);
  });
});
