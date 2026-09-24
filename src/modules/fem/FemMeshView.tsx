import { useId, useMemo, useState } from 'react';
import type { FemAnalysisResult, FemDocumentV1 } from './femEngine';
import { buildFemPlot, FEM_PLOT_BANDS, usableAnalysis, type FemPlotField } from './femPlot';

const fields: readonly { id: FemPlotField; label: string; needsResult: boolean }[] = [
  { id: 'mesh', label: 'Malla', needsResult: false },
  { id: 'quality', label: 'Calidad', needsResult: false },
  { id: 'displacement', label: 'Desplazamiento', needsResult: true },
  { id: 'vonMises', label: 'von Mises', needsResult: true },
];

/** Unidades internas m y kN: se convierten sólo al mostrar. */
const display: Record<Exclude<FemPlotField, 'mesh'>, { title: string; unit: string; factor: number }> = {
  quality: { title: 'Relación de aspecto (lado mayor / menor)', unit: '', factor: 1 },
  displacement: { title: 'Desplazamiento |u| (promedio nodal por elemento)', unit: 'mm', factor: 1000 },
  vonMises: { title: 'Tensión de von Mises por elemento', unit: 'MPa', factor: 1 / 1000 },
};

const format = (value: number, field: Exclude<FemPlotField, 'mesh'>) => {
  const { unit, factor } = display[field];
  const scaled = value * factor;
  const text = Math.abs(scaled) >= 1000 || (scaled !== 0 && Math.abs(scaled) < 0.01) ? scaled.toExponential(2) : scaled.toPrecision(3);
  return unit ? `${text} ${unit}` : text;
};

export function FemMeshView({ document, analysis }: { document: FemDocumentV1; analysis: FemAnalysisResult | null }) {
  const arrowId = `${useId().replace(/:/g, '')}-arrow`;
  const solved = usableAnalysis(document, analysis) !== null;
  const [chosen, setChosen] = useState<FemPlotField>('vonMises');
  const [deformed, setDeformed] = useState(true);
  const field: FemPlotField = !solved && (chosen === 'vonMises' || chosen === 'displacement') ? 'mesh' : chosen;
  const plot = useMemo(() => buildFemPlot(document, analysis, field, deformed && solved), [analysis, deformed, document, field, solved]);
  const metric = field === 'mesh' ? null : field;
  const legend = metric ? display[metric] : null;
  const peak = plot.range && metric
    ? plot.elements.reduce((best, element) => (element.value ?? -Infinity) > (best.value ?? -Infinity) ? element : best)
    : null;
  const marker = plot.size * 0.018;
  const [, , boxWidth, boxHeight] = plot.viewBox.split(' ').map(Number);

  return <figure className="fusion-fem__view" data-testid="fem-mesh-view" data-field={field}>
    <div className="fusion-fem__view-bar">
      <div className="fusion-fem__fields" role="radiogroup" aria-label="Campo a colorear">
        {fields.map(({ id, label, needsResult }) => <button
          key={id}
          type="button"
          role="radio"
          aria-checked={field === id}
          disabled={needsResult && !solved}
          title={needsResult && !solved ? 'Analiza el modelo para ver este campo' : undefined}
          onClick={() => setChosen(id)}
        >{label}</button>)}
      </div>
      {solved ? <label className="fusion-fem__deformed">
        <input type="checkbox" checked={deformed} onChange={(event) => setDeformed(event.currentTarget.checked)} />
        Deformada{plot.deformationScale ? ` ×${Number(plot.deformationScale.toPrecision(2))}` : ''}
      </label> : null}
    </div>
    <svg
      className="fusion-fem__canvas"
      viewBox={plot.viewBox}
      preserveAspectRatio="xMidYMid meet"
      style={{ aspectRatio: `${boxWidth} / ${Math.max(boxHeight, boxWidth / 4)}` }}
      role="img"
      aria-label={metric && legend && plot.range
        ? `${document.name}: ${legend.title}, de ${format(plot.range.min, metric)} a ${format(plot.range.max, metric)}`
        : `${document.name}: ${document.elements.length} elementos`}
    >
      <defs>
        <marker id={arrowId} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="fusion-fem__load-head" />
        </marker>
      </defs>
      {plot.undeformed ? <g className="fusion-fem__ghost">
        {plot.undeformed.map((points, index) => <polygon key={index} points={points} vectorEffect="non-scaling-stroke" />)}
      </g> : null}
      <g className="fusion-fem__elements">
        {plot.elements.map((element) => <polygon
          key={element.id}
          points={element.points}
          className={element.band === null ? 'is-plain' : `is-band-${element.band}`}
          vectorEffect="non-scaling-stroke"
        >
          <title>{element.value !== null && metric ? `${element.id} · ${format(element.value, metric)}` : element.id}</title>
        </polygon>)}
      </g>
      <g className="fusion-fem__supports">
        {plot.restraints.map((restraint, index) => <path
          key={index}
          d={restraint.ux && !restraint.uy
            ? `M${restraint.x} ${restraint.y} l${-marker * 1.6} ${-marker} v${marker * 2} z`
            : `M${restraint.x} ${restraint.y} l${-marker} ${marker * 1.6} h${marker * 2} z`}
          vectorEffect="non-scaling-stroke"
        />)}
      </g>
      <g className="fusion-fem__loads">
        {plot.loads.map((load, index) => <line
          key={index}
          x1={load.x - load.dx}
          y1={load.y - load.dy}
          x2={load.x}
          y2={load.y}
          markerEnd={`url(#${arrowId})`}
          vectorEffect="non-scaling-stroke"
        />)}
      </g>
    </svg>
    {metric && legend && plot.range ? <figcaption className="fusion-fem__legend">
      <span className="fusion-fem__legend-title">{legend.title}</span>
      <span className="fusion-fem__legend-scale" aria-hidden="true">
        {Array.from({ length: FEM_PLOT_BANDS }, (_, band) => <i key={band} className={`is-band-${band}`} />)}
      </span>
      <span className="fusion-fem__legend-ends">
        <span>{format(plot.range.min, metric)}</span>
        <span>{format(plot.range.max, metric)}</span>
      </span>
      {peak && peak.value !== null ? <span className="fusion-fem__legend-peak" data-testid="fem-peak">Máximo en {peak.id}: {format(peak.value, metric)}</span> : null}
    </figcaption> : <figcaption className="fusion-fem__legend">
      <span className="fusion-fem__legend-title">{document.nodes.length} nodos · {document.elements.length} elementos{solved ? '' : ' · analiza para ver desplazamientos y tensiones'}</span>
    </figcaption>}
  </figure>;
}
