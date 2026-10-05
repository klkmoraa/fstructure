import type { KeyboardEvent } from 'react';
import type { StructureDesignResult, StructureDiagramMember } from '../../../design/elements/structure';
import { formatNumber } from './common';

export type FrameDiagramKind = 'ratio' | 'moment' | 'shear' | 'axial' | 'deformed';

export const FRAME_DIAGRAMS: readonly { value: FrameDiagramKind; label: string }[] = [
  { value: 'ratio', label: 'Utilización' },
  { value: 'moment', label: 'Momento' },
  { value: 'shear', label: 'Cortante' },
  { value: 'axial', label: 'Axial' },
  { value: 'deformed', label: 'Deformada' },
];

const UNIT: Record<Exclude<FrameDiagramKind, 'ratio' | 'deformed'>, string> = { moment: 'kN·m', shear: 'kN', axial: 'kN' };

/** Banda de utilización de un miembro: lo holgado en gris y lo que se acerca o pasa del límite como aviso. */
export const ratioBand = (ratio: number) => !Number.isFinite(ratio) ? 'skip' : ratio > 1 + 1e-9 ? 'fail' : ratio > 0.9 ? 'near' : ratio > 0.6 ? 'mid' : 'low';

/** Nombre de lo que se diseña con un miembro: su línea de viga o su columna; si no se diseña, el miembro. */
export const designLabelOf = (result: StructureDesignResult, member: StructureDiagramMember) =>
  result.beams.find((beam) => beam.id === member.designId)?.label
  ?? result.columns.find((column) => column.id === member.designId)?.label
  ?? `${member.label} (sin diseñar)`;

const WIDTH = 820;
const LEFT = 100;
const RIGHT = 100;
const BOTTOM = 58;
/** Distancia mínima entre rótulos de valores, px. */
const LABEL_GAP = 30;
/** Más ejes o niveles que esto y las cotas estorban. */
const MAX_DIMENSIONS = 9;

/**
 * Elevación de la estructura (pórtico generado o Modelo 2D). Cada miembro
 * lleva su diagrama envolvente (momento del lado de la tensión, cortante y
 * axial del lado positivo) o la deformada; en «Utilización» cada miembro se
 * rotula con el cociente que rige. Con `onSelect`, una viga o columna se elige
 * con clic o teclado y se resalta todo lo que se diseña con ella.
 */
