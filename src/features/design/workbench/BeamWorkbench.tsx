import { Plus, Trash2 } from 'lucide-react';
import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { SegmentedControl, Select } from '../../../design-system/components/controls';
import { LayerToggle, UnitField } from '../../../design-system/components/editor';
import { MAX_SPANS, barsText, beamClearSpanMm, designBeam, flangeWidthLimit } from '../../../design/elements/beam';
import { designCode } from '../../../design/elements/codes';
import { BeamElevation, BeamRebarDetail, BeamSection } from './BeamDrawings';
import { BeamDetailEditor } from './BeamDetailEditor';
import { EMPTY_BEAM_DETAILS, useStoredBeamDetails } from './beamDetailDraft';
import { parseBeamDetails } from './beamDetailInput';
import {
  BEAM_DEFAULTS, DEFAULT_SPANS, END_LABEL, ENDS, beamSupportPreset, bastionDetail, bastionTitle, beamReport, beamToInput, cm, describeBeam, meters, parseSpans, slabLineLoads, stirrupText,
  type SpanDraft,
} from './beamModel';
import {
  ActionNote, AlternativeSection, BarSelect, InlineAction, ChecksList, IdentityGroup, ReviewList, Disclosure, ErrorsPanel, FieldGroup, GroupSelect, LIVE_LOAD_USES, LONG_TERM_DURATIONS, MoreOptions, NumberField,
  PanelSection, RebarList, Summary, TakeoffSection, ValuesTable, Verdict, formatNumber, parseNumber, readStored, useDraftHistory, useStoredDraft, useStoredRows,
} from './common';
import { commitWorkbenchBatch, useWorkbenchStorage } from './workbenchStorage';
import type { JsonValue } from '../../../shared/project/unifiedProjectBundle';
import { MaterialFields } from './MaterialFields';
import { startBeamSectionProposal, type BeamSectionProposalReply } from './beamSectionProposal';
import { ReinforcementAlternatives } from './ReinforcementAlternatives';
import { startReinforcementAlternatives, type ReinforcementAlternativesRequest, type ReinforcementAlternativesResponse } from './reinforcementAlternativesClient';
import { REBAR_SIZES } from '../../../design/elements/shared';
import type { ReinforcementCandidate, ReinforcementObjective } from '../../../design/elements/reinforcementAlternatives';
import { Plate, WorkbenchLayout, verdictLabel, type WorkbenchChrome } from './WorkbenchLayout';

type SpanColumn = { field: keyof SpanDraft; label: string; unit: string };

function SpanInput({ span, index, column, onChange }: { span: SpanDraft; index: number; column: SpanColumn; onChange: (index: number, field: keyof SpanDraft, value: string) => void }) {
  const value = span[column.field];
  const parsed = parseNumber(value);
  const length = parseNumber(span.length);
  const invalid = !Number.isFinite(parsed) || parsed < 0
    || (column.field === 'length' && parsed <= 0)
    || (column.field === 'pointAt' && Number.isFinite(length) && parsed > length);
  return <input type="text" inputMode="decimal" value={value} aria-invalid={invalid || undefined}
    aria-label={`Claro ${index + 1} · ${column.label} (${column.unit})`}
    onChange={(event) => onChange(index, column.field, event.currentTarget.value)} />;
}

