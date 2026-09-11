import { memo, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { MemberModel, NodeLink, NodeModel, PrescribedDisplacement, ProjectModel, SupportType } from '../../types';
import type { CanvasSelectionVisualState } from './selectionVisuals';
import type { EditorLayerState } from './editorLayers';
import type { ResultTab } from '../../store/ProjectContext';
import { toDisplay } from '../../foundation/units';
import { unitLabel } from '../../engine/units';
import {
  distributedIntensityAt,
  grossRatioFromFlexible,
  memberAxis,
  pointAtGrossRatio,
  toGlobalVector,
} from '../../graphics/structureGeometry';
import { formatFixed } from '../../utils/numberFormat';
import { elasticIndexPaint } from '../results/elasticDemand';
import type { TranslationKey } from '../../i18n/catalogs';
import type { CandidateTarget } from './candidatePicker';
import { readCanvasViewSettings } from '../view/canvasViewSettings';
import {
  DISTRIBUTED_BASE_HEIGHT_PX,
  resolveMemberLoadPresentation,
  type MemberLoadPresentation,
} from './loadPresentation';

export type StructuralTarget =
  | { kind: 'background' }
  | { kind: 'node'; id: string }
  | { kind: 'member'; id: string }
  | { kind: 'nodalLoad'; id: string }
  | { kind: 'memberLoad'; id: string };

type Units = ProjectModel['settings']['units'];
type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;
type CanvasSettlement = Omit<PrescribedDisplacement, 'caseId'>;

const arrowPath = (x1: number, y1: number, x2: number, y2: number, marker = 'arrow-load-point') => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} markerEnd={`url(#${marker})`} />
);

/** Presentation-only geometry: nodes, members, supports and loads. Selection/edit intents flow out via callback props. */
export interface CanvasGeometryLayerProps {
  /** `members` paints under the result annotations; `objects` (supports/loads/nodes) paints over them. */
  slot: 'members' | 'objects';
  project: ProjectModel;
  nodeMap: Map<string, NodeModel>;
  memberMap: Map<string, MemberModel>;
  toScreen: (x: number, y: number) => { x: number; y: number };
  camera: { scale: number };
  selectionVisualState: CanvasSelectionVisualState;
  candidatePreview: CandidateTarget | null;
  learningFocus: { nodeIds: string[]; memberIds: string[] } | null;
  memberStartId: string | null;
  layers: EditorLayerState;
  loadsLayerVisible: boolean;
  /**
   * η por barra cuando la capa `heatmap` está activa. Vacío significa "sin mapa
   * de calor": la barra conserva su color de dibujo técnico.
   */
  heatmapRatios: ReadonlyMap<string, number>;
  /** `true` mientras la capa está encendida: es lo que hace visible «no evaluado». */
  demandMapActive: boolean;
  resultTab: ResultTab;
  units: Units;
  forceLabel: string;
  momentLabel: string;
  distributedLabel: string;
  t: Translate;
  onObjectPointerDown: (event: ReactPointerEvent, target: StructuralTarget) => void;
  onObjectKeyDown: (event: ReactKeyboardEvent<SVGGElement>, target: Exclude<StructuralTarget, { kind: 'background' }>) => void;
  onShowCut: (event: ReactPointerEvent, member: MemberModel) => void;
  onCutLeave: () => void;
}

