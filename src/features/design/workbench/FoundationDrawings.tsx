import type { MatFoundationResult } from '../../../design/elements/matFoundation';
import { rebarLabel } from '../../../design/elements/shared';
import type { StrapFootingResult } from '../../../design/elements/strapFooting';
import { DiagramBand, ELEVATION_FRAME } from './BeamDrawings';
import { formatNumber } from './common';

const meters = (mm: number) => formatNumber(mm / 1000, 2);

/** Fuerzas de un DCL a lo largo (m y kN): cargas hacia abajo, reacciones puntuales y suelo uniforme hacia arriba. */
export interface AlongFreeBody {
  readonly lengthM: number;
  readonly loads: readonly { readonly xM: number; readonly kn: number; readonly label: string }[];
  readonly reactions: readonly { readonly xM: number; readonly kn: number; readonly label: string }[];
  readonly soil: { readonly fromM: number; readonly toM: number; readonly knPerM: number; readonly label: string };
}

/** ΣFy del DCL: lo que baja contra lo que sube. */
export const freeBodyBalance = (body: AlongFreeBody) => ({
  downKn: body.loads.reduce((sum, load) => sum + load.kn, 0),
  upKn: body.reactions.reduce((sum, reaction) => sum + reaction.kn, 0) + body.soil.knPerM * (body.soil.toM - body.soil.fromM),
});

/**
 * DCL de la contratrabe con cargas últimas: P1u en el eje de la columna 1, la
 * reacción R1u repartida bajo la zapata 1 (B1) y R2u en el eje de la columna 2,
 * que también recibe P2u. Es el mismo cuerpo libre que da los diagramas.
 */
export function strapFreeBody(result: StrapFootingResult): AlongFreeBody {
  const { exteriorKn: r1u, interiorKn: r2u, exteriorColumnKn: p1u } = result.reactions.ultimate;
  const p2u = r2u + r1u - p1u;
  const x1 = result.input.exterior.widthMm / 2000;
  const x2 = x1 + result.input.spacingMm / 1000;
  const b1 = result.exteriorLengthMm / 1000;
  return {
    lengthM: x2,
    loads: [{ xM: x1, kn: p1u, label: 'P1u' }, { xM: x2, kn: p2u, label: 'P2u' }],
    reactions: [{ xM: x2, kn: r2u, label: 'R2u' }],
    soil: { fromM: 0, toM: b1, knPerM: r1u / b1, label: 'R1u' },
  };
}

/**
 * DCL de la franja en X que rige: cargas de columna y reacción uniforme
 * ajustadas a su promedio, como en el método de franjas que da los momentos.
 */
export function matStripFreeBody(result: MatFoundationResult): AlongFreeBody {
  const strips = result.directions.x.strips;
  const governing = strips.reduce((best, item) => Math.max(item.positiveKnmPerM, item.negativeKnmPerM) > Math.max(best.positiveKnmPerM, best.negativeKnmPerM) ? item : best);
  const length = result.lengthXMm / 1000;
  const columns = result.columns.filter((column) => column.yMm === governing.centerMm).sort((left, right) => left.xMm - right.xMm);
  const loads = columns.reduce((sum, column) => sum + column.ultimateKn, 0);
  const soil = result.ultimate.pressureKpa * governing.widthMm / 1000 * length;
  const average = (soil + loads) / 2;
  const loadFactor = loads > 0 ? average / loads : 1;
  return {
    lengthM: length,
    loads: columns.map((column, index) => ({ xM: column.xMm / 1000, kn: column.ultimateKn * loadFactor, label: `P${index + 1}u` })),
    reactions: [],
    soil: { fromM: 0, toM: length, knPerM: average / length, label: 'q' },
  };
}

