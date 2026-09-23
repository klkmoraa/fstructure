/**
 * Reglas del modelado directo sobre el lienzo.
 *
 * En tres dimensiones un clic es una recta, no un punto: la profundidad la fija
 * un plano de trabajo que la persona ve y elige, nunca una suposición. Todo lo
 * que aquí se construye son comandos; el store los valida y los hace
 * reversibles.
 */
import type { Space3DCommand } from '../../space3d/data/commands';
import type {
  Space3DFrameMember, Space3DNodalLoad, Space3DNode, Space3DProjectV1, Space3DRestraints, Space3DVector,
} from '../../space3d/model/types';
import { freeSpace3DRestraints } from '../../space3d/model/types';
import { SPACE3D_MATERIALS, SPACE3D_SECTION_CATALOG } from '../../space3d/model/sectionLibrary';
import type { Space3DViewPreset } from '../../space3d/view/cameraModel';
import { buildConnectingMember, nextSpace3DMemberId } from './connectMember';
import { SPACE3D_SUPPORT_RESTRAINTS, type Space3DSupportKind } from './space3dSupportKind';

/** Eje normal al plano: `y` es un plano horizontal (XZ); `z`, el alzado XY; `x`, el lateral YZ. */
export type Space3DPlaneAxis = 'x' | 'y' | 'z';

export interface Space3DWorkPlane {
  readonly axis: Space3DPlaneAxis;
  /** Coordenada fija del plano sobre su eje, m. */
  readonly offset: number;
  /** Paso de la cuadrícula de ajuste, m. */
  readonly step: number;
}

export const SPACE3D_SNAP_STEPS = [0.25, 0.5, 1, 2, 5] as const;

const AXIS_INDEX: Record<Space3DPlaneAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

/** La vista decide el plano natural: en planta se dibuja en horizontal, en alzado en vertical. */
export const space3DPlaneAxisForView = (view: Space3DViewPreset): Space3DPlaneAxis =>
  view === 'front' ? 'z' : view === 'side' ? 'x' : 'y';

const snap = (value: number, step: number) => {
  const snapped = Math.round(value / step) * step;
  // Evita «-0» y residuos binarios como 2.9999999999999996.
  return Object.is(snapped, -0) ? 0 : Number(snapped.toFixed(9));
};

/** Ajusta a la cuadrícula las dos coordenadas del plano y fija la tercera en su nivel. */
export const snapToWorkPlane = (point: Space3DVector, plane: Space3DWorkPlane): Space3DVector => {
  const fixed = AXIS_INDEX[plane.axis];
  return [0, 1, 2].map((index) => (index === fixed ? plane.offset : snap(point[index]!, plane.step))) as unknown as Space3DVector;
};

const DUPLICATE_TOLERANCE = 1e-6;

export const findSpace3DNodeAt = (project: Space3DProjectV1, point: Space3DVector): Space3DNode | undefined =>
  project.nodes.find((node) => Math.abs(node.x - point[0]) < DUPLICATE_TOLERANCE
    && Math.abs(node.y - point[1]) < DUPLICATE_TOLERANCE
    && Math.abs(node.z - point[2]) < DUPLICATE_TOLERANCE);

export const nextSpace3DNodeId = (project: Space3DProjectV1, reserved: readonly string[] = []): string => {
  const used = new Set([...project.nodes.map((node) => node.id), ...reserved]);
  let index = project.nodes.length + 1;
  while (used.has(`N${index}`)) index += 1;
  return `N${index}`;
};

export const nextSpace3DLoadId = (project: Space3DProjectV1, reserved: readonly string[] = []): string => {
  const used = new Set([...project.nodalLoads.map((load) => load.id), ...reserved]);
  let index = project.nodalLoads.length + 1;
  while (used.has(`L${index}`)) index += 1;
  return `L${index}`;
};

export const buildSpace3DNode = (project: Space3DProjectV1, point: Space3DVector, reserved: readonly string[] = []): Space3DNode => ({
  id: nextSpace3DNodeId(project, reserved),
  x: point[0],
  y: point[1],
  z: point[2],
  restraints: freeSpace3DRestraints(),
});

/** Sección de las barras dibujadas: una del catálogo, o la de la barra existente que se toma de referencia. */
export type Space3DMemberTemplate =
  | { readonly kind: 'catalog'; readonly sectionName: string }
  | { readonly kind: 'reference' };

