import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { SegmentedControl, Select } from '../../../design-system/components/controls';
import { LayerToggle, UnitField } from '../../../design-system/components/editor';
import { barsText } from '../../../design/elements/beam';
import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import { MAX_FRAME_BAYS, MAX_FRAME_STORIES } from '../../../design/elements/frame';
import { rebarLabel } from '../../../design/elements/shared';
import type { ExternalStructureSource, StructureDesignResult } from '../../../design/elements/structure';
import { BeamElevation, BeamRebarDetail, BeamSection } from './BeamDrawings';
import { bastionTitle, meters, stirrupText } from './beamModel';
import { ColumnElevation, ColumnSection, InteractionChart } from './ColumnDrawings';
import {
  ActionNote, BarSelect, ChecksList, Disclosure, ErrorsPanel, FieldGroup, GroupSelect, IdentityGroup, LIVE_LOAD_USES, LONG_TERM_DURATIONS, MoreOptions, NumberField, PanelSection,
  RebarList, ReviewList, Summary, TakeoffSection, ValuesTable, Verdict, formatNumber, parseNumber, readStored, splitChecks, useDraftHistory, useStoredDraft,
} from './common';
import { FRAME_DIAGRAMS, FrameElevation, ratioBand, type FrameDiagramKind } from './FrameDrawings';
import {
  DEFAULT_BAYS, DEFAULT_STORIES, FRAME_DEFAULTS, designFromDraft, describeStructure, frameSlabLoads, parseBays, parseStories, structureReport,
  type BayDraft, type FrameDraft, type StoryDraft, type StructureOutcome,
} from './frameModel';
import { useWorkbenchStorage } from './workbenchStorage';
import { Plate, WorkbenchLayout, verdictLabel, type WorkbenchChrome } from './WorkbenchLayout';

type RowColumn<T> = { field: keyof T & string; label: string; unit: string; min?: number };

function RowsTable<T extends Record<string, string>>({ rows, columns, label, prefix, max, onChange, onAdd, onRemove, addLabel }: {
  rows: readonly T[];
  columns: readonly RowColumn<T>[];
  /** «Claro», «Nivel». */
  label: string;
  /** Prefijo del índice en la tabla («N» para niveles). */
  prefix?: string;
  max: number;
  onChange: (index: number, field: keyof T & string, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  addLabel: string;
}) {
  return <div className="dw-spans" style={{ '--cols': columns.length } as CSSProperties}>
    <div className="dw-spans__row dw-spans__head" aria-hidden="true">
      <span />
      {columns.map((column) => <span key={column.field}>{column.label}<small>{column.unit}</small></span>)}
      <span />
    </div>
    {rows.map((row, index) => <div key={index} className="dw-spans__row" role="group" aria-label={`${label} ${index + 1}`}>
      <span className="dw-spans__index">{`${prefix ?? ''}${index + 1}`}</span>
      {columns.map((column) => {
        const value = row[column.field] ?? '';
        const parsed = parseNumber(value);
        const invalid = !Number.isFinite(parsed) || parsed < (column.min ?? 0);
        return <input key={column.field} type="text" inputMode="decimal" value={value} aria-invalid={invalid || undefined}
          aria-label={`${label} ${index + 1} · ${column.label} (${column.unit})`}
          onChange={(event) => onChange(index, column.field, event.currentTarget.value)} />;
      })}
      <button type="button" className="dw-icon-button" aria-label={`Quitar ${label.toLowerCase()} ${index + 1}`} disabled={rows.length === 1} onClick={() => onRemove(index)}>
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>)}
    {rows.length < max ? <button type="button" className="dw-add" onClick={onAdd}><Plus size={14} aria-hidden="true" />{addLabel}</button> : null}
  </div>;
}

/** Lo que más se acerca al límite: lo que se muestra al abrir. */
const governingDesign = (result: StructureDesignResult): string | null => {
  const items = [
    ...result.beams.map((beam) => ({ id: beam.id, ratio: beam.result.governingRatio })),
    ...result.columns.map((column) => ({ id: column.id, ratio: column.result.governingRatio })),
  ];
  return items.length ? items.reduce((best, item) => item.ratio > best.ratio ? item : best).id : null;
};

const percent = (ratio: number) => Number.isFinite(ratio) ? `${Math.round(ratio * 100)} %` : '—';

/**
 * Miembros por nivel, de arriba hacia abajo: las vigas de cada elevación y las
 * columnas que llegan a ella. Cada ficha abre su revisión y su lámina.
 */
function MemberGrid({ result, selected, onSelect }: { result: StructureDesignResult; selected: string | null; onSelect: (id: string) => void }) {
  const levelOfY = (y: number) => result.levels.findIndex((level) => Math.abs(level - y) < 0.006);
  const rows = result.levels.map((_, level) => ({
    level,
    beams: result.beams.filter((beam) => beam.level === level),
    columns: result.columns.filter((column) => levelOfY(result.stories[column.story]?.yTop ?? Number.NaN) === level),
  })).filter((row) => row.beams.length || row.columns.length).reverse();
  const chip = (id: string, text: string, label: string, ratio: number) => <button key={id} type="button" data-band={ratioBand(ratio)} aria-pressed={selected === id}
    aria-label={`${label}: ${percent(ratio)}`} title={label} onClick={() => onSelect(id)}>
    <span>{text}</span><b>{percent(ratio)}</b>
  </button>;
  return <table className="dw-member-grid" aria-label="Cociente que rige en cada miembro de la estructura">
    <thead><tr><th scope="col">Nivel</th><th scope="col">Vigas y columnas</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.level}>
      <th scope="row">{`N${row.level}`}</th>
      <td><div className="dw-member-grid__chips">
        {row.beams.map((beam, index) => chip(beam.id, row.beams.length > 1 ? `V${String.fromCharCode(65 + index)}` : 'V', beam.label, beam.result.governingRatio))}
        {row.columns.map((column) => chip(column.id, `C${column.axis + 1}`, column.label, column.result.governingRatio))}
      </div></td>
    </tr>)}</tbody>
  </table>;
}

