import type { ColumnDesignResult, InteractionPoint } from '../../../design/elements/column';
import { rebarLabel } from '../../../design/elements/shared';
import { formatNumber } from './common';

export function ColumnSection({ result }: { result: ColumnDesignResult }) {
  const { widthMm: b, depthMm: h, coverMm, tieDiameterMm: dt, barDiameterMm: db } = result.input;
  const size = 230;
  const scale = Math.min(170 / b, 170 / h);
  const width = b * scale;
  const height = h * scale;
  const cx = size / 2;
  const cy = size / 2 - 4;
  const ox = cx - width / 2;
  const oy = cy - height / 2;
  const inset = (coverMm + dt / 2) * scale;
  return <svg className="dw-drawing dw-drawing--section" viewBox={`0 0 ${size} ${size + 30}`} role="img"
    aria-label={`Sección de columna ${b / 10} por ${h / 10} centímetros con ${result.bars.length} varillas ${rebarLabel(db)}`}>
    <rect className="dw-concrete" x={ox} y={oy} width={width} height={height} />
    <rect className="dw-stirrup" x={ox + inset} y={oy + inset} width={width - 2 * inset} height={height - 2 * inset}
      rx={Math.max(2, 2 * dt * scale)} style={{ strokeWidth: Math.max(1.5, dt * scale) }} />
    <g className="dw-axis">
      <line x1={ox - 14} x2={ox + width + 14} y1={cy} y2={cy} />
      <line x1={cx} x2={cx} y1={oy - 14} y2={oy + height + 14} />
      <text x={ox + width + 16} y={cy + 4}>X</text>
      <text x={cx - 4} y={oy - 18}>Y</text>
    </g>
    {result.bars.map((bar, index) => <circle key={index} className="dw-bar" cx={cx + bar.x * scale} cy={cy - bar.y * scale} r={Math.max(2.6, db / 2 * scale)} />)}
    <g className="dw-dimension">
      <line x1={ox} x2={ox + width} y1={oy + height + 22} y2={oy + height + 22} />
      <text x={cx} y={oy + height + 36} textAnchor="middle">{`b = ${formatNumber(b / 10, 0)} cm`}</text>
      <line x1={ox - 22} x2={ox - 22} y1={oy} y2={oy + height} />
      <text x={ox - 26} y={cy} textAnchor="middle" transform={`rotate(-90 ${ox - 26} ${cy})`} dy={-4}>{`h = ${formatNumber(h / 10, 0)} cm`}</text>
    </g>
  </svg>;
}

const niceStep = (range: number, target: number) => {
  const raw = range / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / power;
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * power;
};

const ticks = (min: number, max: number, target: number) => {
  const step = niceStep(max - min, target);
  const values: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max + 1e-9; value += step) values.push(Math.abs(value) < 1e-9 ? 0 : value);
  return values;
};

export function InteractionChart({ result }: { result: ColumnDesignResult }) {
  const W = 480;
  const H = 380;
  const pad = { left: 62, right: 20, top: 18, bottom: 44 };
  const { axialKn } = result.input;
  const mx = result.magnification.x.designMomentKnm;
  const my = result.magnification.y.designMomentKnm;
  const magnified = result.magnification.x.factor > 1 || result.magnification.y.factor > 1;
  const curves = [result.aboutX.nominal, result.aboutY.nominal];
  const maxM = Math.max(...curves.flat().map((point) => point.momentKnm), mx, my) * 1.08 || 1;
  const minP = Math.min(...curves.flat().map((point) => point.axialKn), axialKn) * 1.08;
  const maxP = Math.max(...curves.flat().map((point) => point.axialKn), axialKn) * 1.05;
  const sx = (m: number) => pad.left + m / maxM * (W - pad.left - pad.right);
  const sy = (p: number) => pad.top + (maxP - p) / (maxP - minP) * (H - pad.top - pad.bottom);
  const path = (points: readonly InteractionPoint[]) => points.map((point, index) => `${index ? 'L' : 'M'}${sx(point.momentKnm).toFixed(1)},${sy(point.axialKn).toFixed(1)}`).join(' ');
  const symmetric = Math.abs(result.input.widthMm - result.input.depthMm) < 1e-6 && result.input.barsAlongWidth === result.input.barsAlongDepth;
  const demand = [
    ...(mx > 0 || my === 0 ? [{ id: 'x', m: mx, label: magnified ? 'Mcx' : 'Mux' }] : []),
    ...(my > 0 ? [{ id: 'y', m: my, label: magnified ? 'Mcy' : 'Muy' }] : []),
  ];

  return <svg className="dw-drawing dw-chart" viewBox={`0 0 ${W} ${H}`} role="img"
    aria-label={`Diagrama de interacción. Demanda Pu ${formatNumber(axialKn, 0)} kN; relación de capacidad ${Math.round(result.capacity.ratio * 100)} por ciento`}>
    <g className="dw-chart__grid">
      {ticks(0, maxM, 5).map((value) => <g key={`m${value}`}>
        <line x1={sx(value)} x2={sx(value)} y1={pad.top} y2={H - pad.bottom} />
        <text x={sx(value)} y={H - pad.bottom + 16} textAnchor="middle">{formatNumber(value, 0)}</text>
      </g>)}
      {ticks(minP, maxP, 6).map((value) => <g key={`p${value}`}>
        <line x1={pad.left} x2={W - pad.right} y1={sy(value)} y2={sy(value)} />
        <text x={pad.left - 8} y={sy(value) + 4} textAnchor="end">{formatNumber(value, 0)}</text>
      </g>)}
    </g>
    <line className="dw-chart__zero" x1={pad.left} x2={W - pad.right} y1={sy(0)} y2={sy(0)} />
    <text className="dw-chart__title" x={(W + pad.left) / 2} y={H - 6} textAnchor="middle">Momento M (kN·m)</text>
    <text className="dw-chart__title" x={16} y={(H - pad.bottom) / 2} textAnchor="middle" transform={`rotate(-90 16 ${(H - pad.bottom) / 2})`}>Carga axial P (kN)</text>

    <path className="dw-curve dw-curve--nominal" d={path(result.aboutX.nominal)} />
    {!symmetric ? <path className="dw-curve dw-curve--nominal" d={path(result.aboutY.nominal)} /> : null}
    <path className="dw-curve dw-curve--x" d={path(result.aboutX.design)} />
    {!symmetric ? <path className="dw-curve dw-curve--y" d={path(result.aboutY.design)} /> : null}
    <g className="dw-chart__cap">
      <line x1={pad.left} x2={sx(maxM * 0.55)} y1={sy(result.maximumDesignAxialKn)} y2={sy(result.maximumDesignAxialKn)} />
      <text x={sx(maxM * 0.55) + 4} y={sy(result.maximumDesignAxialKn) + 4}>{`φPn,máx ${formatNumber(result.maximumDesignAxialKn, 0)}`}</text>
    </g>
    <circle className="dw-chart__balanced" cx={sx(result.aboutX.balanced.momentKnm * 0.65)} cy={sy(result.aboutX.balanced.axialKn * 0.65)} r={3.5}>
      <title>Falla balanceada (φ·Pb, φ·Mb)</title>
    </circle>
    {demand.map((point) => <g key={point.id} className={`dw-demand dw-demand--${point.id}`}>
      <line x1={sx(0)} y1={sy(0)} x2={sx(point.m)} y2={sy(axialKn)} />
      <circle cx={sx(point.m)} cy={sy(axialKn)} r={5.5} />
      <text x={sx(point.m) + 9} y={sy(axialKn) - 8}>{`${point.label}, Pu`}</text>
    </g>)}
  </svg>;
}
