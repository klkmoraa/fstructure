import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import type { BeamDesignResult, BeamEnd, BeamSectionCut, BedSection } from '../../../design/elements/beam';
import { barsText } from '../../../design/elements/beam';
import { designCode } from '../../../design/elements/codes';
import { layoutBeamBed } from '../../../design/elements/beamBarLayout';
import { rebarLabel } from '../../../design/elements/shared';
import { bandScale, DiagramBand as SharedDiagramBand, nearestStation, type DiagramBandProps } from '../../../design-system/components/diagramBands';
import { formatNumber } from './common';

const WIDTH = 820;
const LEFT = 74;
const RIGHT = 30;
const PLOT = WIDTH - LEFT - RIGHT;
/** Marco horizontal de las láminas de elevación, compartido con las zapatas combinadas. */
export const ELEVATION_FRAME = Object.freeze({ width: WIDTH, left: LEFT, plot: PLOT });

type BandProps = Omit<DiagramBandProps, 'frame' | 'format'>;

/** Banda común (`design-system`) en el marco de las láminas de elevación. */
export function DiagramBand(props: BandProps) {
  return <SharedDiagramBand {...props} frame={ELEVATION_FRAME} format={(value) => formatNumber(value, 1)} />;
}

type SupportKind = 'pin' | 'roller' | 'fixed-left' | 'fixed-right';

function Support({ kind, x, y }: { kind: SupportKind; x: number; y: number }) {
  if (kind === 'fixed-left' || kind === 'fixed-right') {
    const dir = kind === 'fixed-left' ? -1 : 1;
    return <g className="dw-support">
      <line x1={x} x2={x} y1={y - 24} y2={y + 24} />
      {Array.from({ length: 5 }, (_, index) => <line key={index} className="dw-support__hatch" x1={x} y1={y - 20 + index * 10} x2={x + dir * 8} y2={y - 14 + index * 10} />)}
    </g>;
  }
  return <g className="dw-support">
    <path d={`M${x},${y} l-9,14 h18 Z`} />
    {kind === 'roller' ? <line x1={x - 11} x2={x + 11} y1={y + 19} y2={y + 19} /> : <line className="dw-support__hatch" x1={x - 12} x2={x + 12} y1={y + 15} y2={y + 15} />}
  </g>;
}

const endSupport = (end: BeamEnd, side: 'left' | 'right', restrainsX: boolean): SupportKind | null => {
  if (end === 'free') return null;
  if (end === 'fixed') return side === 'left' ? 'fixed-left' : 'fixed-right';
  if (end === 'roller') return 'roller';
  return restrainsX ? 'pin' : 'roller';
};

/** Cómo se dibujan los apoyos: ideales (viga aislada) o columnas del pórtico que la cruzan. */
type BeamSupportStyle = 'ideal' | 'columns';

function Supports({ result, scaleX, beamTop, beamHeight, style = 'ideal' }: { result: BeamDesignResult; scaleX: (x: number) => number; beamTop: number; beamHeight: number; style?: BeamSupportStyle }) {
  const { leftEnd, rightEnd } = result.input;
  if (style === 'columns') {
    return <g className="dw-column-stub">{result.nodesAtM.map((x) => <rect key={x} x={scaleX(x) - 6} y={beamTop - 16} width={12} height={beamHeight + 32} />)}</g>;
  }
  return <>{result.nodesAtM.map((x, index) => {
    const kind = index === 0 ? endSupport(leftEnd, 'left', true)
      : index === result.nodesAtM.length - 1 ? endSupport(rightEnd, 'right', leftEnd === 'free' || leftEnd === 'roller')
        : 'roller';
    if (!kind) return null;
    return <Support key={x} kind={kind} x={scaleX(x)} y={kind.startsWith('fixed') ? beamTop + beamHeight / 2 : beamTop + beamHeight} />;
  })}</>;
}

function SpanDimensions({ result, scaleX, y }: { result: BeamDesignResult; scaleX: (x: number) => number; y: number }) {
  return <g className="dw-dimension">{result.spans.map((span) => {
    const x0 = scaleX(span.startM);
    const x1 = scaleX(span.startM + span.lengthM);
    return <g key={span.startM}>
      <line x1={x0} x2={x1} y1={y} y2={y} />
      <line x1={x0} x2={x0} y1={y - 6} y2={y + 6} />
      <line x1={x1} x2={x1} y1={y - 6} y2={y + 6} />
      <text x={(x0 + x1) / 2} y={y - 5} textAnchor="middle">{`${formatNumber(span.lengthM, 2)} m`}</text>
    </g>;
  })}</g>;
}

function stirrupPositions(result: BeamDesignResult): number[] {
  const positions: number[] = [];
  result.spans.forEach((span) => {
    const { denseSpacingMm, centerSpacingMm, denseZones } = span.stirrups;
    const end = span.startM + span.lengthM - 0.05;
    let x = span.startM + 0.05;
    while (x <= end + 1e-9 && positions.length < 600) {
      positions.push(x);
      const dense = denseZones.some((zone) => x >= zone.startM - 1e-9 && x <= zone.endM + 1e-9);
      x += (dense ? denseSpacingMm : centerSpacingMm) / 1e3;
    }
  });
  return positions;
}

/** Índice de la estación más cercana a `x`; con estaciones repetidas (saltos), la del lado indicado. */

/**
 * Elevación con cargas, apoyos y envolventes de momento, cortante y flecha.
 * Con `interactive`, un cursor lee los valores en cualquier sección (puntero,
 * toque o flechas del teclado); sin él es la lámina estática de la memoria.
 */
