import type { KeyboardEvent } from 'react';
import type { FrameDesignResult, FrameDiagramMember, FrameMemberKind } from '../../../design/elements/frame';
import { formatNumber } from './common';

export type FrameDiagramKind = 'ratio' | 'moment' | 'shear' | 'axial' | 'deformed';

export interface FrameMemberKey {
  readonly kind: FrameMemberKind;
  readonly story: number;
  /** Claro (vigas) o eje (columnas). */
  readonly index: number;
}

export const FRAME_DIAGRAMS: readonly { value: FrameDiagramKind; label: string }[] = [
  { value: 'ratio', label: 'Utilización' },
  { value: 'moment', label: 'Momento' },
  { value: 'shear', label: 'Cortante' },
  { value: 'axial', label: 'Axial' },
  { value: 'deformed', label: 'Deformada' },
];

const UNIT: Record<Exclude<FrameDiagramKind, 'ratio' | 'deformed'>, string> = { moment: 'kN·m', shear: 'kN', axial: 'kN' };

export const memberLabel = (member: Pick<FrameDiagramMember, 'kind' | 'story' | 'index'>) => member.kind === 'beam'
  ? `Viga del nivel ${member.story + 1}, claro ${member.index + 1}`
  : `Columna del eje ${member.index + 1}, nivel ${member.story + 1}`;

const sameMember = (a: FrameMemberKey | null | undefined, b: FrameMemberKey) =>
  Boolean(a && a.kind === b.kind && a.story === b.story && (a.kind === 'beam' ? true : a.index === b.index));

/** Banda de utilización de un miembro: muestra lo holgado en gris y lo que se acerca o pasa del límite como aviso. */
export const ratioBand = (ratio: number) => ratio > 1 + 1e-9 ? 'fail' : ratio > 0.9 ? 'near' : ratio > 0.6 ? 'mid' : 'low';

const WIDTH = 820;
const LEFT = 100;
const RIGHT = 100;
const BOTTOM = 58;
/** Distancia mínima entre rótulos de valores, px. */
const LABEL_GAP = 30;

/**
 * Elevación del pórtico. Cada miembro lleva su diagrama envolvente (momento
 * del lado de la tensión, cortante y axial del lado positivo) o la deformada;
 * en «Utilización» cada miembro se rotula con el cociente que rige. Con
 * `onSelect`, los miembros se eligen con clic o teclado.
 */
