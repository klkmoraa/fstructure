import type { ColumnDesignResult, InteractionPoint } from '../../../design/elements/column';
import { rebarLabel } from '../../../design/elements/shared';
import { formatNumber } from './common';

function CircularColumnSection({ result }: { result: ColumnDesignResult }) {
  const { widthMm: diameter, coverMm, tieDiameterMm: dt, barDiameterMm: db } = result.input;
  const size = 230;
  const scale = 170 / diameter;
  const radius = diameter * scale / 2;
  const cx = size / 2;
  const cy = size / 2 - 4;
  const hoop = (diameter / 2 - coverMm - dt / 2) * scale;
  const spiral = result.ties.spiral;
  return <svg className="dw-drawing dw-drawing--section" viewBox={`0 0 ${size} ${size + 30}`} role="img"
    aria-label={`Sección circular de columna de ${diameter / 10} centímetros de diámetro con ${result.bars.length} varillas ${rebarLabel(db)}${spiral ? ` y zuncho ${rebarLabel(dt)} a paso de ${formatNumber(spiral.pitchMm / 10, 1)} centímetros` : ''}`}>
    <circle className="dw-concrete" cx={cx} cy={cy} r={radius} />
    <circle className="dw-stirrup" cx={cx} cy={cy} r={hoop} style={{ strokeWidth: Math.max(1.5, dt * scale) }} />
    <g className="dw-dimension">
      <line x1={cx - radius} x2={cx - radius + coverMm * scale} y1={cy + 28} y2={cy + 28} />
      <line x1={cx - radius} x2={cx - radius} y1={cy + 23} y2={cy + 33} />
      <line x1={cx - radius + coverMm * scale} x2={cx - radius + coverMm * scale} y1={cy + 23} y2={cy + 33} />
      <text x={cx - radius - 4} y={cy + 45}>{`c = ${formatNumber(coverMm / 10, 1)} cm`}</text>
    </g>
    <g className="dw-axis">
      <line x1={cx - radius - 14} x2={cx + radius + 14} y1={cy} y2={cy} />
      <line x1={cx} x2={cx} y1={cy - radius - 14} y2={cy + radius + 14} />
      <text x={cx + radius + 16} y={cy + 4}>X</text>
      <text x={cx - 4} y={cy - radius - 18}>Y</text>
    </g>
    {result.bars.map((bar, index) => <circle key={index} className="dw-bar" cx={cx + bar.x * scale} cy={cy - bar.y * scale} r={Math.max(2.6, db / 2 * scale)} />)}
    <g className="dw-dimension">
      <line x1={cx - radius} x2={cx + radius} y1={cy + radius + 22} y2={cy + radius + 22} />
      <text x={cx} y={cy + radius + 36} textAnchor="middle">{`D = ${formatNumber(diameter / 10, 0)} cm${spiral ? ` · zuncho @ ${formatNumber(spiral.pitchMm / 10, 1)} cm` : ''}`}</text>
    </g>
  </svg>;
}

