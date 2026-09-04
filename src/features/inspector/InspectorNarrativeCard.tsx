import { CircleSlash, Gauge, Info } from 'lucide-react';
import { unitLabel } from '../../engine/units';
import { toDisplay } from '../../foundation/units';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/catalogs';
import type { AnalysisResult, MemberModel, MemberResult } from '../../types';
import type { UnitSystemId } from '../../foundation/units';
import { formatFixed } from '../../utils/numberFormat';
import { formatInspectorValue } from './numericFormatting';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import {
  ELASTIC_REFERENCE_RATIO,
  elasticIndexPaint,
  memberElasticIndexView,
  type ElasticIndexGap,
} from '../results/elasticDemand';
import { describeReliabilityCheck, reliabilityCheckLabel } from '../results/reliabilityCopy';

export interface InspectorNarrativeCardProps {
  member: MemberModel;
  result: MemberResult;
  /** El índice comparte la puerta de confiabilidad con el Resumen. */
  analysis: AnalysisResult | null | undefined;
  units: UnitSystemId;
}

const gapLabel: Record<ElasticIndexGap, TranslationKey> = {
  'yield-strength': 'elastic.missingYield',
  'section-modulus': 'elastic.missingModulus',
  'section-geometry': 'elastic.missingGeometry',
};

/**
 * Cómo trabaja el miembro seleccionado, y cuánta demanda elástica estimada tiene.
 *
 * La narrativa de régimen —axil, flexión o combinado— se mantiene: describe la
 * mecánica del miembro y no afirma nada sobre su seguridad. Lo que se fue es el
 * veredicto («queda margen cómodo», «revisa sección») y su medidor con corte en
 * 0,85: eran un juicio de aceptación que una estimación elástica no sostiene.
 *
 * En su lugar va el mismo view-model que publica el Resumen —
 * `memberElasticIndexView`— de forma que el panel y la tarjeta global no pueden
 * discrepar ni en el valor ni en el estado ni en el significado.
 */
