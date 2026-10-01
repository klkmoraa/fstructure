import type { SectionStudioResult } from '../../../design/concrete/sectionStudio';
import { formatNumber } from './common';

type SectionResult = Extract<SectionStudioResult, { status: 'ok' }>;
type Point = { readonly x: number; readonly y: number };

function polygonPath(points: readonly Point[], x: (value: number) => number, y: (value: number) => number, close = true) {
  return points.map((point, index) => `${index ? 'L' : 'M'}${x(point.x).toFixed(2)},${y(point.y).toFixed(2)}`).join(' ') + (close && points.length ? ' Z' : '');
}
function bounds(points: readonly Point[]) {
  return { minX: Math.min(...points.map((p) => p.x)), maxX: Math.max(...points.map((p) => p.x)), minY: Math.min(...points.map((p) => p.y)), maxY: Math.max(...points.map((p) => p.y)) };
}
function coverDimension(points: readonly Point[], cover: number) {
  let best = { start: points[0]!, end: points[0]!, nx: 1, ny: 0, score: -Infinity };
  points.forEach((point, i) => {
    const next = points[(i + 1) % points.length]!;
    const dx = next.x - point.x, dy = next.y - point.y, length = Math.hypot(dx, dy);
    if (length < 1e-8) return;
    const start = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
    const sign = start.x * dy - start.y * dx >= 0 ? 1 : -1;
    const nx = dy / length * sign, ny = -dx / length * sign;
    const score = nx - Math.abs(start.y) / 10000;
    if (score > best.score) best = { start, end: { x: start.x - nx * cover, y: start.y - ny * cover }, nx, ny, score };
  });
  return best;
}

/** Se dibujan las coordenadas generadas por el cálculo, incluido el polígono de estribo desplazado. */
export function ConcreteSectionDrawing({ result }: { result: SectionResult }) {
  const { geometry: g, input } = result;
  const b = bounds(g.vertices);
  const scale = Math.min(325 / g.widthMm, 300 / g.heightMm);
  const x = (value: number) => 248 + (value - (b.minX + b.maxX) / 2) * scale;
  const y = (value: number) => 185 - (value - (b.minY + b.maxY) / 2) * scale;
  const cover = coverDimension(g.vertices, input.coverMm);
  return <svg className="dw-drawing cs-drawing cs-section" viewBox="0 0 535 420" role="img"
    aria-label={`Sección ${input.shape}, ${g.bars.length} barras de ${input.barDiameterMm} mm y recubrimiento libre de ${input.coverMm / 10} cm`}>
    <path className="dw-concrete" d={polygonPath(g.vertices, x, y)} />
    <g className="dw-axis">
      <line x1={x(b.minX) - 15} x2={x(b.maxX) + 15} y1={y(0)} y2={y(0)} />
      <line x1={x(0)} x2={x(0)} y1={y(b.maxY) - 15} y2={y(b.minY) + 15} />
      <text x={x(b.maxX) + 20} y={y(0) + 4}>X</text>
      <text x={x(0) + 5} y={y(b.maxY) - 17}>Y</text>
    </g>
    <path className="dw-stirrup" d={polygonPath(g.tieVertices, x, y)} style={{ strokeWidth: Math.max(1.8, input.tieDiameterMm * scale), strokeLinejoin: 'round' }} />
    {g.tieCrossLines.map((points, i) => <path key={i} className="dw-stirrup" d={polygonPath(points, x, y, false)} style={{ strokeWidth: Math.max(1.8, input.tieDiameterMm * scale) }} />)}
    {g.bars.map((point, i) => <g key={i}>
      <circle className="dw-bar" cx={x(point.x)} cy={y(point.y)} r={Math.max(2, input.barDiameterMm / 2 * scale)}>
        <title>{`Barra ${i + 1}: X ${formatNumber(point.x / 10, 1)} · Y ${formatNumber(point.y / 10, 1)} cm`}</title>
      </circle>
      {g.bars.length <= 16 ? <text className="cs-bar-label" x={x(point.x) + (point.x >= 0 ? 8 : -8)} y={y(point.y) + (point.y >= 0 ? -7 : 14)} textAnchor={point.x >= 0 ? 'start' : 'end'}>{i + 1}</text> : null}
    </g>)}
    <g className="dw-dimension">
      <line x1={x(b.minX)} x2={x(b.maxX)} y1={y(b.minY) + 30} y2={y(b.minY) + 30} />
      {[b.minX, b.maxX].map((v) => <line key={v} x1={x(v)} x2={x(v)} y1={y(b.minY) + 23} y2={y(b.minY) + 35} />)}
      <text x={(x(b.minX) + x(b.maxX)) / 2} y={y(b.minY) + 47} textAnchor="middle">{`${input.shape === 'circle' ? 'D' : 'b'} = ${formatNumber(g.widthMm / 10, 1)} cm`}</text>
      <line x1={x(b.minX) - 28} x2={x(b.minX) - 28} y1={y(b.maxY)} y2={y(b.minY)} />
      {[b.minY, b.maxY].map((v) => <line key={v} x1={x(b.minX) - 34} x2={x(b.minX) - 22} y1={y(v)} y2={y(v)} />)}
      <text x={x(b.minX) - 39} y={(y(b.minY) + y(b.maxY)) / 2} textAnchor="middle" transform={`rotate(-90 ${x(b.minX) - 39} ${(y(b.minY) + y(b.maxY)) / 2})`}>{`h = ${formatNumber(g.heightMm / 10, 1)} cm`}</text>
      <line x1={x(cover.start.x)} x2={x(cover.end.x)} y1={y(cover.start.y)} y2={y(cover.end.y)} />
      {[cover.start, cover.end].map((p, i) => <line key={i} x1={x(p.x) - cover.ny * 5} x2={x(p.x) + cover.ny * 5} y1={y(p.y) - cover.nx * 5} y2={y(p.y) + cover.nx * 5} />)}
      <path d={`M${x(cover.start.x)},${y(cover.start.y)} H${x(b.maxX) + 30} V${y(cover.start.y) + 21}`} fill="none" stroke="var(--dw-muted)" strokeWidth=".8" />
      <text x={x(b.maxX) + 38} y={y(cover.start.y) + 35} textAnchor="end">{`r = ${formatNumber(input.coverMm / 10, 1)} cm`}</text>
    </g>
    <text className="cs-small" x="248" y="411" textAnchor="middle">Recubrimiento medido hasta el paño exterior del refuerzo transversal.</text>
  </svg>;
}