export function BeamElevation({ result, interactive = false, supports = 'ideal' }: { result: BeamDesignResult; interactive?: boolean; supports?: BeamSupportStyle }) {
  const [probe, setProbe] = useState<number | null>(null);
  const length = result.totalLengthM;
  const scaleX = (x: number) => LEFT + x / length * PLOT;
  const beamTop = 86;
  const beamHeight = 22;
  const { spans } = result.input;
  const { diagram } = result;
  const maxLoad = Math.max(1e-9, ...spans.map((span) => span.deadKnPerM + span.liveKnPerM + result.selfWeightKnPerM));
  const shearCapacityLower = diagram.shearCapacityKn.map((value) => -value);
  const bands = [
    { upper: diagram.momentMaxKnm, lower: diagram.momentMinKnm, capacityUpper: diagram.capacityPositiveKnm, capacityLower: diagram.capacityNegativeKnm, positive: 'down' as const, tone: 'moment' as const, label: 'Momento', unit: 'kN·m' },
    { upper: diagram.shearMaxKn, lower: diagram.shearMinKn, capacityUpper: diagram.shearCapacityKn, capacityLower: shearCapacityLower, positive: 'up' as const, tone: 'shear' as const, label: 'Cortante', unit: 'kN' },
    { upper: diagram.deflectionMm, positive: 'up' as const, tone: 'deformed' as const, label: 'Deflexión', unit: 'mm' },
  ];
  const bandTop = 180;
  const bandHeight = 100;
  const bandGap = 30;
  const height = bandTop + bands.length * (bandHeight + bandGap) - 10;
  const scales = bands.map((band, index) => bandScale({ ...band, top: bandTop + index * (bandHeight + bandGap), height: bandHeight }));

  const stationAt = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return null;
    const x = ((event.clientX - rect.left) / rect.width * WIDTH - LEFT) / PLOT * length;
    return x < -0.02 * length || x > 1.02 * length ? null : nearestStation(diagram.xM, Math.min(length, Math.max(0, x)));
  };
  const onPointer = (event: PointerEvent<SVGSVGElement>) => {
    const index = stationAt(event);
    if (index !== null) setProbe(index);
  };
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const xs = diagram.xM;
    const current = probe ?? 0;
    let next: number | null = current;
    if (event.key === 'ArrowRight') next = xs.findIndex((x) => x > xs[current]! + length / 400);
    else if (event.key === 'ArrowLeft') { const target = xs[current]! - length / 400; next = xs.reduce((best, x, index) => x < target ? index : best, -1); }
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = xs.length - 1;
    else if (event.key === 'Escape') next = null;
    else return;
    event.preventDefault();
    setProbe(next !== null && next < 0 ? current : next);
  };
  const reading = probe !== null ? {
    x: diagram.xM[probe]!,
    span: result.spans.findIndex((span) => diagram.xM[probe]! >= span.startM - 1e-9 && diagram.xM[probe]! <= span.startM + span.lengthM + 1e-9) + 1,
    momentMax: diagram.momentMaxKnm[probe]!,
    momentMin: diagram.momentMinKnm[probe]!,
    capacityPositive: diagram.capacityPositiveKnm[probe]!,
    capacityNegative: -diagram.capacityNegativeKnm[probe]!,
    shear: Math.max(Math.abs(diagram.shearMaxKn[probe]!), Math.abs(diagram.shearMinKn[probe]!)),
    shearCapacity: diagram.shearCapacityKn[probe]!,
    deflection: diagram.deflectionMm[probe]!,
  } : null;

  const drawing = <svg className={`dw-drawing${interactive ? ' fs-probe-target' : ''}`} viewBox={`0 0 ${WIDTH} ${height}`} role="img"
    tabIndex={interactive ? 0 : undefined}
    onPointerMove={interactive ? onPointer : undefined}
    onPointerDown={interactive ? onPointer : undefined}
    onKeyDown={interactive ? onKeyDown : undefined}
    aria-label={`Elevación de la viga de ${spans.length} ${spans.length === 1 ? 'claro' : 'claros'}: momento máximo ${formatNumber(result.extremes.positiveMomentKnm)} kN·m, negativo ${formatNumber(result.extremes.negativeMomentKnm)} kN·m y cortante ${formatNumber(result.extremes.shearKn)} kN${interactive ? '. Usa las flechas para leer los valores en cada sección' : ''}`}>
    <defs>
      <marker id="dw-arrow" viewBox="0 0 10 10" refX="5" refY="9" markerWidth="6" markerHeight="6">
        <path d="M0,0 L5,10 L10,0 Z" className="dw-load__head" />
      </marker>
    </defs>

    {spans.map((span, index) => {
      const summary = result.spans[index]!;
      const x0 = scaleX(summary.startM);
      const x1 = scaleX(summary.startM + summary.lengthM);
      const w = span.deadKnPerM + span.liveKnPerM + result.selfWeightKnPerM;
      const loadTop = beamTop - 8 - 34 * w / maxLoad;
      const arrows = Math.max(3, Math.round((x1 - x0) / 26));
      const pointKn = span.pointDeadKn + span.pointLiveKn;
      const px = scaleX(summary.startM + span.pointAtM);
      return <g key={index}>
        {w > 0 ? <g className="dw-load">
          <line x1={x0} x2={x1} y1={loadTop} y2={loadTop} />
          {Array.from({ length: arrows + 1 }, (_, arrow) => {
            const x = x0 + (x1 - x0) * arrow / arrows;
            return <line key={arrow} x1={x} x2={x} y1={loadTop} y2={beamTop - 3} markerEnd="url(#dw-arrow)" />;
          })}
          <text x={(x0 + x1) / 2} y={loadTop - 6} textAnchor="middle">{`${formatNumber(w, 1)} kN/m`}</text>
        </g> : null}
        {pointKn > 0 ? <g className="dw-load dw-load--point">
          <line x1={px} x2={px} y1={14} y2={beamTop - 3} markerEnd="url(#dw-arrow)" />
          <text x={px + 6} y={20}>{`${formatNumber(pointKn, 0)} kN`}</text>
        </g> : null}
      </g>;
    })}

    {supports === 'columns' ? <Supports result={result} scaleX={scaleX} beamTop={beamTop} beamHeight={beamHeight} style="columns" /> : null}
    <rect className="dw-beam" x={scaleX(0)} y={beamTop} width={PLOT} height={beamHeight} />
    {supports === 'ideal' ? <Supports result={result} scaleX={scaleX} beamTop={beamTop} beamHeight={beamHeight} /> : null}
    <SpanDimensions result={result} scaleX={scaleX} y={152} />

    {bands.map((band, index) => <DiagramBand key={band.tone} xs={diagram.xM} scaleX={scaleX} nodesAtM={result.nodesAtM}
      top={bandTop + index * (bandHeight + bandGap)} height={bandHeight} {...band} />)}

    {probe !== null ? <g className="fs-probe" aria-hidden="true">
      <line className="fs-probe__line" x1={scaleX(diagram.xM[probe]!)} x2={scaleX(diagram.xM[probe]!)} y1={beamTop - 8} y2={height - 6} />
      {bands.map((band, index) => [band.upper, band.lower].filter((series): series is readonly number[] => Boolean(series)).map((series, position) =>
        <circle key={`${index}-${position}`} className={`fs-probe__dot fs-probe__dot--${band.tone}`} cx={scaleX(diagram.xM[probe]!)} cy={scales[index]!(series[probe]!)} r={4} />))}
    </g> : null}
  </svg>;
  if (!interactive) return drawing;
  return <div className="fs-probe-frame">
    {drawing}
    <p className="fs-probe-readout" aria-live="polite">
      {reading ? <>
        <span><b>x</b> {formatNumber(reading.x, 2)} m · claro {reading.span}</span>
        <span data-tone="moment"><b>M⁺u</b> {formatNumber(Math.max(0, reading.momentMax), 1)} / φMn {formatNumber(reading.capacityPositive, 1)}</span>
        <span data-tone="moment"><b>M⁻u</b> {formatNumber(Math.max(0, -reading.momentMin), 1)} / φMn {formatNumber(reading.capacityNegative, 1)} kN·m</span>
        <span data-tone="shear"><b>Vu</b> {formatNumber(reading.shear, 1)} / φVn {formatNumber(reading.shearCapacity, 1)} kN</span>
        <span data-tone="deformed"><b>Δ</b> {formatNumber(reading.deflection, 1)} mm</span>
      </> : <span className="fs-probe-readout__hint">Toca un diagrama para leer cada sección.</span>}
    </p>
  </div>;
}

