/**
 * Modos de vibración o de pandeo como lista, al modo de la tabla «Modal
 * Periods and Frequencies» de ETABS. Elegir un modo lo dibuja en el lienzo,
 * normalizado y animable; el modelo y los resultados estáticos no cambian.
 */
import { Eye, EyeOff } from 'lucide-react';
import type { TranslationKey } from '../../i18n/catalogs';
import type { analyzeSpace3DBuckling, analyzeSpace3DModal } from '../../space3d/engine/analysisModes';
import { formatSpace3DNumber } from './space3dNumberFormat';

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;
export type Space3DModalResult = ReturnType<typeof analyzeSpace3DModal>;
export type Space3DBucklingResult = ReturnType<typeof analyzeSpace3DBuckling>;

interface Space3DModesPanelProps {
  readonly t: Translate;
  readonly modal: Space3DModalResult | null;
  readonly buckling: Space3DBucklingResult | null;
  /** Modo dibujado, o `null` si el lienzo enseña la estática. */
  readonly shown: number | null;
  readonly onShow: (index: number | null) => void;
}

const number = (value: number) => formatSpace3DNumber(value, { significantDigits: 4 });
const percent = (value: number) => formatSpace3DNumber(value * 100, { significantDigits: 3 });

export const Space3DModesPanel = ({ t, modal, buckling, shown, onShow }: Space3DModesPanelProps) => {
  if (modal?.success) {
    return <section className="space3d-modes" aria-label={t('space3d.modal.title')}>
      <header>
        <h4>{t('space3d.modal.title')}</h4>
        {shown !== null ? <button type="button" className="space3d-button space3d-button--ghost" onClick={() => onShow(null)}>
          <EyeOff size={15} aria-hidden="true" />{t('space3d.modal.hide')}
        </button> : null}
      </header>
      <ol className="space3d-modes-list">
        {modal.modes.map((mode, index) => <li key={index}>
          <button type="button" aria-pressed={shown === index} onClick={() => onShow(shown === index ? null : index)}
            title={t('space3d.modal.show', { n: index + 1 })}>
            <span className="space3d-modes-head">
              <b>{t('space3d.modal.mode', { n: index + 1 })}</b>
              <span>{t('space3d.modal.period', { value: number(mode.period) })}</span>
              <span>{t('space3d.modal.frequency', { value: number(mode.frequency) })}</span>
              <Eye size={14} aria-hidden="true" />
            </span>
            <small>{t('space3d.modal.participation', {
              x: percent(mode.participatingMassRatioX), y: percent(mode.participatingMassRatioY), z: percent(mode.participatingMassRatioZ),
            })}</small>
          </button>
        </li>)}
      </ol>
      {shown !== null ? <p className="space3d-field-hint" role="status">{t('space3d.modal.showing', { n: shown + 1 })}</p> : null}
    </section>;
  }
  if (buckling?.success) {
    return <section className="space3d-modes" aria-label={t('space3d.modal.bucklingTitle')}>
      <header>
        <h4>{t('space3d.modal.bucklingTitle')}</h4>
        {shown !== null ? <button type="button" className="space3d-button space3d-button--ghost" onClick={() => onShow(null)}>
          <EyeOff size={15} aria-hidden="true" />{t('space3d.modal.hide')}
        </button> : null}
      </header>
      <ol className="space3d-modes-list">
        {buckling.modes.map((mode, index) => <li key={index}>
          <button type="button" aria-pressed={shown === index} onClick={() => onShow(shown === index ? null : index)}>
            <span className="space3d-modes-head">
              <b>{t('space3d.modal.bucklingMode', { n: index + 1, value: number(mode.criticalLoadFactor) })}</b>
              <Eye size={14} aria-hidden="true" />
            </span>
          </button>
        </li>)}
      </ol>
      {shown !== null ? <p className="space3d-field-hint" role="status">{t('space3d.modal.showing', { n: shown + 1 })}</p> : null}
    </section>;
  }
  return null;
};
