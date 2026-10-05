import { designCode, isDesignCodeId, type DesignCode, type DesignCodeId, type LoadCombination } from './codes';
import {
  barArea,
  capacityCheck,
  ceilTo,
  complementary,
  flexuralCapacity,
  floorTo,
  governingRatio,
  isPositiveFinite,
  overallStatus,
  requiredFlexuralSteelMm2,
  tracedAt,
  withClauses,
  type ElementCheck,
} from './shared';

/**
 * Zapata corrida bajo muro, por metro de longitud. El muro baja una carga
 * lineal centrada; la zapata trabaja como dos voladizos desde el paño del muro
 * (muro de concreto) o desde la mitad entre el eje y el paño (muro de
 * mampostería, NTC tabla 9.4.7.4). Presión uniforme: sin momento en la base
 * del muro. En la NTC se desprecia λs en cortante (9.3.1.6).
 */
export interface StripFootingInput {
  readonly code: DesignCodeId;
  readonly wallWidthMm: number;
  readonly wallMaterial: 'concrete' | 'masonry';
  /** Cargas de servicio por metro de muro. */
  readonly deadKnPerM: number;
  readonly liveKnPerM: number;
  readonly combinations: readonly LoadCombination[];
  readonly allowablePressureKpa: number;
  readonly fcMpa: number;
  readonly fyMpa: number;
  /** `null` dimensiona el ancho con la presión admisible. */
  readonly widthMm: number | null;
  /** `null` busca el peralte mínimo que cumple cortante. */
  readonly thicknessMm: number | null;
  readonly coverMm: number;
  /** Barras transversales (resisten el voladizo). */
  readonly barDiameterMm: number;
  /** Barras longitudinales de distribución. */
  readonly distributionBarDiameterMm: number;
  /** Qué apoya en la zapata, para los textos: muro (por omisión) o contratrabe (zapata de lindero). */
  readonly supportName?: 'muro' | 'contratrabe';
}

export interface StripFootingResult {
  readonly ok: true;
  readonly input: StripFootingInput;
  readonly widthMm: number;
  readonly thicknessMm: number;
  readonly effectiveDepthMm: number;
  readonly servicePressureKpa: number;
  readonly ultimatePressureKpa: number;
  readonly ultimateLoadKnPerM: number;
  /** Voladizo hasta la sección crítica de flexión. */
  readonly cantileverMm: number;
  readonly momentKnmPerM: number;
  readonly shearKnPerM: number;
  readonly shearStrengthKnPerM: number;
  readonly transverse: {
    readonly requiredMm2PerM: number;
    readonly minimumMm2PerM: number;
    readonly providedMm2PerM: number;
    readonly spacingMm: number;
    readonly maximumSpacingMm: number;
    readonly strengthKnmPerM: number;
    readonly resistanceFactor: number;
    readonly developmentLengthMm: number;
    readonly hookLengthMm: number;
    readonly availableAnchorageMm: number;
    readonly anchorage: 'straight' | 'hook' | 'insufficient';
  };
  readonly distribution: { readonly requiredMm2: number; readonly barCount: number; readonly spacingMm: number };
  readonly checks: readonly ElementCheck[];
  readonly governingRatio: number;
  readonly status: 'pass' | 'fail' | 'warning';
}

const STRIP = 1_000;

function validate(input: StripFootingInput): string[] {
  const errors: string[] = [];
  if (!isDesignCodeId(input.code)) return ['Norma de diseño desconocida.'];
  const positive: [keyof StripFootingInput, string][] = [
    ['wallWidthMm', 'Espesor del muro'], ['allowablePressureKpa', 'Capacidad del suelo'], ['fcMpa', "f'c"], ['fyMpa', 'fy'],
    ['coverMm', 'Recubrimiento'], ['barDiameterMm', 'Varilla transversal'], ['distributionBarDiameterMm', 'Varilla longitudinal'],
  ];
  for (const [key, label] of positive) if (!isPositiveFinite(input[key] as number)) errors.push(`${label} debe ser mayor que cero.`);
  if (!Number.isFinite(input.deadKnPerM) || input.deadKnPerM < 0 || !Number.isFinite(input.liveKnPerM) || input.liveKnPerM < 0) errors.push('Las cargas deben ser cero o positivas.');
  if (input.deadKnPerM + input.liveKnPerM <= 0) errors.push('El muro debe bajar alguna carga.');
  if (input.widthMm !== null && (!isPositiveFinite(input.widthMm) || input.widthMm <= input.wallWidthMm)) errors.push('El ancho de la zapata debe ser mayor que el muro.');
  if (input.thicknessMm !== null && (!isPositiveFinite(input.thicknessMm) || input.thicknessMm <= input.coverMm + 2 * input.barDiameterMm)) errors.push('El peralte es insuficiente para el recubrimiento.');
  return errors;
}

