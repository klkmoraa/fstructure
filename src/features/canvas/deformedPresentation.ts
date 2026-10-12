import type { AnalysisResult, ProjectModel } from '../../types';
import { readCanvasViewSettings } from '../view/canvasViewSettings';

/** Amplificación visual compartida por curva, cursor y encuadre.
 * Con cargas pequeñas, la escala inicial (80) muestra una amplitud del 8 %
 * del modelo. La escala guardada permite aumentarla o reducirla sin modificar
 * los desplazamientos físicos ni el proyecto.
 */
export const deformedDisplayScale = (project: ProjectModel, analysis: AnalysisResult | null): number => {
  const scale = readCanvasViewSettings(project).deformedScale;
  if (!analysis?.success || !project.nodes.length) return scale;
  let minX = Infinity; let maxX = -Infinity;
  let minY = Infinity; let maxY = -Infinity;
  for (const node of project.nodes) {
    minX = Math.min(minX, node.x); maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y); maxY = Math.max(maxY, node.y);
  }
  let displacement = 0;
  for (const node of analysis.nodeResults) displacement = Math.max(displacement, Math.hypot(node.ux, node.uy));
  for (const member of analysis.memberResults) {
    for (const point of member.deformation) displacement = Math.max(displacement, Math.hypot(point.u, point.v));
  }
  if (!(displacement > 0) || !Number.isFinite(displacement)) return scale;
  const target = Math.max(maxX - minX, maxY - minY) * 0.08;
  return scale * Math.max(1, target / (80 * displacement));
};
