import { Plus, Trash2 } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { SegmentedControl, Select } from '../../../design-system/components/controls';
import { LayerToggle, UnitField } from '../../../design-system/components/editor';
import { barsText } from '../../../design/elements/beam';
import { designCode } from '../../../design/elements/codes';
import { MAX_FRAME_BAYS, MAX_FRAME_STORIES, designFrame, type FrameDesignResult } from '../../../design/elements/frame';
import { rebarLabel } from '../../../design/elements/shared';
import { BeamElevation, BeamRebarDetail, BeamSection } from './BeamDrawings';
import { bastionTitle, meters, stirrupText } from './beamModel';
import { ColumnElevation, ColumnSection, InteractionChart } from './ColumnDrawings';
import {
  ActionNote, BarSelect, ChecksList, Disclosure, ErrorsPanel, FieldGroup, GroupSelect, IdentityGroup, LIVE_LOAD_USES, LONG_TERM_DURATIONS, MoreOptions, NumberField, PanelSection,
  RebarList, ReviewList, Summary, TakeoffSection, ValuesTable, Verdict, formatNumber, parseNumber, readStored, splitChecks, useDraftHistory, useStoredDraft,
} from './common';
import { FRAME_DIAGRAMS, FrameElevation, memberLabel, ratioBand, type FrameDiagramKind, type FrameMemberKey } from './FrameDrawings';
import {
  DEFAULT_BAYS, DEFAULT_STORIES, FRAME_DEFAULTS, describeFrame, frameReport, frameSlabLoads, frameToInput, parseBays, parseStories,
  type BayDraft, type StoryDraft,
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

/** Miembro con el cociente mayor: lo que se muestra al abrir. */
const governingMember = (result: FrameDesignResult): FrameMemberKey => {
  const beam = result.beams.reduce((best, item) => item.result.governingRatio > best.result.governingRatio ? item : best);
  const column = result.columns.reduce((best, item) => item.result.governingRatio > best.result.governingRatio ? item : best);
  return column.result.governingRatio > beam.result.governingRatio
    ? { kind: 'column', story: column.story, index: column.line }
    : { kind: 'beam', story: beam.story, index: 0 };
};

const percent = (ratio: number) => Number.isFinite(ratio) ? `${Math.round(ratio * 100)} %` : '—';

/** Matriz de miembros: un renglón por nivel (de arriba abajo) con la viga y cada columna. */
function MemberGrid({ result, selected, onSelect }: { result: FrameDesignResult; selected: FrameMemberKey | null; onSelect: (member: FrameMemberKey) => void }) {
  const lines = result.input.bays.length + 1;
  const isSelected = (key: FrameMemberKey) => Boolean(selected && selected.kind === key.kind && selected.story === key.story && (key.kind === 'beam' || selected.index === key.index));
  return <table className="dw-member-grid" aria-label="Cociente que rige en cada miembro del pórtico">
    <thead><tr><th scope="col">Nivel</th><th scope="col">Viga</th>{Array.from({ length: lines }, (_, line) => <th key={line} scope="col">{`C${line + 1}`}</th>)}</tr></thead>
    <tbody>{[...result.beams].reverse().map((beam) => <tr key={beam.story}>
      <th scope="row">{`N${beam.story + 1}`}</th>
      <td><button type="button" data-band={ratioBand(beam.result.governingRatio)} aria-pressed={isSelected({ kind: 'beam', story: beam.story, index: 0 })}
        aria-label={`Viga del nivel ${beam.story + 1}: ${percent(beam.result.governingRatio)}`}
        onClick={() => onSelect({ kind: 'beam', story: beam.story, index: 0 })}>{percent(beam.result.governingRatio)}</button></td>
      {result.columns.filter((column) => column.story === beam.story).map((column) => <td key={column.line}>
        <button type="button" data-band={ratioBand(column.result.governingRatio)} aria-pressed={isSelected({ kind: 'column', story: column.story, index: column.line })}
          aria-label={`Columna del eje ${column.line + 1}, nivel ${column.story + 1}: ${percent(column.result.governingRatio)}`}
          onClick={() => onSelect({ kind: 'column', story: column.story, index: column.line })}>{percent(column.result.governingRatio)}</button>
      </td>)}
    </tr>)}</tbody>
  </table>;
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
  const { onHistory } = chrome;
  useEffect(() => onHistory?.(history), [history, onHistory]);
  const code = designCode(chrome.code);
  const lateral = draft.lateral === 'yes' && draft.braced !== 'yes';

  const input = useMemo(() => frameToInput(chrome.code, draft, bays, stories), [chrome.code, draft, bays, stories]);
  const deferred = useDeferredValue(input);
  const result = useMemo(() => designFrame(deferred), [deferred]);
  const deferredDraft = useDeferredValue(draft);
  const report = useMemo(() => result.ok ? frameReport(result, deferredDraft) : null, [result, deferredDraft]);
  const outOfScope = report?.outOfScope ?? [];
  const [kind, setKind] = useState<FrameDiagramKind>('ratio');
  const [picked, setPicked] = useState<FrameMemberKey | null>(null);
  const selected: FrameMemberKey | null = !result.ok ? null
    : picked && (picked.kind === 'beam' ? picked.story < result.beams.length : result.columns.some((column) => column.line === picked.index && column.story === picked.story))
      ? picked : governingMember(result);
  const beam = result.ok && selected?.kind === 'beam' ? result.beams[selected.story] : undefined;
  const column = result.ok && selected?.kind === 'column' ? result.columns.find((item) => item.line === selected.index && item.story === selected.story) : undefined;
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

  return <WorkbenchLayout
    chrome={chrome}
    title="Pórtico"
    report={report}
    onReset={() => { reset(); setBays(DEFAULT_BAYS); setStories(DEFAULT_STORIES); setPicked(null); }}
    verdict={result.ok ? { status: result.status, label: verdictLabel(result.status, result.governingRatio, outOfScope.length > 0) } : { status: 'error', label: 'Datos incompletos' }}
    caption={result.ok ? describeFrame(result.input) : undefined}
    inputs={<>
      <IdentityGroup tag={draft.tag} place={draft.place} onTag={set('tag')} onPlace={set('place')} example="P-1" />
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
      <FieldGroup title="Apoyos y marco" columns={1}>
        <div className="dw-end"><span aria-hidden="true">Base</span><SegmentedControl label="Base de las columnas" size="sm" value={draft.base === 'pinned' ? 'pinned' : 'fixed'} onValueChange={set('base')}
          options={[{ value: 'fixed', label: 'Empotrada' }, { value: 'pinned', label: 'Articulada' }]} /></div>
        <div className="dw-end"><span aria-hidden="true">Marco</span><SegmentedControl label="Desplazamiento lateral del marco" size="sm" value={draft.braced === 'yes' ? 'yes' : 'no'} onValueChange={set('braced')}
          options={[{ value: 'no', label: 'Con desplazamiento' }, { value: 'yes', label: 'Arriostrado' }]} /></div>
      </FieldGroup>
      <FieldGroup title="Secciones">
        <NumberField label="Viga b" unit="cm" value={draft.beamWidth} onChange={set('beamWidth')} />
        <NumberField label="Viga h" unit="cm" value={draft.beamHeight} onChange={set('beamHeight')} />
        <NumberField label="Columna b" unit="cm" value={draft.columnWidth} onChange={set('columnWidth')} hint="Fuera del plano" />
        <NumberField label="Columna h" unit="cm" value={draft.columnHeight} onChange={set('columnHeight')} hint="En el plano del marco" />
        <NumberField label="Recubrimiento" unit="cm" value={draft.cover} onChange={set('cover')} />
      </FieldGroup>
      <FieldGroup title="Armado de columnas">
        <BarSelect label="Varilla" value={draft.columnBar} onChange={set('columnBar')} minimumDiameterMm={12.7} />
        <BarSelect label="Estribo" value={draft.tie} onChange={set('tie')} />
        <NumberField label="Barras cara b" unit="pzas" value={draft.barsWidth} onChange={set('barsWidth')} min={2} />
        <NumberField label="Barras cara h" unit="pzas" value={draft.barsDepth} onChange={set('barsDepth')} min={2} />
        <p className="dw-input-note dw-span-all">Las vigas se arman solas por nivel (corridas, bastones y estribos por claro).</p>
      </FieldGroup>
      <FieldGroup title="Materiales">
        <NumberField label="f′c" unit="kg/cm²" value={draft.fc} onChange={set('fc')} />
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
        <NumberField label="Inercia de vigas" unit="× Ig" value={draft.beamInertia} onChange={set('beamInertia')} hint="1 = sección bruta" />
        <NumberField label="Inercia de columnas" unit="× Ig" value={draft.columnInertia} onChange={set('columnInertia')} hint="1 = sección bruta" />
        <UnitField label="k propio" unit="×" value={draft.k} onValueChange={set('k')} placeholder={draft.braced === 'yes' ? '1.0' : 'nomograma'}
          error={kError} hint={kError ? undefined : 'Vacío: lo calcula'} />
        <div className="dw-span-all">
          <LayerToggle label="Vigas con muros frágiles" checked={draft.damages === 'yes'} onCheckedChange={(checked) => set('damages')(checked ? 'yes' : 'no')} />
        </div>
      </MoreOptions>
    </>}
    stage={result.ok ? <>
      <Plate title="Pórtico" wide note={`${result.loadCases} casos superpuestos · ${result.combinations.length} combinaciones`}>
        <div className="dw-span-all dw-frame-diagram">
          <SegmentedControl className="dw-frame-diagram__tabs" label="Diagrama del pórtico" size="sm" value={kind} onValueChange={(value) => setKind(value as FrameDiagramKind)} options={FRAME_DIAGRAMS} />
          <Select className="dw-frame-diagram__select" label="Diagrama del pórtico" value={kind} onChange={(event) => setKind(event.currentTarget.value as FrameDiagramKind)}>
            {FRAME_DIAGRAMS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
        </div>
        <FrameElevation result={result} kind={kind} selected={selected} onSelect={setPicked} />
        <ul className="dw-legend dw-frame-legend">
          {kind === 'ratio' ? <>
            <li data-kind="low">≤ 60 %</li><li data-kind="mid">60–90 %</li><li data-kind="near">90–100 %</li><li data-kind="fail">&gt; 100 %</li>
          </> : kind === 'deformed'
            ? <li data-kind="y">{result.lateral ? 'Deformada con la acción lateral, exagerada' : 'Deformada de servicio (CM + CV), exagerada'}</li>
            : <li data-kind={kind === 'moment' ? 'demand' : 'x'}>{kind === 'moment' ? 'Envolvente del lado de la tensión' : 'Envolvente máxima y mínima'}</li>}
          <li data-kind="nominal">Toca un miembro para ver su diseño</li>
        </ul>
      </Plate>
      {beam ? <>
        <Plate title={`Viga del nivel ${beam.story + 1} · envolventes`} wide note="Demanda del pórtico con la viva alternada">
          <BeamElevation result={beam.result} interactive supports="columns" />
        </Plate>
        <Plate title={`Viga del nivel ${beam.story + 1} · armado`} wide>
          <BeamRebarDetail result={beam.result} supports="columns" />
        </Plate>
        {beam.result.cuts.map((cut) => <Plate key={cut.label} title={cut.label} note={`x = ${meters(cut.xM)} m`}>
          <BeamSection result={beam.result} cut={cut} />
        </Plate>)}
      </> : null}
      {column ? <>
        <Plate title={`Columna del eje ${column.line + 1}, nivel ${column.story + 1} · interacción`} wide note={`${column.states.length} estados concurrentes del pórtico`}>
          <InteractionChart result={column.result} axis="x" cloud={column.states.map((state) => ({ axialKn: state.axialKn, momentKnm: state.designMomentKnm, label: `${state.combination} · ${state.label}` }))} />
          <ul className="dw-legend">
            <li data-kind="x">Diseño en el plano</li>
            <li data-kind="nominal">Nominal</li>
            <li data-kind="cloud">Estados del pórtico</li>
            <li data-kind="demand">Estado que rige</li>
          </ul>
        </Plate>
        <Plate title="Sección"><ColumnSection result={column.result} /></Plate>
        <Plate title="Armado en elevación"><ColumnElevation result={column.result} /></Plate>
      </> : null}
    </> : <ErrorsPanel errors={result.errors} />}
    results={result.ok && report ? <>
      <Verdict status={result.status} ratio={result.governingRatio} title={report.title} outOfScope={outOfScope.length}>
        <Summary rows={[
          { label: 'Vigas', value: percent(Math.max(...result.beams.map((item) => item.result.governingRatio))), tone: 'moment' },
          { label: 'Columnas', value: percent(Math.max(...result.columns.map((item) => item.result.governingRatio))), tone: 'axial' },
          ...(result.lateral ? [{ label: 'Δ/h máx', value: Math.max(...result.stories.map((story) => story.driftRatio)).toFixed(4) }] : []),
          ...(result.input.braced ? [{ label: 'Marco', value: 'Arriostrado' }] : [{ label: code.id === 'ntc-2023' ? 'λest máx' : 'Q máx', value: Math.max(...result.stories.map((story) => story.stabilityIndex)).toFixed(3) }]),
        ]} />
      </Verdict>
      <PanelSection title="Miembros">
        <MemberGrid result={result} selected={selected} onSelect={setPicked} />
        <p className="dw-footnote">Cociente que rige en cada miembro. Elige uno para ver su revisión y su lámina.</p>
      </PanelSection>
      {selected ? <PanelSection title={beam ? `Viga del nivel ${beam.story + 1}` : column ? memberLabel({ kind: 'column', story: column.story, index: column.line }) : 'Miembro'}>
        {beam ? <RebarList items={[
          { kind: 'bar', title: `${barsText(beam.result.continuousTop.continuous)} corridas arriba` },
          { kind: 'bar', title: `${barsText(beam.result.continuousBottom.continuous)} corridas abajo` },
          ...beam.result.bastions.map((bastion) => ({ kind: 'extra' as const, title: bastionTitle(bastion), detail: `${meters(bastion.startM)} → ${meters(bastion.endM)} m` })),
          ...beam.result.spans.map((span, index) => ({ kind: 'stirrup' as const, title: `Claro ${index + 1} · ${stirrupText(span.stirrups, beam.result.stirrupDiameterMm)}` })),
        ]} /> : null}
        {column ? <>
          <RebarList items={[
            { kind: 'bar', title: `${column.result.bars.length} ${rebarLabel(column.result.input.barDiameterMm)}`, detail: `ρ ${formatNumber(column.result.steelRatio * 100, 2)} %` },
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
      <PanelSection title="Revisión del pórtico"><ReviewList checks={report.checks} outOfScope={outOfScope} /></PanelSection>
      <TakeoffSection takeoff={report.takeoff} />
      <Disclosure label="Detalle del cálculo">
        <ValuesTable rows={report.values} />
        {report.tables.slice(2).map((table) => <table key={table.title} className="dw-table" aria-label={table.title}>
          <caption>{table.title}</caption>
          <thead><tr>{table.columns.map((name) => <th key={name} scope="col">{name}</th>)}</tr></thead>
          <tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((cell, position) => position === 0 ? <th key={position} scope="row">{cell}</th> : <td key={position}>{cell}</td>)}</tr>)}</tbody>
        </table>)}
        <ChecksList checks={report.notes} />
      </Disclosure>
    </> : null}
  />;
}
