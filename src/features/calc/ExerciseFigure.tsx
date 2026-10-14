import type { ExerciseFigure as Figure } from '../../design/exercises/types';
import { formatQuantity, type UnitSystem } from '../../design/exercises/units';

/*
 * Figuras de los ejercicios. Colores de señal del canon: N (azul) para el
 * bloque de compresión y el diagrama de interacción, V (verde) para cortante,
 * M (rojo de momento) para flexión; las cargas con sus colores de carga.
 */

const W = 320;

function SectionFigure({ figure, units }: { figure: Extract<Figure, { type: 'section' }>; units: UnitSystem }) {
  const flange = figure.flange;
  const totalWidth = flange ? flange.widthMm : figure.widthMm;
  const scale = Math.min(220 / totalWidth, 200 / figure.heightMm);
  const width = figure.widthMm * scale;
  const height = figure.heightMm * scale;
  const outer = totalWidth * scale;
  const left = (W - outer) / 2;
  const webLeft = (W - width) / 2;
  const top = 26;
  const flangeH = flange ? flange.thicknessMm * scale : 0;
  const outline = flange
    ? `M${left} ${top} h${outer} v${flangeH} h${-(outer - width) / 2} v${height - flangeH} h${-width} v${-(height - flangeH)} h${-(outer - width) / 2} Z`
    : `M${webLeft} ${top} h${width} v${height} h${-width} Z`;
  const block = figure.blockDepthMm ? Math.min(figure.blockDepthMm, figure.heightMm) * scale : 0;
  const blockPath = !block ? '' : flange && block > flangeH
    ? `M${left} ${top} h${outer} v${flangeH} h${-(outer - width) / 2} v${block - flangeH} h${-width} v${-(block - flangeH)} h${-(outer - width) / 2} Z`
    : flange ? `M${left} ${top} h${outer} v${block} h${-outer} Z` : `M${webLeft} ${top} h${width} v${block} h${-width} Z`;
  const cover = Math.max(4, 40 * scale);
  return <svg className="fc-figure__svg" viewBox={`0 0 ${W} ${top + height + 34}`} role="img" aria-label="Sección transversal">
    {blockPath ? <path d={blockPath} className="fc-fig-block" /> : null}
    <path d={outline} className="fc-fig-outline" />
    {figure.neutralAxisMm && figure.neutralAxisMm < figure.heightMm ? <g>
      <line x1={left - 8} x2={left + outer + 8} y1={top + figure.neutralAxisMm * scale} y2={top + figure.neutralAxisMm * scale} className="fc-fig-axis" />
      <text x={left + outer + 10} y={top + figure.neutralAxisMm * scale + 4} className="fc-fig-label">E.N.</text>
    </g> : null}
    {figure.layers.map((layer, layerIndex) => {
      const r = Math.max(2.5, Math.min(7, layer.diameterMm * scale / 2));
      const span = width - 2 * cover - 2 * r;
      return <g key={layerIndex}>
        {Array.from({ length: layer.count }, (_, index) => <circle key={index} className="fc-fig-bar"
          cx={webLeft + cover + r + (layer.count === 1 ? span / 2 : span * index / (layer.count - 1))} cy={top + layer.fromTopMm * scale} r={r} />)}
      </g>;
    })}
    <text x={W / 2} y={top - 9} textAnchor="middle" className="fc-fig-label">{formatQuantity(units, 'section', totalWidth)}</text>
    {flange ? <text x={W / 2} y={top + height + 18} textAnchor="middle" className="fc-fig-label">b′ = {formatQuantity(units, 'section', figure.widthMm)}</text> : null}
    <text x={webLeft + width + 8} y={top + height / 2 + (flange ? 10 : 0)} className="fc-fig-label">{formatQuantity(units, 'section', figure.heightMm)}</text>
    {block ? <text x={webLeft - 8} y={top + block / 2 + 4} textAnchor="end" className="fc-fig-label fc-fig-label--axial">a</text> : null}
  </svg>;
}

