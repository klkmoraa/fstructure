import type { CombinedFootingResult } from '../../../design/elements/combinedFooting';
import { rebarLabel } from '../../../design/elements/shared';
import type { StripFootingResult } from '../../../design/elements/stripFooting';
import { DiagramBand, ELEVATION_FRAME } from './BeamDrawings';
import { formatNumber } from './common';

const SoilArrowMarker = () => <defs>
  <marker id="dw-soil-arrow-strip" viewBox="0 0 10 10" refX="5" refY="1" markerWidth="6" markerHeight="6">
    <path d="M0,10 L5,0 L10,10 Z" className="dw-soil__head" />
  </marker>
</defs>;

/** Corte de la zapata corrida: muro, zapata, barras transversales y presión última uniforme. */
export function StripFootingSection({ result }: { result: StripFootingResult }) {
  const W = 360;
  const scale = 250 / result.widthMm;
  const s = result.widthMm * scale;
  const t = Math.max(22, result.thicknessMm * scale);
  const ox = (W - s) / 2;
  const oy = 70;
  const wall = result.input.wallWidthMm * scale;
  const cover = result.input.coverMm * scale;
  const count = Math.min(result.distribution.barCount, 24);
  const arrows = 9;
  return <svg className="dw-drawing" viewBox={`0 0 ${W} ${oy + t + 92}`} role="img"
    aria-label={`Corte de zapata corrida de ${formatNumber(result.widthMm / 10, 0)} centímetros de ancho y ${formatNumber(result.thicknessMm / 10, 0)} de peralte bajo muro de ${formatNumber(result.input.wallWidthMm / 10, 0)} centímetros`}>
    <SoilArrowMarker />
    <rect className={result.input.wallMaterial === 'masonry' ? 'dw-column dw-wall--masonry' : 'dw-column'} x={W / 2 - wall / 2} y={10} width={wall} height={oy - 10} />
    <rect className="dw-concrete" x={ox} y={oy} width={s} height={t} />
    <line className="dw-rebar" x1={ox + cover} x2={ox + s - cover} y1={oy + t - cover} y2={oy + t - cover} />
    {Array.from({ length: count }, (_, index) => <circle key={index} className="dw-bar" r={2.2}
      cx={ox + cover + (s - 2 * cover) * (count > 1 ? index / (count - 1) : 0.5)} cy={oy + t - cover - 4} />)}
    <g className="dw-soil">
      {Array.from({ length: arrows }, (_, index) => {
        const px = ox + s * index / (arrows - 1);
        return <line key={index} x1={px} x2={px} y1={oy + t + 5 + 22} y2={oy + t + 5} markerEnd="url(#dw-soil-arrow-strip)" />;
      })}
      <line x1={ox} x2={ox + s} y1={oy + t + 27} y2={oy + t + 27} />
      <text x={ox + s / 2} y={oy + t + 46} textAnchor="middle">{`qu = ${formatNumber(result.ultimatePressureKpa, 0)} kPa`}</text>
    </g>
    <g className="dw-dimension">
      <line x1={ox + s + 14} x2={ox + s + 14} y1={oy} y2={oy + t} />
      <text x={ox + s + 20} y={oy + t / 2 + 4}>{`h = ${formatNumber(result.thicknessMm / 10, 0)} cm`}</text>
      <line x1={ox} x2={ox + s} y1={oy + t + 58} y2={oy + t + 58} />
      <text x={ox + s / 2} y={oy + t + 72} textAnchor="middle">{`B = ${formatNumber(result.widthMm / 10, 0)} cm`}</text>
    </g>
    <text className="dw-callout" x={W / 2} y={oy + t + 90} textAnchor="middle">
      {`${rebarLabel(result.input.barDiameterMm)} @ ${formatNumber(result.transverse.spacingMm / 10, 0)} cm · ${result.distribution.barCount} ${rebarLabel(result.input.distributionBarDiameterMm)} long.`}
    </text>
  </svg>;
}

