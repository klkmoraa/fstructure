import type { MemberModel, NodeModel } from '../../types';
import { circularMemberGeometry } from '../../graphics/memberCurve';
import type { SnapSegment } from '../../utils/snapping';

/**
 * Las barras como geometría de snap. Una barra curva lleva su arco: el punto
 * medio, la perpendicular y los cruces se toman sobre él, nunca sobre la
 * cuerda. Así un nudo colocado con esos snaps cae sobre la curva y
 * `ensureNodeAtPoint` la divide ahí (con `splitMemberAt`, que conserva la
 * curvatura de los dos tramos): el nudo queda conectado, no suelto.
 *
 * Una curva con zonas rígidas no ofrece snaps sobre el arco: su división no
 * está verificada y `splitMemberAt` la rechaza, de modo que el snap sólo
 * llevaría a un error o a un nudo suelto.
 */
export const memberSnapSegments = (
  members: readonly MemberModel[],
  nodes: ReadonlyMap<string, NodeModel>,
): SnapSegment[] => members.flatMap((member) => {
  const start = nodes.get(member.i);
  const end = nodes.get(member.j);
  if (!start || !end) return [];
  if (!member.curve) return [{ id: member.id, start, end }];
  if ((member.rigidOffsetI ?? 0) || (member.rigidOffsetJ ?? 0)) return [];
  let arc: ReturnType<typeof circularMemberGeometry>;
  try { arc = circularMemberGeometry(member, start, end); } catch { return []; }
  return arc ? [{ id: member.id, start, end, arc }] : [];
});