function InteractionFigure({ figure, units }: { figure: Extract<Figure, { type: 'interaction' }>; units: UnitSystem }) {
  const all = [...figure.nominal, ...figure.design, ...(figure.point ? [figure.point] : [])];
  const maxM = Math.max(...all.map((point) => point.m), 1) * 1.1;
  const maxP = Math.max(...all.map((point) => point.p), 1) * 1.08;
  const minP = Math.min(...all.map((point) => point.p), 0) * 1.08;
  const H = 250, padL = 58, padB = 26, padT = 22, padR = 16;
  const x = (m: number) => padL + m / maxM * (W - padL - padR);
  const y = (p: number) => padT + (maxP - p) / (maxP - minP) * (H - padT - padB);
  const path = (points: readonly { p: number; m: number }[]) => points.map((point, index) => `${index ? 'L' : 'M'}${x(Math.max(0, point.m)).toFixed(1)} ${y(point.p).toFixed(1)}`).join(' ');
  return <svg className="fc-figure__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Diagrama de interacción">
    <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} className="fc-fig-grid" />
    <line x1={padL} x2={padL} y1={padT} y2={H - padB} className="fc-fig-grid" />
    <path d={path(figure.nominal)} className="fc-fig-curve fc-fig-curve--nominal" />
    <path d={path(figure.design)} className="fc-fig-curve" />
    {figure.point ? <g>
      <line x1={x(0)} y1={y(0)} x2={x(figure.point.m)} y2={y(figure.point.p)} className="fc-fig-ray" />
      <circle cx={x(figure.point.m)} cy={y(figure.point.p)} r={5} className={figure.ok ? 'fc-fig-point is-ok' : 'fc-fig-point is-fail'} />
    </g> : null}
    <text x={padL} y={padT - 8} textAnchor="middle" className="fc-fig-label">P</text>
    <text x={W - padR} y={y(0) - 6} textAnchor="end" className="fc-fig-label">M</text>
    <text x={padL - 6} y={y(maxP / 1.08) + 4} textAnchor="end" className="fc-fig-tick">{formatQuantity(units, 'force', maxP / 1.08).replace(/ .*/, '')}</text>
    <text x={x(maxM / 1.1)} y={y(0) + 16} textAnchor="middle" className="fc-fig-tick">{formatQuantity(units, 'moment', maxM / 1.1)}</text>
    <g className="fc-fig-legend" transform={`translate(${W - 150} ${padT + 4})`}>
      <line x1="0" x2="18" y1="0" y2="0" className="fc-fig-curve" /><text x="24" y="4">Diseño (FR)</text>
      <line x1="0" x2="18" y1="16" y2="16" className="fc-fig-curve fc-fig-curve--nominal" /><text x="24" y="20">Nominal</text>
    </g>
  </svg>;
}

function BeamFigure({ figure, units }: { figure: Extract<Figure, { type: 'beam' }>; units: UnitSystem }) {
  const padL = 24, padR = 24;
  const span = W - padL - padR;
  const x = (value: number) => padL + value / figure.lengthM * span;
  const maxV = Math.max(...figure.stations.map((point) => Math.abs(point.v)), 1e-9);
  const maxM = Math.max(...figure.stations.map((point) => Math.abs(point.m)), 1e-9);
  const beamY = 46, vY = 124, mY = figure.support === 'simple' ? 176 : 214, amp = 32;
  const area = (values: readonly { x: number; value: number }[], base: number, scale: number) =>
    `M${x(0)} ${base} ${values.map((point) => `L${x(point.x).toFixed(1)} ${(base - point.value * scale).toFixed(1)}`).join(' ')} L${x(figure.lengthM)} ${base} Z`;
  const vPath = area(figure.stations.map((point) => ({ x: point.x, value: point.v })), vY, amp / maxV);
  // Momento positivo hacia abajo (lado de tensión), como en los libros.
  const mPath = area(figure.stations.map((point) => ({ x: point.x, value: -point.m })), mY, amp / maxM);
  const peak = figure.stations.reduce((best, point) => Math.abs(point.m) > Math.abs(best.m) ? point : best, figure.stations[0]!);
  const shearPeak = figure.stations.reduce((best, point) => Math.abs(point.v) > Math.abs(best.v) ? point : best, figure.stations[0]!);
  const arrows = figure.line > 0 ? Array.from({ length: 11 }, (_, index) => x(figure.lengthM * index / 10)) : [];
  return <svg className="fc-figure__svg" viewBox={`0 0 ${W} ${mY + 48}`} role="img" aria-label="Viga con diagramas de cortante y momento">
    {arrows.length ? <g className="fc-fig-load-line">
      <line x1={x(0)} x2={x(figure.lengthM)} y1={beamY - 22} y2={beamY - 22} />
      {arrows.map((ax, index) => <path key={index} d={`M${ax} ${beamY - 22} V${beamY - 5} m-3 -4 l3 4 l3 -4`} />)}
    </g> : null}
    {figure.point > 0 ? <path className="fc-fig-load-point" d={`M${x(figure.pointAtM)} ${beamY - 38} V${beamY - 4} m-4 -6 l4 6 l4 -6`} /> : null}
    <line x1={x(0)} x2={x(figure.lengthM)} y1={beamY} y2={beamY} className="fc-fig-beam" />
    {figure.support === 'simple' ? <g className="fc-fig-support">
      <path d={`M${x(0)} ${beamY + 2} l-7 11 h14 Z`} />
      <path d={`M${x(figure.lengthM)} ${beamY + 2} l-7 11 h14 Z`} /><line x1={x(figure.lengthM) - 9} x2={x(figure.lengthM) + 9} y1={beamY + 16} y2={beamY + 16} />
    </g> : <g className="fc-fig-support"><line x1={x(0)} x2={x(0)} y1={beamY - 14} y2={beamY + 14} /><path d={`M${x(0)} ${beamY - 14} l-6 6 M${x(0)} ${beamY - 4} l-6 6 M${x(0)} ${beamY + 6} l-6 6`} /></g>}
    <text x={W / 2} y={beamY + 30} textAnchor="middle" className="fc-fig-tick">L = {formatQuantity(units, 'span', figure.lengthM)}</text>
    <line x1={x(0)} x2={x(figure.lengthM)} y1={vY} y2={vY} className="fc-fig-grid" />
    <path d={vPath} className="fc-fig-diagram fc-fig-diagram--shear" />
    <text x={4} y={vY - amp - 4} className="fc-fig-label fc-fig-label--shear">V</text>
    <text x={Math.min(Math.max(x(shearPeak.x), 50), W - 50)} y={vY - Math.sign(shearPeak.v) * (amp + 6) + (shearPeak.v < 0 ? 10 : 0)} textAnchor="middle" className="fc-fig-tick">{formatQuantity(units, 'force', Math.abs(shearPeak.v))}</text>
    <line x1={x(0)} x2={x(figure.lengthM)} y1={mY} y2={mY} className="fc-fig-grid" />
    <path d={mPath} className="fc-fig-diagram fc-fig-diagram--moment" />
    <text x={4} y={mY - amp - 4} className="fc-fig-label fc-fig-label--moment">M</text>
    <text x={Math.min(Math.max(x(peak.x), 50), W - 50)} y={mY + Math.sign(peak.m) * (amp + 14) - (peak.m < 0 ? 4 : 0)} textAnchor="middle" className="fc-fig-tick">{formatQuantity(units, 'moment', peak.m)}</text>
  </svg>;
}