/** Planta de la zapata combinada: columnas, perímetros de penetración y bandas transversales. */
export function CombinedFootingPlan({ result }: { result: CombinedFootingResult }) {
  const W = 620;
  const scale = Math.min(520 / result.lengthMm, 230 / result.widthMm);
  const l = result.lengthMm * scale;
  const b = result.widthMm * scale;
  const ox = (W - l) / 2;
  const oy = 24;
  const cy = oy + b / 2;
  const toX = (x: number) => ox + x * scale;
  const toY = (y: number) => cy - y * scale;
  return <svg className="dw-drawing dw-drawing--wide" viewBox={`0 0 ${W} ${oy + b + 60}`} role="img"
    aria-label={`Planta de zapata combinada de ${formatNumber(result.lengthMm / 1000, 2)} por ${formatNumber(result.widthMm / 1000, 2)} metros`}>
    <rect className="dw-concrete" x={ox} y={oy} width={l} height={b} />
    {result.bands.map((band, index) => {
      const x = result.columnAtMm[index]!;
      return <rect key={`band-${band.column}`} className="dw-band-zone" x={toX(x - band.widthMm / 2)} y={oy} width={band.widthMm * scale} height={b}>
        <title>{`Banda transversal bajo la columna ${band.column}`}</title>
      </rect>;
    })}
    {result.punching.map((item) => <rect key={`punch-${item.column}`} className="dw-critical"
      x={toX(item.rectangle.x0)} y={toY(item.rectangle.y1)} width={(item.rectangle.x1 - item.rectangle.x0) * scale} height={(item.rectangle.y1 - item.rectangle.y0) * scale}>
      <title>{`Perímetro crítico de penetración, columna ${item.column}`}</title>
    </rect>)}
    {result.input.columns.map((column, index) => <g key={`column-${index}`}>
      <rect className="dw-column" x={toX(result.columnAtMm[index]! - column.widthMm / 2)} y={toY(column.depthMm / 2)} width={column.widthMm * scale} height={column.depthMm * scale} />
      <text className="dw-callout" x={toX(result.columnAtMm[index]!)} y={toY(0) + 4} textAnchor="middle">{`C${index + 1}`}</text>
    </g>)}
    <g className="dw-resultant">
      <circle cx={toX(result.service.resultantAtMm)} cy={cy} r={3.5}><title>Resultante de servicio</title></circle>
    </g>
    <g className="dw-dimension">
      <line x1={ox} x2={ox + l} y1={oy + b + 16} y2={oy + b + 16} />
      <text x={ox + l / 2} y={oy + b + 30} textAnchor="middle">{`L = ${formatNumber(result.lengthMm / 1000, 2)} m`}</text>
      <line x1={toX(result.columnAtMm[0])} x2={toX(result.columnAtMm[1])} y1={oy + b + 42} y2={oy + b + 42} />
      <text x={toX((result.columnAtMm[0] + result.columnAtMm[1]) / 2)} y={oy + b + 55} textAnchor="middle">{`${formatNumber(result.input.spacingMm / 1000, 2)} m entre ejes`}</text>
      <line x1={ox - 14} x2={ox - 14} y1={oy} y2={oy + b} />
      <text x={ox - 18} y={cy} textAnchor="middle" transform={`rotate(-90 ${ox - 18} ${cy})`}>{`B = ${formatNumber(result.widthMm / 1000, 2)} m`}</text>
    </g>
  </svg>;
}

/** Cortante y momento a lo largo de la zapata combinada (envolventes últimas, M > 0 tensiona abajo). */
export function CombinedFootingDiagrams({ result }: { result: CombinedFootingResult }) {
  const { width: WIDTH, left, plot } = ELEVATION_FRAME;
  const xs = result.diagram.xMm.map((x) => x / 1000);
  const length = result.lengthMm / 1000;
  const scaleX = (x: number) => left + x / length * plot;
  const columns = result.columnAtMm.map((x) => x / 1000);
  const band = 110;
  return <svg className="dw-drawing" viewBox={`0 0 ${WIDTH} ${2 * band + 90}`} role="img"
    aria-label={`Diagramas de cortante y momento de la zapata combinada: momento positivo ${formatNumber(result.bottom.momentKnm, 0)} y negativo ${formatNumber(result.top?.momentKnm ?? 0, 0)} kilonewton metro`}>
    <rect className="dw-beam" x={scaleX(0)} y={12} width={plot} height={12} />
    {result.input.columns.map((column, index) => <rect key={index} className="dw-column"
      x={scaleX(columns[index]! - column.widthMm / 2000)} y={0} width={column.widthMm / 1000 / length * plot} height={12} />)}
    <DiagramBand xs={xs} upper={result.diagram.shearMaxKn} lower={result.diagram.shearMinKn} top={40} height={band} scaleX={scaleX}
      positive="up" tone="shear" label="Cortante" unit="kN" nodesAtM={columns} />
    <DiagramBand xs={xs} upper={result.diagram.momentMaxKnm} lower={result.diagram.momentMinKnm} top={60 + band} height={band} scaleX={scaleX}
      positive="down" tone="moment" label="Momento" unit="kN·m" nodesAtM={columns} />
  </svg>;
}
