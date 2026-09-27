import { useEffect, useMemo, type ReactNode } from 'react';
import { SegmentedControl } from '../../../design-system/components/controls';
import { LayerToggle } from '../../../design-system/components/editor';
import { designCode } from '../../../design/elements/codes';
import { designCombinedFooting } from '../../../design/elements/combinedFooting';
import { designFooting } from '../../../design/elements/footing';
import { designStripFooting } from '../../../design/elements/stripFooting';
import {
  BarSelect, ChecksList, IdentityGroup, ReviewList, Disclosure, ErrorsPanel, FieldGroup, GroupSelect, MoreOptions, NumberField, PanelSection, RebarList, Summary, TakeoffSection, ValuesTable, Verdict,
  formatNumber, useDraftHistory, useStoredDraft,
} from './common';
import { FootingPlan, FootingSection } from './FootingDrawings';
import {
  FOOTING_DEFAULTS, combinedReport, combinedToInput, directionDetail, directionTitle, footingReport, footingToInput, footingType, planText, stripReport, stripToInput,
  type FootingDraft,
} from './footingModel';
import { CombinedFootingDiagrams, CombinedFootingPlan, StripFootingSection } from './FootingTypeDrawings';
import { Plate, WorkbenchLayout, verdictLabel, type WorkbenchChrome } from './WorkbenchLayout';

type Setter = (field: keyof FootingDraft) => (value: string) => void;
interface FootingProps { readonly chrome: WorkbenchChrome; readonly draft: FootingDraft; readonly set: Setter; readonly reset: () => void }

export function FootingWorkbench({ chrome }: { chrome: WorkbenchChrome }) {
  const { draft, set, reset, replace } = useStoredDraft('footing', FOOTING_DEFAULTS);
  const history = useDraftHistory(draft, replace);
  const { onHistory } = chrome;
  useEffect(() => onHistory?.(history), [history, onHistory]);
  const type = footingType(draft);
  const props = { chrome, draft, set, reset };
  return type === 'strip' ? <StripFooting {...props} /> : type === 'combined' ? <CombinedFooting {...props} /> : <IsolatedFooting {...props} />;
}

/** Tipo de zapata: el formulario, la lámina y la memoria cambian con él. */
function TypeGroup({ draft, set }: { draft: FootingDraft; set: Setter }) {
  return <FieldGroup title="Tipo de zapata" columns={1}>
    <SegmentedControl label="Tipo de zapata" size="sm" value={footingType(draft)} onValueChange={set('type')}
      options={[{ value: 'isolated', label: 'Aislada' }, { value: 'strip', label: 'Corrida' }, { value: 'combined', label: 'Combinada' }]} />
  </FieldGroup>;
}

/** Suelo, materiales y dimensiones automáticas: comunes a los tres tipos. */
function SoilAndMaterials({ draft, set, planLabel, planFields }: { draft: FootingDraft; set: Setter; planLabel: string; planFields: ReactNode }) {
  return <>
    <FieldGroup title="Suelo y materiales">
      <NumberField label="qa neta" unit="kPa" value={draft.qa} onChange={set('qa')} />
      <NumberField label="Recubrimiento" unit="cm" value={draft.cover} onChange={set('cover')} />
      <NumberField label="f′c" unit="kg/cm²" value={draft.fc} onChange={set('fc')} />
      <NumberField label="fy" unit="kg/cm²" value={draft.fy} onChange={set('fy')} />
    </FieldGroup>
    <FieldGroup title="Dimensiones">
      <div className="dw-span-all">
        <LayerToggle label={planLabel} checked={draft.autoPlan === 'yes'} onCheckedChange={(checked) => set('autoPlan')(checked ? 'yes' : 'no')} />
      </div>
      {draft.autoPlan === 'yes' ? null : planFields}
      <div className="dw-span-all">
        <LayerToggle label="Peralte automático" checked={draft.autoThickness === 'yes'} onCheckedChange={(checked) => set('autoThickness')(checked ? 'yes' : 'no')} />
      </div>
      {draft.autoThickness === 'yes' ? null : <NumberField label="Peralte h" unit="cm" value={draft.thickness} onChange={set('thickness')} />}
    </FieldGroup>
  </>;
}