/**
 * Cálculo diferido de la estructura del Modelo 2D: su análisis con el solver
 * general puede tardar un segundo. Se calcula después de pintar y, mientras
 * tanto, se conserva el último resultado.
 */
function useDeferredOutcome(key: string, enabled: boolean, compute: () => StructureOutcome) {
  const [state, setState] = useState<{ key: string; outcome: StructureOutcome } | null>(null);
  const latest = useRef(compute);
  latest.current = compute;
  useEffect(() => {
    if (!enabled) return undefined;
    const handle = window.setTimeout(() => setState({ key, outcome: latest.current() }), 30);
    return () => window.clearTimeout(handle);
  }, [key, enabled]);
  return enabled ? { outcome: state?.outcome ?? null, pending: state?.key !== key } : { outcome: null, pending: false };
}

function ModelSummary({ modelSource, onOpenModel, fcFromModel }: { modelSource: ExternalStructureSource | null; onOpenModel?: () => void; fcFromModel: boolean }) {
  if (!modelSource) {
    return <div className="dw-model-card" data-state="empty">
      <strong>Sin Modelo 2D</strong>
      <p>Abre el taller desde un proyecto para diseñar su modelo, o genera un pórtico aquí.</p>
    </div>;
  }
  const { summary } = modelSource;
  return <div className="dw-model-card" data-state={modelSource.errors.length ? 'error' : 'ready'}>
    <strong>{modelSource.label || 'Modelo 2D'}</strong>
    <dl>
      <div><dt>Vigas</dt><dd>{summary.beams}</dd></div>
      <div><dt>Columnas</dt><dd>{summary.columns}</dd></div>
      <div><dt>Sin diseñar</dt><dd>{summary.skipped}</dd></div>
      <div><dt>Casos</dt><dd>{`${summary.deadCases} CM · ${summary.lateralCases} lateral · CV en ${summary.liveCases} ${summary.liveCases === 1 ? 'parte' : 'partes'}`}</dd></div>
    </dl>
    {summary.ignoredCases.length ? <p>{`No entran: ${summary.ignoredCases.join(', ')}.`}</p> : null}
    <p>{fcFromModel ? `f′c del material del modelo: ${formatNumber(modelSource.fcMpa ?? 0, 1)} MPa.` : 'El modelo no declara f′c: se usa el de Materiales.'} Geometría, secciones y cargas se editan en el Modelo 2D.</p>
    {onOpenModel ? <button type="button" className="dw-inline-action" onClick={onOpenModel}><ExternalLink size={13} aria-hidden="true" />Abrir el Modelo 2D</button> : null}
  </div>;
}

