import { useEffect, useMemo, useRef, useState } from 'react';
import { SegmentedControl, Select } from '../../../design-system/components/controls';
import { BarSelect, FieldGroup, IdentityGroup, NumberField, ReviewList, Summary, ValuesTable, formatNumber, useDraftHistory, useStoredDraft } from './common';
import { FLEXURE_DEFAULTS, flexurePublishedReport, flexureReport, flexureToInput, type FlexureDraft, type FlexureObjective } from './flexureModel';
import { designFlexureExercise, type FlexureDimensionBounds } from '../../../design/elements/flexureExercise';
import { missingDataText, type DesignReport } from './designReport';
import { Plate, WorkbenchLayout, missingDataVerdict, verdictLabel, type WorkbenchChrome } from './WorkbenchLayout';
import { REBAR_SIZES } from '../../../design/elements/shared';
import { ReinforcementAlternatives } from './ReinforcementAlternatives';
import { startReinforcementAlternatives, type ReinforcementAlternativesRequest, type ReinforcementAlternativesResponse } from './reinforcementAlternativesClient';
import type { ReinforcementCandidate, ReinforcementObjective } from '../../../design/elements/reinforcementAlternatives';

const BOUNDS: FlexureDimensionBounds = { widthMinMm: 200, widthMaxMm: 600, heightMinMm: 250, heightMaxMm: 1500, stepMm: 50 };
/** Campos del cálculo: nombre para «Faltan: …» y el mínimo que exige (cualquier número, ≥ 0 o > 0). */
const FLEXURE_FIELDS = {
  width: { label: 'base b', min: 'positive' }, height: { label: 'peralte h', min: 'positive' }, moment: { label: 'Mu', min: 'any' },
  fc: { label: 'f′c', min: 'positive' }, fy: { label: 'fy', min: 'positive' },
  topCount: { label: 'barras arriba', min: 'positive' }, bottomCount: { label: 'barras abajo', min: 'positive' },
  topBar: { label: 'diámetro arriba', min: 'positive' }, bottomBar: { label: 'diámetro abajo', min: 'positive' },
  cover: { label: 'recubrimiento', min: 'zero' }, stirrup: { label: 'estribo de referencia', min: 'positive' }, aggregate: { label: 'agregado máximo', min: 'zero' },
} as const satisfies Partial<Record<keyof FlexureDraft, { label: string; min: 'any' | 'zero' | 'positive' }>>;

/** Lo que falta o no es válido para calcular la flexión (nombres de campo). */
const missingFlexure = (draft: FlexureDraft, requireSection = true) => {
  const topTension = Number(draft.moment) < 0;
  const fields: (keyof typeof FLEXURE_FIELDS)[] = [...(requireSection ? ['width', 'height'] as const : []), 'moment', 'fc', 'fy',
    topTension ? 'topCount' : 'bottomCount', topTension ? 'topBar' : 'bottomBar', 'cover', 'stirrup', 'aggregate'];
  return fields.filter((field) => {
    const value = Number(draft[field]);
    const { min } = FLEXURE_FIELDS[field];
    return draft[field].trim() === '' || !Number.isFinite(value) || (min === 'positive' ? !(value > 0) : min === 'zero' ? value < 0 : false);
  }).map((field) => FLEXURE_FIELDS[field].label);
};
const complete = (draft: FlexureDraft, requireSection = true) => missingFlexure(draft, requireSection).length === 0;

