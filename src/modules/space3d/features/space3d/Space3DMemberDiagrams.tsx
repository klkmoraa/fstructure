/**
 * Detalle de una barra con sus esfuerzos a lo largo de la longitud, como el
 * «Display Frame Details» de ETABS: un diagrama por componente, con su máximo
 * y su mínimo, y el valor bajo el puntero.
 *
 * El dibujo es SVG plano: se lee igual en claro y en oscuro porque los colores
 * son los tokens técnicos (azul axil, verde cortante, rojo momento).
 */
import { useId, useMemo, useState } from 'react';
import type { TranslationKey } from '../../i18n/catalogs';
import type { Space3DMemberResult, Space3DMemberStation } from '../../space3d/model/types';
import { SPACE3D_COMPONENT_SYMBOL, type Space3DForceComponent } from '../../space3d/view/sceneModel';
import { formatSpace3DNumber } from './space3dNumberFormat';

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

const COMPONENTS: readonly { key: Space3DForceComponent; unit: string; tone: 'axial' | 'shear' | 'moment' }[] = [
  { key: 'N', unit: 'kN', tone: 'axial' },
  { key: 'Vy', unit: 'kN', tone: 'shear' },
  { key: 'Vz', unit: 'kN', tone: 'shear' },
  { key: 'T', unit: 'kN·m', tone: 'moment' },
  { key: 'My', unit: 'kN·m', tone: 'moment' },
  { key: 'Mz', unit: 'kN·m', tone: 'moment' },
];

const WIDTH = 280;
const HEIGHT = 64;
const PAD_X = 6;

const number = (value: number) => formatSpace3DNumber(value, { significantDigits: 4 });

interface ChartProps {
  readonly stations: readonly Space3DMemberStation[];
  readonly component: Space3DForceComponent;
  readonly unit: string;
  readonly tone: 'axial' | 'shear' | 'moment';
  readonly length: number;
  readonly noise: number;
  readonly t: Translate;
  /** Momentos del lado traccionado: positivo hacia abajo en el dibujo. */
  readonly flip: boolean;
}

const Chart = ({ stations, component, unit, tone, length, noise, t, flip }: ChartProps) => {
  const [hover, setHover] = useState<number | null>(null);
  const titleId = useId();
  const values = stations.map((station) => (Math.abs(station[component]) <= noise ? 0 : station[component]));
  const max = Math.max(...values);
  const min = Math.min(...values);
  const extent = Math.max(Math.abs(max), Math.abs(min));
  const sx = (x: number) => PAD_X + (length > 0 ? x / length : 0) * (WIDTH - PAD_X * 2);
  const scale = extent > 0 ? (HEIGHT / 2 - 6) / extent : 0;
  const sy = (value: number) => HEIGHT / 2 + (flip ? 1 : -1) * value * scale;
  const outline = stations.map((station, index) => `${sx(station.x).toFixed(2)},${sy(values[index]).toFixed(2)}`).join(' ');
  const polygon = `${sx(0).toFixed(2)},${HEIGHT / 2} ${outline} ${sx(length).toFixed(2)},${HEIGHT / 2}`;
  const hovered = hover === null ? null : (() => {
    const x = hover;
    const index = stations.findIndex((station) => station.x >= x);
    if (index <= 0) return { x: stations[0].x, value: values[0] };
    const a = stations[index - 1];
    const b = stations[index];
    const ratio = b.x > a.x ? (x - a.x) / (b.x - a.x) : 1;
    return { x, value: values[index - 1] + (values[index] - values[index - 1]) * ratio };
  })();
  const symbol = SPACE3D_COMPONENT_SYMBOL[component];

  return <figure className="space3d-diagram-chart" data-tone={tone}>
    <figcaption id={titleId}>
      <b>{symbol}</b>
      {extent === 0
        ? <span>0 {unit}</span>
        : <span>{t('space3d.detail.max', { value: `${number(max)} ${unit}` })} · {t('space3d.detail.min', { value: `${number(min)} ${unit}` })}</span>}
      {hovered ? <output>x = {number(hovered.x)} m · {number(hovered.value)} {unit}</output> : null}
    </figcaption>
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-labelledby={titleId}
      preserveAspectRatio="none"
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = (event.clientX - rect.left) / Math.max(rect.width, 1);
        const x = ((ratio * WIDTH - PAD_X) / (WIDTH - PAD_X * 2)) * length;
        setHover(Math.min(length, Math.max(0, x)));
      }}
      onPointerLeave={() => setHover(null)}
    >
      <line className="space3d-diagram-axis" x1={sx(0)} x2={sx(length)} y1={HEIGHT / 2} y2={HEIGHT / 2} />
      {extent > 0 ? <>
        <polygon className="space3d-diagram-fill" points={polygon} />
        <polyline className="space3d-diagram-line" points={outline} />
      </> : null}
      {hovered ? <line className="space3d-diagram-cursor" x1={sx(hovered.x)} x2={sx(hovered.x)} y1={2} y2={HEIGHT - 2} /> : null}
    </svg>
  </figure>;
};

interface Space3DMemberDiagramsProps {
  readonly t: Translate;
  readonly result: Space3DMemberResult;
  /** Umbral de ruido numérico del análisis. */
  readonly noise: number;
}

export const Space3DMemberDiagrams = ({ t, result, noise }: Space3DMemberDiagramsProps) => {
  const stations = useMemo(() => result.stations ?? [
    { x: 0, N: -result.start.N, Vy: -result.start.Vy, Vz: -result.start.Vz, T: -result.start.T, My: -result.start.My, Mz: -result.start.Mz, u: 0, v: 0, w: 0 },
    { x: result.length, N: result.end.N, Vy: result.end.Vy, Vz: result.end.Vz, T: result.end.T, My: result.end.My, Mz: result.end.Mz, u: 0, v: 0, w: 0 },
  ], [result]);
  return <section className="space3d-member-diagrams" aria-label={t('space3d.detail.title')}>
    <header>
      <h4>{t('space3d.detail.title')}</h4>
      <small>{t('space3d.detail.length', { value: number(result.length) })}</small>
    </header>
    {COMPONENTS.map(({ key, unit, tone }) => <Chart
      key={key}
      stations={stations}
      component={key}
      unit={unit}
      tone={tone}
      length={result.length}
      noise={noise}
      t={t}
      flip={key === 'Mz'}
    />)}
  </section>;
};
