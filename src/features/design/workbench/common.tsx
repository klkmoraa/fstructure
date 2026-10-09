import { parseNumber, isShortString } from './formNumbers';
export { parseNumber, isShortString, LIVE_LOAD_USES, LONG_TERM_DURATIONS, sustainedRatioFor, xiFor, mpaFromKgcm2 } from './formNumbers';
import { AlertTriangle, CheckCircle2, ChevronDown, CircleAlert, CircleDashed, Info, XCircle } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Field, SegmentedControl, Select } from '../../../design-system/components/controls';
import { UnitField } from '../../../design-system/components/editor';
import { REBAR_SIZES, STIRRUP_SIZES, type BarUsage, type ElementCheck } from '../../../design/elements/shared';
import type { Takeoff } from '../../../design/elements/takeoff';
import type { ReportAlternative } from './designReport';
import { useWorkbenchStorage, type WorkbenchStorage } from './workbenchStorage';

/** Lee un borrador guardado; es sólo una comodidad y la página funciona sin almacenamiento. */
export function readStored<T>(storage: WorkbenchStorage, key: string, parse: (raw: unknown) => T | undefined, fallback: T): T {
  return parse(storage.read(key)) ?? fallback;
}



/**
 * Borrador de un formulario guardado en el taller. `legacy` da el valor de un
 * campo nuevo para borradores guardados antes de que existiera (p. ej. la fuente
 * de Estructura, que antes sólo podía ser el pórtico generado): lo guardado
 * conserva su significado aunque cambie el valor por omisión.
 */