function GroupField({ draft, set }: { draft: FootingDraft; set: Setter }) {
  return <div className="dw-span-all">
    <GroupSelect value={draft.group} onChange={set('group')} groups={[{ value: 'B', label: 'Grupo B · 1.3 CM + 1.5 CV' }, { value: 'A', label: 'Grupo A · 1.5 CM + 1.7 CV' }]} />
  </div>;
}

function StripFooting({ chrome, draft, set, reset }: FootingProps) {
  const code = designCode(chrome.code);
  const result = useMemo(() => designStripFooting(stripToInput(chrome.code, draft)), [chrome.code, draft]);
  const report = useMemo(() => result.ok ? stripReport(result, draft) : null, [result, draft]);
  return <WorkbenchLayout
    chrome={chrome}
    title="Zapata corrida"
    report={report}
    onReset={reset}
    verdict={result.ok ? { status: result.status, label: verdictLabel(result.status, result.governingRatio, (report?.outOfScope.length ?? 0) > 0) } : { status: 'error', label: 'Datos incompletos' }}
    caption={result.ok ? `B ${formatNumber(result.widthMm / 10, 0)} cm · h ${formatNumber(result.thicknessMm / 10, 0)} cm` : undefined}
    inputs={<>
      <IdentityGroup tag={draft.tag} place={draft.place} onTag={set('tag')} onPlace={set('place')} example="Z-1" />
      <TypeGroup draft={draft} set={set} />
      <FieldGroup title="Muro y cargas por metro">
        <div className="dw-span-all">
          <SegmentedControl label="Material del muro" size="sm" value={draft.wallType === 'masonry' ? 'masonry' : 'concrete'} onValueChange={set('wallType')}
            options={[{ value: 'concrete', label: 'Concreto' }, { value: 'masonry', label: 'Mampostería' }]} />
        </div>
        <NumberField label="Espesor del muro" unit="cm" value={draft.wallWidth} onChange={set('wallWidth')} />
        <NumberField label="Muerta" unit="kN/m" value={draft.wDead} onChange={set('wDead')} />
        <NumberField label="Viva" unit="kN/m" value={draft.wLive} onChange={set('wLive')} />
        {code.usesStructureGroup ? <GroupField draft={draft} set={set} /> : null}
      </FieldGroup>
      <SoilAndMaterials draft={draft} set={set} planLabel="Ancho automático"
        planFields={<NumberField label="Ancho B" unit="cm" value={draft.stripWidth} onChange={set('stripWidth')} />} />
      <MoreOptions>
        <BarSelect label="Varilla transversal" value={draft.bar} onChange={set('bar')} />
        <BarSelect label="Varilla longitudinal" value={draft.distBar} onChange={set('distBar')} />
      </MoreOptions>
    </>}
    stage={result.ok ? <Plate title="Corte transversal" note="Por metro de muro"><StripFootingSection result={result} /></Plate> : <ErrorsPanel errors={result.errors} />}
    results={result.ok && report ? <>
      <Verdict status={result.status} ratio={result.governingRatio} title={report.title} outOfScope={report.outOfScope.length}>
        <Summary rows={[
          { label: 'Peralte', value: `${formatNumber(result.thicknessMm / 10, 0)} cm · d ${formatNumber(result.effectiveDepthMm / 10, 1)}` },
          { label: 'q servicio', value: `${formatNumber(result.servicePressureKpa, 0)} kPa`, tone: 'axial' },
          { label: 'Vu / φVc', value: `${formatNumber(result.shearKnPerM, 1)} / ${formatNumber(result.shearStrengthKnPerM, 1)} kN/m`, tone: 'shear' },
          { label: 'Mu', value: `${formatNumber(result.momentKnmPerM, 1)} kN·m/m`, tone: 'moment' },
        ]} />
      </Verdict>
      <PanelSection title="Armado"><RebarList items={report.reinforcement.map((row) => ({ kind: 'bar' as const, title: row.label, detail: row.value }))} /></PanelSection>
      <PanelSection title="Revisión"><ReviewList checks={report.checks} outOfScope={report.outOfScope} /></PanelSection>
      <TakeoffSection takeoff={report.takeoff} />
      <Disclosure label="Detalle del cálculo">
        <ValuesTable rows={report.values} />
        <ChecksList checks={report.notes} />
      </Disclosure>
    </> : null}
  />;
}

