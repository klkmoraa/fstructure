import type { FootingDesignResult, FootingDirection } from '../../../design/elements/footing';
import { rebarLabel } from '../../../design/elements/shared';
import { formatNumber } from './common';

/** Posiciones de las barras de una dirección a lo largo del ancho que cubren (mm desde el borde). */
function barPositions(direction: FootingDirection, widthMm: number, coverMm: number): number[] {
  const count = Math.min(direction.barCount, 60);
  if (!direction.band) {
    return Array.from({ length: count }, (_, index) => coverMm + (widthMm - 2 * coverMm) * (count > 1 ? index / (count - 1) : 0.5));
  }
  // Banda central con la fracción 2/(β+1) de las barras; el resto repartido a los lados.
  const { widthMm: band, barsInBand } = direction.band;
  const outside = count - barsInBand;
  const bandStart = (widthMm - band) / 2;
  const positions = Array.from({ length: barsInBand }, (_, index) => bandStart + band * (index + 0.5) / barsInBand);
  const perSide = Math.floor(outside / 2);
  const sides = [perSide, outside - perSide];
  sides.forEach((bars, side) => {
    for (let index = 0; index < bars; index += 1) {
      const t = (index + 0.5) / bars;
      positions.push(side === 0 ? coverMm + (bandStart - coverMm) * t : bandStart + band + (bandStart - coverMm) * t);
    }
  });
  return positions.sort((left, right) => left - right);
}

export function FootingPlan({ result }: { result: FootingDesignResult }) {
  const W = 300;
  const { sideXMm: bx, sideYMm: by } = result;
  const scale = 220 / Math.max(bx, by);
  const w = bx * scale;
  const h = by * scale;
  const ox = (W - w) / 2;
  const oy = 20 + (220 - h) / 2;
  const cx = ox + w / 2;
  const cy = oy + h / 2;
  const { columnWidthMm: c1, columnDepthMm: c2, coverMm } = result.input;
  const pw = result.punching.criticalWidthMm * scale;
  const pd = result.punching.criticalDepthMm * scale;
  const xLine = (c1 / 2 + result.directions.x.effectiveDepthMm) * scale;
  const yLine = (c2 / 2 + result.directions.y.effectiveDepthMm) * scale;
  const ex = result.service.eccentricityXMm * scale;
  const ey = result.service.eccentricityYMm * scale;
  return <svg className="dw-drawing dw-drawing--plan" viewBox={`0 0 ${W} 290`} role="img"
    aria-label={`Planta de zapata de ${formatNumber(bx / 1000, 2)} por ${formatNumber(by / 1000, 2)} metros`}>
    <rect className="dw-concrete" x={ox} y={oy} width={w} height={h} />
    <g className="dw-rebar-grid">
      {barPositions(result.directions.x, by, coverMm).map((position) => <line key={`x${position}`} x1={ox + 4} x2={ox + w - 4} y1={oy + position * scale} y2={oy + position * scale} />)}
      {barPositions(result.directions.y, bx, coverMm).map((position) => <line key={`y${position}`} y1={oy + 4} y2={oy + h - 4} x1={ox + position * scale} x2={ox + position * scale} />)}
    </g>
    <rect className="dw-critical" x={cx - pw / 2} y={cy - pd / 2} width={pw} height={pd}>
      <title>Perímetro crítico de penetración a d/2 del paño</title>
    </rect>
    {cx + xLine < ox + w ? <line className="dw-critical dw-critical--oneway" x1={cx + xLine} x2={cx + xLine} y1={oy} y2={oy + h}><title>Cortante como viga en X, a d del paño</title></line> : null}
    {cy - yLine > oy ? <line className="dw-critical dw-critical--oneway" y1={cy - yLine} y2={cy - yLine} x1={ox} x2={ox + w}><title>Cortante como viga en Y, a d del paño</title></line> : null}
    <rect className="dw-column" x={cx - c1 * scale / 2} y={cy - c2 * scale / 2} width={c1 * scale} height={c2 * scale} />
    {ex > 0.5 || ey > 0.5 ? <g className="dw-resultant">
      <circle cx={cx + ex} cy={cy - ey} r={3.5}><title>Resultante de servicio (excentricidad)</title></circle>
      <text x={cx + ex + 6} y={cy - ey - 5}>R</text>
    </g> : null}
    <g className="dw-axis">
      <line x1={ox - 10} x2={ox + w + 10} y1={cy} y2={cy} />
      <line x1={cx} x2={cx} y1={oy - 10} y2={oy + h + 10} />
      <text x={ox + w + 12} y={cy + 4}>X</text>
      <text x={cx - 3} y={oy - 12}>Y</text>
    </g>
    <g className="dw-dimension">
      <line x1={ox} x2={ox + w} y1={oy + h + 16} y2={oy + h + 16} />
      <text x={cx} y={oy + h + 30} textAnchor="middle">{`B = ${formatNumber(bx / 1000, 2)} m`}</text>
      <line x1={ox - 16} x2={ox - 16} y1={oy} y2={oy + h} />
      <text x={ox - 20} y={cy} textAnchor="middle" transform={`rotate(-90 ${ox - 20} ${cy})`}>{`L = ${formatNumber(by / 1000, 2)} m`}</text>
    </g>
  </svg>;
}

