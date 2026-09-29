import type { MatFoundationResult } from '../../../design/elements/matFoundation';
import { rebarLabel } from '../../../design/elements/shared';
import type { StrapFootingResult } from '../../../design/elements/strapFooting';
import { DiagramBand, ELEVATION_FRAME } from './BeamDrawings';
import { formatNumber } from './common';

const meters = (mm: number) => formatNumber(mm / 1000, 2);

/** Planta de la zapata de lindero: lindero, zapata 1, contratrabe y zapata 2. */
export function StrapFootingPlan({ result }: { result: StrapFootingResult }) {
  const W = 620;
  const { input, interior, strap } = result;
  const x1 = input.exterior.widthMm / 2;
  const x2 = x1 + input.spacingMm;
  const total = x2 + interior.sideXMm / 2;
  const tall = Math.max(result.exteriorWidthMm, interior.sideYMm);
  const scale = Math.min(540 / total, 230 / tall);
  const ox = 50;
  const oy = 20;
  const cy = oy + tall * scale / 2;
  const toX = (x: number) => ox + x * scale;
  const rect = (x0: number, width: number, height: number, className: string, title: string) =>
    <rect className={className} x={toX(x0)} y={cy - height * scale / 2} width={width * scale} height={height * scale}><title>{title}</title></rect>;
  return <svg className="dw-drawing dw-drawing--wide" viewBox={`0 0 ${W} ${oy + tall * scale + 64}`} role="img"
    aria-label={`Planta de zapata de lindero de ${meters(result.exteriorLengthMm)} por ${meters(result.exteriorWidthMm)} metros ligada con contratrabe de ${formatNumber(strap.widthMm / 10, 0)} por ${formatNumber(strap.heightMm / 10, 0)} centímetros a una zapata de ${meters(interior.sideXMm)} por ${meters(interior.sideYMm)} metros`}>
    <line className="dw-property-line" x1={ox} x2={ox} y1={oy - 12} y2={oy + tall * scale + 12}><title>Lindero</title></line>
    {rect(0, result.exteriorLengthMm, result.exteriorWidthMm, 'dw-concrete', 'Zapata 1 (lindero)')}
    {rect(x2 - interior.sideXMm / 2, interior.sideXMm, interior.sideYMm, 'dw-concrete', 'Zapata 2 (interior)')}
    {rect(0, x2, strap.widthMm, 'dw-pedestal', 'Contratrabe')}
    {rect(0, input.exterior.widthMm, input.exterior.depthMm, 'dw-column', 'Columna 1')}
    {rect(x2 - input.interior.widthMm / 2, input.interior.widthMm, input.interior.depthMm, 'dw-column', 'Columna 2')}
    <g className="dw-resultant">
      <circle cx={toX(result.exteriorLengthMm / 2)} cy={cy} r={3.5}><title>Centro de la zapata 1: reacción R1</title></circle>
    </g>
    <g className="dw-dimension">
      <line x1={toX(x1)} x2={toX(x2)} y1={oy + tall * scale + 18} y2={oy + tall * scale + 18} />
      <text x={toX((x1 + x2) / 2)} y={oy + tall * scale + 32} textAnchor="middle">{`L = ${meters(input.spacingMm)} m entre ejes`}</text>
      <line x1={toX(0)} x2={toX(result.exteriorLengthMm)} y1={oy + tall * scale + 44} y2={oy + tall * scale + 44} />
      <text x={toX(result.exteriorLengthMm / 2)} y={oy + tall * scale + 58} textAnchor="middle">{`B1 = ${meters(result.exteriorLengthMm)} m · e = ${formatNumber(result.eccentricityMm / 10, 1)} cm`}</text>
      <text x={ox - 8} y={cy} textAnchor="middle" transform={`rotate(-90 ${ox - 8} ${cy})`}>Lindero</text>
    </g>
  </svg>;
}

/** Cortante y momento últimos de la contratrabe, del lindero al eje de la columna 2 (M > 0 tensiona abajo). */
export function StrapDiagrams({ result }: { result: StrapFootingResult }) {
  const { width: WIDTH, left, plot } = ELEVATION_FRAME;
  const xs = result.diagram.xMm.map((x) => x / 1000);
  const length = xs[xs.length - 1]!;
  const scaleX = (x: number) => left + x / length * plot;
  const x1 = result.input.exterior.widthMm / 2000;
  const columns = [x1, length];
  const band = 110;
  return <svg className="dw-drawing" viewBox={`0 0 ${WIDTH} ${2 * band + 90}`} role="img"
    aria-label={`Diagramas de la contratrabe: momento negativo máximo ${formatNumber(result.strap.top.momentKnm, 0)} kilonewton metro y cortante ${formatNumber(result.strap.shear.demandKn, 0)} kilonewton`}>
    <rect className="dw-beam" x={scaleX(0)} y={12} width={plot} height={12} />
    <rect className="dw-concrete" x={scaleX(0)} y={24} width={result.exteriorLengthMm / 1000 / length * plot} height={6}><title>Zapata 1</title></rect>
    {columns.map((x, index) => <rect key={index} className="dw-column" x={scaleX(x) - 4} y={0} width={8} height={12} />)}
    <DiagramBand xs={xs} upper={result.diagram.shearKn} top={44} height={band} scaleX={scaleX} positive="up" tone="shear" label="Cortante" unit="kN" nodesAtM={columns} />
    <DiagramBand xs={xs} upper={result.diagram.momentKnm} top={64 + band} height={band} scaleX={scaleX} positive="down" tone="moment" label="Momento" unit="kN·m" nodesAtM={columns} />
  </svg>;
}