/** Por debajo de este ancho (px de la lámina, sin zoom) el DCL se dibuja compacto, en píxeles reales. */
const COMPACT_BELOW = 720;
/** Texto del DCL compacto: 14 px reales; la mono avanza 0.6 em por carácter. */
const FBD_FONT = 14;
const FBD_CHAR = FBD_FONT * 0.6;
const FBD_ROW = FBD_FONT + 6;
const FBD_GAP = 10;

/**
 * Ancho del marco en px de la lámina (descontando el zoom del lienzo). Null sin
 * `ResizeObserver` (pruebas) o en el PDF: entonces se dibuja la lámina de siempre.
 */
function useBaseWidth(ref: RefObject<HTMLElement | null>, enabled: boolean): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const zoom = Number.parseFloat(getComputedStyle(element).getPropertyValue('--z')) || 1;
      const next = Math.round(element.getBoundingClientRect().width / zoom);
      if (next > 0) setWidth(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, enabled]);
  return width;
}

/** Etiqueta acomodada: sus líneas, su tramo horizontal y la fila que le tocó. */
interface PlacedLabel { readonly key: string; readonly lines: readonly string[]; readonly x0: number; readonly x1: number; readonly row: number }

/**
 * Acomoda etiquetas en filas sin traslape: cada una va centrada en su punto
 * (sin salirse del dibujo) y, si choca con otra de su fila, pasa a la siguiente.
 */
function placeLabels(items: readonly { key: string; x: number; lines: readonly string[] }[], width: number): PlacedLabel[] {
  const rows: [number, number][][] = [];
  return items.map((item) => {
    const w = Math.max(...item.lines.map((line) => line.length)) * FBD_CHAR;
    const x0 = Math.max(2, Math.min(item.x - w / 2, width - 2 - w));
    const x1 = x0 + w;
    let row = rows.findIndex((taken) => taken.every(([a, b]) => x1 + FBD_GAP <= a || x0 >= b + FBD_GAP));
    if (row < 0) { row = rows.length; rows.push([]); }
    rows[row]!.push([x0, x1]);
    return { key: item.key, lines: item.lines, x0, x1, row };
  });
}
const rowCount = (labels: readonly PlacedLabel[]) => labels.reduce((max, label) => Math.max(max, label.row + 1), 0);

interface FreeBodySpan { readonly startM: number; readonly lengthM: number; readonly wu: number; readonly pu: number; readonly pointAtM: number }
interface FreeBodyExtra { readonly kind: string; readonly startX: number; readonly endX: number; readonly startKn: number; readonly endKn: number }

/**
 * DCL para teléfono: el mismo dibujo con unidades del SVG = px reales, texto de
 * 14 px y etiquetas reacomodadas en filas (cargas arriba; reacciones y momentos
 * de empotramiento abajo; cotas al pie) para que ninguna choque ni haga falta
 * desplazarse a lo ancho. Los valores son los mismos de la lámina completa.
 */
