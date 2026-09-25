/**
 * Respuesta por piso y resumen espectral, como «Story Response Plots» y las
 * tablas «Base Reactions» / «Modal Participating Mass Ratios» de ETABS.
 *
 * La deriva se dibuja como perfil en altura (el gráfico que se mira primero en
 * un edificio) y la tabla da los números. En un resultado espectral los
 * valores son envolventes CQC/SRSS: se muestran sin signo.
 */
import { useId, useState } from 'react';
import type { TranslationKey } from '../../i18n/catalogs';
import type { Space3DStoryResponse } from '../../space3d/model/types';
import type { Space3DResponseSpectrumResult } from '../../space3d/engine/responseSpectrum';
import { formatSpace3DNumber } from './space3dNumberFormat';

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

const number = (value: number, digits = 4) => formatSpace3DNumber(value, { significantDigits: digits });
/** Deriva como 1/n; cero (o ruido de redondeo) se escribe «0». */
const ratio = (value: number | null) => {
  if (value === null) return '—';
  if (value === 0) return '0';
  return `1/${formatSpace3DNumber(1 / Math.abs(value), { significantDigits: 3 })}`;
};

/**
 * Por debajo de una milmillonésima de la mayor magnitud del mismo tipo, un
 * valor es redondeo (la dirección que el caso no excita): se muestra como 0.
 */
const denoise = (values: readonly number[]): ((value: number) => number) => {
  const floor = Math.max(0, ...values.map(Math.abs)) * 1e-9;
  return (value) => (Math.abs(value) <= floor ? 0 : value);
};

/** Perfil de derivas: un punto por piso, X y Z. */
const DriftProfile = ({ stories, t }: { stories: readonly Space3DStoryResponse[]; t: Translate }) => {
  const titleId = useId();
  const width = 240;
  const rowHeight = 22;
  const height = Math.max(60, stories.length * rowHeight + 20);
  const ordered = [...stories].sort((a, b) => a.elevation - b.elevation);
  const maxDrift = Math.max(1e-12, ...stories.flatMap((story) => story.drift.map((value) => Math.abs(value ?? 0))));
  const y = (index: number) => height - 12 - index * ((height - 24) / Math.max(1, ordered.length - 1));
  const x = (value: number) => 36 + (Math.abs(value) / maxDrift) * (width - 48);
  const line = (axis: 0 | 1) => ordered.map((story, index) => `${index === 0 ? 'M' : 'L'}${x(story.drift[axis] ?? 0).toFixed(1)},${y(index).toFixed(1)}`).join(' ');
  return <figure className="space3d-story-plot">
    <figcaption id={titleId}>{t('space3d.story.driftProfile', { max: ratio(maxDrift) })}</figcaption>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={titleId}>
      <line x1={36} x2={36} y1={6} y2={height - 6} className="space3d-diagram-axis" />
      {ordered.map((story, index) => <text key={story.storyId} x={30} y={y(index) + 3} textAnchor="end" className="space3d-story-label">{story.name}</text>)}
      <path d={line(0)} className="space3d-story-line" data-axis="x" />
      <path d={line(1)} className="space3d-story-line" data-axis="z" />
      {ordered.map((story, index) => <g key={`${story.storyId}-dots`}>
        <circle cx={x(story.drift[0] ?? 0)} cy={y(index)} r={2.6} className="space3d-story-dot" data-axis="x" />
        <circle cx={x(story.drift[1] ?? 0)} cy={y(index)} r={2.6} className="space3d-story-dot" data-axis="z" />
      </g>)}
    </svg>
    <p className="space3d-story-legend"><span data-axis="x">X</span><span data-axis="z">Z</span></p>
  </figure>;
};

interface Space3DStoryPanelProps {
  readonly t: Translate;
  readonly stories: readonly Space3DStoryResponse[];
  /** Envolvente espectral: valores sin signo. */
  readonly envelope: boolean;
}

