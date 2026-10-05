import { useEffect, useMemo, useState } from 'react';
import { SegmentedControl } from '../../../design-system/components/controls';
import { LayerToggle, UnitField } from '../../../design-system/components/editor';
import { designCode } from '../../../design/elements/codes';
import { designColumn } from '../../../design/elements/column';
import { rebarLabel } from '../../../design/elements/shared';
import { ColumnElevation, ColumnSection, InteractionChart } from './ColumnDrawings';
import { COLUMN_DEFAULTS, columnReport, columnToInput, methodLabel, proposeColumn, spacingOriginText, tieText } from './columnModel';
import {
  ActionNote, BarSelect, ChecksList, IdentityGroup, InlineAction, ReviewList, Disclosure, ErrorsPanel, FieldGroup, GroupSelect, MoreOptions, NumberField, PanelSection, RebarList, Summary, TakeoffSection, ValuesTable, Verdict,
  formatNumber, useDraftHistory, useStoredDraft,
  parseNumber,
} from './common';
import { Plate, WorkbenchLayout, verdictLabel, type WorkbenchChrome } from './WorkbenchLayout';

export function ColumnWorkbench({ chrome }: { chrome: WorkbenchChrome }) {
  const { draft, set, reset, replace } = useStoredDraft('column', COLUMN_DEFAULTS);
  const history = useDraftHistory(draft, replace, 'column');
  const { onHistory } = chrome;
  useEffect(() => onHistory?.(history), [history, onHistory]);
  const code = designCode(chrome.code);
  const result = useMemo(() => designColumn(columnToInput(chrome.code, draft)), [chrome.code, draft]);
  const braced = draft.braced !== 'no';
  const circular = draft.shape === 'circular';
  const spiral = circular && draft.transverse === 'spiral' && code.column.spiral !== null;
  const [proposalNote, setProposalNote] = useState<string | null>(null);
  const [diagramAxis, setDiagramAxis] = useState<'both' | 'x' | 'y'>('both');
  const [showNominal, setShowNominal] = useState(true);
  const propose = () => {
    const proposal = proposeColumn(chrome.code, draft);
    if (!proposal) { setProposalNote('Ninguna sección hasta 120 cm cumple: revisa las solicitaciones y la esbeltez.'); return; }
    replace({ ...draft, ...proposal });
    const bars = circular ? `${proposal.barCount} barras` : `${proposal.barsWidth} × ${proposal.barsDepth} barras por cara`;
    setProposalNote(`Propuesta: ${circular ? `Ø ${proposal.diameter}` : `${proposal.width} × ${proposal.depth}`} cm con ${bars} de ${Number(proposal.bar).toFixed(1)} mm, el menor acero que cumple.`);
  };
  const report = useMemo(() => result.ok ? columnReport(result, draft) : null, [result, draft]);
  const checks = report?.checks ?? [];
  const notes = report?.notes ?? [];
  const outOfScope = report?.outOfScope ?? [];
  const title = report?.title ?? '';
  const symmetric = result.ok && (result.input.shape === 'circular' || (Math.abs(result.input.widthMm - result.input.depthMm) < 1e-6 && result.input.barsAlongWidth === result.input.barsAlongDepth));

  return <WorkbenchLayout
    chrome={chrome}
    title="Columna"
    report={report}
    onReset={reset}
    verdict={result.ok ? { status: result.status, label: verdictLabel(result.status, result.governingRatio, outOfScope.length > 0) } : { status: 'error', label: 'Datos incompletos' }}
    caption={result.ok ? `${result.bars.length} ${rebarLabel(result.input.barDiameterMm)} · ρ ${formatNumber(result.steelRatio * 100, 2)} %` : undefined}
    inputs={<>
      <IdentityGroup tag={draft.tag} place={draft.place} onTag={set('tag')} onPlace={set('place')} example="C-1" />
      <FieldGroup title="Solicitaciones últimas">
        <NumberField label="Pu" unit="kN" value={draft.axial} onChange={set('axial')} min={-1e9} />
        <NumberField label="Mux" unit="kN·m" value={draft.momentX} onChange={set('momentX')} min={-1e9} />
        <NumberField label="Muy" unit="kN·m" value={draft.momentY} onChange={set('momentY')} min={-1e9} />
      </FieldGroup>
      <FieldGroup title="Sección" action={<InlineAction label="Proponer" title="Dimensionar sección y armado: los menores que cumplen" onClick={propose} />}>
        <div className="dw-span-all">
          <SegmentedControl label="Forma de la sección" size="sm" value={circular ? 'circular' : 'rectangular'} onValueChange={set('shape')}
            options={[{ value: 'rectangular', label: 'Rectangular' }, { value: 'circular', label: 'Circular' }]} />
        </div>
        {circular
          ? <NumberField label="Diámetro D" unit="cm" value={draft.diameter} onChange={set('diameter')} />
          : <>
            <NumberField label="Base b (X)" unit="cm" value={draft.width} onChange={set('width')} />
            <NumberField label="Peralte h (Y)" unit="cm" value={draft.depth} onChange={set('depth')} />
          </>}
        <NumberField label="Recubrimiento" unit="cm" value={draft.cover} onChange={set('cover')} />
        <div className="dw-span-all"><ActionNote text={proposalNote} /></div>
      </FieldGroup>
      <FieldGroup title="Refuerzo">
        <BarSelect label="Varilla" value={draft.bar} onChange={set('bar')} minimumDiameterMm={12.7} />
        {circular && code.column.spiral ? <div className="dw-span-all">
          <SegmentedControl label="Refuerzo transversal" size="sm" value={spiral ? 'spiral' : 'ties'} onValueChange={set('transverse')}
            options={[{ value: 'ties', label: 'Estribos circulares' }, { value: 'spiral', label: 'Zuncho' }]} />
        </div> : null}
        <BarSelect label={spiral ? 'Zuncho' : circular ? 'Estribo circular' : 'Estribo'} value={draft.tie} onChange={set('tie')} />
        {circular
          ? <NumberField label="Número de barras" unit="pzas" value={draft.barCount} onChange={set('barCount')} min={code.column.circularMinimumBars} />
          : <>
            <NumberField label="Barras cara b" unit="pzas" value={draft.barsWidth} onChange={set('barsWidth')} min={2} />
            <NumberField label="Barras cara h" unit="pzas" value={draft.barsDepth} onChange={set('barsDepth')} min={2} />
          </>}
      </FieldGroup>
      <FieldGroup title={spiral ? 'Paso del zuncho' : 'Separación de estribos'} action={<InlineAction label="Usar propuesta" title="Volver a calcular la separación automática" onClick={() => replace({ ...draft, tieSpacing: '', endTieSpacing: '' })} />}>
        <UnitField label={spiral ? 'Paso propio s' : 'Propia al centro s'} unit="cm" value={draft.tieSpacing} onValueChange={set('tieSpacing')}
          placeholder="Propuesta" hint="Vacío usa la propuesta" error={draft.tieSpacing.trim() && (!Number.isFinite(parseNumber(draft.tieSpacing)) || parseNumber(draft.tieSpacing) <= 0) ? 'Debe ser mayor que cero' : undefined} />
        {!spiral && code.column.ties === 'ntc' ? <UnitField label="Propia en extremos so" unit="cm" value={draft.endTieSpacing} onValueChange={set('endTieSpacing')}
          placeholder="Propuesta" hint="Ambos extremos Lo" error={draft.endTieSpacing.trim() && (!Number.isFinite(parseNumber(draft.endTieSpacing)) || parseNumber(draft.endTieSpacing) <= 0) ? 'Debe ser mayor que cero' : undefined} /> : null}
        {result.ok ? <div className="dw-span-all"><ActionNote text={`Propuesta: ${formatNumber(result.ties.proposedCenterSpacingMm / 10, 1)} cm${result.ties.endLengthMm > 0 ? ` al centro · ${formatNumber(result.ties.proposedEndSpacingMm / 10, 1)} cm en Lo` : ''}. ${draft.tieSpacing.trim() || draft.endTieSpacing.trim() ? 'Se evalúa tu separación, sin ajustarla en silencio.' : 'Puedes escribir otra separación para verificarla.'}`} /></div> : null}
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
        <div className="dw-span-all">
          {!circular ? <SegmentedControl label="Curvas del diagrama" size="sm" value={diagramAxis}
            onValueChange={(value) => setDiagramAxis(value === 'x' || value === 'y' ? value : 'both')}
            options={[{ value: 'both', label: 'Ambos ejes' }, { value: 'x', label: 'Eje X' }, { value: 'y', label: 'Eje Y' }]} /> : null}
          <LayerToggle label="Mostrar resistencia nominal" checked={showNominal} onCheckedChange={setShowNominal} />
        </div>
        <InteractionChart result={result} axis={circular ? 'both' : diagramAxis} showNominal={showNominal} />
        <ul className="dw-legend">
          {circular || diagramAxis !== 'y' ? <li data-kind="x">{circular ? 'Orientación gobernante' : symmetric ? 'Diseño (X = Y)' : 'Diseño en X'}</li> : null}
          {circular || (diagramAxis !== 'x' && (!symmetric || diagramAxis === 'y')) ? <li data-kind="y">{circular ? 'Otra orientación' : 'Diseño en Y'}</li> : null}
          {showNominal ? <li data-kind="nominal">Nominal</li> : null}
          <li data-kind="demand">Demanda</li>
        </ul>
      </Plate>
      <Plate title="Sección">
        <ColumnSection result={result} />
      </Plate>
      <Plate title="Armado en elevación">
        <ColumnElevation result={result} />
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
          { kind: 'stirrup', title: tieText(result), detail: `${spacingOriginText(result)}${result.ties.endLengthMm > 0 ? ` · Lo = ${formatNumber(result.ties.endLengthMm / 10, 0)} cm` : ''}` },
          ...(!circular ? [{ kind: 'stirrup' as const, title: `Estribo cerrado + ${result.ties.crossTiesParallelToX + result.ties.crossTiesParallelToY} grapas`, detail: `${result.ties.crossTiesParallelToX} paralelas a X · ${result.ties.crossTiesParallelToY} paralelas a Y` }] : []),
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
