import type { CSSProperties } from 'react';
import { LocateFixed } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/catalogs';
import { formatFixed } from '../../utils/numberFormat';
import { ELASTIC_REFERENCE_RATIO, ELASTIC_SATURATION_RATIO, elasticIndexPaint, type ElasticIndexGap, type elasticDemandView } from '../results/elasticDemand';
import { describeReliabilityCheck, reliabilityCheckLabel } from '../results/reliabilityCopy';
import './elasticDemandLegend.css';

interface Props {
  view: ReturnType<typeof elasticDemandView>;
  selectedMemberId?: string;
  onSelectMember?: (id: string) => void;
}

const gapLabel: Record<ElasticIndexGap, TranslationKey> = {
  'yield-strength': 'elastic.missingYield',
  'section-modulus': 'elastic.missingModulus',
  'section-geometry': 'elastic.missingGeometry',
};

/** A scale for the existing elastic estimate, with its actual, unclamped values. */
export const ElasticDemandLegend = ({ view, selectedMemberId, onSelectMember }: Props) => {
  const { t } = useI18n();
  const highest = view.status === 'available' ? view.highest : null;
  const selected = view.status === 'available' ? view.readings.find((reading) => reading.memberId === selectedMemberId) : undefined;
  const selectedGap = view.gaps.find((gap) => gap.memberId === selectedMemberId);
  const ratioText = (ratio: number) => t('elastic.value', {
    ratio: formatFixed(ratio, 2, 'canvas'),
    percent: formatFixed(ratio * 100, 1, 'canvas'),
  });
  const saturated = highest !== null && elasticIndexPaint(highest.ratio).saturated;
  const blockerKey: TranslationKey | null = view.status === 'available' ? null
    : view.blocker === 'no-analysis' ? 'elastic.blockedNoAnalysis'
      : view.blocker === 'unreliable' ? 'elastic.blockedUnreliable' : 'elastic.blockedNoMember';
  const confidenceCause = view.governingCheck ? <p className="elastic-map-legend__cause">
    {t(view.confidence === 'limited' ? 'elastic.limitedGoverning' : 'elastic.blockedGoverning', { check: reliabilityCheckLabel(view.governingCheck, t) })}
    {' '}{describeReliabilityCheck(view.governingCheck, t)}
  </p> : null;

  return <section
    className="elastic-map-legend"
    aria-label={t('canvas.demandLegendTitle')}
    data-canvas-chrome="demand-legend"
    data-testid="canvas-demand-legend"
    data-status={view.status}
    data-coverage={view.coverage}
    data-confidence={view.confidence ?? undefined}
  >
    <header className="elastic-map-legend__header">
      <strong>{t('canvas.demandLegendCompactTitle')}</strong>
      {view.confidence === 'limited' ? <span className="elastic-map-legend__limited" data-testid="canvas-demand-limited">{t('canvas.demandLegendLimited')}</span> : null}
    </header>

    <div className="elastic-map-legend__scale" aria-hidden="true">
      <div className="elastic-map-legend__ramp">
        <span className="elastic-map-legend__reference" style={{ left: `${ELASTIC_REFERENCE_RATIO / ELASTIC_SATURATION_RATIO * 100}%` }} />
        {selected ? <span className="elastic-map-legend__marker" style={{ left: `${Math.max(0, Math.min(selected.ratio / ELASTIC_SATURATION_RATIO, 1)) * 100}%` }} /> : null}
      </div>
      <div className="elastic-map-legend__ticks"><span>0</span><span>50</span><strong>{t('canvas.demandLegendReference')}</strong><span>150</span><span>{`${ELASTIC_SATURATION_RATIO * 100}+ %`}</span></div>
    </div>

    {highest ? <div className="elastic-map-legend__reading" data-testid="canvas-demand-maximum">
      <span>{t('canvas.demandLegendMaximum')}</span>
      <div>
        {onSelectMember ? <button type="button" onClick={() => onSelectMember(highest.memberId)} aria-label={t('elastic.locateHint', { member: highest.memberId })} title={t('elastic.locateHint', { member: highest.memberId })}><b>{highest.memberId}</b><LocateFixed size={12} aria-hidden="true" /></button> : <b>{highest.memberId}</b>}
        <strong>{ratioText(highest.ratio)}</strong>
      </div>
    </div> : <p className="elastic-map-legend__unavailable"><strong>{t('canvas.demandLegendUnavailable')}</strong>{blockerKey ? <span>{t(blockerKey)}</span> : null}</p>}

    {view.total > 0 ? <p className={`elastic-map-legend__coverage${view.unevaluated.size ? ' elastic-map-legend__missing' : ''}`} data-testid="canvas-demand-coverage">{view.unevaluated.size > 0 ? <i aria-hidden="true" /> : null}{t(view.unevaluated.size > 0 ? 'canvas.demandLegendCoveragePartial' : 'canvas.demandLegendCoverageComplete', {
      evaluated: view.evaluated, total: view.total, unevaluated: view.unevaluated.size,
    })}</p> : null}

    {selected || selectedGap ? <div className="elastic-map-legend__selected" data-testid="canvas-demand-selected" data-status={selected ? 'available' : 'unavailable'} style={selected ? { '--elastic-map-selected-color': elasticIndexPaint(selected.ratio).color } as CSSProperties : undefined}>
      <span>{t('canvas.demandLegendSelected')} · <b>{selectedMemberId}</b></span>
      <strong>{selected ? ratioText(selected.ratio) : t('canvas.demandLegendUnavailable')}</strong>
    </div> : null}

    <details className="elastic-map-legend__details">
      <summary>{t('canvas.demandLegendDetails')}</summary>
      <div>
        <p>{t('canvas.demandLegendMeaning')}</p>
        <p>{t('elastic.envelopeNote')}</p>
        {view.unevaluated.size > 0 ? <p>{t('canvas.demandLegendUnevaluated')}</p> : null}
        {saturated ? <p className="elastic-map-legend__saturated" data-testid="canvas-demand-saturated">{t('canvas.demandLegendSaturated', { saturation: formatFixed(ELASTIC_SATURATION_RATIO, 2), max: formatFixed(highest.ratio, 2) })}</p> : null}
        {view.status === 'available' && view.coverage === 'partial' ? <p>{t('elastic.scopePartial', { evaluated: view.evaluated, total: view.total, member: view.highest.memberId })}</p> : null}
        {view.confidence === 'limited' ? <p>{t('elastic.limitedConfidence')}</p> : null}
        {confidenceCause}
        {(selectedGap?.gaps ?? (view.status === 'unavailable' ? view.missing : [])).map((gap) => <p key={gap}>{t(gapLabel[gap])}</p>)}
        <p>{t('elastic.limitNote')}</p>
      </div>
    </details>
  </section>;
};
