import { useEffect, useState } from 'react';
import {
  FORCE_UNIT_OPTIONS,
  LENGTH_UNIT_OPTIONS,
  UNIT_SYSTEM_PROFILES,
  unitSystemLabel,
} from '../../engine/units';
import {
  createCustomUnitSystemId,
  isCustomUnitSystemId,
  parseCustomUnitSystemId,
  type UnitForceId,
  type UnitLengthId,
  type UnitSystemId,
} from '../../foundation/units';
import { useI18n } from '../../i18n/useI18n';

const CUSTOM_VALUE = '__custom__';

export const UnitSystemEditor = ({
  value,
  onChange,
}: {
  value: UnitSystemId;
  onChange: (value: UnitSystemId) => void;
}) => {
  const { t } = useI18n();
  const parsed = parseCustomUnitSystemId(value);
  const [customName, setCustomName] = useState(parsed?.name ?? '');
  const [customForce, setCustomForce] = useState<UnitForceId>(parsed?.force ?? 'kN');
  const [customLength, setCustomLength] = useState<UnitLengthId>(parsed?.length ?? 'm');

  useEffect(() => {
    const next = parseCustomUnitSystemId(value);
    if (!next) return;
    setCustomName(next.name);
    setCustomForce(next.force);
    setCustomLength(next.length);
  }, [value]);

  const selectedValue = isCustomUnitSystemId(value) ? CUSTOM_VALUE : value;
  const applyCustom = () => {
    onChange(createCustomUnitSystemId(customName, customForce, customLength));
  };

  return <section className="inspector-section unit-system-editor">
    <h3>{t('inspector.units')}</h3>
    <p className="section-description">{t('inspector.unitsDescription')}</p>
    <label className="select-field">
      <span>{t('inspector.unitSystem')}</span>
      <select
        aria-label={t('inspector.unitSystem')}
        value={selectedValue}
        onChange={(event) => {
          if (event.currentTarget.value === CUSTOM_VALUE) {
            applyCustom();
            return;
          }
          onChange(event.currentTarget.value as UnitSystemId);
        }}
      >
        <optgroup label={t('inspector.standardUnits')}>
          {UNIT_SYSTEM_PROFILES.map((profile) => (
            <option key={profile.id} value={profile.id}>{profile.label}</option>
          ))}
        </optgroup>
        <option value={CUSTOM_VALUE}>
          {parsed ? t('inspector.customUnits') + ' · ' + unitSystemLabel(value) : t('inspector.createCustomUnits')}
        </option>
      </select>
    </label>
    <div className="unit-system-editor__custom">
      <strong>{t('inspector.customUnits')}</strong>
      <p>{t('inspector.customUnitsDescription')}</p>
      <label className="field-row">
        <span>{t('inspector.customUnitName')}</span>
        <input
          aria-label={t('inspector.customUnitName')}
          value={customName}
          maxLength={64}
          placeholder={t('inspector.customUnitNamePlaceholder')}
          onChange={(event) => setCustomName(event.currentTarget.value)}
        />
      </label>
      <label className="select-field">
        <span>{t('inspector.forceUnit')}</span>
        <select
          aria-label={t('inspector.forceUnit')}
          value={customForce}
          onChange={(event) => setCustomForce(event.currentTarget.value as UnitForceId)}
        >
          {FORCE_UNIT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      <label className="select-field">
        <span>{t('inspector.lengthUnit')}</span>
        <select
          aria-label={t('inspector.lengthUnit')}
          value={customLength}
          onChange={(event) => setCustomLength(event.currentTarget.value as UnitLengthId)}
        >
          {LENGTH_UNIT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      <button type="button" className="unit-system-editor__apply" onClick={applyCustom}>
        {t('inspector.applyCustomUnits')}
      </button>
    </div>
  </section>;
};
