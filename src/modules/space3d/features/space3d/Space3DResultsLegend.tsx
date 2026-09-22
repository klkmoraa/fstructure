/**
 * Legend and Color Scale for Space 3D Results visualization.
 *
 * Shows real analytical ranges, physical units, sign conventions,
 * and direct focus navigation to critical members and reaction nodes.
 */
import { useMemo, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Crosshair } from 'lucide-react';
import type { Space3DAnalysisResult, Space3DProjectV1 } from '../../space3d/model/types';
import type { Space3DResultMode } from '../../space3d/view/sceneModel';
import { formatSpace3DNumber } from './space3dNumberFormat';
import { deriveSpace3DMemberAxialAction } from '../../space3d/view/resultSemantics';
import type { TranslationKey } from '../../i18n/catalogs';

export interface Space3DResultsLegendProps {
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
  const [minimized, setMinimized] = useState(false);

  const stats = useMemo(() => {
    if (!analysis || !analysis.success) return null;

    if (resultMode === 'axial') {
      let minN = Infinity;
      let maxN = -Infinity;
      let maxAbsN = -Infinity;
      let maxMember = '';

      for (const res of analysis.memberResults) {
        const axial = deriveSpace3DMemberAxialAction(res);
        if (axial < minN) minN = axial;
        if (axial > maxN) maxN = axial;
        const absAxial = Math.abs(axial);
        if (absAxial > maxAbsN) {
          maxAbsN = absAxial;
          maxMember = res.memberId;
        }
      }

      return {
        title: t('space3d.legendAxial' as TranslationKey) || 'Esfuerzo Axial N [kN]',
        unit: 'kN',
        min: Number.isFinite(minN) ? minN : 0,
        max: Number.isFinite(maxN) ? maxN : 0,
        criticalId: maxMember,
        criticalKind: 'member' as const,
        convention: 'Tracción (+) · Compresión (−)',
        gradientClass: 'space3d-legend-grad--axial',
      };
    }

    if (resultMode === 'shear') {
      let maxV = 0;
      let maxMember = '';

      for (const res of analysis.memberResults) {
        const vStart = Math.hypot(res.start.Vy, res.start.Vz);
        const vEnd = Math.hypot(res.end.Vy, res.end.Vz);
        const peak = Math.max(vStart, vEnd);
        if (peak > maxV) {
          maxV = peak;
          maxMember = res.memberId;
        }
      }

      return {
        title: t('space3d.legendShear' as TranslationKey) || 'Fuerza Cortante Resultante V [kN]',
        unit: 'kN',
        min: 0,
        max: maxV,
        criticalId: maxMember,
        criticalKind: 'member' as const,
        convention: '|V| = √(Vy² + Vz²)',
        gradientClass: 'space3d-legend-grad--shear',
      };
    }

    if (resultMode === 'moment') {
      let maxM = 0;
      let maxMember = '';

      for (const res of analysis.memberResults) {
        const mStart = Math.hypot(res.start.My, res.start.Mz);
        const mEnd = Math.hypot(res.end.My, res.end.Mz);
        const peak = Math.max(mStart, mEnd);
        if (peak > maxM) {
          maxM = peak;
          maxMember = res.memberId;
        }
      }

      return {
        title: t('space3d.legendMoment' as TranslationKey) || 'Momento Flector Resultante M [kN·m]',
        unit: 'kN·m',
        min: 0,
        max: maxM,
        criticalId: maxMember,
        criticalKind: 'member' as const,
        convention: '|M| = √(My² + Mz²)',
        gradientClass: 'space3d-legend-grad--moment',
      };
    }

    if (resultMode === 'reactions') {
      let maxR = 0;
      let maxNode = '';

      for (const res of analysis.nodeResults) {
        const rMag = Math.hypot(res.reaction.ux, res.reaction.uy, res.reaction.uz);
        if (rMag > maxR) {
          maxR = rMag;
          maxNode = res.nodeId;
        }
      }

      return {
        title: t('space3d.legendReactions' as TranslationKey) || 'Reacciones en Apoyos R [kN]',
        unit: 'kN',
        min: 0,
        max: maxR,
        criticalId: maxNode,
        criticalKind: 'node' as const,
        convention: '|R| = √(Rx² + Ry² + Rz²)',
        gradientClass: 'space3d-legend-grad--reactions',
      };
    }

    return null;
  }, [analysis, resultMode, t]);

  if (!stats) return null;

  const num = (val: number) => formatSpace3DNumber(val, { significantDigits: 4 });

  return (
    <div className={`space3d-results-legend ${minimized ? 'space3d-results-legend--minimized' : ''}`} role="region" aria-label={stats.title}>
      <header className="space3d-legend-header" onClick={() => setMinimized((curr) => !curr)}>
        <div className="space3d-legend-title-group">
          <Activity size={14} className="space3d-legend-icon" aria-hidden="true" />
          <span>{stats.title}</span>
        </div>
        <button
          type="button"
          className="space3d-legend-toggle"
          aria-label={minimized ? 'Expandir leyenda' : 'Minimizar leyenda'}
          aria-expanded={!minimized}
        >
          {minimized ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </button>
      </header>

      {!minimized && (
        <div className="space3d-legend-body">
          <div className="space3d-legend-bar-wrapper">
            <div className={`space3d-legend-bar ${stats.gradientClass}`} aria-hidden="true" />
            <div className="space3d-legend-labels">
              <span>{num(stats.min)} {stats.unit}</span>
              <span>{num(stats.max)} {stats.unit}</span>
            </div>
          </div>

          <div className="space3d-legend-meta">
            <small className="space3d-legend-convention">{stats.convention}</small>
            {stats.criticalId ? (
              <button
                type="button"
                className="space3d-legend-critical-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCritical?.(stats.criticalKind, stats.criticalId);
                }}
                title={`Seleccionar elemento crítico ${stats.criticalId}`}
              >
                <Crosshair size={12} aria-hidden="true" />
                <span>{t('space3d.criticalElement' as TranslationKey) || 'Crítico'}: <b>{stats.criticalId}</b></span>
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
