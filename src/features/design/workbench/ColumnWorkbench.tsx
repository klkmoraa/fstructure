import { useMemo } from 'react';
import { SegmentedControl } from '../../../design-system/components/controls';
import { LayerToggle } from '../../../design-system/components/editor';
import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import { designColumn, type ColumnDesignInput, type ColumnDesignResult } from '../../../design/elements/column';
import { rebarLabel } from '../../../design/elements/shared';
import { ColumnSection, InteractionChart } from './ColumnDrawings';
import {
  BarSelect, ChecksList, Disclosure, ErrorsPanel, FieldGroup, GroupSelect, MoreOptions, NumberField, PanelSection, RebarList, Summary, ValuesTable, Verdict,
  formatNumber, mpaFromKgcm2, mpaHint, parseNumber, useStoredDraft,
} from './common';
import { Plate, WorkbenchLayout, verdictLabel, type WorkbenchChrome } from './WorkbenchLayout';

const DEFAULTS = {
  width: '40', depth: '40', cover: '4', fc: '250', fy: '4200', bar: '19.1', barsWidth: '3', barsDepth: '3', tie: '9.5',
  axial: '900', momentX: '80', momentY: '40', shearX: '0', shearY: '0', length: '3', k: '1', curvature: 'single', endRatio: '1', sustained: '0.6',
  group: 'B2', groundFloor: 'no', aggregate: '19', braced: 'yes', swayX: '0', swayY: '0', stability: '0.05',
};

const toInput = (codeId: DesignCodeId, draft: typeof DEFAULTS): ColumnDesignInput => ({
  code: codeId,
  widthMm: parseNumber(draft.width) * 10,
  depthMm: parseNumber(draft.depth) * 10,
  coverMm: parseNumber(draft.cover) * 10,
  fcMpa: mpaFromKgcm2(draft.fc),
  fyMpa: mpaFromKgcm2(draft.fy),
  barDiameterMm: parseNumber(draft.bar),
  barsAlongWidth: parseNumber(draft.barsWidth),
  barsAlongDepth: parseNumber(draft.barsDepth),
  tieDiameterMm: parseNumber(draft.tie),
  maxAggregateMm: parseNumber(draft.aggregate),
  axialKn: parseNumber(draft.axial),
  momentXKnm: parseNumber(draft.momentX),
  momentYKnm: parseNumber(draft.momentY),
  unbracedLengthM: parseNumber(draft.length),
  effectiveLengthFactor: parseNumber(draft.k),
  curvature: draft.curvature === 'double' ? 'double' : 'single',
  endMomentRatio: parseNumber(draft.endRatio),
  shearXKn: parseNumber(draft.shearX),
  shearYKn: parseNumber(draft.shearY),
  group: draft.group === 'A' || draft.group === 'B1' ? draft.group : 'B2',
  groundFloor: draft.groundFloor === 'yes',
  sustainedRatio: parseNumber(draft.sustained),
  braced: draft.braced !== 'no',
  swayMomentXKnm: draft.braced === 'no' ? parseNumber(draft.swayX) : 0,
  swayMomentYKnm: draft.braced === 'no' ? parseNumber(draft.swayY) : 0,
  stabilityIndex: draft.braced === 'no' ? parseNumber(draft.stability) : 0,
});

const tieText = (result: ColumnDesignResult) => result.ties.endLengthMm > 0
  ? `E ${rebarLabel(result.ties.diameterMm)} @ ${formatNumber(result.ties.endSpacingMm / 10, 1)} cm en Lo · @ ${formatNumber(result.ties.centerSpacingMm / 10, 1)} cm al centro`
  : `E ${rebarLabel(result.ties.diameterMm)} @ ${formatNumber(result.ties.centerSpacingMm / 10, 1)} cm`;

const methodLabel: Record<ColumnDesignResult['capacity']['method'], string> = {
  axial: 'Compresión axial',
  'uniaxial-x': 'Flexocompresión en X',
  'uniaxial-y': 'Flexocompresión en Y',
  'bresler-load': 'Biaxial · carga recíproca (Bresler)',
  'bresler-contour': 'Biaxial · contorno de carga',
};

