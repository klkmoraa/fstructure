import { standardSections } from '../data/standardSections';
import { withResolvedGeneratedLoads } from '../engine/generatedLoads';
import {
  SPACE3D_ANALYSIS_SPACE, SPACE3D_SCHEMA_VERSION,
  type Space3DFrameMember, type Space3DLoadCase, type Space3DMemberLoad, type Space3DNodalLoad, type Space3DNode,
  type Space3DProjectV1, type Space3DRestraints, type Space3DVector,
} from '../modules/space3d/space3d/model/types';
import { createSpace3DGrid } from '../modules/space3d/space3d/model/grid';
import type { MemberLoad, MemberModel, NodeModel, ProjectModel } from '../types';

/**
 * Puente declarado Modelo 2D → Modelo 3D (los dos modos de FStructure).
 *
 * «Traer del 2D» repite el pórtico plano del proyecto en `frames` pórticos
 * paralelos (planos z = constante, separados `spacingM`) y los une con vigas
 * transversales en cada nudo que no es apoyo. Copia secciones, materiales,
 * apoyos, casos, combinaciones y cargas; el modelo 2D no se modifica. Lo usa
 * sólo la mesa (`src/features/workspace`), como una acción explícita.
 *
 * Convenciones: el plano del 2D es el XY del 3D (Y arriba); en cada barra del
 * pórtico la inercia del 2D es la de flexión en el plano (`Iz`, eje local z
 * normal al plano). Las vigas usan la referencia Y y las columnas la X, así el
 * eje local y de toda barra del pórtico queda en su plano.
 */

export interface ExtrudeOptions {
  /** Pórticos paralelos (≥ 1). */
  readonly frames: number;
  /** Separación entre pórticos, m. */
  readonly spacingM: number;
  /** Un diafragma rígido por nivel (losa) cuando hay más de un pórtico. */
  readonly diaphragms?: boolean;
}

export interface Space3DFromModel2D {
  readonly model: Space3DProjectV1 | null;
  readonly errors: readonly string[];
  /** Lo que no se pudo traer y por qué. */
  readonly notes: readonly string[];
}

export const MAX_EXTRUDED_FRAMES = 12;

const vertical = (a: NodeModel, b: NodeModel) => Math.abs(b.x - a.x) <= 1e-9 * Math.max(1, Math.abs(b.y - a.y));

const restraintsOf = (node: NodeModel): Space3DRestraints => {
  const support = node.support;
  if (support.type === 'fixed') return { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true };
  if (support.type === 'pin') return { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false };
  if (support.type === 'roller') return { ux: false, uy: true, uz: true, rx: false, ry: false, rz: false };
  if (support.type === 'custom') {
    const translation = Boolean(support.restrainX || support.restrainY);
    return { ux: Boolean(support.restrainX), uy: Boolean(support.restrainY), uz: translation, rx: Boolean(support.restrainR), ry: Boolean(support.restrainR), rz: Boolean(support.restrainR) };
  }
  return { ux: false, uy: false, uz: false, rx: false, ry: false, rz: false };
};

/** b × h en el plano: la sección rectangular del catálogo o el rectángulo equivalente en A e I. */
const rectangleOf = (member: MemberModel) => {
  const catalog = member.sectionId ? standardSections.find((item) => item.id === member.sectionId) : undefined;
  if (catalog?.shapeType === 'RECT') return { width: catalog.width, depth: catalog.depth };
  const depth = Math.sqrt(12 * member.I / Math.max(member.A, 1e-12));
  return { width: member.A / Math.max(depth, 1e-12), depth };
};

/** Constante de torsión de St. Venant de un rectángulo (b ≤ h). */
const torsionOf = (width: number, depth: number) => {
  const b = Math.min(width, depth);
  const h = Math.max(width, depth);
  const ratio = b / h;
  return (1 / 3 - 0.21 * ratio * (1 - ratio ** 4 / 12)) * b ** 3 * h;
};