/** Dibujo del DCL dentro de otro SVG: ocupa `FREE_BODY_HEIGHT` px desde arriba. */
const FREE_BODY_HEIGHT = 112;
function FreeBodyMarks({ body, id, scaleX }: { body: AlongFreeBody; id: string; scaleX: (xM: number) => number }) {
  const beamY = 40;
  const { downKn, upKn } = freeBodyBalance(body);
  const arrows = Math.max(2, Math.round((body.soil.toM - body.soil.fromM) / body.lengthM * 12));
  const soilXs = Array.from({ length: arrows + 1 }, (_, index) => body.soil.fromM + (body.soil.toM - body.soil.fromM) * index / arrows);
  const anchor = (xM: number) => xM > body.lengthM * 0.75 ? 'end' : 'start';
  const offset = (xM: number) => anchor(xM) === 'end' ? -6 : 6;
  return <g>
    <defs>
      <marker id={`${id}-load`} viewBox="0 0 10 10" refX="5" refY="9" markerWidth="7" markerHeight="7"><path d="M0,0 L5,10 L10,0 Z" className="dw-load__head" /></marker>
      <marker id={`${id}-up`} viewBox="0 0 10 10" refX="5" refY="1" markerWidth="7" markerHeight="7"><path d="M0,10 L5,0 L10,10 Z" className="dw-fbd__head" /></marker>
      <marker id={`${id}-soil`} viewBox="0 0 10 10" refX="5" refY="1" markerWidth="6" markerHeight="6"><path d="M0,10 L5,0 L10,10 Z" className="dw-soil__head" /></marker>
    </defs>
    {body.loads.map((load) => <g key={load.label} className="dw-load dw-load--point">
      <line x1={scaleX(load.xM)} x2={scaleX(load.xM)} y1={16} y2={beamY - 6} markerEnd={`url(#${id}-load)`} />
      <text x={scaleX(load.xM) + offset(load.xM)} y={11} textAnchor={anchor(load.xM)}>{`${load.label} = ${formatNumber(load.kn, 0)} kN`}</text>
    </g>)}
    <line className="dw-fbd__beam" x1={scaleX(0)} x2={scaleX(body.lengthM)} y1={beamY} y2={beamY} />
    <g className="dw-soil">
      {soilXs.map((x) => <line key={x} x1={scaleX(x)} x2={scaleX(x)} y1={beamY + 26} y2={beamY + 6} markerEnd={`url(#${id}-soil)`} />)}
      <text x={scaleX((body.soil.fromM + body.soil.toM) / 2)} y={beamY + 40} textAnchor="middle">
        {`${body.soil.label} = ${formatNumber(body.soil.knPerM * (body.soil.toM - body.soil.fromM), 0)} kN · ${formatNumber(body.soil.knPerM, 1)} kN/m`}
      </text>
    </g>
    {body.reactions.map((reaction) => <g key={reaction.label} className="dw-fbd__reaction">
      <line x1={scaleX(reaction.xM)} x2={scaleX(reaction.xM)} y1={beamY + 34} y2={beamY + 6} markerEnd={`url(#${id}-up)`} />
      <text x={scaleX(reaction.xM) + offset(reaction.xM)} y={beamY + 40} textAnchor={anchor(reaction.xM)}>{`${reaction.label} = ${formatNumber(reaction.kn, 0)} kN`}</text>
    </g>)}
    <text className="dw-fbd__letter" x={scaleX(0)} y={beamY + 62}>{`ΣFy = 0 · Σ cargas = ${formatNumber(downKn, 1)} kN · Σ reacciones = ${formatNumber(upKn, 1)} kN`}</text>
  </g>;
}

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
  const body = strapFreeBody(result);
  const [p1, p2] = body.loads;
  return <svg className="dw-drawing" viewBox={`0 0 ${WIDTH} ${2 * band + 90 + FREE_BODY_HEIGHT}`} role="img"
    aria-label={`DCL y diagramas de la contratrabe: P1u ${formatNumber(p1!.kn, 0)} y P2u ${formatNumber(p2!.kn, 0)} kN; R1u ${formatNumber(result.reactions.ultimate.exteriorKn, 0)} kN bajo la zapata 1 y R2u ${formatNumber(result.reactions.ultimate.interiorKn, 0)} kN en la zapata 2; momento negativo máximo ${formatNumber(result.strap.top.momentKnm, 0)} kilonewton metro y cortante ${formatNumber(result.strap.shear.demandKn, 0)} kilonewton`}>
    <FreeBodyMarks body={body} id="dw-strap-fbd" scaleX={scaleX} />
    <g transform={`translate(0 ${FREE_BODY_HEIGHT})`}>
    <rect className="dw-beam" x={scaleX(0)} y={12} width={plot} height={12} />
    <rect className="dw-concrete" x={scaleX(0)} y={24} width={result.exteriorLengthMm / 1000 / length * plot} height={6}><title>Zapata 1</title></rect>
    {columns.map((x, index) => <rect key={index} className="dw-column" x={scaleX(x) - 4} y={0} width={8} height={12} />)}
    <DiagramBand xs={xs} upper={result.diagram.shearKn} top={44} height={band} scaleX={scaleX} positive="up" tone="shear" label="Cortante" unit="kN" nodesAtM={columns} />
    <DiagramBand xs={xs} upper={result.diagram.momentKnm} top={64 + band} height={band} scaleX={scaleX} positive="down" tone="moment" label="Momento" unit="kN·m" nodesAtM={columns} />
    </g>
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
  const body = matStripFreeBody(result);
  return <svg className="dw-drawing" viewBox={`0 0 ${WIDTH} ${band + 70 + FREE_BODY_HEIGHT}`} role="img"
    aria-label={`DCL y momento por metro de la franja que rige en X: ${body.loads.length} cargas de columna y reacción de ${formatNumber(body.soil.knPerM, 1)} kN/m; ${formatNumber(governing.positiveKnmPerM, 0)} bajo columnas y ${formatNumber(governing.negativeKnmPerM, 0)} entre columnas`}>
    <FreeBodyMarks body={body} id="dw-mat-fbd" scaleX={scaleX} />
    <g transform={`translate(0 ${FREE_BODY_HEIGHT})`}>
    <rect className="dw-beam" x={scaleX(0)} y={10} width={plot} height={10} />
    {columns.map((at) => <rect key={at} className="dw-column" x={scaleX(at) - 4} y={0} width={8} height={10} />)}
    <DiagramBand xs={xs} upper={perMeter} top={34} height={band} scaleX={scaleX} positive="down" tone="moment" label="M/m" unit="kN·m/m" nodesAtM={columns} />
    <text className="dw-callout" x={WIDTH / 2} y={band + 62} textAnchor="middle">
      {`Inferior X ${rebarLabel(result.input.barDiameterMm)} @ ${formatNumber(x.bottom.spacingMm / 10, 0)} cm · superior X @ ${formatNumber(x.top.spacingMm / 10, 0)} cm`}
    </text>
    </g>
  </svg>;
}
