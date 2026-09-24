import {
  useId,
  
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { Spinner } from './feedback';

export type ToolTone = 'navigation' | 'structure' | 'load' | 'distributed' | 'moment' | 'dimension' | 'cut' | 'destructive';

interface ToolButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  label: string;
  icon: ReactNode;
  shortcut?: string;
  keyShortcut?: string;
  detail?: string;
  active?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  tone?: ToolTone;
  compact?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function ToolButton({
  label,
  icon,
  shortcut,
  keyShortcut,
  detail,
  active = false,
  loading = false,
  loadingLabel,
  tone = 'navigation',
  compact = false,
  className = '',
  disabled,
  type = 'button',
  role,
  ref,
  ...props
}: ToolButtonProps) {
  return <button
    {...props}
    ref={ref}
    type={type}
    role={role}
    className={`sc-tool-button sc-tool-button--${tone}${active ? ' is-active' : ''}${compact ? ' is-compact' : ''}${loading ? ' is-loading' : ''}${className ? ` ${className}` : ''}`}
    aria-label={loading ? (loadingLabel ?? label) : shortcut ? `${label} (${shortcut})` : label}
    aria-pressed={role === 'menuitemradio' || role === 'radio' ? undefined : active}
    aria-busy={loading || undefined}
    aria-keyshortcuts={keyShortcut ?? shortcut}
    disabled={disabled || loading}
  >
    <span className="sc-tool-button__icon" aria-hidden="true">{loading ? <Spinner size="sm" label={loadingLabel} decorative /> : icon}</span>
    <span className="sc-tool-button__copy"><strong>{label}</strong>{detail && !compact ? <small>{detail}</small> : null}</span>
    {shortcut && !compact ? <kbd>{shortcut}</kbd> : null}
  </button>;
}

interface UnitFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'size'> {
  label: string;
  value: string | number;
  unit: string;
  onValueChange: (value: string) => void;
  hint?: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

export function UnitField({
  label,
  value,
  unit,
  onValueChange,
  hint,
  error,
  id: providedId,
  className = '',
  ref,
  ...props
}: UnitFieldProps) {
  const generatedId = useId();
  const id = providedId ?? `sc-unit-field-${generatedId}`;
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return <div className={`sc-unit-field${error ? ' has-error' : ''}${props.disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}>
    <label htmlFor={id}>{label}</label>
    <span className="sc-unit-field__control">
      <input
        {...props}
        ref={ref}
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        aria-describedby={messageId}
        aria-errormessage={error ? messageId : undefined}
        aria-invalid={Boolean(error) || undefined}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <span aria-hidden="true">{unit}</span>
    </span>
    {error ? <small id={messageId} className="sc-unit-field__error" role="alert">{error}</small> : hint ? <small id={messageId}>{hint}</small> : null}
  </div>;
}

interface LayerToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'children'> {
  label: string;
  description?: string;
  icon?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const LayerToggle = ({
  label,
  description,
  icon,
  checked,
  onCheckedChange,
  className = '',
  disabled,
  type = 'button',
  ...props
}: LayerToggleProps) => (
  <button
    {...props}
    type={type}
    className={`sc-layer-toggle${checked ? ' is-checked' : ''}${className ? ` ${className}` : ''}`}
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onCheckedChange(!checked)}
  >
    {icon ? <span className="sc-layer-toggle__icon" aria-hidden="true">{icon}</span> : null}
    <span className="sc-layer-toggle__copy"><strong>{label}</strong>{description ? <small>{description}</small> : null}</span>
    <span className="sc-layer-toggle__switch" aria-hidden="true"><i /></span>
  </button>
);
