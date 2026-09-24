import type { BeamDesignResult, BeamEnd, BeamSectionCut, BedSection } from '../../../design/elements/beam';
import { barsText } from '../../../design/elements/beam';
import { rebarLabel } from '../../../design/elements/shared';
import { formatNumber } from './common';

const WIDTH = 820;
const LEFT = 74;
const RIGHT = 30;
const PLOT = WIDTH - LEFT - RIGHT;

interface BandProps {
  readonly xs: readonly number[];
  readonly upper: readonly number[];
  readonly lower?: readonly number[];
  /** Resistencia provista, dibujada como escalón punteado sobre la demanda. */
  readonly capacityUpper?: readonly number[];
  readonly capacityLower?: readonly number[];
  readonly top: number;
  readonly height: number;
  readonly scaleX: (x: number) => number;
  /** `down`: los positivos se dibujan hacia abajo (momento del lado de la tensión). */
  readonly positive: 'up' | 'down';
  readonly tone: 'moment' | 'shear' | 'deformed';
  readonly label: string;
  readonly unit: string;
  readonly nodesAtM: readonly number[];
}

const pathOf = (xs: readonly number[], values: readonly number[], scaleX: (x: number) => number, y: (value: number) => number) =>
  values.map((value, index) => `${index === 0 ? 'M' : 'L'}${scaleX(xs[index]!).toFixed(2)},${y(value).toFixed(2)}`).join(' ');

function DiagramBand({ xs, upper, lower, capacityUpper, capacityLower, top, height, scaleX, positive, tone, label, unit, nodesAtM }: BandProps) {
  const demand = lower ? [...upper, ...lower] : upper;
  const all = [...demand, ...(capacityUpper ?? []), ...(capacityLower ?? [])];
  const max = Math.max(0, ...all);
  const min = Math.min(0, ...all);
  const range = max - min || 1;
  const y = (value: number) => positive === 'down'
    ? top + (value - min) / range * height
    : top + (max - value) / range * height;
  const axis = y(0);
  const areaOf = (values: readonly number[]) =>
    `M${scaleX(xs[0]!).toFixed(2)},${axis.toFixed(2)} ${values.map((value, index) => `L${scaleX(xs[index]!).toFixed(2)},${y(value).toFixed(2)}`).join(' ')} L${scaleX(xs[xs.length - 1]!).toFixed(2)},${axis.toFixed(2)} Z`;

  const labels: { x: number; value: number }[] = [];
  const maxIndex = demand.indexOf(Math.max(...demand));
  const minIndex = demand.indexOf(Math.min(...demand));
  const demandRange = Math.max(...demand) - Math.min(...demand) || 1;
  const xAt = (index: number) => xs[index % xs.length]!;
  if (demand[maxIndex]! > demandRange * 0.02) labels.push({ x: xAt(maxIndex), value: demand[maxIndex]! });
  if (demand[minIndex]! < -demandRange * 0.02) labels.push({ x: xAt(minIndex), value: demand[minIndex]! });

  return <g className={`dw-band dw-band--${tone}`}>
    <text className="dw-band__label" x={10} y={top + height / 2 - 3}>{label}</text>
    <text className="dw-band__unit" x={10} y={top + height / 2 + 12}>{unit}</text>
    {nodesAtM.map((x) => <line key={x} className="dw-band__grid" x1={scaleX(x)} x2={scaleX(x)} y1={top - 4} y2={top + height + 4} />)}
    <path className="dw-band__area" d={areaOf(upper)} />
    {lower ? <path className="dw-band__area" d={areaOf(lower)} /> : null}
    <line className="dw-band__axis" x1={LEFT} x2={LEFT + PLOT} y1={axis} y2={axis} />
    {capacityUpper ? <path className="dw-band__capacity" d={pathOf(xs, capacityUpper, scaleX, y)} /> : null}
    {capacityLower ? <path className="dw-band__capacity" d={pathOf(xs, capacityLower, scaleX, y)} /> : null}
    <path className="dw-band__line" d={pathOf(xs, upper, scaleX, y)} />
    {lower ? <path className="dw-band__line" d={pathOf(xs, lower, scaleX, y)} /> : null}
    {labels.map((item) => {
      const px = scaleX(item.x);
      const py = y(item.value);
      const below = py >= axis;
      const anchor = px < LEFT + 40 ? 'start' : px > LEFT + PLOT - 40 ? 'end' : 'middle';
      return <g key={`${item.x}-${item.value}`}>
        <circle className="dw-band__dot" cx={px} cy={py} r={3} />
        <text className="dw-band__value" x={px} y={below ? py + 15 : py - 7} textAnchor={anchor}>{formatNumber(item.value, 1)}</text>
      </g>;
    })}
  </g>;
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
  return restrainsX ? 'pin' : 'roller';
};

