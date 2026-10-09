import { ArrowRightLeft, Box, Building2, LayoutGrid, PenLine, Plus, Trash2 } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { SegmentedControl, Select } from '../../../design-system/components/controls';
import { LayerToggle, UnitField } from '../../../design-system/components/editor';
import { barsText } from '../../../design/elements/beam';
import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import { MAX_FRAME_BAYS, MAX_FRAME_STORIES } from '../../../design/elements/frame';
import { rebarLabel } from '../../../design/elements/shared';
import type { ConcreteFrameSpec } from '../../../data/concreteFrame';
import type { ExternalStructureSource, StructureDesignResult } from '../../../design/elements/structure';
import { BeamElevation, BeamRebarDetail, BeamSection } from './BeamDrawings';
import { bastionTitle, meters, stirrupText } from './beamModel';
import { ColumnElevation, ColumnSection, InteractionChart } from './ColumnDrawings';
import {
  ActionNote, BarSelect, InlineAction, ChecksList, Disclosure, ErrorsPanel, FieldGroup, GroupSelect, IdentityGroup, LIVE_LOAD_USES, LONG_TERM_DURATIONS, MoreOptions, NumberField, PanelSection,
  RebarList, ReviewList, Summary, TakeoffSection, ValuesTable, Verdict, formatNumber, parseNumber, readStored, splitChecks, useDraftHistory, useStoredDraft,
} from './common';
import { FRAME_DIAGRAMS, FrameElevation, ratioBand, type FrameDiagramKind } from './FrameDrawings';
import {
  DEFAULT_BAYS, DEFAULT_STORIES, FRAME_DEFAULTS, FRAME_LEGACY, axisOf, designFromDraftAsync, designFromDraft, designOfMember, memberIdsOf, plural, externalFor, frameModelSpec, fromProjectModel, describeStructure, frameSlabLoads, parseBays, parseStories, structureReport,
  type BayDraft, type FrameDraft, type StoryDraft, type StructureOutcome,
} from './frameModel';
import { afterTransition } from '../../../design-system/afterTransition';
import { BuildingAxes } from './BuildingAxes';
import { frameConcreteVolume, frameProposalStories, proposeFrameSections, proposeModelSections, type ProposalStep, type SectionProposal } from './frameProposal';
import { startProposalWorker } from './proposalWorker';
import { useWorkbenchStorage } from './workbenchStorage';
import { Plate, WorkbenchLayout, verdictLabel, type WorkbenchChrome } from './WorkbenchLayout';
import { MaterialFields } from './MaterialFields';

type RowColumn<T> = { field: keyof T & string; label: string; unit: string; min?: number };

function RowsTable<T extends Record<string, string | undefined>>({ rows, columns, label, prefix, max, onChange, onAdd, onRemove, addLabel }: {
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
  const chip = (id: string, text: string, label: string, ratio: number, status: 'pass' | 'warning' | 'fail' = 'pass') => <button key={id} type="button" data-band={ratioBand(ratio, status)} aria-pressed={selected === id}
    aria-label={`${label}: ${percent(ratio)}${status === 'warning' ? ', revisión pendiente' : ''}`} title={`${label}${status === 'warning' ? ' · revisión pendiente' : ''}`} onClick={() => onSelect(id)}>
    <span>{text}</span><b>{`${percent(ratio)}${status === 'warning' ? '*' : ''}`}</b>
  </button>;
  return <table className="dw-member-grid" aria-label="Cociente que rige en cada miembro de la estructura">
    <thead><tr><th scope="col">Nivel</th><th scope="col">Vigas y columnas</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.level}>
      <th scope="row">{`N${row.level}`}</th>
      <td><div className="dw-member-grid__chips">
        {row.beams.map((beam, index) => chip(beam.id, row.beams.length > 1 ? `V${String.fromCharCode(65 + index)}` : 'V', beam.label, beam.result.governingRatio, beam.result.status))}
        {row.columns.map((column) => chip(column.id, `C${column.axisLabel}`, column.label, column.result.governingRatio, column.result.status))}
      </div></td>
    </tr>)}</tbody>
  </table>;
}

/**
 * Cálculo diferido de la estructura de un modelo del proyecto (2D o un eje del
 * 3D): su análisis con el solver general puede tardar un segundo. Se calcula después de pintar y, mientras
 * tanto, no se publica un resultado de entradas anteriores.
 */
function useDeferredOutcome(key: string, enabled: boolean, compute: (signal: AbortSignal) => StructureOutcome | Promise<StructureOutcome>) {
  const [state, setState] = useState<{ key: string; outcome: StructureOutcome } | null>(null);
  const latest = useRef(compute);
  latest.current = compute;
  useEffect(() => {
    if (!enabled) return undefined;
    // Después de la transición de modo: el cálculo no entrecorta la animación.
    const controller = new AbortController();
    const computeForKey = latest.current;
    const cancel = afterTransition(() => {
      void Promise.resolve().then(() => computeForKey(controller.signal)).then((outcome) => {
        if (!controller.signal.aborted) setState({key,outcome});
      }).catch((error:unknown) => {
        if (!controller.signal.aborted) setState({key,outcome:{ok:false,errors:[error instanceof Error ? error.message : 'No se pudo diseñar.']}});
      });
    });
    return () => {controller.abort();cancel();};
  }, [key, enabled]);
  return enabled ? { outcome: state?.key === key ? state.outcome : null, pending: state?.key !== key } : { outcome: null, pending: false };
}

