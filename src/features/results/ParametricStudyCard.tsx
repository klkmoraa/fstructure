import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { toDisplay, type UnitQuantity } from '../../foundation/units';
import { unitLabel } from '../../engine/units';
import {
  PARAMETRIC_PARAMETERS,
  parseParametricFactors,
  type ParametricParameter,
  type ParametricStudyVariant,
} from '../../engine/parametricStudy';
import { useParametricStudy } from '../../engine/useParametricStudy';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import type { TranslationKey } from '../../i18n/catalogs';
import { reliabilityLevelLabelKey } from './reliabilityCopy';
import { formatResultNumber, formatResultValue } from './resultFormatting';

const parameterCopy: Record<ParametricParameter, { label: TranslationKey; quantity: UnitQuantity }> = {
  E: { label: 'results.parametricElasticModulus', quantity: 'elasticModulus' },
  A: { label: 'results.parametricArea', quantity: 'area' },
  I: { label: 'results.parametricInertia', quantity: 'inertia' },
};

const metricCopy: Array<{ id: keyof ParametricStudyVariant['metrics']; label: TranslationKey; quantity: UnitQuantity }> = [
  { id: 'axial', label: 'results.parametricAxial', quantity: 'force' },
  { id: 'shear', label: 'results.parametricShear', quantity: 'force' },
  { id: 'moment', label: 'results.parametricMoment', quantity: 'moment' },
  { id: 'deformation', label: 'results.parametricDeformation', quantity: 'length' },
];

const memberOptionLabel = (member: { id: string; label?: string }): string => member.label ? `${member.id} · ${member.label}` : member.id;

const factorText = (factor: number): string => formatResultNumber(factor);

