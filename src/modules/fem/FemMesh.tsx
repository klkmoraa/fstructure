import type { FemAnalysisResult, FemDocumentV1 } from './public';

export const femNumber = (value: number | null | undefined) => value != null && Number.isFinite(value)
  ? value.toLocaleString('es-MX', { maximumSignificantDigits: 6 }) : '—';

/** Proyección del estudio FEM; la escala de colores describe valores, no un veredicto. */
export function FemMesh({ document, analysis }: { document: FemDocumentV1; analysis?: FemAnalysisResult | null }) {
  const nodes = new Map(document.nodes.map((node) => [node.id, node]));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of document.nodes) {
    minX = Math.min(minX, node.x); maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y); maxY = Math.max(maxY, node.y);
  }
  if (!document.nodes.length) return <p className="fusion-fem__empty">El estudio no contiene nudos que mostrar.</p>;
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min(520 / spanX, 300 / spanY);
  const offsetX = (600 - spanX * scale) / 2;
  const offsetY = (380 - spanY * scale) / 2;
  const point = (x: number, y: number) => [offsetX + (x - minX) * scale, 380 - offsetY - (y - minY) * scale];
  const stresses = new Map(analysis?.success ? analysis.stresses.map((stress) => [stress.elementId, stress.vonMises]) : []);
  let maxStress = 0, minStress = Infinity;
  for (const value of stresses.values()) {
    if (!Number.isFinite(value)) continue;
    minStress = Math.min(minStress, value); maxStress = Math.max(maxStress, value);
  }
  const colored = stresses.size > 0;
  // No bloquear el navegador al abrir una malla de intercambio muy grande.
  const visibleElements = document.elements.slice(0, 10_000);
  return <figure className="fusion-fem__mesh" data-field={colored ? 'von-mises' : 'mesh'}>
    <svg viewBox="0 0 600 380" role="img" aria-label={`${colored ? 'Campo de von Mises' : 'Malla'} de ${document.name}`}>
      {visibleElements.map((element) => {
        const vertices = element.nodeIds.map((id) => nodes.get(id));
        if (vertices.some((node) => !node)) return null;
        const value = stresses.get(element.id);
        return <polygon key={element.id} points={vertices.map((node) => point(node!.x, node!.y).join(',')).join(' ')}
          className="fusion-fem__mesh-element" fillOpacity={colored ? 0.15 + 0.7 * (maxStress > minStress ? ((value ?? minStress) - minStress) / (maxStress - minStress) : 0.5) : 0.12}>
          <title>{element.id} · {element.type}{value != null ? ` · von Mises ${femNumber(value)} kN/m²` : ''}</title>
        </polygon>;
      })}
      {document.nodes.length <= 80 ? document.nodes.map((node) => {
        const [x, y] = point(node.x, node.y);
        return <g key={node.id}><circle cx={x} cy={y} r="3" className="fusion-fem__mesh-node" />
          <text x={x + 7} y={y - 8}>{node.id}</text></g>;
      }) : null}
    </svg>
    <figcaption>
      <span>{colored ? 'von Mises · kN/m²' : `${document.nodes.length} nudos · ${document.elements.length} elementos · m`}</span>
      {colored ? <span className="fusion-fem__mesh-legend">{femNumber(minStress)}<i aria-hidden="true" />{femNumber(maxStress)}</span> : null}
    </figcaption>
    {visibleElements.length < document.elements.length ? <p>Vista de los primeros 10 000 elementos. Exporta VTK para consultar la malla completa.</p> : null}
  </figure>;
}
