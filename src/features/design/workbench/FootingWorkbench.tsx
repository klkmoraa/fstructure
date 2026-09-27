import { useEffect, useMemo } from 'react';
import { LayerToggle } from '../../../design-system/components/editor';
import { designCode } from '../../../design/elements/codes';
import { designFooting } from '../../../design/elements/footing';
import {
  BarSelect, ChecksList, IdentityGroup, ReviewList, Disclosure, ErrorsPanel, FieldGroup, GroupSelect, MoreOptions, NumberField, PanelSection, RebarList, Summary, TakeoffSection, ValuesTable, Verdict,
  formatNumber, useDraftHistory, useStoredDraft,
} from './common';
import { FootingPlan, FootingSection } from './FootingDrawings';
import { FOOTING_DEFAULTS, directionDetail, directionTitle, footingReport, footingToInput, planText } from './footingModel';
import { Plate, WorkbenchLayout, verdictLabel, type WorkbenchChrome } from './WorkbenchLayout';

export function FootingWorkbench({ chrome }: { chrome: WorkbenchChrome }) {
  const { draft, set, reset, replace } = useStoredDraft('footing', FOOTING_DEFAULTS);
  const history = useDraftHistory(draft, replace);
  const { onHistory } = chrome;
  useEffect(() => onHistory?.(history), [history, onHistory]);
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
      <IdentityGroup tag={draft.tag} place={draft.place} onTag={set('tag')} onPlace={set('place')} />
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