function SpanTable({ spans, points, onChange, onAdd, onRemove }: {
  spans: readonly SpanDraft[];
  points: boolean;
  onChange: (index: number, field: keyof SpanDraft, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const main: SpanColumn[] = [
    { field: 'length', label: 'L', unit: 'm' },
    { field: 'dead', label: 'CM', unit: 'kN/m' },
    { field: 'live', label: 'CV', unit: 'kN/m' },
  ];
  const point: SpanColumn[] = [
    { field: 'pointDead', label: 'P CM', unit: 'kN' },
    { field: 'pointLive', label: 'P CV', unit: 'kN' },
    { field: 'pointAt', label: 'a', unit: 'm' },
  ];
  const header = (columns: SpanColumn[], className = '') => <div className={`dw-spans__row dw-spans__head ${className}`} aria-hidden="true">
    <span />
    {columns.map((column) => <span key={column.field}>{column.label}<small>{column.unit}</small></span>)}
    <span />
  </div>;
  return <div className="dw-spans">
    {header(main)}
    {spans.map((span, index) => <Fragment key={index}>
      <div className="dw-spans__row" role="group" aria-label={`Claro ${index + 1}`}>
        <span className="dw-spans__index">{index + 1}</span>
        {main.map((column) => <SpanInput key={column.field} span={span} index={index} column={column} onChange={onChange} />)}
        <button type="button" className="dw-icon-button" aria-label={`Quitar claro ${index + 1}`} disabled={spans.length === 1} onClick={() => onRemove(index)}>
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
      {points ? <>
        {index === 0 ? header(point, 'dw-spans__head--sub') : null}
        <div className="dw-spans__row dw-spans__row--sub" role="group" aria-label={`Carga puntual del claro ${index + 1}`}>
          <span className="dw-spans__index" aria-hidden="true">P</span>
          {point.map((column) => <SpanInput key={column.field} span={span} index={index} column={column} onChange={onChange} />)}
          <span />
        </div>
      </> : null}
    </Fragment>)}
    {spans.length < MAX_SPANS ? <button type="button" className="dw-add" onClick={onAdd}><Plus size={14} aria-hidden="true" />Agregar claro</button> : null}
  </div>;
}

export function BeamWorkbench({ chrome }: { chrome: WorkbenchChrome }) {
  const { draft, set, reset, replace, accept } = useStoredDraft('beam', BEAM_DEFAULTS);
  const storage = useWorkbenchStorage();
  const storedDetails = useStoredBeamDetails(storage);
  const [detailsDraft, setDetailsDraft] = useState(storedDetails.details);
  const [detailsNote, setDetailsNote] = useState<string | null>(null);
  useEffect(() => { setDetailsDraft(storedDetails.details); }, [storedDetails.details]);
  const [spans, setSpans, acceptSpans] = useStoredRows<SpanDraft[]>('beam-spans', readStored(storage, 'beam-spans', parseSpans, DEFAULT_SPANS));
  const snapshot = useMemo(() => ({ draft, spans, details: storedDetails.details }), [draft, spans, storedDetails.details]);
  const applySnapshot = useCallback((next: typeof snapshot) => {
    const writes = { beam: next.draft, 'beam-spans': next.spans as unknown as import('../../../shared/project/unifiedProjectBundle').JsonValue };
    if (!storedDetails.setDetails(next.details, writes)) { setDetailsNote('Sin espacio para restaurar el detalle y el armado; se conservaron los datos actuales.'); return false; }
    setDetailsDraft(next.details);
    accept(next.draft);
    acceptSpans(next.spans);
    setDetailsNote(null);
    return true;
  }, [accept, acceptSpans, storedDetails]);
  const history = useDraftHistory(snapshot, applySnapshot, 'beam');
  const { onHistory } = chrome;
  useEffect(() => onHistory?.(history), [history, onHistory]);
  const code = designCode(chrome.code);
  const own = draft.rebarMode === 'own';
  const flanged = draft.sectionType === 'T' || draft.sectionType === 'L';
  const flangeLimit = useMemo(() => {
    if (!flanged || !code.beam.flangeWidthLimits) return null;
    const web = parseNumber(draft.width) * 10;
    const thickness = parseNumber(draft.flangeThickness) * 10;
    const clearSpan = beamClearSpanMm({ spans: spans.map((span) => ({ lengthM: parseNumber(span.length) })), supportWidthMm: parseNumber(draft.supportWidth) * 10 });
    const limit = flangeWidthLimit(draft.sectionType === 'L' ? 'L' : 'T', web, thickness, clearSpan, parseNumber(draft.flangeClear) * 1000);
    return Number.isFinite(limit.widthMm) && limit.widthMm > 0 ? limit : null;
  }, [flanged, code, draft.width, draft.flangeThickness, draft.flangeClear, draft.supportWidth, draft.sectionType, spans]);
  const deferredDetails = useDeferredValue(detailsDraft);
  const parsedDetails = useMemo(() => parseBeamDetails(deferredDetails, spans), [deferredDetails, spans]);
  const detailModeErrors = useMemo(() => parsedDetails.bastions.length || parsedDetails.stirrupZones.some(Boolean)
    ? draft.rebarMode !== 'own' ? ['Activa el armado propio para aplicar bastones y zonas de estribos.']
      : parsedDetails.bastions.length && draft.ownBastions !== 'custom' ? ['Selecciona Bastones propios para aplicar las regiones capturadas.'] : []
    : [], [parsedDetails, draft.rebarMode, draft.ownBastions]);
  const input = useMemo(() => beamToInput(chrome.code, draft, spans, true, deferredDetails), [chrome.code, draft, spans, deferredDetails]);
  const deferred = useDeferredValue(input);
  const result = useMemo(() => parsedDetails.errors.length || detailModeErrors.length
    ? { ok: false as const, errors: [...parsedDetails.errors, ...detailModeErrors] }
    : designBeam(deferred), [deferred, parsedDetails, detailModeErrors]);
  // Con armado propio, el propuesto con la misma entrada sirve de referencia.
  const proposed = useMemo(() => deferred.provided ? designBeam({ ...deferred, provided: null }) : undefined, [deferred]);
  const deferredDraft = useDeferredValue(draft);
  const report = useMemo(() => result.ok ? beamReport(result, deferredDraft, proposed?.ok ? proposed : undefined, deferredDetails) : null, [result, proposed, deferredDraft, deferredDetails]);
  const checks = report?.checks ?? [];
  const notes = report?.notes ?? [];
  const outOfScope = report?.outOfScope ?? [];
  const title = report?.title ?? '';
  const [sectionNote, setSectionNote] = useState<string | null>(null);
  const [alternativeObjective, setAlternativeObjective] = useState<ReinforcementObjective>('minimum-steel');
  const [availableDiameters, setAvailableDiameters] = useState<number[]>(() => REBAR_SIZES.map((bar) => bar.diameterMm));
  const [alternatives, setAlternatives] = useState<ReinforcementAlternativesResponse | null>(null);
  const [alternativeSearch, setAlternativeSearch] = useState(false);
  const alternativeRequest = useRef<{ key: string; cancel: () => void } | null>(null);
  const alternativeRequestId = useRef(0);
  const alternativeInput = useMemo(() => beamToInput(chrome.code, { ...draft, rebarMode: 'own' }, spans, true, detailsDraft), [chrome.code, draft, spans, detailsDraft]);
  const alternativeKey = JSON.stringify({ input: alternativeInput, objective: alternativeObjective, stock: availableDiameters });
  const alternativeKeyRef = useRef(alternativeKey);
  alternativeKeyRef.current = alternativeKey;
  useEffect(() => {
    if (alternativeRequest.current && alternativeRequest.current.key !== alternativeKey) {
      alternativeRequest.current.cancel(); alternativeRequest.current = null; setAlternativeSearch(false); setAlternatives(null);
    }
    setAlternatives(null);
  }, [alternativeKey]);
  useEffect(() => () => alternativeRequest.current?.cancel(), []);
  const [sectionSearch, setSectionSearch] = useState(false);
  const [sectionPreview, setSectionPreview] = useState<{ key: string; width: string; height: string } | null>(null);
  const sectionRequest = useRef<{ key: string; cancel: () => void } | null>(null);
  const sectionRequestId = useRef(0);
  const sectionSnapshotKey = JSON.stringify({ code: chrome.code, draft, spans, details: detailsDraft });
  const sectionSnapshotRef = useRef(sectionSnapshotKey);
  sectionSnapshotRef.current = sectionSnapshotKey;
  useEffect(() => {
    if (sectionRequest.current && sectionRequest.current.key !== sectionSnapshotKey) {
      sectionRequest.current.cancel(); sectionRequest.current = null; setSectionSearch(false); setSectionPreview(null);
      setSectionNote('Búsqueda cancelada: cambiaron los datos de entrada.');
    }
  }, [sectionSnapshotKey]);
  useEffect(() => { setSectionPreview((current) => current?.key === sectionSnapshotKey ? current : null); }, [sectionSnapshotKey]);
  useEffect(() => () => sectionRequest.current?.cancel(), []);
  const [loadNote, setLoadNote] = useState<string | null>(null);
  const slab = slabLineLoads(draft);
  const proposeSection = () => {
    if (sectionRequest.current) { sectionRequest.current.cancel(); sectionRequest.current = null; setSectionSearch(false); setSectionNote('Búsqueda cancelada.'); return; }
    const requestId = ++sectionRequestId.current;
    const key = sectionSnapshotKey;
    setSectionPreview(null); setSectionNote(null); setSectionSearch(true);
    const cancel = startBeamSectionProposal({ requestId, code: chrome.code, draft, spans, details: detailsDraft }, (reply: BeamSectionProposalReply) => {
      sectionRequest.current = null; setSectionSearch(false);
      if (sectionSnapshotRef.current !== key) return;
      if (reply.error) { setSectionNote(reply.error); return; }
      if (!reply.proposal) { setSectionNote('Ninguna sección hasta 50 × 150 cm cumple con el armado propuesto: revisa claros y cargas.'); return; }
      setSectionPreview({ key, ...reply.proposal });
    });
    sectionRequest.current = { key, cancel };
  };
  const compareReinforcement = () => {
    if (alternativeRequest.current) { alternativeRequest.current.cancel(); alternativeRequest.current = null; setAlternativeSearch(false); return; }
    if (parsedDetails.errors.length || detailModeErrors.length) return;
    const requestId = ++alternativeRequestId.current;
    const key = alternativeKey;
    const request: ReinforcementAlternativesRequest = { kind: 'beam', requestId, input: alternativeInput, objective: alternativeObjective,
      ...(alternativeObjective === 'available-bars' ? { availableDiametersMm: availableDiameters } : {}) };
    setAlternatives(null); setAlternativeSearch(true);
    const cancel = startReinforcementAlternatives(request, (response: ReinforcementAlternativesResponse) => {
      alternativeRequest.current = null; setAlternativeSearch(false);
      if (alternativeKeyRef.current !== key) return;
      setAlternatives(response);
    });
    alternativeRequest.current = { key, cancel };
  };
  const applyReinforcement = (candidate: ReinforcementCandidate) => {
    if (!replace({ ...draft, ...candidate.applyFields })) return;
    setAlternatives(null);
    setSectionNote('Armado aplicado con geometría, cargas y detalle capturados. Deshacer recupera el armado anterior.');
  };
  const applySlab = () => {
    if (!slab) return;
    if (!setSpans((current) => current.map((span) => ({ ...span, dead: String(slab.dead), live: String(slab.live) })))) return;
    setLoadNote(`Aplicado a ${spans.length === 1 ? 'el claro' : `los ${spans.length} claros`}: CM ${slab.dead} · CV ${slab.live} kN/m.`);
  };
  const spacingValue = parseNumber(draft.stirrupSpacing);
  const spacingError = draft.stirrupSpacing.trim() !== '' && !(spacingValue >= 5) ? 'Mínimo 5 cm, o vacío para calcularla' : undefined;

  return <WorkbenchLayout
    chrome={chrome}
    title="Viga"
    report={report}
    onReset={() => {
      if (!storedDetails.setDetails(EMPTY_BEAM_DETAILS, { beam: BEAM_DEFAULTS, 'beam-spans': DEFAULT_SPANS as unknown as JsonValue })) { setDetailsNote('No se guardó el reinicio; se conservaron los datos actuales. Libera espacio y vuelve a intentarlo.'); return; }
      reset(); setSpans(DEFAULT_SPANS); setDetailsDraft(EMPTY_BEAM_DETAILS); setDetailsNote(null);
    }}
    verdict={result.ok ? { status: result.status, label: verdictLabel(result.status, result.governingRatio, outOfScope.length > 0) } : { status: 'error', label: 'Datos incompletos' }}
    caption={result.ok ? describeBeam(result.input) : undefined}
    inputs={<>
      <IdentityGroup tag={draft.tag} place={draft.place} onTag={set('tag')} onPlace={set('place')} />
      <FieldGroup title="Claros y cargas" columns={1}>
        <SpanTable
          spans={spans}
          points={draft.points === 'yes'}
          onChange={(index, field, value) => setSpans((current) => current.map((span, position) => position === index ? { ...span, [field]: value } : span))}
          onAdd={() => setSpans((current) => [...current, { ...current[current.length - 1]! }])}
          onRemove={(index) => setSpans((current) => current.filter((_, position) => position !== index))}
        />
        <Disclosure label="Cargas desde la losa">
          <div className="dw-group__grid" data-columns={2}>
            <NumberField label="Ancho tributario" unit="m" value={draft.tributary} onChange={set('tributary')} />
            <NumberField label="Muros sobre la viga" unit="kN/m" value={draft.wallLoad} onChange={set('wallLoad')} />
            <NumberField label="Muerta de la losa" unit="kN/m²" value={draft.slabDead} onChange={set('slabDead')} hint="Losa, acabados, instalaciones" />
            <NumberField label="Viva de la losa" unit="kN/m²" value={draft.slabLive} onChange={set('slabLive')} hint={code.id === 'ntc-2023' ? 'NTC habitación: Wm 1.9' : 'Según el destino'} />
          </div>
          <div className="dw-slab-apply">
            <span>{slab ? `CM ${slab.dead} · CV ${slab.live} kN/m` : 'Datos incompletos'}</span>
            <button type="button" className="dw-inline-action" disabled={!slab} onClick={applySlab}>Aplicar a los claros</button>
          </div>
          <ActionNote text={loadNote} />
        </Disclosure>
        <Disclosure label="Cargas generales y detalle físico">
          <p className="dw-beam-details__sum">Las cargas nuevas se suman a CM/CV, cargas puntuales y peso propio ya capturados.</p>
          <BeamDetailEditor details={detailsDraft} spans={spans}
            onChange={(next, activateOwn) => {
              const nextDraft = activateOwn
                ? { ...draft, rebarMode: 'own', ...(activateOwn === 'bastion' ? { ownBastions: 'custom' } : {}) }
                : null;
              if (!storedDetails.setDetails(next, nextDraft ? { beam: nextDraft } : {})) {
                setDetailsNote('El cambio fue rechazado por falta de espacio y no se guardó; se conservó el detalle anterior. Libera espacio y vuelve a intentarlo.');
                return false;
              }
              setDetailsDraft(next);
              if (nextDraft) accept(nextDraft);
              setDetailsNote(null);
              return true;
            }}
          />
          <ActionNote text={detailsNote} />
        </Disclosure>
        <LayerToggle label="Cargas puntuales" checked={draft.points === 'yes'} onCheckedChange={(checked) => set('points')(checked ? 'yes' : 'no')} />
        <LayerToggle label="Sumar peso propio" checked={draft.selfWeight === 'yes'} onCheckedChange={(checked) => set('selfWeight')(checked ? 'yes' : 'no')} />
        <div className="dw-span-all"><strong>Apoyos</strong></div>
        <Select label="Configuración rápida de apoyos" value="" onChange={(event) => {
          const next = beamSupportPreset(event.currentTarget.value as Parameters<typeof beamSupportPreset>[0], draft, spans);
          if (!commitWorkbenchBatch(storage, { beam: next.draft, 'beam-spans': next.spans as unknown as JsonValue }).accepted) return;
          replace(next.draft);
          setSpans(next.spans);
        }}>
          <option value="">Elegir configuración</option>
          <option value="simple">Apoyada</option><option value="propped">Empotrada–apoyada</option>
          <option value="fixed">Doblemente empotrada</option><option value="cantilever-left">Voladizo izquierdo</option>
          <option value="cantilever-right">Voladizo derecho</option><option value="continuous">Continua</option>
        </Select>
        <div className="dw-end"><span aria-hidden="true">Izquierdo</span><SegmentedControl label="Extremo izquierdo" size="sm" value={draft.leftEnd} options={ENDS} onValueChange={set('leftEnd')} /></div>
        <div className="dw-end"><span aria-hidden="true">Derecho</span><SegmentedControl label="Extremo derecho" size="sm" value={draft.rightEnd} options={ENDS} onValueChange={set('rightEnd')} /></div>
      </FieldGroup>
      <FieldGroup title="Geometría y materiales" action={<InlineAction label={sectionSearch ? 'Cancelar búsqueda' : 'Proponer sección'} title="Dimensionar: la sección de menor área que cumple" onClick={proposeSection} />}>
        {sectionNote ? <p className="dw-span-all" role="status">{sectionNote}</p> : null}
        {sectionPreview?.key === sectionSnapshotKey ? <div className="dw-action-note dw-span-all" role="status">
          <span>Vista previa: {sectionPreview.width} × {sectionPreview.height} cm. Se conservan claros, cargas, detalle y armado actual.</span>
          <button type="button" className="dw-inline-action" onClick={() => { if (!replace({ ...draft, width: sectionPreview.width, height: sectionPreview.height })) return; setSectionNote(`Sección aplicada: ${sectionPreview.width} × ${sectionPreview.height} cm.`); setSectionPreview(null); }}>Aplicar sección</button>
          <button type="button" className="dw-inline-action" onClick={() => { setSectionPreview(null); setSectionNote('Propuesta descartada.'); }}>Descartar</button>
        </div> : null}
        <Disclosure label="Alternativas de acero · geometría fija">
          <Select label="Criterio de comparación" value={alternativeObjective} onChange={(event) => setAlternativeObjective(event.currentTarget.value as ReinforcementObjective)}>
            <option value="minimum-steel">Menor área de acero</option><option value="few-diameters">Menos diámetros</option><option value="available-bars">Diámetros disponibles</option>
          </Select>
          {alternativeObjective === 'available-bars' ? <details className="dw-span-all"><summary>Diámetros en existencia · solo esta sesión</summary>
            <div className="dw-group__grid" data-columns={3}>{REBAR_SIZES.map((bar) => <label key={bar.diameterMm} className="dw-check"><input type="checkbox" checked={availableDiameters.includes(bar.diameterMm)} onChange={(event) => { const checked = event.currentTarget.checked; setAvailableDiameters((current) => checked ? [...new Set([...current, bar.diameterMm])].sort((a, b) => a - b) : current.filter((value) => value !== bar.diameterMm)); }} /> Ø {bar.diameterMm} mm</label>)}</div>
          </details> : null}
          <button type="button" className="dw-inline-action" onClick={compareReinforcement}>{alternativeSearch ? 'Cancelar comparación' : 'Comparar armados'}</button>
          {alternativeSearch ? <p role="status">Comprobando armado físico con los mismos claros, acciones y detalles…</p> : null}
          {alternatives ? <ReinforcementAlternatives candidates={alternatives.candidates} onApply={applyReinforcement} /> : null}
          {alternatives?.reason === 'empty-stock' ? <p role="alert">Selecciona diámetros disponibles del catálogo.</p> : null}
          {alternatives?.reason === 'no-feasible-candidate' ? <p role="status">No hay armado que pase las verificaciones evaluadas con estos claros, cargas y regiones.</p> : null}
          {alternatives?.error ? <p role="alert">No se pudo ejecutar la comparación en segundo plano. Las entradas siguen disponibles.</p> : null}
          <p className="dw-help">Peso estimado con barras principales continuas en la longitud total; bastones, estribos y anclajes excluidos. Se comprueban los estados de flexión y detalle que evalúa el motor.</p>
        </Disclosure>
        <div className="dw-span-all">
          <SegmentedControl label="Tipo de viga" size="sm" value={flanged ? draft.sectionType : 'rect'} onValueChange={set('sectionType')}
            options={[{ value: 'rect', label: 'Rectangular' }, { value: 'T', label: 'T' }, { value: 'L', label: 'L' }]} />
        </div>
        <NumberField label={flanged ? 'Alma bw' : 'Base b'} unit="cm" value={draft.width} onChange={set('width')} />
        <NumberField label="Peralte h" unit="cm" value={draft.height} onChange={set('height')} />
        {flanged ? <>
          <NumberField label="Patín bf" unit="cm" value={draft.flangeWidth} onChange={set('flangeWidth')}
            hint={flangeLimit ? `Máximo ${formatNumber(flangeLimit.widthMm / 10, 0)} cm (rige ${flangeLimit.governs})` : 'Ancho efectivo'} />
          <NumberField label="Espesor hf" unit="cm" value={draft.flangeThickness} onChange={set('flangeThickness')} hint="Losa" />
          {code.beam.flangeWidthLimits ? <>
            <NumberField label="Separación libre La" unit="m" value={draft.flangeClear} onChange={set('flangeClear')} hint="A la viga vecina; 0 si no aplica" />
            <div className="dw-span-all">
              <InlineAction label="Usar el máximo" title="Ancho efectivo máximo de la tabla 5.2.1.4.2" disabled={!flangeLimit}
                onClick={() => flangeLimit && set('flangeWidth')(String(Math.floor(flangeLimit.widthMm / 10)))} />
            </div>
          </> : null}
        </> : null}
        <NumberField label="Recubrimiento" unit="cm" value={draft.cover} onChange={set('cover')} />
        <MaterialFields fc={draft.fc} onFcChange={set('fc')} fy={draft.fy} onFyChange={set('fy')} fyv={draft.fyv} onFyvChange={set('fyv')} />
        <div className="dw-span-all"><ActionNote text={sectionNote} /></div>
      </FieldGroup>
      <FieldGroup title="Acero longitudinal y transversal">
        <BarSelect label="Estribo" value={draft.stirrup} onChange={set('stirrup')} allowAuto usage="transverse" />
        <div className="dw-span-all">
          <SegmentedControl label="Armado" size="sm" value={own ? 'own' : 'auto'} onValueChange={set('rebarMode')}
            options={[{ value: 'auto', label: 'Propuesto' }, { value: 'own', label: 'Propio' }]} />
        </div>
        {own ? <>
          <NumberField label="Corridas arriba" unit="pzas" value={draft.topCount} onChange={set('topCount')} min={2} />
          <BarSelect label="Diámetro arriba" value={draft.topBar} onChange={set('topBar')} minimumDiameterMm={12.7} />
          <NumberField label="Corridas abajo" unit="pzas" value={draft.bottomCount} onChange={set('bottomCount')} min={2} />
          <BarSelect label="Diámetro abajo" value={draft.bottomBar} onChange={set('bottomBar')} minimumDiameterMm={12.7} />
          <div className="dw-span-all">
            <SegmentedControl label="Bastones" size="sm" value={draft.ownBastions === 'none' ? 'none' : draft.ownBastions === 'custom' ? 'custom' : 'auto'} onValueChange={set('ownBastions')}
              options={[{ value: 'auto', label: 'Donde falten' }, { value: 'custom', label: 'Propios' }, { value: 'none', label: 'Sin bastones' }]} />
          </div>
          <UnitField label="Estribos @" unit="cm" value={draft.stirrupSpacing} onValueChange={set('stirrupSpacing')}
            placeholder="calculada" error={spacingError} hint={spacingError ? undefined : 'Vacío: la calcula por claro'} />
        </> : null}
      </FieldGroup>
      <MoreOptions>
        {code.usesStructureGroup ? <div className="dw-span-all">
          <GroupSelect value={draft.group} onChange={set('group')} groups={[{ value: 'B', label: 'Grupo B · 1.3 CM + 1.5 CV' }, { value: 'A', label: 'Grupo A · 1.5 CM + 1.7 CV' }]} />
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
        <BarSelect label="Varilla" value={draft.bar} onChange={set('bar')} allowAuto minimumDiameterMm={12.7} />
        <NumberField label="Agregado" unit="mm" value={draft.aggregate} onChange={set('aggregate')} />
        <NumberField label="Ancho de apoyo" unit="cm" value={draft.supportWidth} onChange={set('supportWidth')} />
        <div className="dw-span-all">
          <LayerToggle label="Soporta muros frágiles" checked={draft.damages === 'yes'}
            onCheckedChange={(checked) => set('damages')(checked ? 'yes' : 'no')} />
        </div>
      </MoreOptions>
    </>}
    stage={result.ok ? <>
      <Plate title="Elevación y envolventes" wide>
        <BeamElevation result={result} interactive />
      </Plate>
      <Plate title="Armado longitudinal" wide>
        <BeamRebarDetail result={result} />
      </Plate>
      {result.cuts.map((cut) => <Plate key={cut.label} title={cut.label} note={`x = ${meters(cut.xM)} m`}>
        <BeamSection result={result} cut={cut} />
      </Plate>)}
    </> : <ErrorsPanel errors={result.errors} />}
    results={result.ok ? <>
      <Verdict status={result.status} ratio={result.governingRatio} title={title} outOfScope={outOfScope.length}>
        <Summary rows={[
          { label: 'Mu positivo', value: `${formatNumber(result.extremes.positiveMomentKnm)} kN·m`, tone: 'moment' },
          { label: 'Mu negativo', value: `${formatNumber(result.extremes.negativeMomentKnm)} kN·m`, tone: 'moment' },
          { label: 'Vu', value: `${formatNumber(result.extremes.shearKn)} kN`, tone: 'shear' },
          { label: `Δ claro ${result.deflection.governingSpan + 1}`, value: `${formatNumber(result.deflection.checkedMm)} / ${formatNumber(result.deflection.limitMm)} mm` },
        ]} />
      </Verdict>
      <PanelSection title="Armado">
        <RebarList items={[
          { kind: 'bar', title: `${barsText(result.continuousTop.continuous)} corridas arriba` },
          { kind: 'bar', title: `${barsText(result.continuousBottom.continuous)} corridas abajo` },
          ...result.bastions.map((bastion) => ({ kind: 'extra' as const, title: bastionTitle(bastion), detail: `${meters(bastion.startM)} → ${meters(bastion.endM)} m` })),
          ...result.anchorages.filter((item) => item.kind !== 'straight').map((item) => ({
            kind: 'bar' as const,
            title: item.kind === 'hook' ? 'Gancho estándar' : 'Anclaje insuficiente',
            detail: `${item.bed === 'top' ? 'Superior' : 'Inferior'} · apoyo ${END_LABEL[item.end]}`,
          })),
          ...result.spans.map((span, index) => ({ kind: 'stirrup' as const, title: `Claro ${index + 1} · ${stirrupText(span.stirrups, result.stirrupDiameterMm)}` })),
          { kind: 'bar' as const, title: 'Traslapes', detail: `Arriba ${cm(result.splices.top)} · abajo ${cm(result.splices.bottom)}` },
        ]} />
      </PanelSection>
      {report?.alternative ? <AlternativeSection own={{ status: result.status, governingRatio: result.governingRatio, steelKg: report.takeoff.steelKg }} alternative={report.alternative} /> : null}
      <PanelSection title="Revisión"><ReviewList checks={checks} outOfScope={outOfScope} /></PanelSection>
      {report ? <TakeoffSection takeoff={report.takeoff} /> : null}
      <Disclosure label="Detalle del cálculo">
        <RebarList items={result.bastions.map((bastion) => ({ kind: 'extra' as const, title: bastionTitle(bastion), detail: bastionDetail(bastion) }))} />
        <table className="dw-table" aria-label="Envolvente por claro (kN·m, kN)">
          <thead><tr><th scope="col">Claro</th><th scope="col">M⁺</th><th scope="col">M⁻ izq</th><th scope="col">M⁻ der</th><th scope="col">V</th><th scope="col">Δ/lím</th></tr></thead>
          <tbody>{result.spans.map((span, index) => <tr key={index}>
            <th scope="row">{index + 1}</th>
            <td>{formatNumber(span.positiveMomentKnm)}</td>
            <td>{formatNumber(span.negativeLeftKnm)}</td>
            <td>{formatNumber(span.negativeRightKnm)}</td>
            <td>{formatNumber(span.shearKn)}</td>
            <td data-status={span.checkedDeflectionMm > span.deflectionLimitMm ? 'fail' : undefined}>{`${Math.round(span.checkedDeflectionMm / span.deflectionLimitMm * 100)} %`}</td>
          </tr>)}</tbody>
        </table>
        <ValuesTable rows={report?.values ?? []} />
        <ChecksList checks={notes} />
      </Disclosure>
    </> : null}
  />;
}
