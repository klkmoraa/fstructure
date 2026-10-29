import { memo, type ComponentProps, type CSSProperties } from 'react';
import { CanvasGeometryLayer as StraightLayer } from './StraightCanvasGeometryLayer';
import { circularMemberGeometry, curvedMemberPath, curvePointAt, curveTangentAt } from '../../graphics/memberCurve';
import { distributedIntensityAt } from '../../graphics/structureGeometry';
import { elasticIndexPaint } from '../results/elasticDemand';
import { readCanvasViewSettings } from '../view/canvasViewSettings';
import { toDisplay } from '../../foundation/units';
import { unitLabel } from '../../engine/units';
import { formatFixed } from '../../utils/numberFormat';
import './nativeCurves.css';
export type { StructuralTarget } from './StraightCanvasGeometryLayer';
type Props = ComponentProps<typeof StraightLayer>;

/** Curves use one exact SVG arc and one selectable member identity. */
export const CanvasGeometryLayer = memo((props: Props) => {
  const curves = props.project.members.filter(m => m.curve);
  if (!curves.length) return <StraightLayer {...props} />;
  const view = readCanvasViewSettings(props.project);
  if (props.slot === 'objects') {
    const ids = new Set(curves.map(m => m.id));
    return <>
      <StraightLayer {...props} project={{ ...props.project, memberLoads: props.project.memberLoads.filter(l => !ids.has(l.memberId)) }} />
      {props.loadsLayerVisible && view.showLoads && props.resultTab !== 'influence' ? <g className="native-curve-loads">
        {props.project.memberLoads.filter(l => ids.has(l.memberId)).map(load => {
          const member = props.memberMap.get(load.memberId)!;
          const i = props.nodeMap.get(member.i), j = props.nodeMap.get(member.j);
          if (!i || !j) return null;
          const arc = circularMemberGeometry(member, i, j)!;
          const selected = props.selectionVisualState.memberLoadId === load.id;
          const station = (t: number) => { const p = curvePointAt(arc, t); return props.toScreen(p.x, p.y); };
          const vector = (t: number, x: number, y: number) => {
            if (load.coordinateSystem === 'global') return { x, y: -y };
            const tangent = curveTangentAt(arc, t);
            return { x: tangent.x * x - tangent.y * y, y: -(tangent.y * x + tangent.x * y) };
          };
          const arrow = (t: number, x: number, y: number, key: number) => {
            const base = station(t), direction = vector(t, x, y), length = Math.hypot(direction.x, direction.y);
            if (length < 1e-12) return null;
            return <line key={key} x1={base.x - direction.x / length * 34} y1={base.y - direction.y / length * 34}
              x2={base.x} y2={base.y} markerEnd="url(#arrow-load-point)" />;
          };
          return <g key={load.id} data-structure-object data-structure-kind="memberLoad" data-structure-id={load.id}
            className={`native-curve-load ${selected ? 'selected' : ''}`} role="button" tabIndex={props.interactive === false ? -1 : 0}
            aria-label={`${load.id} · ${member.id}`} aria-pressed={selected}
            onPointerDown={event => props.onObjectPointerDown(event, { kind: 'memberLoad', id: load.id })}
            onKeyDown={event => props.onObjectKeyDown(event, { kind: 'memberLoad', id: load.id })}>
            {load.type === 'point' ? arrow(load.position ?? 0.5, load.px ?? 0, load.py ?? 0, 0) : null}
            {load.type === 'distributed' ? Array.from({ length: 9 }, (_, n) => {
              const ratio = n / 8, t = load.start + ratio * (load.end - load.start);
              const q = distributedIntensityAt(load, ratio); return arrow(t, q.qx, q.qy, n);
            }) : null}
            {load.type === 'moment' ? (() => {
              const p = station(load.position ?? 0.5);
              return <path d={`M ${p.x + 13} ${p.y + 7} A 15 15 0 1 ${ (load.moment ?? 0) >= 0 ? 0 : 1 } ${p.x - 13} ${p.y + 7}`} markerEnd="url(#arrow-load-point)" />;
            })() : null}
          </g>;
        })}
      </g> : null}
    </>;
  }
  return <>
    <StraightLayer {...props} project={{ ...props.project, members: props.project.members.filter(m => !m.curve) }} />
    <g className="member-layer native-curve-members">
      {curves.map(member => {
        const i = props.nodeMap.get(member.i), j = props.nodeMap.get(member.j);
        if (!i || !j) return null;
        const arc = circularMemberGeometry(member, i, j)!;
        const path = curvedMemberPath(arc, props.toScreen);
        const middle = curvePointAt(arc, 0.5), label = props.toScreen(middle.x, middle.y);
        const selected = props.selectionVisualState.memberIds.includes(member.id);
        const previewed = props.candidatePreview?.kind === 'member' && props.candidatePreview.id === member.id;
        const ratio = props.demandMapActive ? props.heatmapRatios.get(member.id) : undefined;
        const paint = ratio === undefined ? null : elasticIndexPaint(ratio);
        return <g key={member.id} data-structure-object data-structure-kind="member" data-structure-id={member.id} data-curved-member="true"
          className={`member-object frame native-curve ${selected ? 'selected' : ''}${previewed ? ' candidate-preview' : ''}${paint ? ' has-demand' : ''}`}
          style={paint ? { '--member-demand-color': paint.color } as CSSProperties : undefined}
          role="button" tabIndex={props.interactive === false ? -1 : 0} aria-keyshortcuts="Enter Space"
          aria-label={`${props.t('canvas.memberAria', { id: member.id, i: member.i, j: member.j })} · curva`}
          aria-pressed={selected}
          onPointerDown={event => props.onObjectPointerDown(event, { kind: 'member', id: member.id })}
          onKeyDown={event => props.onObjectKeyDown(event, { kind: 'member', id: member.id })}
          onPointerMove={event => props.onShowCut(event, member)} onPointerLeave={props.onCutLeave}>
          {selected ? <path className="member-selection-halo" d={path} fill="none" /> : null}
          {previewed ? <path className="candidate-preview-halo" d={path} fill="none" /> : null}
          <path className="member-hit" d={path} fill="none" />
          <path className="member-line" d={path} fill="none" />
          {props.layers.dimensions && view.showDimensions ? <text className="native-curve-dimension" x={label.x} y={label.y - 16} textAnchor="middle" pointerEvents="none">
            {formatFixed(toDisplay(arc.length, props.units, 'length'), 2)} {unitLabel(props.units, 'length')} · arco
          </text> : null}
        </g>;
      })}
    </g>
  </>;
});
