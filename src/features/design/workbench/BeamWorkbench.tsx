import { Plus, Trash2 } from 'lucide-react';
import { Fragment, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { SegmentedControl, Select } from '../../../design-system/components/controls';
import { LayerToggle } from '../../../design-system/components/editor';
import { MAX_SPANS, barsText, designBeam, type BeamDesignInput, type BeamDesignResult, type BeamEnd, type SpanStirrups } from '../../../design/elements/beam';
import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import { rebarLabel } from '../../../design/elements/shared';
import { BeamElevation, BeamRebarDetail, BeamSection } from './BeamDrawings';
import {
  BarSelect, ChecksList, ErrorsPanel, FieldGroup, GroupSelect, LIVE_LOAD_USES, LONG_TERM_DURATIONS, MoreOptions, NumberField, PanelSection, RebarList, Summary,
  ValuesTable, Verdict, formatNumber, isShortString, mpaFromKgcm2, mpaHint, parseNumber, readStored, sustainedRatioFor, useStoredDraft, xiFor,
} from './common';
import { useWorkbenchStorage } from './workbenchStorage';
import { Plate, StatusBadge, WorkbenchLayout, type WorkbenchChrome } from './WorkbenchLayout';

const DEFAULTS = {
  width: '25', height: '50', cover: '4', fc: '250', fy: '4200', fyv: '4200', leftEnd: 'pin', rightEnd: 'pin',
  selfWeight: 'yes', points: 'no', group: 'B', use: 'habitacion', sustained: '25', duration: '60', bar: 'auto', stirrup: 'auto', aggregate: '19', damages: 'no',
  supportWidth: '40',
};

interface SpanDraft { length: string; dead: string; live: string; pointDead: string; pointLive: string; pointAt: string }
const SPAN_FIELDS = ['length', 'dead', 'live', 'pointDead', 'pointLive', 'pointAt'] as const;
const DEFAULT_SPANS: SpanDraft[] = [
  { length: '5', dead: '15', live: '10', pointDead: '0', pointLive: '0', pointAt: '2.5' },
  { length: '4', dead: '15', live: '10', pointDead: '0', pointLive: '0', pointAt: '2' },
];

const ENDS: { value: BeamEnd; label: string }[] = [
  { value: 'pin', label: 'Apoyo' },
  { value: 'fixed', label: 'Empotre' },
  { value: 'free', label: 'Libre' },
];

const parseSpans = (raw: unknown): SpanDraft[] | undefined => {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_SPANS) return undefined;
  const spans = raw.map((item: unknown) => {
    if (!item || typeof item !== 'object') return undefined;
    const record = item as Record<string, unknown>;
    // Borradores anteriores no tenían la posición de la carga puntual: se asume al centro.
    const pointAt = isShortString(record.pointAt) ? record.pointAt : isShortString(record.length) ? String(parseNumber(record.length) / 2) : undefined;
    const withPoint: Record<string, unknown> = { ...record, pointAt };
    return SPAN_FIELDS.every((field) => isShortString(withPoint[field])) ? Object.fromEntries(SPAN_FIELDS.map((field) => [field, withPoint[field]])) as unknown as SpanDraft : undefined;
  });
  return spans.every(Boolean) ? spans as SpanDraft[] : undefined;
};

const toEnd = (value: string): BeamEnd => ENDS.some((item) => item.value === value) ? value as BeamEnd : 'pin';