function evaluate(code: DesignCode, input: StripFootingInput, widthMm: number, thicknessMm: number) {
  const fc = input.fcMpa;
  const fy = input.fyMpa;
  const d = thicknessMm - input.coverMm - input.barDiameterMm / 2;
  const service = input.deadKnPerM + input.liveKnPerM;
  const ultimate = Math.max(...input.combinations.map((combination) => combination.dead * input.deadKnPerM + combination.live * input.liveKnPerM));
  const qu = ultimate / (widthMm / 1e3); // kPa
  // Sección crítica: paño del muro de concreto; en mampostería, a la mitad entre el eje y el paño.
  const critical = input.wallMaterial === 'masonry' ? input.wallWidthMm / 4 : input.wallWidthMm / 2;
  const cantilever = widthMm / 2 - critical;
  const momentKnm = qu * (cantilever / 1e3) ** 2 / 2;
  const shearArm = widthMm / 2 - input.wallWidthMm / 2 - d;
  const shearKn = shearArm > 0 ? qu * shearArm / 1e3 : 0;
  const required = requiredFlexuralSteelMm2(momentKnm, STRIP, d, fy, fc, d, code.flexureFactor, code.tensionControlledStrain) ?? Number.POSITIVE_INFINITY;
  const minimum = code.footing.minimumSteelRatio * STRIP * thicknessMm;
  const area = barArea(input.barDiameterMm);
  const maximumSpacing = code.footing.maximumSpacing(thicknessMm);
  const target = Math.max(required, minimum);
  const spacing = Math.min(maximumSpacing, Number.isFinite(target) ? floorTo(area * STRIP / target, 25) || floorTo(area * STRIP / target, 5) : 50);
  const provided = area * STRIP / Math.max(spacing, 1);
  const capacity = flexuralCapacity(provided, STRIP, d, fy, fc, d, code.flexureFactor);
  const ratio = provided / (STRIP * d);
  // NTC 9.3.1.6: en zapatas corridas apoyadas en el terreno se permite despreciar λs.
  const shearStrength = code.footing.oneWay === 'ntc'
    ? code.shearFactor * 0.66 * Math.cbrt(ratio) * Math.sqrt(fc) * STRIP * d / 1e3
    : code.shearFactor * 0.17 * Math.sqrt(fc) * STRIP * d / 1e3;
  const development = code.developmentLength({
    diameterMm: input.barDiameterMm, fyMpa: fy, fcMpa: fc, topBar: false,
    clearSpacingMm: spacing - input.barDiameterMm, clearCoverMm: input.coverMm, minimumStirrups: false,
  });
  const hook = code.hookedDevelopmentMm(input.barDiameterMm, fy, fc);
  const available = widthMm / 2 - input.wallWidthMm / 2 - input.coverMm;
  return {
    d, service, ultimate, qu, cantilever, momentKnm, shearKn, shearStrength, required, minimum, provided, spacing, maximumSpacing, capacity,
    development: development.lengthMm, hook, available,
    anchorage: (development.lengthMm <= available ? 'straight' : hook <= available ? 'hook' : 'insufficient') as 'straight' | 'hook' | 'insufficient',
  };
}