function CombinedFooting({ chrome, draft, set, reset }: FootingProps) {
  const code = designCode(chrome.code);
  const result = useMemo(() => designCombinedFooting(combinedToInput(chrome.code, draft)), [chrome.code, draft]);
  const report = useMemo(() => result.ok ? combinedReport(result, draft) : null, [result, draft]);
  const column = (index: 1 | 2) => <>
    <NumberField label={`C${index} · c1 (X)`} unit="cm" value={draft[`c${index}x`]} onChange={set(`c${index}x`)} />
    <NumberField label={`C${index} · c2 (Y)`} unit="cm" value={draft[`c${index}y`]} onChange={set(`c${index}y`)} />
    <NumberField label={`C${index} · muerta`} unit="kN" value={draft[`p${index}d`]} onChange={set(`p${index}d`)} />
    <NumberField label={`C${index} · viva`} unit="kN" value={draft[`p${index}l`]} onChange={set(`p${index}l`)} />
  </>;
  return <WorkbenchLayout
    chrome={chrome}
    title="Zapata combinada"
    report={report}
    onReset={reset}
    verdict={result.ok ? { status: result.status, label: verdictLabel(result.status, result.governingRatio, (report?.outOfScope.length ?? 0) > 0) } : { status: 'error', label: 'Datos incompletos' }}
    caption={result.ok ? `${formatNumber(result.lengthMm / 1000, 2)} × ${formatNumber(result.widthMm / 1000, 2)} m · h ${formatNumber(result.thicknessMm / 10, 0)} cm` : undefined}
    inputs={<>
      <IdentityGroup tag={draft.tag} place={draft.place} onTag={set('tag')} onPlace={set('place')} example="Z-1" />
      <TypeGroup draft={draft} set={set} />
      <FieldGroup title="Columna 1 (izquierda)">{column(1)}</FieldGroup>
      <FieldGroup title="Columna 2 (derecha)">{column(2)}</FieldGroup>
      <FieldGroup title="Posición">
        <NumberField label="Entre ejes" unit="m" value={draft.spacing} onChange={set('spacing')} />
        {code.usesStructureGroup ? <GroupField draft={draft} set={set} /> : null}
        <div className="dw-span-all">
          <LayerToggle label="Columna 1 en el lindero" checked={draft.edge === 'yes'} onCheckedChange={(checked) => set('edge')(checked ? 'yes' : 'no')} />
        </div>
        {draft.edge === 'yes' ? null : <NumberField label="Voladizo izq. desde el eje" unit="cm" value={draft.overhang} onChange={set('overhang')} />}
      </FieldGroup>
      <SoilAndMaterials draft={draft} set={set} planLabel="Ancho automático"
        planFields={<NumberField label="Ancho B" unit="cm" value={draft.combWidth} onChange={set('combWidth')} />} />
      <MoreOptions>
        <BarSelect label="Varilla longitudinal" value={draft.bar} onChange={set('bar')} />
        <BarSelect label="Varilla transversal" value={draft.transBar} onChange={set('transBar')} />
      </MoreOptions>
    </>}
    stage={result.ok ? <>
      <Plate title="Planta" wide><CombinedFootingPlan result={result} /></Plate>
      <Plate title="Cortante y momento a lo largo" wide><CombinedFootingDiagrams result={result} /></Plate>
    </> : <ErrorsPanel errors={result.errors} />}
    results={result.ok && report ? <>
      <Verdict status={result.status} ratio={result.governingRatio} title={report.title} outOfScope={report.outOfScope.length}>
        <Summary rows={[
          { label: 'Peralte', value: `${formatNumber(result.thicknessMm / 10, 0)} cm · d ${formatNumber(result.bottom.effectiveDepthMm / 10, 1)}` },
          { label: 'q servicio', value: `${formatNumber(result.service.minimumKpa, 0)}–${formatNumber(result.service.maximumKpa, 0)} kPa`, tone: 'axial' },
          { label: 'Mu+ · Mu−', value: `${formatNumber(result.bottom.momentKnm, 0)} · ${formatNumber(result.top?.momentKnm ?? 0, 0)} kN·m`, tone: 'moment' },
          { label: 'Vu / φVc', value: `${formatNumber(result.oneWay.demandKn, 0)} / ${formatNumber(result.oneWay.strengthKn, 0)} kN`, tone: 'shear' },
        ]} />
      </Verdict>
      <PanelSection title="Armado"><RebarList items={report.reinforcement.map((row) => ({ kind: 'bar' as const, title: row.label, detail: row.value }))} /></PanelSection>
      <PanelSection title="Revisión"><ReviewList checks={report.checks} outOfScope={report.outOfScope} /></PanelSection>
      <TakeoffSection takeoff={report.takeoff} />
      <Disclosure label="Detalle del cálculo">
        <ValuesTable rows={report.values} />
        <ChecksList checks={report.notes} />
      </Disclosure>
    </> : null}
  />;
}