export const ParametricStudyCard = () => {
  const { project, selection, selectedCombinationId } = useProject();
  const { t } = useI18n();
  const eligibleMembers = useMemo(() => project.members.filter((member) => member.type !== 'rigid'), [project.members]);
  const selectedWorkspaceMemberId = selection?.kind === 'member' ? selection.id : null;
  const defaultMemberId = selectedWorkspaceMemberId && eligibleMembers.some((member) => member.id === selectedWorkspaceMemberId)
    ? selectedWorkspaceMemberId
    : eligibleMembers[0]?.id ?? '';
  const [memberId, setMemberId] = useState(defaultMemberId);
  const [parameter, setParameter] = useState<ParametricParameter>('E');
  const [factorsInput, setFactorsInput] = useState('0.8, 1, 1.2');
  const [inputError, setInputError] = useState<string | null>(null);
  const selectedMember = eligibleMembers.find((member) => member.id === memberId) ?? null;
  const parameters: readonly ParametricParameter[] = selectedMember?.type === 'truss' ? PARAMETRIC_PARAMETERS.filter((item) => item !== 'I') : PARAMETRIC_PARAMETERS;
  const { study, busy, error, run } = useParametricStudy(project, selectedCombinationId);

  useEffect(() => {
    if (!eligibleMembers.some((member) => member.id === memberId)) setMemberId(defaultMemberId);
  }, [defaultMemberId, eligibleMembers, memberId]);

  useEffect(() => {
    if (!parameters.includes(parameter)) setParameter('E');
  }, [parameter, parameters]);

  const visibleStudy = study
    && study.memberId === memberId
    && study.parameter === parameter
    && study.combinationId === (selectedCombinationId || null)
    ? study
    : null;
  const property = parameterCopy[parameter];

  const submit = () => {
    try {
      const factors = parseParametricFactors(factorsInput);
      setInputError(null);
      if (memberId) run({ memberId, parameter, factors });
    } catch (nextError) {
      setInputError(nextError instanceof Error ? nextError.message : t('results.parametricInvalidFactors'));
    }
  };

  const displayMetric = (variant: ParametricStudyVariant, id: keyof ParametricStudyVariant['metrics'], quantity: UnitQuantity): string => {
    const value = variant.metrics[id];
    return value === null ? '—' : formatResultValue(toDisplay(value, project.settings.units, quantity), unitLabel(project.settings.units, quantity));
  };

  return <section className="parametric-study-card" data-level="raised" data-testid="parametric-study-card" aria-label={t('results.parametricTitle')}>
    <header>
      <div>
        <span>{t('results.parametricTitle')}</span>
        <h3>{t('results.parametricHint')}</h3>
      </div>
      <small>{t('results.parametricBound')}</small>
    </header>
    {eligibleMembers.length ? <>
      <form className="parametric-study-controls" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <label>
          <span>{t('results.parametricMember')}</span>
          <select aria-label={t('results.parametricMember')} value={memberId} onChange={(event) => { setMemberId(event.target.value); setInputError(null); }} disabled={busy}>
            {eligibleMembers.map((member) => <option key={member.id} value={member.id}>{memberOptionLabel(member)}</option>)}
          </select>
        </label>
        <label>
          <span>{t('results.parametricProperty')}</span>
          <select aria-label={t('results.parametricProperty')} value={parameter} onChange={(event) => { setParameter(event.target.value as ParametricParameter); setInputError(null); }} disabled={busy}>
            {parameters.map((item) => <option key={item} value={item}>{item} · {t(parameterCopy[item].label)}</option>)}
          </select>
        </label>
        <label className="parametric-study-factors">
          <span>{t('results.parametricFactors')}</span>
          <input aria-label={t('results.parametricFactors')} value={factorsInput} onChange={(event) => { setFactorsInput(event.target.value); setInputError(null); }} inputMode="decimal" disabled={busy} />
          <small>{t('results.parametricFactorsHint')}</small>
        </label>
        <button type="submit" disabled={busy || !memberId}>
          {busy ? <><LoaderCircle className="spin" size={15} aria-hidden="true" /> {t('results.parametricRunning')}</> : t('results.parametricRun')}
        </button>
      </form>
      {inputError || error ? <p className="parametric-study-error" role="alert">{inputError ?? `${t('results.parametricFailed')}: ${error}`}</p> : null}
      {visibleStudy ? <>
        <dl className="parametric-study-base">
          <div><dt>{t('results.parametricBase')}</dt><dd>{formatResultValue(toDisplay(visibleStudy.baseValue, project.settings.units, property.quantity), unitLabel(project.settings.units, property.quantity))}</dd></div>
          <div><dt>{t(property.label)}</dt><dd>{t('results.parametricRelative')}</dd></div>
        </dl>
        <div className="parametric-study-table-wrap">
          <table className="parametric-study-table">
            <caption>{t('results.parametricTableCaption', { member: memberId, property: parameter })}</caption>
            <thead><tr><th>{t('results.parametricFactor')}</th><th>{t('results.parametricPropertyValue')}</th>{metricCopy.map((metric) => <th key={metric.id}>{t(metric.label)}</th>)}<th>{t('results.parametricStatus')}</th></tr></thead>
            <tbody>{visibleStudy.variants.map((variant) => <tr key={`${variant.factor}-${variant.parameterValue}`} data-reliability={variant.reliability}>
              <th scope="row">{factorText(variant.factor)}×</th>
              <td>{formatResultValue(toDisplay(variant.parameterValue, project.settings.units, property.quantity), unitLabel(project.settings.units, property.quantity))}</td>
              {metricCopy.map((metric) => <td key={metric.id}>{displayMetric(variant, metric.id, metric.quantity)}</td>)}
              <td><strong>{t(reliabilityLevelLabelKey[variant.reliability])}</strong>{variant.failureReason ? <small>{variant.failureReason}</small> : null}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </> : <p className="parametric-study-empty">{t('results.parametricIdle')}</p>}
    </> : <p className="parametric-study-empty">{t('results.parametricNoMembers')}</p>}
  </section>;
};
