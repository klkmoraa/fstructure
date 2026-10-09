import { AlertTriangle, CheckCircle2, CircleDashed } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SegmentedControl, Select } from '../../../design-system/components/controls';
import { designSectionStudio } from '../../../design/concrete/sectionStudio';
import { REBAR_SIZES, rebarLabel } from '../../../design/elements/shared';
import { ConcreteSectionDrawing, SectionEquilibriumDrawing, SectionInteractionDrawing, SectionLongitudinalDrawing } from './ConcreteStudioDrawings';
import { SECTION_DEFAULTS, SECTION_PHILOSOPHIES, SECTION_SHAPES, sectionDirectionNote, sectionDraftErrors, sectionHasPerpendicularMoment, sectionHeadline, sectionInput, sectionPhilosophy, sectionReport, sectionStatus, sectionVerdict } from './concreteStudioModel';
import {
  ActionNote, BarSelect, Disclosure, ErrorsPanel, FieldGroup, IdentityGroup, InlineAction, NumberField,
  PanelSection, RebarList, Summary, TakeoffSection, ValuesTable, formatNumber, parseNumber, useDraftHistory, useStoredDraft,
} from './common';
import { Plate, WorkbenchLayout, type WorkbenchChrome } from './WorkbenchLayout';
import { MaterialFields } from './MaterialFields';
import { startReinforcementProposal } from './reinforcementProposal';
import './concreteStudio.css';

const DRAWINGS = [
  { value: 'section', label: 'Sección' }, { value: 'interaction', label: 'Axial + flexión' },
  { value: 'equilibrium', label: 'Deformación' }, { value: 'longitudinal', label: 'Estribos' },
] as const;