const toInput = (codeId: DesignCodeId, draft: typeof DEFAULTS, spans: readonly SpanDraft[]): BeamDesignInput => ({
  code: codeId,
  widthMm: parseNumber(draft.width) * 10,
  heightMm: parseNumber(draft.height) * 10,
  coverMm: parseNumber(draft.cover) * 10,
  fcMpa: mpaFromKgcm2(draft.fc),
  fyMpa: mpaFromKgcm2(draft.fy),
  fyStirrupMpa: mpaFromKgcm2(draft.fyv),
  spans: spans.map((span) => {
    const points = draft.points === 'yes';
    return {
      lengthM: parseNumber(span.length),
      deadKnPerM: parseNumber(span.dead),
      liveKnPerM: parseNumber(span.live),
      pointDeadKn: points ? parseNumber(span.pointDead) : 0,
      pointLiveKn: points ? parseNumber(span.pointLive) : 0,
      pointAtM: points ? parseNumber(span.pointAt) : parseNumber(span.length) / 2,
    };
  }),
  leftEnd: toEnd(draft.leftEnd),
  rightEnd: toEnd(draft.rightEnd),
  includeSelfWeight: draft.selfWeight === 'yes',
  combinations: designCode(codeId).loadCombinations(draft.group === 'A' ? 'A' : 'B'),
  sustainedLiveRatio: designCode(codeId).sustainedLive === 'use' ? sustainedRatioFor(draft.use) : parseNumber(draft.sustained) / 100,
  longTermXi: xiFor(draft.duration),
  barDiameterMm: draft.bar === 'auto' ? null : parseNumber(draft.bar),
  stirrupDiameterMm: draft.stirrup === 'auto' ? null : parseNumber(draft.stirrup),
  maxAggregateMm: parseNumber(draft.aggregate),
  damagesNonstructural: draft.damages === 'yes',
  supportWidthMm: parseNumber(draft.supportWidth) * 10,
});

const cm2 = (mm2: number) => `${formatNumber(mm2 / 100, 2)} cm²`;
const cm = (mm: number) => `${formatNumber(mm / 10, 0)} cm`;
const meters = (m: number) => formatNumber(m, 2);

function stirrupText(stirrups: SpanStirrups, diameterMm: number) {
  const size = rebarLabel(diameterMm);
  if (stirrups.denseZones.length === 0) return `E ${size} @ ${cm(stirrups.denseSpacingMm)}`;
  return `E ${size} @ ${cm(stirrups.denseSpacingMm)} en zonas de cortante · @ ${cm(stirrups.centerSpacingMm)} resto`;
}

const describe = (input: BeamDesignInput) => {
  const count = input.spans.length;
  if (count === 1 && (input.leftEnd === 'free' || input.rightEnd === 'free')) return 'Voladizo';
  if (count === 1) return input.leftEnd === 'fixed' && input.rightEnd === 'fixed' ? 'Doblemente empotrada' : input.leftEnd === 'fixed' || input.rightEnd === 'fixed' ? 'Empotrada–apoyada' : 'Simplemente apoyada';
  return `Continua · ${count} claros`;
};

const bastionTitle = (bastion: BeamDesignResult['bastions'][number]) =>
  `Bastón ${bastion.bed === 'top' ? 'superior' : 'inferior'} ${barsText(bastion.bars)}`;
const bastionDetail = (bastion: BeamDesignResult['bastions'][number]) =>
  `x = ${meters(bastion.startM)} → ${meters(bastion.endM)} m · ${meters(bastion.endM - bastion.startM)} m · ld ${cm(bastion.developmentLengthMm)}${bastion.needsHook ? ' · con gancho' : ''}`;

const END_LABEL = { left: 'izquierdo', right: 'derecho' } as const;
const anchorageText = (item: BeamDesignResult['anchorages'][number]) =>
  `${item.bed === 'top' ? 'Superior' : 'Inferior'} en el apoyo ${END_LABEL[item.end]}: ${item.kind === 'straight'
    ? `recta, ld ${cm(item.straightMm)}`
    : item.kind === 'hook' ? `gancho estándar, ldh ${cm(item.hookMm)}` : `no cabe (ldh ${cm(item.hookMm)} > ${cm(item.availableMm)})`}`;

