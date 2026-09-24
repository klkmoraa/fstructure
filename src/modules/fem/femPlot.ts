/**
 * Geometría de dibujo de la mesa FEM: polígonos por elemento, un valor por
 * elemento según el campo elegido y su banda de color. Es puro (sin DOM) para
 * probarlo sin navegador; el SVG sólo lo pinta.
 */
import type { FemAnalysisResult, FemDocumentV1, FemNode } from './femEngine';

export type FemPlotField = 'mesh' | 'quality' | 'displacement' | 'vonMises';

/** Bandas de contorno: la 0 es el valor más bajo. El color vive en CSS por tema. */
export const FEM_PLOT_BANDS = 7;

export interface FemPlotElement {
  readonly id: string;
  readonly points: string;
  readonly value: number | null;
  readonly band: number | null;
}

export interface FemPlot {
  readonly viewBox: string;
  /** Tamaño del modelo en unidades de dibujo (m); escala marcadores y trazos. */
  readonly size: number;
  readonly elements: readonly FemPlotElement[];
  readonly undeformed: readonly string[] | null;
  readonly range: { readonly min: number; readonly max: number } | null;
  readonly deformationScale: number | null;
  readonly restraints: readonly { readonly x: number; readonly y: number; readonly ux: boolean; readonly uy: boolean }[];
  readonly loads: readonly { readonly x: number; readonly y: number; readonly dx: number; readonly dy: number }[];
}

/** Relación lado mayor / lado menor, la misma métrica que publica el motor. */
export const elementAspectRatio = (nodes: readonly FemNode[]): number => {
  const lengths = nodes.map((node, index) => {
    const next = nodes[(index + 1) % nodes.length];
    return Math.hypot(next.x - node.x, next.y - node.y);
  });
  return Math.max(...lengths) / Math.max(Math.min(...lengths), Number.MIN_VALUE);
};

/** Un rango que sólo difiere por redondeo es plano: todo cae en la banda 0. */
export const bandFor = (value: number, min: number, max: number): number => {
  if (!(max - min > 1e-9 * Math.max(Math.abs(min), Math.abs(max), Number.MIN_VALUE))) return 0;
  const t = (value - min) / (max - min);
  return Math.min(FEM_PLOT_BANDS - 1, Math.max(0, Math.floor(t * FEM_PLOT_BANDS)));
};

/** El resultado sirve sólo si es del mismo documento y resolvió. */
export const usableAnalysis = (document: FemDocumentV1, analysis: FemAnalysisResult | null): FemAnalysisResult | null =>
  analysis && analysis.success && analysis.documentId === document.id ? analysis : null;

export const buildFemPlot = (
  document: FemDocumentV1,
  analysis: FemAnalysisResult | null,
  field: FemPlotField,
  deformed: boolean,
): FemPlot => {
  const result = usableAnalysis(document, analysis);
  const nodesById = new Map(document.nodes.map((node) => [node.id, node]));
  const displacement = new Map(result?.displacements.map((entry) => [entry.nodeId, entry]) ?? []);

  const xs = document.nodes.map((node) => node.x);
  const ys = document.nodes.map((node) => node.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const size = Math.max(maxX - minX, maxY - minY, Number.MIN_VALUE);

  const maxDisplacement = Math.max(0, ...[...displacement.values()].map((entry) => Math.hypot(entry.ux, entry.uy)));
  const deformationScale = result && deformed && maxDisplacement > 0 ? (0.08 * size) / maxDisplacement : null;

  // SVG crece hacia abajo: se invierte y para dibujar con y hacia arriba.
  const at = (node: FemNode, amplify: number | null) => {
    const u = amplify ? displacement.get(node.id) : undefined;
    return { x: node.x + (u ? u.ux * amplify! : 0), y: -(node.y + (u ? u.uy * amplify! : 0)) };
  };
  const polygon = (nodeIds: readonly string[], amplify: number | null) => nodeIds
    .map((id) => nodesById.get(id))
    .filter((node): node is FemNode => node !== undefined)
    .map((node) => { const p = at(node, amplify); return `${round(p.x)},${round(p.y)}`; })
    .join(' ');

  const stressById = new Map(result?.stresses.map((entry) => [entry.elementId, entry.vonMises]) ?? []);
  const valueOf = (nodeIds: readonly string[], elementId: string): number | null => {
    if (field === 'quality') {
      const nodes = nodeIds.map((id) => nodesById.get(id)).filter((node): node is FemNode => node !== undefined);
      return nodes.length >= 3 ? elementAspectRatio(nodes) : null;
    }
    if (field === 'vonMises') return stressById.get(elementId) ?? null;
    if (field === 'displacement') {
      const values = nodeIds.map((id) => displacement.get(id)).filter((entry) => entry !== undefined).map((entry) => Math.hypot(entry.ux, entry.uy));
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    }
    return null;
  };

  const raw = document.elements.map((element) => ({ element, value: valueOf(element.nodeIds, element.id) }));
  const finite = raw.map((entry) => entry.value).filter((value): value is number => value !== null && Number.isFinite(value));
  const range = finite.length ? { min: Math.min(...finite), max: Math.max(...finite) } : null;

  const elements = raw.map(({ element, value }) => ({
    id: element.id,
    points: polygon(element.nodeIds, deformationScale),
    value,
    band: value !== null && range ? bandFor(value, range.min, range.max) : null,
  }));

  const pad = size * 0.12;
  const growX = deformationScale ? size * 0.1 : 0;
  const viewBox = [minX - pad - growX, -maxY - pad - growX, maxX - minX + 2 * (pad + growX), maxY - minY + 2 * (pad + growX)].map(round).join(' ');

  const loadScale = Math.max(0, ...document.loads.map((load) => Math.hypot(load.fx, load.fy)));
  return {
    viewBox,
    size,
    elements,
    undeformed: deformationScale ? document.elements.map((element) => polygon(element.nodeIds, null)) : null,
    range,
    deformationScale,
    restraints: document.restraints.flatMap((restraint) => {
      const node = nodesById.get(restraint.nodeId);
      if (!node || !(restraint.ux || restraint.uy)) return [];
      const p = at(node, deformationScale);
      return [{ x: p.x, y: p.y, ux: Boolean(restraint.ux), uy: Boolean(restraint.uy) }];
    }),
    loads: document.loads.flatMap((load) => {
      const node = nodesById.get(load.nodeId);
      const magnitude = Math.hypot(load.fx, load.fy);
      if (!node || !(magnitude > 0) || !(loadScale > 0)) return [];
      const p = at(node, deformationScale);
      const length = size * 0.08 * (0.5 + 0.5 * magnitude / loadScale);
      return [{ x: p.x, y: p.y, dx: (load.fx / magnitude) * length, dy: -(load.fy / magnitude) * length }];
    }),
  };
};

const round = (value: number) => Math.round(value * 1e6) / 1e6;