/**
 * Pórtico rápido → Modelo 2D: lo que se probó aquí se escribe en el modelo con
 * sus casos y cargas, como un cambio que «Deshacer» revierte en Modelo. Si el
 * modelo ya tiene barras, se pide confirmación antes de reemplazarlo.
 */
function QuickFrameCard({ spec, modelMembers, onCreate }: { spec: ConcreteFrameSpec | null; modelMembers: number; onCreate: (spec: ConcreteFrameSpec) => void }) {
  const [confirming, setConfirming] = useState(false);
  const apply = () => { if (spec) { setConfirming(false); onCreate(spec); } };
  return <div className="dw-model-card" data-state="ready">
    <strong>Pórtico rápido</strong>
    <p>Crea un modelo 2D con este pórtico y sus cargas.</p>
    {confirming
      ? <div className="dw-model-confirm" role="group" aria-label="Confirmar reemplazo del modelo">
        <p>{`Reemplaza el modelo actual (${modelMembers} ${modelMembers === 1 ? 'barra' : 'barras'}). En Modelo, «Deshacer» lo recupera.`}</p>
        <div>
          <button type="button" className="dw-inline-action" onClick={apply}>Reemplazar el modelo</button>
          <button type="button" className="dw-inline-action" onClick={() => setConfirming(false)}>Cancelar</button>
        </div>
      </div>
      : <button type="button" className="dw-inline-action" disabled={!spec} onClick={() => modelMembers > 0 ? setConfirming(true) : apply()}>
        <ArrowRightLeft size={13} aria-hidden="true" />Pasar al modelo
      </button>}
  </div>;
}

/** «Columna del eje B» → «columna del eje B»: sólo la inicial, los rótulos de la rejilla se conservan. */
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

function ModelSummary({ modelSource, onOpenModel, fcFromModel, space = false }: { modelSource: ExternalStructureSource | null; onOpenModel?: () => void; fcFromModel: boolean; space?: boolean }) {
  const edit = onOpenModel ? <button type="button" className="dw-inline-action" onClick={onOpenModel}>
    {space ? <Box size={13} aria-hidden="true" /> : <PenLine size={13} aria-hidden="true" />}{space ? 'Editar en 3D' : 'Editar en Modelo'}
  </button> : null;
  if (!modelSource) {
    return <div className="dw-model-card" data-state="empty">
      <strong>{space ? 'Sin Modelo 3D' : 'Sin Modelo 2D'}</strong>
      <p>{space
        ? 'Crea un modelo en 3D para diseñar sus ejes.'
        : 'Crea un marco en 2D o elige Pórtico rápido.'}</p>
      {edit}
    </div>;
  }
  const { summary } = modelSource;
  return <div className="dw-model-card" data-state={modelSource.errors.length ? 'error' : 'ready'}>
    <strong>{modelSource.label || (space ? 'Modelo 3D' : 'Modelo 2D')}</strong>
    <dl>
      <div><dt>Vigas</dt><dd>{summary.beams}</dd></div>
      <div><dt>Columnas</dt><dd>{summary.columns}</dd></div>
      <div><dt>Fuera del concreto</dt><dd>{summary.skipped}</dd></div>
      <div><dt>Casos</dt><dd>{`${summary.deadCases} CM · ${summary.lateralCases} lateral · CV en ${summary.liveCases} ${summary.liveCases === 1 ? 'parte' : 'partes'}`}</dd></div>
    </dl>
    {summary.ignoredCases.length ? <p title={`Revisa su categoría y activación en ${space ? '3D' : '2D → Casos de carga'}.`}>{`No entran: ${summary.ignoredCases.join(', ')}.`}</p> : null}
    <p>{fcFromModel ? `f′c: ${formatNumber(modelSource.fcMpa ?? 0, 1)} MPa (modelo).` : 'Sin f′c en el modelo: se usa Materiales.'}</p>
    {edit}
  </div>;
}

function ProposalGroups({ proposal }: { proposal: SectionProposal }) {
  return proposal.groups?.length ? <table className="dw-table" aria-label="Secciones propuestas por grupo">
    <thead><tr><th scope="col">Grupo</th><th scope="col">b × h (cm)</th></tr></thead>
    <tbody>{proposal.groups.map((group) => <tr key={group.id}><th scope="row">{group.label}</th><td>{group.width} × {group.height}</td></tr>)}</tbody>
  </table> : null;
}

/** Un modelo del proyecto se puede diseñar cuando existe y no trae errores propios (vacío, sin pórticos, sin concreto). */
const usableSource = (source: ExternalStructureSource | null | undefined) =>
  Boolean(source && !source.errors.length && source.summary.beams + source.summary.columns > 0);