export function FrameWorkbench({ chrome }: { chrome: WorkbenchChrome }) {
  const { draft, set, reset, replace } = useStoredDraft('frame', FRAME_DEFAULTS);
  const storage = useWorkbenchStorage();
  const [bays, setBays] = useState<BayDraft[]>(() => readStored(storage, 'frame-bays', parseBays, DEFAULT_BAYS));
  const [stories, setStories] = useState<StoryDraft[]>(() => readStored(storage, 'frame-stories', parseStories, DEFAULT_STORIES));
  useEffect(() => storage.write('frame-bays', bays.map((bay) => ({ ...bay }))), [bays, storage]);
  useEffect(() => storage.write('frame-stories', stories.map((story) => ({ ...story }))), [stories, storage]);
  const snapshot = useMemo(() => ({ draft, bays, stories }), [draft, bays, stories]);
  const applySnapshot = useCallback((next: typeof snapshot) => { replace(next.draft); setBays(next.bays); setStories(next.stories); }, [replace]);
  const history = useDraftHistory(snapshot, applySnapshot);
  const { onHistory, startSource, modelSource = null, onOpenModel } = chrome;
  useEffect(() => onHistory?.(history), [history, onHistory]);
  // «Diseñar el modelo» desde fuera abre la mesa con esa fuente.
  useEffect(() => {
    if (startSource && startSource !== draft.source) replace({ ...draft, source: startSource });
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const code = designCode(chrome.code);
  const fromModel = draft.source === 'model';
  const lateral = draft.lateral === 'yes' && draft.braced !== 'yes';

  // Pórtico generado: cálculo inmediato (diferido por React). Modelo 2D: cálculo después de pintar.
  const inputs = useMemo(() => ({ code: chrome.code, draft, bays, stories }), [chrome.code, draft, bays, stories]);
  const deferredInputs = useDeferredValue(inputs);
  const frameOutcome = useMemo(() => fromModel ? null : designFromDraft(deferredInputs.code, deferredInputs.draft as FrameDraft, deferredInputs.bays, deferredInputs.stories),
    [fromModel, deferredInputs]);
  const modelKey = JSON.stringify([chrome.code, draft, modelSource?.revision ?? null]);
  const model = useDeferredOutcome(modelKey, fromModel, () => designFromDraft(chrome.code as DesignCodeId, draft, bays, stories, modelSource));
  const outcome: StructureOutcome | null = fromModel ? model.outcome : frameOutcome;
  const result = outcome?.ok ? outcome.result : null;
  const report = useMemo(() => outcome?.ok ? structureReport(outcome, deferredInputs.draft as FrameDraft) : null, [outcome, deferredInputs.draft]);
  const outOfScope = report?.outOfScope ?? [];
  const [kind, setKind] = useState<FrameDiagramKind>('ratio');
  const [picked, setPicked] = useState<string | null>(null);
  const selected = !result ? null
    : picked && (result.beams.some((beam) => beam.id === picked) || result.columns.some((column) => column.id === picked)) ? picked : governingDesign(result);
  const beam = result?.beams.find((item) => item.id === selected);
  const column = result?.columns.find((item) => item.id === selected);
  const [loadNote, setLoadNote] = useState<string | null>(null);
  const slab = frameSlabLoads(draft);
  const applySlab = () => {
    if (!slab) return;
    setStories((current) => current.map((story) => ({ ...story, dead: String(slab.dead), live: String(slab.live) })));
    setLoadNote(`Aplicado a ${stories.length === 1 ? 'el nivel' : `los ${stories.length} niveles`}: CM ${slab.dead} · CV ${slab.live} kN/m.`);
  };
  const kError = draft.k.trim() !== '' && !(parseNumber(draft.k) > 0) ? 'Mayor que cero, o vacío para calcularlo' : undefined;
  const storyColumns: RowColumn<StoryDraft>[] = [
    { field: 'height', label: 'h', unit: 'm', min: 0.5 },
    { field: 'dead', label: 'CM', unit: 'kN/m' },
    { field: 'live', label: 'CV', unit: 'kN/m' },
    ...(lateral ? [{ field: 'lateral' as const, label: 'F', unit: 'kN' }] : []),
  ];
  const memberChecks = beam ? splitChecks(beam.result.checks) : column ? splitChecks(column.result.checks) : [[], []] as const;
  const fcFromModel = fromModel && modelSource?.fcMpa !== null && modelSource?.fcMpa !== undefined;
  const name = fromModel ? 'Modelo 2D' : 'Pórtico';
  const supports = result?.columns.length ? 'columns' as const : 'ideal' as const;
  const verdict = result
    ? { status: result.status, label: verdictLabel(result.status, result.governingRatio, outOfScope.length > 0) }
    : { status: 'error' as const, label: fromModel && model.pending ? 'Analizando el modelo…' : 'Datos incompletos' };

  return <WorkbenchLayout
    chrome={chrome}
    title="Estructura"
    report={report}
    onReset={() => { reset(); setBays(DEFAULT_BAYS); setStories(DEFAULT_STORIES); setPicked(null); }}
    verdict={verdict}
    caption={outcome?.ok ? describeStructure(outcome) : undefined}
    inputs={<>
      <IdentityGroup tag={draft.tag} place={draft.place} onTag={set('tag')} onPlace={set('place')} example="P-1" />
      <FieldGroup title="Origen de la estructura" columns={1}>
        <SegmentedControl label="Origen de la estructura" size="sm" value={fromModel ? 'model' : 'frame'} onValueChange={(value) => { set('source')(value); setPicked(null); }}
          options={[{ value: 'frame', label: 'Pórtico generado' }, { value: 'model', label: 'Modelo 2D' }]} />
        {fromModel ? <ModelSummary modelSource={modelSource} fcFromModel={fcFromModel} {...(onOpenModel ? { onOpenModel } : {})} /> : null}
      </FieldGroup>
      {fromModel ? null : <>
        <FieldGroup title="Claros entre ejes" columns={1}>
          <RowsTable rows={bays} columns={[{ field: 'length', label: 'L', unit: 'm', min: 0.5 }]} label="Claro" max={MAX_FRAME_BAYS} addLabel="Agregar claro"
            onChange={(index, field, value) => setBays((current) => current.map((bay, position) => position === index ? { ...bay, [field]: value } : bay))}
            onAdd={() => setBays((current) => [...current, { ...current[current.length - 1]! }])}
            onRemove={(index) => setBays((current) => current.filter((_, position) => position !== index))} />
        </FieldGroup>
        <FieldGroup title="Niveles y cargas en vigas" columns={1}>
          <RowsTable rows={stories} columns={storyColumns} label="Nivel" prefix="N" max={MAX_FRAME_STORIES} addLabel="Agregar nivel"
            onChange={(index, field, value) => setStories((current) => current.map((story, position) => position === index ? { ...story, [field]: value } : story))}
            onAdd={() => setStories((current) => [...current, { ...current[current.length - 1]! }])}
            onRemove={(index) => setStories((current) => current.filter((_, position) => position !== index))} />
          <p className="dw-input-note">N1 es el primer nivel sobre la base. CM y CV son de servicio sobre las vigas, sin su peso propio{lateral ? '; F es la fuerza lateral de diseño del nivel (sismo ya reducido o viento)' : ''}.</p>
          <Disclosure label="Cargas desde la losa">
            <div className="dw-group__grid" data-columns={2}>
              <NumberField label="Ancho tributario" unit="m" value={draft.tributary} onChange={set('tributary')} />
              <NumberField label="Muros sobre la viga" unit="kN/m" value={draft.wallLoad} onChange={set('wallLoad')} />
              <NumberField label="Muerta de la losa" unit="kN/m²" value={draft.slabDead} onChange={set('slabDead')} hint="Losa, acabados, instalaciones" />
              <NumberField label="Viva de la losa" unit="kN/m²" value={draft.slabLive} onChange={set('slabLive')} hint={code.id === 'ntc-2023' ? 'NTC habitación: Wm 1.9' : 'Según el destino'} />
            </div>
            <div className="dw-slab-apply">
              <span>{slab ? `CM ${slab.dead} · CV ${slab.live} kN/m` : 'Datos incompletos'}</span>
              <button type="button" className="dw-inline-action" disabled={!slab} onClick={applySlab}>Aplicar a los niveles</button>
            </div>
            <ActionNote text={loadNote} />
          </Disclosure>
          <LayerToggle label="Fuerzas laterales (sismo o viento)" checked={draft.lateral === 'yes'} disabled={draft.braced === 'yes'}
            onCheckedChange={(checked) => set('lateral')(checked ? 'yes' : 'no')} />
          <LayerToggle label="Sumar peso propio" checked={draft.selfWeight === 'yes'} onCheckedChange={(checked) => set('selfWeight')(checked ? 'yes' : 'no')} />
        </FieldGroup>
      </>}
      <FieldGroup title={fromModel ? 'Marco' : 'Apoyos y marco'} columns={1}>
        {fromModel ? null : <div className="dw-end"><span aria-hidden="true">Base</span><SegmentedControl label="Base de las columnas" size="sm" value={draft.base === 'pinned' ? 'pinned' : 'fixed'} onValueChange={set('base')}
          options={[{ value: 'fixed', label: 'Empotrada' }, { value: 'pinned', label: 'Articulada' }]} /></div>}
        <div className="dw-end"><span aria-hidden="true">Marco</span><SegmentedControl label="Desplazamiento lateral del marco" size="sm" value={draft.braced === 'yes' ? 'yes' : 'no'} onValueChange={set('braced')}
          options={[{ value: 'no', label: 'Con desplazamiento' }, { value: 'yes', label: 'Arriostrado' }]} /></div>
        {fromModel ? <p className="dw-input-note">Arriostrado: otro sistema (muros, contravientos) impide el desplazamiento; no se amplifican momentos por desplazamiento ni entran las acciones laterales.</p> : null}
      </FieldGroup>
      {fromModel ? null : <FieldGroup title="Secciones">
        <NumberField label="Viga b" unit="cm" value={draft.beamWidth} onChange={set('beamWidth')} />
        <NumberField label="Viga h" unit="cm" value={draft.beamHeight} onChange={set('beamHeight')} />
        <NumberField label="Columna b" unit="cm" value={draft.columnWidth} onChange={set('columnWidth')} hint="Fuera del plano" />
        <NumberField label="Columna h" unit="cm" value={draft.columnHeight} onChange={set('columnHeight')} hint="En el plano del marco" />
        <NumberField label="Recubrimiento" unit="cm" value={draft.cover} onChange={set('cover')} />
      </FieldGroup>}
      <FieldGroup title="Armado de columnas">
        <BarSelect label="Varilla" value={draft.columnBar} onChange={set('columnBar')} minimumDiameterMm={12.7} />
        <BarSelect label="Estribo" value={draft.tie} onChange={set('tie')} />
        <NumberField label="Barras cara b" unit="pzas" value={draft.barsWidth} onChange={set('barsWidth')} min={2} />
        <NumberField label="Barras cara h" unit="pzas" value={draft.barsDepth} onChange={set('barsDepth')} min={2} />
        {fromModel ? <NumberField label="Recubrimiento" unit="cm" value={draft.cover} onChange={set('cover')} /> : null}
        <p className="dw-input-note dw-span-all">Las vigas se arman solas por línea continua (corridas, bastones y estribos por tramo).</p>
      </FieldGroup>
      <FieldGroup title="Materiales">
        {fcFromModel ? null : <NumberField label="f′c" unit="kg/cm²" value={draft.fc} onChange={set('fc')} />}
        <NumberField label="fy" unit="kg/cm²" value={draft.fy} onChange={set('fy')} />
      </FieldGroup>
      <MoreOptions>
        {code.usesStructureGroup || code.column.geometryLimits ? <div className="dw-span-all">
          <GroupSelect value={draft.group} onChange={set('group')} groups={[
            { value: 'B2', label: code.usesStructureGroup ? 'Subgrupo B2 · 1.3 CM + 1.5 CV' : 'Subgrupo B2' },
            { value: 'B1', label: code.usesStructureGroup ? 'Subgrupo B1 · 1.3 CM + 1.5 CV' : 'Subgrupo B1' },
            { value: 'A', label: code.usesStructureGroup ? 'Grupo A · 1.5 CM + 1.7 CV' : 'Grupo A' },
          ]} />
        </div> : null}
        <div className="dw-span-all">
          {code.sustainedLive === 'use'
            ? <Select label="Destino" value={draft.use} onChange={(event) => set('use')(event.currentTarget.value)}>
              {LIVE_LOAD_USES.map((use) => <option key={use.value} value={use.value}>{use.label}</option>)}
            </Select>
            : <NumberField label="Carga viva sostenida" unit="%" value={draft.sustained} onChange={set('sustained')} />}
        </div>
        <div className="dw-span-all">
          <Select label="Duración de la carga sostenida" value={draft.duration} onChange={(event) => set('duration')(event.currentTarget.value)}>
            {LONG_TERM_DURATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
        </div>
        <BarSelect label="Varilla de vigas" value={draft.beamBar} onChange={set('beamBar')} allowAuto minimumDiameterMm={12.7} />
        <BarSelect label="Estribo de vigas" value={draft.stirrup} onChange={set('stirrup')} allowAuto />
        <NumberField label="fy estribos" unit="kg/cm²" value={draft.fyv} onChange={set('fyv')} />
        <NumberField label="Agregado" unit="mm" value={draft.aggregate} onChange={set('aggregate')} />
        {fromModel ? null : <>
          <NumberField label="Inercia de vigas" unit="× Ig" value={draft.beamInertia} onChange={set('beamInertia')} hint="1 = sección bruta" />
          <NumberField label="Inercia de columnas" unit="× Ig" value={draft.columnInertia} onChange={set('columnInertia')} hint="1 = sección bruta" />
        </>}
        <UnitField label="k propio" unit="×" value={draft.k} onValueChange={set('k')} placeholder={draft.braced === 'yes' ? '1.0' : 'nomograma'}
          error={kError} hint={kError ? undefined : 'Vacío: lo calcula'} />
        <div className="dw-span-all">
          <LayerToggle label="Vigas con muros frágiles" checked={draft.damages === 'yes'} onCheckedChange={(checked) => set('damages')(checked ? 'yes' : 'no')} />
        </div>
      </MoreOptions>
    </>}
    stage={result ? <>
      <Plate title={name} wide note={`${result.loadCases} casos superpuestos · ${result.combinations.length} combinaciones${fromModel && model.pending ? ' · recalculando…' : ''}`}>
        <div className="dw-span-all dw-frame-diagram">
          <SegmentedControl className="dw-frame-diagram__tabs" label="Diagrama de la estructura" size="sm" value={kind} onValueChange={(value) => setKind(value as FrameDiagramKind)} options={FRAME_DIAGRAMS} />
          <Select className="dw-frame-diagram__select" label="Diagrama de la estructura" value={kind} onChange={(event) => setKind(event.currentTarget.value as FrameDiagramKind)}>
            {FRAME_DIAGRAMS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
        </div>
        <FrameElevation result={result} kind={kind} selected={selected} onSelect={setPicked} />
        <ul className="dw-legend dw-frame-legend">
          {kind === 'ratio' ? <>
            <li data-kind="low">≤ 60 %</li><li data-kind="mid">60–90 %</li><li data-kind="near">90–100 %</li><li data-kind="fail">&gt; 100 %</li>
            {result.skipped.length ? <li data-kind="skip">Sin diseñar</li> : null}
          </> : kind === 'deformed'
            ? <li data-kind="y">{result.lateral ? 'Deformada con la acción lateral, exagerada' : 'Deformada de servicio (CM + CV), exagerada'}</li>
            : <li data-kind={kind === 'moment' ? 'demand' : 'x'}>{kind === 'moment' ? 'Envolvente del lado de la tensión' : 'Envolvente máxima y mínima'}</li>}
          <li data-kind="nominal">Toca una viga o columna para ver su diseño</li>
        </ul>
      </Plate>
      {beam ? <>
        <Plate title={`${beam.label} · envolventes`} wide note={fromModel ? 'Demanda del Modelo 2D con la viva alternada por barra' : 'Demanda del pórtico con la viva alternada'}>
          <BeamElevation result={beam.result} interactive supports={supports} />
        </Plate>
        <Plate title={`${beam.label} · armado`} wide>
          <BeamRebarDetail result={beam.result} supports={supports} />
        </Plate>
        {beam.result.cuts.map((cut) => <Plate key={cut.label} title={cut.label} note={`x = ${meters(cut.xM)} m`}>
          <BeamSection result={beam.result} cut={cut} />
        </Plate>)}
      </> : null}
      {column ? <>
        <Plate title={`${column.label} · interacción`} wide note={`${column.states.length} estados concurrentes`}>
          <InteractionChart result={column.result} axis="x" cloud={column.states.map((state) => ({ axialKn: state.axialKn, momentKnm: state.designMomentKnm, label: `${state.combination} · ${state.label}` }))} />
          <ul className="dw-legend">
            <li data-kind="x">Diseño en el plano</li>
            <li data-kind="nominal">Nominal</li>
            <li data-kind="cloud">Estados de la estructura</li>
            <li data-kind="demand">Estado que rige</li>
          </ul>
        </Plate>
        <Plate title="Sección"><ColumnSection result={column.result} /></Plate>
        <Plate title="Armado en elevación"><ColumnElevation result={column.result} /></Plate>
      </> : null}
    </> : fromModel && model.pending
      ? <div className="dw-model-wait" role="status"><span className="dw-model-wait__dot" aria-hidden="true" />Analizando el Modelo 2D con el solver de la app…</div>
      : <div className="dw-model-errors">
        <ErrorsPanel errors={outcome && !outcome.ok ? outcome.errors : []} />
        {fromModel && onOpenModel ? <button type="button" className="dw-inline-action" onClick={onOpenModel}><ExternalLink size={13} aria-hidden="true" />Abrir el Modelo 2D</button> : null}
      </div>}
    results={result && report ? <>
      <Verdict status={result.status} ratio={result.governingRatio} title={report.title} outOfScope={outOfScope.length}>
        <Summary rows={[
          { label: 'Vigas', value: result.beams.length ? percent(Math.max(...result.beams.map((item) => item.result.governingRatio))) : '—', tone: 'moment' },
          { label: 'Columnas', value: result.columns.length ? percent(Math.max(...result.columns.map((item) => item.result.governingRatio))) : '—', tone: 'axial' },
          ...(result.lateral && result.stories.length ? [{ label: 'Δ/h máx', value: Math.max(...result.stories.map((story) => story.driftRatio)).toFixed(4) }] : []),
          ...(result.braced ? [{ label: 'Marco', value: 'Arriostrado' }]
            : result.stories.length ? [{ label: code.id === 'ntc-2023' ? 'λest máx' : 'Q máx', value: Math.max(...result.stories.map((story) => story.stabilityIndex)).toFixed(3) }] : []),
        ]} />
      </Verdict>
      <PanelSection title="Miembros">
        <MemberGrid result={result} selected={selected} onSelect={setPicked} />
        <p className="dw-footnote">Cociente que rige en cada viga y columna. Elige uno para ver su revisión y su lámina.{result.skipped.length ? ` ${result.skipped.length} ${result.skipped.length === 1 ? 'barra no se diseña' : 'barras no se diseñan'} en concreto (ver revisión).` : ''}</p>
      </PanelSection>
      {beam || column ? <PanelSection title={beam?.label ?? column!.label}>
        {beam ? <RebarList items={[
          { kind: 'bar', title: `${barsText(beam.result.continuousTop.continuous)} corridas arriba` },
          { kind: 'bar', title: `${barsText(beam.result.continuousBottom.continuous)} corridas abajo` },
          ...beam.result.bastions.map((bastion) => ({ kind: 'extra' as const, title: bastionTitle(bastion), detail: `${meters(bastion.startM)} → ${meters(bastion.endM)} m` })),
          ...beam.result.spans.map((span, index) => ({ kind: 'stirrup' as const, title: `Tramo ${index + 1} · ${stirrupText(span.stirrups, beam.result.stirrupDiameterMm)}` })),
        ]} /> : null}
        {column ? <>
          <RebarList items={[
            { kind: 'bar', title: `${column.result.bars.length} ${rebarLabel(column.result.input.barDiameterMm)}`, detail: `ρ ${formatNumber(column.result.steelRatio * 100, 2)} % · ${formatNumber(column.result.input.widthMm / 10, 0)}×${formatNumber(column.result.input.depthMm / 10, 0)} cm` },
            { kind: 'stirrup', title: `E ${rebarLabel(column.result.ties.diameterMm)} @ ${formatNumber(column.result.ties.centerSpacingMm / 10, 1)} cm`,
              detail: column.result.ties.endLengthMm > 0 ? `@ ${formatNumber(column.result.ties.endSpacingMm / 10, 1)} cm en Lo = ${formatNumber(column.result.ties.endLengthMm / 10, 0)} cm` : undefined },
          ]} />
          <Summary rows={[
            { label: 'Estado que rige', value: column.states[column.governingState]!.label },
            { label: 'Pu', value: `${formatNumber(column.states[column.governingState]!.axialKn, 0)} kN`, tone: 'axial' },
            { label: 'Mc', value: `${formatNumber(column.states[column.governingState]!.designMomentKnm)} kN·m`, tone: 'moment' },
            { label: 'k · ψ', value: `${formatNumber(column.effectiveLengthFactor, 2)} · ${formatNumber(column.psiTop, 2)}/${formatNumber(column.psiBottom, 2)}` },
          ]} />
        </> : null}
        <ReviewList checks={memberChecks[0]} outOfScope={[]} />
        {column ? <Disclosure label={`Estados de la columna (${column.states.length})`}>
          <table className="dw-table" aria-label="Estados concurrentes de la columna (kN, kN·m)">
            <thead><tr><th scope="col">Combinación</th><th scope="col">Pu</th><th scope="col">M sup</th><th scope="col">M inf</th><th scope="col">Mc</th><th scope="col">Rige</th></tr></thead>
            <tbody>{column.states.map((state, index) => <tr key={index} data-active={index === column.governingState || undefined}>
              <th scope="row">{`${state.combination} · ${state.label}`}</th>
              <td>{formatNumber(state.axialKn, 0)}</td>
              <td>{formatNumber(state.topKnm)}</td>
              <td>{formatNumber(state.bottomKnm)}</td>
              <td>{formatNumber(state.designMomentKnm)}</td>
              <td data-status={state.status === 'fail' ? 'fail' : undefined}>{percent(state.ratio)}</td>
            </tr>)}</tbody>
          </table>
        </Disclosure> : null}
        {memberChecks[1].length ? <Disclosure label="Notas del miembro"><ChecksList checks={memberChecks[1]} /></Disclosure> : null}
      </PanelSection> : null}
      <PanelSection title={`Revisión de ${fromModel ? 'la estructura' : 'el pórtico'}`}><ReviewList checks={report.checks} outOfScope={outOfScope} /></PanelSection>
      <TakeoffSection takeoff={report.takeoff} />
      <Disclosure label="Detalle del cálculo">
        <ValuesTable rows={report.values} />
        {report.tables.slice(2).map((table) => <table key={table.title} className="dw-table" aria-label={table.title}>
          <caption>{table.title}</caption>
          <thead><tr>{table.columns.map((column2) => <th key={column2} scope="col">{column2}</th>)}</tr></thead>
          <tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((cell, position) => position === 0 ? <th key={position} scope="row">{cell}</th> : <td key={position}>{cell}</td>)}</tr>)}</tbody>
        </table>)}
        <ChecksList checks={report.notes} />
      </Disclosure>
    </> : null}
  />;
}
