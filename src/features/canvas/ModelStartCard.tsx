import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import {
  MODEL_STARTS, MODEL_START_DEFAULTS, MODEL_START_FIELDS, modelStartFieldError, modelStartParts, modelStartValid,
  type ModelStartField, type ModelStartId, type ModelStartParams,
} from '../../data/modelStarts';
import { Button } from '../../design-system/components/controls';
import { circularMemberGeometry, curvePointAt } from '../../graphics/memberCurve';
import { toDisplay, fromDisplay, type UnitQuantity, type UnitSystemId } from '../../foundation/units';
import { unitLabel } from '../../engine/units';
import type { TranslationKey } from '../../i18n/catalogs';
import { useI18n } from '../../i18n/useI18n';
import './modelStart.css';

const glyph = (children: ReactNode) => <svg className="model-start__glyph" viewBox="0 0 32 20" aria-hidden="true">{children}</svg>;
const pin = (x: number) => <path d={`M${x} 13l-2.5 4h5z`} />;

const COPY: Record<ModelStartId, { title: TranslationKey; glyph: ReactNode }> = {
  'beam-simple': { title: 'modelStart.beamSimple', glyph: glyph(<><path d="M4 13h24" />{pin(4)}{pin(28)}</>) },
  'beam-cantilever': { title: 'modelStart.beamCantilever', glyph: glyph(<><path d="M5 5v14M5 12h23" /><path d="M2 7l3-2M2 11l3-2M2 15l3-2M2 19l3-2" /></>) },
  'beam-continuous': { title: 'modelStart.beamContinuous', glyph: glyph(<><path d="M3 13h26" />{pin(3)}{pin(16)}{pin(29)}</>) },
  'frame-portal': { title: 'modelStart.framePortal', glyph: glyph(<><path d="M7 19V4h18v15" /><path d="M4 19h6M22 19h6" /></>) },
  'truss-pratt': { title: 'modelStart.trussPratt', glyph: glyph(<><path d="M3 15h26M9 5h14M3 15l6-10M29 15l-6-10M9 5v10M16 5v10M23 5v10M9 5l7 10M23 5l-7 10" /></>) },
  arch: { title: 'modelStart.arch', glyph: glyph(<><path d="M4 16C8 3 24 3 28 16" />{pin(4)}{pin(28)}</>) },
};

/** Etiqueta y magnitud física de cada medida; las cuentas no llevan unidad. */
const fieldQuantity = (id: ModelStartId, field: ModelStartField): UnitQuantity | null => {
  if (field === 'count' || field === 'levels') return null;
  if (field === 'span' || field === 'height') return 'length';
  if (field === 'lateral' || id === 'truss-pratt') return 'force';
  return 'distributedForce';
};
const fieldLabel = (id: ModelStartId, field: ModelStartField): TranslationKey => {
  if (field === 'count') return id === 'truss-pratt' ? 'modelStart.field.panels' : 'modelStart.field.spans';
  if (field === 'span') return id === 'truss-pratt' || id === 'arch' ? 'modelStart.field.totalSpan' : id === 'beam-cantilever' ? 'modelStart.field.length' : 'modelStart.field.span';
  if (field === 'height') return id === 'truss-pratt' ? 'modelStart.field.depth' : id === 'arch' ? 'modelStart.field.rise' : 'modelStart.field.storyHeight';
  if (field === 'levels') return 'modelStart.field.levels';
  if (field === 'lateral') return 'modelStart.field.lateral';
  if (id === 'truss-pratt') return field === 'dead' ? 'modelStart.field.deadJoint' : 'modelStart.field.liveJoint';
  return field === 'dead' ? 'modelStart.field.dead' : 'modelStart.field.live';
};

const roundForInput = (value: number) => String(Number(value.toPrecision(6)));
const parseInput = (text: string) => {
  const normalized = text.trim().replace(',', '.');
  return normalized === '' ? Number.NaN : Number(normalized);
};

type Drafts = Partial<Record<ModelStartField, string>>;

