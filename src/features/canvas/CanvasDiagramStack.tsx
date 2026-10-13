import { memo, useMemo } from 'react';
import { diagramSheetLayout } from './diagramSheetLayout';
import { readCanvasViewSettings } from '../view/canvasViewSettings';
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

export const diagramRowHeight = (project: ProjectModel, size: Size): number => diagramSheetLayout(project, size).rowHeight;
export const diagramDclHeight = (project: ProjectModel, size: Size): number => diagramSheetLayout(project, size).dclHeight;
export const stackBottomReserve = (project: ProjectModel, size: Size, _quantityCount: number): number =>
  Math.max(0, size.height - diagramDclHeight(project, size));

const noop = () => undefined;
const noSelection = buildCanvasSelectionVisualState(null);
const emptyRatios = new Map<string, number>();
const replicaLayers = { model: true, loads: false, dimensions: false, ids: false, results: false, labels: false, help: false, diagnostics: false, heatmap: false };

/** Every row repeats ALL members, nodes and supports at exactly the DCL coordinates. */
export const CanvasDiagramStack = memo(({ project, results, quantities, nodeMap, size, t, camera: suppliedCamera }: {
  project: ProjectModel; results: readonly MemberResult[]; quantities: readonly StackQuantity[];
  nodeMap: ReadonlyMap<string, NodeModel>; size: Size; t: Translate; camera?: Camera;
}) => {
  const layout = diagramSheetLayout(project, size);
  const camera = suppliedCamera ? { ...suppliedCamera, y: suppliedCamera.y - layout.replicaShift } : { ...layout.camera, y: layout.camera.y - layout.replicaShift };
  const view = readCanvasViewSettings(project);
  const gridStep = view.gridSize * camera.scale;
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
  const amplitude = size.width < 700 ? 44 : 52;
  return <section className="canvas-diagram-stack" data-canvas-layer="diagram-stack" aria-label={t('canvas.evidenceStackStructure')}>
    {visible.map((quantity) => {
      const maximum = maximumFor(quantity);
      const direction = view.diagramSide === 'negative' ? -1 : 1;
      const geometryProps = { project, nodeMap: mutableNodes, memberMap, toScreen, camera,
        selectionVisualState: noSelection, candidatePreview: null, learningFocus: null, memberStartId: null,
        layers: replicaLayers, loadsLayerVisible: false, heatmapRatios: emptyRatios, demandMapActive: false,
        resultTab: quantity, units, forceLabel: unitLabel(units, 'force'), momentLabel: unitLabel(units, 'moment'),
        distributedLabel: unitLabel(units, 'distributedForce'), t, onObjectPointerDown: noop, onObjectKeyDown: noop,
        onShowCut: noop, onCutLeave: noop, interactive: false };
      return <svg key={quantity} width={size.width} height={height} viewBox={`0 0 ${size.width} ${height}`} role="img"
        aria-label={`${STACK_SYMBOLS[quantity]} · ${t('canvas.evidenceStackStructureDetail')}`} data-stack-panel={quantity} className={`diagram-stack-row ${quantity}`}>
        {view.showGrid && gridStep >= 8 ? <g className="grid-lines" aria-hidden="true">
          {Array.from({length: Math.ceil(size.width / gridStep)}, (_, i) => { const x = ((camera.x % gridStep) + gridStep) % gridStep + i * gridStep; return <line key={`x${i}`} x1={x} y1={0} x2={x} y2={height} />; })}
          {Array.from({length: Math.ceil(height / gridStep)}, (_, i) => { const y = ((camera.y % gridStep) + gridStep) % gridStep + i * gridStep; return <line key={`y${i}`} x1={0} y1={y} x2={size.width} y2={y} />; })}
        </g> : null}
        <text className="diagram-stack-heading" x={12} y={24}>{STACK_SYMBOLS[quantity]} · {t(quantity === 'axial' ? 'results.axial' : quantity === 'shear' ? 'results.shear' : 'results.moment')} <tspan className="diagram-stack-unit">{unitLabel(units, quantity === 'moment' ? 'moment' : 'force')}</tspan></text>
        <g className="diagram-stack-model" aria-hidden="true"><CanvasGeometryLayer slot="members" {...geometryProps} /></g>
        {project.members.map((member) => {
          const i = nodeMap.get(member.i); const j = nodeMap.get(member.j);
          if (!i || !j) return null;
          const a = toScreen(i.x, i.y); const b = toScreen(j.x, j.y);
          const result = resultMap.get(member.id);
          const axis = memberAxis(member, i, j);
          const dx = b.x - a.x; const dy = b.y - a.y;
          // Same local +y as CanvasResultLayer; screen y grows downwards.
          const normal = { x: axis.normal.x, y: -axis.normal.y };
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
              const rightEnd = p.x > size.width - 72 && result && Math.abs(reading.x - result.length) < Math.max(1, result.length) * 1e-8;
              return <text key={`${reading.x}:${reading.value}`} className="diagram-stack-value" x={Math.max(32, Math.min(size.width - 32, p.x + normal.x * side * 10 - (rightEnd ? 8 : 0)))} y={Math.max(38, Math.min(height - 14, p.y + normal.y * side * 10 - 3))} textAnchor={rightEnd ? 'end' : 'middle'}>{formatFixed(Math.abs(display) < 1e-8 ? 0 : display, 2)}</text>;
            })}
          </g>;
        })}
        <g className="diagram-stack-objects" aria-hidden="true"><CanvasGeometryLayer slot="objects" {...geometryProps} /></g>
      </svg>;
    })}
  </section>;
});