export function useStoredDraft<T extends Record<string, string>>(key: string, defaults: T, legacy?: Partial<T>) {
  const storage = useWorkbenchStorage();
  const [draft, setDraft] = useState<T>(() => readStored(storage, key, (raw) => {
    if (!raw || typeof raw !== 'object') return undefined;
    const merged: T = { ...defaults, ...legacy } as T;
    for (const field of Object.keys(defaults) as (keyof T)[]) {
      const value = (raw as Record<string, unknown>)[field as string];
      if (isShortString(value)) merged[field] = value as T[keyof T];
    }
    return merged;
  }, defaults));
  useEffect(() => storage.write(key, draft), [draft, key, storage]);
  const set = (field: keyof T) => (value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const reset = () => setDraft(defaults);
  return { draft, set, reset, replace: setDraft };
}

/** Deshacer y rehacer de un formulario del taller; la mesa lo muestra en la barra superior. */
export interface DraftHistory {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  undo(): void;
  redo(): void;
}

/** Cambios seguidos dentro de esta ventana (una palabra tecleada) se deshacen de una vez. */
const HISTORY_GROUP_MS = 700;
const HISTORY_LIMIT = 100;

/**
 * Historial de un estado de formulario. Cada cambio guarda el estado anterior;
 * los cambios muy seguidos se agrupan. Aplicar un paso del historial no crea
 * uno nuevo.
 */
const RETAINED_HISTORIES = new WeakMap<object, Map<string, { past: unknown[]; future: unknown[]; present: unknown }>>();

export function useDraftHistory<T>(value: T, apply: (value: T) => void, key?: string): DraftHistory {
  const scope = useWorkbenchStorage().historyScope;
  const [retained] = useState(() => {
    const saved = scope && key ? RETAINED_HISTORIES.get(scope)?.get(key) : undefined;
    return saved && JSON.stringify(saved.present) === JSON.stringify(value) ? saved : undefined;
  });
  const past = useRef<T[]>((retained?.past as T[] | undefined) ?? []);
  const future = useRef<T[]>((retained?.future as T[] | undefined) ?? []);
  const previous = useRef(value);
  const lastChange = useRef(0);
  const applying = useRef(false);
  const [counts, setCounts] = useState({ past: past.current.length, future: future.current.length });
  const sync = () => setCounts({ past: past.current.length, future: future.current.length });

  const remember = useCallback(() => {
    if (!scope || !key) return;
    let histories = RETAINED_HISTORIES.get(scope);
    if (!histories) { histories = new Map(); RETAINED_HISTORIES.set(scope, histories); }
    histories.set(key, { past: past.current, future: future.current, present: previous.current });
  }, [scope, key]);
  useEffect(() => () => remember(), [remember]);
  useEffect(() => {
    if (JSON.stringify(previous.current) === JSON.stringify(value)) { applying.current = false; return; }
    if (applying.current) {
      applying.current = false;
    } else {
      const now = Date.now();
      if (now - lastChange.current > HISTORY_GROUP_MS || past.current.length === 0) {
        past.current = [...past.current, previous.current].slice(-HISTORY_LIMIT);
      }
      lastChange.current = now;
      future.current = [];
      sync();
    }
    previous.current = value;
    remember();
  }, [value, remember]);

  const step = useCallback((from: { current: T[] }, to: { current: T[] }) => {
    const target = from.current[from.current.length - 1];
    if (target === undefined) return;
    from.current = from.current.slice(0, -1);
    to.current = [...to.current, previous.current];
    applying.current = true;
    lastChange.current = 0;
    apply(target);
    previous.current = target;
    remember();
    sync();
  }, [apply, remember]);

  return useMemo(() => ({
    canUndo: counts.past > 0,
    canRedo: counts.future > 0,
    undo: () => step(past, future),
    redo: () => step(future, past),
  }), [counts, step]);
}

export function NumberField({ label, value, unit, onChange, hint, min = 0 }: {
  label: string; value: string; unit: string; onChange: (value: string) => void; hint?: string; min?: number;
}) {
  const parsed = parseNumber(value);
  const error = value.trim() === '' || !Number.isFinite(parsed) ? 'Número inválido' : parsed < min ? `Mínimo ${min}` : undefined;
  return <UnitField label={label} value={value} unit={unit} onValueChange={onChange} hint={error ? undefined : hint} error={error} />;
}

export function BarSelect({ label, value, onChange, allowAuto = false, minimumDiameterMm = 0, usage = 'longitudinal' }: {
  label: string; value: string; onChange: (value: string) => void; allowAuto?: boolean; minimumDiameterMm?: number; usage?: BarUsage;
}) {
  return <Select label={label} value={value} onChange={(event) => onChange(event.currentTarget.value)}>
    {allowAuto ? <option value="auto">Automático</option> : null}
    {(usage === 'transverse' ? STIRRUP_SIZES : REBAR_SIZES).filter((size) => size.diameterMm >= minimumDiameterMm).map((size) => (
      <option key={size.label} value={String(size.diameterMm)}>{`${size.label} · Ø ${size.diameterMm} mm`}</option>
    ))}
  </Select>;
}

export function GroupSelect({ value, onChange, groups }: { value: string; onChange: (value: string) => void; groups: readonly { value: string; label: string }[] }) {
  return <Select label="Grupo de la construcción" value={value} onChange={(event) => onChange(event.currentTarget.value)}>
    {groups.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
  </Select>;
}



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

const statusIcon = { pass: CheckCircle2, fail: XCircle, warning: AlertTriangle, info: Info, 'out-of-scope': CircleDashed } as const;
const statusLabel = { pass: 'Cumple', fail: 'No cumple', warning: 'Revisar', info: 'Nota', 'out-of-scope': 'Sin evaluar' } as const;

/** Titular del veredicto: con verificaciones sin evaluar nunca dice «Cumple» a secas. */
export const verdictHeadline = (status: 'pass' | 'fail' | 'warning', incomplete: boolean) =>
  status === 'fail' ? 'No cumple' : status === 'warning' ? 'Cumple con observaciones' : incomplete ? 'Cumple lo evaluado' : 'Cumple';

export function Verdict({ status, ratio, title, outOfScope = 0, children }: {
  status: 'pass' | 'fail' | 'warning'; ratio: number; title: string;
  /** Verificaciones que la norma pide y el taller no calcula. */
  outOfScope?: number;
  children?: ReactNode;
}) {
  const Icon = statusIcon[status];
  const percent = Number.isFinite(ratio) ? Math.round(ratio * 100) : 999;
  return <section className="dw-verdict" data-status={status} data-incomplete={outOfScope > 0 && status !== 'fail'} aria-live="polite">
    <p className="dw-eyebrow">{title}</p>
    <div className="dw-verdict__head">
      <Icon size={20} aria-hidden="true" />
      <strong>{verdictHeadline(status, outOfScope > 0)}</strong>
      <span className="dw-verdict__percent" title="Relación demanda/capacidad que rige">{percent > 999 ? '>999' : percent}<small>%</small></span>
    </div>
    <div className="dw-meter" role="meter" aria-label="Utilización que rige" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(percent, 100)}>
      <i style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
    {outOfScope > 0 ? <p className="dw-verdict__scope">
      <CircleDashed size={13} aria-hidden="true" />
      Revisión incompleta: {outOfScope} {outOfScope === 1 ? 'verificación' : 'verificaciones'} sin evaluar.
    </p> : null}
    {children}
  </section>;
}

export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return <section className="dw-section" aria-labelledby={id}><h3 id={id} className="dw-eyebrow">{title}</h3>{children}</section>;
}

