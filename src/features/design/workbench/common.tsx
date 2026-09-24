import { AlertTriangle, CheckCircle2, ChevronDown, CircleAlert, Info, XCircle } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Select } from '../../../design-system/components/controls';
import { UnitField } from '../../../design-system/components/editor';
import { REBAR_SIZES, type ElementCheck } from '../../../design/elements/shared';
import { useWorkbenchStorage, type WorkbenchStorage } from './workbenchStorage';

export const parseNumber = (value: string): number => {
  const normalized = value.trim().replace(',', '.');
  return normalized === '' ? Number.NaN : Number(normalized);
};

/** Lee un borrador guardado; es sólo una comodidad y la página funciona sin almacenamiento. */
export function readStored<T>(storage: WorkbenchStorage, key: string, parse: (raw: unknown) => T | undefined, fallback: T): T {
  return parse(storage.read(key)) ?? fallback;
}

export const isShortString = (value: unknown): value is string => typeof value === 'string' && value.length <= 32;

export function useStoredDraft<T extends Record<string, string>>(key: string, defaults: T) {
  const storage = useWorkbenchStorage();
  const [draft, setDraft] = useState<T>(() => readStored(storage, key, (raw) => {
    if (!raw || typeof raw !== 'object') return undefined;
    const merged = { ...defaults };
    for (const field of Object.keys(defaults) as (keyof T)[]) {
      const value = (raw as Record<string, unknown>)[field as string];
      if (isShortString(value)) merged[field] = value as T[keyof T];
    }
    return merged;
  }, defaults));
  useEffect(() => storage.write(key, draft), [draft, key, storage]);
  const set = (field: keyof T) => (value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const reset = () => setDraft(defaults);
  return { draft, set, reset };
}

export function NumberField({ label, value, unit, onChange, hint, min = 0 }: {
  label: string; value: string; unit: string; onChange: (value: string) => void; hint?: string; min?: number;
}) {
  const parsed = parseNumber(value);
  const error = value.trim() === '' || !Number.isFinite(parsed) ? 'Número inválido' : parsed < min ? `Mínimo ${min}` : undefined;
  return <UnitField label={label} value={value} unit={unit} onValueChange={onChange} hint={error ? undefined : hint} error={error} />;
}

export function BarSelect({ label, value, onChange, allowAuto = false, minimumDiameterMm = 0 }: {
  label: string; value: string; onChange: (value: string) => void; allowAuto?: boolean; minimumDiameterMm?: number;
}) {
  return <Select label={label} value={value} onChange={(event) => onChange(event.currentTarget.value)}>
    {allowAuto ? <option value="auto">Automático</option> : null}
    {REBAR_SIZES.filter((size) => size.diameterMm >= minimumDiameterMm).map((size) => (
      <option key={size.label} value={String(size.diameterMm)}>{`${size.label} · Ø ${size.diameterMm} mm`}</option>
    ))}
  </Select>;
}

/** Destinos de la tabla 6.1.2.2 de NTC-CyA 2023: W (media, para flechas diferidas) y Wm (máxima). */
export const LIVE_LOAD_USES = [
  { value: 'habitacion', label: 'Habitación', w: 0.8, wm: 1.9 },
  { value: 'oficinas', label: 'Oficinas', w: 1.0, wm: 2.5 },
  { value: 'aulas', label: 'Aulas', w: 1.0, wm: 2.5 },
  { value: 'comunicacion', label: 'Pasillos y escaleras', w: 0.4, wm: 3.5 },
] as const;
export const sustainedRatioFor = (use: string) => {
  const item = LIVE_LOAD_USES.find((entry) => entry.value === use) ?? LIVE_LOAD_USES[0];
  return item.w / item.wm;
};

/** ξ de la tabla 13.4.4.1 según la duración de la carga sostenida. */
export const LONG_TERM_DURATIONS = [
  { value: '3', label: '3 meses', xi: 1.0 },
  { value: '6', label: '6 meses', xi: 1.2 },
  { value: '12', label: '12 meses', xi: 1.4 },
  { value: '60', label: '5 años o más', xi: 2.0 },
] as const;
export const xiFor = (months: string) => (LONG_TERM_DURATIONS.find((entry) => entry.value === months) ?? LONG_TERM_DURATIONS[3]).xi;

export function GroupSelect({ value, onChange, groups }: { value: string; onChange: (value: string) => void; groups: readonly { value: string; label: string }[] }) {
  return <Select label="Grupo de la construcción" value={value} onChange={(event) => onChange(event.currentTarget.value)}>
    {groups.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
  </Select>;
}

const KGCM2_PER_MPA = 10.197_162;
export const mpaFromKgcm2 = (value: string) => parseNumber(value) / KGCM2_PER_MPA;
export const mpaHint = (value: string) => {
  const mpa = mpaFromKgcm2(value);
  return Number.isFinite(mpa) ? `${mpa.toFixed(1)} MPa` : undefined;
};

export function FieldGroup({ title, children, columns = 2, action }: { title: string; children: ReactNode; columns?: 1 | 2 | 3; action?: ReactNode }) {
  const id = useId();
  return <section className="dw-group" aria-labelledby={id}>
    <header><h3 id={id} className="dw-eyebrow">{title}</h3>{action}</header>
    <div className="dw-group__grid" data-columns={columns}>{children}</div>
  </section>;
}

/** Bloque plegado: lo que casi nunca se toca o sólo se consulta queda fuera de la vista. */
export function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <section className="dw-group dw-more">
    <button type="button" className="dw-more__toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <span>{label}</span><ChevronDown size={15} aria-hidden="true" />
    </button>
    {open ? <div id={id} className="dw-more__body">{children}</div> : null}
  </section>;
}

export function MoreOptions({ children }: { children: ReactNode }) {
  return <Disclosure label="Más opciones"><div className="dw-group__grid" data-columns={2}>{children}</div></Disclosure>;
}

export const formatNumber = (value: number, digits = 1) =>
  Number.isFinite(value) ? value.toLocaleString('es-MX', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';

const statusIcon = { pass: CheckCircle2, fail: XCircle, warning: AlertTriangle, info: Info } as const;
const statusLabel = { pass: 'Cumple', fail: 'No cumple', warning: 'Revisar', info: 'Nota' } as const;

export function Verdict({ status, ratio, title, children }: {
  status: 'pass' | 'fail' | 'warning'; ratio: number; title: string; children?: ReactNode;
}) {
  const Icon = statusIcon[status];
  const percent = Number.isFinite(ratio) ? Math.round(ratio * 100) : 999;
  return <section className="dw-verdict" data-status={status} aria-live="polite">
    <p className="dw-eyebrow">{title}</p>
    <div className="dw-verdict__head">
      <Icon size={20} aria-hidden="true" />
      <strong>{status === 'pass' ? 'Cumple' : status === 'fail' ? 'No cumple' : 'Cumple con observaciones'}</strong>
      <span className="dw-verdict__percent" title="Relación demanda/capacidad que rige">{percent > 999 ? '>999' : percent}<small>%</small></span>
    </div>
    <div className="dw-meter" role="meter" aria-label="Utilización que rige" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(percent, 100)}>
      <i style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
    {children}
  </section>;
}

export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return <section className="dw-section" aria-labelledby={id}><h3 id={id} className="dw-eyebrow">{title}</h3>{children}</section>;
}

