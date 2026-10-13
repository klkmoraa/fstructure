import { memo, useMemo } from 'react';
import type { AnalysisResult, NodeModel, ProjectModel } from '../../types';
import type { TranslationKey } from '../../i18n/catalogs';
import { segmentBezierControls } from '../../engine/diagram';
import { memberAxis } from '../../graphics/structureGeometry';
import { unitLabel } from '../../engine/units';
import { toDisplay } from '../../foundation/units';
import { formatFixed } from '../../utils/numberFormat';
import { CanvasGeometryLayer } from './CanvasGeometryLayer';
import { buildCanvasSelectionVisualState } from './selectionVisuals';
import { STACK_QUANTITIES, STACK_SYMBOLS, type StackQuantity } from './diagramStack';

type MemberResult = AnalysisResult['memberResults'][number];
type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;
type Size = { width: number; height: number };
type Camera = { x: number; y: number; scale: number };

/** Each replica keeps the DCL's scale. The page scrolls instead of shrinking whole frames. */
export const diagramRowHeight = (project: ProjectModel, size: Size): number => {
  const xs = project.nodes.map((node) => node.x); const ys = project.nodes.map((node) => node.y);
  const spanX = (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);
  const spanY = (ys.length ? Math.max(...ys) - Math.min(...ys) : 0);
  return spanY < Math.max(1e-8, spanX * .1) ? 220 : Math.max(240, Math.min(560, size.height * .72));
};
export const stackBottomReserve = (project: ProjectModel, size: Size, _quantityCount: number): number =>
  Math.max(0, size.height - diagramRowHeight(project, size));

const fallbackCamera = (project: ProjectModel, size: Size): Camera => {
  const xs = project.nodes.map((node) => node.x); const ys = project.nodes.map((node) => node.y);
  const minX = xs.length ? Math.min(...xs) : 0; const maxX = xs.length ? Math.max(...xs) : 0;
  const minY = ys.length ? Math.min(...ys) : 0; const maxY = ys.length ? Math.max(...ys) : 0;
  const height = diagramRowHeight(project, size);
  const scale = Math.max(.01, Math.min((size.width - 140) / Math.max(maxX - minX, 1e-9), (height - 140) / Math.max(maxY - minY, 1e-9)));
  return { x: size.width / 2 - (minX + maxX) * scale / 2, y: height / 2 + (minY + maxY) * scale / 2, scale };
};
const noop = () => undefined;
const noSelection = buildCanvasSelectionVisualState(null);
const emptyRatios = new Map<string, number>();
const replicaLayers = { model: true, loads: false, dimensions: false, ids: false, results: false, labels: false, help: false, diagnostics: false, heatmap: false };