const ticks = (min: number, max: number, divisions: number) => {
  const step = (max - min) / divisions;
  return Array.from({ length: divisions + 1 }, (_, i) => min + step * i);
};

export function SectionInteractionDrawing({ result }: { result: SectionResult }) {
  const points = result.interaction;
  const demand = result.demand;
  const b = bounds(points.map((point) => ({ x: point.momentKnm, y: point.axialKn })));
  const rangeM = Math.max(1, b.maxX - b.minX, Math.abs(demand.momentKnm) * .2);
  const rangeN = Math.max(1, b.maxY - b.minY, Math.abs(demand.axialKn) * .2);
  const minM = Math.min(b.minX, demand.momentKnm, 0) - rangeM * .08;
  const maxM = Math.max(b.maxX, demand.momentKnm, 0) + rangeM * .08;
  const minN = Math.min(b.minY, demand.axialKn, 0) - rangeN * .08;
  const maxN = Math.max(b.maxY, demand.axialKn, 0) + rangeN * .08;
  const x = (m: number) => 66 + (m - minM) / (maxM - minM) * 456;
  const y = (n: number) => 24 + (maxN - n) / (maxN - minN) * 300;
  const path = polygonPath(points.map((p) => ({ x: p.momentKnm, y: p.axialKn })), x, y);
  const capacity = result.capacity.point;
  const labelLeft = x(demand.momentKnm) > 380;
  return <svg className="dw-drawing cs-drawing dw-chart" viewBox="0 0 560 370" role="img"
    aria-label={`Interacción axial y flexión. Demanda N ${formatNumber(demand.axialKn)} kN y M ${formatNumber(demand.momentKnm)} kN metro. Utilización ${Number.isFinite(result.utilization) ? Math.round(result.utilization * 100) : 'fuera de capacidad'} por ciento`}>
    <g className="dw-chart__grid">
      {ticks(minM, maxM, 5).map((v, i) => <g key={`m${i}`}><line x1={x(v)} x2={x(v)} y1="24" y2="324" /><text x={x(v)} y="341" textAnchor="middle">{formatNumber(v, 0)}</text></g>)}
      {ticks(minN, maxN, 5).map((v, i) => <g key={`n${i}`}><line x1="66" x2="522" y1={y(v)} y2={y(v)} /><text x="59" y={y(v) + 4} textAnchor="end">{formatNumber(v, 0)}</text></g>)}
    </g>
    <path className="cs-area-fill" d={path} />
    <line className="dw-chart__zero" x1="66" x2="522" y1={y(0)} y2={y(0)} />
    <line className="dw-chart__zero" x1={x(0)} x2={x(0)} y1="24" y2="324" />
    <path className="dw-curve dw-curve--x" d={path} />
    {capacity ? <g className="dw-demand"><line x1={x(0)} y1={y(0)} x2={x(capacity.momentKnm)} y2={y(capacity.axialKn)} /><circle className="dw-chart__balanced" cx={x(capacity.momentKnm)} cy={y(capacity.axialKn)} r="4"><title>Punto de capacidad en la dirección de demanda</title></circle></g> : null}
    <g className="dw-demand dw-demand--x">
      <line x1={x(0)} y1={y(0)} x2={x(demand.momentKnm)} y2={y(demand.axialKn)} />
      <circle cx={x(demand.momentKnm)} cy={y(demand.axialKn)} r="5" />
      <text x={x(demand.momentKnm) + (labelLeft ? -10 : 10)} y={Math.max(36, y(demand.axialKn) - 12)} textAnchor={labelLeft ? 'end' : 'start'}>Demanda</text>
    </g>
    <text className="dw-chart__title" x="294" y="364" textAnchor="middle">Momento M (kN·m)</text>
    <text className="dw-chart__title" x="15" y="178" textAnchor="middle" transform="rotate(-90 15 178)">Axial N (kN) · compresión positiva</text>
  </svg>;
}