export function ColumnSection({ result }: { result: ColumnDesignResult }) {
  if (result.input.shape === 'circular') return <CircularColumnSection result={result} />;
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
  const barInset = (coverMm + dt + db / 2) * scale;
  const xBars = result.input.barsAlongWidth;
  const yBars = result.input.barsAlongDepth;
  const restrained = (count: number, crossTies: number) => Array.from({ length: Math.max(0, count - 2) }, (_, i) => i + 1)
    .filter((index) => crossTies === count - 2 || index % 2 === 0);
  const verticalGrapas = restrained(xBars, result.ties.crossTiesParallelToY);
  const horizontalGrapas = restrained(yBars, result.ties.crossTiesParallelToX);
  const hook = Math.min(9, Math.max(4, dt * scale * 2));
  return <svg className="dw-drawing dw-drawing--section" viewBox={`0 0 ${size} ${size + 30}`} role="img"
    aria-label={`Sección de columna ${b / 10} por ${h / 10} centímetros con ${result.bars.length} varillas ${rebarLabel(db)}`}>
    <rect className="dw-concrete" x={ox} y={oy} width={width} height={height} />
    <rect className="dw-stirrup" x={ox + inset} y={oy + inset} width={width - 2 * inset} height={height - 2 * inset}
      rx={Math.max(2, 2 * dt * scale)} style={{ strokeWidth: Math.max(1.5, dt * scale) }} />
    <g className="dw-stirrup" style={{ strokeWidth: Math.max(1.2, dt * scale * 0.75) }}>
      {verticalGrapas.map((index) => {
        const x = ox + barInset + (width - 2 * barInset) * index / (xBars - 1);
        return <path key={`y${index}`} d={`M${x + hook},${oy + barInset + hook} L${x},${oy + barInset} L${x},${oy + height - barInset} L${x - hook},${oy + height - barInset - hook}`}><title>Grapa paralela a Y, apoya dos barras</title></path>;
      })}
      {horizontalGrapas.map((index) => {
        const y = oy + barInset + (height - 2 * barInset) * index / (yBars - 1);
        return <path key={`x${index}`} d={`M${ox + barInset + hook},${y - hook} L${ox + barInset},${y} L${ox + width - barInset},${y} L${ox + width - barInset - hook},${y + hook}`}><title>Grapa paralela a X, apoya dos barras</title></path>;
      })}
    </g>
    <g className="dw-axis">
      <line x1={ox - 14} x2={ox + width + 14} y1={cy} y2={cy} />
      <line x1={cx} x2={cx} y1={oy - 14} y2={oy + height + 14} />
      <text x={ox + width + 16} y={cy + 4}>X</text>
      <text x={cx - 4} y={oy - 18}>Y</text>
    </g>
    {result.bars.map((bar, index) => <circle key={index} className="dw-bar" cx={cx + bar.x * scale} cy={cy - bar.y * scale} r={Math.max(2.6, db / 2 * scale)} />)}
    <g className="dw-dimension">
      <line x1={ox} x2={ox + coverMm * scale} y1={cy + 28} y2={cy + 28} />
      <line x1={ox} x2={ox} y1={cy + 23} y2={cy + 33} />
      <line x1={ox + coverMm * scale} x2={ox + coverMm * scale} y1={cy + 23} y2={cy + 33} />
      <text x={ox - 3} y={cy + 44}>{`c = ${formatNumber(coverMm / 10, 1)} cm`}</text>
      <line x1={ox} x2={ox + width} y1={oy + height + 22} y2={oy + height + 22} />
      <text x={cx} y={oy + height + 36} textAnchor="middle">{`b = ${formatNumber(b / 10, 0)} cm`}</text>
      <line x1={ox - 22} x2={ox - 22} y1={oy} y2={oy + height} />
      <text x={ox - 26} y={cy} textAnchor="middle" transform={`rotate(-90 ${ox - 26} ${cy})`} dy={-4}>{`h = ${formatNumber(h / 10, 0)} cm`}</text>
    </g>
    <text className="dw-stirrup-label" x={cx} y={size + 22} textAnchor="middle">{`Estribo cerrado + ${horizontalGrapas.length + verticalGrapas.length} grapas / juego`}</text>
  </svg>;
}

/** Posiciones ilustrativas: cada zona conserva la separación elegida y cierra el intervalo final. */
export function columnTiePositionsMm(result: ColumnDesignResult): readonly number[] {
  const height = result.input.unbracedLengthM * 1e3;
  const end = Math.min(result.ties.endLengthMm, height / 2);
  const zones = end > 0
    ? [{ start: 0, end, spacing: result.ties.endSpacingMm }, { start: end, end: height - end, spacing: result.ties.centerSpacingMm }, { start: height - end, end: height, spacing: result.ties.endSpacingMm }]
    : [{ start: 0, end: height, spacing: result.ties.centerSpacingMm }];
  const positions = zones.flatMap((zone) => {
    const count = Math.ceil((zone.end - zone.start) / zone.spacing - 1e-9);
    // Entradas extremas no bloquean el SVG; si hay demasiadas piezas se muestra una selección.
    const stride = Math.max(1, Math.ceil(count / 250));
    const displayed = Math.ceil(count / stride);
    return Array.from({ length: displayed + 1 }, (_, index) => zone.start + Math.min(index * stride * zone.spacing, zone.end - zone.start));
  });
  return [...new Set(positions)];
}