/** Separa las comprobaciones con veredicto de las notas informativas, que van al detalle. */
export const splitChecks = (checks: readonly ElementCheck[]) =>
  [checks.filter((check) => check.status !== 'info'), checks.filter((check) => check.status === 'info')] as const;

function CheckItem({ check }: { check: ElementCheck }) {
  // Lo que cumple queda en una línea; lo que no, abierto para ver por qué.
  const [open, setOpen] = useState(check.status === 'fail' || check.status === 'warning');
  const id = useId();
  const Icon = statusIcon[check.status];
  const percent = check.ratio !== undefined && Number.isFinite(check.ratio) ? Math.round(check.ratio * 100) : undefined;
  return <li data-status={check.status}>
    <button type="button" className="dw-checks__row" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <Icon size={14} aria-hidden="true" />
      <span>{check.label}</span>
      <b>{percent !== undefined ? `${percent} %` : statusLabel[check.status]}</b>
    </button>
    {percent !== undefined ? <div className="dw-meter dw-meter--thin" aria-hidden="true"><i style={{ width: `${Math.min(100, percent)}%` }} /></div> : null}
    {open ? <div id={id} className="dw-checks__detail">
      {check.location || check.combination ? <dl className="dw-checks__trace">
        {check.location ? <div><dt>Rige en</dt><dd>{check.location}</dd></div> : null}
        {check.combination ? <div><dt>Demanda</dt><dd>{check.combination}</dd></div> : null}
      </dl> : null}
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
    </div> : null}
  </li>;
}

export function ChecksList({ checks }: { checks: readonly ElementCheck[] }) {
  return <ul className="dw-checks">{checks.map((check) => <CheckItem key={check.id} check={check} />)}</ul>;
}

type ReviewFilter = 'all' | 'attention' | 'scope';
type ReviewOrder = 'calculation' | 'ratio';
const needsAttention = (check: ElementCheck) => check.status === 'fail' || check.status === 'warning';
const ratioOf = (check: ElementCheck) => check.ratio !== undefined && Number.isFinite(check.ratio) ? check.ratio : check.status === 'fail' ? Number.POSITIVE_INFINITY : -1;

/**
 * Revisión del elemento: las comprobaciones con veredicto y lo que queda fuera
 * de alcance, con filtro por estado y orden por utilización. Así lo que rige y
 * lo que falta evaluar se leen sin abrir cada fila.
 */