function CompactFreeBody({ width, label, result, spans, extras, maxW }: {
  width: number; label: string; result: BeamDesignResult; spans: readonly FreeBodySpan[]; extras: readonly FreeBodyExtra[]; maxW: number;
}) {
  const reactions = result.reactions!;
  const length = result.totalLengthM;
  const letter = (index: number) => String.fromCharCode(65 + index);
  const momentAt = (index: number) => {
    const support = reactions.supports[index];
    return support && support.kind !== 'free' && Math.abs(support.ultimateKnm) > 1e-6 ? support.ultimateKnm : 0;
  };
  // Margen para el arco del momento de empotramiento, que sale por fuera del apoyo.
  const left = momentAt(0) ? 42 : 18;
  const right = momentAt(reactions.supports.length - 1) ? 42 : 18;
  const scaleX = (x: number) => left + x / length * (width - left - right);

  const loadLabels = placeLabels([
    ...spans.flatMap((span, index) => span.wu > 0 ? [{ key: `w${index}`, x: scaleX(span.startM + span.lengthM / 2), lines: [`wu = ${formatNumber(span.wu, 1)} kN/m`] }] : []),
    ...spans.flatMap((span, index) => span.pu > 0 ? [{ key: `p${index}`, x: scaleX(span.startM + span.pointAtM), lines: [`Pu = ${formatNumber(span.pu, 1)} kN`] }] : []),
    ...extras.flatMap((load, index) => load.kind === 'point' ? [{ key: `e${index}`, x: scaleX(load.startX), lines: [`${formatNumber(load.startKn, 1)} kN`] }] : []),
  ], width);
  const loadRows = rowCount(loadLabels);
  const loadTop = 8 + loadRows * FBD_ROW + 6;
  const beamY = loadTop + 46;
  const reactionLabels = placeLabels(reactions.supports.flatMap((support, index) => support.kind === 'free' ? [] : [{
    key: `r${index}`, x: scaleX(support.xM),
    lines: [`R${letter(index)} = ${formatNumber(Math.abs(support.ultimateKn), 1)} kN`, ...(momentAt(index) ? [`M${letter(index)} = ${formatNumber(Math.abs(momentAt(index)), 1)} kN·m`] : [])],
  }]), width);
  const block = Math.max(1, ...reactionLabels.map((item) => item.lines.length)) * FBD_ROW;
  const reactionTop = beamY + 66;
  const dimensionY = reactionTop + rowCount(reactionLabels) * block + 12;
  const dimensionLabels = placeLabels(result.spans.map((span, index) => ({
    key: `d${index}`, x: scaleX(span.startM + span.lengthM / 2), lines: [`${formatNumber(span.lengthM, 2)} m`],
  })), width);
  const height = dimensionY + 12 + rowCount(dimensionLabels) * FBD_ROW;
  const text = (item: PlacedLabel, baseline: number) => <g key={item.key}>{item.lines.map((line, index) =>
    <text key={index} x={(item.x0 + item.x1) / 2} y={baseline + index * FBD_ROW} textAnchor="middle">{line}</text>)}</g>;
  const loadArrow = 'url(#dw-fbd-load-compact)';

  return <svg className="dw-drawing dw-fbd--compact" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
    <defs>
      <marker id="dw-fbd-load-compact" viewBox="0 0 10 10" refX="5" refY="9" markerWidth="6" markerHeight="6"><path d="M0,0 L5,10 L10,0 Z" className="dw-load__head" /></marker>
      <marker id="dw-fbd-reaction-compact" viewBox="0 0 10 10" refX="5" refY="1" markerWidth="7" markerHeight="7"><path d="M0,10 L5,0 L10,10 Z" className="dw-fbd__head" /></marker>
    </defs>
    {spans.map((span, index) => {
      if (!(span.wu > 0)) return null;
      const x0 = scaleX(span.startM);
      const x1 = scaleX(span.startM + span.lengthM);
      const top = beamY - 10 - 36 * span.wu / maxW;
      const arrows = Math.max(2, Math.round((x1 - x0) / 22));
      return <g key={index} className="dw-load">
        <line x1={x0} x2={x1} y1={top} y2={top} />
        {Array.from({ length: arrows + 1 }, (_, arrow) => {
          const x = x0 + (x1 - x0) * arrow / arrows;
          return <line key={arrow} x1={x} x2={x} y1={top} y2={beamY - 4} markerEnd={loadArrow} />;
        })}
      </g>;
    })}
    {spans.map((span, index) => span.pu > 0 ? <g key={`p${index}`} className="dw-load dw-load--point">
      <line x1={scaleX(span.startM + span.pointAtM)} x2={scaleX(span.startM + span.pointAtM)} y1={loadTop} y2={beamY - 4} markerEnd={loadArrow} />
    </g> : null)}
    {extras.map((load, index) => load.kind === 'point'
      ? <g key={`e${index}`} className="dw-load dw-load--point">
        <line x1={scaleX(load.startX)} x2={scaleX(load.startX)} y1={loadTop + 8} y2={beamY - 4} markerEnd={loadArrow} />
      </g>
      : <g key={`e${index}`} className="dw-load dw-load--patch">
        <polyline points={`${scaleX(load.startX)},${beamY - 10 - 36 * load.startKn / maxW} ${scaleX(load.endX)},${beamY - 10 - 36 * load.endKn / maxW}`} />
        {[0, 0.5, 1].map((t) => {
          const x = load.startX + (load.endX - load.startX) * t;
          const q = load.startKn + (load.endKn - load.startKn) * t;
          return <line key={t} x1={scaleX(x)} x2={scaleX(x)} y1={beamY - 10 - 36 * q / maxW} y2={beamY - 4} markerEnd={loadArrow} />;
        })}
      </g>)}
    {/* Fila 0 justo sobre las cargas; las que chocan suben. */}
    <g className="dw-load">{loadLabels.map((item) => text(item, 8 + (loadRows - item.row) * FBD_ROW - 5))}</g>
    <line className="dw-fbd__beam" x1={scaleX(0)} x2={scaleX(length)} y1={beamY} y2={beamY} />
    {reactions.supports.map((support, index) => {
      if (support.kind === 'free') return null;
      const x = scaleX(support.xM);
      const up = support.ultimateKn >= 0;
      const moment = momentAt(index);
      const side = index === 0 ? -1 : 1;
      const topToBottom = (moment > 0) === (side < 0);
      const [from, to] = topToBottom ? [beamY - 20, beamY + 20] : [beamY + 20, beamY - 20];
      return <g key={support.xM} className="dw-fbd__reaction">
        <circle className="dw-fbd__node" cx={x} cy={beamY} r={3.5} />
        <text className="dw-fbd__letter" x={x - side * 13} y={beamY + 24} textAnchor="middle">{letter(index)}</text>
        <line x1={x} x2={x} y1={up ? beamY + 58 : beamY + 8} y2={up ? beamY + 8 : beamY + 58} markerEnd="url(#dw-fbd-reaction-compact)" />
        {moment ? <g className="dw-fbd__moment">
          <path d={`M ${x} ${from} C ${x + side * 30} ${from} ${x + side * 30} ${to} ${x + side * 2} ${to}`} markerEnd="url(#dw-fbd-reaction-compact)" />
        </g> : null}
      </g>;
    })}
    <g className="dw-fbd__reaction">{reactionLabels.map((item) => text(item, reactionTop + item.row * block + FBD_FONT))}</g>
    <g className="dw-dimension">
      {result.spans.map((span) => {
        const x0 = scaleX(span.startM);
        const x1 = scaleX(span.startM + span.lengthM);
        return <g key={span.startM}>
          <line x1={x0} x2={x1} y1={dimensionY} y2={dimensionY} />
          <line x1={x0} x2={x0} y1={dimensionY - 6} y2={dimensionY + 6} />
          <line x1={x1} x2={x1} y1={dimensionY - 6} y2={dimensionY + 6} />
        </g>;
      })}
      {dimensionLabels.map((item) => text(item, dimensionY + 8 + item.row * FBD_ROW + FBD_FONT))}
    </g>
  </svg>;
}