export function FrameWorkbench({ chrome }: { chrome: WorkbenchChrome }) {
  const { draft, set, reset, replace } = useStoredDraft('frame', FRAME_DEFAULTS, FRAME_LEGACY);
  const storage = useWorkbenchStorage();
  const [bays, setBays] = useState<BayDraft[]>(() => readStored(storage, 'frame-bays', parseBays, DEFAULT_BAYS));
  const [stories, setStories] = useState<StoryDraft[]>(() => readStored(storage, 'frame-stories', parseStories, DEFAULT_STORIES));
  useEffect(() => storage.write('frame-bays', bays.map((bay) => ({ ...bay }))), [bays, storage]);
  useEffect(() => storage.write('frame-stories', stories.map((story) => ({ ...story }))), [stories, storage]);
  const snapshot = useMemo(() => ({ draft, bays, stories }), [draft, bays, stories]);
  const applySnapshot = useCallback((next: typeof snapshot) => { replace(next.draft); setBays(next.bays); setStories(next.stories); }, [replace]);
  const history = useDraftHistory(snapshot, applySnapshot, 'frame');
  const { onHistory, startSource, deferSourceNormalization = false, modelSource = null, modelAxes = null, onOpenModel, onOpenSpace3D, onCreateModel, onShowMembers } = chrome;
  useEffect(() => onHistory?.(history), [history, onHistory]);
  // La barra elegida en el modo de origen: su diseño se abre cuando llega el resultado.
  const focusRef = useRef(chrome.focusMember ?? null);
  // Al llegar desde un modo con modelo (2D o 3D), Estructura diseña ese modelo si
  // estaba diseñando un modelo del proyecto; el pórtico rápido elegido se respeta,
  // salvo que se pida el diseño de una barra. En el 3D se abre el eje de esa barra.
  // Un modelo que todavía no se puede diseñar (vacío, sin pórticos o sin concreto)
  // no detiene la mesa: se toma el otro modelo o, si tampoco, el pórtico rápido.
  useEffect(() => {
    if (deferSourceNormalization) return;
    const focus = focusRef.current;
    // Un 2D de acero no se diseña aquí en concreto, pero sí tiene su revisión: también cuenta.
    const usable2d = usableSource(modelSource) || Boolean(chrome.modelReview);
    const usable3d = Boolean(modelAxes?.axes.some((axis) => {
      try { return usableSource(modelAxes.source(axis.id)); } catch { return false; }
    }));
    let source = startSource ?? draft.source;
    if (source === 'model3d' && !usable3d) source = usable2d ? 'model' : 'frame';
    else if (source === 'model' && !usable2d) source = usable3d ? 'model3d' : 'frame';
    const axes = focus && source === 'model3d' && modelAxes?.axesOfMember ? modelAxes.axesOfMember(focus) : [];
    const axis = axes.length && modelAxes && !axes.includes(axisOf(draft, modelAxes)) ? axes[0]! : draft.axis;
    if (source !== 'model' && source !== 'model3d') focusRef.current = null;
    if (source !== draft.source || axis !== draft.axis) replace({ ...draft, source, axis });
  // La decisión de no normalizar sólo se lee al montar. Al cerrar el picker no
  // se ejecuta este efecto otra vez; un montaje posterior vuelve al flujo normal.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const code = designCode(chrome.code);
  const fromModel = fromProjectModel(draft);
  const from3d = draft.source === 'model3d';
  const external = useMemo(() => externalFor(draft, modelSource, modelAxes), [draft, modelSource, modelAxes]);
  const lateral = draft.lateral === 'yes' && draft.braced !== 'yes';

  // Pórtico rápido: cálculo inmediato (diferido por React). Modelos del proyecto: cálculo después de pintar.
  const inputs = useMemo(() => ({ code: chrome.code, draft, bays, stories }), [chrome.code, draft, bays, stories]);
  const deferredInputs = useDeferredValue(inputs);
  const frameOutcome = useMemo(() => fromModel ? null : designFromDraft(deferredInputs.code, deferredInputs.draft as FrameDraft, deferredInputs.bays, deferredInputs.stories),
    [fromModel, deferredInputs]);
  const modelKey = JSON.stringify([chrome.code, draft, external?.revision ?? null]);
  const model = useDeferredOutcome(modelKey, fromModel, (signal) => designFromDraftAsync(chrome.code as DesignCodeId, draft, bays, stories, external, signal));
  const outcome: StructureOutcome | null = fromModel ? model.outcome : frameOutcome;
  const result = outcome?.ok ? outcome.result : null;
  const report = useMemo(() => outcome?.ok ? structureReport(outcome, deferredInputs.draft as FrameDraft) : null, [outcome, deferredInputs.draft]);
  const outOfScope = report?.outOfScope ?? [];
  const [kind, setKind] = useState<FrameDiagramKind>('ratio');
  const [picked, setPicked] = useState<string | null>(null);
  const [focusNote, setFocusNote] = useState<string | null>(null);
  useEffect(() => {
    const memberId = focusRef.current;
    if (!memberId || !result || !fromModel) return;
    focusRef.current = null;
    const id = designOfMember(result, memberId);
    if (id) { setPicked(id); setFocusNote(null); return; }
    const skipped = result.skipped.find((item) => item.id === memberId);
    setFocusNote(skipped ? `${skipped.label} no se diseña en concreto: ${skipped.reason}` : `La barra ${memberId} no está en ${from3d ? 'este eje' : 'el modelo diseñado'}.`);
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);
  const selected = !result ? null
    : picked && (result.beams.some((beam) => beam.id === picked) || result.columns.some((column) => column.id === picked)) ? picked : governingDesign(result);
  const beam = result?.beams.find((item) => item.id === selected);
  const column = result?.columns.find((item) => item.id === selected);
  const [loadNote, setLoadNote] = useState<string | null>(null);
  // Proponer secciones: varios diseños completos, uno por tarea; un cambio de datos la cancela.
  const [proposing, setProposing] = useState<string | null>(null);
  const [sectionNote, setSectionNote] = useState<string | null>(null);
  const cancelProposal = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelProposal.current?.(), []);
  // Con el Modelo 2D la propuesta se muestra y se aplica al modelo a pedido (reemplaza secciones).
  const modelSections = fromModel ? (from3d ? chrome.space3dSections : chrome.modelSections) ?? null : null;
  const [modelProposal, setModelProposal] = useState<SectionProposal | null>(null);
  const proposalInputs = JSON.stringify([chrome.code, draft, bays, stories, external?.revision ?? null]);
  const proposalStart = useRef(proposalInputs);
  useEffect(() => {
    if (proposalStart.current === proposalInputs) return;
    cancelProposal.current?.();
    proposalStart.current = proposalInputs;
    setModelProposal(null);
  }, [proposalInputs]);
  const proposeSections = () => {
    chrome.setPanel('inputs', true);
    cancelProposal.current?.();
    proposalStart.current = proposalInputs;
    setModelProposal(null);
    const steps = modelSections
      ? proposeModelSections(chrome.code as DesignCodeId, draft, modelSections)
      : proposeFrameSections(chrome.code as DesignCodeId, draft, bays, stories);
    const before = modelSections ? modelSections.volumeM3 : frameConcreteVolume(draft, bays, stories);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => { if (timer !== null) clearTimeout(timer); cancelProposal.current = null; setProposing(null); };
    cancelProposal.current = stop;
    const accept = (step: ProposalStep) => {
      if (step.kind === 'trying') {
        setProposing(`${step.phase === 'grow' ? 'Buscando' : 'Ajustando'} · diseño ${step.trial}: viga ${step.beam.width}×${step.beam.height}, columna ${step.column.width}×${step.column.height}`);
        return;
      }
      stop();
      if (step.kind === 'failed') { setSectionNote(step.reason); return; }
      if (modelSections) { setModelProposal(step.proposal); return; }
      const { beam: proposedBeam, column: proposedColumn, ratio, volumeM3, trials } = step.proposal;
      const bars = String(proposedColumn.barsPerFace);
      replace((current) => ({
        ...current, proposalBars: 'yes',
        beamWidth: String(proposedBeam.width), beamHeight: String(proposedBeam.height),
        columnWidth: String(proposedColumn.width), columnHeight: String(proposedColumn.height), barsWidth: bars, barsDepth: bars,
      }));
      setStories(frameProposalStories(stories, step.proposal));
      setSectionNote(`Por nivel · Viga ${proposedBeam.width} × ${proposedBeam.height} y columna ${proposedColumn.width} × ${proposedColumn.height} cm con ${proposedColumn.barsPerFace} barras por cara: rige ${percent(ratio)}. `
        + `${formatNumber(volumeM3, 2)} m³ de concreto (antes ${formatNumber(before, 2)}), tras ${trials} diseños. Ctrl+Z lo deshace.`);
    };
    const tick = () => {
      const next = steps.next();
      if (next.done) { stop(); return; }
      accept(next.value);
      if (next.value.kind === 'trying') timer = setTimeout(tick, 0);
    };
    setSectionNote(null);
    setProposing('Iniciando búsqueda…');
    const cancelWorker = modelSections
      ? modelSections.propose?.(chrome.code as DesignCodeId, draft, accept)
      : startProposalWorker(new URL('./frameProposal.worker.ts', import.meta.url), { code: chrome.code, draft, bays, stories }, accept);
    if (cancelWorker) cancelProposal.current = () => { cancelWorker(); stop(); };
    else timer = setTimeout(tick, 0);
  };
  const applyModelProposal = () => {
    if (!modelProposal || !modelSections) return;
    const { beam: proposedBeam, column: proposedColumn } = modelProposal;
    const bars = String(proposedColumn.barsPerFace);
    modelSections.apply(proposedBeam, proposedColumn, modelProposal.groups);
    replace((current) => ({ ...current, proposalBars: 'yes', barsWidth: bars, barsDepth: bars }));
    setModelProposal(null);
    setSectionNote(modelProposal.groups?.length
      ? `Escritas por nivel en el Modelo ${from3d ? '3D' : '2D'}: ${modelProposal.groups.map((g) => `${g.label}: ${g.width}×${g.height} cm`).join('; ')}. Deshacer en el modo ${from3d ? '3D' : '2D'} recupera las secciones anteriores.`
      : `Escritas en el Modelo ${from3d ? '3D' : '2D'}: ${plural(modelSections.beams, 'viga', 'vigas')} ${proposedBeam.width} × ${proposedBeam.height} y ${plural(modelSections.columns, 'columna', 'columnas')} ${proposedColumn.width} × ${proposedColumn.height} cm, con ${proposedColumn.barsPerFace} barras por cara. Deshacer en el modo ${from3d ? '3D' : '2D'} recupera las secciones anteriores.`);
  };
  const setUniformSection = (field: 'beamWidth' | 'beamHeight' | 'columnWidth' | 'columnHeight') => (value: string) => {
    set(field)(value);
    setStories((current) => current.map(({ height, dead, live, lateral: force }) => ({ height, dead, live, lateral: force })));
  };
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
  const biaxialColumn = Boolean(column?.states.some((state) => state.outOfPlaneKnm !== undefined));
  const fcFromModel = fromModel && external?.fcMpa !== null && external?.fcMpa !== undefined;
  const name = from3d ? 'Modelo 3D' : fromModel ? 'Modelo 2D' : 'Pórtico rápido';
  const openSource = from3d
    ? onOpenSpace3D && (() => onOpenSpace3D(modelAxes ? axisOf(draft, modelAxes) : undefined))
    : onOpenModel;
  // Todos los ejes: una vista de la mesa (no se guarda en el borrador).
  const [building, setBuilding] = useState(false);
  const buildingView = from3d && building && modelAxes && modelAxes.axes.length > 1
    ? <BuildingAxes axes={modelAxes} code={chrome.code as DesignCodeId} draft={deferredInputs.draft as FrameDraft} current={axisOf(draft, modelAxes)}
      onOpen={(axisId) => { set('axis')(axisId); setPicked(null); }} onClose={() => setBuilding(false)}
      {...(chrome.onSaveAxes ? { onSaveAll: chrome.onSaveAxes } : {})} />
    : null;
  const supports = result?.columns.length ? 'columns' as const : 'ideal' as const;
  const modelReview = fromModel && !from3d ? chrome.modelReview : null;
  const steelOnly = Boolean(modelReview && external?.summary.beams === 0 && external?.summary.columns === 0);
  const verdict = steelOnly ? { status: 'warning' as const, label: 'Acero · revisión parcial' } : result
    ? { status: result.status, label: verdictLabel(result.status, result.governingRatio, outOfScope.length > 0) }
    : { status: 'error' as const, label: fromModel && model.pending ? 'Analizando el modelo…' : 'Datos incompletos' };

  return <><WorkbenchLayout
    chrome={steelOnly ? { ...chrome, codeControl: <span className="dw-badge">Acero · NTC CDMX 2023</span> } : chrome}
    title="Estructura"
    noReview={fromModel && !steelOnly && !model.pending && !usableSource(external)}
    report={report}
    onReset={() => { reset(); setBays(DEFAULT_BAYS); setStories(DEFAULT_STORIES); setPicked(null); }}
    verdict={verdict}
    caption={outcome?.ok ? describeStructure(outcome) : undefined}
    inputs={<>
      <IdentityGroup tag={draft.tag} place={draft.place} onTag={set('tag')} onPlace={set('place')} example="P-1" />
      <FieldGroup title="Origen de la estructura" columns={1}>
        <SegmentedControl label="Origen de la estructura" size="sm" value={from3d ? 'model3d' : fromModel ? 'model' : 'frame'} onValueChange={(value) => { set('source')(value); setPicked(null); }}
          options={[{ value: 'model', label: 'Modelo 2D' }, { value: 'model3d', label: 'Modelo 3D' }, { value: 'frame', label: 'Pórtico rápido' }]} />
        {from3d && modelAxes?.axes.length ? <>
          <Select label="Eje del Modelo 3D" value={axisOf(draft, modelAxes)} onChange={(event) => { set('axis')(event.currentTarget.value); setPicked(null); }}>
            {modelAxes.axes.map((axis) => <option key={axis.id} value={axis.id}>{`${axis.label} · ${axis.members} ${axis.members === 1 ? 'barra' : 'barras'}`}</option>)}
          </Select>
          {modelAxes.axes.length > 1 ? <button type="button" className="dw-inline-action" aria-pressed={building} onClick={() => setBuilding((open) => !open)}>
            <LayoutGrid size={13} aria-hidden="true" />{building ? 'Ocultar todos los ejes' : `Revisar los ${modelAxes.axes.length} ejes`}
          </button> : null}
        </> : null}
        {steelOnly ? <p className="dw-input-note" title="La revisión disponible aparece en el dibujo con su combinación y alcance propios.">Barras de acero: revisión parcial en el dibujo.</p> : fromModel ? <ModelSummary modelSource={external} fcFromModel={fcFromModel} space={from3d} {...(openSource ? { onOpenModel: openSource } : {})} />
          : onCreateModel ? <QuickFrameCard spec={frameOutcome?.ok ? frameModelSpec(chrome.code as DesignCodeId, draft, bays, stories) : null} modelMembers={modelSource?.summary.members ?? 0}
            onCreate={(spec) => { onCreateModel(spec); set('source')('model'); setPicked(null); setLoadNote(null); }} /> : null}
      </FieldGroup>
      {!steelOnly ? <>
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
          <p className="dw-input-note" title="N1 es el primer nivel sobre la base. CM y CV son de servicio sobre las vigas, sin su peso propio. F es la fuerza lateral de diseño del nivel (sismo ya reducido o viento).">N1: primer nivel · CM y CV de servicio, sin peso propio{lateral ? ' · F lateral de diseño' : ''}.</p>
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
        {fromModel ? <p className="dw-input-note" title="Otro sistema (muros, contravientos) impide el desplazamiento: no se amplifican momentos por desplazamiento ni entran las acciones laterales.">Arriostrado: no se amplifica ni entra la acción lateral.</p> : null}
      </FieldGroup>
      {fromModel ? (modelSections ? <FieldGroup title="Secciones del modelo" columns={1} action={<InlineAction label={proposing ? 'Buscando…' : 'Proponer'} disabled={proposing !== null}
        title="Secciones por nivel que cumplen y reducen el volumen respecto a la propuesta uniforme" onClick={proposeSections} />}>
        <p className="dw-input-note">{plural(modelSections.beams, 'viga', 'vigas')} y {plural(modelSections.columns, 'columna', 'columnas')} de concreto · {formatNumber(modelSections.volumeM3, 2)} m³.</p>
        {proposing ? <p className="dw-action-note" role="status" aria-live="polite">{proposing}</p>
          : modelProposal ? <div className="dw-proposal" role="status">
            <p>{modelProposal.groups?.length ? 'Referencia uniforme · ' : ''}Vigas {modelProposal.beam.width} × {modelProposal.beam.height} y columnas {modelProposal.column.width} × {modelProposal.column.height} cm. Propuesta{modelProposal.groups?.length ? ' por nivel' : ''}: rige {percent(modelProposal.ratio)}. {formatNumber(modelProposal.volumeM3, 2)} m³ de concreto (ahora {formatNumber(modelSections.volumeM3, 2)}), tras {modelProposal.trials} diseños.</p>
            <ProposalGroups proposal={modelProposal} />
            <div className="dw-proposal__actions">
              <button type="button" className="dw-inline-action" onClick={applyModelProposal}>{from3d ? 'Aplicar al 3D' : 'Aplicar al modelo'}</button>
              <button type="button" className="dw-inline-action" onClick={() => setModelProposal(null)}>Descartar</button>
            </div>
          </div>
          : <ActionNote text={sectionNote} />}
      </FieldGroup> : null) : <FieldGroup title="Secciones" action={<InlineAction label={proposing ? 'Buscando…' : 'Proponer'} disabled={proposing !== null}
        title="Secciones por nivel con menos concreto que la propuesta uniforme, en pasos de 5 cm y columnas al 1 %" onClick={proposeSections} />}>
        <NumberField label="Viga b" unit="cm" value={draft.beamWidth} onChange={setUniformSection('beamWidth')} />
        <NumberField label="Viga h" unit="cm" value={draft.beamHeight} onChange={setUniformSection('beamHeight')} />
        <NumberField label="Columna b" unit="cm" value={draft.columnWidth} onChange={setUniformSection('columnWidth')} hint="Fuera del plano" />
        <NumberField label="Columna h" unit="cm" value={draft.columnHeight} onChange={setUniformSection('columnHeight')} hint="En el plano del marco" />
        <NumberField label="Recubrimiento" unit="cm" value={draft.cover} onChange={set('cover')} />
        <div className="dw-span-all">
          {proposing ? <p className="dw-action-note" role="status" aria-live="polite">{proposing}</p> : <ActionNote text={sectionNote} />}
        </div>
      </FieldGroup>}
      {!fromModel && stories.some((story) => story.beamWidth) ? <FieldGroup title="Secciones por nivel" columns={1}>
        {stories.map((story, index) => <p key={index} className="dw-input-note">N{index + 1}: V {story.beamWidth ?? draft.beamWidth} × {story.beamHeight ?? draft.beamHeight} · C {story.columnWidth ?? draft.columnWidth} × {story.columnHeight ?? draft.columnHeight} cm.</p>)}
        <p className="dw-input-note">Editar los campos generales restablece secciones uniformes.</p>
        <button type="button" className="dw-inline-action" onClick={() => setStories(stories.map(({ height, dead, live, lateral: force }) => ({ height, dead, live, lateral: force })))}>Volver a secciones uniformes</button>
      </FieldGroup> : null}
      <FieldGroup title="Armado de columnas">
        <BarSelect label="Varilla" value={draft.columnBar} onChange={set('columnBar')} minimumDiameterMm={12.7} />
        <BarSelect label="Estribo" value={draft.tie} onChange={set('tie')} usage="transverse" />
        {draft.proposalBars === 'yes' ? <p className="dw-input-note dw-span-all">Armado por sección: al menos 1 % en cada columna. <button type="button" className="dw-inline-action" onClick={() => set('proposalBars')('no')}>Usar barras indicadas</button></p> : null}
        <NumberField label="Barras cara b" unit="pzas" value={draft.barsWidth} onChange={set('barsWidth')} min={2} />
        <NumberField label="Barras cara h" unit="pzas" value={draft.barsDepth} onChange={set('barsDepth')} min={2} />
        {fromModel ? <NumberField label="Recubrimiento" unit="cm" value={draft.cover} onChange={set('cover')} /> : null}
        <p className="dw-input-note dw-span-all" title="Corridas, bastones y estribos por tramo.">Vigas armadas por línea continua.</p>
      </FieldGroup>
      <FieldGroup title="Materiales">
        <MaterialFields fc={draft.fc} onFcChange={set('fc')} fy={draft.fy} onFyChange={set('fy')} fyv={draft.fyv} onFyvChange={set('fyv')} showFc={!fcFromModel} />
      </FieldGroup>
      <FieldGroup title="Refuerzo transversal de vigas">
        <BarSelect label="Estribo de vigas" value={draft.stirrup} onChange={set('stirrup')} allowAuto usage="transverse" />
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
      </> : null}
    </>}
    stage={<>{modelReview}{buildingView}{result ? <>
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
            {result.beams.some((item) => item.result.status === 'warning') || result.columns.some((item) => item.result.status === 'warning') ? <li data-kind="review">* Revisión pendiente</li> : null}
            {result.skipped.length ? <li data-kind="skip">Fuera del diseño de concreto</li> : null}
          </> : kind === 'deformed'
            ? <li data-kind="y">{result.lateral ? 'Deformada con la acción lateral, exagerada' : 'Deformada de servicio (CM + CV), exagerada'}</li>
            : <li data-kind={kind === 'moment' ? 'demand' : 'x'}>{kind === 'moment' ? 'Envolvente del lado de la tensión' : 'Envolvente máxima y mínima'}</li>}
          <li data-kind="nominal">Toca una viga o columna para ver su diseño</li>
        </ul>
      </Plate>
      {beam ? <>
        <Plate title={`${beam.label} · envolventes`} wide note={fromModel ? `Demanda del ${name} con la viva alternada por barra` : 'Demanda del pórtico con la viva alternada'}>
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
        {biaxialColumn ? <Plate title={`${column.label} · fuera del plano`} wide note="Flexión perpendicular al eje, del Modelo 3D">
          <InteractionChart result={column.result} axis="y" cloud={column.states.map((state) => ({ axialKn: state.axialKn, momentKnm: state.outOfPlaneDesignKnm ?? 0, label: `${state.combination} · ${state.label}` }))} />
        </Plate> : null}
        <Plate title="Sección"><ColumnSection result={column.result} /></Plate>
        <Plate title="Armado en elevación"><ColumnElevation result={column.result} /></Plate>
      </> : null}
    </> : steelOnly ? null : fromModel && model.pending
      ? <div className="dw-model-wait" role="status"><span className="dw-model-wait__dot" aria-hidden="true" />{from3d ? 'Analizando el Modelo 3D completo con el solver espacial…' : 'Analizando el Modelo 2D con el solver de la app…'}</div>
      : fromModel && !usableSource(external) ? <div className="dw-model-empty">
        <strong>{from3d ? modelAxes?.axes.length ? 'El 3D no tiene vigas ni columnas de concreto' : 'El 3D aún no tiene pórticos' : !external?.summary.members ? 'El 2D está vacío' : 'El 2D aún no tiene vigas ni columnas de concreto con cargas'}</strong>
        <div className="dw-model-empty__actions">
          {from3d && chrome.onCreateBuilding ? <button type="button" className="dw-model-empty__primary" onClick={chrome.onCreateBuilding}>
            <Building2 size={15} aria-hidden="true" />Crear edificio
          </button> : null}
          <button type="button" className={from3d && chrome.onCreateBuilding ? undefined : 'dw-model-empty__primary'} onClick={() => { set('source')('frame'); setPicked(null); }}>
            <LayoutGrid size={15} aria-hidden="true" />Pórtico rápido
          </button>
          {from3d && (usableSource(modelSource) || chrome.modelReview) ? <button type="button" onClick={() => { set('source')('model'); setPicked(null); }}>
            <PenLine size={15} aria-hidden="true" />Usar el 2D
          </button> : !from3d && modelAxes?.axes.length ? <button type="button" onClick={() => { set('source')('model3d'); setPicked(null); }}>
            <Box size={15} aria-hidden="true" />Usar el 3D
          </button> : null}
          {openSource && !(from3d && chrome.onCreateBuilding) ? <button type="button" onClick={openSource}>
            {from3d ? <Box size={15} aria-hidden="true" /> : <PenLine size={15} aria-hidden="true" />}{from3d ? 'Modelar en 3D' : 'Modelar en 2D'}
          </button> : null}
        </div>
      </div>
      : <div className="dw-model-errors">
        <ErrorsPanel errors={outcome && !outcome.ok ? outcome.errors : []} />
        {fromModel && openSource ? <button type="button" className="dw-inline-action" onClick={openSource}>
          {from3d ? <Box size={13} aria-hidden="true" /> : <PenLine size={13} aria-hidden="true" />}{from3d ? 'Editar en 3D' : 'Editar en Modelo'}
        </button> : null}
      </div>}</>}
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
        <MemberGrid result={result} selected={selected} onSelect={(id) => { setPicked(id); setFocusNote(null); }} />
        {focusNote ? <p className="dw-input-note" role="status">{focusNote}</p> : null}
        {fromModel && selected && onShowMembers ? <button type="button" className="dw-inline-action dw-show-members"
          onClick={() => onShowMembers(memberIdsOf(result, selected), from3d && modelAxes ? axisOf(draft, modelAxes) : undefined)}>
          {from3d ? <Box size={13} aria-hidden="true" /> : <PenLine size={13} aria-hidden="true" />}
          {from3d ? 'Ver en 3D' : 'Ver en el Modelo'} · {lowerFirst(beam?.label ?? column?.label ?? '')}
        </button> : null}
        <p className="dw-footnote">Cociente que rige en cada viga y columna. Elige uno para ver su revisión y su lámina.{result.skipped.length ? ` ${result.skipped.length} ${result.skipped.length === 1 ? 'barra no se diseña' : 'barras no se diseñan'} en concreto (ver revisión).` : ''}</p>
      </PanelSection>
      {beam || column ? <PanelSection title={beam?.label ?? column!.label}>
        {beam ? <RebarList items={[
          { kind: 'bar', title: `${barsText(beam.result.continuousTop.continuous)} corridas arriba` },
          { kind: 'bar', title: `${barsText(beam.result.continuousBottom.continuous)} corridas abajo` },
          ...beam.result.bastions.map((bastion) => ({ kind: 'extra' as const, title: bastionTitle(bastion), detail: `${meters(bastion.startM)} → ${meters(bastion.endM)} m` })),
          ...beam.result.spans.map((span, index) => ({ kind: 'stirrup' as const, title: `Tramo ${index + 1} · ${stirrupText(span.stirrups, beam.result.stirrupDiameterMm)}` })),
        ]} /> : null}
        {beam?.torsion ? <Summary rows={[
          { label: 'Tu (torsión)', value: `${formatNumber(beam.torsion.demandKnm)} kN·m` },
          { label: '¼·φ·Tcr', value: `${formatNumber(beam.torsion.thresholdKnm)} kN·m · ${beam.torsion.demandKnm > beam.torsion.thresholdKnm ? 'revisar torsión' : 'despreciable'}` },
        ]} /> : null}
        {column ? <>
          <RebarList items={[
            { kind: 'bar', title: `${column.result.bars.length} ${rebarLabel(column.result.input.barDiameterMm)}`, detail: `ρ ${formatNumber(column.result.steelRatio * 100, 2)} % · ${formatNumber(column.result.input.widthMm / 10, 0)}×${formatNumber(column.result.input.depthMm / 10, 0)} cm` },
            { kind: 'stirrup', title: `E ${rebarLabel(column.result.ties.diameterMm, 'transverse')} @ ${formatNumber(column.result.ties.centerSpacingMm / 10, 1)} cm`,
              detail: column.result.ties.endLengthMm > 0 ? `@ ${formatNumber(column.result.ties.endSpacingMm / 10, 1)} cm en Lo = ${formatNumber(column.result.ties.endLengthMm / 10, 0)} cm` : undefined },
          ]} />
          <Summary rows={[
            { label: 'Estado que rige', value: column.states[column.governingState]!.label },
            { label: 'Pu', value: `${formatNumber(column.states[column.governingState]!.axialKn, 0)} kN`, tone: 'axial' },
            { label: 'Mc', value: `${formatNumber(column.states[column.governingState]!.designMomentKnm)} kN·m`, tone: 'moment' },
            ...(column.states[column.governingState]!.outOfPlaneDesignKnm !== undefined
              ? [{ label: 'Mc ⊥ (fuera del plano)', value: `${formatNumber(column.states[column.governingState]!.outOfPlaneDesignKnm!)} kN·m`, tone: 'moment' as const }] : []),
            { label: 'k · ψ', value: `${formatNumber(column.effectiveLengthFactor, 2)} · ${formatNumber(column.psiTop, 2)}/${formatNumber(column.psiBottom, 2)}` },
            ...(column.outOfPlane ? [{
              label: 'k⊥ · ψ⊥',
              value: `${formatNumber(column.outOfPlane.effectiveLengthFactor, 2)} · ${formatNumber(column.outOfPlane.psiTop, 2)}/${formatNumber(column.outOfPlane.psiBottom, 2)}`,
            }, {
              label: 'Q⊥ (estabilidad)',
              value: (column.states[column.governingState]!.outOfPlaneStabilityIndex ?? 0).toFixed(3),
            }] : []),
          ]} />
        </> : null}
        <ReviewList checks={memberChecks[0]} outOfScope={[]} />
        {column ? <Disclosure label={`Estados de la columna (${column.states.length})`}>
          <table className="dw-table" aria-label="Estados concurrentes de la columna (kN, kN·m)">
            <thead><tr><th scope="col">Combinación</th><th scope="col">Pu</th><th scope="col">M sup</th><th scope="col">M inf</th><th scope="col">Mc</th>
              {biaxialColumn ? <th scope="col" title="Flexión perpendicular al plano del eje">M ⊥</th> : null}<th scope="col">Rige</th></tr></thead>
            <tbody>{column.states.map((state, index) => <tr key={index} data-active={index === column.governingState || undefined}>
              <th scope="row">{`${state.combination} · ${state.label}`}</th>
              <td>{formatNumber(state.axialKn, 0)}</td>
              <td>{formatNumber(state.topKnm)}</td>
              <td>{formatNumber(state.bottomKnm)}</td>
              <td>{formatNumber(state.designMomentKnm)}</td>
              {biaxialColumn ? <td>{formatNumber(state.outOfPlaneKnm ?? 0)}</td> : null}
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
    </> : steelOnly ? <p className="dw-input-note">Revisión de acero en Dibujo; diseño sin concluir.</p> : null}
  /></>;
}
