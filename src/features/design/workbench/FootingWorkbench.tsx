import { useMemo } from 'react';
import { LayerToggle } from '../../../design-system/components/editor';
import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import { designFooting, type FootingDesignInput, type FootingDesignResult, type FootingDirection } from '../../../design/elements/footing';
import { rebarLabel } from '../../../design/elements/shared';
import {
  BarSelect, ChecksList, Disclosure, splitChecks, ErrorsPanel, FieldGroup, GroupSelect, MoreOptions, NumberField, PanelSection, RebarList, Summary, ValuesTable, Verdict,
  formatNumber, mpaFromKgcm2, parseNumber, useStoredDraft,
} from './common';
import { FootingPlan, FootingSection } from './FootingDrawings';
import { Plate, WorkbenchLayout, verdictLabel, type WorkbenchChrome } from './WorkbenchLayout';

const DEFAULTS = {
  c1: '40', c2: '40', dead: '600', live: '300', group: 'B', seismic: 'no', qa: '150', fc: '250', fy: '4200',
  moments: 'no', mx: '0', my: '60', mux: '0', muy: '85',
  autoPlan: 'yes', sideX: '250', sideY: '250', autoThickness: 'yes', thickness: '50', cover: '7.5', bar: '15.9',
};

const toInput = (codeId: DesignCodeId, draft: typeof DEFAULTS): FootingDesignInput => {
  const moments = draft.moments === 'yes';
  const code = designCode(codeId);
  return {
    code: codeId,
    columnWidthMm: parseNumber(draft.c1) * 10,
    columnDepthMm: parseNumber(draft.c2) * 10,
    deadKn: parseNumber(draft.dead),
    liveKn: parseNumber(draft.live),
    combinations: code.loadCombinations(draft.group === 'A' ? 'A' : 'B'),
    seismicCombination: code.usesStructureGroup && moments && draft.seismic === 'yes',
    serviceMomentXKnm: moments ? parseNumber(draft.mx) : 0,
    serviceMomentYKnm: moments ? parseNumber(draft.my) : 0,
    ultimateMomentXKnm: moments ? parseNumber(draft.mux) : 0,
    ultimateMomentYKnm: moments ? parseNumber(draft.muy) : 0,
    allowablePressureKpa: parseNumber(draft.qa),
    fcMpa: mpaFromKgcm2(draft.fc),
    fyMpa: mpaFromKgcm2(draft.fy),
    sideXMm: draft.autoPlan === 'yes' ? null : parseNumber(draft.sideX) * 10,
    sideYMm: draft.autoPlan === 'yes' ? null : parseNumber(draft.sideY) * 10,
    thicknessMm: draft.autoThickness === 'yes' ? null : parseNumber(draft.thickness) * 10,
    coverMm: parseNumber(draft.cover) * 10,
    barDiameterMm: parseNumber(draft.bar),
  };
};

const meters = (mm: number) => formatNumber(mm / 1000, 2);
const planText = (result: FootingDesignResult) => `${meters(result.sideXMm)} × ${meters(result.sideYMm)} m`;

const directionTitle = (direction: FootingDirection, diameterMm: number) =>
  `${direction.axis.toUpperCase()}: ${direction.barCount} ${rebarLabel(diameterMm)} @ ${formatNumber(direction.spacingMm / 10, 0)} cm`;
const directionDetail = (direction: FootingDirection) => {
  const band = direction.band
    ? ` · ${direction.band.barsInBand} en la banda central de ${meters(direction.band.widthMm)} m (@ ${formatNumber(direction.band.spacingInBandMm / 10, 0)} cm), resto @ ${formatNumber(direction.band.spacingOutsideMm / 10, 0)} cm`
    : '';
  const anchorage = direction.anchorage === 'straight' ? '' : direction.anchorage === 'hook' ? ` · gancho estándar (ldh ${formatNumber(direction.hookLengthMm / 10, 0)} cm)` : ' · anclaje insuficiente';
  return `Capa ${direction.layer === 'bottom' ? 'inferior' : 'superior'} · As ${formatNumber(direction.providedMm2 / 100, 2)} cm² (req. ${formatNumber(Math.max(direction.requiredMm2, direction.minimumMm2, direction.punchingMinimumMm2) / 100, 2)})${band}${anchorage}`;
};