/**
 * Diagrama de cuerpo libre con la combinación de diseño y todos los claros
 * cargados: cargas factorizadas (uniformes, puntuales y generales), reacciones
 * y momentos de empotramiento en los apoyos, y ΣFy = 0 comparando la suma de
 * reacciones con la carga calculada de los datos.
 */
export function BeamFreeBody({ result, bare = false }: { result: BeamDesignResult; bare?: boolean }) {
  const frame = useRef<HTMLElement>(null);
  const measured = useBaseWidth(frame, !bare);
  const reactions = result.reactions;
  if (!reactions) return null;
  const { combination } = reactions;
  const length = result.totalLengthM;
  const scaleX = (x: number) => LEFT + x / length * PLOT;
  const beamY = 104;
  const factored = (dead: number, live: number) => combination.dead * dead + combination.live * live;
  const spans = result.input.spans.map((span, index) => ({
    startM: result.spans[index]!.startM,
    lengthM: span.lengthM,
    wu: factored(span.deadKnPerM + result.selfWeightKnPerM, span.liveKnPerM),
    pu: factored(span.pointDeadKn, span.pointLiveKn),
    pointAtM: span.pointAtM,
  }));
  const extras = (result.input.extraLoads ?? []).map((load) => {
    const factor = load.category === 'dead' ? combination.dead : combination.live;
    const startM = result.spans[load.spanIndex]!.startM;
    return { ...load, startX: startM + load.startM, endX: startM + load.endM, startKn: factor * load.startKn, endKn: factor * load.endKn };
  });
  const maxW = Math.max(1e-9, ...spans.map((span) => span.wu), ...extras.filter((load) => load.kind === 'distributed').map((load) => Math.max(load.startKn, load.endKn)));
  const sumReactions = reactions.supports.reduce((sum, support) => sum + support.ultimateKn, 0);
  const balanced = Math.abs(sumReactions - reactions.totalLoadKn) <= Math.max(1e-6, 1e-6 * Math.abs(reactions.totalLoadKn));
  const letter = (index: number) => String.fromCharCode(65 + index);
  const height = 236;
  const label = `Diagrama de cuerpo libre con ${combination.label}: ${reactions.supports.flatMap((support, index) => support.kind === 'free' ? [] : [`R${letter(index)} = ${formatNumber(support.ultimateKn, 1)} kN`]).join(', ')}.`;
  // En teléfono, la lámina en px reales con texto legible; el PDF y el escritorio, la de siempre.
  const drawing = !bare && measured !== null && measured < COMPACT_BELOW
    ? <CompactFreeBody width={measured} label={label} result={result} spans={spans} extras={extras} maxW={maxW} />
    : <svg className="dw-drawing" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={label}>
      <defs>
        <marker id="dw-fbd-load" viewBox="0 0 10 10" refX="5" refY="9" markerWidth="6" markerHeight="6"><path d="M0,0 L5,10 L10,0 Z" className="dw-load__head" /></marker>
        <marker id="dw-fbd-reaction" viewBox="0 0 10 10" refX="5" refY="1" markerWidth="7" markerHeight="7"><path d="M0,10 L5,0 L10,10 Z" className="dw-fbd__head" /></marker>
      </defs>
      {spans.map((span, index) => {
        const x0 = scaleX(span.startM);
        const x1 = scaleX(span.startM + span.lengthM);
        const top = beamY - 10 - 36 * span.wu / maxW;
        const arrows = Math.max(3, Math.round((x1 - x0) / 26));
        return <g key={index}>
          {span.wu > 0 ? <g className="dw-load">
            <line x1={x0} x2={x1} y1={top} y2={top} />
            {Array.from({ length: arrows + 1 }, (_, arrow) => {
              const x = x0 + (x1 - x0) * arrow / arrows;
              return <line key={arrow} x1={x} x2={x} y1={top} y2={beamY - 4} markerEnd="url(#dw-fbd-load)" />;
            })}
            <text x={(x0 + x1) / 2} y={top - 6} textAnchor="middle">{`wu = ${formatNumber(span.wu, 1)} kN/m`}</text>
          </g> : null}
          {span.pu > 0 ? <g className="dw-load dw-load--point">
            <line x1={scaleX(span.startM + span.pointAtM)} x2={scaleX(span.startM + span.pointAtM)} y1={18} y2={beamY - 4} markerEnd="url(#dw-fbd-load)" />
            <text x={scaleX(span.startM + span.pointAtM) + 6} y={24}>{`Pu = ${formatNumber(span.pu, 1)} kN`}</text>
          </g> : null}
        </g>;
      })}
      {extras.map((load, index) => load.kind === 'point'
        ? <g key={`extra-${index}`} className="dw-load dw-load--point">
          <line x1={scaleX(load.startX)} x2={scaleX(load.startX)} y1={30} y2={beamY - 4} markerEnd="url(#dw-fbd-load)" />
          <text x={scaleX(load.startX) + 6} y={36}>{`${formatNumber(load.startKn, 1)} kN`}</text>
        </g>
        : <g key={`extra-${index}`} className="dw-load dw-load--patch">
          <polyline points={`${scaleX(load.startX)},${beamY - 10 - 36 * load.startKn / maxW} ${scaleX(load.endX)},${beamY - 10 - 36 * load.endKn / maxW}`} />
          {[0, 0.5, 1].map((t) => {
            const x = load.startX + (load.endX - load.startX) * t;
            const q = load.startKn + (load.endKn - load.startKn) * t;
            return <line key={t} x1={scaleX(x)} x2={scaleX(x)} y1={beamY - 10 - 36 * q / maxW} y2={beamY - 4} markerEnd="url(#dw-fbd-load)" />;
          })}
        </g>)}
      <line className="dw-fbd__beam" x1={scaleX(0)} x2={scaleX(length)} y1={beamY} y2={beamY} />
      {reactions.supports.map((support, index) => {
        if (support.kind === 'free') return null;
        const x = scaleX(support.xM);
        const anchor = index === 0 ? 'start' : index === reactions.supports.length - 1 ? 'end' : 'middle';
        const labelX = anchor === 'start' ? x - 4 : anchor === 'end' ? x + 4 : x;
        const up = support.ultimateKn >= 0;
        const moment = Math.abs(support.ultimateKnm) > 1e-6 ? support.ultimateKnm : 0;
        const side = index === 0 ? -1 : 1;
        return <g key={support.xM} className="dw-fbd__reaction">
          <circle className="dw-fbd__node" cx={x} cy={beamY} r={3.5} />
          <text className="dw-fbd__letter" x={x - side * 10} y={beamY + 18} textAnchor="middle">{letter(index)}</text>
          <line x1={x} x2={x} y1={up ? beamY + 62 : beamY + 8} y2={up ? beamY + 8 : beamY + 62} markerEnd="url(#dw-fbd-reaction)" />
          <text x={labelX} y={beamY + 80} textAnchor={anchor}>{`R${letter(index)} = ${formatNumber(Math.abs(support.ultimateKn), 1)} kN`}</text>
          {moment ? <g className="dw-fbd__moment">
            {/* Arco por fuera del apoyo; la punta marca el giro (antihorario si el momento es positivo). */}
            {(() => {
              const bulge = x + side * 30;
              const topToBottom = (moment > 0) === (side < 0);
              const [from, to] = topToBottom ? [beamY - 20, beamY + 20] : [beamY + 20, beamY - 20];
              return <path d={`M ${x} ${from} C ${bulge} ${from} ${bulge} ${to} ${x + side * 2} ${to}`} markerEnd="url(#dw-fbd-reaction)" />;
            })()}
            <text x={x - side * 28} y={beamY + 44} textAnchor={side < 0 ? 'start' : 'end'}>{`M${letter(index)} = ${formatNumber(Math.abs(moment), 1)} kN·m`}</text>
          </g> : null}
        </g>;
      })}
      <SpanDimensions result={result} scaleX={scaleX} y={height - 22} />
    </svg>;
  // El PDF rasteriza un `<svg>` raíz; la comprobación va en la nota de su figura.
  if (bare) return drawing;
  return <figure className="dw-fbd" ref={frame}>
    {drawing}
    <figcaption className={`dw-fbd__balance${balanced ? '' : ' is-off'}`}>
      <span>ΣFy = 0</span>
      <span>ΣR = {formatNumber(sumReactions, 1)} kN</span>
      <span>Σ cargas = {formatNumber(reactions.totalLoadKn, 1)} kN</span>
      <b>{balanced ? 'Equilibrio' : 'Revisar'}</b>
    </figcaption>
  </figure>;
}