export function space3dFromModel2d(project: ProjectModel, options: ExtrudeOptions): Space3DFromModel2D {
  const errors: string[] = [];
  const notes: string[] = [];
  const frames = Math.round(options.frames);
  if (!project.members.length) errors.push('El Modelo 2D está vacío: dibuja el pórtico antes de traerlo al 3D.');
  if (!(frames >= 1 && frames <= MAX_EXTRUDED_FRAMES)) errors.push(`Los pórticos van de 1 a ${MAX_EXTRUDED_FRAMES}.`);
  if (frames > 1 && !(options.spacingM > 0)) errors.push('La separación entre pórticos debe ser mayor que cero.');
  if (errors.length) return { model: null, errors, notes };

  const resolved = withResolvedGeneratedLoads(project);
  const nodeById = new Map(project.nodes.map((node) => [node.id, node]));
  const zOf = (frame: number) => frame * (frames > 1 ? options.spacingM : 0);
  const nodeId = (id: string, frame: number) => frames === 1 ? id : `${id}-${frame + 1}`;
  const memberId = (id: string, frame: number) => frames === 1 ? id : `${id}-${frame + 1}`;

  // Un pórtico solo se trae plano: sin vigas transversales nada lo sostiene fuera
  // de su plano, así que sus nudos no se mueven en z ni giran fuera del plano.
  const planar = (restraints: Space3DRestraints): Space3DRestraints => frames === 1 ? { ...restraints, uz: true, rx: true, ry: true } : restraints;
  const nodes: Space3DNode[] = Array.from({ length: frames }, (_, frame) => project.nodes.map((node) => ({
    id: nodeId(node.id, frame), x: node.x, y: node.y, z: zOf(frame), restraints: planar(restraintsOf(node)),
  }))).flat();

  const propertiesOf = (member: MemberModel) => {
    const { width, depth } = rectangleOf(member);
    return {
      E: member.E,
      G: member.G ?? member.E / 2.4,
      A: member.A,
      Iz: member.I,
      Iy: depth * width ** 3 / 12,
      J: torsionOf(width, depth),
      ...(member.density ? { density: member.density } : {}),
    };
  };
  const orientationFor = (a: NodeModel, b: NodeModel) => ({
    localYReferenceGlobal: (vertical(a, b) ? [1, 0, 0] : [0, 1, 0]) as Space3DVector,
    rollRadians: 0,
  });
  const frameMembers: Space3DFrameMember[] = Array.from({ length: frames }, (_, frame) => project.members.map((member) => {
    const a = nodeById.get(member.i)!;
    const b = nodeById.get(member.j)!;
    return {
      id: memberId(member.id, frame), i: nodeId(member.i, frame), j: nodeId(member.j, frame),
      ...propertiesOf(member),
      orientation: orientationFor(a, b),
      type: member.type,
      ...(member.label ? { label: frames === 1 ? member.label : `${member.label} · P${frame + 1}` } : {}),
      ...(member.releases ? {
        releases: { iRz: member.releases.iMoment, jRz: member.releases.jMoment, iRy: member.releases.iMoment, jRy: member.releases.jMoment },
      } : {}),
    } satisfies Space3DFrameMember;
  })).flat();

  // Vigas transversales: en cada nudo que no es apoyo, con la sección más común de las vigas del pórtico.
  const beams = project.members.filter((member) => member.type === 'frame' && !vertical(nodeById.get(member.i)!, nodeById.get(member.j)!));
  const reference = beams[0] ?? project.members[0]!;
  const transverse: Space3DFrameMember[] = [];
  if (frames > 1) {
    const connected = project.nodes.filter((node) => node.support.type === 'none' && project.members.some((member) => member.i === node.id || member.j === node.id));
    for (let frame = 0; frame < frames - 1; frame += 1) {
      for (const node of connected) {
        transverse.push({
          id: `T${node.id}-${frame + 1}`, i: nodeId(node.id, frame), j: nodeId(node.id, frame + 1),
          ...propertiesOf(reference),
          orientation: { localYReferenceGlobal: [0, 1, 0], rollRadians: 0 },
          type: 'frame',
          label: `Transversal ${node.id} · P${frame + 1}–P${frame + 2}`,
        });
      }
    }
  }

  // Cargas: las locales del 2D se pasan a globales (la referencia local del 3D puede no coincidir).
  const toGlobal = (member: MemberModel, along: number, across: number): [number, number] => {
    const a = nodeById.get(member.i)!;
    const b = nodeById.get(member.j)!;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const cx = (b.x - a.x) / length;
    const cy = (b.y - a.y) / length;
    return [along * cx - across * cy, along * cy + across * cx];
  };
  const memberLoadsOf = (load: MemberLoad, frame: number): Space3DMemberLoad | null => {
    const member = project.members.find((item) => item.id === load.memberId);
    if (!member) return null;
    const base = { id: `${load.id}-${frame + 1}`, memberId: memberId(load.memberId, frame), caseId: load.caseId, start: load.start, end: load.end, lengthBasis: load.lengthBasis };
    const local = load.coordinateSystem === 'local';
    if (load.type === 'distributed') {
      const [qxStart, qyStart] = local ? toGlobal(member, load.qxStart ?? 0, load.qyStart ?? 0) : [load.qxStart ?? 0, load.qyStart ?? 0];
      const [qxEnd, qyEnd] = local ? toGlobal(member, load.qxEnd ?? 0, load.qyEnd ?? 0) : [load.qxEnd ?? 0, load.qyEnd ?? 0];
      return { ...base, type: 'distributed', coordinateSystem: 'global', qxStart, qxEnd, qyStart, qyEnd, qzStart: 0, qzEnd: 0 };
    }
    if (load.type === 'point') {
      const [px, py] = local ? toGlobal(member, load.px ?? 0, load.py ?? 0) : [load.px ?? 0, load.py ?? 0];
      return { ...base, type: 'point', coordinateSystem: 'global', px, py, pz: 0, ...(load.position !== undefined ? { position: load.position } : {}) };
    }
    return { ...base, type: 'moment', coordinateSystem: 'global', mz: load.moment ?? 0, ...(load.position !== undefined ? { position: load.position } : {}) };
  };
  const memberLoads = Array.from({ length: frames }, (_, frame) => resolved.memberLoads.map((load) => memberLoadsOf(load, frame)))
    .flat().filter((load): load is Space3DMemberLoad => load !== null);
  const nodalLoads: Space3DNodalLoad[] = Array.from({ length: frames }, (_, frame) => resolved.nodalLoads.map((load) => ({
    id: `${load.id}-${frame + 1}`, caseId: load.caseId, nodeId: nodeId(load.nodeId, frame),
    fx: load.fx, fy: load.fy, fz: 0, mx: 0, my: 0, mz: load.mz,
  }))).flat();

  const loadCases: Space3DLoadCase[] = project.loadCases.map((item) => ({
    id: item.id, name: item.name, active: item.active,
    ...(item.category ? { category: item.category } : {}),
    ...(item.selfWeightFactor !== undefined ? { selfWeightFactor: item.selfWeightFactor } : {}),
  }));
  const loadCombinations = project.combinations.map((combination) => ({
    id: combination.id, name: combination.name,
    terms: Object.entries(combination.factors).filter(([, factor]) => factor !== 0).map(([caseId, factor]) => ({ caseId, factor })),
  }));

  if ((project.prescribedDisplacements ?? []).length) notes.push('Los desplazamientos impuestos no se trajeron.');
  if ((project.memberInitialEffects ?? []).length) notes.push('Los efectos de temperatura y deformación inicial no se trajeron.');
  if ((project.nodeLinks ?? []).length || (project.multiPointConstraints ?? []).length) notes.push('Los vínculos y restricciones entre nudos no se trajeron.');
  if ((project.generatedLoadSources ?? []).some((item) => item.kind === 'elastic-foundation')) notes.push('La cimentación elástica no se trajo.');
  if ((project.movingLoadCases ?? []).length) notes.push('Las cargas móviles no se trajeron.');
  if (project.members.some((member) => member.rigidOffsetI || member.rigidOffsetJ || member.rotationalSpringI !== undefined || member.rotationalSpringJ !== undefined)) {
    notes.push('Las zonas rígidas y los extremos semirrígidos no se trajeron.');
  }
  // Diafragmas: en cada nivel, los nudos que no son apoyo de todos los pórticos.
  const levels = [...new Set(project.nodes.filter((node) => node.support.type === 'none').map((node) => Math.round(node.y * 1e6) / 1e6))].sort((a, b) => a - b);
  const diaphragms = frames > 1 && options.diaphragms
    ? levels.map((y, index) => ({
      id: `D${index + 1}`,
      name: `Nivel ${index + 1} · y = ${Number(y.toFixed(3))} m`,
      nodeIds: nodes.filter((node) => Math.abs(node.y - y) <= 1e-6 && !Object.values(node.restraints).some(Boolean)).map((node) => node.id),
    })).filter((diaphragm) => diaphragm.nodeIds.length > 1)
    : [];
  if (frames > 1) {
    notes.push(`Cada pórtico lleva las mismas cargas del 2D; las vigas transversales usan la sección de ${reference.label?.trim() || reference.id} y no tienen carga.`);
    notes.push(diaphragms.length
      ? `Un diafragma rígido por nivel (${diaphragms.length}): la losa une los pórticos y las vigas no se acortan en su plano.`
      : 'Sin diafragmas: cada pórtico se deforma por su cuenta; agrégalos en Definir si hay losa.');
  }
  if (frames === 1) notes.push('Un pórtico solo se trae plano: sus nudos quedan restringidos fuera del plano.');
  notes.push('Iy y J se estiman con el rectángulo de cada sección.');

  const xs = [...new Set(project.nodes.map((node) => Math.round(node.x * 1e6) / 1e6))].sort((a, b) => a - b);
  const ys = [...new Set(project.nodes.map((node) => Math.round(node.y * 1e6) / 1e6))].sort((a, b) => a - b);
  const grid = createSpace3DGrid({
    xSpacings: xs.slice(1).map((x, index) => x - xs[index]!),
    zSpacings: Array.from({ length: frames - 1 }, () => options.spacingM),
    storyHeights: ys.slice(1).map((y, index) => y - ys[index]!),
    origin: [xs[0] ?? 0, ys[0] ?? 0, 0],
  });

  const model: Space3DProjectV1 = {
    analysisSpace: SPACE3D_ANALYSIS_SPACE,
    schemaVersion: SPACE3D_SCHEMA_VERSION,
    id: `${project.id}-3d`,
    name: `${project.name} · 3D`,
    units: project.settings.units,
    grid,
    nodes,
    members: [...frameMembers, ...transverse],
    nodalLoads,
    loadCases,
    loadCombinations,
    prescribedDisplacements: [],
    memberLoads,
    memberInitialEffects: [],
    nodeLinks: [],
    multiPointConstraints: [],
    nodalMasses: [],
    generatedLoadSources: [],
    movingLoadCases: [],
    ...(diaphragms.length ? { diaphragms } : {}),
  };
  return { model, errors, notes };
}