function footingMemo(result: FootingDesignResult): string {
  const { input } = result;
  return [
    `ZAPATA AISLADA ${planText(result)} · h = ${formatNumber(result.thicknessMm / 10, 0)} cm · ${designCode(input.code).name}`,
    `Combinaciones: ${input.combinations.map((combination) => combination.label).join(' · ')} · Pu = ${formatNumber(result.ultimateAxialKn, 0)} kN`,
    `Columna ${input.columnWidthMm / 10}×${input.columnDepthMm / 10} cm · P = ${input.deadKn + input.liveKn} kN · Mx = ${input.serviceMomentXKnm} · My = ${input.serviceMomentYKnm} kN·m (servicio)`,
    `Presión de servicio ${formatNumber(result.service.minimumKpa, 0)} a ${formatNumber(result.service.maximumKpa, 0)} kPa · admisible ${input.allowablePressureKpa} kPa`,
    `Refuerzo ${directionTitle(result.directions.x, input.barDiameterMm)} · ${directionTitle(result.directions.y, input.barDiameterMm)}`,
    ...result.checks.map((check) => `${check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '!'} ${check.label}${check.ratio !== undefined && Number.isFinite(check.ratio) ? ` (${Math.round(check.ratio * 100)} %)` : ''}`),
    'FStructure · Diseño experimental; requiere revisión profesional.',
  ].join('\n');
}

export function FootingWorkbench({ chrome }: { chrome: WorkbenchChrome }) {
  const { draft, set, reset } = useStoredDraft('footing', DEFAULTS);
  const code = designCode(chrome.code);
  const result = useMemo(() => designFooting(toInput(chrome.code, draft)), [chrome.code, draft]);
  const [checks, notes] = splitChecks(result.ok ? result.checks : []);

  return <WorkbenchLayout
    chrome={chrome}
    title="Zapata aislada"
    memo={result.ok ? footingMemo(result) : null}
    onReset={reset}
    verdict={result.ok ? { status: result.status, label: verdictLabel(result.status, result.governingRatio) } : { status: 'error', label: 'Datos incompletos' }}
    caption={result.ok ? `${planText(result)} · h ${formatNumber(result.thicknessMm / 10, 0)} cm` : undefined}
    inputs={<>
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
      <Verdict status={result.status} ratio={result.governingRatio} title={`Zapata ${planText(result)}`}>
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
      <PanelSection title="Comprobaciones"><ChecksList checks={checks} /></PanelSection>
      <Disclosure label="Detalle del cálculo">
        <RebarList items={[result.directions.x, result.directions.y].map((direction) => ({
          kind: 'bar' as const,
          title: directionTitle(direction, result.input.barDiameterMm),
          detail: directionDetail(direction),
        }))} />
        <ValuesTable rows={[
          { symbol: 'A', label: 'Área de contacto', value: `${formatNumber(result.sideXMm * result.sideYMm / 1e6, 2)} m²` },
          { symbol: 'ex · ey', label: 'Excentricidad', value: `${formatNumber(result.service.eccentricityXMm / 10, 1)} · ${formatNumber(result.service.eccentricityYMm / 10, 1)} cm` },
          { symbol: 'qu', label: 'Última mín · máx', value: `${formatNumber(result.ultimate.minimumKpa, 0)} · ${formatNumber(result.ultimate.maximumKpa, 0)} kPa` },
          { symbol: 'bo', label: 'Perímetro crítico', value: `${formatNumber(result.punching.perimeterMm / 10, 0)} cm` },
          { symbol: 'Vu', label: 'Penetración directa', value: `${formatNumber(result.punching.demandKn, 0)} kN` },
          ...(code.footing.punchingSizeFactor ? [{ symbol: 'λs', label: 'Efecto de tamaño (penetración)', value: formatNumber(result.punching.sizeFactor, 3) }] : []),
          { symbol: 'φ', label: 'Cortante · penetración', value: `${code.shearFactor} · ${result.punching.resistanceFactor}` },
          { symbol: 'ld · ldh', label: 'Recta / gancho X', value: `${formatNumber(result.directions.x.developmentLengthMm / 10, 0)} / ${formatNumber(result.directions.x.hookLengthMm / 10, 0)} cm` },
          { symbol: 'd mín', label: 'Peralte efectivo mínimo', value: `${formatNumber(code.footing.minimumEffectiveDepthMm / 10, 0)} cm` },
          { symbol: 'Vu / φVc', label: 'Como viga X', value: `${formatNumber(result.directions.x.oneWayDemandKn, 0)} / ${formatNumber(result.directions.x.oneWayStrengthKn, 0)} kN` },
          { symbol: 'Vu / φVc', label: 'Como viga Y', value: `${formatNumber(result.directions.y.oneWayDemandKn, 0)} / ${formatNumber(result.directions.y.oneWayStrengthKn, 0)} kN` },
        ]} />
        <ChecksList checks={notes} />
      </Disclosure>
    </> : null}
  />;
}
