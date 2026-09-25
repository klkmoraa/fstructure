/**
 * Legend and Color Scale for Space 3D Results visualization.
 *
 * Shows real analytical ranges, physical units, sign conventions,
 * and direct focus navigation to critical members and reaction nodes.
 */
import { useMemo, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Crosshair } from 'lucide-react';
import { Button, IconButton } from '../../../../design-system/components/controls';
import type { Space3DAnalysisResult, Space3DProjectV1 } from '../../space3d/model/types';
import type { Space3DResultMode } from '../../space3d/view/sceneModel';
import { formatSpace3DNumber } from './space3dNumberFormat';
import { space3DResultStats } from './space3dResultStats';
import type { TranslationKey } from '../../i18n/catalogs';

interface Space3DResultsLegendProps {
  readonly resultMode: Space3DResultMode;
  readonly analysis: Space3DAnalysisResult | null;
  readonly project: Space3DProjectV1;
  readonly onSelectCritical?: (kind: 'node' | 'member', id: string) => void;
  readonly t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
}


export const Space3DResultsLegend = ({
  resultMode,
  analysis,
  onSelectCritical,
  t,
}: Space3DResultsLegendProps) => {
  // En un teléfono (vertical u horizontal) la leyenda nace plegada: una línea con el rango.
  const [minimized, setMinimized] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 700px), (max-height: 500px)').matches
  ));

  const stats = useMemo(() => space3DResultStats(resultMode, analysis, t), [analysis, resultMode, t]);

  if (!stats) return null;

  const num = (val: number) => formatSpace3DNumber(val, { significantDigits: 4 });

  const critical = stats.criticalId ? (
    <Button
      size="sm"
      variant="ghost"
      className="space3d-legend-critical-btn"
      leadingIcon={<Crosshair size={12} />}
      onClick={() => onSelectCritical?.(stats.criticalKind, stats.criticalId)}
      title={t('space3d.legendSelectCritical', { id: stats.criticalId })}
    >
      {t('space3d.criticalElement' as TranslationKey) || 'Crítico'}: <b>{stats.criticalId}</b>
    </Button>
  ) : null;

  return (
    <div className={`space3d-results-legend ${minimized ? 'space3d-results-legend--minimized' : ''}`} role="region" aria-label={stats.title}>
      <header className="space3d-legend-header">
        <div className="space3d-legend-title-group">
          <Activity size={14} className="space3d-legend-icon" aria-hidden="true" />
          <span className="space3d-legend-title">{stats.title}</span>
          {minimized ? <span className="space3d-legend-range">{num(stats.min)} … {num(stats.max)} {stats.unit}</span> : null}
        </div>
        {minimized ? null : critical}
        <IconButton
          size="sm"
          className="space3d-legend-toggle"
          label={minimized ? t('space3d.legendExpand') : t('space3d.legendMinimize')}
          aria-expanded={!minimized}
          onClick={() => setMinimized((curr) => !curr)}
        >
          {minimized ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </IconButton>
      </header>

      {!minimized && (
        <div className="space3d-legend-body">
          <div className="space3d-legend-scale">
            <span>{num(stats.min)} {stats.unit}</span>
            <div className={`space3d-legend-bar ${stats.gradientClass}`} aria-hidden="true" />
            <span>{num(stats.max)} {stats.unit}</span>
          </div>
          <small className="space3d-legend-convention">{stats.convention}</small>
        </div>
      )}
    </div>
  );
};
