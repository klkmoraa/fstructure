import { useEffect, useMemo } from 'react';
import { SegmentedControl } from '../../../design-system/components/controls';
import { LayerToggle } from '../../../design-system/components/editor';
import { designCode } from '../../../design/elements/codes';
import { designColumn } from '../../../design/elements/column';
import { rebarLabel } from '../../../design/elements/shared';
import { ColumnSection, InteractionChart } from './ColumnDrawings';
import { COLUMN_DEFAULTS, columnReport, columnToInput, methodLabel, tieText } from './columnModel';
import {
  BarSelect, ChecksList, IdentityGroup, ReviewList, Disclosure, ErrorsPanel, FieldGroup, GroupSelect, MoreOptions, NumberField, PanelSection, RebarList, Summary, TakeoffSection, ValuesTable, Verdict,
  formatNumber, useDraftHistory, useStoredDraft,
} from './common';
import { Plate, WorkbenchLayout, verdictLabel, type WorkbenchChrome } from './WorkbenchLayout';

export function ColumnWorkbench({ chrome }: { chrome: WorkbenchChrome }) {
  const { draft, set, reset, replace } = useStoredDraft('column', COLUMN_DEFAULTS);
  const history = useDraftHistory(draft, replace);
  const { onHistory } = chrome;
  useEffect(() => onHistory?.(history), [history, onHistory]);
  const code = designCode(chrome.code);
  const result = useMemo(() => designColumn(columnToInput(chrome.code, draft)), [chrome.code, draft]);
  const braced = draft.braced !== 'no';
  const report = useMemo(() => result.ok ? columnReport(result, draft) : null, [result, draft]);
  const checks = report?.checks ?? [];
  const notes = report?.notes ?? [];
  const outOfScope = report?.outOfScope ?? [];
  const title = report?.title ?? '';
  const symmetric = result.ok && Math.abs(result.input.widthMm - result.input.depthMm) < 1e-6 && result.input.barsAlongWidth === result.input.barsAlongDepth;

  return <WorkbenchLayout
    chrome={chrome}
    title="Columna"
    report={report}
    onReset={reset}
    verdict={result.ok ? { status: result.status, label: verdictLabel(result.status, result.governingRatio, outOfScope.length > 0) } : { status: 'error', label: 'Datos incompletos' }}
    caption={result.ok ? `${result.bars.length} ${rebarLabel(result.input.barDiameterMm)} · ρ ${formatNumber(result.steelRatio * 100, 2)} %` : undefined}
    inputs={<>
      <IdentityGroup tag={draft.tag} place={draft.place} onTag={set('tag')} onPlace={set('place')} />
      <FieldGroup title="Solicitaciones últimas">
        <NumberField label="Pu" unit="kN" value={draft.axial} onChange={set('axial')} min={-1e9} />
        <NumberField label="Mux" unit="kN·m" value={draft.momentX} onChange={set('momentX')} min={-1e9} />
        <NumberField label="Muy" unit="kN·m" value={draft.momentY} onChange={set('momentY')} min={-1e9} />
      </FieldGroup>
      <FieldGroup title="Sección">
        <NumberField label="Base b (X)" unit="cm" value={draft.width} onChange={set('width')} />
        <NumberField label="Peralte h (Y)" unit="cm" value={draft.depth} onChange={set('depth')} />
        <NumberField label="Recubrimiento" unit="cm" value={draft.cover} onChange={set('cover')} />
      </FieldGroup>
      <FieldGroup title="Refuerzo">
        <BarSelect label="Varilla" value={draft.bar} onChange={set('bar')} minimumDiameterMm={12.7} />
        <BarSelect label="Estribo" value={draft.tie} onChange={set('tie')} />
        <NumberField label="Barras cara b" unit="pzas" value={draft.barsWidth} onChange={set('barsWidth')} min={2} />
        <NumberField label="Barras cara h" unit="pzas" value={draft.barsDepth} onChange={set('barsDepth')} min={2} />
      </FieldGroup>
      <FieldGroup title="Materiales">
        <NumberField label="f′c" unit="kg/cm²" value={draft.fc} onChange={set('fc')} />
        <NumberField label="fy" unit="kg/cm²" value={draft.fy} onChange={set('fy')} />
      </FieldGroup>
      <FieldGroup title="Esbeltez">
        <div className="dw-span-all">
          <SegmentedControl label="Marco" size="sm" value={braced ? 'yes' : 'no'} onValueChange={set('braced')}
            options={[{ value: 'yes', label: 'Sin desplazamiento' }, { value: 'no', label: 'Con desplazamiento' }]} />
        </div>
        <NumberField label="Altura libre lu" unit="m" value={draft.length} onChange={set('length')} />
        <NumberField label="Factor k" unit="×" value={draft.k} onChange={set('k')} />
        {braced ? null : <>
          <NumberField label="M2s x" unit="kN·m" value={draft.swayX} onChange={set('swayX')} />
          <NumberField label="M2s y" unit="kN·m" value={draft.swayY} onChange={set('swayY')} />
          <NumberField label={code.id === 'ntc-2023' ? 'Índice λest' : 'Índice Q'} unit="×" value={draft.stability} onChange={set('stability')} />
        </>}
      </FieldGroup>
      <MoreOptions>
        {code.column.geometryLimits ? <>
          <div className="dw-span-all">
            <GroupSelect value={draft.group} onChange={set('group')} groups={[
              { value: 'B2', label: 'Subgrupo B2' },
              { value: 'B1', label: 'Subgrupo B1' },
              { value: 'A', label: 'Grupo A' },
            ]} />
          </div>
          <div className="dw-span-all">
            <LayerToggle label="Planta baja con sismo" checked={draft.groundFloor === 'yes'}
              onCheckedChange={(checked) => set('groundFloor')(checked ? 'yes' : 'no')} />
          </div>
        </> : null}
        <div className="dw-span-all">
          <SegmentedControl label="Curvatura" size="sm" value={draft.curvature} onValueChange={set('curvature')}
            options={[{ value: 'single', label: 'Curvatura simple' }, { value: 'double', label: 'Curvatura doble' }]} />
        </div>
        <NumberField label="Vux" unit="kN" value={draft.shearX} onChange={set('shearX')} min={-1e9} />
        <NumberField label="Vuy" unit="kN" value={draft.shearY} onChange={set('shearY')} min={-1e9} />
        <NumberField label="|M1/M2|" unit="×" value={draft.endRatio} onChange={set('endRatio')} />
        <NumberField label="βdns" unit="×" value={draft.sustained} onChange={set('sustained')} />
        <NumberField label="Agregado" unit="mm" value={draft.aggregate} onChange={set('aggregate')} />
      </MoreOptions>
    </>}
    stage={result.ok ? <>
      <Plate title="Diagrama de interacción" wide>
        <InteractionChart result={result} />
        <ul className="dw-legend">
          <li data-kind="x">{symmetric ? 'Diseño (X = Y)' : 'Diseño en X'}</li>
          {symmetric ? null : <li data-kind="y">Diseño en Y</li>}
          <li data-kind="nominal">Nominal</li>
          <li data-kind="demand">Demanda</li>
        </ul>
      </Plate>
      <Plate title="Sección">
        <ColumnSection result={result} />
      </Plate>
    </> : <ErrorsPanel errors={result.errors} />}
    results={result.ok ? <>
      <Verdict status={result.status} ratio={result.governingRatio} title={title} outOfScope={outOfScope.length}>
        <Summary rows={[
          { label: 'Método', value: methodLabel[result.capacity.method] },
          { label: 'Capacidad', value: result.capacity.detail.split(' (')[0], tone: 'axial' },
          { label: 'Mc x · y', value: `${formatNumber(result.magnification.x.designMomentKnm)} · ${formatNumber(result.magnification.y.designMomentKnm)} kN·m`, tone: 'moment' },
          { label: braced ? 'δ x · y' : 'δs · δ x · y', value: braced
            ? `${formatNumber(result.magnification.x.factor, 2)} · ${formatNumber(result.magnification.y.factor, 2)}`
            : `${formatNumber(Math.max(result.magnification.x.swayFactor, result.magnification.y.swayFactor), 2)} · ${formatNumber(result.magnification.x.factor, 2)} · ${formatNumber(result.magnification.y.factor, 2)}` },
        ]} />
      </Verdict>
      <PanelSection title="Armado">
        <RebarList items={[
          { kind: 'bar', title: `${result.bars.length} ${rebarLabel(result.input.barDiameterMm)}`, detail: `ρ ${formatNumber(result.steelRatio * 100, 2)} %` },
          { kind: 'stirrup', title: tieText(result), detail: result.ties.endLengthMm > 0 ? `Lo = ${formatNumber(result.ties.endLengthMm / 10, 0)} cm` : undefined },
          { kind: 'bar', title: 'Traslape', detail: `${formatNumber(result.spliceLengthMm / 10, 0)} cm` },
        ]} />
      </PanelSection>
      <PanelSection title="Revisión"><ReviewList checks={checks} outOfScope={outOfScope} /></PanelSection>
      {report ? <TakeoffSection takeoff={report.takeoff} /> : null}
      <Disclosure label="Detalle del cálculo">
        <ValuesTable rows={report?.values ?? []} />
        <ChecksList checks={notes} />
      </Disclosure>
    </> : null}
  />;
}