function IsolatedFooting({ chrome, draft, set, reset }: FootingProps) {
  const code = designCode(chrome.code);
  const result = useMemo(() => designFooting(footingToInput(chrome.code, draft)), [chrome.code, draft]);
  const report = useMemo(() => result.ok ? footingReport(result, draft) : null, [result, draft]);
  const checks = report?.checks ?? [];
  const notes = report?.notes ?? [];
  const outOfScope = report?.outOfScope ?? [];
  const title = report?.title ?? '';

  return <WorkbenchLayout
    chrome={chrome}
    title="Zapata aislada"
    report={report}
    onReset={reset}
    verdict={result.ok ? { status: result.status, label: verdictLabel(result.status, result.governingRatio, outOfScope.length > 0) } : { status: 'error', label: 'Datos incompletos' }}
    caption={result.ok ? `${planText(result)} · h ${formatNumber(result.thicknessMm / 10, 0)} cm` : undefined}
    inputs={<>
      <IdentityGroup tag={draft.tag} place={draft.place} onTag={set('tag')} onPlace={set('place')} example="Z-1" />
      <TypeGroup draft={draft} set={set} />
      <FieldGroup title="Cargas de servicio">
        <NumberField label="Muerta" unit="kN" value={draft.dead} onChange={set('dead')} />
        <NumberField label="Viva" unit="kN" value={draft.live} onChange={set('live')} />
        {code.usesStructureGroup ? <div className="dw-span-all">
          <GroupSelect value={draft.group} onChange={set('group')} groups={[{ value: 'B', label: 'Grupo B · 1.3 CM + 1.5 CV' }, { value: 'A', label: 'Grupo A · 1.5 CM + 1.7 CV' }]} />
        </div> : null}
        <div className="dw-span-all">
          <LayerToggle label="Momentos en la base" checked={draft.moments === 'yes'}
            onCheckedChange={(checked) => set('moments')(checked ? 'yes' : 'no')} />
        </div>
        {draft.moments === 'yes' ? <>
          <NumberField label="Mx servicio" unit="kN·m" value={draft.mx} onChange={set('mx')} min={-1e9} />
          <NumberField label="My servicio" unit="kN·m" value={draft.my} onChange={set('my')} min={-1e9} />
          <NumberField label="Mux último" unit="kN·m" value={draft.mux} onChange={set('mux')} min={-1e9} />
          <NumberField label="Muy último" unit="kN·m" value={draft.muy} onChange={set('muy')} min={-1e9} />
          {code.usesStructureGroup ? <div className="dw-span-all">
            <LayerToggle label="La combinación incluye sismo" checked={draft.seismic === 'yes'}
              onCheckedChange={(checked) => set('seismic')(checked ? 'yes' : 'no')} />
          </div> : null}
        </> : null}
      </FieldGroup>
      <FieldGroup title="Columna y suelo">
        <NumberField label="c1 (X)" unit="cm" value={draft.c1} onChange={set('c1')} />
        <NumberField label="c2 (Y)" unit="cm" value={draft.c2} onChange={set('c2')} />
        <NumberField label="qa neta" unit="kPa" value={draft.qa} onChange={set('qa')} />
      </FieldGroup>
      <FieldGroup title="Dimensiones">
        <div className="dw-span-all">
          <LayerToggle label="Planta automática" checked={draft.autoPlan === 'yes'}
            onCheckedChange={(checked) => set('autoPlan')(checked ? 'yes' : 'no')} />
        </div>
        {draft.autoPlan === 'yes' ? null : <>
          <NumberField label="B (X)" unit="cm" value={draft.sideX} onChange={set('sideX')} />
          <NumberField label="L (Y)" unit="cm" value={draft.sideY} onChange={set('sideY')} />
        </>}
        <div className="dw-span-all">
          <LayerToggle label="Peralte automático" checked={draft.autoThickness === 'yes'}
            onCheckedChange={(checked) => set('autoThickness')(checked ? 'yes' : 'no')} />
        </div>
        {draft.autoThickness === 'yes' ? null : <NumberField label="Peralte h" unit="cm" value={draft.thickness} onChange={set('thickness')} />}
      </FieldGroup>
      <FieldGroup title="Materiales">
        <NumberField label="f′c" unit="kg/cm²" value={draft.fc} onChange={set('fc')} />
        <NumberField label="fy" unit="kg/cm²" value={draft.fy} onChange={set('fy')} />
      </FieldGroup>
      <MoreOptions>
        <BarSelect label="Varilla" value={draft.bar} onChange={set('bar')} minimumDiameterMm={12.7} />
        <NumberField label="Recubrimiento" unit="cm" value={draft.cover} onChange={set('cover')} />
      </MoreOptions>
    </>}
    stage={result.ok ? <>
      <Plate title="Planta">
        <FootingPlan result={result} />
      </Plate>
      <Plate title="Corte en X">
        <FootingSection result={result} />
      </Plate>
    </> : <ErrorsPanel errors={result.errors} />}
    results={result.ok ? <>
      <Verdict status={result.status} ratio={result.governingRatio} title={title} outOfScope={outOfScope.length}>
        <Summary rows={[
          { label: 'Peralte', value: `${formatNumber(result.thicknessMm / 10, 0)} cm · d ${formatNumber(result.effectiveDepthMm / 10, 1)}` },
          { label: 'q servicio', value: `${formatNumber(result.service.minimumKpa, 0)}–${formatNumber(result.service.maximumKpa, 0)} kPa`, tone: 'axial' },
          { label: 'vu / φvc', value: `${formatNumber(result.punching.demandStressMpa, 2)} / ${formatNumber(result.punching.strengthStressMpa, 2)} MPa`, tone: 'shear' },
          { label: 'Mu X · Y', value: `${formatNumber(result.directions.x.momentKnm, 0)} · ${formatNumber(result.directions.y.momentKnm, 0)} kN·m`, tone: 'moment' },
        ]} />
      </Verdict>
      <PanelSection title="Armado">
        <RebarList items={[result.directions.x, result.directions.y].map((direction) => ({
          kind: 'bar' as const,
          title: directionTitle(direction, result.input.barDiameterMm),
          detail: `Capa ${direction.layer === 'bottom' ? 'inferior' : 'superior'}`,
        }))} />
      </PanelSection>
      <PanelSection title="Revisión"><ReviewList checks={checks} outOfScope={outOfScope} /></PanelSection>
      {report ? <TakeoffSection takeoff={report.takeoff} /> : null}
      <Disclosure label="Detalle del cálculo">
        <RebarList items={[result.directions.x, result.directions.y].map((direction) => ({
          kind: 'bar' as const,
          title: directionTitle(direction, result.input.barDiameterMm),
          detail: directionDetail(direction),
        }))} />
        <ValuesTable rows={report?.values ?? []} />
        <ChecksList checks={notes} />
      </Disclosure>
    </> : null}
  />;
}
