import type { ProjectModel } from '../../types';

/** Shared horizontal scale; each row is a vertical translation of the whole DCL. */
export const diagramSheetLayout = (project: ProjectModel, size: { width: number; height: number }) => {
  const xs = project.nodes.map(n => n.x); const ys = project.nodes.map(n => n.y);
  const minX = xs.length ? Math.min(...xs) : 0; const maxX = xs.length ? Math.max(...xs) : 1;
  const minY = ys.length ? Math.min(...ys) : 0; const maxY = ys.length ? Math.max(...ys) : 0;
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