function beamMemo(result: BeamDesignResult): string {
  const { input } = result;
  return [
    `VIGA ${input.widthMm / 10}×${input.heightMm / 10} cm · ${describe(input)} · L = ${input.spans.map((span) => span.lengthM).join(' + ')} m · ${designCode(input.code).name}`,
    `Combinaciones: ${input.combinations.map((combination) => combination.label).join(' · ')}`,
    `Envolvente del solver 2D (${result.solverRuns} análisis): Mu+ = ${formatNumber(result.extremes.positiveMomentKnm)} kN·m · Mu− = ${formatNumber(result.extremes.negativeMomentKnm)} kN·m · Vu = ${formatNumber(result.extremes.shearKn)} kN`,
    `Corridas: ${barsText(result.continuousTop.continuous)} arriba · ${barsText(result.continuousBottom.continuous)} abajo`,
    ...result.bastions.map((bastion) => `${bastionTitle(bastion)}: ${bastionDetail(bastion)}`),
    ...result.anchorages.map((item) => `Anclaje ${anchorageText(item)}`),
    `Traslapes Clase B: superior ${cm(result.splices.top)} · inferior ${cm(result.splices.bottom)}`,
    ...result.spans.map((span, index) => `Claro ${index + 1}: ${stirrupText(span.stirrups, result.stirrupDiameterMm)} · Δ ${formatNumber(span.checkedDeflectionMm)} / ${formatNumber(span.deflectionLimitMm)} mm`),
    ...result.checks.map((check) => `${check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '!'} ${check.label}${check.ratio !== undefined && Number.isFinite(check.ratio) ? ` (${Math.round(check.ratio * 100)} %)` : ''}`),
    'FStructure · Diseño experimental; requiere revisión profesional.',
  ].join('\n');
}

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
    {points ? <p className="dw-footnote">a: distancia de la carga puntual desde el inicio del claro.</p> : null}
  </div>;
}