export function FrameElevation({ result, kind, selected, onSelect }: {
  result: StructureDesignResult;
  kind: FrameDiagramKind;
  /** `designId` de la línea de viga o columna elegida. */
  selected?: string | null;
  onSelect?: (designId: string) => void;
}) {
  const nodes = result.nodes;
  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y));
  const xs = [...new Set(nodes.map((node) => Math.round(node.x * 1e3) / 1e3))].sort((a, b) => a - b);
  const ys = [...new Set(nodes.map((node) => Math.round(node.y * 1e3) / 1e3))].sort((a, b) => a - b);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const plotWidth = WIDTH - LEFT - RIGHT;
  const scale = Math.min(plotWidth / spanX, 420 / spanY);
  const lengths = result.members.map((member) => Math.hypot(member.end.x - member.start.x, member.end.y - member.start.y)).filter((value) => value > 1e-6);
  // Amplitud del diagrama mayor; el margen superior la reserva para que el lienzo no salte al cambiar de diagrama.
  const amplitude = Math.max(18, Math.min(0.2 * Math.min(...lengths) * scale, 46));
  const top = 26 + amplitude;
  const height = top + spanY * scale + BOTTOM;
  const ox = LEFT + (plotWidth - spanX * scale) / 2;
  const sx = (x: number) => ox + (x - minX) * scale;
  const sy = (y: number) => top + (maxY - y) * scale;

  const series = (member: StructureDiagramMember): readonly (readonly number[])[] => kind === 'moment'
    ? [member.momentMaxKnm, member.momentMinKnm]
    : kind === 'shear' ? [member.shearMaxKn, member.shearMinKn]
      : kind === 'axial' ? [member.axialMaxKn, member.axialMinKn] : [];
  const maxAbs = Math.max(1e-9, ...result.members.flatMap((member) => series(member).flat().map(Math.abs)));
  const lateral = result.lateral;
  const deformation = (member: StructureDiagramMember) => ({ u: lateral ? member.lateralU : member.serviceU, v: lateral ? member.lateralV : member.serviceV });
  const maxDisplacement = Math.max(1e-12, ...result.members.flatMap((member) => {
    const { u, v } = deformation(member);
    return v.map((value, index) => Math.hypot(value, u[index]!));
  }));
  const deformScale = 0.07 * Math.max(spanX, spanY) / maxDisplacement;

  const frameOf = (member: StructureDiagramMember) => {
    const dx = member.end.x - member.start.x;
    const dy = member.end.y - member.start.y;
    const length = Math.hypot(dx, dy) || 1;
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

  const diagramOf = (member: StructureDiagramMember) => {
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

  const deformedOf = (member: StructureDiagramMember) => {
    const { c, s } = frameOf(member);
    const { u, v } = deformation(member);
    return member.stations.map((x, index) => {
      const wx = member.start.x + c * x + (c * u[index]! - s * v[index]!) * deformScale;
      const wy = member.start.y + s * x + (s * u[index]! + c * v[index]!) * deformScale;
      return { x: sx(wx), y: sy(wy) };
    });
  };

  const onKey = (event: KeyboardEvent<SVGElement>, designId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect?.(designId);
  };
  const percent = (ratio: number) => Number.isFinite(ratio) ? `${Math.round(ratio * 100)} %` : '—';
  const name = result.source.kind === 'model2d' ? 'el Modelo 2D' : result.source.kind === 'model3d' ? 'el eje del Modelo 3D' : 'el pórtico';
  const description = kind === 'ratio'
    ? `Utilización de ${name}: ${result.beams.length} líneas de viga y ${result.columns.length} columnas; máxima ${percent(result.governingRatio)}`
    : kind === 'deformed'
      ? `Deformada de ${name} ${lateral ? 'bajo la acción lateral' : 'con las cargas de servicio'}, exagerada`
      : `Envolvente de ${FRAME_DIAGRAMS.find((item) => item.value === kind)!.label.toLowerCase()} en ${name}; máximo ${formatNumber(maxAbs, 1)} ${UNIT[kind]}`;
  const dimensioned = xs.length <= MAX_DIMENSIONS && ys.length <= MAX_DIMENSIONS;
  const dimensionX = sx(maxX) + Math.max(56, amplitude + 26);

  return <svg className="dw-drawing dw-frame" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={description} data-kind={kind}>
    <defs>
      <marker id="dw-frame-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" className="dw-load__head" />
      </marker>
    </defs>
    {/* Cotas: ejes abajo y alturas a la derecha, con el nombre de cada nivel. */}
    {dimensioned ? <g className="dw-dimension">
      {xs.slice(1).map((x, index) => {
        const x0 = sx(xs[index]!);
        const x1 = sx(x);
        const y = sy(minY) + 40;
        return <g key={`bay-${index}`}>
          <line x1={x0} x2={x1} y1={y} y2={y} />
          <line x1={x0} x2={x0} y1={y - 5} y2={y + 5} />
          <line x1={x1} x2={x1} y1={y - 5} y2={y + 5} />
          <text x={(x0 + x1) / 2} y={y - 5} textAnchor="middle">{`${formatNumber(x - xs[index]!, 2)} m`}</text>
        </g>;
      })}
      {ys.slice(1).map((y, index) => {
        const y0 = sy(ys[index]!);
        const y1 = sy(y);
        const level = result.levels.findIndex((value) => Math.abs(value - y) < 0.006);
        return <g key={`story-${index}`}>
          <line x1={dimensionX} x2={dimensionX} y1={y0} y2={y1} />
          <line x1={dimensionX - 5} x2={dimensionX + 5} y1={y1} y2={y1} />
          <text x={dimensionX + 6} y={(y0 + y1) / 2 + 4}>{formatNumber(y - ys[index]!, 2)}</text>
          {level > 0 ? <text className="dw-frame__level" x={dimensionX + 6} y={y1 + 4}>{`N${level}`}</text> : null}
        </g>;
      })}
    </g> : null}

    {/* Acción lateral por elevación. */}
    {lateral && result.lateralLevels.length ? <g className="dw-load dw-frame__lateral">
      {result.lateralLevels.filter((item) => item.kN > 0).map((item) => <g key={item.y}>
        <line x1={sx(minX) - Math.max(54, amplitude + 40)} x2={sx(minX) - 8} y1={sy(item.y)} y2={sy(item.y)} markerEnd="url(#dw-frame-arrow)" />
        <text x={sx(minX) - Math.max(54, amplitude + 40)} y={sy(item.y) - 6}>{`${formatNumber(item.kN, 0)} kN`}</text>
      </g>)}
    </g> : null}

    {/* Apoyos. */}
    <g className="dw-support">
      {nodes.map((node, index) => node.support === 'fixed'
        ? <g key={index}>
          <line x1={sx(node.x) - 14} x2={sx(node.x) + 14} y1={sy(node.y)} y2={sy(node.y)} />
          {Array.from({ length: 5 }, (_, hatch) => <line key={hatch} className="dw-support__hatch" x1={sx(node.x) - 12 + hatch * 6} y1={sy(node.y)} x2={sx(node.x) - 17 + hatch * 6} y2={sy(node.y) + 7} />)}
        </g>
        : node.support === 'pinned' || node.support === 'roller' ? <g key={index}>
          <path d={`M${sx(node.x)},${sy(node.y)} l-9,14 h18 Z`} />
          {node.support === 'roller' ? <line x1={sx(node.x) - 11} x2={sx(node.x) + 11} y1={sy(node.y) + 19} y2={sy(node.y) + 19} /> : null}
        </g> : null)}
    </g>

    {/* Diagramas detrás de los miembros. */}
    {kind === 'moment' || kind === 'shear' || kind === 'axial' ? <g className={`fs-band fs-band--${kind}`}>
      {result.members.map((member) => <g key={member.index}>
        {diagramOf(member).map((shape, position) => <g key={position}>
          <path className="fs-band__area" d={`${pathOf(shape.area)} Z`} />
          <path className="fs-band__line" d={pathOf(shape.curve)} />
        </g>)}
      </g>)}
    </g> : null}
    {kind === 'deformed' ? <g className="dw-frame__deformed">
      {result.members.map((member) => <path key={member.index} d={pathOf(deformedOf(member))} />)}
    </g> : null}

    {/* Miembros. */}
    <g className="dw-frame__members">
      {result.members.map((member) => <line key={member.index}
        className={`dw-frame__member dw-frame__member--${member.kind}`}
        data-band={kind === 'ratio' ? ratioBand(member.ratio) : undefined}
        x1={sx(member.start.x)} y1={sy(member.start.y)} x2={sx(member.end.x)} y2={sy(member.end.y)} />)}
    </g>
    {result.members.filter((member) => selected && member.designId === selected).map((member) =>
      <line key={`sel-${member.index}`} className="dw-frame__selected" x1={sx(member.start.x)} y1={sy(member.start.y)} x2={sx(member.end.x)} y2={sy(member.end.y)} />)}
    {/* Nudos libres. */}
    <g className="dw-frame__nodes">
      {nodes.filter((node) => node.support === 'free').map((node, index) => <circle key={index} cx={sx(node.x)} cy={sy(node.y)} r={2.6} />)}
    </g>

    {/* Rótulos. */}
    {kind === 'ratio' ? <g className="dw-frame__ratios">
      {result.members.filter((member) => member.kind !== 'other').map((member) => {
        const geometry = frameOf(member);
        const horizontal = Math.abs(geometry.s) < 0.5;
        const middle = geometry.at(geometry.length / 2, horizontal ? 12 : 0);
        return <text key={member.index} x={middle.x + (horizontal ? 0 : 8)} y={middle.y + (horizontal ? -2 : 4)}
          textAnchor={horizontal ? 'middle' : 'start'} data-band={ratioBand(member.ratio)}>{percent(member.ratio)}</text>;
      })}
    </g> : null}
    {labels.length ? <g className="dw-frame__values">
      {labels.map((label, index) => <text key={index} x={label.x} y={label.y + 4} textAnchor="middle">{formatNumber(label.value, 1)}</text>)}
    </g> : null}

    {/* Zonas de selección. */}
    {onSelect ? <g className="dw-frame__hits">
      {result.members.filter((member) => member.designId).map((member) => {
        const label = `${designLabelOf(result, member)} · ${member.label} · ${percent(member.ratio)}`;
        return <line key={member.index} role="button" tabIndex={0}
          aria-label={label} aria-pressed={member.designId === selected}
          x1={sx(member.start.x)} y1={sy(member.start.y)} x2={sx(member.end.x)} y2={sy(member.end.y)}
          onClick={() => onSelect(member.designId!)} onKeyDown={(event) => onKey(event, member.designId!)}>
          <title>{label}</title>
        </line>;
      })}
    </g> : null}
  </svg>;
}