export const buildSpace3DMember = (
  project: Space3DProjectV1,
  from: Space3DNode,
  to: Space3DNode,
  template: Space3DMemberTemplate,
): Space3DFrameMember => {
  const base = buildConnectingMember(project, from, to);
  if (template.kind === 'reference') return base;
  const section = SPACE3D_SECTION_CATALOG.find((item) => item.name === template.sectionName);
  const material = section ? SPACE3D_MATERIALS.find((item) => item.id === section.materialId) : undefined;
  if (!section || !material) return base;
  return {
    ...base,
    E: material.E,
    G: material.G,
    A: section.A,
    Iy: section.Iy,
    Iz: section.Iz,
    J: section.J,
    density: material.massDensityKgPerM3,
    materialId: material.id,
    materialOrigin: 'catalog',
    sectionId: section.name,
    sectionOrigin: 'catalog',
  };
};

/**
 * Lo que produce un clic de la herramienta Barra sobre un punto vacío del plano:
 * el nudo nuevo y la barra desde el nudo de origen, como un solo paso.
 */
export const space3DMemberToPointCommand = (
  project: Space3DProjectV1,
  from: Space3DNode,
  point: Space3DVector,
  template: Space3DMemberTemplate,
): { readonly command: Space3DCommand; readonly endNodeId: string; readonly memberId: string } | null => {
  const existing = findSpace3DNodeAt(project, point);
  if (existing?.id === from.id) return null;
  const end = existing ?? buildSpace3DNode(project, point);
  const member = buildSpace3DMember(project, from, end, template);
  const command: Space3DCommand = existing
    ? { kind: 'add-member', member }
    : { kind: 'batch', commands: [{ kind: 'add-node', node: end }, { kind: 'add-member', member }] };
  return { command, endNodeId: end.id, memberId: member.id };
};

export const space3DMemberExists = (project: Space3DProjectV1, a: string, b: string) =>
  project.members.some((member) => (member.i === a && member.j === b) || (member.i === b && member.j === a));

/** Direcciones de carga que una persona nombra; «custom» abre el formulario completo. */
export type Space3DLoadDirection = 'down' | 'up' | 'x+' | 'x-' | 'z+' | 'z-';

export const SPACE3D_LOAD_DIRECTIONS: readonly Space3DLoadDirection[] = ['down', 'x+', 'x-', 'z+', 'z-', 'up'];

export const space3DLoadVector = (direction: Space3DLoadDirection, magnitude: number): Pick<Space3DNodalLoad, 'fx' | 'fy' | 'fz' | 'mx' | 'my' | 'mz'> => {
  const zero = { fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 };
  switch (direction) {
    case 'down': return { ...zero, fy: -magnitude };
    case 'up': return { ...zero, fy: magnitude };
    case 'x+': return { ...zero, fx: magnitude };
    case 'x-': return { ...zero, fx: -magnitude };
    case 'z+': return { ...zero, fz: magnitude };
    case 'z-': return { ...zero, fz: -magnitude };
  }
};

export const space3DLoadCommand = (
  project: Space3DProjectV1,
  nodeIds: readonly string[],
  caseId: string,
  direction: Space3DLoadDirection,
  magnitude: number,
): Space3DCommand | null => {
  if (nodeIds.length === 0) return null;
  const reserved: string[] = [];
  const commands: Space3DCommand[] = nodeIds.map((nodeId) => {
    const id = nextSpace3DLoadId(project, reserved);
    reserved.push(id);
    return { kind: 'add-nodal-load', load: { id, caseId, nodeId, ...space3DLoadVector(direction, magnitude) } };
  });
  return commands.length === 1 ? commands[0]! : { kind: 'batch', commands };
};

export const space3DSupportCommand = (
  nodeIds: readonly string[],
  kind: Exclude<Space3DSupportKind, 'custom'>,
): Space3DCommand | null => {
  if (nodeIds.length === 0) return null;
  const restraints: Space3DRestraints = SPACE3D_SUPPORT_RESTRAINTS[kind];
  const commands: Space3DCommand[] = nodeIds.map((nodeId) => ({ kind: 'set-restraints', nodeId, restraints }));
  return commands.length === 1 ? commands[0]! : { kind: 'batch', commands };
};

const LEVEL_TOLERANCE = 1e-6;

/** Nudos al nivel más bajo: la base donde normalmente van los apoyos. */
export const space3DBaseNodeIds = (project: Space3DProjectV1): readonly string[] => {
  if (project.nodes.length === 0) return [];
  const lowest = Math.min(...project.nodes.map((node) => node.y));
  return project.nodes.filter((node) => node.y - lowest < LEVEL_TOLERANCE).map((node) => node.id);
};

/** Nudos al nivel más alto: la cubierta, destino habitual de la carga gravitatoria. */
export const space3DTopNodeIds = (project: Space3DProjectV1): readonly string[] => {
  if (project.nodes.length === 0) return [];
  const highest = Math.max(...project.nodes.map((node) => node.y));
  return project.nodes.filter((node) => highest - node.y < LEVEL_TOLERANCE).map((node) => node.id);
};

export { nextSpace3DMemberId };
