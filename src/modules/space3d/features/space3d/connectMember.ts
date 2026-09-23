import type { Space3DFrameMember, Space3DNode, Space3DProjectV1 } from '../../space3d/model/types';
import { chooseReferenceVector } from '../../space3d/engine/space3dGenerative';

/** Propiedades por defecto cuando el proyecto todavía no tiene ninguna barra. */
const FALLBACK_STIFFNESS = {
  E: 200e6,
  G: 77e6,
  A: 0.01,
  Iy: 1e-4,
  Iz: 1e-4,
  J: 4e-7,
} as const;

/** Primer `M<n>` libre, para no colisionar con identificadores ya usados. */
export const nextSpace3DMemberId = (members: readonly Space3DFrameMember[]): string => {
  const used = new Set(members.map((member) => member.id));
  let index = members.length + 1;
  while (used.has(`M${index}`)) index += 1;
  return `M${index}`;
};

/**
 * Construye la barra que une dos nudos en el gesto de conexión rápida.
 *
 * Toma como referencia la primera barra del proyecto. La rigidez no viaja
 * sola: `density` decide si la barra pesa en el análisis modal
 * (`assembleSpace3DMass` omite las que no la declaran) y los identificadores de
 * sección y material son la procedencia que hace que el modelo afirme lo mismo
 * que calcula. Copiar sólo los seis números dejaba barras sin masa y con una
 * sección declarada que no correspondía a sus propiedades.
 */
export const buildConnectingMember = (
  project: Space3DProjectV1,
  fromNode: Space3DNode,
  toNode: Space3DNode,
): Space3DFrameMember => {
  const reference = project.members[0];
  return {
    id: nextSpace3DMemberId(project.members),
    i: fromNode.id,
    j: toNode.id,
    E: reference?.E ?? FALLBACK_STIFFNESS.E,
    G: reference?.G ?? FALLBACK_STIFFNESS.G,
    A: reference?.A ?? FALLBACK_STIFFNESS.A,
    Iy: reference?.Iy ?? FALLBACK_STIFFNESS.Iy,
    Iz: reference?.Iz ?? FALLBACK_STIFFNESS.Iz,
    J: reference?.J ?? FALLBACK_STIFFNESS.J,
    ...(reference?.density !== undefined ? { density: reference.density } : {}),
    ...(reference?.materialId !== undefined ? { materialId: reference.materialId } : {}),
    ...(reference?.materialOrigin !== undefined ? { materialOrigin: reference.materialOrigin } : {}),
    ...(reference?.sectionId !== undefined ? { sectionId: reference.sectionId } : {}),
    ...(reference?.sectionOrigin !== undefined ? { sectionOrigin: reference.sectionOrigin } : {}),
    orientation: {
      localYReferenceGlobal: chooseReferenceVector(fromNode, toNode),
      rollRadians: 0,
    },
  };
};