/** Reacciones por apoyo: servicio (CM, CV), la combinación del DCL y la máxima con viva alternada. */
export function BeamReactionsTable({ result, onDesignFooting }: {
  result: BeamDesignResult;
  /** «Diseñar zapata»: abre una zapata aislada con la carga de servicio del apoyo. */
  onDesignFooting?: (support: { readonly deadKn: number; readonly liveKn: number }, label: string) => void;
}) {
  const reactions = result.reactions;
  if (!reactions) return null;
  const rows = reactions.supports.map((support, index) => ({ support, label: String.fromCharCode(65 + index) })).filter(({ support }) => support.kind !== 'free');
  const anyMoment = rows.some(({ support }) => Math.abs(support.deadKnm) + Math.abs(support.liveKnm) > 1e-6);
  return <div className="dw-reactions">
    <table className="dw-table" aria-label="Reacciones por apoyo">
      <thead><tr>
        <th scope="col">Apoyo</th><th scope="col">x · m</th><th scope="col">CM · kN</th><th scope="col">CV · kN</th>
        <th scope="col">{reactions.combination.label} · kN</th><th scope="col">Máx. alternada · kN</th>
        {anyMoment ? <th scope="col">M {reactions.combination.label} · kN·m</th> : null}
      </tr></thead>
      <tbody>{rows.map(({ support, label }) => <tr key={label}>
        <th scope="row">{label}</th>
        <td>{formatNumber(support.xM, 2)}</td>
        <td>{formatNumber(support.deadKn, 1)}</td>
        <td>{formatNumber(support.liveKn, 1)}</td>
        <td>{formatNumber(support.ultimateKn, 1)}</td>
        <td>{formatNumber(support.maxUltimateKn, 1)}</td>
        {anyMoment ? <td>{formatNumber(support.ultimateKnm, 1)}</td> : null}
      </tr>)}</tbody>
    </table>
    {onDesignFooting ? <div className="dw-reactions__actions" role="group" aria-label="Diseñar zapata por apoyo">
      <span>Diseñar zapata</span>
      {rows.filter(({ support }) => support.deadKn + support.liveKn > 0).map(({ support, label }) => <button key={label} type="button" className="dw-inline-action"
        aria-label={`Diseñar zapata en el apoyo ${label}`} title={`Zapata aislada con CM ${formatNumber(support.deadKn, 1)} kN y CV ${formatNumber(support.liveKn, 1)} kN; el borrador actual queda en la memoria`}
        onClick={() => onDesignFooting(support, label)}>{label}</button>)}
    </div> : null}
  </div>;
}