export function ColumnElevation({ result }: { result: ColumnDesignResult }) {
  const height = result.input.unbracedLengthM * 1e3;
  const width = result.input.widthMm;
  const end = Math.min(result.ties.endLengthMm, height / 2);
  const ox = 66;
  const oy = 32;
  const drawnHeight = 265;
  const drawnWidth = Math.max(42, Math.min(100, width / height * drawnHeight));
  const scaleY = drawnHeight / height;
  const scaleX = drawnWidth / width;
  const inset = result.input.coverMm * scaleX;
  const sx = (x: number) => ox + drawnWidth / 2 + x * scaleX;
  const sy = (z: number) => oy + drawnHeight - z * scaleY;
  const spiral = result.ties.spiral;
  const barsX = [...new Set(result.bars.map((bar) => Math.round(bar.x * 1000) / 1000))];
  const positions = columnTiePositionsMm(result);
  const pieceCount = end > 0
    ? 2 * Math.ceil(end / result.ties.endSpacingMm - 1e-9) + Math.ceil((height - 2 * end) / result.ties.centerSpacingMm - 1e-9) + 1
    : Math.ceil(height / result.ties.centerSpacingMm - 1e-9) + 1;
  const uniform = end === 0;
  const spacingLabel = (spacing: number) => `${spiral ? 'Paso' : 's'} = ${formatNumber(spacing / 10, 2)} cm`;
  const spiralSteps = spiral ? Math.min(4000, Math.max(16, Math.ceil(height / spiral.pitchMm) * 16)) : 0;
  const spiralPath = spiral ? Array.from({ length: spiralSteps + 1 }, (_, index) => {
    const z = height * index / spiralSteps;
    const x = ox + drawnWidth / 2 + (drawnWidth / 2 - inset) * Math.cos(2 * Math.PI * z / spiral.pitchMm);
    return `${index ? 'L' : 'M'}${x},${sy(z)}`;
  }).join(' ') : '';
  return <svg className="dw-drawing dw-drawing--section" viewBox="0 0 290 340" role="img"
    aria-label={`Elevación del refuerzo de columna de ${formatNumber(height / 1000, 2)} metros. ${spiral ? 'Zuncho continuo' : 'Estribos cerrados'} a ${formatNumber(result.ties.centerSpacingMm / 10, 2)} centímetros${end > 0 ? `; extremos Lo ${formatNumber(end / 10, 0)} centímetros con estribos a ${formatNumber(result.ties.endSpacingMm / 10, 2)} centímetros` : ''}. Esquema para comparar, no plano de taller.`}>
    <rect className="dw-concrete" x={ox} y={oy} width={drawnWidth} height={drawnHeight} />
    {end > 0 ? <g opacity={0.12}>
      <rect className="dw-zone" x={ox} y={oy} width={drawnWidth} height={end * scaleY} />
      <rect className="dw-zone" x={ox} y={sy(end)} width={drawnWidth} height={end * scaleY} />
    </g> : null}
    <g className="dw-rebar" style={{ strokeWidth: Math.max(1.2, result.input.barDiameterMm * scaleX) }}>
      {barsX.map((x) => <line key={x} x1={sx(x)} x2={sx(x)} y1={oy + 3} y2={oy + drawnHeight - 3} />)}
    </g>
    <g className="dw-stirrup" style={{ strokeWidth: Math.max(0.8, result.input.tieDiameterMm * scaleX) }}>
      {spiral ? <path d={spiralPath} /> : positions.map((z) => <line key={z} x1={ox + inset} x2={ox + drawnWidth - inset} y1={sy(z)} y2={sy(z)}><title>{`z = ${formatNumber(z / 10, 1)} cm`}</title></line>)}
    </g>
    <g className="dw-dimension">
      <line x1={ox - 22} x2={ox - 22} y1={oy} y2={oy + drawnHeight} />
      <line x1={ox - 28} x2={ox - 15} y1={oy} y2={oy} />
      <line x1={ox - 28} x2={ox - 15} y1={oy + drawnHeight} y2={oy + drawnHeight} />
      <text x={ox - 29} y={oy + drawnHeight / 2} textAnchor="middle" transform={`rotate(-90 ${ox - 29} ${oy + drawnHeight / 2})`}>{`lu = ${formatNumber(height / 1000, 2)} m`}</text>
      {uniform ? <text x={ox + drawnWidth + 12} y={oy + drawnHeight / 2}>{spacingLabel(result.ties.centerSpacingMm)}</text> : <>
        <text x={ox + drawnWidth + 12} y={oy + end * scaleY / 2 - 5}>{`Lo ${formatNumber(end / 10, 0)} cm`}</text>
        <text x={ox + drawnWidth + 12} y={oy + end * scaleY / 2 + 9}>{spacingLabel(result.ties.endSpacingMm)}</text>
        {height - 2 * end > 0 ? <text x={ox + drawnWidth + 12} y={oy + drawnHeight / 2}>{spacingLabel(result.ties.centerSpacingMm)}</text> : null}
        <text x={ox + drawnWidth + 12} y={sy(end / 2) - 5}>{`Lo ${formatNumber(end / 10, 0)} cm`}</text>
        <text x={ox + drawnWidth + 12} y={sy(end / 2) + 9}>{spacingLabel(result.ties.endSpacingMm)}</text>
      </>}
    </g>
    <text className="dw-rebar-label" x={145} y={16} textAnchor="middle">{`${result.bars.length} ${rebarLabel(result.input.barDiameterMm)} longitudinales`}</text>
    <text className="dw-stirrup-label" x={145} y={317} textAnchor="middle">{`${spiral ? 'Zuncho' : 'Estribos'} ${rebarLabel(result.ties.diameterMm, 'transverse')} · rec. ${formatNumber(result.input.coverMm / 10, 1)} cm`}</text>
    <text className="dw-stirrup-label" x={145} y={332} textAnchor="middle">{spiral ? 'Sin las 5 vueltas de anclaje cuantificadas' : pieceCount > positions.length ? 'Vista resumida · no es despiece' : 'Esquema de distribución · no es despiece'}</text>
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

/** Otros estados de demanda que se revisan con la misma sección (p. ej. las combinaciones de un pórtico). */
export interface InteractionCloudPoint { readonly axialKn: number; readonly momentKnm: number; readonly label: string }

export function InteractionChart({ result, axis = 'both', showNominal = true, cloud = [] }: { result: ColumnDesignResult; axis?: 'both' | 'x' | 'y'; showNominal?: boolean; cloud?: readonly InteractionCloudPoint[] }) {
  const W = 480;
  const H = 380;
  const pad = { left: 62, right: 20, top: 18, bottom: 44 };
  const { axialKn } = result.input;
  const mx = result.magnification.x.designMomentKnm;
  const my = result.magnification.y.designMomentKnm;
  const magnified = result.magnification.x.factor > 1 || result.magnification.y.factor > 1;
  const curves = [result.aboutX.nominal, result.aboutY.nominal];
  const maxM = Math.max(...curves.flat().map((point) => point.momentKnm), mx, my, Math.hypot(mx, my), ...cloud.map((point) => point.momentKnm)) * 1.08 || 1;
  const minP = Math.min(...curves.flat().map((point) => point.axialKn), axialKn, ...cloud.map((point) => point.axialKn)) * 1.08;
  const maxP = Math.max(...curves.flat().map((point) => point.axialKn), axialKn, ...cloud.map((point) => point.axialKn)) * 1.05;
  const sx = (m: number) => pad.left + m / maxM * (W - pad.left - pad.right);
  const sy = (p: number) => pad.top + (maxP - p) / (maxP - minP) * (H - pad.top - pad.bottom);
  const path = (points: readonly InteractionPoint[]) => points.map((point, index) => `${index ? 'L' : 'M'}${sx(point.momentKnm).toFixed(1)},${sy(point.axialKn).toFixed(1)}`).join(' ');
  const circular = result.input.shape === 'circular';
  const symmetric = !circular && Math.abs(result.input.widthMm - result.input.depthMm) < 1e-6 && result.input.barsAlongWidth === result.input.barsAlongDepth;
  // Circular: un solo punto con el momento resultante.
  const activeX = Math.abs(result.input.momentXKnm) + (result.input.braced ? 0 : Math.abs(result.input.swayMomentXKnm)) > 1e-9 ? mx : 0;
  const activeY = Math.abs(result.input.momentYKnm) + (result.input.braced ? 0 : Math.abs(result.input.swayMomentYKnm)) > 1e-9 ? my : 0;
  const resultant = activeX === 0 && activeY === 0 ? Math.max(mx, my) : Math.hypot(activeX, activeY);
  const demand = circular ? [{ id: 'x', m: resultant, label: magnified ? 'Mc' : 'Mu' }] : [
    ...(mx > 0 || my === 0 ? [{ id: 'x', m: mx, label: magnified ? 'Mcx' : 'Mux' }] : []),
    ...(my > 0 ? [{ id: 'y', m: my, label: magnified ? 'Mcy' : 'Muy' }] : []),
  ].filter((point) => axis === 'both' || point.id === axis);
  const showX = axis !== 'y';
  const showY = axis !== 'x' && (!symmetric || axis === 'y');
  const balanced = axis === 'y' ? result.aboutY.balanced : result.aboutX.balanced;

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

    {showNominal && showX ? <path className="dw-curve dw-curve--nominal" d={path(result.aboutX.nominal)} /> : null}
    {showNominal && showY ? <path className="dw-curve dw-curve--nominal" d={path(result.aboutY.nominal)} /> : null}
    {showX ? <path className="dw-curve dw-curve--x" d={path(result.aboutX.design)} /> : null}
    {showY ? <path className="dw-curve dw-curve--y" d={path(result.aboutY.design)} /> : null}
    <g className="dw-chart__cap">
      <line x1={pad.left} x2={sx(maxM * 0.55)} y1={sy(result.maximumDesignAxialKn)} y2={sy(result.maximumDesignAxialKn)} />
      <text x={sx(maxM * 0.55) + 4} y={sy(result.maximumDesignAxialKn) + 4}>{`φPn,máx ${formatNumber(result.maximumDesignAxialKn, 0)}`}</text>
    </g>
    <circle className="dw-chart__balanced" cx={sx(balanced.momentKnm * balanced.phi)} cy={sy(balanced.axialKn * balanced.phi)} r={3.5}>
      <title>{`Falla balanceada · φ ${formatNumber(balanced.phi, 3)} · ${formatNumber(balanced.axialKn * balanced.phi, 0)} kN / ${formatNumber(balanced.momentKnm * balanced.phi, 1)} kN·m`}</title>
    </circle>
    {cloud.length ? <g className="dw-cloud">{cloud.map((point, index) => <circle key={index} cx={sx(point.momentKnm)} cy={sy(point.axialKn)} r={3.2}>
      <title>{`${point.label} · Pu ${formatNumber(point.axialKn, 0)} kN · Mu ${formatNumber(point.momentKnm, 1)} kN·m`}</title>
    </circle>)}</g> : null}
    {demand.map((point, index) => <g key={point.id} className={`dw-demand dw-demand--${point.id}`}>
      <line x1={sx(0)} y1={sy(0)} x2={sx(point.m)} y2={sy(axialKn)} />
      <circle cx={sx(point.m)} cy={sy(axialKn)} r={5.5} />
      <text x={Math.min(sx(point.m) + 9, W - pad.right - 5)} y={sy(axialKn) - 10 - index * 15}
        textAnchor={sx(point.m) > W - 160 ? 'end' : 'start'}>{`${point.label} ${formatNumber(point.m, 1)} · Pu ${formatNumber(axialKn, 0)}`}</text>
    </g>)}
  </svg>;
}