export function FlexureWorkbench({ chrome }: { chrome: WorkbenchChrome }) {
  const { draft, set, reset, replace } = useStoredDraft('flexure', FLEXURE_DEFAULTS);
  const history = useDraftHistory(draft, replace, 'flexure');
  useEffect(() => chrome.onHistory?.(history), [chrome.onHistory, history]);
  const input = useMemo(() => flexureToInput(chrome.code, draft), [chrome.code, draft]);
  const sectionComplete = Number(draft.width) > 0 && Number(draft.height) > 0 && draft.width.trim() !== '' && draft.height.trim() !== '';
  const result = useMemo(() => sectionComplete && complete(draft) ? designFlexureExercise(input) : null, [draft, input, sectionComplete]);
  const [proposal, setProposal] = useState<{ key: string; result: ReturnType<typeof designFlexureExercise>; widthMm: number; heightMm: number } | null>(null);
  const [appliedInputKey, setAppliedInputKey] = useState('');
  const requestId = useRef(0);
  const [proposalState, setProposalState] = useState<'idle' | 'searching' | 'none' | 'error'>('idle');
  const [alternativeObjective, setAlternativeObjective] = useState<ReinforcementObjective>('minimum-steel');
  const [availableDiameters, setAvailableDiameters] = useState<number[]>(() => REBAR_SIZES.map((bar) => bar.diameterMm));
  const [alternatives, setAlternatives] = useState<ReinforcementAlternativesResponse | null>(null);
  const [alternativeSearch, setAlternativeSearch] = useState(false);
  const alternativeRequest = useRef<{ key: string; cancel: () => void } | null>(null);
  const alternativeRequestId = useRef(0);
  const inputKey = JSON.stringify(input);
  const alternativesKey = JSON.stringify({ input, objective: alternativeObjective, stock: availableDiameters });
  const alternativesKeyRef = useRef(alternativesKey);
  alternativesKeyRef.current = alternativesKey;
  useEffect(() => {
    if (alternativeRequest.current && alternativeRequest.current.key !== alternativesKey) {
      alternativeRequest.current.cancel(); alternativeRequest.current = null; setAlternativeSearch(false); setAlternatives(null);
    }
    setAlternatives(null);
  }, [alternativesKey]);
  useEffect(() => () => alternativeRequest.current?.cancel(), []);
  const runAlternatives = () => {
    if (alternativeRequest.current) { alternativeRequest.current.cancel(); alternativeRequest.current = null; setAlternativeSearch(false); return; }
    if (!complete(draft) || (objective !== 'check' && objective !== 'required')) return;
    const requestId = ++alternativeRequestId.current;
    const key = alternativesKey;
    const request: ReinforcementAlternativesRequest = {
      kind: 'flexure', requestId, input, objective: alternativeObjective,
      ...(alternativeObjective === 'available-bars' ? { availableDiametersMm: availableDiameters } : {}),
    };
    setAlternatives(null); setAlternativeSearch(true);
    const cancel = startReinforcementAlternatives(request, (response: ReinforcementAlternativesResponse) => {
      alternativeRequest.current = null; setAlternativeSearch(false);
      if (alternativesKeyRef.current !== key) return;
      setAlternatives(response);
    });
    alternativeRequest.current = { key, cancel };
  };
  const applyAlternative = (candidate: ReinforcementCandidate) => {
    const bed = candidate.reinforcement.bed;
    const next = { ...draft, objective: 'check', [bed === 'top' ? 'topCount' : 'bottomCount']: String(candidate.reinforcement.group.count), [bed === 'top' ? 'topBar' : 'bottomBar']: String(candidate.reinforcement.group.diameterMm) };
    if (!replace(next)) return;
    setAlternatives(null);
    setAlternativeSearch(false);
  };
  useEffect(() => {
    const id = ++requestId.current;
    setProposal(null);
    if (draft.objective !== 'dimensions' || !complete(draft, false) || appliedInputKey === inputKey) { setProposalState('idle'); return; }
    setProposalState('searching');
    const worker = new Worker(new URL('./flexureProposal.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ requestId: number; proposal?: { widthMm: number; heightMm: number; result: ReturnType<typeof designFlexureExercise> }; error?: string }>) => {
      if (event.data.requestId !== requestId.current || event.data.requestId !== id) return;
      if (event.data.error) { setProposalState('error'); return; }
      const value = event.data.proposal;
      if (!value) { setProposalState('none'); return; }
      setProposal({ key: inputKey, result: value.result, widthMm: value.widthMm, heightMm: value.heightMm });
      setProposalState('idle');
    };
    worker.onerror = () => { if (id === requestId.current) setProposalState('error'); };
    worker.postMessage({ requestId: id, input, bounds: BOUNDS });
    return () => { requestId.current += 1; worker.terminate(); };
  }, [draft.objective, inputKey, appliedInputKey]);
  const report: DesignReport | null = useMemo(() => result ? flexureReport(chrome.code, draft) : null, [result, chrome.code, draft]);
  const objective = draft.objective as FlexureObjective;
  const tensionBed = draft.moment.trim() !== '' && Number.isFinite(Number(draft.moment)) ? (Number(draft.moment) < 0 ? 'top' : 'bottom') : null;
  const preview = objective === 'dimensions' && proposal?.key === inputKey && appliedInputKey !== inputKey ? proposal : null;
  const visibleResult = preview?.result ?? result;
  const visibleWidthMm = preview?.widthMm ?? input.widthMm;
  const visibleHeightMm = preview?.heightMm ?? input.heightMm;
  const visibleReport = useMemo(() => preview
    ? flexureReport(chrome.code, { ...draft, width: String(preview.widthMm / 10), height: String(preview.heightMm / 10) }) : report, [preview, chrome.code, draft, report]);
  const publishedReport = flexurePublishedReport(objective, inputKey, appliedInputKey, Boolean(preview), report);

  return <WorkbenchLayout chrome={chrome} title="Flexión" report={publishedReport} onReset={reset}
    verdict={visibleResult ? { status: objective === 'required' ? 'warning' : visibleResult.status, label: objective === 'required' ? 'As requerida' : verdictLabel(visibleResult.status, visibleResult.capacityKnM ? Math.abs(input.momentKnM) / visibleResult.capacityKnM : 0) } : missingDataVerdict(missingFlexure(draft))}
    caption={visibleResult ? `${formatNumber(visibleResult.capacityKnM)} kN·m · d ${formatNumber(visibleResult.effectiveDepthMm, 1)} mm` : undefined}
    inputs={<>
      <IdentityGroup tag={draft.tag} place={draft.place} onTag={set('tag')} onPlace={set('place')} />
      <FieldGroup title="Objetivo" columns={1}>
        <SegmentedControl className="dw-flexure-objective" label="Objetivo de flexión" value={objective} onValueChange={(value) => set('objective')(value)} options={[
          { value: 'required', label: 'Calcular acero' }, { value: 'check', label: 'Revisar armado' }, { value: 'dimensions', label: 'Dimensionar sección' },
        ]} />
        <p className="dw-help">{objective === 'required' ? 'Obtén As requerida para el momento dado.' : objective === 'check' ? 'Comprueba el armado capturado frente al momento dado.' : 'Busca la menor área de sección con las barras elegidas; sólo revisa flexión.'}</p>
      </FieldGroup>
      <FieldGroup title="Momento último dado" columns={1}>
        <NumberField label="Mu (positivo: tensión abajo; negativo: tensión arriba)" unit="kN·m" value={draft.moment} onChange={set('moment')} min={-1e6} />
      </FieldGroup>
      <FieldGroup title="Sección y materiales">
        {objective === 'dimensions' ? <p className="dw-help dw-span-all">b y h son incógnitas de la búsqueda; aplica la propuesta para guardarlas en el borrador.</p> : <><NumberField label="Base b" unit="cm" value={draft.width} onChange={set('width')} min={1} /><NumberField label="Peralte h" unit="cm" value={draft.height} onChange={set('height')} min={1} /></>}
        <NumberField label="f′c" unit="kg/cm²" value={draft.fc} onChange={set('fc')} min={1} />
        <NumberField label="fy" unit="kg/cm²" value={draft.fy} onChange={set('fy')} min={1} />
        <NumberField label="Recubrimiento · hipótesis para d" unit="cm" value={draft.cover} onChange={set('cover')} min={0} hint="Referencia editable; no se indicó como dato dado." />
        <Select label="Estribo de referencia" value={draft.stirrup} onChange={(event) => set('stirrup')(event.currentTarget.value)}>{['6.4','9.5','12.7'].map((value) => <option key={value} value={value}>Ø {value} mm</option>)}</Select>
        <NumberField label="Agregado máximo" unit="mm" value={draft.aggregate} onChange={set('aggregate')} min={0} />
      </FieldGroup>
      {tensionBed ? <FieldGroup title={objective === 'required' ? `Barras de referencia · lecho ${tensionBed === 'top' ? 'superior' : 'inferior'}` : `Armado propio · lecho ${tensionBed === 'top' ? 'superior' : 'inferior'}`}>
        <NumberField label={`Barras ${tensionBed === 'top' ? 'arriba' : 'abajo'}`} unit="pzas" value={draft[tensionBed === 'top' ? 'topCount' : 'bottomCount']} onChange={set(tensionBed === 'top' ? 'topCount' : 'bottomCount')} min={1} />
        <BarSelect label={`Diámetro ${tensionBed === 'top' ? 'arriba' : 'abajo'}`} value={draft[tensionBed === 'top' ? 'topBar' : 'bottomBar']} onChange={set(tensionBed === 'top' ? 'topBar' : 'bottomBar')} />
        <p className="dw-help dw-span-all">{objective === 'required' ? 'Hipótesis editable para estimar d; no se presenta como dato dado ni se verifica.' : 'Sólo este lecho interviene en el cálculo de As y resistencia.'}</p>
      </FieldGroup> : <p className="dw-help">Captura Mu para identificar el lecho a tensión y solicitar sólo esas barras.</p>}
      {objective === 'dimensions' ? <FieldGroup title="Búsqueda acotada" columns={1}>
        <p className="dw-help">b 200–600 mm · h 250–1500 mm · pasos de 50 mm. Se conserva Mu, materiales y barras. La propuesta sólo considera flexión simple.</p>
        {proposalState === 'searching' ? <div className="dw-action-note"><p role="status">Buscando una sección…</p><button type="button" className="dw-inline-action" onClick={() => { setProposal(null); set('objective')('required'); }}>Cancelar búsqueda</button></div> : null}
        {proposalState === 'none' ? <p role="status">No hay una sección factible dentro de estos límites con las barras actuales.</p> : null}
        {proposalState === 'error' ? <p role="alert">No se pudo completar la búsqueda. Los datos siguen disponibles.</p> : null}
        {appliedInputKey === inputKey && result ? <p role="status">Dimensiones aplicadas: {draft.width} × {draft.height} cm. La búsqueda por flexión no evalúa otros estados límite.</p> : null}
        {preview ? <div className="dw-action-note"><span>Vista previa: {preview.widthMm} × {preview.heightMm} mm · As prov {formatNumber(preview.result.providedMm2, 1)} mm². La memoria y el PDF cambian al aplicar.</span>
          <button type="button" className="dw-inline-action" onClick={() => { const next = { ...draft, width: String(preview.widthMm / 10), height: String(preview.heightMm / 10) }; if (!replace(next)) return; setAppliedInputKey(JSON.stringify(flexureToInput(chrome.code, next))); }}>Aplicar dimensiones</button>
          <button type="button" className="dw-inline-action" onClick={() => { setProposal(null); set('objective')('required'); }}>Descartar</button></div> : null}
      </FieldGroup> : null}
      {(objective === 'check' || objective === 'required') ? <FieldGroup title="Alternativas de armado · sección fija" columns={1}>
        <Select label="Criterio de comparación" value={alternativeObjective} onChange={(event) => setAlternativeObjective(event.currentTarget.value as ReinforcementObjective)}>
          <option value="minimum-steel">Menor área de acero</option><option value="few-diameters">Menos diámetros</option><option value="available-bars">Diámetros disponibles</option>
        </Select>
        {alternativeObjective === 'available-bars' ? <details className="dw-span-all"><summary>Diámetros en existencia · solo esta sesión</summary>
          <div className="dw-group__grid" data-columns={3}>{REBAR_SIZES.map((bar) => <label key={bar.diameterMm} className="dw-check"><input type="checkbox" checked={availableDiameters.includes(bar.diameterMm)} onChange={(event) => { const checked = event.currentTarget.checked; setAvailableDiameters((current) => checked ? [...new Set([...current, bar.diameterMm])].sort((a, b) => a - b) : current.filter((value) => value !== bar.diameterMm)); }} /> Ø {bar.diameterMm} mm</label>)}</div>
        </details> : null}
        <button type="button" className="dw-inline-action" onClick={runAlternatives}>{alternativeSearch ? 'Cancelar comparación' : 'Comparar armados'}</button>
        {alternativeSearch ? <p role="status">Comparando opciones con el mismo momento, sección y materiales…</p> : null}
        {alternatives ? <ReinforcementAlternatives candidates={alternatives.candidates} onApply={applyAlternative} /> : null}
        {alternatives?.reason === 'empty-stock' ? <p role="alert">Selecciona al menos un diámetro disponible del catálogo para comparar.</p> : null}
        {alternatives?.reason === 'no-feasible-candidate' ? <p role="status">Ninguna combinación del catálogo cabe y pasa las verificaciones evaluadas para esta geometría y Mu.</p> : null}
        {alternatives?.error ? <p role="alert">No se pudo ejecutar la comparación en segundo plano. Las entradas siguen disponibles.</p> : null}
        <p className="dw-help">El peso estima barras longitudinales de 1 m y excluye estribos y anclajes. Cortante, desarrollo, servicio, axial y biaxial siguen fuera de alcance. Las disponibilidades duran esta sesión.</p>
      </FieldGroup> : null}
    </>}
    stage={<Plate title="Sección rectangular" note={visibleResult ? `Mu ${formatNumber(input.momentKnM)} kN·m · tensión ${visibleResult.layout.tensionBed === 'top' ? 'arriba' : 'abajo'}` : missingDataText(missingFlexure(draft))}>
      <svg className="dw-drawing" viewBox="0 0 320 220" role="img" aria-label="Esquema de sección rectangular a flexión">
        <rect x="90" y="30" width="140" height="160" fill="none" stroke="currentColor" strokeWidth="2" />
        {visibleResult?.layout.bars?.map((bar, index) => {
          const scale = Math.min(140 / visibleWidthMm, 160 / visibleHeightMm);
          return <circle key={index} cx={90 + bar.xMm / visibleWidthMm * 140} cy={visibleResult.layout.tensionBed === 'bottom' ? 190 - bar.fromFaceMm / visibleHeightMm * 160 : 30 + bar.fromFaceMm / visibleHeightMm * 160} r={Math.max(1, Math.min(5, bar.diameterMm * scale / 2))} fill="currentColor" />;
        })}
        <text fill="currentColor" x="160" y="18" textAnchor="middle">b = {preview ? formatNumber(visibleWidthMm / 10, 0) : draft.width || '—'} cm</text><text fill="currentColor" x="244" y="110" dominantBaseline="middle">h = {preview ? formatNumber(visibleHeightMm / 10, 0) : draft.height || '—'} cm</text>
        <text fill="currentColor" x="160" y="212" textAnchor="middle">{visibleResult ? `Lecho a tensión ${visibleResult.layout.tensionBed === 'top' ? 'superior' : 'inferior'}` : 'Sección sin escalar'}</text>
      </svg>
    </Plate>}
    results={visibleResult && visibleReport ? <>
      {objective === 'required' ? <p>Las barras y el recubrimiento son referencias editables para estimar d; aún no se revisa un armado propio.</p> : null}
      {preview ? <p role="status">Vista previa de dimensionamiento; el reporte vigente conserva las dimensiones capturadas.</p> : null}
      <Summary rows={[{ label: 'Mu', value: `${formatNumber(input.momentKnM)} kN·m`, tone: 'moment' }, { label: 'As requerida', value: `${formatNumber(visibleResult.requiredMm2, 2)} mm²` }, ...(objective === 'required' ? [] : [{ label: 'As proporcionada', value: `${formatNumber(visibleResult.providedMm2, 2)} mm²` }])]} />
      <ValuesTable rows={visibleReport.values} />
      <ReviewList checks={[...visibleReport.checks, ...visibleReport.notes]} outOfScope={visibleReport.outOfScope} />
    </> : <p className="dw-empty">{objective === 'dimensions' ? 'Completa Mu, materiales y barras; b y h se buscan dentro de los límites indicados.' : 'Completa Mu, sección y materiales para calcular.'}</p>}
  />;
}