const CanvasGeometryLayerImpl = ({
  slot, project, nodeMap, memberMap, toScreen, camera, selectionVisualState, candidatePreview, learningFocus, memberStartId,
  layers, loadsLayerVisible, heatmapRatios, demandMapActive, resultTab, units, forceLabel, momentLabel, distributedLabel, t,
  onObjectPointerDown, onObjectKeyDown, onShowCut, onCutLeave,
}: CanvasGeometryLayerProps) => {
  const view = readCanvasViewSettings(project);
  const selectedNodeIds = selectionVisualState.nodeIds;
  const selectedMemberIds = selectionVisualState.memberIds;
  const configuredSettlements: CanvasSettlement[] = [
    ...(project.prescribedDisplacements ?? []),
    ...project.nodes.flatMap((node) => Object.entries(node.support.prescribed ?? {}).flatMap(([component, value]) => (
      typeof value === 'number'
        ? [{ id: `support:${node.id}:${component}`, nodeId: node.id, component: component as CanvasSettlement['component'], value }]
        : []
    ))),
  ];
  const settlementCountByNode = new Map<string, number>();
  const settlementLaneById = new Map<string, number>();
  for (const settlement of configuredSettlements) {
    const lane = settlementCountByNode.get(settlement.nodeId) ?? 0;
    settlementCountByNode.set(settlement.nodeId, lane + 1);
    settlementLaneById.set(settlement.id, lane);
  }
  const memberLoadPresentation = resolveMemberLoadPresentation(project.memberLoads).sort((left, right) => {
    const leftRaised = selectionVisualState.memberLoadId === left.load.id
      || (candidatePreview?.kind === 'memberLoad' && candidatePreview.id === left.load.id);
    const rightRaised = selectionVisualState.memberLoadId === right.load.id
      || (candidatePreview?.kind === 'memberLoad' && candidatePreview.id === right.load.id);
    return Number(leftRaised) - Number(rightRaised);
  });

  const renderSupport = (node: NodeModel) => {
    const spring = node.support.spring;
    const kx = spring?.kx ?? 0;
    const ky = spring?.ky ?? 0;
    const kr = spring?.kr ?? 0;
    const kNormal = spring?.kNormal ?? 0;
    const hasKx = kx > 0;
    const hasKy = ky > 0;
    const hasKr = kr > 0;
    const hasKNormal = kNormal > 0;
    const hasAnySpring = hasKx || hasKy || hasKr || hasKNormal;

    if (node.support.type === 'none' && !hasAnySpring) return null;
    const p = toScreen(node.x, node.y);
    const selected = selectedNodeIds.includes(node.id);

    const renderGroundHatch = (y: number, width = 18) => (
      <>
        <line x1={-width} y1={y} x2={width} y2={y} className="support-baseplate" strokeWidth="2" strokeLinecap="round" />
        {[-14, -8, -2, 4, 10, 14].filter((x) => Math.abs(x) < width - 1).map((x) => (
          <line key={x} x1={x} y1={y} x2={x - 4} y2={y + 5.5} className="support-hatch" strokeWidth="1.4" strokeLinecap="round" />
        ))}
      </>
    );

    const renderVerticalGroundHatch = (x: number, height = 18, dir = 1) => (
      <>
        <line x1={x} y1={-height} x2={x} y2={height} className="support-baseplate" strokeWidth="2" strokeLinecap="round" />
        {[-14, -8, -2, 4, 10, 14].filter((y) => Math.abs(y) < height - 1).map((y) => (
          <line key={y} x1={x} y1={y} x2={x + dir * 5.5} y2={y + 4} className="support-hatch" strokeWidth="1.4" strokeLinecap="round" />
        ))}
      </>
    );

    const renderAttachedSprings = (baseType: SupportType, baseRotation = 0) => {
      if (!hasAnySpring) return null;
      /* Los resortes son propiedades globales del nudo. El giro de un rodillo
         o de un apoyo visual no puede girarlos dos veces ni esconder una
         dirección cartesiana: se neutraliza aquí y el resorte normal conserva
         su ángulo físico propio. */
      const verticalOffset = baseType === 'none'
        ? 0
        : baseType === 'fixed'
          ? 10
          : baseType === 'pin'
            ? 26
            : baseType === 'roller'
              ? 30
              : 20;
      return (
        <g className="support-springs-group" transform={baseRotation === 0 ? undefined : `rotate(${-baseRotation})`}>
          {hasKx ? (
            <g className="support-spring support-spring--x">
              <line x1="0" y1="0" x2="-4" y2="0" strokeWidth="1.8" />
              <path
                d="M -4 0 L -7 -5 L -10 5 L -13 -5 L -16 5 L -19 -5 L -22 0 L -25 0"
                fill="none"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="support-spring-coil"
              />
              {renderVerticalGroundHatch(-25, 12, -1)}
            </g>
          ) : null}

          {hasKy ? (
            <g className="support-spring support-spring--y" transform={verticalOffset === 0 ? undefined : `translate(0 ${verticalOffset})`}>
              <line x1="0" y1="0" x2="0" y2="4" strokeWidth="1.8" />
              <path
                d="M 0 4 L -5 7 L 5 10 L -5 13 L 5 16 L -5 19 L 0 22 L 0 25"
                fill="none"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="support-spring-coil"
              />
              {renderGroundHatch(25, 14)}
            </g>
          ) : null}

          {hasKNormal ? (
            <g
              className="support-spring support-spring--normal"
              transform={`rotate(${(spring?.angleDeg ?? 90) - 90})`}
            >
              <g transform={verticalOffset === 0 ? undefined : `translate(0 ${verticalOffset})`}>
                <line x1="0" y1="0" x2="0" y2="4" strokeWidth="1.8" />
                <path
                  d="M 0 4 L -5 7 L 5 10 L -5 13 L 5 16 L -5 19 L 0 22 L 0 25"
                  fill="none"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="support-spring-coil"
                />
                {renderGroundHatch(25, 14)}
              </g>
            </g>
          ) : null}

          {hasKr ? (
            baseType === 'none' && !hasKx && !hasKy && !hasKNormal ? (
              <g className="support-spring support-spring--rotational">
                <path
                  d="M 0 2 c -4 0 -7 3 -7 6 s 3 6 6 6 s 5 -2 5 -4.5 s -2 -4 -4 -4 s -3.2 1.4 -3.2 3 L -3.2 20"
                  fill="none"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  className="support-spring-spiral"
                />
                {renderGroundHatch(20, 14)}
              </g>
            ) : (
              <g className="support-spring support-spring--arc">
                <path
                  d="M -9 -2 A 9 9 0 1 1 9 -2"
                  fill="none"
                  strokeWidth="1.8"
                  strokeDasharray="3 2"
                  className="support-spring-arc"
                />
                <path
                  d="M 9 -2 L 12 -4"
                  fill="none"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  className="support-spring-arc"
                />
              </g>
            )
          ) : null}
        </g>
      );
    };

    if (node.support.type === 'fixed') {
      const rotation = node.support.angleDeg ?? 0;
      return (
        <g key={node.id} className={`support-symbol support-fixed${selected ? ' selected' : ''}`} transform={`translate(${p.x} ${p.y}) rotate(${rotation})`} data-support-id={node.id}>
          {selected ? <rect className="support-selection-frame" x="-22" y="-4" width="44" height="22" rx="6" /> : null}
          <line x1="-18" y1="7" x2="18" y2="7" className="support-baseplate" strokeWidth="2.4" strokeLinecap="round" />
          {[-14, -8, -2, 4, 10, 16].map((x) => <line key={x} x1={x} y1="7" x2={x - 5} y2="14" className="support-hatch" strokeWidth="1.4" strokeLinecap="round" />)}
          <line x1="0" y1="0" x2="0" y2="7" strokeWidth="2" />
          {renderAttachedSprings('fixed', rotation)}
          <circle cx="0" cy="0" r="2.2" className="support-pin-dot" />
        </g>
      );
    }

    if (node.support.type === 'pin') {
      const rotation = node.support.angleDeg ?? 0;
      return (
        <g key={node.id} className={`support-symbol support-pin${selected ? ' selected' : ''}`} transform={`translate(${p.x} ${p.y}) rotate(${rotation})`} data-support-id={node.id}>
          {selected ? <rect className="support-selection-frame" x="-20" y="-4" width="40" height="32" rx="7" /> : null}
          <polygon points="0,0 -12,18 12,18" className="support-body-fill" strokeWidth="1.8" strokeLinejoin="round" />
          <line x1="-16" y1="18" x2="16" y2="18" className="support-baseplate" strokeWidth="2" strokeLinecap="round" />
          {[-12, -6, 0, 6, 12].map((x) => <line key={x} x1={x} y1="18" x2={x - 5} y2="24" className="support-hatch" strokeWidth="1.4" strokeLinecap="round" />)}
          {renderAttachedSprings('pin', rotation)}
          <circle cx="0" cy="0" r="2.4" className="support-pin-dot" />
        </g>
      );
    }

    if (node.support.type === 'roller') {
      const rotation = (node.support.angleDeg ?? 90) - 90;
      return (
        <g key={node.id} className={`support-symbol support-roller${selected ? ' selected' : ''}`} transform={`translate(${p.x} ${p.y}) rotate(${rotation})`} data-support-id={node.id}>
          {selected ? <rect className="support-selection-frame" x="-21" y="-4" width="42" height="35" rx="7" /> : null}
          <polygon points="0,0 -11,15 11,15" className="support-body-fill" strokeWidth="1.8" strokeLinejoin="round" />
          <line x1="-13" y1="15" x2="13" y2="15" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="-5.5" cy="18.5" r="2.8" className="support-roller-wheel" strokeWidth="1.5" />
          <circle cx="5.5" cy="18.5" r="2.8" className="support-roller-wheel" strokeWidth="1.5" />
          <line x1="-17" y1="21.5" x2="17" y2="21.5" className="support-baseplate" strokeWidth="2" strokeLinecap="round" />
          {[-12, -6, 0, 6, 12].map((x) => <line key={x} x1={x} y1="21.5" x2={x - 5} y2="26.5" className="support-hatch" strokeWidth="1.4" strokeLinecap="round" />)}
          {renderAttachedSprings('roller', rotation)}
          <circle cx="0" cy="0" r="2.4" className="support-pin-dot" />
        </g>
      );
    }

    if (node.support.type === 'custom') {
      const rotation = node.support.angleDeg ?? 0;
      const rx = Boolean(node.support.restrainX);
      const ry = Boolean(node.support.restrainY);
      const rr = Boolean(node.support.restrainR);

      const isGuideHorizontal = !rx && ry && rr;
      const isGuideVertical = rx && !ry && rr;
      const isRotationalOnly = !rx && !ry && rr;

      return (
        <g key={node.id} className={`support-symbol support-custom${selected ? ' selected' : ''}`} transform={`translate(${p.x} ${p.y}) rotate(${rotation})`} data-support-id={node.id}>
          {selected ? <rect className="support-selection-frame" x="-24" y="-8" width="48" height="38" rx="7" /> : null}

          {isGuideHorizontal ? (
            <g className="support-guide support-guide--horizontal">
              <line x1="0" y1="0" x2="0" y2="3" strokeWidth="2.4" />
              <line x1="-20" y1="3" x2="20" y2="3" strokeWidth="1.4" strokeDasharray="3 2" className="support-guide-track" />
              <rect x="-14" y="3" width="28" height="10" rx="2" className="support-body-fill" strokeWidth="1.8" />
              {renderGroundHatch(13, 20)}
            </g>
          ) : isGuideVertical ? (
            <g className="support-guide support-guide--vertical">
              <line x1="0" y1="0" x2="3" y2="0" strokeWidth="2.4" />
              <line x1="3" y1="-20" x2="3" y2="20" strokeWidth="1.4" strokeDasharray="3 2" className="support-guide-track" />
              <rect x="3" y="-14" width="10" height="28" rx="2" className="support-body-fill" strokeWidth="1.8" />
              {renderVerticalGroundHatch(13, 20, 1)}
            </g>
          ) : isRotationalOnly ? (
            <g className="support-rotational-lock">
              <rect x="-8" y="-8" width="16" height="16" rx="2.5" className="support-body-fill" strokeWidth="1.8" />
              <line x1="0" y1="8" x2="0" y2="15" strokeWidth="2.4" />
              {renderGroundHatch(15, 12)}
            </g>
          ) : rx && ry && rr ? (
            <>
              <line x1="-18" y1="7" x2="18" y2="7" className="support-baseplate" strokeWidth="2.4" strokeLinecap="round" />
              {[-14, -8, -2, 4, 10, 16].map((x) => <line key={x} x1={x} y1="7" x2={x - 5} y2="14" className="support-hatch" strokeWidth="1.4" strokeLinecap="round" />)}
              <line x1="0" y1="0" x2="0" y2="7" strokeWidth="2" />
            </>
          ) : rx && ry && !rr ? (
            <>
              <polygon points="0,0 -12,18 12,18" className="support-body-fill" strokeWidth="1.8" strokeLinejoin="round" />
              <line x1="-16" y1="18" x2="16" y2="18" className="support-baseplate" strokeWidth="2" strokeLinecap="round" />
              {[-12, -6, 0, 6, 12].map((x) => <line key={x} x1={x} y1="18" x2={x - 5} y2="24" className="support-hatch" strokeWidth="1.4" strokeLinecap="round" />)}
            </>
          ) : (
            <>
              {hasAnySpring ? null : (
                <>
                  <line x1="-16" y1="-8" x2="16" y2="-8" strokeWidth="1.8" strokeDasharray="3 2" className="support-guide-track" />
                  <line x1="-16" y1="8" x2="16" y2="8" strokeWidth="1.8" strokeDasharray="3 2" className="support-guide-track" />
                  <rect x="-10" y="-5" width="20" height="10" rx="3" className="support-body-fill" strokeWidth="1.8" />
                </>
              )}
            </>
          )}

          {renderAttachedSprings('custom', rotation)}
          <circle cx="0" cy="0" r="2.4" className="support-pin-dot" />
        </g>
      );
    }

    if (hasAnySpring) {
      const rotation = node.support.angleDeg ?? 0;
      return (
        <g key={node.id} className={`support-symbol support-spring${selected ? ' selected' : ''}`} transform={`translate(${p.x} ${p.y}) rotate(${rotation})`} data-support-id={node.id}>
          {selected ? <rect className="support-selection-frame" x="-28" y="-8" width="56" height="38" rx="7" /> : null}
          {renderAttachedSprings('none', rotation)}
          <circle cx="0" cy="0" r="2.4" className="support-pin-dot" />
        </g>
      );
    }

    return null;
  };

  const renderSettlement = (settlement: CanvasSettlement) => {
    const node = nodeMap.get(settlement.nodeId);
    if (!node) return null;
    const point = toScreen(node.x, node.y);
    const angleDeg = settlement.component === 'normal'
      ? node.support.angleDeg ?? 90
      : settlement.component === 'ux'
        ? 0
        : 90;
    const lane = settlementLaneById.get(settlement.id) ?? 0;
    const lateralOffset = lane * 10;
    const direction = settlement.value < 0 ? -1 : 1;
    const directionName = direction < 0 ? 'negative' : 'positive';

    if (settlement.component === 'rz') {
      return <g
        key={settlement.id}
        className="support-settlement-symbol support-settlement-symbol--rotation"
        data-settlement-id={settlement.id}
        data-settlement-direction={directionName}
        data-settlement-lane={lane}
        transform={`translate(${point.x + lateralOffset} ${point.y - 24})`}
      >
        {direction > 0 ? <><path d="M -11 0 A 11 11 0 1 1 8 -7" /><path d="M 8 -7 L 4 -8 M 8 -7 L 7 -3" /></> : <><path d="M 11 0 A 11 11 0 1 0 -8 -7" /><path d="M -8 -7 L -4 -8 M -8 -7 L -7 -3" /></>}
        <text x="14" y="-9">Δθ</text>
      </g>;
    }

    return <g
      key={settlement.id}
      className="support-settlement-symbol"
      data-settlement-id={settlement.id}
      data-settlement-direction={directionName}
      data-settlement-lane={lane}
      transform={`translate(${point.x} ${point.y}) rotate(${-angleDeg}) translate(0 ${lateralOffset})`}
    >
      <line x1={direction > 0 ? 8 : 34} y1="0" x2={direction > 0 ? 34 : 8} y2="0" />
      {direction > 0 ? <path d="M 34 0 L 28 -4 M 34 0 L 28 4" /> : <path d="M 8 0 L 14 -4 M 8 0 L 14 4" />}
      <text x="19" y="-7">Δ</text>
    </g>;
  };

  const linkGlyph = (behavior: NodeLink['behavior']) => {
    if (behavior === 'compression-only') return <path className="node-link-symbol__mark" d="M 9 -5 L 16 0 L 9 5 M 19 -6 V 6" />;
    if (behavior === 'tension-only') return <path className="node-link-symbol__mark" d="M 16 -5 L 9 0 L 16 5 M 6 -6 V 6" />;
    if (behavior === 'stop') return <path className="node-link-symbol__mark" d="M 7 -7 V 7 M 18 -7 V 7 M 10 0 H 15" />;
    if (behavior === 'friction') return <path className="node-link-symbol__mark" d="M 7 -5 L 16 4 M 10 -8 L 19 1 M 4 -2 L 13 7" />;
    return <path className="node-link-symbol__mark" d="M 5 0 L 8 -5 L 11 5 L 14 -5 L 17 5 L 20 0" />;
  };

  const renderNodeLink = (link: NodeLink) => {
    const startNode = nodeMap.get(link.nodeI);
    if (!startNode) return null;
    const start = toScreen(startNode.x, startNode.y);
    const endNode = link.nodeJ ? nodeMap.get(link.nodeJ) : undefined;
    const angleDeg = link.angleDeg ?? 0;

    if (endNode) {
      const end = toScreen(endNode.x, endNode.y);
      const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      return <g key={link.id} className={`node-link-symbol node-link--${link.behavior}`} data-node-link-id={link.id}>
        <line className="node-link-symbol__span" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
        <g transform={`translate(${midpoint.x} ${midpoint.y}) rotate(${-angleDeg})`}>
          <rect x="3" y="-9" width="19" height="18" rx="3" className="node-link-symbol__plate" />
          {linkGlyph(link.behavior)}
        </g>
      </g>;
    }

    return <g
      key={link.id}
      className={`node-link-symbol node-link--${link.behavior}`}
      data-node-link-id={link.id}
      transform={`translate(${start.x} ${start.y}) rotate(${-angleDeg})`}
    >
      <line x1="0" y1="0" x2="5" y2="0" className="node-link-symbol__span" />
      <rect x="5" y="-9" width="19" height="18" rx="3" className="node-link-symbol__plate" />
      {linkGlyph(link.behavior)}
      <line x1="26" y1="-13" x2="26" y2="13" className="node-link-symbol__ground" />
      {[-9, -3, 3, 9].map((y) => <line key={y} x1="26" y1={y} x2="31" y2={y + 4} className="node-link-symbol__hatch" />)}
    </g>;
  };

  const renderNodalLoad = (load: ProjectModel['nodalLoads'][number]) => {
    const node = nodeMap.get(load.nodeId);
    if (!node) return null;
    const p = toScreen(node.x, node.y);
    const magnitude = Math.hypot(load.fx, load.fy);
    const selected = selectionVisualState.nodalLoadId === load.id;
    const previewed = candidatePreview?.kind === 'nodalLoad' && candidatePreview.id === load.id;
    if (magnitude > 1e-9) {
      const ux = load.fx / magnitude; const uy = -load.fy / magnitude;
      const length = 54;
      const start = { x: p.x - ux * length, y: p.y - uy * length };
      const end = { x: p.x - ux * 8, y: p.y - uy * 8 };
      return (
        <g key={load.id} className={`load-symbol load-symbol--point${selected ? ' selected' : ''}${previewed ? ' candidate-preview' : ''}`} data-load-lane="point" data-structure-object data-structure-kind="nodalLoad" data-structure-id={load.id} data-candidate-preview={previewed ? 'true' : undefined} role="button" tabIndex={0} aria-keyshortcuts="Enter Space" aria-label={t('canvas.pointLoadAria', { id: load.id, target: load.nodeId, value: formatFixed(toDisplay(magnitude, units, 'force'), 2), unit: forceLabel })} aria-pressed={selected} onPointerDown={(event) => onObjectPointerDown(event, { kind: 'nodalLoad', id: load.id })} onKeyDown={(event) => onObjectKeyDown(event, { kind: 'nodalLoad', id: load.id })}>
          {selected ? <line className="load-selection-halo" x1={start.x} y1={start.y} x2={end.x} y2={end.y} /> : null}
          {previewed ? <line className="candidate-preview-halo" x1={start.x} y1={start.y} x2={end.x} y2={end.y} /> : null}
          <line className="load-hit" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
          {arrowPath(start.x, start.y, end.x, end.y)}
        </g>
      );
    }
    if (Math.abs(load.mz) > 1e-9) {
      const momentPath = `M ${p.x - 20} ${p.y - 8} A 22 22 0 1 1 ${p.x + 17} ${p.y - 14}`;
      return <g key={load.id} className={`load-symbol load-symbol--moment${selected ? ' selected' : ''}${previewed ? ' candidate-preview' : ''}`} data-load-lane="moment-outer" data-structure-object data-structure-kind="nodalLoad" data-structure-id={load.id} data-candidate-preview={previewed ? 'true' : undefined} role="button" tabIndex={0} aria-keyshortcuts="Enter Space" aria-label={t('canvas.momentLoadAria', { id: load.id, target: load.nodeId, value: formatFixed(toDisplay(load.mz, units, 'moment'), 2), unit: momentLabel })} aria-pressed={selected} onPointerDown={(event) => onObjectPointerDown(event, { kind: 'nodalLoad', id: load.id })} onKeyDown={(event) => onObjectKeyDown(event, { kind: 'nodalLoad', id: load.id })}>
        {selected ? <path className="load-selection-halo" d={momentPath} /> : null}
        {previewed ? <path className="candidate-preview-halo" d={momentPath} /> : null}
        <path className="load-hit" d={momentPath} />
        <path d={momentPath} fill="none" markerEnd="url(#arrow-load-moment)" />
      </g>;
    }
    return null;
  };

  const renderMemberLoad = (presentation: MemberLoadPresentation) => {
    const { load, lane } = presentation;
    const target = memberMap.get(load.memberId);
    if (!target) return null;
    const ni = nodeMap.get(target.i)!; const nj = nodeMap.get(target.j)!;
    const axis = memberAxis(target, ni, nj);
    const screenI = toScreen(ni.x, ni.y); const screenJ = toScreen(nj.x, nj.y);
    const screenDx = screenJ.x - screenI.x; const screenDy = screenJ.y - screenI.y;
    const screenLength = Math.hypot(screenDx, screenDy) || 1;
    let outwardNormal = { x: -screenDy / screenLength, y: screenDx / screenLength };
    if (outwardNormal.y > 0 || (Math.abs(outwardNormal.y) < 1e-9 && outwardNormal.x < 0)) {
      outwardNormal = { x: -outwardNormal.x, y: -outwardNormal.y };
    }
    const stationOf = (flexibleRatio: number) => {
      const point = pointAtGrossRatio(axis, grossRatioFromFlexible(axis, flexibleRatio));
      return toScreen(point.x, point.y);
    };
    const selected = selectionVisualState.memberLoadId === load.id;
    const previewed = candidatePreview?.kind === 'memberLoad' && candidatePreview.id === load.id;
    if (load.type === 'point') {
      const base = stationOf(load.position ?? 0.5);
      const px = load.px ?? 0; const py = load.py ?? 0; const mag = Math.hypot(px, py) || 1;
      const [gx, gy] = toGlobalVector(axis, load.coordinateSystem, px, py);
      const ux = gx / mag; const uy = -gy / mag;
      const headOffset = presentation.pointHeadOffsetPx ?? 7;
      const tailOffset = presentation.pointTailOffsetPx ?? 52;
      const start = {
        x: base.x - ux * tailOffset,
        y: base.y - uy * tailOffset,
      };
      const end = { x: base.x - ux * headOffset, y: base.y - uy * headOffset };
      return <g key={load.id} className={`load-symbol load-symbol--point${selected ? ' selected' : ''}${previewed ? ' candidate-preview' : ''}`} data-load-lane={lane} data-point-stack-index={presentation.pointStackIndex} data-point-stack-count={presentation.pointStackCount} data-structure-object data-structure-kind="memberLoad" data-structure-id={load.id} data-candidate-preview={previewed ? 'true' : undefined} role="button" tabIndex={0} aria-keyshortcuts="Enter Space" aria-label={t('canvas.pointLoadAria', { id: load.id, target: load.memberId, value: formatFixed(toDisplay(mag, units, 'force'), 2), unit: forceLabel })} aria-pressed={selected} onPointerDown={(event) => onObjectPointerDown(event, { kind: 'memberLoad', id: load.id })} onKeyDown={(event) => onObjectKeyDown(event, { kind: 'memberLoad', id: load.id })}>{selected ? <line className="load-selection-halo" x1={start.x} y1={start.y} x2={end.x} y2={end.y} /> : null}{previewed ? <line className="candidate-preview-halo" x1={start.x} y1={start.y} x2={end.x} y2={end.y} /> : null}<line className="load-hit" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />{arrowPath(start.x, start.y, end.x, end.y)}</g>;
    }
    if (load.type === 'moment') {
      const base = stationOf(load.position ?? 0.5);
      const momentBase = { x: base.x + outwardNormal.x * 14, y: base.y + outwardNormal.y * 14 };
      const clockwise = (load.moment ?? 0) < 0;
      const path = clockwise
        ? `M ${momentBase.x - 22} ${momentBase.y - 3} A 23 23 0 1 0 ${momentBase.x + 18} ${momentBase.y - 13}`
        : `M ${momentBase.x + 22} ${momentBase.y - 3} A 23 23 0 1 1 ${momentBase.x - 18} ${momentBase.y - 13}`;
      return <g key={load.id} className={`load-symbol load-symbol--moment${selected ? ' selected' : ''}${previewed ? ' candidate-preview' : ''}`} data-load-lane={lane} data-structure-object data-structure-kind="memberLoad" data-structure-id={load.id} data-candidate-preview={previewed ? 'true' : undefined} role="button" tabIndex={0} aria-keyshortcuts="Enter Space" aria-label={t('canvas.momentLoadAria', { id: load.id, target: load.memberId, value: formatFixed(toDisplay(load.moment ?? 0, units, 'moment'), 2), unit: momentLabel })} aria-pressed={selected} onPointerDown={(event) => onObjectPointerDown(event, { kind: 'memberLoad', id: load.id })} onKeyDown={(event) => onObjectKeyDown(event, { kind: 'memberLoad', id: load.id })}>{selected ? <path className="load-selection-halo" d={path} /> : null}{previewed ? <path className="candidate-preview-halo" d={path} /> : null}<path className="load-hit" d={path} /><path d={path} markerEnd="url(#arrow-load-moment)" /></g>;
    }
    const visibleLoadedLength = axis.length * camera.scale * Math.abs(load.end - load.start);
    const count = Math.max(3, Math.min(9, Math.round(visibleLoadedLength / 34) + 1));
    const startVector = toGlobalVector(axis, load.coordinateSystem, load.qxStart ?? 0, load.qyStart ?? 0);
    const endVector = toGlobalVector(axis, load.coordinateSystem, load.qxEnd ?? load.qxStart ?? 0, load.qyEnd ?? load.qyStart ?? 0);
    const primaryComponent = Math.max(Math.abs(startVector[1]), Math.abs(endVector[1])) >= Math.max(Math.abs(startVector[0]), Math.abs(endVector[0])) ? 1 : 0;
    const signedStart = startVector[primaryComponent];
    const signedEnd = endVector[primaryComponent];
    const maximumIntensity = Math.max(Math.abs(signedStart), Math.abs(signedEnd), 1e-9);
    const sampleStations = Array.from({ length: count }, (_, index) => index / (count - 1));
    if (signedStart * signedEnd < 0) sampleStations.push(-signedStart / (signedEnd - signedStart));
    sampleStations.sort((left, right) => left - right);
    const uniqueStations = sampleStations.filter((station, index) => index === 0 || Math.abs(station - sampleStations[index - 1]) > 1e-9);
    const maximumArrowLength = DISTRIBUTED_BASE_HEIGHT_PX;
    const distributedBaseOffset = presentation.distributedBaseOffsetPx ?? 0;
    const samples = uniqueStations.map((t) => {
      const memberBase = stationOf(load.start + (load.end - load.start) * t);
      const { qx, qy } = distributedIntensityAt(load, t);
      const global = toGlobalVector(axis, load.coordinateSystem, qx, qy);
      const signedIntensity = global[primaryComponent];
      // La silueta de carga es deliberadamente ortogonal a la pantalla: todas
      // las flechas quedan verticales y la arista superior describe con una
      // sola recta la variación 0→q (triángulo) o q1→q2 (trapecio).
      const length = maximumArrowLength * (Math.abs(signedIntensity) / maximumIntensity);
      return { t, memberBase, length, sign: Math.sign(signedIntensity) };
    });
    const bandGeometry = (sample: (typeof samples)[number], sign = sample.sign) => {
      const base = {
        x: sample.memberBase.x,
        y: sample.memberBase.y + sign * distributedBaseOffset,
      };
      return {
        base,
        tail: { x: base.x, y: base.y + sign * sample.length },
      };
    };
    const arrows = samples
      .filter(({ sign }) => sign !== 0)
      .map((sample) => {
        const { base, tail } = bandGeometry(sample);
        return <line key={sample.t} x1={tail.x} y1={tail.y} x2={base.x} y2={base.y} markerEnd="url(#arrow-load-distributed)" />;
      });
    const envelopeLobes: Array<{ sign: number; samples: typeof samples }> = [];
    let currentLobe: typeof samples = [];
    let currentSign = 0;
    let zeroBoundary: (typeof samples)[number] | null = null;
    for (const sample of samples) {
      if (sample.sign === 0) {
        zeroBoundary = sample;
        if (currentLobe.length) {
          currentLobe.push(sample);
          envelopeLobes.push({ sign: currentSign, samples: currentLobe });
          currentLobe = [];
          currentSign = 0;
        }
        continue;
      }
      if (currentSign === 0) {
        currentSign = sample.sign;
        currentLobe = zeroBoundary ? [zeroBoundary, sample] : [sample];
        zeroBoundary = null;
      } else {
        currentLobe.push(sample);
      }
    }
    if (currentLobe.length) envelopeLobes.push({ sign: currentSign, samples: currentLobe });
    const qStartMagnitude = Math.hypot(load.qxStart ?? 0, load.qyStart ?? 0);
    const qEndMagnitude = Math.hypot(load.qxEnd ?? load.qxStart ?? 0, load.qyEnd ?? load.qyStart ?? 0);
    const average = (qStartMagnitude + qEndMagnitude) / 2;
    const hitStart = stationOf(load.start);
    const hitEnd = stationOf(load.end);
    const envelopePaths = envelopeLobes.map((lobe) => {
      const geometry = lobe.samples.map((sample) => bandGeometry(sample, lobe.sign));
      const points = [...geometry.map(({ tail }) => tail), ...[...geometry].reverse().map(({ base }) => base)];
      return `M ${points.map((point) => `${point.x} ${point.y}`).join(' L ')} Z`;
    });
    return <g key={load.id} className={`distributed-symbol load-symbol--distributed${selected ? ' selected' : ''}${previewed ? ' candidate-preview' : ''}`} data-load-lane={lane} data-load-stack-offset={distributedBaseOffset} data-structure-object data-structure-kind="memberLoad" data-structure-id={load.id} data-candidate-preview={previewed ? 'true' : undefined} role="button" tabIndex={0} aria-keyshortcuts="Enter Space" aria-label={t('canvas.distributedLoadAria', { id: load.id, target: load.memberId, value: formatFixed(toDisplay(average, units, 'distributedForce'), 2), unit: distributedLabel })} aria-pressed={selected} onPointerDown={(event) => onObjectPointerDown(event, { kind: 'memberLoad', id: load.id })} onKeyDown={(event) => onObjectKeyDown(event, { kind: 'memberLoad', id: load.id })}>{selected ? <line className="load-selection-halo" x1={hitStart.x} y1={hitStart.y} x2={hitEnd.x} y2={hitEnd.y} /> : null}{previewed ? <line className="candidate-preview-halo" x1={hitStart.x} y1={hitStart.y} x2={hitEnd.x} y2={hitEnd.y} /> : null}<line className="load-hit" x1={hitStart.x} y1={hitStart.y} x2={hitEnd.x} y2={hitEnd.y} />{envelopePaths.map((path, index) => <path key={index} className="distributed-envelope" d={path} />)}{arrows}</g>;
  };

  const renderPointStackGuide = (presentation: MemberLoadPresentation) => {
    const { load } = presentation;
    if (load.type !== 'point' || !presentation.drawsPointGuide) return null;
    const target = memberMap.get(load.memberId);
    if (!target) return null;
    const ni = nodeMap.get(target.i); const nj = nodeMap.get(target.j);
    if (!ni || !nj) return null;
    const axis = memberAxis(target, ni, nj);
    const point = pointAtGrossRatio(axis, grossRatioFromFlexible(axis, load.position ?? 0.5));
    const base = toScreen(point.x, point.y);
    const px = load.px ?? 0; const py = load.py ?? 0; const magnitude = Math.hypot(px, py) || 1;
    const [gx, gy] = toGlobalVector(axis, load.coordinateSystem, px, py);
    const ux = gx / magnitude; const uy = -gy / magnitude;
    const guideStartOffset = 7;
    const guideEndOffset = presentation.pointHeadOffsetPx ?? guideStartOffset;
    return <line
      key={`point-stack-guide:${load.id}`}
      className="point-load-stack-guide"
      data-point-stack-guide-for={load.id}
      x1={base.x - ux * guideStartOffset}
      y1={base.y - uy * guideStartOffset}
      x2={base.x - ux * guideEndOffset}
      y2={base.y - uy * guideEndOffset}
    />;
  };

  if (slot === 'members') {
    return (
      <g className="member-layer">
        {project.members.map((member) => {
          const ni = nodeMap.get(member.i); const nj = nodeMap.get(member.j); if (!ni || !nj) return null;
          const a = toScreen(ni.x, ni.y); const b = toScreen(nj.x, nj.y);
          const axis = memberAxis(member, ni, nj);
          const selected = selectedMemberIds.includes(member.id);
          const previewed = candidatePreview?.kind === 'member' && candidatePreview.id === member.id;
          const learningHighlighted = learningFocus?.memberIds.includes(member.id) ?? false;
          const demandRatio = heatmapRatios.get(member.id);
          // Gancho de diagnóstico, no un número en pantalla: se redondea sin
          // `toFixed` para no depender del locale ni de la política de
          // presentación, que gobierna sólo lo que el usuario lee.
          const demandAttribute = demandRatio === undefined ? undefined : String(Math.round(demandRatio * 1000) / 1000);
          const paint = demandRatio === undefined ? null : elasticIndexPaint(demandRatio);
          /* Un miembro que no pudo evaluarse no puede quedarse con su trazo
             técnico normal: sería indistinguible de uno con η baja. Se marca como
             **no evaluado** y la leyenda cuenta cuántos son. */
          const unevaluated = demandMapActive && demandRatio === undefined;
          return (
            <g
              key={member.id}
              data-structure-object
              data-structure-kind="member"
              data-structure-id={member.id}
              data-demand-ratio={demandAttribute}
              data-demand-at-reference={paint?.atReference ? 'true' : undefined}
              data-demand-saturated={paint?.saturated ? 'true' : undefined}
              data-elastic-index={unevaluated ? 'unevaluated' : paint ? 'evaluated' : undefined}
              /* El color térmico viaja como custom property y no como `stroke`:
                 así la selección y el foco pedagógico siguen ganando por CSS. */
              style={paint === null ? undefined : { '--member-demand-color': paint.color } as CSSProperties}
              className={`member-object ${selected ? 'selected' : ''}${previewed ? ' candidate-preview' : ''} ${learningHighlighted ? 'learning-highlight' : ''} ${member.type}${paint === null ? '' : ' has-demand'}${unevaluated ? ' is-unevaluated' : ''}`}
              data-candidate-preview={previewed ? 'true' : undefined}
              role="button"
              tabIndex={0}
              aria-keyshortcuts="Enter Space"
              aria-label={t('canvas.memberAria', { id: member.id, i: member.i, j: member.j })}
              aria-pressed={selected}
              onPointerDown={(event) => onObjectPointerDown(event, { kind: 'member', id: member.id })}
              onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => onObjectKeyDown(event, { kind: 'member', id: member.id })}
              onPointerMove={(event) => onShowCut(event, member)}
              onPointerLeave={onCutLeave}
            >
              {selected ? <line className="member-selection-halo" x1={a.x} y1={a.y} x2={b.x} y2={b.y} /> : null}
              {previewed ? <line className="candidate-preview-halo" x1={a.x} y1={a.y} x2={b.x} y2={b.y} /> : null}
              <line className="member-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              <line className="member-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              {layers.dimensions && view.showDimensions ? (() => {
                const screenLength = Math.hypot(b.x - a.x, b.y - a.y);
                if (screenLength < 24) return null;
                const ux = (b.x - a.x) / screenLength;
                const uy = (b.y - a.y) / screenLength;
                const nx = -uy;
                const ny = ux;
                const offset = 38;
                const start = { x: a.x + nx * offset, y: a.y + ny * offset };
                const end = { x: b.x + nx * offset, y: b.y + ny * offset };
                const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
                let angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
                if (angle > 90 || angle < -90) angle += 180;
                const value = `${formatFixed(toDisplay(axis.flexibleLength, units, 'length'), 2)} ${unitLabel(units, 'length')}`;
                return <g className="member-dimension" pointerEvents="none">
                  <line className="member-dimension-extension" x1={a.x} y1={a.y} x2={start.x} y2={start.y} />
                  <line className="member-dimension-extension" x1={b.x} y1={b.y} x2={end.x} y2={end.y} />
                  <line className="member-dimension-line" x1={start.x} y1={start.y} x2={end.x} y2={end.y} markerStart="url(#arrow-dimension)" markerEnd="url(#arrow-dimension)" />
                  <text transform={`translate(${center.x} ${center.y - 6}) rotate(${angle})`} textAnchor="middle">{value}</text>
                </g>;
              })() : null}
              {member.type === 'frame' && ((member.rigidOffsetI ?? 0) > 0 || (member.rigidOffsetJ ?? 0) > 0) ? (() => {
                const length = Math.hypot(nj.x - ni.x, nj.y - ni.y);
                const ti = length > 0 ? (member.rigidOffsetI ?? 0) / length : 0;
                const tj = length > 0 ? (member.rigidOffsetJ ?? 0) / length : 0;
                const faceI = toScreen(ni.x + (nj.x - ni.x) * ti, ni.y + (nj.y - ni.y) * ti);
                const faceJ = toScreen(nj.x - (nj.x - ni.x) * tj, nj.y - (nj.y - ni.y) * tj);
                return <g className="rigid-zone-layer"><line x1={a.x} y1={a.y} x2={faceI.x} y2={faceI.y} /><line x1={faceJ.x} y1={faceJ.y} x2={b.x} y2={b.y} /><circle cx={faceI.x} cy={faceI.y} r="3" /><circle cx={faceJ.x} cy={faceJ.y} r="3" /></g>;
              })() : null}
              {layers.dimensions && view.showLocalAxes ? (() => {
                const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
                const length = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
                const ux = (b.x - a.x) / length; const uy = (b.y - a.y) / length;
                const vx = uy; const vy = -ux;
                return <g className="local-axes"><line x1={mx} y1={my} x2={mx + ux * 34} y2={my + uy * 34} /><line x1={mx} y1={my} x2={mx + vx * 27} y2={my + vy * 27} /><text x={mx + ux * 41} y={my + uy * 41}>x</text><text x={mx + vx * 34} y={my + vy * 34}>y</text></g>;
              })() : null}
            </g>
          );
        })}
      </g>
    );
  }

  return <>
    <g className="support-layer">{project.nodes.map(renderSupport)}</g>
    <g className="support-settlement-layer">{configuredSettlements.map(renderSettlement)}</g>
    <g className="node-link-layer">{(project.nodeLinks ?? []).map(renderNodeLink)}</g>
    {loadsLayerVisible && view.showLoads && resultTab !== 'influence' ? <g className="load-layer">{memberLoadPresentation.map(renderPointStackGuide)}{memberLoadPresentation.map(renderMemberLoad)}{project.nodalLoads.map(renderNodalLoad)}</g> : null}
    <g className="node-layer">
      {project.nodes.map((node) => {
        const p = toScreen(node.x, node.y);
        const selected = selectedNodeIds.includes(node.id);
        const previewed = candidatePreview?.kind === 'node' && candidatePreview.id === node.id;
        const start = memberStartId === node.id;
        const learningHighlighted = learningFocus?.nodeIds.includes(node.id) ?? false;
        return (
          <g
            key={node.id}
            className={`node-object ${selected ? 'selected' : ''}${previewed ? ' candidate-preview' : ''} ${start ? 'member-start' : ''} ${learningHighlighted ? 'learning-highlight' : ''}`}
            data-structure-object
            data-structure-kind="node"
            data-structure-id={node.id}
            data-candidate-preview={previewed ? 'true' : undefined}
            role="button"
            tabIndex={0}
            aria-keyshortcuts="Enter Space"
            aria-label={t('canvas.nodeAria', { id: node.id, x: formatFixed(node.x, 3), y: formatFixed(node.y, 3) })}
            aria-pressed={selected}
            onPointerDown={(event) => onObjectPointerDown(event, { kind: 'node', id: node.id })}
            onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => onObjectKeyDown(event, { kind: 'node', id: node.id })}
          >
            {selected ? <><circle className="node-selection-halo" cx={p.x} cy={p.y} r="14" /><path className="node-selection-cross" d={`M ${p.x - 18} ${p.y} H ${p.x + 18} M ${p.x} ${p.y - 18} V ${p.y + 18}`} /></> : null}
            {previewed ? <circle className="candidate-preview-ring" cx={p.x} cy={p.y} r="18" /> : null}
            <circle className="node-hit" cx={p.x} cy={p.y} r="20" />
            <circle className="node-dot" cx={p.x} cy={p.y} r="7" />
            {node.internalHinge ? <circle className="internal-hinge-symbol" cx={p.x} cy={p.y} r="11" /> : null}
          </g>
        );
      })}
    </g>
  </>;
};

export const CanvasGeometryLayer = memo(CanvasGeometryLayerImpl);