/** Despiece longitudinal: corridas, bastones con su longitud y estribos por zonas. */
export function BeamRebarDetail({ result, supports = 'ideal' }: { result: BeamDesignResult; supports?: BeamSupportStyle }) {
  const length = result.totalLengthM;
  const scaleX = (x: number) => LEFT + x / length * PLOT;
  const top = result.bastions.filter((bastion) => bastion.bed === 'top');
  const bottom = result.bastions.filter((bastion) => bastion.bed === 'bottom');
  const beamTop = 40;
  const beamHeight = 64;
  const topBar = beamTop + 9;
  const bottomBar = beamTop + beamHeight - 9;
  const height = beamTop + beamHeight + 96;

  const bastionLabel = (bastion: (typeof result.bastions)[number]) =>
    `${barsText(bastion.bars)} · ${formatNumber(bastion.endM - bastion.startM, 2)} m`;

  return <svg className="dw-drawing" viewBox={`0 0 ${WIDTH} ${height}`} role="img"
    aria-label={`Despiece: corridas ${barsText(result.continuousTop.continuous)} arriba y ${barsText(result.continuousBottom.continuous)} abajo, ${top.length} bastones superiores y ${bottom.length} inferiores`}>
    {supports === 'columns' ? <Supports result={result} scaleX={scaleX} beamTop={beamTop} beamHeight={beamHeight} style="columns" /> : null}
    <rect className="dw-beam" x={scaleX(0)} y={beamTop} width={PLOT} height={beamHeight} />
    {stirrupPositions(result).map((x) => <line key={x} className="dw-stirrup-tick" x1={scaleX(x)} x2={scaleX(x)} y1={beamTop + 3} y2={beamTop + beamHeight - 3} />)}
    <line className="dw-rebar" x1={scaleX(0) + 3} x2={scaleX(length) - 3} y1={topBar} y2={topBar} />
    <line className="dw-rebar" x1={scaleX(0) + 3} x2={scaleX(length) - 3} y1={bottomBar} y2={bottomBar} />
    <text className="dw-rebar-label" x={LEFT - 10} y={topBar + 4} textAnchor="end">{barsText(result.continuousTop.continuous)}</text>
    <text className="dw-rebar-label" x={LEFT - 10} y={bottomBar + 4} textAnchor="end">{barsText(result.continuousBottom.continuous)}</text>
    {result.anchorages.filter((item) => item.kind !== 'straight').map((item) => {
      const x = item.end === 'left' ? scaleX(0) + 3 : scaleX(length) - 3;
      const y = item.bed === 'top' ? topBar : bottomBar;
      return <path key={`${item.end}-${item.bed}`} className={`dw-hook${item.kind === 'insufficient' ? ' is-fail' : ''}`} d={`M${x},${y} v${item.bed === 'top' ? 12 : -12}`} />;
    })}

    {top.map((bastion, index) => {
      const x0 = scaleX(bastion.startM);
      const x1 = scaleX(bastion.endM);
      const y = topBar + 7;
      return <g key={`top-${index}`} className="dw-bastion">
        <line x1={x0} x2={x1} y1={y} y2={y} />
        {bastion.needsHook ? <path d={bastion.startM <= 1e-6 ? `M${x0},${y} v10` : `M${x1},${y} v10`} /> : null}
        <text x={(x0 + x1) / 2} y={beamTop - 8} textAnchor="middle">{bastionLabel(bastion)}</text>
        <line className="dw-bastion__leader" x1={(x0 + x1) / 2} x2={(x0 + x1) / 2} y1={beamTop - 4} y2={y - 2} />
      </g>;
    })}
    {bottom.map((bastion, index) => {
      const x0 = scaleX(bastion.startM);
      const x1 = scaleX(bastion.endM);
      const y = bottomBar - 7;
      return <g key={`bottom-${index}`} className="dw-bastion">
        <line x1={x0} x2={x1} y1={y} y2={y} />
        {bastion.needsHook ? <path d={bastion.startM <= 1e-6 ? `M${x0},${y} v-10` : `M${x1},${y} v-10`} /> : null}
        <text x={(x0 + x1) / 2} y={beamTop + beamHeight + 16} textAnchor="middle">{bastionLabel(bastion)}</text>
        <line className="dw-bastion__leader" x1={(x0 + x1) / 2} x2={(x0 + x1) / 2} y1={y + 2} y2={beamTop + beamHeight + 5} />
      </g>;
    })}

    {supports === 'ideal' ? <Supports result={result} scaleX={scaleX} beamTop={beamTop} beamHeight={beamHeight} /> : null}
    {result.spans.map((span) => {
      const size = rebarLabel(result.stirrupDiameterMm, 'transverse');
      const { denseSpacingMm, centerSpacingMm, denseZones } = span.stirrups;
      const text = denseZones.length
        ? `E${size} @${formatNumber(denseSpacingMm / 10, 0)} / @${formatNumber(centerSpacingMm / 10, 0)} cm`
        : `E${size} @${formatNumber(denseSpacingMm / 10, 0)} cm`;
      return <g key={span.startM}>
        {denseZones.map((zone) => <rect key={zone.startM} className="dw-zone" x={scaleX(zone.startM)} y={beamTop + beamHeight + 24} width={Math.max(1, scaleX(zone.endM) - scaleX(zone.startM))} height={3} />)}
        <text className="dw-stirrup-label" x={scaleX(span.startM + span.lengthM / 2)} y={beamTop + beamHeight + 44} textAnchor="middle">{text}</text>
      </g>;
    })}
    <SpanDimensions result={result} scaleX={scaleX} y={beamTop + beamHeight + 72} />
  </svg>;
}