export function FootingSection({ result }: { result: FootingDesignResult }) {
  const W = 360;
  const side = result.sideXMm;
  const scale = 250 / side;
  const s = side * scale;
  const t = Math.max(24, result.thicknessMm * scale);
  const ox = (W - s) / 2;
  const oy = 70;
  const colW = result.input.columnWidthMm * scale;
  const cover = result.input.coverMm * scale;
  const count = Math.min(result.directions.y.barCount, 30);
  const arrows = 11;
  const { minimumKpa, maximumKpa } = result.ultimate;
  const peak = Math.max(Math.abs(maximumKpa), Math.abs(minimumKpa), 1);
  const arrowLength = (index: number) => {
    const q = minimumKpa + (maximumKpa - minimumKpa) * index / (arrows - 1);
    return 8 + 26 * Math.max(0, q) / peak;
  };
  const x = result.directions.x;
  return <svg className="dw-drawing" viewBox={`0 0 ${W} ${oy + t + 92}`} role="img"
    aria-label={`Corte en X de zapata con peralte ${formatNumber(result.thicknessMm / 10, 0)} centímetros y presión última de ${formatNumber(minimumKpa, 0)} a ${formatNumber(maximumKpa, 0)} kPa`}>
    <defs>
      <marker id="dw-soil-arrow" viewBox="0 0 10 10" refX="5" refY="1" markerWidth="6" markerHeight="6">
        <path d="M0,10 L5,0 L10,10 Z" className="dw-soil__head" />
      </marker>
    </defs>
    <rect className="dw-column" x={W / 2 - colW / 2} y={10} width={colW} height={oy - 10} />
    <rect className="dw-concrete" x={ox} y={oy} width={s} height={t} />
    <line className="dw-rebar" x1={ox + cover} x2={ox + s - cover} y1={oy + t - cover - (x.layer === 'top' ? 5 : 0)} y2={oy + t - cover - (x.layer === 'top' ? 5 : 0)} />
    {Array.from({ length: count }, (_, index) => <circle key={index} className="dw-bar" r={2.4}
      cx={ox + cover + (s - 2 * cover) * (count > 1 ? index / (count - 1) : 0.5)} cy={oy + t - cover - (x.layer === 'top' ? 0 : 5)} />)}
    <g className="dw-soil">
      {Array.from({ length: arrows }, (_, index) => {
        const px = ox + s * index / (arrows - 1);
        const length = arrowLength(index);
        return <line key={index} x1={px} x2={px} y1={oy + t + 5 + length} y2={oy + t + 5} markerEnd="url(#dw-soil-arrow)" />;
      })}
      <line x1={ox} x2={ox + s} y1={oy + t + 5 + arrowLength(0)} y2={oy + t + 5 + arrowLength(arrows - 1)} />
      <text x={ox} y={oy + t + 58} textAnchor="start">{`${formatNumber(minimumKpa, 0)} kPa`}</text>
      <text x={ox + s} y={oy + t + 58} textAnchor="end">{`${formatNumber(maximumKpa, 0)} kPa`}</text>
    </g>
    <g className="dw-dimension">
      <line x1={ox + s + 14} x2={ox + s + 14} y1={oy} y2={oy + t} />
      <text x={ox + s + 20} y={oy + t / 2 + 4}>{`h = ${formatNumber(result.thicknessMm / 10, 0)} cm`}</text>
      <text className="dw-muted" x={ox + s + 20} y={oy + t / 2 + 18}>{`d = ${formatNumber(result.effectiveDepthMm / 10, 1)} cm`}</text>
    </g>
    <text className="dw-callout" x={W / 2} y={oy + t + 82} textAnchor="middle">{`X: ${rebarLabel(result.input.barDiameterMm)} @ ${formatNumber(x.spacingMm / 10, 0)} cm · Y: ${rebarLabel(result.input.barDiameterMm)} @ ${formatNumber(result.directions.y.spacingMm / 10, 0)} cm`}</text>
  </svg>;
}