function columnMemo(result: ColumnDesignResult): string {
  const { input } = result;
  return [
    `COLUMNA ${input.widthMm / 10}×${input.depthMm / 10} cm · ${designCode(input.code).name} · Pu = ${input.axialKn} kN · Mux = ${input.momentXKnm} kN·m · Muy = ${input.momentYKnm} kN·m`,
    ...(input.braced ? [] : [`Marco con desplazamiento lateral: M2s = ${input.swayMomentXKnm} / ${input.swayMomentYKnm} kN·m · Q = ${input.stabilityIndex} · δs = ${formatNumber(Math.max(result.magnification.x.swayFactor, result.magnification.y.swayFactor), 2)}`]),
    `Esbeltez = ${formatNumber(Math.max(result.slenderness.x, result.slenderness.y), 1)} (límite ${formatNumber(result.slenderness.limit, 0)}) · Mc = ${formatNumber(result.magnification.x.designMomentKnm)} / ${formatNumber(result.magnification.y.designMomentKnm)} kN·m (δ ${formatNumber(result.magnification.x.factor, 2)} / ${formatNumber(result.magnification.y.factor, 2)})`,
    `Refuerzo: ${result.bars.length} ${rebarLabel(input.barDiameterMm)} (ρ = ${formatNumber(result.steelRatio * 100, 2)} %)`,
    `Estribos: ${tieText(result)}`,
    `Traslape Clase B: ${formatNumber(result.spliceLengthMm / 10, 0)} cm`,
    `${methodLabel[result.capacity.method]}: ${Math.round(result.capacity.ratio * 100)} % · ${result.capacity.detail}`,
    ...result.checks.map((check) => `${check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '!'} ${check.label}`),
    'FStructure · Diseño experimental; requiere revisión profesional.',
  ].join('\n');
}

