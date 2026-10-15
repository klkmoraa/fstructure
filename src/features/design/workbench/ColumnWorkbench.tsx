import { useEffect, useMemo, useRef, useState } from 'react';
import { SegmentedControl, Select } from '../../../design-system/components/controls';
import { LayerToggle, UnitField } from '../../../design-system/components/editor';
import { designCode } from '../../../design/elements/codes';
import { designColumn } from '../../../design/elements/column';
import { rebarLabel } from '../../../design/elements/shared';
import { ColumnElevation, ColumnSection, InteractionChart } from './ColumnDrawings';
import { COLUMN_DEFAULTS, columnReport, columnToInput, methodLabel, proposeColumn, proposeColumnSection, spacingOriginText, tieText } from './columnModel';
import type { ColumnDraft } from './columnProposal';
import {
  ActionNote, BarSelect, ChecksList, IdentityGroup, InlineAction, ReviewList, Disclosure, ErrorsPanel, FieldGroup, GroupSelect, MoreOptions, NumberField, PanelSection, RebarList, Summary, TakeoffSection, ValuesTable, Verdict,
  formatNumber, useDraftHistory, useStoredDraft,
  parseNumber,
} from './common';
import { Plate, WorkbenchLayout, missingDataVerdict, verdictLabel, type WorkbenchChrome } from './WorkbenchLayout';
import { MaterialFields } from './MaterialFields';
import { REBAR_SIZES } from '../../../design/elements/shared';
import { ReinforcementAlternatives } from './ReinforcementAlternatives';
import { startReinforcementAlternatives, type ReinforcementAlternativesRequest, type ReinforcementAlternativesResponse } from './reinforcementAlternativesClient';
import type { ReinforcementCandidate, ReinforcementObjective } from '../../../design/elements/reinforcementAlternatives';

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
  const [reinforcementSearch, setReinforcementSearch] = useState(false);
  const [alternativeObjective, setAlternativeObjective] = useState<ReinforcementObjective>('minimum-steel');
  const [availableDiameters, setAvailableDiameters] = useState<number[]>(() => REBAR_SIZES.map((bar) => bar.diameterMm));
  const [alternatives, setAlternatives] = useState<ReinforcementAlternativesResponse | null>(null);
  const requestId = useRef(0);
  const activeProposal = useRef<{ key: string; cancel: () => void } | null>(null);
  const alternativeKey = JSON.stringify({ code: chrome.code, draft, objective: alternativeObjective, stock: availableDiameters });
  const alternativeKeyRef = useRef(alternativeKey);
  alternativeKeyRef.current = alternativeKey;
  const snapshotKey = alternativeKey;
  useEffect(() => {
    const active = activeProposal.current;
    if (active && active.key !== snapshotKey) {
      active.cancel();
      activeProposal.current = null;
      setReinforcementSearch(false);
      setProposalNote('Búsqueda cancelada: cambiaron los datos de entrada.');
    }
    setAlternatives(null);
  }, [snapshotKey]);
  useEffect(() => () => activeProposal.current?.cancel(), []);
  const [diagramAxis, setDiagramAxis] = useState<'both' | 'x' | 'y'>('both');
  const [showNominal, setShowNominal] = useState(true);
  // Primero la menor sección que cumple con el armado capturado; si ninguna lo
  // logra, sección y armado juntos. La propuesta aplicada siempre cumple.
  const propose = () => {
    const sizeText = (fields: Partial<ColumnDraft>) => circular ? `Ø ${fields.diameter}` : `${fields.width} × ${fields.depth}`;
    const section = proposeColumnSection(chrome.code, draft);
    if (section) {
      const same = circular ? section.diameter === draft.diameter : section.width === draft.width && section.depth === draft.depth;
      if (!same && !replace({ ...draft, ...section })) return;
      setProposalNote(same
        ? `La sección actual (${sizeText(section)} cm) ya es la menor que cumple con este armado.`
        : `Sección propuesta: ${sizeText(section)} cm, la menor que cumple con el armado actual.`);
      return;
    }
    const proposal = proposeColumn(chrome.code, draft);
    if (!proposal) { setProposalNote('Ninguna sección hasta 120 cm cumple: revisa las solicitaciones y la esbeltez.'); return; }
    if (!replace({ ...draft, ...proposal })) return;
    const total = circular ? Number(proposal.barCount) : 2 * (Number(proposal.barsWidth) + Number(proposal.barsDepth)) - 4;
    const bars = `${total} ${rebarLabel(Number(proposal.bar))}${circular ? '' : ` (${proposal.barsWidth} por cara b y ${proposal.barsDepth} por cara h)`}`;
    setProposalNote(`Sección propuesta: ${sizeText(proposal)} cm con ${bars}; con el armado anterior ninguna sección hasta 120 cm cumplía.`);
  };
  const proposeReinforcement = () => {
    activeProposal.current?.cancel();
    const id = ++requestId.current;
    const key = alternativeKey;
    const request: ReinforcementAlternativesRequest = { kind: 'column', requestId: id, input: columnToInput(chrome.code, draft), objective: alternativeObjective,
      ...(alternativeObjective === 'available-bars' ? { availableDiametersMm: availableDiameters } : {}) };
    setReinforcementSearch(true);
    setAlternatives(null);
    const cancel = startReinforcementAlternatives(request, (message: ReinforcementAlternativesResponse) => {
      activeProposal.current = null;
      setReinforcementSearch(false);
      if (alternativeKeyRef.current !== key) return;
      setAlternatives(message);
    });
    activeProposal.current = { key, cancel };
  };
  const applyAlternative = (candidate: ReinforcementCandidate) => {
    if (!replace({ ...draft, ...candidate.applyFields })) return;
    setAlternatives(null);
    setProposalNote('Armado aplicado con sección y acciones capturadas. Deshacer recupera el armado anterior.');
  };
  const cancelReinforcement = () => {
    activeProposal.current?.cancel();
    activeProposal.current = null;
    setReinforcementSearch(false);
    setProposalNote('Búsqueda cancelada.');
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
    verdict={result.ok ? { status: result.status, label: verdictLabel(result.status, result.governingRatio) } : missingDataVerdict(result.errors)}
    caption={result.ok ? `${result.bars.length} ${rebarLabel(result.input.barDiameterMm)} · ρ ${formatNumber(result.steelRatio * 100, 2)} %` : undefined}
    inputs={<>
      <FieldGroup title="Sección, materiales y acciones" action={<InlineAction label="Proponer sección" title="Menor sección que cumple con el armado actual; si no hay, también propone el armado" onClick={propose} />}>
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
        <MaterialFields fc={draft.fc} onFcChange={set('fc')} fy={draft.fy} onFyChange={set('fy')} />
        <NumberField label="Pu" unit="kN" value={draft.axial} onChange={set('axial')} min={-1e9} />
        <NumberField label="Mux" unit="kN·m" value={draft.momentX} onChange={set('momentX')} min={-1e9} />
        <NumberField label="Muy" unit="kN·m" value={draft.momentY} onChange={set('momentY')} min={-1e9} />
        <div className="dw-span-all"><ActionNote text={proposalNote} /></div>
      </FieldGroup>
      <FieldGroup title="Refuerzo" action={<InlineAction label={reinforcementSearch ? 'Cancelar búsqueda' : 'Comparar acero'} title="Comparar armados para la sección y las acciones actuales" onClick={reinforcementSearch ? cancelReinforcement : proposeReinforcement} />}>
        <BarSelect label="Varilla" value={draft.bar} onChange={set('bar')} minimumDiameterMm={12.7} />
        {circular && code.column.spiral ? <div className="dw-span-all">
          <SegmentedControl label="Refuerzo transversal" size="sm" value={spiral ? 'spiral' : 'ties'} onValueChange={set('transverse')}
            options={[{ value: 'ties', label: 'Estribos circulares' }, { value: 'spiral', label: 'Zuncho' }]} />
        </div> : null}
        <BarSelect label={spiral ? 'Zuncho' : circular ? 'Estribo circular' : 'Estribo'} value={draft.tie} onChange={set('tie')} usage="transverse" />
        {circular
          ? <NumberField label="Número de barras" unit="pzas" value={draft.barCount} onChange={set('barCount')} min={code.column.circularMinimumBars} />
          : <>
            <NumberField label="Barras cara b" unit="pzas" value={draft.barsWidth} onChange={set('barsWidth')} min={2} />
            <NumberField label="Barras cara h" unit="pzas" value={draft.barsDepth} onChange={set('barsDepth')} min={2} />
          </>}
        <Disclosure label="Alternativas constructivas">
          <Select label="Criterio de comparación" value={alternativeObjective} onChange={(event) => setAlternativeObjective(event.currentTarget.value as ReinforcementObjective)}>
            <option value="minimum-steel">Menor área de acero</option><option value="few-diameters">Menos diámetros</option><option value="available-bars">Diámetros disponibles</option>
          </Select>
          {alternativeObjective === 'available-bars' ? <details className="dw-span-all"><summary>Diámetros en existencia · solo esta sesión</summary>
            <div className="dw-group__grid" data-columns={3}>{REBAR_SIZES.map((bar) => <label key={bar.diameterMm} className="dw-check"><input type="checkbox" checked={availableDiameters.includes(bar.diameterMm)} onChange={(event) => { const checked = event.currentTarget.checked; setAvailableDiameters((current) => checked ? [...new Set([...current, bar.diameterMm])].sort((a, b) => a - b) : current.filter((value) => value !== bar.diameterMm)); }} /> Ø {bar.diameterMm} mm</label>)}</div>
          </details> : null}
          {reinforcementSearch ? <p role="status">Comparando armados con geometría y acciones fijas…</p> : null}
          {alternatives ? <ReinforcementAlternatives candidates={alternatives.candidates} onApply={applyAlternative} /> : null}
          {alternatives?.reason === 'empty-stock' ? <p role="alert">Selecciona diámetros disponibles del catálogo.</p> : null}
          {alternatives?.reason === 'no-feasible-candidate' ? <p role="status">No hay alternativas que pasen las verificaciones evaluadas con esta geometría.</p> : null}
          {alternatives?.error ? <p role="alert">No se pudo ejecutar la comparación en segundo plano. Las entradas siguen disponibles.</p> : null}
          <p className="dw-help">Peso estimado con las barras longitudinales sobre la altura libre; estribos y anclajes excluidos. Cortante y otras revisiones fuera del motor se muestran como pendientes.</p>
        </Disclosure>
      </FieldGroup>
      <FieldGroup title={spiral ? 'Paso del zuncho' : 'Separación de estribos'} action={<InlineAction label="Usar propuesta" title="Volver a calcular la separación automática" onClick={() => replace({ ...draft, tieSpacing: '', endTieSpacing: '' })} />}>
        <UnitField label={spiral ? 'Paso propio s' : 'Propia al centro s'} unit="cm" value={draft.tieSpacing} onValueChange={set('tieSpacing')}
          placeholder="Propuesta" hint="Vacío usa la propuesta" error={draft.tieSpacing.trim() && (!Number.isFinite(parseNumber(draft.tieSpacing)) || parseNumber(draft.tieSpacing) <= 0) ? 'Debe ser mayor que cero' : undefined} />
        {!spiral && code.column.ties === 'ntc' ? <UnitField label="Propia en extremos so" unit="cm" value={draft.endTieSpacing} onValueChange={set('endTieSpacing')}
          placeholder="Propuesta" hint="Ambos extremos Lo" error={draft.endTieSpacing.trim() && (!Number.isFinite(parseNumber(draft.endTieSpacing)) || parseNumber(draft.endTieSpacing) <= 0) ? 'Debe ser mayor que cero' : undefined} /> : null}
        {result.ok ? <div className="dw-span-all"><ActionNote text={`Propuesta: ${formatNumber(result.ties.proposedCenterSpacingMm / 10, 1)} cm${result.ties.endLengthMm > 0 ? ` al centro · ${formatNumber(result.ties.proposedEndSpacingMm / 10, 1)} cm en Lo` : ''}. ${draft.tieSpacing.trim() || draft.endTieSpacing.trim() ? 'Se evalúa tu separación, sin ajustarla en silencio.' : 'Puedes escribir otra separación para verificarla.'}`} /></div> : null}
      </FieldGroup>
      <p className="dw-span-all" aria-label="Resumen de esbeltez">Esbeltez: {braced ? 'sin desplazamiento lateral' : 'con desplazamiento lateral'} · lu = {draft.length} m · k = {draft.k}.</p>
      <p className="dw-span-all" aria-label="Resumen de acciones capturadas">Cortantes sin verificar: Vux = {draft.shearX} kN · Vuy = {draft.shearY} kN.</p>
      <Disclosure label="Hipótesis de esbeltez">
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
      </Disclosure>
      <Disclosure label="Clave y ubicación"><IdentityGroup tag={draft.tag} place={draft.place} onTag={set('tag')} onPlace={set('place')} example="C-1" /></Disclosure>
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