function FootingFigure({ figure, units }: { figure: Extract<Figure, { type: 'footing' }>; units: UnitSystem }) {
  const size = 170;
  const scale = size / figure.sideMm;
  const left = 20, top = 20;
  const column = figure.columnMm * scale;
  const critical = (figure.columnMm + figure.depthMm) * scale;
  const center = left + size / 2;
  const elevX = 210, elevW = 96, elevScale = elevW / figure.sideMm;
  const elevH = Math.max(14, figure.heightMm * elevScale);
  return <svg className="fc-figure__svg" viewBox={`0 0 ${W} ${top + size + 30}`} role="img" aria-label="Zapata en planta y corte">
    <rect x={left} y={top} width={size} height={size} className="fc-fig-outline" />
    <rect x={center - critical / 2} y={top + size / 2 - critical / 2} width={critical} height={critical} className="fc-fig-axis" fill="none" />
    <rect x={center - column / 2} y={top + size / 2 - column / 2} width={column} height={column} className="fc-fig-column" />
    <text x={center} y={top + size + 18} textAnchor="middle" className="fc-fig-label">B = {formatQuantity(units, 'section', figure.sideMm)}</text>
    <text x={center} y={top + size / 2 - critical / 2 - 5} textAnchor="middle" className="fc-fig-tick">c + d</text>
    <g>
      <rect x={elevX} y={top + 70} width={elevW} height={elevH} className="fc-fig-outline" />
      <rect x={elevX + elevW / 2 - Math.max(6, figure.columnMm * elevScale) / 2} y={top + 20} width={Math.max(6, figure.columnMm * elevScale)} height={50} className="fc-fig-column" />
      <text x={elevX + elevW + 4} y={top + 74 + elevH / 2} className="fc-fig-tick">h = {formatQuantity(units, 'section', figure.heightMm)}</text>
      <text x={elevX + elevW / 2} y={top + 70 + elevH + 18} textAnchor="middle" className="fc-fig-tick">Corte</text>
    </g>
  </svg>;
}

export function ExerciseFigure({ figure, units }: { figure: Figure; units: UnitSystem }) {
  return <figure className="fc-figure">
    {figure.type === 'section' ? <SectionFigure figure={figure} units={units} />
      : figure.type === 'interaction' ? <InteractionFigure figure={figure} units={units} />
        : figure.type === 'beam' ? <BeamFigure figure={figure} units={units} />
          : <FootingFigure figure={figure} units={units} />}
  </figure>;
}
