import './diagramBands.css';

/**
 * Bandas de diagrama apiladas a lo largo de un miembro: la forma de presentar
 * esfuerzos que nació en Diseño (momento, cortante y flecha alineados bajo la
 * elevación, con sus valores rotulados y un cursor que los lee juntos) y que
 * el Modelo 2D usa en su lámina de resultados. Es común: no conoce ninguna
 * herramienta, sólo abscisas y valores ya convertidos a lo que se muestra.
 */

export type BandTone = 'moment' | 'shear' | 'deformed' | 'axial';

/** Marco horizontal del dibujo: dónde empieza el eje x y cuánto mide. */
export interface BandFrame {
  readonly left: number;
  readonly plot: number;
}

export interface DiagramBandProps {
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
  readonly tone: BandTone;
  readonly label: string;
  readonly unit: string;
  /** Apoyos o nudos intermedios: parten los rótulos por tramo y se marcan con una guía. */
  readonly nodesAtM: readonly number[];
  readonly frame: BandFrame;
  readonly format?: (value: number) => string;
}

const defaultFormat = (value: number) => Number.isFinite(value) ? value.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—';

const pathOf = (xs: readonly number[], values: readonly number[], scaleX: (x: number) => number, y: (value: number) => number) =>
  values.map((value, index) => `${index === 0 ? 'M' : 'L'}${scaleX(xs[index]!).toFixed(2)},${y(value).toFixed(2)}`).join(' ');

/** Escala vertical de una banda: incluye el cero, la demanda y la resistencia. */
export function bandScale({ upper, lower, capacityUpper, capacityLower, top, height, positive }: Pick<DiagramBandProps, 'upper' | 'lower' | 'capacityUpper' | 'capacityLower' | 'top' | 'height' | 'positive'>) {
  let max = 0;
  let min = 0;
  for (const series of [upper, lower, capacityUpper, capacityLower]) {
    for (const value of series ?? []) {
      if (value > max) max = value;
      if (value < min) min = value;
    }
  }
  const range = max - min || 1;
  return (value: number) => positive === 'down' ? top + (value - min) / range * height : top + (max - value) / range * height;
}

const MIN_LABEL_GAP = 46;

/**
 * Rótulos de una banda: el máximo y el mínimo de cada tramo entre apoyos y el
 * valor que rige en cada apoyo. Se descartan los que se encimarían con uno
 * mayor del mismo lado del eje.
 */
function bandLabels(xs: readonly number[], series: readonly (readonly number[])[], nodesAtM: readonly number[], scaleX: (x: number) => number) {
  const values = (index: number) => series.map((item) => item[index]!);
  const all = series.flat();
  const range = Math.max(...all, 0) - Math.min(...all, 0) || 1;
  const threshold = range * 0.03;
  const first = xs[0]!;
  const last = xs[xs.length - 1]!;
  const breaks = [...new Set([first, ...nodesAtM, last].map((x) => Math.round(x * 1e6) / 1e6))].sort((a, b) => a - b);
  const candidates: { x: number; value: number }[] = [];
  const consider = (indexes: readonly number[], pick: (a: number, b: number) => boolean) => {
    let best: { x: number; value: number } | undefined;
    for (const index of indexes) for (const value of values(index)) if (!best || pick(value, best.value)) best = { x: xs[index]!, value };
    if (best && Math.abs(best.value) > threshold) candidates.push(best);
  };
  for (let segment = 0; segment < breaks.length - 1; segment += 1) {
    const indexes = xs.flatMap((x, index) => x >= breaks[segment]! - 1e-9 && x <= breaks[segment + 1]! + 1e-9 ? [index] : []);
    consider(indexes, (a, b) => a > b);
    consider(indexes, (a, b) => a < b);
  }
  for (const node of nodesAtM) {
    const indexes = xs.flatMap((x, index) => Math.abs(x - node) < 1e-6 ? [index] : []);
    consider(indexes, (a, b) => Math.abs(a) > Math.abs(b));
  }
  const kept: { x: number; value: number }[] = [];
  for (const candidate of candidates.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))) {
    const clash = kept.some((item) => Math.sign(item.value) === Math.sign(candidate.value) && Math.abs(scaleX(item.x) - scaleX(candidate.x)) < MIN_LABEL_GAP);
    if (!clash) kept.push(candidate);
  }
  return kept;
}

export function DiagramBand({ xs, upper, lower, capacityUpper, capacityLower, top, height, scaleX, positive, tone, label, unit, nodesAtM, frame, format = defaultFormat }: DiagramBandProps) {
  const y = bandScale({ upper, lower, capacityUpper, capacityLower, top, height, positive });
  const axis = y(0);
  const areaOf = (values: readonly number[]) =>
    `M${scaleX(xs[0]!).toFixed(2)},${axis.toFixed(2)} ${values.map((value, index) => `L${scaleX(xs[index]!).toFixed(2)},${y(value).toFixed(2)}`).join(' ')} L${scaleX(xs[xs.length - 1]!).toFixed(2)},${axis.toFixed(2)} Z`;
  const labels = bandLabels(xs, lower ? [upper, lower] : [upper], nodesAtM, scaleX);
  const { left, plot } = frame;

  return <g className={`fs-band fs-band--${tone}`}>
    <text className="fs-band__label" x={10} y={top + height / 2 - 3}>{label}</text>
    <text className="fs-band__unit" x={10} y={top + height / 2 + 12}>{unit}</text>
    {nodesAtM.map((x) => <line key={x} className="fs-band__grid" x1={scaleX(x)} x2={scaleX(x)} y1={top - 4} y2={top + height + 4} />)}
    <path className="fs-band__area" d={areaOf(upper)} />
    {lower ? <path className="fs-band__area" d={areaOf(lower)} /> : null}
    <line className="fs-band__axis" x1={left} x2={left + plot} y1={axis} y2={axis} />
    {capacityUpper ? <path className="fs-band__capacity" d={pathOf(xs, capacityUpper, scaleX, y)} /> : null}
    {capacityLower ? <path className="fs-band__capacity" d={pathOf(xs, capacityLower, scaleX, y)} /> : null}
    <path className="fs-band__line" d={pathOf(xs, upper, scaleX, y)} />
    {lower ? <path className="fs-band__line" d={pathOf(xs, lower, scaleX, y)} /> : null}
    {labels.map((item) => {
      const px = scaleX(item.x);
      const py = y(item.value);
      const below = py >= axis;
      const anchor = px < left + 40 ? 'start' : px > left + plot - 40 ? 'end' : 'middle';
      return <g key={`${item.x}-${item.value}`}>
        <circle className="fs-band__dot" cx={px} cy={py} r={3} />
        <text className="fs-band__value" x={px} y={below ? py + 15 : py - 7} textAnchor={anchor}>{format(item.value)}</text>
      </g>;
    })}
  </g>;
}

/** Índice de la abscisa más cercana a `x`. */
export const nearestStation = (xs: readonly number[], x: number) =>
  xs.reduce((best, value, index) => Math.abs(value - x) < Math.abs(xs[best]! - x) - 1e-9 ? index : best, 0);