function bedBars(section: BedSection, input: BeamDesignResult['input'], stirrupDiameterMm: number) {
  const { widthMm: b, heightMm: h } = input;
  const maxDiameter = Math.max(section.continuous.diameterMm, section.extra?.diameterMm ?? 0);
  const bars = layoutBeamBed({
    widthMm: b,
    heightMm: h,
    coverMm: input.coverMm,
    stirrupDiameterMm,
    minimumClearSpacingMm: designCode(input.code).beam.minimumClearSpacing(maxDiameter, input.maxAggregateMm),
    continuous: section.continuous,
    extra: section.extra,
  });
  return (bars ?? []).map((bar) => ({
    x: bar.xMm,
    y: section.bed === 'bottom' ? h - bar.fromFaceMm : bar.fromFaceMm,
    d: bar.diameterMm,
    kind: bar.kind,
  }));
}

const bedText = (section: BedSection) => section.extra ? `${barsText(section.continuous)} + ${barsText(section.extra)}` : barsText(section.continuous);

export function BeamSection({ result, cut }: { result: BeamDesignResult; cut: BeamSectionCut }) {
  const { widthMm: b, heightMm: h, coverMm, flange } = result.input;
  // Viga T/L: el patín define el ancho del dibujo; el alma va al centro (T) o a la izquierda (L).
  const bf = flange ? flange.widthMm : b;
  const hf = flange?.thicknessMm ?? 0;
  const webX = flange?.kind === 'T' ? (bf - b) / 2 : 0;
  const scale = Math.min((flange ? 190 : 130) / bf, 190 / h);
  const width = bf * scale;
  const height = h * scale;
  const W = Math.max(230, width + 70);
  const ox = (W - width) / 2 - 12;
  const oy = flange ? 44 : 30;
  const wx = ox + webX * scale;
  const webWidth = b * scale;
  const ds = result.stirrupDiameterMm;
  const inset = (coverMm + ds / 2) * scale;
  const bars = [...bedBars(cut.top, result.input, ds), ...bedBars(cut.bottom, result.input, ds)];
  const outline = flange
    ? flange.kind === 'T'
      ? [[0, 0], [bf, 0], [bf, hf], [webX + b, hf], [webX + b, h], [webX, h], [webX, hf], [0, hf]]
      : [[0, 0], [bf, 0], [bf, hf], [b, hf], [b, h], [0, h]]
    : [[0, 0], [b, 0], [b, h], [0, h]];
  const path = outline.map(([x, y], index) => `${index ? 'L' : 'M'}${(ox + x! * scale).toFixed(1)},${(oy + y! * scale).toFixed(1)}`).join(' ') + ' Z';
  const kind = flange ? `viga ${flange.kind} con patín de ${bf / 10} por ${hf / 10} centímetros, alma de ${b / 10} por ${h / 10}` : `sección ${b / 10} por ${h / 10} centímetros`;

  return <svg className="dw-drawing dw-drawing--section" viewBox={`0 0 ${W} ${oy + height + 58}`} role="img"
    aria-label={`${cut.label}: ${kind} con ${bedText(cut.top)} arriba y ${bedText(cut.bottom)} abajo`}>
    <text className="dw-callout" x={wx + webWidth / 2} y={flange ? 14 : 16} textAnchor="middle">{bedText(cut.top)}</text>
    <path className="dw-concrete" d={path} />
    <rect className="dw-stirrup" x={wx + inset} y={oy + inset} width={webWidth - 2 * inset} height={height - 2 * inset}
      rx={Math.max(2, 2 * ds * scale)} style={{ strokeWidth: Math.max(1.4, ds * scale) }} />
    {bars.map((bar, index) => <circle key={index} className={bar.kind === 'extra' ? 'dw-bar dw-bar--extra' : 'dw-bar'}
      cx={wx + bar.x * scale} cy={oy + bar.y * scale} r={Math.max(2.4, bar.d / 2 * scale)} />)}
    <g className="dw-dimension">
      <line x1={wx} x2={wx + webWidth} y1={oy + height + 14} y2={oy + height + 14} />
      <line x1={wx} x2={wx} y1={oy + height + 8} y2={oy + height + 20} />
      <line x1={wx + webWidth} x2={wx + webWidth} y1={oy + height + 8} y2={oy + height + 20} />
      <text x={wx + webWidth / 2} y={oy + height + 31} textAnchor="middle">{`${flange ? 'bw ' : ''}${formatNumber(b / 10, 0)} cm`}</text>
      <line x1={ox + width + 14} x2={ox + width + 14} y1={oy} y2={oy + height} />
      <line x1={ox + width + 8} x2={ox + width + 20} y1={oy} y2={oy} />
      <line x1={ox + width + 8} x2={ox + width + 20} y1={oy + height} y2={oy + height} />
      <text x={ox + width + 20} y={oy + height / 2 + 4}>{`${formatNumber(h / 10, 0)} cm`}</text>
      {flange ? <>
        <line x1={ox} x2={ox + width} y1={oy - 10} y2={oy - 10} />
        <line x1={ox} x2={ox} y1={oy - 16} y2={oy - 4} />
        <line x1={ox + width} x2={ox + width} y1={oy - 16} y2={oy - 4} />
        <text x={ox + width / 2} y={oy - 15} textAnchor="middle">{`bf ${formatNumber(bf / 10, 0)} cm`}</text>
        <text x={ox + width + 20} y={oy + hf * scale / 2 + 4}>{`hf ${formatNumber(hf / 10, 0)}`}</text>
      </> : null}
    </g>
    <text className="dw-callout" x={wx + webWidth / 2} y={oy + height + 52} textAnchor="middle">{bedText(cut.bottom)}</text>
  </svg>;
}