function Supports({ result, scaleX, beamTop, beamHeight }: { result: BeamDesignResult; scaleX: (x: number) => number; beamTop: number; beamHeight: number }) {
  const { leftEnd, rightEnd } = result.input;
  return <>{result.nodesAtM.map((x, index) => {
    const kind = index === 0 ? endSupport(leftEnd, 'left', true)
      : index === result.nodesAtM.length - 1 ? endSupport(rightEnd, 'right', leftEnd === 'free')
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

export function BeamElevation({ result }: { result: BeamDesignResult }) {
  const length = result.totalLengthM;
  const scaleX = (x: number) => LEFT + x / length * PLOT;
  const beamTop = 86;
  const beamHeight = 22;
  const { spans } = result.input;
  const maxLoad = Math.max(1e-9, ...spans.map((span) => span.deadKnPerM + span.liveKnPerM + result.selfWeightKnPerM));
  const bands = [
    { upper: result.diagram.momentMaxKnm, lower: result.diagram.momentMinKnm, capacityUpper: result.diagram.capacityPositiveKnm, capacityLower: result.diagram.capacityNegativeKnm, positive: 'down' as const, tone: 'moment' as const, label: 'Momento', unit: 'kN·m' },
    { upper: result.diagram.shearMaxKn, lower: result.diagram.shearMinKn, positive: 'up' as const, tone: 'shear' as const, label: 'Cortante', unit: 'kN' },
    { upper: result.diagram.deflectionMm, positive: 'up' as const, tone: 'deformed' as const, label: 'Deflexión', unit: 'mm' },
  ];
  const bandTop = 180;
  const bandHeight = 100;
  const bandGap = 30;
  const height = bandTop + bands.length * (bandHeight + bandGap) - 10;

  return <svg className="dw-drawing" viewBox={`0 0 ${WIDTH} ${height}`} role="img"
    aria-label={`Elevación de la viga de ${spans.length} ${spans.length === 1 ? 'claro' : 'claros'}: momento máximo ${formatNumber(result.extremes.positiveMomentKnm)} kN·m, negativo ${formatNumber(result.extremes.negativeMomentKnm)} kN·m y cortante ${formatNumber(result.extremes.shearKn)} kN`}>
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

    <rect className="dw-beam" x={scaleX(0)} y={beamTop} width={PLOT} height={beamHeight} />
    <Supports result={result} scaleX={scaleX} beamTop={beamTop} beamHeight={beamHeight} />
    <SpanDimensions result={result} scaleX={scaleX} y={152} />

    {bands.map((band, index) => <DiagramBand key={band.tone} xs={result.diagram.xM} scaleX={scaleX} nodesAtM={result.nodesAtM}
      top={bandTop + index * (bandHeight + bandGap)} height={bandHeight} {...band} />)}
  </svg>;
}

/** Despiece longitudinal: corridas, bastones con su longitud y estribos por zonas. */
export function BeamRebarDetail({ result }: { result: BeamDesignResult }) {
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

    <Supports result={result} scaleX={scaleX} beamTop={beamTop} beamHeight={beamHeight} />
    {result.spans.map((span) => {
      const size = rebarLabel(result.stirrupDiameterMm);
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
  const { widthMm: b, heightMm: h, coverMm } = input;
  const maxDiameter = Math.max(section.continuous.diameterMm, section.extra?.diameterMm ?? 0);
  const total = section.continuous.count + (section.extra?.count ?? 0);
  const first = Math.min(total, section.perLayer);
  const inside = b - 2 * (coverMm + stirrupDiameterMm);
  const spacing = (inside - maxDiameter) / Math.max(1, first - 1);
  const bars: { x: number; y: number; d: number; kind: 'continuous' | 'extra' }[] = [];
  const yOf = (layer: number) => {
    const offset = coverMm + stirrupDiameterMm + maxDiameter / 2 + layer * (maxDiameter + Math.max(25, maxDiameter));
    return section.bed === 'bottom' ? h - offset : offset;
  };
  for (let index = 0; index < first; index += 1) {
    const corner = index === 0 || index === first - 1;
    bars.push({
      x: coverMm + stirrupDiameterMm + maxDiameter / 2 + index * spacing,
      y: yOf(0),
      d: corner ? section.continuous.diameterMm : section.extra?.diameterMm ?? section.continuous.diameterMm,
      kind: corner ? 'continuous' : 'extra',
    });
  }
  for (let index = 0; index < total - first; index += 1) {
    bars.push({ x: coverMm + stirrupDiameterMm + maxDiameter / 2 + index * spacing, y: yOf(1), d: section.extra!.diameterMm, kind: 'extra' });
  }
  return bars;
}

const bedText = (section: BedSection) => section.extra ? `${barsText(section.continuous)} + ${barsText(section.extra)}` : barsText(section.continuous);

export function BeamSection({ result, cut }: { result: BeamDesignResult; cut: BeamSectionCut }) {
  const { widthMm: b, heightMm: h, coverMm } = result.input;
  const scale = Math.min(130 / b, 190 / h);
  const width = b * scale;
  const height = h * scale;
  const W = 230;
  const ox = (W - width) / 2 - 12;
  const oy = 30;
  const ds = result.stirrupDiameterMm;
  const inset = (coverMm + ds / 2) * scale;
  const bars = [...bedBars(cut.top, result.input, ds), ...bedBars(cut.bottom, result.input, ds)];

  return <svg className="dw-drawing dw-drawing--section" viewBox={`0 0 ${W} ${oy + height + 58}`} role="img"
    aria-label={`${cut.label}: sección ${b / 10} por ${h / 10} centímetros con ${bedText(cut.top)} arriba y ${bedText(cut.bottom)} abajo`}>
    <text className="dw-callout" x={ox + width / 2} y={16} textAnchor="middle">{bedText(cut.top)}</text>
    <rect className="dw-concrete" x={ox} y={oy} width={width} height={height} />
    <rect className="dw-stirrup" x={ox + inset} y={oy + inset} width={width - 2 * inset} height={height - 2 * inset}
      rx={Math.max(2, 2 * ds * scale)} style={{ strokeWidth: Math.max(1.4, ds * scale) }} />
    {bars.map((bar, index) => <circle key={index} className={bar.kind === 'extra' ? 'dw-bar dw-bar--extra' : 'dw-bar'}
      cx={ox + bar.x * scale} cy={oy + bar.y * scale} r={Math.max(2.4, bar.d / 2 * scale)} />)}
    <g className="dw-dimension">
      <line x1={ox} x2={ox + width} y1={oy + height + 14} y2={oy + height + 14} />
      <line x1={ox} x2={ox} y1={oy + height + 8} y2={oy + height + 20} />
      <line x1={ox + width} x2={ox + width} y1={oy + height + 8} y2={oy + height + 20} />
      <text x={ox + width / 2} y={oy + height + 31} textAnchor="middle">{`${formatNumber(b / 10, 0)} cm`}</text>
      <line x1={ox + width + 14} x2={ox + width + 14} y1={oy} y2={oy + height} />
      <line x1={ox + width + 8} x2={ox + width + 20} y1={oy} y2={oy} />
      <line x1={ox + width + 8} x2={ox + width + 20} y1={oy + height} y2={oy + height} />
      <text x={ox + width + 20} y={oy + height / 2 + 4}>{`${formatNumber(h / 10, 0)} cm`}</text>
    </g>
    <text className="dw-callout" x={ox + width / 2} y={oy + height + 52} textAnchor="middle">{bedText(cut.bottom)}</text>
  </svg>;
}
