import { useEffect, useMemo, useRef, useState } from 'react';
import { SegmentedControl, Select } from '../../../design-system/components/controls';
import { BarSelect, FieldGroup, IdentityGroup, NumberField, ReviewList, Summary, ValuesTable, formatNumber, useDraftHistory, useStoredDraft } from './common';
import { FLEXURE_DEFAULTS, flexurePublishedReport, flexureReport, flexureToInput, type FlexureDraft, type FlexureObjective } from './flexureModel';
import { designFlexureExercise, type FlexureDimensionBounds } from '../../../design/elements/flexureExercise';
import type { DesignReport } from './designReport';
import { Plate, WorkbenchLayout, verdictLabel, type WorkbenchChrome } from './WorkbenchLayout';

const BOUNDS: FlexureDimensionBounds = { widthMinMm: 200, widthMaxMm: 600, heightMinMm: 250, heightMaxMm: 1500, stepMm: 50 };
const complete = (draft: FlexureDraft, requireSection = true) => {
  const topTension = Number(draft.moment) < 0;
  const fields: (keyof FlexureDraft)[] = ['fc', 'fy', 'moment', topTension ? 'topCount' : 'bottomCount', topTension ? 'topBar' : 'bottomBar', 'cover', 'stirrup', 'aggregate', ...(requireSection ? ['width', 'height'] as const : [])];
  return fields.every((field) => draft[field].trim() !== '' && Number.isFinite(Number(draft[field])))
    && (!requireSection || Number(draft.width) > 0 && Number(draft.height) > 0)
    && Number(draft.fc) > 0 && Number(draft.fy) > 0 && Number(draft.cover) >= 0 && Number(draft.stirrup) > 0 && Number(draft.aggregate) >= 0
    && Number(topTension ? draft.topCount : draft.bottomCount) > 0 && Number(topTension ? draft.topBar : draft.bottomBar) > 0;
};

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
  const inputKey = JSON.stringify(input);
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
  const visibleReport = useMemo(() => preview
    ? flexureReport(chrome.code, { ...draft, width: String(preview.widthMm / 10), height: String(preview.heightMm / 10) }) : report, [preview, chrome.code, draft, report]);
  const publishedReport = flexurePublishedReport(objective, inputKey, appliedInputKey, Boolean(preview), report);

  return <WorkbenchLayout chrome={chrome} title="Flexión" report={publishedReport} onReset={reset}
    verdict={visibleResult ? { status: objective === 'required' ? 'warning' : visibleResult.status, label: objective === 'required' ? 'As requerida' : verdictLabel(visibleResult.status, visibleResult.capacityKnM ? Math.abs(input.momentKnM) / visibleResult.capacityKnM : 0, visibleResult.checks.some((check) => check.status === 'out-of-scope')) } : { status: 'error', label: 'Datos incompletos' }}
    caption={visibleResult ? `${formatNumber(visibleResult.capacityKnM)} kN·m · d ${formatNumber(visibleResult.effectiveDepthMm, 1)} mm` : undefined}
    inputs={<>
      <IdentityGroup tag={draft.tag} place={draft.place} onTag={set('tag')} onPlace={set('place')} />
      <FieldGroup title="Objetivo" columns={1}>
        <SegmentedControl label="Objetivo de flexión" value={objective} onValueChange={(value) => set('objective')(value)} options={[
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
          <button type="button" className="dw-inline-action" onClick={() => { const next = { ...draft, width: String(preview.widthMm / 10), height: String(preview.heightMm / 10) }; setAppliedInputKey(JSON.stringify(flexureToInput(chrome.code, next))); replace(next); }}>Aplicar dimensiones</button>
          <button type="button" className="dw-inline-action" onClick={() => { setProposal(null); set('objective')('required'); }}>Descartar</button></div> : null}
      </FieldGroup> : null}
    </>}
    stage={<Plate title="Sección rectangular" note={visibleResult ? `Mu ${formatNumber(input.momentKnM)} kN·m · tensión ${visibleResult.layout.tensionBed === 'top' ? 'arriba' : 'abajo'}` : 'Captura el momento, sección y materiales dados.'}>
      <svg viewBox="0 0 320 220" role="img" aria-label="Esquema de sección rectangular a flexión">
        <rect x="90" y="30" width="140" height="160" fill="none" stroke="currentColor" strokeWidth="2" />
        {visibleResult?.layout.bars?.map((bar, index) => <circle key={index} cx={90 + bar.xMm / 3} cy={visibleResult.layout.tensionBed === 'bottom' ? 190 - bar.fromFaceMm / 3 : 30 + bar.fromFaceMm / 3} r="5" fill="currentColor" />)}
        <text fill="currentColor" x="160" y="18" textAnchor="middle">b = {draft.width || '—'} cm</text><text fill="currentColor" x="244" y="110">h = {draft.height || '—'} cm</text>
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
