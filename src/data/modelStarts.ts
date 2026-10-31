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
export type ModelStartId = 'beam-simple' | 'beam-cantilever' | 'beam-continuous' | 'frame-portal' | 'truss-pratt' | 'arch';

/**
 * Las pocas medidas que definen cada inicio. Todo lo demás (sección, material,
 * casos y combinaciones) se elige igual que antes y queda editable.
 * Longitudes en m, cargas repartidas en kN/m y cargas en nudos en kN.
 */
export interface ModelStartParams {
  /** Claro de cada tramo; en la armadura y el arco, el claro total. */
  readonly span: number;
  /** Claros (continua, pórtico) o tableros (armadura). */
  readonly count: number;
  /** Altura de entrepiso (pórtico), peralte (armadura) o flecha (arco). */
  readonly height: number;
  /** Niveles del pórtico. */
  readonly levels: number;
  readonly dead: number;
  readonly live: number;
  /** Fuerza lateral por nivel del pórtico. */
  readonly lateral: number;
}

export type ModelStartField = keyof ModelStartParams;
interface FieldRule { readonly min: number; readonly max: number; readonly integer?: boolean; readonly even?: boolean }

/** Medidas que pide cada inicio, en orden, con sus límites. */
export const MODEL_START_FIELDS: Readonly<Record<ModelStartId, readonly ModelStartField[]>> = {
  'beam-simple': ['span', 'dead', 'live'],
  'beam-cantilever': ['span', 'dead', 'live'],
  'beam-continuous': ['count', 'span', 'dead', 'live'],
  'frame-portal': ['count', 'span', 'levels', 'height', 'dead', 'live', 'lateral'],
  'truss-pratt': ['span', 'count', 'height', 'dead', 'live'],
  arch: ['span', 'height', 'dead', 'live'],
};

const RULES: Readonly<Record<ModelStartField, FieldRule>> = {
  span: { min: 0.5, max: 60 },
  count: { min: 1, max: 8, integer: true },
  height: { min: 0.3, max: 12 },
  levels: { min: 1, max: 10, integer: true },
  dead: { min: 0, max: 1000 },
  live: { min: 0, max: 1000 },
  lateral: { min: 0, max: 5000 },
};

export const MODEL_START_DEFAULTS: Readonly<Record<ModelStartId, ModelStartParams>> = {
  'beam-simple': { span: 6, count: 1, height: 0, levels: 1, dead: 15, live: 8, lateral: 0 },
  'beam-cantilever': { span: 3, count: 1, height: 0, levels: 1, dead: 12, live: 6, lateral: 0 },
  'beam-continuous': { span: 5, count: 2, height: 0, levels: 1, dead: 15, live: 8, lateral: 0 },
  'frame-portal': { span: 6, count: 1, height: 3.5, levels: 1, dead: 15, live: 7, lateral: 30 },
  'truss-pratt': { span: 8, count: 4, height: 2, levels: 1, dead: 10, live: 6, lateral: 0 },
  arch: { span: 10, count: 1, height: 3, levels: 1, dead: 15, live: 8, lateral: 0 },
};

/**
 * Motivo por el que una medida no sirve, o null. Las claves son de i18n:
 * `modelStart.error.range` (con {min} y {max}), `.integer`, `.even` y `.rise`.
 */
export const modelStartFieldError = (id: ModelStartId, field: ModelStartField, params: ModelStartParams): { key: 'range' | 'integer' | 'even' | 'rise'; min?: number; max?: number } | null => {
  const value = params[field];
  const rule = field === 'count' && id === 'truss-pratt' ? { min: 2, max: 16, integer: true, even: true } : RULES[field];
  if (!Number.isFinite(value) || value < rule.min || value > rule.max) return { key: 'range', min: rule.min, max: rule.max };
  if (rule.integer && !Number.isInteger(value)) return { key: 'integer' };
  if (rule.even && value % 2 !== 0) return { key: 'even' };
  // Un arco circular de un solo tramo llega hasta el semicírculo.
  if (id === 'arch' && field === 'height' && value > params.span / 2) return { key: 'rise', max: params.span / 2 };
  return null;
};

export const modelStartValid = (id: ModelStartId, params: ModelStartParams) =>
  MODEL_START_FIELDS[id].every((field) => modelStartFieldError(id, field, params) === null);

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

/**
 * Armadura Pratt de `panels` tableros (par) sobre el claro dado, con cargas en
 * los nudos superiores. Las diagonales bajan hacia el centro: trabajan a tensión.
 */