/** Dibujo fiel del inicio con las medidas actuales: barras, arcos y apoyos. */
function StartPreview({ id, params }: { id: ModelStartId; params: ModelStartParams }) {
  const parts = useMemo(() => modelStartValid(id, params) ? modelStartParts(id, params) : null, [id, params]);
  if (!parts) return <div className="model-start__preview model-start__preview--empty" aria-hidden="true" />;
  const nodes = new Map(parts.nodes.map((node) => [node.id, node]));
  const polylines = parts.members.map((member) => {
    const i = nodes.get(member.i)!, j = nodes.get(member.j)!;
    const arc = member.curve ? circularMemberGeometry(member, i, j) : undefined;
    return { id: member.id, truss: member.type === 'truss', points: arc ? Array.from({ length: 33 }, (_, k) => curvePointAt(arc, k / 32)) : [i, j] };
  });
  const all = polylines.flatMap((line) => line.points);
  const minX = Math.min(...all.map((p) => p.x)), maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y)), maxY = Math.max(...all.map((p) => p.y));
  const width = 280, height = 112, pad = 18;
  const scale = Math.min((width - 2 * pad) / Math.max(maxX - minX, 1e-6), (height - 2 * pad - 10) / Math.max(maxY - minY, 1e-6));
  const ox = (width - (maxX - minX) * scale) / 2, oy = height - pad - 6 - ((height - 2 * pad - 10) - (maxY - minY) * scale) / 2;
  const at = (p: { x: number; y: number }) => ({ x: ox + (p.x - minX) * scale, y: oy - (p.y - minY) * scale });
  const supports = parts.nodes.filter((node) => node.support.type !== 'none').map((node) => {
    const p = at(node);
    if (node.support.type === 'fixed') {
      const vertical = parts.members.some((member) => (member.i === node.id || member.j === node.id) && Math.abs(nodes.get(member.i === node.id ? member.j : member.i)!.x - node.x) < 1e-9);
      return vertical
        ? <path key={node.id} className="model-start__support" d={`M${p.x - 7} ${p.y}h14M${p.x - 6} ${p.y + 4}l3-4M${p.x - 1} ${p.y + 4}l3-4M${p.x + 4} ${p.y + 4}l3-4`} />
        : <path key={node.id} className="model-start__support" d={`M${p.x} ${p.y - 8}v16M${p.x - 4} ${p.y - 6}l4-3M${p.x - 4} ${p.y}l4-3M${p.x - 4} ${p.y + 6}l4-3`} />;
    }
    const triangle = `M${p.x} ${p.y}l-5 8h10z`;
    return node.support.type === 'roller'
      ? <path key={node.id} className="model-start__support" d={`${triangle}M${p.x - 6} ${p.y + 11}h12`} />
      : <path key={node.id} className="model-start__support" d={triangle} />;
  });
  // Cargas de la carga muerta: flechas repartidas sobre cada barra y una por nudo.
  const arrow = (key: string, tip: { x: number; y: number }, dx: number, dy: number, size = 9) => {
    const tail = { x: tip.x - dx * size, y: tip.y - dy * size };
    const head = 2.6, nx = -dy, ny = dx;
    return <path key={key} className="model-start__load"
      d={`M${tail.x} ${tail.y}L${tip.x} ${tip.y}M${tip.x - dx * head + nx * head} ${tip.y - dy * head + ny * head}L${tip.x} ${tip.y}L${tip.x - dx * head - nx * head} ${tip.y - dy * head - ny * head}`} />;
  };
  const loads = [
    ...parts.memberLoads.filter((load) => load.caseId === 'CM').flatMap((load) => {
      const line = polylines.find((item) => item.id === load.memberId);
      if (!line) return [];
      const count = Math.max(3, Math.round(line.points.length > 2 ? 9 : 6));
      return Array.from({ length: count }, (_, k) => {
        const ratio = (k + 0.5) / count;
        const index = Math.min(line.points.length - 2, Math.floor(ratio * (line.points.length - 1)));
        const local = ratio * (line.points.length - 1) - index;
        const a = at(line.points[index]!), b = at(line.points[index + 1]!);
        return arrow(`${load.id}:${k}`, { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local - 2 }, 0, 1, 8);
      });
    }),
    ...parts.nodalLoads.filter((load) => (load.caseId === 'CM' || load.caseId === 'S') && (load.fy || load.fx)).map((load) => {
      const node = nodes.get(load.nodeId);
      if (!node) return null;
      const p = at(node), length = Math.hypot(load.fx, load.fy);
      return arrow(load.id, { x: p.x - (load.fx / length) * 3, y: p.y + (load.fy / length) * 3 }, load.fx / length, -load.fy / length, 12);
    }),
  ];
  return <svg className="model-start__preview" viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
    {loads}
    {polylines.map((line) => <polyline key={line.id} className={line.truss ? 'model-start__bar model-start__bar--truss' : 'model-start__bar'}
      points={line.points.map((point) => { const p = at(point); return `${p.x},${p.y}`; }).join(' ')} />)}
    {supports}
  </svg>;
}

