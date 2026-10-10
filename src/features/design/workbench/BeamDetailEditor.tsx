import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent } from 'react';
import type { BeamDetailDraft } from './beamDetailDraft';
import type { SpanDraft } from './beamModel';
import { parseBeamDetails } from './beamDetailInput';
import { parseNumber } from './formNumbers';

const nextId = () => `d${globalThis.crypto?.randomUUID?.().replaceAll('-', '').slice(0, 12) ?? Math.random().toString(36).slice(2, 14)}`;
const field = (label: string, value: string, onChange: (value: string) => void, unit: string, invalid = false) =>
  <label className="dw-detail-field"><span>{label}<small>{unit}</small></span><input type="text" inputMode="decimal" value={value} aria-label={`${label} (${unit})`} aria-invalid={invalid || undefined} onChange={(event) => onChange(event.currentTarget.value)} /></label>;

function RegionElevation({ details, spans, selected, onSelect, onKeyDown }: {
  details: BeamDetailDraft; spans: readonly SpanDraft[]; selected: string; onSelect: (id: string) => void; onKeyDown: (event: KeyboardEvent<SVGRectElement>, id: string) => void;
}) {
  const parsed = parseBeamDetails(details, spans);
  const lengths = spans.map((span) => Number(span.length.replace(',', '.')));
  const total = lengths.every((length) => Number.isFinite(length) && length > 0) ? lengths.reduce((sum, length) => sum + length, 0) : 0;
  const width = 720;
  const left = 28;
  const right = 692;
  const y = 54;
  const scale = total ? (right - left) / total : 0;
  const region = (id: string, startM: number, endM: number, yy: number, height: number, label: string, className: string) => <rect
    key={id} x={left + startM * scale} y={yy} width={Math.max(2, (endM - startM) * scale)} height={height}
    className={`${className}${selected === id ? ' is-selected' : ''}`} role="button" tabIndex={0} aria-label={label} aria-pressed={selected === id}
    onClick={() => onSelect(id)} onKeyDown={(event) => onKeyDown(event, id)} />;
  let start = 0;
  const spanTicks = lengths.map((length, index) => { const value = start; start += Number.isFinite(length) ? length : 0; return <g key={index}>
    <line x1={left + value * scale} x2={left + value * scale} y1="43" y2="104" className="dw-detail-layout__tick" />
    <text x={left + (value + (Number.isFinite(length) ? length / 2 : 0)) * scale} y="120" textAnchor="middle">Claro {index + 1}</text>
  </g>; });
  return <div className="dw-detail-layout">
    <svg viewBox={`0 0 ${width} 132`} role="group" aria-label="Elevación de regiones físicas">
      <line x1={left} x2={right} y1={y} y2={y} className="dw-detail-layout__beam" />
      {spanTicks}
      <text x={left} y="22">x = 0 m</text><text x={right} y="22" textAnchor="end">x = {total.toFixed(2)} m</text>
      {details.bastions.flatMap((row) => {
        const startM = parseNumber(row.startM);
        const endM = parseNumber(row.endM);
        if (!(Number.isFinite(startM) && Number.isFinite(endM) && startM >= 0 && endM > startM && endM <= total)) return [];
        return [region(row.id, startM, endM, row.bed === 'top' ? 35 : 72, 8, `Bastón ${row.bed === 'top' ? 'superior' : 'inferior'} de ${startM} a ${endM} m`, 'dw-detail-layout__bar')];
      })}
      {parsed.stirrupZones.map((zone, index) => {
        if (!zone) return null;
        const row = details.stirrupZones.find((item) => Number(item.span) - 1 === index)!;
        const startM = lengths.slice(0, index).reduce((sum, length) => sum + length, 0);
        const endM = startM + lengths[index]!;
        const denseEnd = Math.min(zone.endLengthM, lengths[index]! / 2);
        return <g key={`zone-${index}`}>
          {region(`zone-${index}`, startM, startM + denseEnd, 86, 9, `Zona densa de estribos, claro ${index + 1}`, 'dw-detail-layout__dense')}
          {region(`zone-${index}-center`, startM + denseEnd, endM - denseEnd, 86, 9, `Zona central de estribos, claro ${index + 1}`, 'dw-detail-layout__center')}
          {region(`zone-${index}-right`, endM - denseEnd, endM, 86, 9, `Zona densa derecha de estribos, claro ${index + 1}`, 'dw-detail-layout__dense')}
          <title>{row.endSpacingMm} / {row.centerSpacingMm} mm</title>
        </g>;
      })}
    </svg>
    <small>Origen en el extremo izquierdo; bastones en progresiva total y estribos por claro.</small>
  </div>;
}