const prattParts = (span: number, panels: number, depth: number, dead: number, live: number): ModelParts => {
  const width = span / panels;
  const bottom = Array.from({ length: panels + 1 }, (_, index) => index * width);
  const nodes: NodeModel[] = [
    ...bottom.map((x, index): NodeModel => ({
      id: `B${index}`, x, y: 0,
      support: index === 0 ? { type: 'pin' } : index === panels ? { type: 'roller', angleDeg: 90 } : { type: 'none' },
    })),
    ...Array.from({ length: panels - 1 }, (_, k): NodeModel => ({ id: `T${k + 1}`, x: bottom[k + 1]!, y: depth, support: { type: 'none' } })),
  ];
  const bar = (id: string, i: string, j: string): MemberModel => ({ id, i, j, type: 'truss', ...TRUSS_BAR, I: 0 });
  const half = panels / 2;
  const members: MemberModel[] = [
    ...Array.from({ length: panels }, (_, k) => bar(`CI${k + 1}`, `B${k}`, `B${k + 1}`)),
    ...Array.from({ length: panels - 2 }, (_, k) => bar(`CS${k + 1}`, `T${k + 1}`, `T${k + 2}`)),
    bar('D1', 'B0', 'T1'),
    ...Array.from({ length: panels - 2 }, (_, k) => {
      const top = k + 1;
      return top < half ? bar(`D${k + 2}`, `T${top}`, `B${top + 1}`) : bar(`D${k + 2}`, `T${top + 1}`, `B${top}`);
    }),
    bar(`D${panels}`, `T${panels - 1}`, `B${panels}`),
    ...Array.from({ length: panels - 1 }, (_, k) => bar(`M${k + 1}`, `B${k + 1}`, `T${k + 1}`)),
  ];
  const top = Array.from({ length: panels - 1 }, (_, k) => `T${k + 1}`);
  return {
    nodes, members, loadCases: LOAD_CASES(false), combinations: COMBINATIONS, memberLoads: [],
    nodalLoads: [...top.map((id) => nodal(id, 'CM', dead)), ...top.map((id) => nodal(id, 'CV', live))],
  };
};

/** Arco circular de concreto 30 × 50 biarticulado (empuje en los dos apoyos), con carga vertical por metro de arco. */
const archParts = (span: number, rise: number, dead: number, live: number): ModelParts => {
  const nodes: NodeModel[] = [
    { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'N2', x: span, y: 0, support: { type: 'pin' } },
  ];
  const members: MemberModel[] = [{ id: 'A1', i: 'N1', j: 'N2', type: 'frame', ...BEAM, curve: { kind: 'circular-arc', bulge: 2 * rise / span } }];
  return {
    nodes, members, loadCases: LOAD_CASES(true), combinations: COMBINATIONS, nodalLoads: [],
    memberLoads: [uniform('A1', 'CM', dead), uniform('A1', 'CV', live)],
  };
};

/** Orden en que el Modelo 2D vacío ofrece los inicios. */
export const MODEL_STARTS: readonly ModelStartId[] = ['beam-simple', 'beam-cantilever', 'beam-continuous', 'frame-portal', 'truss-pratt', 'arch'];

const partsFor = (id: ModelStartId, p: ModelStartParams): ModelParts => {
  switch (id) {
    case 'beam-simple': return beamParts([p.span], [{ type: 'pin' }, { type: 'roller', angleDeg: 90 }], p.dead, p.live);
    case 'beam-cantilever': return beamParts([p.span], [{ type: 'fixed' }, { type: 'none' }], p.dead, p.live);
    case 'beam-continuous': return beamParts(Array.from({ length: p.count }, () => p.span),
      [{ type: 'pin' }, ...Array.from({ length: p.count }, () => ({ type: 'roller' as const, angleDeg: 90 }))], p.dead, p.live);
    case 'truss-pratt': return prattParts(p.span, p.count, p.height, p.dead, p.live);
    case 'arch': return archParts(p.span, p.height, p.dead, p.live);
    case 'frame-portal': return concreteFrameModel({
      bays: Array.from({ length: p.count }, () => p.span),
      stories: Array.from({ length: p.levels }, () => ({ heightM: p.height, deadKnPerM: p.dead, liveKnPerM: p.live, lateralKn: p.lateral })),
      base: 'fixed',
      beam: { widthMm: 300, heightMm: 500 }, column: { widthMm: 400, heightMm: 400 }, fcMpa: 28, elasticModulusKpa: 24870062.324, includeSelfWeight: true,
    });
  }
};

/** Las piezas del inicio, sin tocar un proyecto: sirven para la vista previa. */
export const modelStartParts = (id: ModelStartId, params: ModelStartParams = MODEL_START_DEFAULTS[id]) => partsFor(id, params);

/**
 * El proyecto con el inicio escrito en su modelo. Sólo se aplica a un modelo
 * vacío: conserva identidad, nombre y ajustes, y lo que dependía de barras
 * (desplazamientos, enlaces, masas, cargas generadas) queda vacío.
 */
export const withModelStart = (project: ProjectModel, id: ModelStartId, params: ModelStartParams = MODEL_START_DEFAULTS[id]): ProjectModel => {
  if (project.nodes.length || project.members.length) return project;
  if (!modelStartValid(id, params)) return project;
  return {
    ...project,
    ...partsFor(id, params),
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