export function SectionEquilibriumDrawing({ result }: { result: SectionResult }) {
  const { geometry: g, analysis: a, input } = result;
  const b = bounds(g.vertices);
  const scale = Math.min(185 / g.widthMm, 220 / g.heightMm);
  const x = (value: number) => 137 + (value - (b.minX + b.maxX) / 2) * scale;
  const y = (value: number) => 174 - (value - (b.minY + b.maxY) / 2) * scale;
  const profile = [...a.strainProfile].sort((p, q) => p.depthMm - q.depthMm);
  const maxDepth = profile.length ? Math.max(...profile.map((p) => p.depthMm), 1) : g.heightMm;
  const maxStrain = Math.max(...profile.map((p) => Math.abs(p.strain)), .0001);
  const sy = (d: number) => 64 + d / maxDepth * 220;
  const sx = (strain: number) => 365 + strain / maxStrain * 92;
  const path = profile.map((p, i) => `${i ? 'L' : 'M'}${sx(p.strain)},${sy(p.depthMm)}`).join(' ');
  return <svg className="dw-drawing cs-drawing" viewBox="0 0 560 372" role="img" aria-label={`Deformaciones y zona de compresión del punto de capacidad. Esfuerzo máximo concreto ${formatNumber(a.maxConcreteStressMpa, 2)} MPa; acero ${formatNumber(a.maxSteelStressMpa, 2)} MPa`}>
    <text className="cs-label" x="137" y="28" textAnchor="middle">Zona comprimida</text>
    <text className="cs-label" x="365" y="28" textAnchor="middle">Compatibilidad ε</text>
    <path className="dw-concrete" d={polygonPath(g.vertices, x, y)} />
    <path className="cs-compression" d={polygonPath(a.compressionPolygon, x, y)} />
    <path className="dw-stirrup" d={polygonPath(g.tieVertices, x, y)} style={{ strokeWidth: Math.max(1.3, input.tieDiameterMm * scale) }} />
    {g.bars.map((p, i) => <circle key={i} className="dw-bar" cx={x(p.x)} cy={y(p.y)} r={Math.max(2, input.barDiameterMm * scale / 2)} />)}
    <path className="cs-neutral" d={polygonPath(a.neutralAxis, x, y, false)} />
    <g className="dw-axis"><line x1="365" x2="365" y1="54" y2="294" /><line x1="264" x2="466" y1="284" y2="284" /></g>
    <path className="cs-strain-line" d={path} />
    <text className="cs-small" x="365" y="307" textAnchor="middle">0</text>
    <text className="cs-small" x="269" y="307" textAnchor="middle">Tracción −</text>
    <text className="cs-small" x="460" y="307" textAnchor="middle">Compresión +</text>
    {profile.length ? <>
      <text className="cs-symbol" x="487" y={sy(profile[0]!.depthMm) + 8}>{`ε = ${formatNumber(profile[0]!.strain * 1000, 3)} ‰`}</text>
      <text className="cs-symbol" x="487" y={sy(profile.at(-1)!.depthMm) - 2}>{`${formatNumber(profile.at(-1)!.strain * 1000, 3)} ‰`}</text>
    </> : null}
    <text className="cs-small" x="137" y="319" textAnchor="middle">{`c = ${a.neutralAxisDepthMm === null ? '∞' : formatNumber(a.neutralAxisDepthMm / 10, 2)} cm · θ = ${formatNumber(input.angleDeg, 0)}°`}</text>
    <g className="cs-symbol">
      <text x="32" y="348">{`σc,máx = ${formatNumber(a.maxConcreteStressMpa, 2)} MPa`}</text>
      <text x="300" y="348">{`σs,máx = ${formatNumber(a.maxSteelStressMpa, 2)} MPa`}</text>
    </g>
    <text className="cs-small" x="280" y="369" textAnchor="middle">{input.philosophy === 'allowable' ? 'Estado elástico de la demanda. No evalúa flechas de un elemento completo.' : 'Estado límite sobre el rayo N–M. No representa deformaciones de servicio de un elemento completo.'}</text>
  </svg>;
}

