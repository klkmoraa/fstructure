import type { TranslationKey } from '../../i18n/catalogs';
import {
  SPACE3D_ANALYSIS_MODES,
  type Space3DAnalysisMode,
} from './space3dWorkspaceModel';

export interface Space3DAnalysisModeSelectProps {
  readonly value: Space3DAnalysisMode;
  readonly onChange: (value: Space3DAnalysisMode) => void;
  readonly disabled?: boolean;
  readonly t: (key: TranslationKey) => string;
}

/**
 * Selector contextual de estudios. Vive en la bandeja de análisis existente;
 * no monta una cabecera ni un sistema de controles paralelo.
 */
export const Space3DAnalysisModeSelect = ({
  value,
  onChange,
  disabled = false,
  t,
}: Space3DAnalysisModeSelectProps) => (
  <label className="space3d-analysis-mode">
    <span className="space3d-visually-hidden">{t('space3d.analysisMode')}</span>
    <select
      data-testid="space3d-analysis-mode"
      aria-label={t('space3d.analysisMode')}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as Space3DAnalysisMode)}
    >
      {SPACE3D_ANALYSIS_MODES.map((mode) => (
        <option key={mode.id} value={mode.id}>
          {t(mode.labelKey)}{mode.status === 'Experimental' ? ` · ${t('space3d.badge')}` : ''}
        </option>
      ))}
    </select>
  </label>
);