/** Every row repeats ALL members, nodes and supports at exactly the DCL coordinates. */
export const CanvasDiagramStack = memo(({ project, results, quantities, nodeMap, size, t, camera: suppliedCamera }: {
  project: ProjectModel; results: readonly MemberResult[]; quantities: readonly StackQuantity[];
  nodeMap: ReadonlyMap<string, NodeModel>; size: Size; t: Translate; camera?: Camera;
}) => {
  const camera = suppliedCamera ?? fallbackCamera(project, size);
  const height = diagramRowHeight(project, size);
  const memberMap = useMemo(() => new Map(project.members.map((member) => [member.id, member])), [project.members]);
  const mutableNodes = useMemo(() => new Map(nodeMap), [nodeMap]);
  const resultMap = useMemo(() => new Map(results.map((result) => [result.memberId, result])), [results]);
  const visible = STACK_QUANTITIES.filter((quantity) => quantities.includes(quantity));
  const toScreen = (x: number, y: number) => ({ x: camera.x + x * camera.scale, y: camera.y - y * camera.scale });
  const units = project.settings.units;
  const maximumFor = (quantity: StackQuantity) => Math.max(1e-9, ...results.map((result) => quantity === 'axial'
    ? Math.max(Math.abs(result.maxAxial), Math.abs(result.minAxial)) : quantity === 'shear'
      ? Math.max(Math.abs(result.maxShear), Math.abs(result.minShear)) : Math.max(Math.abs(result.maxMoment), Math.abs(result.minMoment))));
  const amplitude = size.width < 700 ? 26 : 38;
  return <section className="canvas-diagram-stack" data-canvas-layer="diagram-stack" aria-label={t('canvas.evidenceStackStructure')}>
    {visible.map((quantity) => {
      const maximum = maximumFor(quantity);
      const direction = quantity === 'moment' ? (project.settings.diagramSide === 'negative' ? -1 : 1) : -1;
      const geometryProps = { project, nodeMap: mutableNodes, memberMap, toScreen, camera,
        selectionVisualState: noSelection, candidatePreview: null, learningFocus: null, memberStartId: null,
        layers: replicaLayers, loadsLayerVisible: false, heatmapRatios: emptyRatios, demandMapActive: false,
        resultTab: quantity, units, forceLabel: unitLabel(units, 'force'), momentLabel: unitLabel(units, 'moment'),
        distributedLabel: unitLabel(units, 'distributedForce'), t, onObjectPointerDown: noop, onObjectKeyDown: noop,
        onShowCut: noop, onCutLeave: noop, interactive: false };
      return <svg key={quantity} width={size.width} height={height} viewBox={`0 0 ${size.width} ${height}`} role="img"
        aria-label={`${STACK_SYMBOLS[quantity]} · ${t('canvas.evidenceStackStructureDetail')}`} data-stack-panel={quantity} className={`diagram-stack-row ${quantity}`}>
        <text className="diagram-stack-heading" x={12} y={24}>{STACK_SYMBOLS[quantity]} · {t(quantity === 'axial' ? 'results.axial' : quantity === 'shear' ? 'results.shear' : 'results.moment')} <tspan className="diagram-stack-unit">{unitLabel(units, quantity === 'moment' ? 'moment' : 'force')}</tspan></text>
        <g className="diagram-stack-model" aria-hidden="true"><CanvasGeometryLayer slot="members" {...geometryProps} /></g>
        {project.members.map((member) => {
          const i = nodeMap.get(member.i); const j = nodeMap.get(member.j);
          if (!i || !j) return null;
          const a = toScreen(i.x, i.y); const b = toScreen(j.x, j.y);
          const result = resultMap.get(member.id);
          const axis = memberAxis(member, i, j);
          const dx = b.x - a.x; const dy = b.y - a.y; const length = Math.hypot(dx, dy) || 1;
          const normal = { x: -dy / length, y: dx / length };
          const point = (x: number, value = 0) => {
            const ratio = ((result?.startOffset ?? 0) + x) / axis.length;
            const offset = direction * value * amplitude / maximum;
            return { x: a.x + dx * ratio + normal.x * offset, y: a.y + dy * ratio + normal.y * offset };
          };
          const line: string[] = []; const area: string[] = [];
          if (result?.diagramSegments.length) {
            const first = segmentBezierControls(result.diagramSegments[0], quantity);
            const start = point(first.x0); const initial = point(first.x0, first.y0);
            line.push(`M ${initial.x} ${initial.y}`); area.push(`M ${start.x} ${start.y} L ${initial.x} ${initial.y}`);
            result.diagramSegments.forEach((segment, index) => {
              const c = segmentBezierControls(segment, quantity);
              const c1 = point(c.c1x, c.c1y); const c2 = point(c.c2x, c.c2y); const end = point(c.x1, c.y1);
              const curve = `C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`;
              line.push(curve); area.push(curve);
              const next = result.diagramSegments[index + 1];
              if (next) { const jump = segmentBezierControls(next, quantity); const p = point(jump.x0, jump.y0); line.push(`L ${p.x} ${p.y}`); area.push(`L ${p.x} ${p.y}`); }
            });
            const end = point(result.length); area.push(`L ${end.x} ${end.y} Z`);
          }
          const readings = result?.criticalPoints.filter((p) => p.quantity === quantity && p.kind !== 'zero' && Math.abs(p.value) > maximum * .002)
            .filter((p, index, points) => index === points.findIndex((other) => Math.abs(other.x - p.x) < 1e-8 && Math.abs(other.value - p.value) < 1e-8))
            .sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3) ?? [];
          return <g key={member.id} data-stack-member={member.id}>
            <line className="diagram-stack-replica-member" data-replica-member={member.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            {line.length ? <><path className="diagram-stack-member-fill" d={area.join(' ')} /><path className="diagram-stack-member-line" d={line.join(' ')} /></> : null}
            {readings.map((reading) => {
              const p = point(reading.x, reading.value); const side = (Math.sign(reading.value) || 1) * direction;
              const display = toDisplay(reading.value, units, quantity === 'moment' ? 'moment' : 'force');
              return <text key={`${reading.x}:${reading.value}`} className="diagram-stack-value" x={p.x + normal.x * side * 10} y={p.y + normal.y * side * 10 - 3} textAnchor="middle">{formatFixed(Math.abs(display) < 1e-8 ? 0 : display, Math.abs(display) >= 100 ? 1 : 2)}</text>;
            })}
          </g>;
        })}
        <g className="diagram-stack-objects" aria-hidden="true"><CanvasGeometryLayer slot="objects" {...geometryProps} /></g>
      </svg>;
    })}
  </section>;
});