/** Editor de acciones y regiones físicas; conserva cadenas vacías/incorrectas hasta corregirlas. */
export function BeamDetailEditor({ details, spans, onChange }: {
  details: BeamDetailDraft; spans: readonly SpanDraft[]; onChange: (next: BeamDetailDraft, activateOwn?: 'bastion' | 'zone') => boolean;
}) {
  const [selected, setSelected] = useState('');
  const parsed = useMemo(() => parseBeamDetails(details, spans), [details, spans]);
  const updateLoad = (index: number, patch: Record<string, string>) => onChange({ ...details, loads: details.loads.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) });
  const updateBastion = (index: number, patch: Record<string, string>) => onChange({ ...details, bastions: details.bastions.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) }, 'bastion');
  const updateZone = (index: number, patch: Record<string, string>) => onChange({ ...details, stirrupZones: details.stirrupZones.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) }, 'zone');
  const moveRegion = (event: KeyboardEvent<SVGRectElement>, id: string) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    setSelected(id);
    const direction = event.key === 'ArrowLeft' ? -0.1 : 0.1;
    const index = details.bastions.findIndex((row) => row.id === id);
    if (index >= 0) {
      const row = details.bastions[index]!;
      updateBastion(index, { startM: String(Number(row.startM) + direction), endM: String(Number(row.endM) + direction) });
    }
  };
  const parsedNeedsOwn = details.bastions.length > 0 || details.stirrupZones.length > 0;
  return <div className="dw-beam-details" data-testid="beam-detail-editor">
    <RegionElevation details={details} spans={spans} selected={selected} onSelect={setSelected} onKeyDown={moveRegion} />
    {parsedNeedsOwn ? <p className="dw-beam-details__hint">Las regiones de acero usan armado propio. Revisa los valores de las corridas arriba y abajo.</p> : null}
    <section aria-label="Cargas adicionales">
      <div className="dw-beam-details__heading"><strong>Cargas generales adicionales</strong><button type="button" className="dw-add" onClick={() => onChange({ ...details, loads: [...details.loads, { id: nextId(), span: '1', kind: 'point', category: 'dead', start: '', end: '', startValue: '', endValue: '' }] })}><Plus size={14} aria-hidden="true" />Agregar carga</button></div>
      {details.loads.map((row, index) => <div className="dw-beam-detail-row" key={row.id} aria-label={`Carga adicional ${index + 1}`}>
        <label><span>Tipo</span><select aria-label={`Tipo de carga adicional ${index + 1}`} value={row.kind} onChange={(event) => updateLoad(index, { kind: event.currentTarget.value as typeof row.kind })}><option value="point">Puntual</option><option value="distributed">Distribuida</option></select></label>
        <label><span>Caso</span><select aria-label={`Caso de carga adicional ${index + 1}`} value={row.category} onChange={(event) => updateLoad(index, { category: event.currentTarget.value as typeof row.category })}><option value="dead">CM</option><option value="live">CV</option></select></label>
        {field('Claro', row.span, (span) => updateLoad(index, { span }), 'n.º', !Number.isInteger(parseNumber(row.span)) || parseNumber(row.span) < 1 || parseNumber(row.span) > spans.length)}
        {field('Inicio', row.start, (start) => updateLoad(index, { start }), 'm', !Number.isFinite(parseNumber(row.start)))}
        {row.kind === 'distributed' ? field('Fin', row.end, (end) => updateLoad(index, { end }), 'm', !Number.isFinite(parseNumber(row.end))) : null}
        {field(row.kind === 'point' ? 'P' : 'q inicio', row.startValue, (startValue) => updateLoad(index, { startValue, ...(row.kind === 'point' ? { endValue: startValue } : {}) }), row.kind === 'point' ? 'kN' : 'kN/m', !Number.isFinite(parseNumber(row.startValue)))}
        {row.kind === 'distributed' ? field('q fin', row.endValue, (endValue) => updateLoad(index, { endValue }), 'kN/m', !Number.isFinite(parseNumber(row.endValue))) : null}
        <button type="button" className="dw-icon-button" aria-label={`Quitar carga adicional ${index + 1}`} onClick={() => onChange({ ...details, loads: details.loads.filter((_, rowIndex) => rowIndex !== index) })}><Trash2 size={14} aria-hidden="true" /></button>
      </div>)}
    </section>
    <section aria-label="Bastones propios">
      <div className="dw-beam-details__heading"><strong>Bastones</strong><button type="button" className="dw-add" onClick={() => {
        onChange({ ...details, bastions: [...details.bastions, { id: nextId(), bed: 'top', count: '', diameterMm: '', startM: '', endM: '' }] }, 'bastion');
      }}><Plus size={14} aria-hidden="true" />Agregar bastón</button></div>
      {details.bastions.map((row, index) => <div className="dw-beam-detail-row" key={row.id} aria-label={`Bastón ${index + 1}`}>
        <label><span>Lecho</span><select aria-label={`Lecho bastón ${index + 1}`} value={row.bed} onChange={(event) => updateBastion(index, { bed: event.currentTarget.value as typeof row.bed })}><option value="top">Superior</option><option value="bottom">Inferior</option></select></label>
        {field('Barras', row.count, (count) => updateBastion(index, { count }), 'pzas', !Number.isInteger(parseNumber(row.count)) || parseNumber(row.count) < 1)}
        {field('Diámetro', row.diameterMm, (diameterMm) => updateBastion(index, { diameterMm }), 'mm', !(parseNumber(row.diameterMm) > 0))}
        {field('Inicio x', row.startM, (startM) => updateBastion(index, { startM }), 'm', !Number.isFinite(parseNumber(row.startM)))}
        {field('Fin x', row.endM, (endM) => updateBastion(index, { endM }), 'm', !Number.isFinite(parseNumber(row.endM)))}
        <button type="button" className="dw-icon-button" aria-label={`Quitar bastón ${index + 1}`} onClick={() => onChange({ ...details, bastions: details.bastions.filter((_, rowIndex) => rowIndex !== index) })}><Trash2 size={14} aria-hidden="true" /></button>
      </div>)}
    </section>
    <section aria-label="Zonas de estribos">
      <div className="dw-beam-details__heading"><strong>Zonas de estribos</strong><button type="button" className="dw-add" disabled={details.stirrupZones.length >= spans.length} onClick={() => {
        onChange({ ...details, stirrupZones: [...details.stirrupZones, { span: String(details.stirrupZones.length + 1), endSpacingMm: '', endLengthM: '', centerSpacingMm: '' }] }, 'zone');
      }}><Plus size={14} aria-hidden="true" />Agregar zona</button></div>
      {details.stirrupZones.map((row, index) => <div className="dw-beam-detail-row" key={`zone-${index}`} aria-label={`Zona de estribos ${index + 1}`}>
        <label><span>Claro</span><select aria-label={`Claro zona de estribos ${index + 1}`} value={row.span} onChange={(event) => updateZone(index, { span: event.currentTarget.value })}>{spans.map((_, spanIndex) => <option key={spanIndex} value={String(spanIndex + 1)}>{spanIndex + 1}</option>)}</select></label>
        {field('Separación extremos', row.endSpacingMm, (endSpacingMm) => updateZone(index, { endSpacingMm }), 'mm', !(parseNumber(row.endSpacingMm) >= 50))}
        {field('Longitud desde apoyo', row.endLengthM, (endLengthM) => updateZone(index, { endLengthM }), 'm', !Number.isFinite(parseNumber(row.endLengthM)))}
        {field('Separación centro', row.centerSpacingMm, (centerSpacingMm) => updateZone(index, { centerSpacingMm }), 'mm', !(parseNumber(row.centerSpacingMm) >= 50))}
        <button type="button" className="dw-icon-button" aria-label={`Quitar zona de estribos ${index + 1}`} onClick={() => onChange({ ...details, stirrupZones: details.stirrupZones.filter((_, rowIndex) => rowIndex !== index) })}><Trash2 size={14} aria-hidden="true" /></button>
      </div>)}
    </section>
    {parsed.errors.length ? <ul className="dw-beam-details__errors" aria-label="Errores de regiones">{parsed.errors.map((error, index) => <li key={index}>{error}</li>)}</ul> : null}
  </div>;
}