/** Planta de la losa de cimentación: retícula, columnas por tipo y perímetros de penetración. */
export function MatPlan({ result }: { result: MatFoundationResult }) {
  const W = 620;
  const { input } = result;
  const scale = Math.min(520 / result.lengthXMm, 300 / result.lengthYMm);
  const w = result.lengthXMm * scale;
  const h = result.lengthYMm * scale;
  const ox = (W - w) / 2;
  const oy = 16;
  const toX = (x: number) => ox + x * scale;
  const toY = (y: number) => oy + h - y * scale;
  const d = result.effectiveDepthMm;
  const xs = [...new Set(result.columns.map((column) => column.xMm))];
  const ys = [...new Set(result.columns.map((column) => column.yMm))];
  return <svg className="dw-drawing dw-drawing--wide" viewBox={`0 0 ${W} ${oy + h + 50}`} role="img"
    aria-label={`Planta de losa de cimentación de ${meters(result.lengthXMm)} por ${meters(result.lengthYMm)} metros con ${result.columns.length} columnas`}>
    <rect className="dw-concrete" x={ox} y={oy} width={w} height={h} />
    <g className="dw-axis">
      {xs.map((x) => <line key={`x${x}`} x1={toX(x)} x2={toX(x)} y1={oy - 6} y2={oy + h + 6} />)}
      {ys.map((y) => <line key={`y${y}`} x1={ox - 6} x2={ox + w + 6} y1={toY(y)} y2={toY(y)} />)}
    </g>
    {result.columns.map((column, index) => {
      const cutLeft = column.xMm === xs[0] && input.overhangMm - input.columnWidthMm / 2 < d / 2;
      const cutRight = column.xMm === xs[xs.length - 1] && input.overhangMm - input.columnWidthMm / 2 < d / 2;
      const cutBottom = column.yMm === ys[0] && input.overhangMm - input.columnDepthMm / 2 < d / 2;
      const cutTop = column.yMm === ys[ys.length - 1] && input.overhangMm - input.columnDepthMm / 2 < d / 2;
      const x0 = cutLeft ? 0 : column.xMm - input.columnWidthMm / 2 - d / 2;
      const x1 = cutRight ? result.lengthXMm : column.xMm + input.columnWidthMm / 2 + d / 2;
      const y0 = cutBottom ? 0 : column.yMm - input.columnDepthMm / 2 - d / 2;
      const y1 = cutTop ? result.lengthYMm : column.yMm + input.columnDepthMm / 2 + d / 2;
      return <g key={index}>
        <rect className="dw-critical" x={toX(x0)} y={toY(y1)} width={(x1 - x0) * scale} height={(y1 - y0) * scale} />
        <rect className="dw-column" x={toX(column.xMm - input.columnWidthMm / 2)} y={toY(column.yMm + input.columnDepthMm / 2)}
          width={input.columnWidthMm * scale} height={input.columnDepthMm * scale}>
          <title>{`Columna ${column.kind === 'interior' ? 'interior' : column.kind === 'edge' ? 'de borde' : 'de esquina'} · Pu = ${formatNumber(column.ultimateKn, 0)} kN`}</title>
        </rect>
      </g>;
    })}
    <g className="dw-dimension">
      <line x1={ox} x2={ox + w} y1={oy + h + 18} y2={oy + h + 18} />
      <text x={ox + w / 2} y={oy + h + 32} textAnchor="middle">{`${meters(result.lengthXMm)} m · ${input.spansX.count} claros de ${meters(input.spansX.lengthMm)} m`}</text>
      <text x={ox + w / 2} y={oy + h + 46} textAnchor="middle">{`${meters(result.lengthYMm)} m en Y · ${input.spansY.count} claros de ${meters(input.spansY.lengthMm)} m · h = ${formatNumber(result.thicknessMm / 10, 0)} cm`}</text>
    </g>
  </svg>;
}

/** Momento por metro de la franja en X que rige (M > 0 tensiona abajo, bajo columnas). */
export function MatStripDiagram({ result }: { result: MatFoundationResult }) {
  const { width: WIDTH, left, plot } = ELEVATION_FRAME;
  const strips = result.directions.x.strips;
  const governing = strips.reduce((best, item) => Math.max(item.positiveKnmPerM, item.negativeKnmPerM) > Math.max(best.positiveKnmPerM, best.negativeKnmPerM) ? item : best);
  const xs = governing.xMm.map((x) => x / 1000);
  const length = result.lengthXMm / 1000;
  const scaleX = (x: number) => left + x / length * plot;
  const columns = [...new Set(result.columns.map((column) => column.xMm / 1000))];
  const perMeter = governing.momentKnm.map((value) => value * 1000 / governing.widthMm);
  const band = 130;
  const { x } = result.directions;
  return <svg className="dw-drawing" viewBox={`0 0 ${WIDTH} ${band + 70}`} role="img"
    aria-label={`Momento por metro de la franja que rige en X: ${formatNumber(governing.positiveKnmPerM, 0)} bajo columnas y ${formatNumber(governing.negativeKnmPerM, 0)} entre columnas`}>
    <rect className="dw-beam" x={scaleX(0)} y={10} width={plot} height={10} />
    {columns.map((at) => <rect key={at} className="dw-column" x={scaleX(at) - 4} y={0} width={8} height={10} />)}
    <DiagramBand xs={xs} upper={perMeter} top={34} height={band} scaleX={scaleX} positive="down" tone="moment" label="M/m" unit="kN·m/m" nodesAtM={columns} />
    <text className="dw-callout" x={WIDTH / 2} y={band + 62} textAnchor="middle">
      {`Inferior X ${rebarLabel(result.input.barDiameterMm)} @ ${formatNumber(x.bottom.spacingMm / 10, 0)} cm · superior X @ ${formatNumber(x.top.spacingMm / 10, 0)} cm`}
    </text>
  </svg>;
}
