import type { LoadCase, LoadCombination, MemberLoad, MemberModel, NodalLoad, NodeModel, ProjectModel } from '../types';
import { concreteFrameModel } from './concreteFrame';
import { standardMaterials } from './standardMaterials';
import { standardSections } from './standardSections';

/**
 * Inicios del Modelo 2D vacío: estructuras pequeñas y completas (apoyos,
 * secciones de catálogo, casos de carga muerta y viva y combinaciones) que se
 * calculan al instante y se editan después. Son hipótesis para empezar, no un
 * ejemplo de libro. Unidades internas: m, kN.
 */
export type ModelStartId = 'beam-simple' | 'beam-cantilever' | 'beam-continuous' | 'frame-portal' | 'truss-pratt';

type ModelParts = Pick<ProjectModel, 'nodes' | 'members' | 'loadCases' | 'combinations' | 'nodalLoads' | 'memberLoads'>;

const catalogMember = (sectionId: string, materialId: string) => {
  const section = standardSections.find((item) => item.id === sectionId)!;
  const material = standardMaterials.find((item) => item.id === materialId)!;
  return {
    sectionId, sectionOrigin: 'catalog' as const, materialId, materialOrigin: 'catalog' as const,
    E: material.elasticModulus, G: material.shearModulus, density: material.density, A: section.area, I: section.inertiaX,
  };
};

const BEAM = catalogMember('rect-concrete-300x500', 'concrete-28mpa');
const TRUSS_BAR = catalogMember('hss4x4x1-4', 'steel-a500-grade-b');

const LOAD_CASES = (selfWeight: boolean): LoadCase[] => [
  { id: 'CM', name: 'Carga muerta', category: 'permanent', active: true, selfWeightFactor: selfWeight ? 1 : 0 },
  { id: 'CV', name: 'Carga viva', category: 'variable', active: true, selfWeightFactor: 0 },
];
const COMBINATIONS: LoadCombination[] = [
  { id: 'SERV', name: 'Servicio', factors: { CM: 1, CV: 1 } },
  { id: 'U1', name: '1.3 CM + 1.5 CV', factors: { CM: 1.3, CV: 1.5 } },
];

const uniform = (memberId: string, caseId: string, q: number): MemberLoad => ({
  id: `${caseId}-${memberId}`, memberId, caseId, type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1,
  qxStart: 0, qxEnd: 0, qyStart: -q, qyEnd: -q,
});
const nodal = (nodeId: string, caseId: string, fy: number): NodalLoad => ({ id: `${caseId}-${nodeId}`, nodeId, caseId, fx: 0, fy: -fy, mz: 0 });

/** Viga de concreto 30 × 50 sobre los apoyos dados, con muerta y viva uniformes en cada claro. */
const beamParts = (spans: readonly number[], supports: readonly NodeModel['support'][], dead: number, live: number): ModelParts => {
  const xs = spans.reduce<number[]>((positions, span) => [...positions, positions[positions.length - 1]! + span], [0]);
  const nodes: NodeModel[] = xs.map((x, index) => ({ id: `N${index + 1}`, x, y: 0, support: supports[index] ?? { type: 'none' } }));
  const members: MemberModel[] = spans.map((_, index) => ({ id: `V${index + 1}`, i: `N${index + 1}`, j: `N${index + 2}`, type: 'frame', ...BEAM }));
  return {
    nodes, members, loadCases: LOAD_CASES(true), combinations: COMBINATIONS, nodalLoads: [],
    memberLoads: members.flatMap((member) => [uniform(member.id, 'CM', dead), uniform(member.id, 'CV', live)]),
  };
};

/** Armadura Pratt de cuatro tableros de 2 m y 2 m de peralte, con cargas en los nudos superiores. */
const prattParts = (): ModelParts => {
  const bottom = [0, 2, 4, 6, 8];
  const nodes: NodeModel[] = [
    ...bottom.map((x, index): NodeModel => ({
      id: `B${index}`, x, y: 0,
      support: index === 0 ? { type: 'pin' } : index === bottom.length - 1 ? { type: 'roller', angleDeg: 90 } : { type: 'none' },
    })),
    ...[1, 2, 3].map((index): NodeModel => ({ id: `T${index}`, x: bottom[index]!, y: 2, support: { type: 'none' } })),
  ];
  const bar = (id: string, i: string, j: string): MemberModel => ({ id, i, j, type: 'truss', ...TRUSS_BAR, I: 0 });
  const members: MemberModel[] = [
    bar('CI1', 'B0', 'B1'), bar('CI2', 'B1', 'B2'), bar('CI3', 'B2', 'B3'), bar('CI4', 'B3', 'B4'),
    bar('CS1', 'T1', 'T2'), bar('CS2', 'T2', 'T3'),
    bar('D1', 'B0', 'T1'), bar('D2', 'T1', 'B2'), bar('D3', 'T3', 'B2'), bar('D4', 'T3', 'B4'),
    bar('M1', 'B1', 'T1'), bar('M2', 'B2', 'T2'), bar('M3', 'B3', 'T3'),
  ];
  const top = ['T1', 'T2', 'T3'];
  return {
    nodes, members, loadCases: LOAD_CASES(false), combinations: COMBINATIONS, memberLoads: [],
    nodalLoads: [...top.map((id) => nodal(id, 'CM', 10)), ...top.map((id) => nodal(id, 'CV', 6))],
  };
};

/** Orden en que el Modelo 2D vacío ofrece los inicios. */
export const MODEL_STARTS: readonly ModelStartId[] = ['beam-simple', 'beam-cantilever', 'beam-continuous', 'frame-portal', 'truss-pratt'];

const partsFor = (id: ModelStartId): ModelParts => {
  switch (id) {
    case 'beam-simple': return beamParts([6], [{ type: 'pin' }, { type: 'roller', angleDeg: 90 }], 15, 8);
    case 'beam-cantilever': return beamParts([3], [{ type: 'fixed' }, { type: 'none' }], 12, 6);
    case 'beam-continuous': return beamParts([5, 5], [{ type: 'pin' }, { type: 'roller', angleDeg: 90 }, { type: 'roller', angleDeg: 90 }], 15, 8);
    case 'truss-pratt': return prattParts();
    case 'frame-portal': return concreteFrameModel({
      bays: [6], stories: [{ heightM: 3.5, deadKnPerM: 15, liveKnPerM: 7, lateralKn: 30 }], base: 'fixed',
      beam: { widthMm: 300, heightMm: 500 }, column: { widthMm: 400, heightMm: 400 }, fcMpa: 28, elasticModulusKpa: 24870062.324, includeSelfWeight: true,
    });
  }
};

/**
 * El proyecto con el inicio escrito en su modelo. Sólo se aplica a un modelo
 * vacío: conserva identidad, nombre y ajustes, y lo que dependía de barras
 * (desplazamientos, enlaces, masas, cargas generadas) queda vacío.
 */
export const withModelStart = (project: ProjectModel, id: ModelStartId): ProjectModel => {
  if (project.nodes.length || project.members.length) return project;
  return {
    ...project,
    ...partsFor(id),
    prescribedDisplacements: [],
    memberInitialEffects: [],
    nodeLinks: [],
    multiPointConstraints: [],
    nodalMasses: [],
    generatedLoadSources: [],
    movingLoadCases: [],
    designAssignments: [],
  };
};
