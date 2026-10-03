import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { evaluateDeformationAt, evaluateDiagramAt } from '../../engine/diagram';
import { analyzeProject } from '../../engine/solver';
import type { MemberLoad, NodalLoad, ProjectModel } from '../../types';
import { analyzeFrame, memberActionAt, type FrameLoadCase, type FrameModel } from './frameAnalysis';

/** Pórtico de dos claros y dos niveles, con columnas más rígidas arriba que abajo, apoyo empotrado y articulado. */
const E = 25e6;
const model: FrameModel = {
  nodes: [
    { x: 0, y: 0, restraint: [true, true, true] }, { x: 5, y: 0, restraint: [true, true, false] }, { x: 9, y: 0, restraint: [true, true, true] },
    { x: 0, y: 3.5, restraint: [false, false, false] }, { x: 5, y: 3.5, restraint: [false, false, false] }, { x: 9, y: 3.5, restraint: [false, false, false] },
    { x: 0, y: 6.5, restraint: [false, false, false] }, { x: 5, y: 6.5, restraint: [false, false, false] }, { x: 9, y: 6.5, restraint: [false, false, false] },
  ],
  members: [
    // Columnas (de abajo hacia arriba).
    ...[[0, 3], [1, 4], [2, 5]].map(([i, j]) => ({ i: i!, j: j!, elasticModulusKpa: E, areaM2: 0.16, inertiaM4: 0.4 ** 4 / 12 })),
    ...[[3, 6], [4, 7], [5, 8]].map(([i, j]) => ({ i: i!, j: j!, elasticModulusKpa: E, areaM2: 0.12, inertiaM4: 0.3 * 0.4 ** 3 / 12 })),
    // Vigas (de izquierda a derecha).
    ...[[3, 4], [4, 5], [6, 7], [7, 8]].map(([i, j]) => ({ i: i!, j: j!, elasticModulusKpa: E, areaM2: 0.125, inertiaM4: 0.25 * 0.5 ** 3 / 12 })),
  ],
};
const cases: FrameLoadCase[] = [
  { id: 'D', gravity: { 6: 18, 7: 12, 8: 9, 9: 15, 0: 3.84, 1: 3.84, 2: 3.84, 3: 2.88 } },
  { id: 'L', gravity: { 7: 10 } },
  { id: 'E', nodal: [{ node: 3, fx: 20, fy: 0 }, { node: 6, fx: 35, fy: 0 }] },
];

function engineProject(caseId: string): ProjectModel {
  const base = createDefaultProject();
  const loadCase = cases.find((item) => item.id === caseId)!;
  const memberLoads: MemberLoad[] = Object.entries(loadCase.gravity ?? {}).map(([member, w]) => ({
    id: `q${member}`, memberId: `M${member}`, caseId, type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qyStart: -w, qyEnd: -w,
  }));
  const nodalLoads: NodalLoad[] = (loadCase.nodal ?? []).map((item, index) => ({ id: `n${index}`, nodeId: `N${item.node}`, caseId, fx: item.fx, fy: item.fy, mz: 0 }));
  return {
    ...base,
    nodes: model.nodes.map((node, index) => ({
      id: `N${index}`, x: node.x, y: node.y,
      support: node.restraint.every(Boolean) ? { type: 'fixed' } : node.restraint[0] && node.restraint[1] ? { type: 'pin' } : { type: 'none' },
    })),
    members: model.members.map((member, index) => ({ id: `M${index}`, i: `N${member.i}`, j: `N${member.j}`, type: 'frame', E: member.elasticModulusKpa, A: member.areaM2, I: member.inertiaM4 })),
    loadCases: [{ id: caseId, name: caseId, category: 'permanent', active: true, selfWeightFactor: 0 }],
    combinations: [], prescribedDisplacements: [], memberInitialEffects: [], nodeLinks: [], multiPointConstraints: [], generatedLoadSources: [], movingLoadCases: [], designAssignments: [],
    memberLoads,
    nodalLoads,
  };
}

describe('análisis de marco del taller', () => {
  const outcome = analyzeFrame(model, cases);
  if (!outcome.ok) throw new Error(outcome.error);
  const { analysis } = outcome;

  it.each(cases.map((item) => item.id))('reproduce el solver 2D en el caso %s', (caseId) => {
    const engine = analyzeProject(engineProject(caseId), { id: 'c', name: 'c', factors: { [caseId]: 1 } }, { includeEducationTrace: false });
    expect(engine.success).toBe(true);
    const ours = analysis.cases.find((item) => item.id === caseId)!;
    engine.memberResults.forEach((memberResult, index) => {
      const member = model.members[index]!;
      const length = analysis.geometry[index]!.lengthM;
      for (const x of [0, length * 0.37, length / 2, length]) {
        const reference = evaluateDiagramAt(memberResult.diagramSegments, memberResult.diagramJumps, x, x === 0 ? 'right' : 'left')!;
        const action = memberActionAt(member, length, ours.members[index]!, x);
        expect(action.axial).toBeCloseTo(reference.axial, 6);
        expect(action.shear).toBeCloseTo(reference.shear, 6);
        expect(action.moment).toBeCloseTo(reference.moment, 6);
        const deformation = evaluateDeformationAt(memberResult.deformationSegments, x)!;
        expect(action.v).toBeCloseTo(deformation.v, 9);
        expect(action.u).toBeCloseTo(deformation.u, 9);
      }
    });
    engine.nodeResults.forEach((node, index) => {
      expect(ours.nodeDisplacements[index]![0]).toBeCloseTo(node.ux, 10);
      expect(ours.nodeDisplacements[index]![1]).toBeCloseTo(node.uy, 10);
      expect(ours.nodeDisplacements[index]![2]).toBeCloseTo(node.rz, 10);
    });
  });

  it('equilibra la carga lateral con los cortantes de las columnas', () => {
    const lateral = analysis.cases.find((item) => item.id === 'E')!;
    const baseShear = [0, 1, 2].reduce((total, index) => total + memberActionAt(model.members[index]!, 3.5, lateral.members[index]!, 0).shear, 0);
    // En una columna que sube, y local apunta a −X: la base empuja hacia −X y el cortante sale positivo.
    expect(baseShear).toBeCloseTo(55, 8);
  });

  it('avisa de un marco inestable', () => {
    const unstable = analyzeFrame({ ...model, nodes: model.nodes.map((node) => ({ ...node, restraint: [false, node.y === 0, false] as const })) }, cases);
    expect(unstable.ok).toBe(false);
  });
});