export function BeamWorkbench({ chrome }: { chrome: WorkbenchChrome }) {
  const { draft, set, reset } = useStoredDraft('beam', DEFAULTS);
  const storage = useWorkbenchStorage();
  const [spans, setSpans] = useState<SpanDraft[]>(() => readStored(storage, 'beam-spans', parseSpans, DEFAULT_SPANS));
  useEffect(() => storage.write('beam-spans', spans.map((span) => ({ ...span }))), [spans, storage]);
  const code = designCode(chrome.code);
  const input = useMemo(() => toInput(chrome.code, draft, spans), [chrome.code, draft, spans]);
  const deferred = useDeferredValue(input);
  const result = useMemo(() => designBeam(deferred), [deferred]);

  const status = result.ok
    ? `Viga · ${result.status === 'fail' ? 'No cumple' : 'Cumple'} · ${Math.round(result.governingRatio * 100)} %`
    : 'Viga · datos incompletos';

  return <WorkbenchLayout
    chrome={chrome}
    title="Viga"
    subtitle={`Análisis con el solver 2D · diseño ${code.name}`}
    status={status}
    memo={result.ok ? beamMemo(result) : null}
    onReset={() => { reset(); setSpans(DEFAULT_SPANS); }}
    badge={result.ok
      ? <><span className="dw-badge">{describe(result.input)}</span><StatusBadge status={result.status} label={`${result.status === 'fail' ? 'No cumple' : 'Cumple'} · ${Math.round(result.governingRatio * 100)} %`} /></>
      : <StatusBadge status="error" label="Datos incompletos" />}
    inputs={<>
      <FieldGroup title="Sección">
        <NumberField label="Base b" unit="cm" value={draft.width} onChange={set('width')} />
        <NumberField label="Peralte h" unit="cm" value={draft.height} onChange={set('height')} />
        <NumberField label="Recubrimiento" unit="cm" value={draft.cover} onChange={set('cover')} hint="libre al estribo" />
      </FieldGroup>
      <FieldGroup title="Extremos" columns={1}>
        <div className="dw-end"><span aria-hidden="true">Izquierdo</span><SegmentedControl label="Extremo izquierdo" size="sm" value={draft.leftEnd} options={ENDS} onValueChange={set('leftEnd')} /></div>
        <div className="dw-end"><span aria-hidden="true">Derecho</span><SegmentedControl label="Extremo derecho" size="sm" value={draft.rightEnd} options={ENDS} onValueChange={set('rightEnd')} /></div>
        <NumberField label="Ancho de los apoyos extremos" unit="cm" value={draft.supportWidth} onChange={set('supportWidth')} hint="para anclar las barras" />
      </FieldGroup>
      <FieldGroup title="Claros y cargas de servicio" columns={1}>
        <SpanTable
          spans={spans}
          points={draft.points === 'yes'}
          onChange={(index, field, value) => setSpans((current) => current.map((span, position) => position === index ? { ...span, [field]: value } : span))}
          onAdd={() => setSpans((current) => [...current, { ...current[current.length - 1]! }])}
          onRemove={(index) => setSpans((current) => current.filter((_, position) => position !== index))}
        />
        <LayerToggle label="Cargas puntuales" description="Una por claro, en cualquier posición" checked={draft.points === 'yes'} onCheckedChange={(checked) => set('points')(checked ? 'yes' : 'no')} />
        <LayerToggle label="Sumar peso propio" description="24 kN/m³ × b × h" checked={draft.selfWeight === 'yes'} onCheckedChange={(checked) => set('selfWeight')(checked ? 'yes' : 'no')} />
      </FieldGroup>
      <FieldGroup title="Materiales">
        <NumberField label="f′c" unit="kg/cm²" value={draft.fc} onChange={set('fc')} hint={mpaHint(draft.fc)} />
        <NumberField label="fy" unit="kg/cm²" value={draft.fy} onChange={set('fy')} hint={mpaHint(draft.fy)} />
      </FieldGroup>
      <FieldGroup title={`Criterios de carga · ${code.usesStructureGroup ? 'NTC-CyA 2023' : code.name}`} columns={1}>
        {code.usesStructureGroup
          ? <GroupSelect value={draft.group} onChange={set('group')} groups={[{ value: 'B', label: 'Grupo B · 1.3 CM + 1.5 CV' }, { value: 'A', label: 'Grupo A · 1.5 CM + 1.7 CV' }]} />
          : <p className="dw-footnote">{`Combinaciones: ${code.loadCombinations('B').map((combination) => combination.label).join(' · ')}.`}</p>}
        {code.sustainedLive === 'use'
          ? <Select label="Destino (carga viva sostenida W/Wm)" value={draft.use} onChange={(event) => set('use')(event.currentTarget.value)}>
            {LIVE_LOAD_USES.map((use) => <option key={use.value} value={use.value}>{`${use.label} · W ${use.w} / Wm ${use.wm} kN/m²`}</option>)}
          </Select>
          : <NumberField label="Carga viva sostenida" unit="%" value={draft.sustained} onChange={set('sustained')} hint="porción permanente para la flecha diferida" />}
      </FieldGroup>
      <MoreOptions>
        <div className="dw-span-all">
          <Select label="Duración de la carga sostenida (ξ)" value={draft.duration} onChange={(event) => set('duration')(event.currentTarget.value)}>
            {LONG_TERM_DURATIONS.map((item) => <option key={item.value} value={item.value}>{`${item.label} · ξ = ${item.xi}`}</option>)}
          </Select>
        </div>
        <BarSelect label="Varilla" value={draft.bar} onChange={set('bar')} allowAuto minimumDiameterMm={12.7} />
        <BarSelect label="Estribo" value={draft.stirrup} onChange={set('stirrup')} allowAuto />
        <NumberField label="fy estribos" unit="kg/cm²" value={draft.fyv} onChange={set('fyv')} />
        <NumberField label="Agregado" unit="mm" value={draft.aggregate} onChange={set('aggregate')} />
        <div className="dw-span-all">
          <LayerToggle label="Soporta muros frágiles" description={code.beam.deflection === 'ntc' ? 'Límite de deflexión L/480 + 3 mm' : 'Deflexión posterior a los muros ≤ ℓ/480'} checked={draft.damages === 'yes'}
            onCheckedChange={(checked) => set('damages')(checked ? 'yes' : 'no')} />
        </div>
      </MoreOptions>
    </>}
    stage={result.ok ? <>
      <Plate title="Elevación y envolventes" note={`Carga viva alternada por claro · punteado: resistencia φMn provista · ${result.solverRuns} análisis del solver 2D`} wide>
        <BeamElevation result={result} />
      </Plate>
      <Plate title="Armado longitudinal" note="corridas + bastones con su longitud · estribos por zonas" wide>
        <BeamRebarDetail result={result} />
      </Plate>
      {result.cuts.map((cut) => <Plate key={cut.label} title={cut.label} note={`x = ${meters(cut.xM)} m`}>
        <BeamSection result={result} cut={cut} />
      </Plate>)}
    </> : <ErrorsPanel errors={result.errors} />}
    results={result.ok ? <>
      <Verdict status={result.status} ratio={result.governingRatio} title={`Viga ${formatNumber(result.input.widthMm / 10, 0)} × ${formatNumber(result.input.heightMm / 10, 0)} cm`}>
        <Summary rows={[
          { label: 'Mu positivo', value: `${formatNumber(result.extremes.positiveMomentKnm)} kN·m`, tone: 'moment' },
          { label: 'Mu negativo', value: `${formatNumber(result.extremes.negativeMomentKnm)} kN·m`, tone: 'moment' },
          { label: 'Vu', value: `${formatNumber(result.extremes.shearKn)} kN`, tone: 'shear' },
          { label: `Δ claro ${result.deflection.governingSpan + 1}`, value: `${formatNumber(result.deflection.checkedMm)} / ${formatNumber(result.deflection.limitMm)} mm` },
        ]} />
      </Verdict>
      <PanelSection title="Armado">
        <RebarList items={[
          { kind: 'bar', title: `${barsText(result.continuousTop.continuous)} corridas arriba`, detail: `Toda la viga · φMn⁻ ${formatNumber(result.continuousTop.strengthKnm)} kN·m` },
          { kind: 'bar', title: `${barsText(result.continuousBottom.continuous)} corridas abajo`, detail: `Toda la viga · φMn⁺ ${formatNumber(result.continuousBottom.strengthKnm)} kN·m` },
          ...result.bastions.map((bastion) => ({ kind: 'extra' as const, title: bastionTitle(bastion), detail: bastionDetail(bastion) })),
          ...result.anchorages.filter((item) => item.kind !== 'straight').map((item) => ({ kind: 'bar' as const, title: item.kind === 'hook' ? 'Gancho estándar' : 'Anclaje insuficiente', detail: anchorageText(item) })),
          { kind: 'bar' as const, title: 'Traslapes Clase B', detail: `Superior ${cm(result.splices.top)} · inferior ${cm(result.splices.bottom)} · fuera de los momentos máximos` },
        ]} />
      </PanelSection>
      <PanelSection title="Por claro">
        <table className="dw-table">
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
        <RebarList items={result.spans.map((span, index) => ({
          kind: 'stirrup' as const,
          title: `Claro ${index + 1} · ${stirrupText(span.stirrups, result.stirrupDiameterMm)}`,
          detail: `Vu ${formatNumber(span.stirrups.demandKn)} kN · φVn ${formatNumber(span.stirrups.strengthKn)} kN · Ie/Ig ${formatNumber(span.effectiveInertiaRatio, 2)}`,
        }))} />
        <p className="dw-footnote">Momentos en kN·m y cortante en kN de la envolvente factorizada.</p>
      </PanelSection>
      <PanelSection title="Comprobaciones"><ChecksList checks={result.checks} /></PanelSection>
      <PanelSection title="Valores de cálculo">
        <ValuesTable rows={[
          { symbol: 'd', label: 'Peralte efectivo (corridas)', value: cm(result.continuousBottom.effectiveDepthMm) },
          { symbol: 'As mín', label: 'Lecho inferior', value: cm2(code.beam.minimumSteel(result.input.widthMm, result.continuousBottom.effectiveDepthMm, result.input.heightMm, result.input.fcMpa, result.input.fyMpa, result.continuousBottom.extremeDepthMm)) },
          { symbol: 'As máx', label: 'Por lecho', value: cm2(result.continuousBottom.maximumMm2) },
          { symbol: 'Mcr', label: 'Agrietamiento', value: `${formatNumber(result.deflection.crackingMomentKnm)} kN·m` },
          { symbol: 'Δi', label: `Inmediata claro ${result.deflection.governingSpan + 1}`, value: `${formatNumber(result.deflection.immediateMm)} mm` },
          { symbol: 'Δt', label: `Total con diferida claro ${result.deflection.governingSpan + 1}`, value: `${formatNumber(result.deflection.totalMm)} mm` },
          { symbol: 'Ec', label: 'Módulo de elasticidad', value: `${formatNumber(code.elasticModulusMpa(result.input.fcMpa), 0)} MPa` },
          { symbol: 'Estribo', label: 'Diámetro', value: rebarLabel(result.stirrupDiameterMm) },
        ]} />
      </PanelSection>
    </> : null}
  />;
}