export const Space3DStoryPanel = ({ t, stories, envelope }: Space3DStoryPanelProps) => {
  const [open, setOpen] = useState(true);
  if (stories.length === 0) return null;
  const drift = denoise(stories.flatMap((story) => story.drift.map((value) => value ?? 0)));
  const shear = denoise(stories.flatMap((story) => [...story.shear]));
  const show = (value: number) => number(envelope ? Math.abs(value) : value);
  return <section className="space3d-story" aria-label={t('space3d.story.title')}>
    <header>
      <h4>{t('space3d.story.title')}</h4>
      <button type="button" className="space3d-button space3d-button--ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t(open ? 'space3d.story.hide' : 'space3d.story.show')}
      </button>
    </header>
    {open ? <>
      <DriftProfile stories={stories} t={t} />
      <div className="space3d-story-table-wrap">
        <table className="space3d-define-table space3d-story-table">
          <thead><tr>
            <th scope="col">{t('space3d.story.story')}</th>
            <th scope="col">{t('space3d.story.driftX')}</th>
            <th scope="col">{t('space3d.story.driftZ')}</th>
            <th scope="col">{t('space3d.story.shearX')}</th>
            <th scope="col">{t('space3d.story.shearZ')}</th>
          </tr></thead>
          <tbody>
            {stories.map((story) => <tr key={story.storyId} title={t('space3d.story.rowTitle', {
              elevation: number(story.elevation, 3),
              x: number(story.displacement[0] * 1000),
              z: number(story.displacement[1] * 1000),
            })}>
              <th scope="row">{story.name}</th>
              <td>{ratio(story.drift[0] === null ? null : drift(story.drift[0]))}</td>
              <td>{ratio(story.drift[1] === null ? null : drift(story.drift[1]))}</td>
              <td>{show(shear(story.shear[0]))}</td>
              <td>{show(shear(story.shear[1]))}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="space3d-field-hint">{t(envelope ? 'space3d.story.envelopeNote' : 'space3d.story.note')}</p>
    </> : null}
  </section>;
};

interface Space3DSpectrumPanelProps {
  readonly t: Translate;
  readonly result: Space3DResponseSpectrumResult;
}

export const Space3DSpectrumPanel = ({ t, result }: Space3DSpectrumPanelProps) => {
  const short = result.cumulativeMassRatio < 0.9;
  const shear = denoise(result.modes.map((mode) => mode.baseShear));
  return <section className="space3d-modes" aria-label={t('space3d.spectrum.title')}>
    <header><h4>{t('space3d.spectrum.title')}</h4></header>
    <dl className="space3d-spectrum-summary">
      <div><dt>{t('space3d.spectrum.baseShear', { axis: result.direction.toUpperCase() })}</dt><dd>{number(result.baseShear)} kN</dd></div>
      <div><dt>{t('space3d.spectrum.massRatio')}</dt><dd data-short={short || undefined}>{number(result.cumulativeMassRatio * 100, 3)} %</dd></div>
      <div><dt>{t('space3d.spectrum.method')}</dt><dd>{result.combination.toUpperCase()}{result.sturmVerified ? ' · Sturm ✓' : ''}</dd></div>
    </dl>
    {short ? <p className="space3d-notice space3d-notice--error" role="status">{t('space3d.spectrum.needMoreModes')}</p> : null}
    <table className="space3d-define-table space3d-spectrum-modes">
      <thead><tr>
        <th scope="col">{t('space3d.spectrum.mode')}</th>
        <th scope="col">T (s)</th>
        <th scope="col">Sa (g)</th>
        <th scope="col">{t('space3d.spectrum.ratio')}</th>
        <th scope="col">V (kN)</th>
      </tr></thead>
      <tbody>
        {result.modes.map((mode, index) => <tr key={index}>
          <th scope="row">{index + 1}</th>
          <td>{number(mode.period)}</td>
          <td>{number(mode.spectralAcceleration, 3)}</td>
          <td>{number(Math.abs(mode.massRatio) < 1e-6 ? 0 : mode.massRatio * 100, 3)} %</td>
          <td>{number(Math.abs(shear(mode.baseShear)))}</td>
        </tr>)}
      </tbody>
    </table>
  </section>;
};
