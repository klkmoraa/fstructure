import { useId } from 'react';
import type { TranslationKey } from '../../i18n/catalogs';
import {
  SPACE3D_ANALYSIS_MODES,
  type Space3DAnalysisMode,
} from './space3dWorkspaceModel';

interface Space3DAnalysisModeSelectProps {
  readonly value: Space3DAnalysisMode;
  readonly onChange: (value: Space3DAnalysisMode) => void;
  readonly disabled?: boolean;
  readonly t: (key: TranslationKey) => string;
}

const HINT_KEYS: Record<Space3DAnalysisMode, TranslationKey> = {
  linear: 'space3d.analysisModeLinearHint',
  pdelta: 'space3d.analysisModePDeltaHint',
  modal: 'space3d.analysisModeModalHint',
  buckling: 'space3d.analysisModeBucklingHint',
  influence: 'space3d.analysisModeInfluenceHint',
  spectrum: 'space3d.analysisModeSpectrumHint',
};

/** Selector de estudio con su explicación: el nombre técnico solo no dice qué se obtiene. */
export const Space3DAnalysisModeSelect = ({
  value,
  onChange,
  disabled = false,
  t,
}: Space3DAnalysisModeSelectProps) => {
  const hintId = useId();
  const selectId = useId();
  return <div className="space3d-field space3d-analysis-mode">
    <label className="space3d-field-label" htmlFor={selectId}>{t('space3d.analysisTypeLabel')}</label>
    <select
      id={selectId}
      data-testid="space3d-analysis-mode"
      value={value}
      disabled={disabled}
      aria-describedby={hintId}
      onChange={(event) => onChange(event.target.value as Space3DAnalysisMode)}
    >
      {SPACE3D_ANALYSIS_MODES.map((mode) => (
        <option key={mode.id} value={mode.id}>
          {t(mode.labelKey)}{mode.status === 'Experimental' ? ` (${t('space3d.badge')})` : ''}
        </option>
      ))}
    </select>
    <small id={hintId} className="space3d-field-hint">{t(HINT_KEYS[value])}</small>
  </div>;
};