export function ColumnWorkbench({ chrome }: { chrome: WorkbenchChrome }) {
  const { draft, set, reset } = useStoredDraft('column', DEFAULTS);
  const code = designCode(chrome.code);
  const result = useMemo(() => designColumn(toInput(chrome.code, draft)), [chrome.code, draft]);
  const braced = draft.braced !== 'no';
  const slendernessSymbol = code.column.neglectUsesEffectiveLength ? 'kH/r' : 'H/r';
  const symmetric = result.ok && Math.abs(result.input.widthMm - result.input.depthMm) < 1e-6 && result.input.barsAlongWidth === result.input.barsAlongDepth;

  return <WorkbenchLayout
    chrome={chrome}
    title="Columna"
    memo={result.ok ? columnMemo(result) : null}
    onReset={reset}
    verdict={result.ok ? { status: result.status, label: verdictLabel(result.status, result.governingRatio) } : { status: 'error', label: 'Datos incompletos' }}
    caption={result.ok ? `${result.bars.length} ${rebarLabel(result.input.barDiameterMm)} · ρ ${formatNumber(result.steelRatio * 100, 2)} %` : undefined}
    inputs={<>
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
        <NumberField label="f′c" unit="kg/cm²" value={draft.fc} onChange={set('fc')} hint={mpaHint(draft.fc)} />
        <NumberField label="fy" unit="kg/cm²" value={draft.fy} onChange={set('fy')} hint={mpaHint(draft.fy)} />
      </FieldGroup>
      {code.column.geometryLimits ? <FieldGroup title="Construcción" columns={1}>
        <GroupSelect value={draft.group} onChange={set('group')} groups={[
          { value: 'B2', label: 'Subgrupo B2 · dimensión mínima 25 cm' },
          { value: 'B1', label: 'Subgrupo B1 · dimensión mínima 30 cm' },
          { value: 'A', label: 'Grupo A · dimensión mínima 30 cm' },
        ]} />
        <LayerToggle label="Planta baja o primer nivel con sismo" checked={draft.groundFloor === 'yes'}
          onCheckedChange={(checked) => set('groundFloor')(checked ? 'yes' : 'no')} />
      </FieldGroup> : null}
      <FieldGroup title="Esbeltez">
        <div className="dw-span-all">
          <SegmentedControl label="Marco" size="sm" value={braced ? 'yes' : 'no'} onValueChange={set('braced')}
            options={[{ value: 'yes', label: 'Sin desplazamiento' }, { value: 'no', label: 'Con desplazamiento lateral' }]} />
        </div>
        <NumberField label="Altura libre lu" unit="m" value={draft.length} onChange={set('length')} />
        <NumberField label="Factor k" unit="×" value={draft.k} onChange={set('k')} hint={braced ? '≤ 1 contraventeado' : '≥ 1 con desplazamiento'} />
        {braced ? null : <>
          <NumberField label="M2s x" unit="kN·m" value={draft.swayX} onChange={set('swayX')} />
          <NumberField label="M2s y" unit="kN·m" value={draft.swayY} onChange={set('swayY')} />
          <NumberField label={code.id === 'ntc-2023' ? 'Índice λest' : 'Índice Q'} unit="×" value={draft.stability} onChange={set('stability')} />
        </>}
        <div className="dw-span-all">
          <SegmentedControl label="Curvatura" size="sm" value={draft.curvature} onValueChange={set('curvature')}
            options={[{ value: 'single', label: 'Curvatura simple' }, { value: 'double', label: 'Curvatura doble' }]} />
        </div>
        {braced ? null : <p className="dw-footnote dw-span-all">Mux y Muy: momentos sin desplazamiento.</p>}
      </FieldGroup>
      <MoreOptions>
        <NumberField label="Vux" unit="kN" value={draft.shearX} onChange={set('shearX')} min={-1e9} />
        <NumberField label="Vuy" unit="kN" value={draft.shearY} onChange={set('shearY')} min={-1e9} />
        <NumberField label="|M1/M2|" unit="×" value={draft.endRatio} onChange={set('endRatio')} hint="1 = momentos iguales" />
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
      <Verdict status={result.status} ratio={result.governingRatio} title={`Columna ${formatNumber(result.input.widthMm / 10, 0)} × ${formatNumber(result.input.depthMm / 10, 0)} cm`}>
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
          { kind: 'bar', title: `${result.bars.length} ${rebarLabel(result.input.barDiameterMm)}`, detail: `As ${formatNumber(result.steelAreaMm2 / 100, 2)} cm² · ρ ${formatNumber(result.steelRatio * 100, 2)} %` },
          { kind: 'stirrup', title: tieText(result), detail: result.ties.endLengthMm > 0
            ? `Lo = ${formatNumber(result.ties.endLengthMm / 10, 0)} cm desde cada extremo · ${result.ties.crossTiesParallelToX + result.ties.crossTiesParallelToY} grapas por juego · hx ${formatNumber(result.ties.hxMm / 10, 1)} cm`
            : `${result.ties.crossTiesParallelToX + result.ties.crossTiesParallelToY} grapas por juego · estribo mínimo ${rebarLabel(result.ties.minimumDiameterMm)}` },
          { kind: 'bar', title: 'Traslape Clase B', detail: `${formatNumber(result.spliceLengthMm / 10, 0)} cm a tensión` },
        ]} />
      </PanelSection>
      <PanelSection title="Comprobaciones"><ChecksList checks={result.checks} /></PanelSection>
      <Disclosure label="Detalle del cálculo">
        <ValuesTable rows={[
          { symbol: 'Ag', label: 'Área bruta', value: `${formatNumber(result.grossAreaMm2 / 100, 0)} cm²` },
          { symbol: 'P0', label: 'Axial nominal', value: `${formatNumber(result.squashLoadKn, 0)} kN` },
          { symbol: 'φPn,máx', label: `${code.maximumAxialCoefficient === 1 ? '' : `${code.maximumAxialCoefficient}·`}φ·P0 (φ = ${code.compressionFactor})`, value: `${formatNumber(result.maximumDesignAxialKn, 0)} kN` },
          { symbol: 'emín', label: code.column.minimumMoment === 'eccentricity' ? '0.05h ≥ 20 mm (X / Y)' : '15 + 0.03h si es esbelta (X / Y)', value: `${formatNumber(result.magnification.x.minimumEccentricityMm, 0)} / ${formatNumber(result.magnification.y.minimumEccentricityMm, 0)} mm` },
          { symbol: 'VcR', label: 'Cortante del concreto X / Y', value: `${formatNumber(result.ties.shear.x.concreteStrengthKn, 0)} / ${formatNumber(result.ties.shear.y.concreteStrengthKn, 0)} kN` },
          { symbol: 'Pb · Mb', label: 'Balanceada X', value: `${formatNumber(result.aboutX.balanced.axialKn, 0)} kN · ${formatNumber(result.aboutX.balanced.momentKnm, 0)} kN·m` },
          { symbol: slendernessSymbol, label: `X / Y · límite ${formatNumber(result.slenderness.limit, 0)} (${code.column.radiusNote})`, value: `${formatNumber(result.slenderness.x, 1)} / ${formatNumber(result.slenderness.y, 1)}` },
          { symbol: 'Pc', label: 'Carga crítica X / Y', value: `${formatNumber(result.magnification.x.criticalLoadKn, 0)} / ${formatNumber(result.magnification.y.criticalLoadKn, 0)} kN` },
          { symbol: 'Cm', label: 'Factor de momento', value: formatNumber(result.magnification.x.cm, 2) },
          { symbol: 'M2,mín', label: 'Pu·emín (X)', value: `${formatNumber(result.magnification.x.minimumMomentKnm)} kN·m` },
          { symbol: 'φ', label: code.axialTransition ? 'Según φPn' : 'Según εt', value: `${code.compressionFactor} → 0.90` },
        ]} />
      </Disclosure>
    </> : null}
  />;
}
