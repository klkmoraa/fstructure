import { Select } from '../../../design-system/components/controls';
import { UnitField } from '../../../design-system/components/editor';

const FC_VALUES = ['150', '200', '250', '300', '350', '400'] as const;
const FY_VALUES = ['2800', '4200', '5000', '6000'] as const;

function SuggestedNumber({ label, value, values, onChange }: {
  label: string;
  value: string;
  values: readonly string[];
  onChange(value: string): void;
}) {
  const suggested = values.includes(value);
  return <>
    <Select label={`${label} sugerido`} value={suggested ? value : 'custom'} onChange={(event) => {
      if (event.currentTarget.value !== 'custom') onChange(event.currentTarget.value);
    }}>
      <option value="custom">Personalizado</option>
      {values.map((item) => <option key={item} value={item}>{item} kg/cm²</option>)}
    </Select>
    <UnitField label={label} unit="kg/cm²" value={value} onValueChange={onChange} />
  </>;
}

/** Valores frecuentes como atajo; los campos siguen aceptando cualquier valor. */
export function MaterialFields({ fc, onFcChange, fy, onFyChange, fyv, onFyvChange, showFc = true }: {
  fc: string;
  onFcChange(value: string): void;
  fy: string;
  onFyChange(value: string): void;
  fyv?: string;
  onFyvChange?(value: string): void;
  showFc?: boolean;
}) {
  return <>
    {showFc ? <SuggestedNumber label="f′c" value={fc} values={FC_VALUES} onChange={onFcChange} /> : null}
    <SuggestedNumber label="fy" value={fy} values={FY_VALUES} onChange={onFyChange} />
    {fyv !== undefined && onFyvChange ? <SuggestedNumber label="fy estribos" value={fyv} values={FY_VALUES} onChange={onFyvChange} /> : null}
  </>;
}
