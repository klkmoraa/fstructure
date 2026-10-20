import type { ReactNode } from 'react';
import { MODEL_STARTS, type ModelStartId } from '../../data/modelStarts';
import { Button } from '../../design-system/components/controls';
import type { TranslationKey } from '../../i18n/catalogs';
import { useI18n } from '../../i18n/useI18n';
import './modelStart.css';

const glyph = (children: ReactNode) => <svg className="model-start__glyph" viewBox="0 0 32 20" aria-hidden="true">{children}</svg>;
const pin = (x: number) => <path d={`M${x} 13l-2.5 4h5z`} />;

const COPY: Record<ModelStartId, { title: TranslationKey; hint: TranslationKey; glyph: ReactNode }> = {
  'beam-simple': { title: 'modelStart.beamSimple', hint: 'modelStart.beamSimpleHint', glyph: glyph(<><path d="M4 13h24" />{pin(4)}{pin(28)}</>) },
  'beam-cantilever': { title: 'modelStart.beamCantilever', hint: 'modelStart.beamCantileverHint', glyph: glyph(<><path d="M5 5v14M5 12h23" /><path d="M2 7l3-2M2 11l3-2M2 15l3-2M2 19l3-2" /></>) },
  'beam-continuous': { title: 'modelStart.beamContinuous', hint: 'modelStart.beamContinuousHint', glyph: glyph(<><path d="M3 13h26" />{pin(3)}{pin(16)}{pin(29)}</>) },
  'frame-portal': { title: 'modelStart.framePortal', hint: 'modelStart.framePortalHint', glyph: glyph(<><path d="M7 19V4h18v15" /><path d="M4 19h6M22 19h6" /></>) },
  'truss-pratt': { title: 'modelStart.trussPratt', hint: 'modelStart.trussPrattHint', glyph: glyph(<><path d="M3 15h26M9 5h14M3 15l6-10M29 15l-6-10M9 5v10M16 5v10M23 5v10M9 5l7 10M23 5l-7 10" /></>) },
};

const startCopy = (id: ModelStartId, t: (key: TranslationKey) => string) => <>
  {COPY[id].glyph}
  <span className="model-start__copy"><strong>{t(COPY[id].title)}</strong><span>{t(COPY[id].hint)}</span></span>
</>;

/**
 * Inicios listos para calcular y una salida directa al dibujo libre.
 */
export function ModelStartCard({ onStart, onGenerate, onDraw }: {
  onStart: (id: ModelStartId) => void;
  onGenerate: () => void;
  onDraw: () => void;
}) {
  const { t } = useI18n();
  return <div className="model-start" data-testid="model-start">
    <section className="model-start__card" aria-labelledby="model-start-title">
      <h2 id="model-start-title">{t('modelStart.title')}</h2>
      <p className="model-start__body">{t('modelStart.body')}</p>
      <div className="model-start__options" role="group" aria-label={t('modelStart.more')}>
        {MODEL_STARTS.map((id) => <button key={id} type="button" className="model-start__option" title={t(COPY[id].hint)} onClick={() => onStart(id)}>{startCopy(id, t)}</button>)}
      </div>
      <div className="model-start__secondary">
        <Button variant="primary" size="touch" onClick={onDraw}>{t('modelStart.draw')}</Button>
        <Button variant="ghost" size="touch" onClick={onGenerate}>{t('modelStart.generate')}</Button>
      </div>
    </section>
  </div>;
}