export function ChecksList({ checks }: { checks: readonly ElementCheck[] }) {
  return <ul className="dw-checks">
    {checks.map((check) => {
      const Icon = statusIcon[check.status];
      const percent = check.ratio !== undefined && Number.isFinite(check.ratio) ? Math.round(check.ratio * 100) : undefined;
      return <li key={check.id} data-status={check.status}>
        <Icon size={14} aria-hidden="true" />
        <div className="dw-checks__body">
          <div className="dw-checks__row">
            <span>{check.label}</span>
            <b>{percent !== undefined ? `${percent} %` : statusLabel[check.status]}</b>
          </div>
          {percent !== undefined ? <div className="dw-meter dw-meter--thin" aria-hidden="true"><i style={{ width: `${Math.min(100, percent)}%` }} /></div> : null}
          <small>
            {check.demand !== undefined && check.capacity !== undefined
              ? `${formatNumber(check.demand, check.unit === '' ? 2 : 1)} ≤ ${formatNumber(check.capacity, check.unit === '' ? 2 : 1)} ${check.unit ?? ''}`.trim()
              : null}
            <em className="dw-reference" data-basis={check.reference.standard}
              title={check.reference.standard === 'complementary' ? 'Criterio complementario: no proviene de una cláusula NTC verificada' : `Cláusulas verificadas: ${check.reference.clauseIds.join(', ')}`}>
              {check.reference.label}
            </em>
          </small>
          {check.note ? <small className="dw-checks__note">{check.note}</small> : null}
        </div>
      </li>;
    })}
  </ul>;
}

export function ErrorsPanel({ errors }: { errors: readonly string[] }) {
  return <section className="dw-errors" role="alert">
    <CircleAlert size={18} aria-hidden="true" />
    <div><strong>Revisa los datos</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>
  </section>;
}

export function Summary({ rows }: { rows: readonly { label: string; value: ReactNode; tone?: 'moment' | 'shear' | 'axial' }[] }) {
  return <dl className="dw-summary">
    {rows.map((row) => <div key={row.label} data-tone={row.tone}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
  </dl>;
}

export function ValuesTable({ rows }: { rows: readonly { symbol: string; label: string; value: string }[] }) {
  return <dl className="dw-values">
    {rows.map((row) => <div key={`${row.symbol}-${row.label}`}><dt><b>{row.symbol}</b>{row.label}</dt><dd>{row.value}</dd></div>)}
  </dl>;
}

export function RebarList({ items }: { items: readonly { kind: 'bar' | 'extra' | 'stirrup'; title: string; detail: string }[] }) {
  return <ul className="dw-rebar-list">
    {items.map((item) => <li key={item.title}>
      <span className={`dw-swatch dw-swatch--${item.kind}`} aria-hidden="true" />
      <div><strong>{item.title}</strong><small>{item.detail}</small></div>
    </li>)}
  </ul>;
}