export function ReviewList({ checks, outOfScope }: { checks: readonly ElementCheck[]; outOfScope: readonly ElementCheck[] }) {
  const attention = checks.filter(needsAttention).length;
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [order, setOrder] = useState<ReviewOrder>('calculation');
  const shown = useMemo(() => {
    const pool = filter === 'scope' ? outOfScope : filter === 'attention' ? checks.filter(needsAttention) : checks;
    return order === 'ratio' ? [...pool].sort((a, b) => ratioOf(b) - ratioOf(a)) : pool;
  }, [checks, outOfScope, filter, order]);
  return <div className="dw-review">
    <div className="dw-review__bar">
      <SegmentedControl label="Filtrar comprobaciones" size="sm" value={filter} onValueChange={(value) => setFilter(value as ReviewFilter)}
        options={[
          { value: 'all', label: `Todas ${checks.length}` },
          { value: 'attention', label: `Atender ${attention}` },
          { value: 'scope', label: `Sin evaluar ${outOfScope.length}` },
        ]} />
      {filter === 'scope' ? null : <button type="button" className="dw-review__order" aria-pressed={order === 'ratio'}
        title="Ordenar por utilización" onClick={() => setOrder(order === 'ratio' ? 'calculation' : 'ratio')}>
        {order === 'ratio' ? 'Mayor utilización' : 'Orden de cálculo'}
      </button>}
    </div>
    {shown.length ? <ChecksList checks={shown} /> : <p className="dw-review__empty">
      {filter === 'attention' ? 'Nada que atender: ninguna comprobación falla ni pide revisión.' : 'Sin comprobaciones.'}
    </p>}
  </div>;
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

export function RebarList({ items }: { items: readonly { kind: 'bar' | 'extra' | 'stirrup'; title: string; detail?: string }[] }) {
  return <ul className="dw-rebar-list">
    {items.map((item, index) => <li key={`${index}-${item.title}`}>
      <span className={`dw-swatch dw-swatch--${item.kind}`} aria-hidden="true" />
      <div><strong>{item.title}</strong>{item.detail ? <small>{item.detail}</small> : null}</div>
    </li>)}
  </ul>;
}

/** Clave y ubicación del elemento: encabezan la memoria. */
export function IdentityGroup({ tag, place, onTag, onPlace, example = 'V-1' }: { tag: string; place: string; onTag: (value: string) => void; onPlace: (value: string) => void; example?: string }) {
  return <FieldGroup title="Identificación">
    <Field label="Clave" value={tag} maxLength={32} placeholder={example} controlSize="sm" onChange={(event) => onTag(event.currentTarget.value)} />
    <Field label="Ubicación" value={place} maxLength={32} placeholder="Eje 3 · B–C · N2" controlSize="sm" onChange={(event) => onPlace(event.currentTarget.value)} />
  </FieldGroup>;
}

/** Cuantificación aproximada de acero y concreto del elemento. */
export function TakeoffSection({ takeoff }: { takeoff: Takeoff }) {
  return <PanelSection title="Cuantificación">
    <Summary rows={[
      { label: 'Acero', value: `${formatNumber(takeoff.steelKg, 1)} kg` },
      { label: 'Concreto', value: `${formatNumber(takeoff.concreteM3, 3)} m³` },
      { label: 'Cuantía', value: `${formatNumber(takeoff.steelRatioKgM3, 0)} kg/m³` },
    ]} />
    <p className="dw-footnote">{takeoff.basis}</p>
  </PanelSection>;
}

/** Armado propio frente al propuesto por el taller, con la misma entrada. */
export function AlternativeSection({ own, alternative }: { own: { governingRatio: number; status: 'pass' | 'fail' | 'warning'; steelKg: number }; alternative: ReportAlternative }) {
  const delta = own.steelKg - alternative.steelKg;
  const row = (name: string, item: { governingRatio: number; status: 'pass' | 'fail' | 'warning'; steelKg: number }) => <tr>
    <th scope="row">{name}</th>
    <td data-status={item.status === 'fail' ? 'fail' : undefined}>{statusLabel[item.status]}</td>
    <td>{`${Math.round(item.governingRatio * 100)} %`}</td>
    <td>{`${formatNumber(item.steelKg, 1)} kg`}</td>
  </tr>;
  return <PanelSection title="Propio frente a propuesto">
    <table className="dw-table" aria-label="Comparación del armado propio con el propuesto">
      <thead><tr><th scope="col">Armado</th><th scope="col">Estado</th><th scope="col">Rige</th><th scope="col">Acero</th></tr></thead>
      <tbody>{row('Propio', own)}{row('Propuesto', alternative)}</tbody>
    </table>
    <p className="dw-footnote">{Math.abs(delta) < 0.05 ? 'Mismo peso de acero.'
      : delta > 0 ? `El propio usa ${formatNumber(delta, 1)} kg más que el propuesto.` : `El propio ahorra ${formatNumber(-delta, 1)} kg frente al propuesto.`}</p>
  </PanelSection>;
}

/** Botón discreto en la cabecera de un grupo («Proponer»). */
export function InlineAction({ label, title, onClick, disabled = false }: { label: string; title: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="dw-inline-action" title={title} onClick={onClick} disabled={disabled}>{label}</button>;
}

/** Aviso breve bajo un grupo tras una acción automática. */
export function ActionNote({ text }: { text: string | null }) {
  return text ? <p className="dw-action-note" role="status">{text}</p> : null;
}