export function ConcreteStudio({ chrome }: { chrome: WorkbenchChrome }) {
  const { draft, set, reset, replace } = useStoredDraft('section', SECTION_DEFAULTS);
  const history = useDraftHistory(draft, replace, 'section');
  const { onHistory } = chrome;
  useEffect(() => onHistory?.(history), [history, onHistory]);
  const [drawing, setDrawing] = useState<string>('section');
  const [actionNote, setActionNote] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);
  const [proposalCatalog, setProposalCatalog] = useState<'selected' | 'catalog'>('selected');
  const requestId = useRef(0);
  const activeProposal = useRef<{ key: string; cancel: () => void } | null>(null);
  const snapshotRef = useRef(draft);
  snapshotRef.current = draft;
  const snapshotKey = JSON.stringify({ code: chrome.code, draft });
  useEffect(() => {
    const active = activeProposal.current;
    if (active && active.key !== snapshotKey) {
      active.cancel();
      activeProposal.current = null;
      setProposing(false);
      setActionNote('Búsqueda cancelada: cambiaron los datos de entrada.');
    }
  }, [snapshotKey]);
  useEffect(() => () => activeProposal.current?.cancel(), []);
  const philosophy = sectionPhilosophy(draft);
  const circular = draft.shape === 'circle';
  const layered = draft.barLayout === 'layers';
  const rectangular = draft.shape === 'square' || draft.shape === 'rectangle';
  const result = useMemo(() => {
    const errors = sectionDraftErrors(draft);
    return errors.length ? { status: 'invalid' as const, errors } : designSectionStudio(sectionInput(draft));
  }, [draft]);
  const report = useMemo(() => result.status === 'ok' ? sectionReport(result, draft, chrome.code) : null, [result, draft, chrome.code]);
  const propose = () => {
    if (sectionDraftErrors(draft).length > 0) return;
    activeProposal.current?.cancel();
    const id = ++requestId.current;
    const key = JSON.stringify({ code: chrome.code, draft });
    setProposing(true);
    setActionNote(null);
    const cancel = startReinforcementProposal({
      kind: 'section', requestId: id, snapshot: { ...draft },
      ...(proposalCatalog === 'catalog' ? { diametersMm: REBAR_SIZES.map((size) => size.diameterMm) } : {}),
    }, (message) => {
      activeProposal.current = null;
      setProposing(false);
      const current = snapshotRef.current;
      if (JSON.stringify({ code: chrome.code, draft: current }) !== key) return;
      if (message.kind === 'failed') { setActionNote(message.reason); return; }
      replace({ ...current, ...message.fields });
      const distribution = current.barLayout === 'layers'
        ? `${message.fields.topBarCount} superiores · ${message.fields.bottomBarCount} inferiores`
        : current.barLayout === 'zones'
          ? `${message.fields.cornerBarCount} por esquina · ${message.fields.faceBarCount} por cara, grupos separados`
          : `${message.fields.barCount} barras en perímetro`;
      setActionNote(`Propuesta: ${distribution} de ${rebarLabel(Number(message.fields.bar))}; estribos @ ${message.fields.tieSpacing} cm. Revisa el alcance, la separación libre y el área As.`);
    });
    activeProposal.current = { key, cancel };
  };
  const cancelProposal = () => {
    activeProposal.current?.cancel();
    activeProposal.current = null;
    setProposing(false);
    setActionNote('Búsqueda cancelada.');
  };
  const chooseShape = (shape: string) => {
    const sides = shape === 'triangle' ? 3 : shape === 'hexagon' ? 6 : shape === 'octagon' ? 8 : 0;
    const count = parseNumber(draft.barCount);
    const barCount = sides > 0 && (!Number.isInteger(count) || count < sides || count % sides !== 0) ? shape === 'triangle' ? '6' : String(sides) : draft.barCount;
    replace({ ...draft, shape, barCount, barLayout: shape === 'square' || shape === 'rectangle' ? draft.barLayout : 'perimeter', tieType: shape === 'circle' ? draft.tieType === 'cross-tie' ? 'closed' : draft.tieType : draft.tieType === 'spiral' ? 'closed' : draft.tieType });
    setActionNote(null);
  };
  return <div className="cs-workbench"><WorkbenchLayout
    chrome={chrome} title="Secciones de concreto" report={report}
    onReset={() => { reset(); setActionNote(null); }}
    caption={`${philosophy.short} · ${SECTION_SHAPES.find((item) => item.value === draft.shape)?.label ?? 'Sección'} · experimental`}
    verdict={result.status === 'ok' ? { status: sectionStatus(result), label: sectionVerdict(result) } : { status: 'error', label: 'Revisa los datos' }}
    inputs={<>
      <div className="cs-intro"><span className="cs-experimental"><CircleDashed size={12} aria-hidden="true" />LABORATORIO DE SECCIONES</span></div>
      <FieldGroup title="Datos del problema">
        <Select label="Método de diseño" value={draft.philosophy} onChange={(event) => set('philosophy')(event.currentTarget.value)}>
          {SECTION_PHILOSOPHIES.map((item) => <option key={item.value} value={item.value}>{item.short} · {item.label}</option>)}
        </Select>
        {draft.philosophy !== 'allowable' ? <Select label="Base de las solicitaciones" value={draft.demandBasis} onChange={(event) => set('demandBasis')(event.currentTarget.value)}>
          <option value="factored">Últimas · ya factorizadas</option><option value="service">Servicio · aplicar factor global</option>
        </Select> : null}
        {draft.philosophy !== 'allowable' && draft.demandBasis === 'service' ? <NumberField label="Factor global de demanda" value={draft.loadFactor} unit="×" min={1} onChange={set('loadFactor')} hint="Aplicado a N, M y V; no genera combinaciones normativas." /> : null}
        <Select label="Forma de la sección" value={draft.shape} onChange={(event) => chooseShape(event.currentTarget.value)}>
          {SECTION_SHAPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
        <NumberField label={circular ? 'Diámetro D' : draft.shape === 'square' ? 'Lado b' : 'Base b'} value={draft.width} unit="cm" onChange={set('width')} />
        {draft.shape !== 'square' && !circular ? <NumberField label="Altura h" value={draft.height} unit="cm" onChange={set('height')} /> : null}
        <NumberField label="Recubrimiento libre" value={draft.cover} unit="cm" onChange={set('cover')} hint="Hasta el exterior del estribo." />
        <NumberField label="Longitud para cantidades" value={draft.length} unit="m" onChange={set('length')} />
        <MaterialFields fc={draft.fc} onFcChange={set('fc')} fy={draft.fy} onFyChange={set('fy')} />
        <NumberField label="Axial N · + compresión" value={draft.axial} unit="kN" min={-1e9} onChange={set('axial')} />
        <NumberField label="Momento M" value={draft.moment} unit="kN·m" min={-1e9} onChange={set('moment')} />
        <NumberField label="Cortante V · sin verificar" value={draft.shear} unit="kN" min={-1e9} onChange={set('shear')} />
      </FieldGroup>
      <FieldGroup title="Acero longitudinal" action={<InlineAction label={proposing ? 'Cancelar búsqueda' : 'Proponer acero'} title="Buscar armado con el diámetro elegido o comparar el catálogo" onClick={proposing ? cancelProposal : propose} disabled={!proposing && sectionDraftErrors(draft).length > 0} />}>
        {rectangular ? <div className="dw-span-all"><SegmentedControl label="Distribución longitudinal" size="sm" value={draft.barLayout} onValueChange={set('barLayout')} options={[{ value: 'perimeter', label: 'Perímetro' }, { value: 'layers', label: 'Lechos' }, { value: 'zones', label: 'Grupos separados' }]} /></div> : null}
        <BarSelect label="Diámetro longitudinal" value={draft.bar} onChange={set('bar')} />
        <div className="dw-span-all"><SegmentedControl label="Búsqueda de sección" size="sm" value={proposalCatalog} onValueChange={(value) => setProposalCatalog(value === 'catalog' ? 'catalog' : 'selected')} options={[{ value: 'selected', label: 'Diámetro elegido' }, { value: 'catalog', label: 'Comparar catálogo' }]} /></div>
        {layered ? <><NumberField label="Barras superiores" value={draft.topBarCount} unit="pzas" onChange={set('topBarCount')} /><NumberField label="Barras inferiores" value={draft.bottomBarCount} unit="pzas" onChange={set('bottomBarCount')} /></>
          : draft.barLayout === 'zones' ? <><NumberField label="Barras por esquina" value={draft.cornerBarCount} unit="pzas" min={1} max={3} onChange={set('cornerBarCount')} /><NumberField label="Barras por cara" value={draft.faceBarCount} unit="pzas" min={0} max={3} onChange={set('faceBarCount')} /><p className="cs-philosophy-note dw-span-all">Los grupos de esquina y de cara se distribuyen por separado; una cara puede tener 0–3 barras.</p></>
            : <NumberField label="Número de barras" value={draft.barCount} unit="pzas" min={2} onChange={set('barCount')} />}
        <div className="dw-span-all"><ActionNote text={actionNote} /></div>
      </FieldGroup>
      <FieldGroup title="Estribos y recubrimiento">
        <div className="dw-span-all"><Select label="Refuerzo transversal" value={draft.tieType} onChange={(event) => set('tieType')(event.currentTarget.value)}>
          <option value="closed">Estribo cerrado {circular ? 'circular' : 'según sección'}</option>
          {!circular ? <option value="cross-tie">Cerrado con grapas cruzadas</option> : null}
          {circular ? <option value="spiral">Zuncho helicoidal</option> : null}
        </Select></div>
        <BarSelect label={draft.tieType === 'spiral' ? 'Diámetro del zuncho' : 'Diámetro del estribo'} value={draft.tie} onChange={set('tie')} usage="transverse" />
        <NumberField label={draft.tieType === 'spiral' ? 'Paso manual' : 'Separación manual'} value={draft.tieSpacing} unit="cm" onChange={set('tieSpacing')} />
        {result.status === 'ok' ? <div className="dw-span-all"><button type="button" className="dw-inline-action" onClick={() => { set('tieSpacing')(String(Math.round(result.detailing.proposedTieSpacingMm) / 10)); setActionNote('Separación geométrica aplicada. El modelo no diseña cortante ni confinamiento sísmico.'); }}>Usar sugerencia · {formatNumber(result.detailing.proposedTieSpacingMm / 10, 1)} cm</button></div> : null}
      </FieldGroup>
      <Disclosure label="Orientación y factores ajustables">
        <FieldGroup title="Parámetros experimentales" columns={1}>
        <NumberField label="Eje de deformación θ" value={draft.angle} unit="°" min={-360} onChange={set('angle')} hint="0°: deformación variable en Y. No resuelve flexión biaxial." />
        {draft.philosophy === 'ultimate' ? <NumberField label="Reducción de resistencia φ" value={draft.phi} unit="×" onChange={set('phi')} /> : draft.philosophy === 'limit-state' ? <><NumberField label="Factor del concreto γc" value={draft.gammaConcrete} unit="×" min={1} onChange={set('gammaConcrete')} /><NumberField label="Factor del acero γs" value={draft.gammaSteel} unit="×" min={1} onChange={set('gammaSteel')} /></> : <><NumberField label="Límite concreto / f′c" value={draft.allowableConcrete} unit="×" onChange={set('allowableConcrete')} /><NumberField label="Límite acero / fy" value={draft.allowableSteel} unit="×" onChange={set('allowableSteel')} /></>}
        <p className="cs-philosophy-note">Parámetros editables; no son una norma.</p>
        </FieldGroup>
      </Disclosure>
      <Disclosure label="Clave y ubicación"><IdentityGroup tag={draft.tag} place={draft.place} onTag={set('tag')} onPlace={set('place')} example="S-1" /></Disclosure>
    </>}
    stage={result.status === 'ok' ? <div className="cs-stage">
      <header className="cs-sheet-header"><div><span className="dw-eyebrow">Concreto armado · estudio de sección</span><h2>{SECTION_SHAPES.find((p) => p.value === draft.shape)?.label ?? 'Sección'}</h2><p>{philosophy.label} · {result.analysis.model}</p></div><span className="cs-sheet-id">{draft.tag || 'S—01'}<br />{draft.shape.toUpperCase()}<br />EXPERIMENTAL</span></header>
      {sectionHasPerpendicularMoment(result) ? <p className="cs-direction-note"><AlertTriangle size={15} aria-hidden="true" /><span>{sectionDirectionNote(result)}</span></p> : null}
      <div className="cs-drawing-tabs" role="group" aria-label="Diagrama de la sección">{DRAWINGS.map((item) => <button key={item.value} type="button" aria-pressed={drawing === item.value} onClick={() => setDrawing(item.value)}>{item.label}</button>)}</div>
      {drawing === 'section' ? <Plate title="Armado y dimensiones" note="Coordenadas reales del modelo"><ConcreteSectionDrawing result={result} /></Plate> : drawing === 'interaction' ? <Plate title="Dominio de resistencia N–M" note={`θ = ${draft.angle}° · signo de M incluido`}><SectionInteractionDrawing result={result} /><ul className="dw-legend"><li data-kind="x">Capacidad {philosophy.short}</li><li data-kind="demand">Demanda</li></ul></Plate> : drawing === 'equilibrium' ? <Plate title="Deformación y equilibrio" note={draft.philosophy === 'allowable' ? 'Estado elástico de la demanda' : 'Punto de capacidad en la dirección de la demanda'}><SectionEquilibriumDrawing result={result} /></Plate> : <Plate title="Refuerzo transversal a lo largo del elemento" note="Separación manual proporcionada"><SectionLongitudinalDrawing result={result} /></Plate>}
      <div className="cs-caption"><span><b>As</b> {formatNumber(result.reinforcement.steelAreaMm2 / 100, 2)} cm²</span><span><b>ρ</b> {formatNumber(result.reinforcement.ratioPercent, 2)} %</span><span><b>Concreto</b> {formatNumber(result.quantities.concreteM3, 3)} m³</span><span><b>Acero</b> {formatNumber(result.quantities.totalSteelKg, 1)} kg</span><span><b>N · M</b> {formatNumber(result.demand.axialKn, 0)} kN · {formatNumber(result.demand.momentKnm, 0)} kN·m</span></div>
    </div> : <ErrorsPanel errors={result.errors} />}
    results={result.status === 'ok' ? <>
      <section className="cs-verdict" data-status={sectionStatus(result)} aria-live="polite"><span className="cs-experimental"><CircleDashed size={12} aria-hidden="true" />CÁLCULO EXPERIMENTAL</span><div className="cs-verdict__head"><strong>{sectionHeadline(result)}</strong><span>{Number.isFinite(result.utilization) ? Math.round(result.utilization * 100) : '>999'}<small>%</small></span></div><div className="dw-meter" role="meter" aria-label={sectionHasPerpendicularMoment(result) ? 'Utilización de la proyección N–M' : 'Utilización de capacidad de la sección'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Number.isFinite(result.utilization) ? result.utilization * 100 : 100)}><i style={{ width: `${Math.min(100, result.utilization * 100)}%` }} /></div><p>Axial y flexión en una sección aislada. {result.limitations.length} aspectos quedan sin evaluar. {result.detailing.checks.some((c) => c.status === 'warning') ? 'El detalle presenta observaciones.' : ''}</p><Summary rows={[{ label: 'Filosofía', value: `${philosophy.short} · ${philosophy.label}` }, { label: 'N de cálculo', value: `${formatNumber(result.demand.axialKn)} kN`, tone: 'axial' }, { label: 'M de cálculo', value: `${formatNumber(result.demand.momentKnm)} kN·m`, tone: 'moment' }, { label: 'V · sin verificar', value: `${formatNumber(result.demand.shearKn)} kN`, tone: 'shear' }]} /></section>
      {sectionHasPerpendicularMoment(result) ? <p className="cs-direction-note"><AlertTriangle size={15} aria-hidden="true" /><span>{sectionDirectionNote(result)}</span></p> : null}
      <PanelSection title="Armado proporcionado"><RebarList items={[
        { kind: 'bar', title: `${result.geometry.bars.length} ${rebarLabel(result.input.barDiameterMm)} · As ${formatNumber(result.reinforcement.steelAreaMm2 / 100, 2)} cm²`, detail: layered ? `${draft.topBarCount} superiores · ${draft.bottomBarCount} inferiores` : draft.barLayout === 'zones' ? `${draft.cornerBarCount} por esquina · ${draft.faceBarCount} por cara · grupos separados` : 'Distribución perimetral' },
        { kind: 'stirrup', title: `${draft.tieType === 'spiral' ? 'Zuncho' : draft.tieType === 'cross-tie' ? 'Estribos con grapas' : 'Estribos cerrados'} Ø ${draft.tie} mm`, detail: `@ ${draft.tieSpacing} cm · recubrimiento ${draft.cover} cm` },
      ]} /></PanelSection>
      <PanelSection title="Revisión del detalle"><ul className="cs-detail-checks">{result.detailing.checks.map((check) => <li key={check.id} data-status={check.id === 'shear' ? 'unevaluated' : check.status}><div>{check.id === 'shear' ? <CircleDashed size={14} aria-hidden="true" /> : check.status === 'ok' ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}<span>{check.label}{check.id === 'shear' ? ' · sin verificar' : ''}</span></div>{check.value !== null ? <small className="cs-check-value">{formatNumber(check.value, check.id === 'steel-ratio' ? 2 : 1)} {check.id === 'steel-ratio' ? '%' : check.id === 'shear' ? 'kN' : 'mm'}{check.limit !== null ? ` · referencia ${formatNumber(check.limit, 1)}` : ''}</small> : null}<p>{check.description}</p></li>)}</ul></PanelSection>
      {report ? <TakeoffSection takeoff={report.takeoff} /> : null}
      <Disclosure label="Alcance y aspectos sin evaluar"><ul className="cs-limitations">{result.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></Disclosure>
      <Disclosure label="Detalle del cálculo"><ValuesTable rows={report?.values ?? []} /><ul className="cs-limitations">{result.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul><ul className="cs-reference-list">{result.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></Disclosure>
    </> : null}
  /></div>;
}