/** La posición de cada juego corresponde al espaciamiento proporcionado; el extremo final queda cerrado. */
export function SectionLongitudinalDrawing({ result }: { result: SectionResult }) {
  const { input, quantities: q, geometry: g } = result;
  const left = 49, right = 500, top = 77, bottom = 204;
  const lengthMm = input.lengthM * 1000;
  const sx = (value: number) => left + value / lengthMm * (right - left);
  const drawnCount = Math.min(2000, q.tieCount);
  const stations = Array.from({ length: drawnCount }, (_, i) => {
    const index = drawnCount <= 1 ? 0 : Math.round(i * (q.tieCount - 1) / (drawnCount - 1));
    return Math.min(lengthMm, index * input.tieSpacingMm);
  });
  const spiral = input.tieType === 'spiral';
  const summarized = spiral ? lengthMm / input.tieSpacingMm * 16 > 4000 : q.tieCount > drawnCount;
  const spiralSteps = Math.min(4000, Math.max(16, Math.ceil(lengthMm / input.tieSpacingMm * 16)));
  const spiralPath = Array.from({ length: spiralSteps + 1 }, (_, i) => {
    const station = lengthMm * i / spiralSteps;
    const ordinate = (top + bottom) / 2 + ((bottom - top) / 2 - 11) * Math.cos(2 * Math.PI * station / input.tieSpacingMm);
    return `${i ? 'L' : 'M'}${sx(station)},${ordinate}`;
  }).join(' ');
  const rowPositions = [...new Set(g.bars.map((p) => Math.round(p.y * 100) / 100))];
  const limits = bounds(g.vertices);
  const sy = (v: number) => bottom - (v - limits.minY) / g.heightMm * (bottom - top);
  const displaySpacing = Math.min(input.tieSpacingMm, lengthMm);
  return <svg className="dw-drawing cs-drawing" viewBox="0 0 560 312" role="img" aria-label={`Distribución longitudinal de ${input.lengthM} m con ${spiral ? 'zuncho' : `${q.tieCount} juegos de estribos`} a ${input.tieSpacingMm / 10} cm${summarized ? '. Vista resumida a lo largo de toda la longitud' : ''}`}>
    <text className="cs-label" x="49" y="29">{spiral ? 'Zuncho helicoidal' : input.tieType === 'cross-tie' ? 'Estribo cerrado + grapas' : 'Estribo cerrado'}</text>
    {summarized ? <text className="cs-small" x="500" y="29" textAnchor="end">Vista resumida<title>Se muestran estaciones distribuidas en toda la longitud; el conteo y el acero corresponden a todos los juegos.</title></text> : null}
    <text className="cs-small" x="49" y="49">{`Ø ${input.tieDiameterMm} mm @ ${formatNumber(input.tieSpacingMm / 10, 1)} cm · ${q.tieCount} ${spiral ? 'vueltas aproximadas' : 'juegos'}`}</text>
    <rect className="dw-concrete" x={left} y={top} width={right - left} height={bottom - top} />
    {rowPositions.map((position, i) => <line key={i} className="dw-rebar" x1={left} x2={right} y1={sy(position)} y2={sy(position)} />)}
    {spiral ? <path className="dw-stirrup" d={spiralPath} strokeWidth="1.7" /> : stations.map((station, i) => <line key={i} className="dw-stirrup" x1={sx(station)} x2={sx(station)} y1={top + 11} y2={bottom - 11} strokeWidth="1.5" />)}
    <g className="dw-dimension">
      <line x1={left} x2={right} y1="235" y2="235" />
      <line x1={left} x2={left} y1="229" y2="241" /><line x1={right} x2={right} y1="229" y2="241" />
      <text x={(left + right) / 2} y="253" textAnchor="middle">{`L = ${formatNumber(input.lengthM, 2)} m`}</text>
      <line x1={left} x2={sx(displaySpacing)} y1="67" y2="67" />
      <text x={sx(displaySpacing) + 8} y="70">{`s = ${formatNumber(input.tieSpacingMm / 10, 1)} cm`}</text>
    </g>
    <text className="cs-small" x="280" y="289" textAnchor="middle">{`Acero longitudinal ${formatNumber(q.longitudinalSteelKg)} kg · transversal ${formatNumber(q.tieSteelKg)} kg`}</text>
    <text className="cs-small" x="280" y="308" textAnchor="middle">{spiral ? 'Hélice sin vueltas de anclaje; sin traslapes ni desperdicio.' : 'Estribos y grapas con ganchos estimados de 10 diámetros; sin traslapes ni desperdicio.'}</text>
  </svg>;
}
