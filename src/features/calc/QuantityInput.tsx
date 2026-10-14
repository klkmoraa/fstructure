import { useEffect, useId, useState } from 'react';
import type { ExerciseField } from '../../design/exercises/types';
import { digitsOf, formatPlain, fromDisplay, toDisplay, unitOf, type UnitSystem } from '../../design/exercises/units';

const display = (units: UnitSystem, field: ExerciseField, value: number | undefined) =>
  value === undefined || !Number.isFinite(value) ? '' : formatPlain(toDisplay(units, field.kind, value), digitsOf(units, field.kind)).replace(/,/g, '');

/**
 * Un dato del ejercicio en una fila: símbolo, nombre, valor y unidad. Mientras
 * se escribe se conserva el texto tal cual; al salir se muestra normalizado en
 * las unidades elegidas.
 */
export function QuantityInput({ field, units, value, onChange }: {
  field: ExerciseField;
  units: UnitSystem;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const [text, setText] = useState(() => display(units, field, value));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(display(units, field, value)); }, [units, field, value, editing]);
  const unit = unitOf(units, field.kind);
  const label = <label className="fc-field__label" htmlFor={id}>
    <span className="fc-field__symbol">{field.symbol}</span>
    <span className="fc-field__name">{field.label}{field.optional ? <em> · opcional</em> : null}</span>
  </label>;

  if (field.kind === 'flag') {
    return <div className="fc-field fc-field--flag">
      {label}
      <span className="fc-switch">
        <input id={id} type="checkbox" role="switch" checked={Boolean(value)} onChange={(event) => onChange(event.currentTarget.checked ? 1 : 0)} />
      </span>
    </div>;
  }

  if (field.options) {
    return <div className="fc-field">
      {label}
      <span className="fc-field__control">
        <select id={id} value={value === undefined ? '' : String(value)} onChange={(event) => onChange(event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value))}>
          <option value="">Elige…</option>
          {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </span>
    </div>;
  }

  return <div className="fc-field">
    {label}
    <span className="fc-field__control">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        placeholder="?"
        value={text}
        aria-describedby={field.hint ? hintId : undefined}
        onFocus={() => setEditing(true)}
        onBlur={() => { setEditing(false); setText(display(units, field, value)); }}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          setText(raw);
          const normalized = raw.replace(/\s/g, '').replace(',', '.');
          if (normalized === '') { onChange(undefined); return; }
          const number = Number(normalized);
          if (Number.isFinite(number)) onChange(fromDisplay(units, field.kind, number));
        }}
      />
      {unit ? <span className="fc-field__unit">{unit}</span> : null}
    </span>
    {field.hint ? <small id={hintId} className="fc-field__hint">{field.hint}</small> : null}
  </div>;
}
