import { Plus, Trash2 } from 'lucide-react';
import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { SegmentedControl, Select } from '../../../design-system/components/controls';
import { LayerToggle, UnitField } from '../../../design-system/components/editor';
import { MAX_SPANS, barsText, designBeam } from '../../../design/elements/beam';
import { designCode } from '../../../design/elements/codes';
import { BeamElevation, BeamRebarDetail, BeamSection } from './BeamDrawings';
import {
  BEAM_DEFAULTS, DEFAULT_SPANS, END_LABEL, ENDS, bastionDetail, bastionTitle, beamReport, beamToInput, cm, describeBeam, meters, parseSpans, stirrupText,
  type SpanDraft,
} from './beamModel';
import {
  AlternativeSection, BarSelect, ChecksList, IdentityGroup, ReviewList, Disclosure, ErrorsPanel, FieldGroup, GroupSelect, LIVE_LOAD_USES, LONG_TERM_DURATIONS, MoreOptions, NumberField,
  PanelSection, RebarList, Summary, TakeoffSection, ValuesTable, Verdict, formatNumber, parseNumber, readStored, useDraftHistory, useStoredDraft,
} from './common';
import { useWorkbenchStorage } from './workbenchStorage';
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
  const { draft, set, reset, replace } = useStoredDraft('beam', BEAM_DEFAULTS);
  const storage = useWorkbenchStorage();
  const [spans, setSpans] = useState<SpanDraft[]>(() => readStored(storage, 'beam-spans', parseSpans, DEFAULT_SPANS));
  useEffect(() => storage.write('beam-spans', spans.map((span) => ({ ...span }))), [spans, storage]);
  const snapshot = useMemo(() => ({ draft, spans }), [draft, spans]);
  const applySnapshot = useCallback((next: typeof snapshot) => { replace(next.draft); setSpans(next.spans); }, [replace]);
  const history = useDraftHistory(snapshot, applySnapshot);
  const { onHistory } = chrome;
  useEffect(() => onHistory?.(history), [history, onHistory]);
  const code = designCode(chrome.code);
  const own = draft.rebarMode === 'own';
  const input = useMemo(() => beamToInput(chrome.code, draft, spans), [chrome.code, draft, spans]);
  const deferred = useDeferredValue(input);
  const result = useMemo(() => designBeam(deferred), [deferred]);
  // Con armado propio, el propuesto con la misma entrada sirve de referencia.
  const proposed = useMemo(() => deferred.provided ? designBeam({ ...deferred, provided: null }) : undefined, [deferred]);
  const deferredDraft = useDeferredValue(draft);
  const report = useMemo(() => result.ok ? beamReport(result, deferredDraft, proposed?.ok ? proposed : undefined) : null, [result, proposed, deferredDraft]);
  const checks = report?.checks ?? [];
  const notes = report?.notes ?? [];
  const outOfScope = report?.outOfScope ?? [];
  const title = report?.title ?? '';
  const spacingValue = parseNumber(draft.stirrupSpacing);
  const spacingError = draft.stirrupSpacing.trim() !== '' && !(spacingValue >= 5) ? 'Mínimo 5 cm, o vacío para calcularla' : undefined;

  return <WorkbenchLayout
    chrome={chrome}
    title="Viga"
    report={report}
    onReset={() => { reset(); setSpans(DEFAULT_SPANS); }}
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
        <LayerToggle label="Cargas puntuales" checked={draft.points === 'yes'} onCheckedChange={(checked) => set('points')(checked ? 'yes' : 'no')} />
        <LayerToggle label="Sumar peso propio" checked={draft.selfWeight === 'yes'} onCheckedChange={(checked) => set('selfWeight')(checked ? 'yes' : 'no')} />
      </FieldGroup>
      <FieldGroup title="Sección">
        <NumberField label="Base b" unit="cm" value={draft.width} onChange={set('width')} />
        <NumberField label="Peralte h" unit="cm" value={draft.height} onChange={set('height')} />
        <NumberField label="Recubrimiento" unit="cm" value={draft.cover} onChange={set('cover')} />
      </FieldGroup>
      <FieldGroup title="Apoyos" columns={1}>
        <div className="dw-end"><span aria-hidden="true">Izquierdo</span><SegmentedControl label="Extremo izquierdo" size="sm" value={draft.leftEnd} options={ENDS} onValueChange={set('leftEnd')} /></div>
        <div className="dw-end"><span aria-hidden="true">Derecho</span><SegmentedControl label="Extremo derecho" size="sm" value={draft.rightEnd} options={ENDS} onValueChange={set('rightEnd')} /></div>
      </FieldGroup>
      <FieldGroup title="Materiales">
        <NumberField label="f′c" unit="kg/cm²" value={draft.fc} onChange={set('fc')} />
        <NumberField label="fy" unit="kg/cm²" value={draft.fy} onChange={set('fy')} />
      </FieldGroup>
      <FieldGroup title="Armado">
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
            <SegmentedControl label="Bastones" size="sm" value={draft.ownBastions === 'none' ? 'none' : 'auto'} onValueChange={set('ownBastions')}
              options={[{ value: 'auto', label: 'Donde falten' }, { value: 'none', label: 'Sin bastones' }]} />
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
        <BarSelect label="Estribo" value={draft.stirrup} onChange={set('stirrup')} allowAuto />
        <NumberField label="fy estribos" unit="kg/cm²" value={draft.fyv} onChange={set('fyv')} />
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
        <BeamElevation result={result} />
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