export const InspectorNarrativeCard = ({ member, result, analysis, units }: InspectorNarrativeCardProps) => {
  const { t } = useI18n();
  const view = memberElasticIndexView(member, result, analysis);

  if (view.status === 'unavailable') {
    const blockedKey: TranslationKey | null = view.blocker === 'no-analysis'
      ? 'elastic.blockedNoAnalysis'
      : view.blocker === 'unreliable' ? 'elastic.blockedUnreliable' : null;
    return <section className="inspector-narrative" data-status="unavailable" aria-label={t('elastic.unavailableTitle')}>
      <header>
        <CircleSlash size={15} aria-hidden="true" />
        <strong>{t('elastic.unavailableTitle')}</strong>
      </header>
      <details className="elastic-how">
        <summary aria-label={t('elastic.limitNote')}>?</summary>
        {blockedKey ? <p>{t(blockedKey)}</p> : null}
        {view.blocker === 'unreliable' && view.governingCheck ? <p data-testid="inspector-blocked-cause">
          <span>{t('elastic.blockedGoverning', { check: reliabilityCheckLabel(view.governingCheck, t) })}</span>
          <span className="elastic-demand-limited-message">{describeReliabilityCheck(view.governingCheck, t)}</span>
        </p> : null}
        {view.gaps.length ? <ul className="elastic-demand-missing">{view.gaps.map((gap) => <li key={gap}>{t(gapLabel[gap])}</li>)}</ul> : null}
        <small>{t('elastic.limitNote')}</small>
      </details>
    </section>;
  }

  const { index, confidence, governingCheck } = view;
  const paint = elasticIndexPaint(index.ratio);
  const percent = index.ratio * 100;
  const ratioText = formatFixed(index.ratio, 2, 'inspector');

  return <section
    className="inspector-narrative"
    data-status="available"
    data-confidence={confidence}
    data-at-reference={paint.atReference ? 'true' : 'false'}
    aria-label={t('inspector.narrativeTitle')}
  >
    <header>
      <Gauge size={15} aria-hidden="true" />
      <strong>{t('inspector.narrativeTitle')}</strong>
    </header>

    <p className="elastic-index-value" data-testid="inspector-elastic-value">{t('elastic.value', {
      ratio: ratioText,
      percent: formatFixed(percent, 0, 'inspector'),
    })}</p>
    {paint.atReference ? <p className="elastic-index-reference-note" data-testid="inspector-at-reference">
      {t('elastic.atReference')}
    </p> : null}

    {/* Decorativa: el valor ya está en texto, y η puede superar 1. */}
    <div className="elastic-index-scale" data-at-reference={paint.atReference ? 'true' : 'false'} aria-hidden="true">
      <span className="elastic-index-fill" style={{ width: `${Math.min(percent, 100)}%` }} />
      <span className="elastic-index-reference" style={{ left: `${ELASTIC_REFERENCE_RATIO * 100}%` }} />
    </div>

    {confidence === 'limited' ? <details className="elastic-how" data-testid="inspector-limited-cause">
      <summary aria-label={t('elastic.limitedConfidence')}>?</summary>
      {governingCheck ? <p>
        <span>{t('elastic.limitedGoverning', { check: reliabilityCheckLabel(governingCheck, t) })}</span>
        <span className="elastic-demand-limited-message">{describeReliabilityCheck(governingCheck, t)}</span>
        <button type="button" onClick={() => emitWorkspaceCommand('open-model-doctor')}>{t('elastic.actionDoctor')}</button>
      </p> : null}
    </details> : null}

    <dl className="inspector-narrative-values">
      <div>
        <dt>N*</dt>
        <dd>{formatFixed(toDisplay(index.maxAxial, units, 'force'), 2, 'inspector')} {unitLabel(units, 'force')}</dd>
      </div>
      <div>
        <dt>M*</dt>
        <dd>{formatFixed(toDisplay(index.maxMoment, units, 'moment'), 2, 'inspector')} {unitLabel(units, 'moment')}</dd>
      </div>
      <div>
        {/* σ comparte dimensión con el módulo elástico: se muestra con esa
            cantidad para no colar un MPa fijo en un proyecto imperial. */}
        <dt>σ*</dt>
        <dd>{formatInspectorValue(toDisplay(index.sigmaTotal, units, 'elasticModulus'), unitLabel(units, 'elasticModulus'))}</dd>
      </div>
    </dl>

    <details className="elastic-how">
      <summary>{t('elastic.howTitle')}</summary>
      <p className="elastic-how-chain">{index.section ? t('elastic.howChain') : t('elastic.howChainAxial')}</p>
      <ul className="elastic-how-steps">
        <li>{t('elastic.materialLabel')}: {formatInspectorValue(toDisplay(index.material.yieldStrength, units, 'elasticModulus'), unitLabel(units, 'elasticModulus'))} · {t('elastic.provenanceCatalog', { name: index.material.name, id: index.material.id })}</li>
        <li>{index.section
          ? `${t('elastic.sectionLabel')}: ${formatInspectorValue(toDisplay(index.section.sectionModulus, units, 'sectionModulus'), unitLabel(units, 'sectionModulus'))} · ${t('elastic.provenanceCatalog', { name: index.section.name, id: index.section.id })}`
          : `${t('elastic.sectionLabel')}: ${t('elastic.axialOnly')}`}</li>
        <li>{t('elastic.howRatio', {
          sigma: formatInspectorValue(toDisplay(index.sigmaTotal, units, 'elasticModulus'), unitLabel(units, 'elasticModulus')),
          yield: formatInspectorValue(toDisplay(index.material.yieldStrength, units, 'elasticModulus'), unitLabel(units, 'elasticModulus')),
          ratio: ratioText,
        })}</li>
      </ul>
      <p className="elastic-how-reference"><Info size={13} aria-hidden="true" />{t('elastic.referenceNote')}</p>
    </details>

    <small className="inspector-narrative-basis">{t('elastic.envelopeNote')} {t('elastic.limitNote')}</small>
  </section>;
};