/**
 * Creación rápida del Modelo 2D: el tipo en un toque, sus pocas medidas con
 * vista previa y «Crear y calcular». El generador completo queda a un clic
 * para quien quiera apoyos, secciones u origen propios.
 */
export function ModelStartCard({ onStart, onGenerate, onDraw, units = 'kN-m' }: {
  onStart: (id: ModelStartId, params: ModelStartParams) => void;
  onGenerate: () => void;
  onDraw: () => void;
  units?: UnitSystemId;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<ModelStartId>('beam-simple');
  const [drafts, setDrafts] = useState<Partial<Record<ModelStartId, Drafts>>>({});
  const defaults = MODEL_START_DEFAULTS[selected];
  const fields = MODEL_START_FIELDS[selected];
  const params = useMemo<ModelStartParams>(() => {
    const own = drafts[selected] ?? {};
    const next = { ...defaults } as Record<ModelStartField, number>;
    for (const field of fields) {
      const text = own[field];
      if (text === undefined) continue;
      const quantity = fieldQuantity(selected, field);
      const value = parseInput(text);
      next[field] = quantity ? fromDisplay(value, units, quantity) : value;
    }
    return next;
  }, [defaults, drafts, fields, selected, units]);
  const valid = modelStartValid(selected, params);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) onStart(selected, params);
  };
  const errorText = (field: ModelStartField) => {
    const error = modelStartFieldError(selected, field, params);
    if (!error) return undefined;
    const quantity = fieldQuantity(selected, field);
    const show = (value: number | undefined) => value === undefined ? '' : `${roundForInput(quantity ? toDisplay(value, units, quantity) : value)}${quantity ? ` ${unitLabel(units, quantity)}` : ''}`;
    return t(`modelStart.error.${error.key}` as TranslationKey, { min: show(error.min), max: show(error.max) });
  };

  return <div className="model-start" data-testid="model-start">
    <section className="model-start__card" aria-labelledby="model-start-title">
      <h2 id="model-start-title">{t('modelStart.title')}</h2>
      <p className="model-start__body">{t('modelStart.body')}</p>
      <div className="model-start__types" role="radiogroup" aria-label={t('modelStart.typeLabel')}>
        {MODEL_STARTS.map((id) => <button key={id} type="button" role="radio" aria-checked={id === selected}
          className={`model-start__type${id === selected ? ' is-selected' : ''}`} onClick={() => setSelected(id)}>
          {COPY[id].glyph}<span>{t(COPY[id].title)}</span>
        </button>)}
      </div>
      <form className="model-start__form" onSubmit={submit} noValidate>
        <StartPreview id={selected} params={params} />
        <div className="model-start__fields">
          {fields.map((field) => {
            const quantity = fieldQuantity(selected, field);
            const own = drafts[selected]?.[field];
            const value = own ?? roundForInput(quantity ? toDisplay(defaults[field], units, quantity) : defaults[field]);
            const error = errorText(field);
            const inputId = `model-start-${field}`;
            return <div key={`${selected}:${field}`} className={`model-start__field${error ? ' has-error' : ''}`}>
              <label htmlFor={inputId}>{t(fieldLabel(selected, field))}</label>
              <span className="model-start__input">
                <input id={inputId} inputMode={quantity ? 'decimal' : 'numeric'} autoComplete="off" value={value}
                  aria-invalid={Boolean(error) || undefined} aria-describedby={error ? `${inputId}-error` : undefined}
                  onChange={(event) => setDrafts((current) => ({ ...current, [selected]: { ...current[selected], [field]: event.target.value } }))} />
                {quantity ? <small>{unitLabel(units, quantity)}</small> : null}
              </span>
              {error ? <small id={`${inputId}-error`} className="model-start__error">{error}</small> : null}
            </div>;
          })}
        </div>
        <p className="model-start__note">{t('modelStart.note')}</p>
        <div className="model-start__actions">
          <Button type="submit" variant="primary" size="touch" disabled={!valid} leadingIcon={<Play size={16} aria-hidden="true" />}>{t('modelStart.create')}</Button>
          <Button type="button" variant="ghost" size="touch" onClick={onDraw}>{t('modelStart.draw')}</Button>
        </div>
      </form>
      <button type="button" className="model-start__advanced" onClick={onGenerate}>
        <span><strong>{t('modelStart.generate')}</strong><small>{t('modelStart.generateHint')}</small></span>
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </section>
  </div>;
}