export function designStripFooting(input: StripFootingInput): StripFootingResult | { ok: false; errors: readonly string[] } {
  const errors = validate(input);
  if (errors.length) return { ok: false, errors };
  const code = designCode(input.code);
  const service = input.deadKnPerM + input.liveKnPerM;
  const width = input.widthMm ?? Math.max(ceilTo(service / input.allowablePressureKpa * 1e3, 50), input.wallWidthMm + 200);
  let h = input.thicknessMm ?? 200;
  if (input.thicknessMm === null) {
    for (; h < 1_500; h += 50) {
      const trial = evaluate(code, input, width, h);
      if (trial.d >= code.footing.minimumEffectiveDepthMm && trial.shearKn <= trial.shearStrength && Number.isFinite(trial.required)) break;
    }
  }
  const state = evaluate(code, input, width, h);
  const refs = code.refs;
  const pressure = service / (width / 1e3);
  const distributionRequired = code.footing.minimumSteelRatio * width * h;
  const distributionArea = barArea(input.distributionBarDiameterMm);
  const usable = width - 2 * input.coverMm - input.distributionBarDiameterMm;
  let distributionCount = Math.max(2, Math.ceil(distributionRequired / distributionArea));
  const distributionMaximum = code.footing.maximumSpacing(h);
  if (usable / (distributionCount - 1) > distributionMaximum) distributionCount = Math.ceil(usable / distributionMaximum) + 1;
  const combinations = input.combinations.map((combination) => combination.label).join(' · ');
  const wall = input.supportName ?? 'muro';
  const perMeter = `Por metro de ${wall}`;
  const ofWall = wall === 'muro' ? 'del muro' : 'de la contratrabe';
  // NTC 9.3.1.3: la zapata corrida trabaja en una dirección y se diseña como losa (acero mínimo de 6.6.6.1.1).
  const minimumSteelRef = refs.slabMinSteel.standard === 'complementary' ? refs.footingMinSteel : withClauses(refs.slabMinSteel, refs.sizeEffectStrip);
  const masonry = input.wallMaterial === 'masonry';
  const masonryVerified = refs.criticalSection.standard !== 'complementary';

  const checks: ElementCheck[] = [
    tracedAt(capacityCheck('bearing', 'Presión de servicio', pressure, input.allowablePressureKpa, 'kPa', complementary('Capacidad admisible del estudio geotécnico')),
      'Bajo toda la zapata (presión uniforme)', 'Servicio: cargas sin factorizar'),
    capacityCheck('min-depth', 'Peralte efectivo mínimo', code.footing.minimumEffectiveDepthMm, state.d, 'mm', refs.footingDepth),
    tracedAt(capacityCheck('one-way', 'Cortante como viga', state.shearKn, state.shearStrength, 'kN/m', withClauses(refs.oneWay, refs.sizeEffectStrip),
      code.footing.oneWay === 'ntc'
        ? 'Sin estribos: 0.66·ρ^(1/3)·√f′c; en zapata corrida se desprecia el efecto de tamaño (λs = 1).'
        : `Sin estribos: 0.17·√f′c·b·d · FR ${code.shearFactor}.`),
    `A d del paño ${ofWall} · ${perMeter.toLowerCase()}`, combinations),
    tracedAt(capacityCheck('flexure', 'Flexión transversal', state.momentKnm, state.capacity.strengthKnm, 'kN·m/m', masonry ? withClauses(refs.footingFlexure, refs.criticalSection) : refs.footingFlexure,
      masonry
        ? `FR ${state.capacity.resistanceFactor.toFixed(2)}. Muro de mampostería: sección crítica a la mitad entre el eje y el paño${masonryVerified ? '' : ' (criterio complementario)'}.`
        : `FR ${state.capacity.resistanceFactor.toFixed(2)}.`),
    input.wallMaterial === 'masonry' ? `Entre el eje y el paño ${ofWall}` : `Paño ${ofWall}`, combinations),
    capacityCheck('steel-min', 'Acero transversal mínimo', state.minimum, state.provided, 'mm²/m', minimumSteelRef,
      `${(code.footing.minimumSteelRatio * 100).toFixed(2)} % del área bruta.`),
    capacityCheck('spacing', 'Separación del refuerzo', state.spacing, state.maximumSpacing, 'mm', refs.footingSpacing, `Máximo: ${code.footing.maximumSpacingNote}.`),
    {
      id: 'anchorage',
      label: 'Anclaje de las barras transversales',
      status: state.anchorage === 'insufficient' ? 'fail' : 'pass',
      demand: state.anchorage === 'straight' ? state.development : state.hook,
      capacity: state.available,
      unit: 'mm',
      ratio: (state.anchorage === 'straight' ? state.development : state.hook) / state.available,
      reference: refs.anchorage,
      note: state.anchorage === 'straight' ? `La barra recta desarrolla ld desde el paño ${ofWall}.`
        : state.anchorage === 'hook' ? `Remata con gancho estándar (ldh = ${Math.round(state.hook)} mm).`
          : 'Ni recta ni con gancho cabe en el voladizo: usa varilla más delgada o ensancha la zapata.',
    },
    { id: 'distribution', label: 'Acero longitudinal de distribución', status: 'info', reference: minimumSteelRef,
      note: `${distributionCount} ${input.distributionBarDiameterMm} mm en el ancho (${(code.footing.minimumSteelRatio * 100).toFixed(2)} % de B·h).` },
    { id: 'load-factors', label: 'Combinaciones de carga', status: 'info', reference: refs.loadFactors,
      note: `${combinations}: wu = ${state.ultimate.toFixed(1)} kN/m.` },
  ];
  if (!Number.isFinite(state.required)) {
    checks.push({ id: 'section', label: 'Peralte insuficiente para flexión', status: 'fail', reference: refs.footingFlexure, note: 'Aumenta el peralte.' });
  }

  return {
    ok: true,
    input,
    widthMm: width,
    thicknessMm: h,
    effectiveDepthMm: state.d,
    servicePressureKpa: pressure,
    ultimatePressureKpa: state.qu,
    ultimateLoadKnPerM: state.ultimate,
    cantileverMm: state.cantilever,
    momentKnmPerM: state.momentKnm,
    shearKnPerM: state.shearKn,
    shearStrengthKnPerM: state.shearStrength,
    transverse: {
      requiredMm2PerM: state.required,
      minimumMm2PerM: state.minimum,
      providedMm2PerM: state.provided,
      spacingMm: state.spacing,
      maximumSpacingMm: state.maximumSpacing,
      strengthKnmPerM: state.capacity.strengthKnm,
      resistanceFactor: state.capacity.resistanceFactor,
      developmentLengthMm: state.development,
      hookLengthMm: state.hook,
      availableAnchorageMm: state.available,
      anchorage: state.anchorage,
    },
    distribution: { requiredMm2: distributionRequired, barCount: distributionCount, spacingMm: floorTo(usable / (distributionCount - 1), 25) || usable / (distributionCount - 1) },
    checks,
    governingRatio: governingRatio(checks.filter((item) => ['bearing', 'one-way', 'flexure'].includes(item.id))),
    status: overallStatus(checks),
  };
}
