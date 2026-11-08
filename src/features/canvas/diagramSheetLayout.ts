import { structureBounds } from '../../graphics/structureGeometry';
import type { ProjectModel } from '../../types';

/** Shared horizontal scale; each row is a vertical translation of the whole DCL. */
export const diagramSheetLayout = (project: ProjectModel, size: { width: number; height: number }) => {
  const bounds = project.nodes.length ? structureBounds(project.nodes, project.members) : { minX: 0, maxX: 1, minY: 0, maxY: 0 };
  const { minX, maxX, minY, maxY } = bounds;
  const spanX = Math.max(1e-9, maxX - minX); const spanY = maxY - minY;
  const beam = spanY < Math.max(1e-8, spanX * 1e-4);
  const availableWidth = Math.max(40, size.width - (beam ? 96 : 160));
  const dclHeight = beam ? 230 : Math.max(320, Math.min(600, availableWidth * spanY / spanX + 180));
  const scale = Math.min(availableWidth / spanX, (dclHeight - 180) / Math.max(spanY, 1e-9), 180);
  const baseline = beam ? 148 : 128 + spanY * scale;
  const replicaShift = beam ? 62 : 40;
  return { dclHeight, rowHeight: dclHeight - replicaShift, replicaShift,
    camera: { x: size.width / 2 - (minX + maxX) * scale / 2, y: baseline + minY * scale, scale } };
};
