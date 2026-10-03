import type { LoadCase, LoadCombination, MemberLoad, MemberModel, NodalLoad, NodeModel, ProjectModel } from '../types';
import { standardMaterials } from './standardMaterials';
import { standardSections } from './standardSections';

/**
 * Pórtico plano de concreto escrito en el Modelo 2D: geometría, secciones,
 * material, casos separados (muerta, viva y, si hay, sismo), sus cargas y unas
 * combinaciones editables. Es el pórtico paramétrico del modo Diseño llevado al
 * modelo, y la plantilla «Pórtico de concreto». Unidades internas: m, kN.
 */
export interface ConcreteFrameSpec {
  /** Claros entre ejes, de izquierda a derecha (m). */
  readonly bays: readonly number[];
  /** Niveles de abajo hacia arriba: altura (m), cargas de servicio sobre las vigas (kN/m) y fuerza lateral del nivel (kN). */
  readonly stories: readonly { readonly heightM: number; readonly deadKnPerM: number; readonly liveKnPerM: number; readonly lateralKn: number }[];
  readonly base: 'fixed' | 'pinned';
  readonly beam: { readonly widthMm: number; readonly heightMm: number };
  readonly column: { readonly widthMm: number; readonly heightMm: number };
  readonly fcMpa: number;
  /** Módulo de elasticidad del concreto (kN/m²) cuando f′c no está en el catálogo. */
  readonly elasticModulusKpa: number;
  readonly includeSelfWeight: boolean;
}

type FrameParts = Pick<ProjectModel, 'nodes' | 'members' | 'loadCases' | 'combinations' | 'nodalLoads' | 'memberLoads'>;

const CONCRETE_DENSITY = 2400;

export function concreteFrameModel(spec: ConcreteFrameSpec): FrameParts {
  const xs = spec.bays.reduce<number[]>((positions, bay) => [...positions, positions[positions.length - 1]! + bay], [0]);
  const ys = spec.stories.reduce<number[]>((levels, story) => [...levels, levels[levels.length - 1]! + story.heightM], [0]);
  const catalog = standardMaterials.find((material) => material.category === 'CONCRETE' && Math.abs(material.yieldStrength / 1e3 - spec.fcMpa) < 0.5);
  const material = catalog
    ? { materialId: catalog.id, materialOrigin: 'catalog' as const, E: catalog.elasticModulus, G: catalog.shearModulus, density: catalog.density }
    : { materialOrigin: 'custom' as const, E: spec.elasticModulusKpa, G: spec.elasticModulusKpa / 2.4, density: CONCRETE_DENSITY };
  const sectionOf = ({ widthMm, heightMm }: { widthMm: number; heightMm: number }) => {
    const width = widthMm / 1e3;
    const depth = heightMm / 1e3;
    const match = standardSections.find((section) => section.id.startsWith('rect-concrete-') && Math.abs(section.width - width) < 1e-6 && Math.abs(section.depth - depth) < 1e-6);
    return {
      ...(match ? { sectionId: match.id, sectionOrigin: 'catalog' as const } : { sectionOrigin: 'custom' as const }),
      A: width * depth,
      I: width * depth ** 3 / 12,
    };
  };
  const beam = sectionOf(spec.beam);
  const column = sectionOf(spec.column);
  const nodeId = (axis: number, level: number) => `N${axis + 1}${level}`;
  const nodes: NodeModel[] = ys.flatMap((y, level) => xs.map((x, axis) => ({
    id: nodeId(axis, level), x, y,
    support: level > 0 ? { type: 'none' as const } : spec.base === 'pinned' ? { type: 'pin' as const } : { type: 'fixed' as const },
  })));
  const member = (id: string, i: string, j: string, section: typeof beam): MemberModel => ({ id, i, j, type: 'frame', ...material, ...section });
  const levels = spec.stories.map((_, index) => index + 1);
  const members: MemberModel[] = [
    ...levels.flatMap((level) => xs.map((_, axis) => member(`C${axis + 1}${level}`, nodeId(axis, level - 1), nodeId(axis, level), column))),
    ...levels.flatMap((level) => spec.bays.map((_, bay) => member(`V${bay + 1}${level}`, nodeId(bay, level), nodeId(bay + 1, level), beam))),
  ];
  const uniform = (memberId: string, caseId: string, q: number): MemberLoad => ({
    id: `${caseId}-${memberId}`, memberId, caseId, type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1,
    qxStart: 0, qxEnd: 0, qyStart: -q, qyEnd: -q,
  });
  const lateral = spec.stories.some((story) => story.lateralKn > 0);
  const loadCases: LoadCase[] = [
    { id: 'CM', name: 'Carga muerta', category: 'permanent', active: true, selfWeightFactor: spec.includeSelfWeight ? 1 : 0 },
    { id: 'CV', name: 'Carga viva', category: 'variable', active: true, selfWeightFactor: 0 },
    ...(lateral ? [{ id: 'S', name: 'Sismo', category: 'accidental' as const, active: true, selfWeightFactor: 0 }] : []),
  ];
  const combinations: LoadCombination[] = [
    { id: 'SERV', name: 'Servicio', factors: { CM: 1, CV: 1 } },
    { id: 'U1', name: '1.2 CM + 1.6 CV', factors: { CM: 1.2, CV: 1.6 } },
    ...(lateral ? [{ id: 'U2', name: '1.2 CM + 1.0 CV + 1.0 S', factors: { CM: 1.2, CV: 1, S: 1 } }] : []),
  ];
  const memberLoads = levels.flatMap((level) => spec.bays.flatMap((_, bay) => {
    const story = spec.stories[level - 1]!;
    return [
      ...(story.deadKnPerM ? [uniform(`V${bay + 1}${level}`, 'CM', story.deadKnPerM)] : []),
      ...(story.liveKnPerM ? [uniform(`V${bay + 1}${level}`, 'CV', story.liveKnPerM)] : []),
    ];
  }));
  // La fuerza lateral de cada nivel se reparte por igual entre sus nudos.
  const nodalLoads: NodalLoad[] = lateral ? levels.flatMap((level) => {
    const force = spec.stories[level - 1]!.lateralKn / xs.length;
    return force ? xs.map((_, axis) => ({ id: `S-${nodeId(axis, level)}`, nodeId: nodeId(axis, level), caseId: 'S', fx: force, fy: 0, mz: 0 })) : [];
  }) : [];
  return { nodes, members, loadCases, combinations, nodalLoads, memberLoads };
}

/**
 * El proyecto con su modelo reemplazado por el pórtico. Conserva identidad,
 * nombre y ajustes; lo que dependía de las barras anteriores (desplazamientos
 * impuestos, enlaces, masas, cargas generadas, asignaciones) se vacía porque ya
 * no tendría a qué referirse. Quien lo aplica lo hace como un cambio deshacible.
 */
export const withConcreteFrame = (project: ProjectModel, spec: ConcreteFrameSpec): ProjectModel => ({
  ...project,
  ...concreteFrameModel(spec),
  prescribedDisplacements: [],
  memberInitialEffects: [],
  nodeLinks: [],
  multiPointConstraints: [],
  nodalMasses: [],
  generatedLoadSources: [],
  movingLoadCases: [],
  designAssignments: [],
});
