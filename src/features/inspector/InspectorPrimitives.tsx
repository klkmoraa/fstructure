import type { LucideIcon } from 'lucide-react';
import { ChevronRight, CircleHelp, LockKeyhole } from 'lucide-react';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { unitLabel } from '../../engine/units';
import { fromDisplay, toDisplay, type UnitQuantity } from '../../foundation/units';
import type { UnitSystemId } from '../../foundation/units';
import { InspectorNumericField } from './InspectorNumericField';

/** Dentro de «Avanzado» cada grupo es una fila que se despliega. */
const CollapsibleGroupsContext = createContext(false);

export interface InspectorSummaryMetric {
  label: string;
  value: string;
  tone?: 'neutral' | 'axial' | 'shear' | 'moment';
}

export const PhysicalNumberField = ({
  label,
  value,
  units,
  quantity,
  resetKey,
  onCommit,
  hint,
  validate,
  disabled,
  lockedReason,
}: {
  label: string;
  value: number;
  units: UnitSystemId;
  quantity: UnitQuantity;
  resetKey: string;
  onCommit: (value: number) => void;
  hint?: string;
  validate?: (value: number) => string | undefined;
  disabled?: boolean;
  lockedReason?: string;
}) => {
  const { language } = useI18n();
  return (
    <InspectorNumericField
      label={label}
      value={toDisplay(value, units, quantity)}
      unit={unitLabel(units, quantity)}
      resetKey={`${resetKey}:${units}`}
      hint={hint}
      validate={validate}
      disabled={disabled}
      lockedReason={lockedReason}
      language={language}
      onCommit={(displayValue) => onCommit(fromDisplay(displayValue, units, quantity))}
    />
  );
};

export const InspectorSelectionSummary = ({
  icon: Icon,
  type,
  id,
  description,
  metrics = [],
  empty = false,
}: {
  icon: LucideIcon;
  type: string;
  id: string;
  description: string;
  metrics?: readonly InspectorSummaryMetric[];
  empty?: boolean;
}) => {
  const { t } = useI18n();
  return <section className={`inspector-summary${empty ? ' is-empty' : ''}`} aria-label={t('inspector.selectionSummary')}>
    <div className="inspector-summary__identity">
      <span className="inspector-summary__preview" aria-hidden="true"><Icon size={20} /></span>
      <div>
        <span className="inspector-summary__type">{type}</span>
        <strong>{id}</strong>
        <small>{description}</small>
      </div>
    </div>
    {metrics.length > 0 ? <dl className="inspector-summary__metrics" aria-label={t('inspector.quickResults')}>
      {metrics.map((metric) => <div key={metric.label} className={metric.tone ? `is-${metric.tone}` : undefined}>
        <dt>{metric.label}</dt>
        <dd>{metric.value}</dd>
      </div>)}
    </dl> : null}
  </section>;
};

/**
 * Un grupo de propiedades. Fuera de «Avanzado» es una sección con su título;
 * dentro, una fila con su valor a la vista que se despliega al tocarla: lo que
 * hay se lee sin abrir nada, y sólo se abre lo que se va a cambiar.
 */
export const InspectorPropertyGroup = ({
  title,
  mode = 'editable',
  summary,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  mode?: 'editable' | 'derived';
  /** El valor que se ve con la fila cerrada (sólo dentro de «Avanzado»). */
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
}) => {
  const collapsible = useContext(CollapsibleGroupsContext);
  const [open, setOpen] = useState(false);
  if (collapsible) {
    return <details
      className={`inspector-property-group is-${mode} is-collapsible${className ? ` ${className}` : ''}`}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="inspector-property-group__row">
        <span className="inspector-property-group__title">{title}</span>
        {summary !== undefined && summary !== null ? <span className="inspector-property-group__summary">{summary}</span> : null}
        <ChevronRight size={16} aria-hidden="true" className="inspector-property-group__chevron" />
      </summary>
      {open ? <div className="inspector-property-group__body">{children}</div> : null}
    </details>;
  }
  return <section className={`inspector-property-group is-${mode}${className ? ` ${className}` : ''}`}>
    <header className="inspector-property-group__header">
      <h3>{title}</h3>
    </header>
    <div className="inspector-property-group__body">{children}</div>
  </section>;
};

interface InspectorDerivedRow {
  label: string;
  value: ReactNode;
  description?: string;
}

export const InspectorDerivedList = ({ rows }: { rows: readonly InspectorDerivedRow[] }) => (
  <dl className="inspector-derived-list">
    {rows.map((row) => <div key={row.label}>
      <dt>{row.label}{row.description ? <small>{row.description}</small> : null}</dt>
      <dd>{row.value}</dd>
    </div>)}
  </dl>
);

export const InspectorLockedState = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="inspector-locked-state" role="note">
    <LockKeyhole size={16} aria-hidden="true" />
    <div><strong>{title}</strong><span>{children}</span></div>
  </div>
);

/**
 * Una convención o una aclaración. Las advertencias se ven siempre; el resto
 * queda tras un ⓘ y se lee a petición, sin párrafos fijos entre los campos.
 */
export const InspectorHelper = ({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) => {
  const { t } = useI18n();
  if (tone === 'warning') return <div className="inspector-helper is-warning" role="status">
    <CircleHelp size={16} aria-hidden="true" />
    <span>{children}</span>
  </div>;
  return <details className="inspector-helper is-info">
    <summary aria-label={t('inspector.moreInfo')} title={t('inspector.moreInfo')}><CircleHelp size={15} aria-hidden="true" /></summary>
    <span>{children}</span>
  </details>;
};

/**
 * «Avanzado»: una lista de filas, una por grupo, con su valor a la vista. Antes
 * era un acordeón que en el teléfono sólo decía que había más cosas y abría
 * todo a pantalla completa; ahora se ve qué hay y se abre sólo una fila.
 */
export const InspectorAdvancedProperties = ({ children }: { children: ReactNode }) => {
  const { t } = useI18n();
  return <section className="inspector-advanced" aria-label={t('inspector.advancedProperties')}>
    <h3 className="inspector-advanced__title">{t('inspector.advancedShort')}</h3>
    <div className="inspector-advanced__list">
      <CollapsibleGroupsContext value>{children}</CollapsibleGroupsContext>
    </div>
  </section>;
};