export function FrameElevation({ result, kind, selected, onSelect }: {
  result: FrameDesignResult;
  kind: FrameDiagramKind;
  selected?: FrameMemberKey | null;
  onSelect?: (member: FrameMemberKey) => void;
}) {
  const xs = [...new Set(result.nodes.map((node) => node.x))].sort((a, b) => a - b);
  const ys = [...new Set(result.nodes.map((node) => node.y))].sort((a, b) => a - b);
  const spanX = xs[xs.length - 1]! || 1;
  const spanY = ys[ys.length - 1]! || 1;
  const plotWidth = WIDTH - LEFT - RIGHT;
  const scale = Math.min(plotWidth / spanX, 420 / spanY);
  const shortest = Math.min(...xs.slice(1).map((x, index) => x - xs[index]!), ...ys.slice(1).map((y, index) => y - ys[index]!));
  // Amplitud del diagrama mayor; el margen superior la reserva para que el lienzo no salte al cambiar de diagrama.
  const amplitude = Math.min(0.2 * shortest * scale, 46);
  const top = 26 + amplitude;
  const height = top + spanY * scale + BOTTOM;
  const ox = LEFT + (plotWidth - spanX * scale) / 2;
  const sx = (x: number) => ox + x * scale;
  const sy = (y: number) => top + (spanY - y) * scale;

  const series = (member: FrameDiagramMember): readonly (readonly number[])[] => kind === 'moment'
    ? [member.momentMaxKnm, member.momentMinKnm]
    : kind === 'shear' ? [member.shearMaxKn, member.shearMinKn]
      : kind === 'axial' ? [member.axialMaxKn, member.axialMinKn] : [];
  const maxAbs = Math.max(1e-9, ...result.members.flatMap((member) => series(member).flat().map(Math.abs)));
  const lateral = result.lateral;
  const deformation = (member: FrameDiagramMember) => ({ u: lateral ? member.lateralU : member.serviceU, v: lateral ? member.lateralV : member.serviceV });
  const maxDisplacement = Math.max(1e-12, ...result.members.flatMap((member) => {
    const { u, v } = deformation(member);
    return v.map((value, index) => Math.hypot(value, u[index]!));
  }));
  const deformScale = 0.07 * Math.max(spanX, spanY) / maxDisplacement;

  const frameOf = (member: FrameDiagramMember) => {
    const dx = member.end.x - member.start.x;
    const dy = member.end.y - member.start.y;
    const length = Math.hypot(dx, dy);
    const c = dx / length;
    const s = dy / length;
    // Punto a la distancia x del nudo i desplazado `offset` px según la normal local +y.
    const at = (x: number, offsetPx: number) => ({
      x: sx(member.start.x + c * x) - s * offsetPx,
      y: sy(member.start.y + s * x) - c * offsetPx,
    });
    return { at, c, s, length };
  };
  const pathOf = (points: readonly { x: number; y: number }[]) => points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');

  const diagramOf = (member: FrameDiagramMember) => {
    const { at } = frameOf(member);
    // Momento del lado de la tensión (−y local); cortante y axial positivos hacia +y.
    const sign = kind === 'moment' ? -1 : 1;
    return series(member).map((values) => {
      const curve = member.stations.map((x, index) => at(x, sign * values[index]! / maxAbs * amplitude));
      const area = [at(0, 0), ...curve, at(member.stations[member.stations.length - 1]!, 0)];
      return { curve, area };
    });
  };
  // Rótulos: extremos de cada miembro y su pico interior; se conservan los mayores que no se enciman.
  const labels = (() => {
    if (kind !== 'moment' && kind !== 'shear' && kind !== 'axial') return [];
    const sign = kind === 'moment' ? -1 : 1;
    const candidates: { x: number; y: number; value: number }[] = [];
    for (const member of result.members) {
      const { at } = frameOf(member);
      for (const values of series(member)) {
        let peak = 0;
        values.forEach((value, position) => { if (Math.abs(value) > Math.abs(values[peak]!)) peak = position; });
        for (const index of new Set([0, values.length - 1, peak])) {
          const value = values[index]!;
          if (Math.abs(value) < maxAbs * 0.05) continue;
          const offset = sign * value / maxAbs * amplitude;
          candidates.push({ ...at(member.stations[index]!, offset + Math.sign(offset) * 10), value });
        }
      }
    }
    const kept: typeof candidates = [];
    for (const candidate of candidates.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))) {
      if (!kept.some((item) => Math.hypot(item.x - candidate.x, item.y - candidate.y) < LABEL_GAP)) kept.push(candidate);
    }
    return kept;
  })();

  const deformedOf = (member: FrameDiagramMember) => {
    const { c, s } = frameOf(member);
    const { u, v } = deformation(member);
    return member.stations.map((x, index) => {
      const wx = member.start.x + c * x + (c * u[index]! - s * v[index]!) * deformScale;
      const wy = member.start.y + s * x + (s * u[index]! + c * v[index]!) * deformScale;
      return { x: sx(wx), y: sy(wy) };
    });
  };

  const keyOf = (member: FrameDiagramMember): FrameMemberKey => ({ kind: member.kind, story: member.story, index: member.index });
  const onKey = (event: KeyboardEvent<SVGElement>, member: FrameDiagramMember) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect?.(keyOf(member));
  };
  const levelLoads = result.input.stories;
  const baseNodes = result.nodes.filter((node) => node.y === 0);
  const percent = (ratio: number) => Number.isFinite(ratio) ? `${Math.round(ratio * 100)} %` : '—';
  const description = kind === 'ratio'
    ? `Pórtico de ${xs.length - 1} ${xs.length === 2 ? 'claro' : 'claros'} y ${ys.length - 1} ${ys.length === 2 ? 'nivel' : 'niveles'}: utilización máxima ${percent(result.governingRatio)}`
    : kind === 'deformed'
      ? `Deformada del pórtico ${lateral ? 'bajo la acción lateral' : 'con las cargas de servicio'}, exagerada`
      : `Envolvente de ${FRAME_DIAGRAMS.find((item) => item.value === kind)!.label.toLowerCase()} en el pórtico; máximo ${formatNumber(maxAbs, 1)} ${UNIT[kind]}`;

  return <svg className="dw-drawing dw-frame" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={description} data-kind={kind}>
    <defs>
      <marker id="dw-frame-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" className="dw-load__head" />
      </marker>
    </defs>
    {/* Cotas: claros abajo y alturas a la derecha. */}
    <g className="dw-dimension">
      {xs.slice(1).map((x, index) => {
        const x0 = sx(xs[index]!);
        const x1 = sx(x);
        const y = sy(0) + 40;
        return <g key={`bay-${index}`}>
          <line x1={x0} x2={x1} y1={y} y2={y} />
          <line x1={x0} x2={x0} y1={y - 5} y2={y + 5} />
          <line x1={x1} x2={x1} y1={y - 5} y2={y + 5} />
          <text x={(x0 + x1) / 2} y={y - 5} textAnchor="middle">{`${formatNumber(x - xs[index]!, 2)} m`}</text>
        </g>;
      })}
      {ys.slice(1).map((y, index) => {
        const x = sx(spanX) + Math.max(56, amplitude + 26);
        const y0 = sy(ys[index]!);
        const y1 = sy(y);
        return <g key={`story-${index}`}>
          <line x1={x} x2={x} y1={y0} y2={y1} />
          <line x1={x - 5} x2={x + 5} y1={y1} y2={y1} />
          <text x={x + 6} y={(y0 + y1) / 2 + 4}>{formatNumber(y - ys[index]!, 2)}</text>
          <text className="dw-frame__level" x={x + 6} y={y1 + 4}>{`N${index + 1}`}</text>
        </g>;
      })}
    </g>

    {/* Acción lateral por nivel. */}
    {lateral ? <g className="dw-load dw-frame__lateral">
      {levelLoads.map((story, index) => story.lateralKn > 0 ? <g key={index}>
        <line x1={sx(0) - Math.max(54, amplitude + 40)} x2={sx(0) - 8} y1={sy(ys[index + 1]!)} y2={sy(ys[index + 1]!)} markerEnd="url(#dw-frame-arrow)" />
        <text x={sx(0) - Math.max(54, amplitude + 40)} y={sy(ys[index + 1]!) - 6}>{`${formatNumber(story.lateralKn, 0)} kN`}</text>
      </g> : null)}
    </g> : null}

    {/* Apoyos. */}
    <g className="dw-support">
      {baseNodes.map((node) => result.input.base === 'fixed'
        ? <g key={node.x}>
          <line x1={sx(node.x) - 14} x2={sx(node.x) + 14} y1={sy(0)} y2={sy(0)} />
          {Array.from({ length: 5 }, (_, index) => <line key={index} className="dw-support__hatch" x1={sx(node.x) - 12 + index * 6} y1={sy(0)} x2={sx(node.x) - 17 + index * 6} y2={sy(0) + 7} />)}
        </g>
        : <path key={node.x} d={`M${sx(node.x)},${sy(0)} l-9,14 h18 Z`} />)}
    </g>

    {/* Diagramas detrás de los miembros. */}
    {kind === 'moment' || kind === 'shear' || kind === 'axial' ? <g className={`dw-band dw-band--${kind}`}>
      {result.members.map((member, index) => <g key={index}>
        {diagramOf(member).map((shape, position) => <g key={position}>
          <path className="dw-band__area" d={`${pathOf(shape.area)} Z`} />
          <path className="dw-band__line" d={pathOf(shape.curve)} />
        </g>)}
      </g>)}
    </g> : null}
    {kind === 'deformed' ? <g className="dw-frame__deformed">
      {result.members.map((member, index) => <path key={index} d={pathOf(deformedOf(member))} />)}
    </g> : null}

    {/* Miembros. */}
    <g className="dw-frame__members">
      {result.members.map((member, index) => <line key={index}
        className={`dw-frame__member dw-frame__member--${member.kind}`}
        data-band={kind === 'ratio' ? ratioBand(member.ratio) : undefined}
        x1={sx(member.start.x)} y1={sy(member.start.y)} x2={sx(member.end.x)} y2={sy(member.end.y)} />)}
    </g>
    {result.members.filter((member) => sameMember(selected, member)).map((member, index) =>
      <line key={`sel-${index}`} className="dw-frame__selected" x1={sx(member.start.x)} y1={sy(member.start.y)} x2={sx(member.end.x)} y2={sy(member.end.y)} />)}
    {/* Nudos. */}
    <g className="dw-frame__nodes">
      {result.nodes.filter((node) => node.y > 0).map((node) => <circle key={`${node.x}-${node.y}`} cx={sx(node.x)} cy={sy(node.y)} r={2.6} />)}
    </g>

    {/* Rótulos. */}
    {kind === 'ratio' ? <g className="dw-frame__ratios">
      {result.members.map((member, index) => {
        const { at } = frameOf(member);
        const middle = at(frameOf(member).length / 2, member.kind === 'beam' ? 12 : 0);
        return <text key={index} x={middle.x + (member.kind === 'column' ? 8 : 0)} y={middle.y + (member.kind === 'beam' ? -2 : 4)}
          textAnchor={member.kind === 'column' ? 'start' : 'middle'} data-band={ratioBand(member.ratio)}>{percent(member.ratio)}</text>;
      })}
    </g> : null}
    {labels.length ? <g className="dw-frame__values">
      {labels.map((label, index) => <text key={index} x={label.x} y={label.y + 4} textAnchor="middle">{formatNumber(label.value, 1)}</text>)}
    </g> : null}

    {/* Zonas de selección. */}
    {onSelect ? <g className="dw-frame__hits">
      {result.members.map((member, index) => <line key={index} role="button" tabIndex={0}
        aria-label={`${memberLabel(member)} · ${percent(member.ratio)}`} aria-pressed={sameMember(selected, member)}
        x1={sx(member.start.x)} y1={sy(member.start.y)} x2={sx(member.end.x)} y2={sy(member.end.y)}
        onClick={() => onSelect(keyOf(member))} onKeyDown={(event) => onKey(event, member)}>
        <title>{`${memberLabel(member)} · ${percent(member.ratio)}`}</title>
      </line>)}
    </g> : null}
  </svg>;
}
