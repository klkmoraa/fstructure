import { memo, type ComponentProps } from 'react';
import type { DiagramQuantity, MemberModel, MemberResult } from '../../types';
import { CanvasResultLayer as StraightLayer, diagramPixelScaleFor } from './StraightCanvasResultLayer';
import { circularMemberGeometry, curvePointAt } from '../../graphics/memberCurve';
import { memberAxis } from '../../graphics/structureGeometry';
import { evaluateDeformationAt, evaluateDiagramAt, evaluatePolynomial } from '../../engine/diagram';
import { readCanvasViewSettings } from '../view/canvasViewSettings';
import { deformedDisplayScale } from './deformedPresentation';
import { diagramScreenPoint, type DiagramFrame } from './resultGeometry';
import { toDisplay } from '../../foundation/units';
import { unitLabel } from '../../engine/units';
import { formatFixed } from '../../utils/numberFormat';
export { diagramPixelScaleFor } from './StraightCanvasResultLayer';
type Props = ComponentProps<typeof StraightLayer>;
type Point = { x: number; y: number };
const path = (points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');

/** Numerical results are sampled along the true arc, never along its chord. */
export const CanvasResultLayer = memo((props: Props) => {
  const curves = props.project.members.filter(m => m.curve);
  if (!curves.length) return <StraightLayer {...props} />;
  const view = readCanvasViewSettings(props.project);
  const cursorOnCurve = Boolean(props.resultCursor && props.memberMap.get(props.resultCursor.memberId)?.curve);
  const allowed = props.showResults && props.resultsAllowed && props.analysis?.success === true;
  const deformationScale = deformedDisplayScale(props.project, props.analysis);
  const draw = (member: MemberModel, result: MemberResult) => {
    const i = props.nodeMap.get(member.i), j = props.nodeMap.get(member.j);
    if (!i || !j) return null;
    const arc = circularMemberGeometry(member, i, j)!;
    if (props.resultTab === 'deformed') {
      const points = result.deformation.map(p => {
        const base = curvePointAt(arc, p.x / arc.length);
        return props.toScreen(base.x + deformationScale * (arc.c * p.u - arc.s * p.v), base.y + deformationScale * (arc.s * p.u + arc.c * p.v));
      });
      return <g key={member.id} className="deformed-layer" data-curved-result={member.id}><path d={path(points)} /></g>;
    }
    if (!view.showResultOverlay || !['axial', 'shear', 'moment'].includes(props.resultTab)) return null;
    const key = props.resultTab as DiagramQuantity;
    const frame: DiagramFrame = { result, axis: memberAxis(member, i, j), side: view.diagramSide === 'negative' ? -1 : 1,
      pixelScale: diagramPixelScaleFor(props.project, props.resultTab, props.globalDiagramMax, result), cameraScale: props.camera.scale, toScreen: props.toScreen };
    const points: Point[] = [];
    for (const segment of result.diagramSegments) for (let k = 0; k <= 4; k++) {
      const xi = (segment.x1 - segment.x0) * k / 4;
      points.push(diagramScreenPoint(frame, segment.x0 + xi, evaluatePolynomial(segment[key], xi)));
    }
    const baseline = Array.from({ length: 65 }, (_, n) => {
      const p = curvePointAt(arc, 1 - n / 64); return props.toScreen(p.x, p.y);
    });
    return <g key={member.id} className={`diagram-shape ${key}`} data-curved-result={member.id}>
      <path className="diagram-fill" d={`${path([...points, ...baseline])} Z`} />
      <path className="diagram-line-exact" d={path(points)} />
    </g>;
  };
  const cursor = () => {
    if (!allowed || !cursorOnCurve || !props.resultCursor) return null;
    const member = props.memberMap.get(props.resultCursor.memberId)!;
    const result = props.resultMap.get(member.id), i = props.nodeMap.get(member.i), j = props.nodeMap.get(member.j);
    if (!result || !i || !j) return null;
    const arc = circularMemberGeometry(member, i, j)!, x = Math.max(0, Math.min(result.length, props.resultCursor.x));
    const base = curvePointAt(arc, x / arc.length);
    let point = props.toScreen(base.x, base.y), label = `s ${formatFixed(toDisplay(x, props.units, 'length'), 3)} ${props.lengthLabel}`;
    if (['axial', 'shear', 'moment'].includes(props.resultTab)) {
      const key = props.resultTab as DiagramQuantity;
      const value = evaluateDiagramAt(result.diagramSegments, result.diagramJumps, x, 'right')?.[key] ?? 0;
      point = diagramScreenPoint({ result, axis: memberAxis(member, i, j), side: view.diagramSide === 'negative' ? -1 : 1,
        pixelScale: diagramPixelScaleFor(props.project, props.resultTab, props.globalDiagramMax, result), cameraScale: props.camera.scale, toScreen: props.toScreen }, x, value);
      const quantity = key === 'moment' ? 'moment' : 'force';
      label = `${key === 'axial' ? 'N' : key === 'shear' ? 'V' : 'M'} ${formatFixed(toDisplay(value, props.units, quantity), 3)} ${unitLabel(props.units, quantity)}`;
    } else if (props.resultTab === 'deformed') {
      const response = evaluateDeformationAt(result.deformationSegments, x);
      if (response) point = props.toScreen(base.x + deformationScale * (arc.c * response.u - arc.s * response.v), base.y + deformationScale * (arc.s * response.u + arc.c * response.v));
    }
    return <g className="result-cursor-marker" transform={`translate(${point.x} ${point.y})`} pointerEvents="none"><circle r="6" /><path d="M-13 0H13M0-13V13" />
      <g transform="translate(10 -31)"><rect width={Math.max(90, label.length * 5.5)} height="22" rx="7" /><text x="8" y="15">{label}</text></g></g>;
  };
  return <>
    <StraightLayer {...props} project={{ ...props.project, members: props.project.members.filter(m => !m.curve) }} resultCursor={cursorOnCurve ? null : props.resultCursor} />
    {props.slot === 'diagrams' && allowed ? <>
      <g className="diagram-layer">{curves.map(m => { const r = props.resultMap.get(m.id); return r ? draw(m, r) : null; })}</g>
      {cursor()}
    </> : null}
  </>;
});
