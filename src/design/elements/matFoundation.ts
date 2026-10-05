import { designCode, isDesignCodeId, type DesignCode, type DesignCodeId, type LoadCombination } from './codes';
import { sizeFactor } from './footing';
import {
  barArea,
  capacityCheck,
  complementary,
  flexuralCapacity,
  floorTo,
  governingRatio,
  isPositiveFinite,
  overallStatus,
  requiredFlexuralSteelMm2,
  tracedAt,
  type ElementCheck,
} from './shared';

/**
 * Losa de cimentación sobre una retícula rectangular de columnas, por el método
 * rígido convencional: reacción uniforme del suelo (NTC 9.3.2.3; las cargas por
 * tipo de columna son simétricas y la resultante cae al centro), franjas en
 * cada dirección con el ajuste de equilibrio entre reacción y cargas de
 * columna, penetración en cada columna (interior, borde o esquina) y cortante
 * como viga. La losa trabaja en dos direcciones (NTC 9.3.1.4).
 */
export interface MatLoad { readonly deadKn: number; readonly liveKn: number }
export type MatColumnKind = 'interior' | 'edge' | 'corner';

export interface MatFoundationInput {
  readonly code: DesignCodeId;
  /** Claros entre ejes en X y en Y: número y longitud. */
  readonly spansX: { readonly count: number; readonly lengthMm: number };
  readonly spansY: { readonly count: number; readonly lengthMm: number };
  /** Del eje de las columnas perimetrales al borde de la losa. */
  readonly overhangMm: number;
  readonly columnWidthMm: number;
  readonly columnDepthMm: number;
  readonly loads: Readonly<Record<MatColumnKind, MatLoad>>;
  readonly combinations: readonly LoadCombination[];
  readonly allowablePressureKpa: number;
  readonly fcMpa: number;
  readonly fyMpa: number;
  readonly coverMm: number;
  readonly barDiameterMm: number;
  /** `null` busca el espesor mínimo que cumple penetración y cortante. */
  readonly thicknessMm: number | null;
}

export interface MatColumn {
  readonly xMm: number;
  readonly yMm: number;
  readonly kind: MatColumnKind;
  readonly ultimateKn: number;
}

export interface MatPunching {
  readonly kind: MatColumnKind;
  /** Lados del perímetro crítico dentro de la losa. */
  readonly sides: 2 | 3 | 4;
  readonly alphaS: number;
  readonly perimeterMm: number;
  readonly demandKn: number;
  readonly demandStressMpa: number;
  readonly strengthStressMpa: number;
}

export interface MatStrip {
  readonly centerMm: number;
  readonly widthMm: number;
  /** Momentos por metro: positivo con tensión abajo (bajo columnas), negativo con tensión arriba (entre columnas). */
  readonly positiveKnmPerM: number;
  readonly negativeKnmPerM: number;
  /** Cortante a d del paño de las columnas, por metro. */
  readonly shearKnPerM: number;
  /** Ajuste de equilibrio: promedio de reacción y cargas entre la reacción. */
  readonly soilFactor: number;
  readonly xMm: readonly number[];
  readonly momentKnm: readonly number[];
}

export interface MatLayer {
  readonly face: 'bottom' | 'top';
  readonly momentKnmPerM: number;
  readonly effectiveDepthMm: number;
  readonly requiredMm2PerM: number;
  readonly minimumMm2PerM: number;
  readonly spacingMm: number;
  readonly providedMm2PerM: number;
  readonly strengthKnmPerM: number;
  readonly resistanceFactor: number;
}

export interface MatDirection {
  readonly axis: 'x' | 'y';
  readonly strips: readonly MatStrip[];
  readonly bottom: MatLayer;
  readonly top: MatLayer;
  readonly oneWay: { readonly demandKnPerM: number; readonly strengthKnPerM: number; readonly sizeFactor: number };
}

export interface MatFoundationResult {
  readonly ok: true;
  readonly input: MatFoundationInput;
  readonly lengthXMm: number;
  readonly lengthYMm: number;
  readonly thicknessMm: number;
  readonly effectiveDepthMm: number;
  readonly columns: readonly MatColumn[];
  readonly service: { readonly loadKn: number; readonly pressureKpa: number };
  readonly ultimate: { readonly loadKn: number; readonly pressureKpa: number };
  readonly punching: readonly MatPunching[];
  readonly directions: { readonly x: MatDirection; readonly y: MatDirection };
  readonly checks: readonly ElementCheck[];
  readonly governingRatio: number;
  readonly status: 'pass' | 'fail' | 'warning';
}

const METER = 1_000;
const ALPHA_BY_SIDES = { 4: 40, 3: 30, 2: 20 } as const;
const KINDS: readonly MatColumnKind[] = ['corner', 'edge', 'interior'];

function validate(input: MatFoundationInput): string[] {
  const errors: string[] = [];
  if (!isDesignCodeId(input.code)) return ['Norma de diseño desconocida.'];
  for (const [spans, axis] of [[input.spansX, 'X'], [input.spansY, 'Y']] as const) {
    if (!Number.isInteger(spans.count) || spans.count < 1 || spans.count > 10) errors.push(`Claros en ${axis}: entero entre 1 y 10.`);
    if (!isPositiveFinite(spans.lengthMm)) errors.push(`El claro en ${axis} debe ser mayor que cero.`);
  }
  const positive: [number, string][] = [
    [input.columnWidthMm, 'Columna c1'], [input.columnDepthMm, 'Columna c2'], [input.allowablePressureKpa, 'Capacidad del suelo'],
    [input.fcMpa, "f'c"], [input.fyMpa, 'fy'], [input.coverMm, 'Recubrimiento'], [input.barDiameterMm, 'Varilla'],
  ];
  for (const [value, label] of positive) if (!isPositiveFinite(value)) errors.push(`${label} debe ser mayor que cero.`);
  for (const kind of KINDS) {
    const load = input.loads[kind];
    if (!Number.isFinite(load.deadKn) || load.deadKn < 0 || !Number.isFinite(load.liveKn) || load.liveKn < 0) errors.push('Las cargas deben ser cero o positivas.');
  }
  if (input.combinations.length < 1) errors.push('Se requiere al menos una combinación de carga.');
  if (errors.length) return errors;
  if (!Number.isFinite(input.overhangMm) || input.overhangMm < Math.max(input.columnWidthMm, input.columnDepthMm) / 2) errors.push('El volado debe cubrir al menos media columna.');
  if (input.spansX.lengthMm <= input.columnWidthMm || input.spansY.lengthMm <= input.columnDepthMm) errors.push('Los claros deben ser mayores que las columnas.');
  if (input.thicknessMm !== null && (!isPositiveFinite(input.thicknessMm) || input.thicknessMm <= 2 * input.coverMm + 4 * input.barDiameterMm)) errors.push('El espesor no deja espacio para dos parrillas.');
  return errors;
}

/** Combinación que rige: la de mayor carga total factorizada. */
function governing(input: MatFoundationInput, columns: readonly { kind: MatColumnKind }[]): LoadCombination {
  const total = (combination: LoadCombination) => columns.reduce((sum, column) => sum + combination.dead * input.loads[column.kind].deadKn + combination.live * input.loads[column.kind].liveKn, 0);
  return input.combinations.reduce((best, combination) => total(combination) > total(best) ? combination : best);
}

function layout(input: MatFoundationInput) {
  const nx = input.spansX.count + 1;
  const ny = input.spansY.count + 1;
  const xs = Array.from({ length: nx }, (_, index) => input.overhangMm + index * input.spansX.lengthMm);
  const ys = Array.from({ length: ny }, (_, index) => input.overhangMm + index * input.spansY.lengthMm);
  const positions = ys.flatMap((y, j) => xs.map((x, i) => {
    const edges = Number(i === 0 || i === nx - 1) + Number(j === 0 || j === ny - 1);
    return { xMm: x, yMm: y, i, j, kind: (edges === 2 ? 'corner' : edges === 1 ? 'edge' : 'interior') as MatColumnKind };
  }));
  return { xs, ys, positions, lengthX: 2 * input.overhangMm + input.spansX.count * input.spansX.lengthMm, lengthY: 2 * input.overhangMm + input.spansY.count * input.spansY.lengthMm };
}

/**
 * Franja a lo largo de `axis` centrada en una línea de columnas: reacción
 * uniforme hacia arriba y cargas de columna hacia abajo, ajustadas a su
 * promedio para que la franja quede en equilibrio.
 */
function strip(length: number, lineCoords: readonly number[], loadsKn: readonly number[], pressureMpa: number, centerMm: number, widthMm: number, faceMm: number, dMm: number): MatStrip {
  const soil = pressureMpa * widthMm * length / 1e3; // kN
  const loads = loadsKn.reduce((sum, value) => sum + value, 0);
  const average = (soil + loads) / 2;
  const soilFactor = soil > 0 ? average / soil : 1;
  const loadFactor = loads > 0 ? average / loads : 1;
  const w = pressureMpa * widthMm * soilFactor / 1e3; // kN/mm hacia arriba
  const shearAt = (x: number) => w * x - lineCoords.reduce((sum, at, index) => sum + (at <= x ? loadsKn[index]! * loadFactor : 0), 0);
  const momentAt = (x: number) => (w * x ** 2 / 2 - lineCoords.reduce((sum, at, index) => sum + (at < x ? loadsKn[index]! * loadFactor * (x - at) : 0), 0)) / 1e3;
  const stations = Array.from({ length: 401 }, (_, index) => length * index / 400);
  for (const at of lineCoords) stations.push(at);
  stations.sort((left, right) => left - right);
  const moments = stations.map(momentAt);
  const perMeter = METER / widthMm;
  // Cortante a d del paño, a ambos lados de cada columna.
  const shear = Math.max(...lineCoords.flatMap((at) => [at - faceMm - dMm, at + faceMm + dMm])
    .filter((x) => x > 0 && x < length)
    .map((x) => Math.abs(shearAt(x))), 0);
  return {
    centerMm, widthMm, soilFactor,
    positiveKnmPerM: Math.max(0, ...moments) * perMeter,
    negativeKnmPerM: Math.max(0, ...moments.map((value) => -value)) * perMeter,
    shearKnPerM: shear * perMeter,
    xMm: stations,
    momentKnm: moments,
  };
}

function matLayer(code: DesignCode, input: MatFoundationInput, face: 'bottom' | 'top', momentKnmPerM: number, depthMm: number, thicknessMm: number): MatLayer {
  const { fcMpa: fc, fyMpa: fy } = input;
  const required = momentKnmPerM > 0
    ? requiredFlexuralSteelMm2(momentKnmPerM, METER, depthMm, fy, fc, depthMm, code.flexureFactor, code.tensionControlledStrain) ?? Number.POSITIVE_INFINITY
    : 0;
  // Mínimo de losa en cada cara (NTC 6.7.6.1.1: 0.0018Ag), del lado seguro en ambas.
  const minimum = code.footing.minimumSteelRatio * METER * thicknessMm;
  const area = barArea(input.barDiameterMm);
  const maximumSpacing = code.footing.maximumSpacing(thicknessMm);
  const target = Math.max(required, minimum);
  const spacing = Number.isFinite(target) ? Math.min(maximumSpacing, floorTo(area * METER / target, 25) || floorTo(area * METER / target, 5)) : 50;
  const provided = area * METER / Math.max(spacing, 1);
  const capacity = flexuralCapacity(provided, METER, depthMm, fy, fc, depthMm, code.flexureFactor);
  return {
    face, momentKnmPerM, effectiveDepthMm: depthMm, requiredMm2PerM: required, minimumMm2PerM: minimum, spacingMm: spacing,
    providedMm2PerM: provided, strengthKnmPerM: capacity.strengthKnm, resistanceFactor: capacity.resistanceFactor,
  };
}

function evaluate(code: DesignCode, input: MatFoundationInput, thicknessMm: number) {
  const plan = layout(input);
  const combination = governing(input, plan.positions);
  const factored = (kind: MatColumnKind) => combination.dead * input.loads[kind].deadKn + combination.live * input.loads[kind].liveKn;
  const columns: MatColumn[] = plan.positions.map((position) => ({ xMm: position.xMm, yMm: position.yMm, kind: position.kind, ultimateKn: factored(position.kind) }));
  const area = plan.lengthX * plan.lengthY;
  const ultimateLoad = columns.reduce((sum, column) => sum + column.ultimateKn, 0);
  const qu = ultimateLoad * 1e3 / area; // MPa
  const db = input.barDiameterMm;
  // Parrilla inferior: X abajo; Y encima. Superior: X arriba; Y debajo.
  const dX = thicknessMm - input.coverMm - db / 2;
  const dY = thicknessMm - input.coverMm - 1.5 * db;
  const average = thicknessMm - input.coverMm - db;

  const direction = (axis: 'x' | 'y'): MatDirection => {
    const along = axis === 'x' ? plan.xs : plan.ys;
    const across = axis === 'x' ? plan.ys : plan.xs;
    const length = axis === 'x' ? plan.lengthX : plan.lengthY;
    const acrossLength = axis === 'x' ? plan.lengthY : plan.lengthX;
    const face = (axis === 'x' ? input.columnWidthMm : input.columnDepthMm) / 2;
    const d = axis === 'x' ? dX : dY;
    const strips = across.map((center, line) => {
      const low = line === 0 ? 0 : (across[line - 1]! + center) / 2;
      const high = line === across.length - 1 ? acrossLength : (across[line + 1]! + center) / 2;
      const loads = along.map((_, index) => {
        const column = columns.find((item) => (axis === 'x' ? item.yMm : item.xMm) === center && (axis === 'x' ? item.xMm : item.yMm) === along[index]);
        return column?.ultimateKn ?? 0;
      });
      return strip(length, along, loads, qu, center, high - low, face, d);
    });
    const positive = Math.max(...strips.map((item) => item.positiveKnmPerM));
    const negative = Math.max(...strips.map((item) => item.negativeKnmPerM));
    const bottom = matLayer(code, input, 'bottom', positive, d, thicknessMm);
    const top = matLayer(code, input, 'top', negative, d, thicknessMm);
    const rho = Math.min(bottom.providedMm2PerM, top.providedMm2PerM) / (METER * d);
    const size = code.footing.oneWay === 'ntc' ? sizeFactor(d) : 1;
    const strength = code.footing.oneWay === 'ntc'
      ? code.shearFactor * 0.66 * size * Math.cbrt(rho) * Math.sqrt(input.fcMpa) * METER * d / 1e3
      : code.shearFactor * 0.17 * Math.sqrt(input.fcMpa) * METER * d / 1e3;
    return { axis, strips, bottom, top, oneWay: { demandKnPerM: Math.max(...strips.map((item) => item.shearKnPerM)), strengthKnPerM: strength, sizeFactor: size } };
  };

  // Penetración: perímetro a d/2 del paño; en columnas de borde o esquina, cortado por el borde si el volado no alcanza.
  const size = code.footing.punchingSizeFactor ? sizeFactor(average) : 1;
  const phi = code.twoWayShearFactor(false);
  const c1 = input.columnWidthMm;
  const c2 = input.columnDepthMm;
  const beta = Math.max(c1, c2) / Math.min(c1, c2);
  const punching: MatPunching[] = KINDS.filter((kind) => columns.some((column) => column.kind === kind)).map((kind) => {
    const sample = columns.find((column) => column.kind === kind)!;
    const edgeX = sample.xMm === plan.xs[0] || sample.xMm === plan.xs[plan.xs.length - 1];
    const edgeY = sample.yMm === plan.ys[0] || sample.yMm === plan.ys[plan.ys.length - 1];
    const cutX = edgeX && input.overhangMm - c1 / 2 < average / 2;
    const cutY = edgeY && input.overhangMm - c2 / 2 < average / 2;
    const widthX = cutX ? input.overhangMm + c1 / 2 + average / 2 : c1 + average;
    const widthY = cutY ? input.overhangMm + c2 / 2 + average / 2 : c2 + average;
    const sides = (4 - Number(cutX) - Number(cutY)) as 2 | 3 | 4;
    const perimeter = sides === 4 ? 2 * (widthX + widthY) : sides === 3 ? (cutX ? 2 * widthX + widthY : widthX + 2 * widthY) : widthX + widthY;
    const alphaS = ALPHA_BY_SIDES[sides];
    const demand = sample.ultimateKn - qu * widthX * widthY / 1e3;
    const vc = Math.min(0.33, 0.17 * (1 + 2 / beta), 0.083 * (2 + alphaS * average / perimeter)) * size * Math.sqrt(input.fcMpa);
    return { kind, sides, alphaS, perimeterMm: perimeter, demandKn: demand, demandStressMpa: demand * 1e3 / (perimeter * average), strengthStressMpa: phi * vc };
  });

  return { plan, combination, columns, qu, dX, dY, average, x: direction('x'), y: direction('y'), punching, punchingSize: size, punchingFactor: phi, ultimateLoad };
}

type State = ReturnType<typeof evaluate>;

const passes = (code: DesignCode, state: State) =>
  state.average >= code.footing.minimumEffectiveDepthMm
  && state.punching.every((item) => item.demandStressMpa <= item.strengthStressMpa)
  && [state.x, state.y].every((direction) => direction.oneWay.demandKnPerM <= direction.oneWay.strengthKnPerM
    && Number.isFinite(direction.bottom.requiredMm2PerM) && Number.isFinite(direction.top.requiredMm2PerM));

const KIND_LABEL: Record<MatColumnKind, string> = { interior: 'interior', edge: 'de borde', corner: 'de esquina' };

export function designMatFoundation(input: MatFoundationInput): MatFoundationResult | { ok: false; errors: readonly string[] } {
  const errors = validate(input);
  if (errors.length) return { ok: false, errors };
  const code = designCode(input.code);
  const refs = code.refs;
  let h = input.thicknessMm ?? 300;
  if (input.thicknessMm === null) {
    for (; h < 3_000; h += 50) if (passes(code, evaluate(code, input, h))) break;
  }
  const state = evaluate(code, input, h);
  const { plan } = state;
  const area = plan.lengthX * plan.lengthY / 1e6;
  const serviceLoad = plan.positions.reduce((sum, position) => sum + input.loads[position.kind].deadKn + input.loads[position.kind].liveKn, 0);
  const servicePressure = serviceLoad / area;
  const combinationText = `${state.combination.label} · qu = ${(state.qu * 1e3).toFixed(0)} kPa`;

  const checks: ElementCheck[] = [
    tracedAt(capacityCheck('bearing', 'Presión de servicio', servicePressure, input.allowablePressureKpa, 'kPa', complementary('Capacidad admisible del estudio geotécnico'),
      'Resultante al centro de la losa: reacción uniforme.'), 'Toda la losa', 'Servicio: cargas sin factorizar'),
    { id: 'soil-reaction', label: 'Reacción del suelo', status: 'info', reference: refs.soilReaction,
      note: 'Cargas simétricas por tipo de columna: la resultante coincide con el centro y la reacción se reparte uniforme en el área de desplante.' },
    capacityCheck('min-depth', 'Peralte efectivo mínimo', code.footing.minimumEffectiveDepthMm, state.average, 'mm', refs.footingDepth),
    ...state.punching.map((item) => tracedAt(capacityCheck(`punching-${item.kind}`, `Penetración en columna ${KIND_LABEL[item.kind]}`, item.demandStressMpa, item.strengthStressMpa, 'MPa', refs.punching,
      `${item.sides} lados · bo = ${item.perimeterMm.toFixed(0)} mm · αs = ${item.alphaS}${code.footing.punchingSizeFactor ? ` · λs = ${state.punchingSize.toFixed(2)}` : ''} · FR ${state.punchingFactor}. Sin transferencia de momento.`),
    `Perímetro a d/2 de la columna ${KIND_LABEL[item.kind]}`, combinationText)),
  ];
  for (const direction of [state.x, state.y]) {
    const axis = direction.axis.toUpperCase();
    checks.push(
      tracedAt(capacityCheck(`one-way-${direction.axis}`, `Cortante como viga (${axis})`, direction.oneWay.demandKnPerM, direction.oneWay.strengthKnPerM, 'kN/m', refs.oneWay,
        code.footing.oneWay === 'ntc' ? `0.66·λs·ρ^(1/3)·√f′c con λs = ${direction.oneWay.sizeFactor.toFixed(2)} y el ρ menor de las dos caras.` : `0.17·√f′c·b·d · FR ${code.shearFactor}.`),
      `A d del paño · franjas en ${axis}`, combinationText),
      tracedAt(capacityCheck(`flexure-bottom-${direction.axis}`, `Flexión bajo columnas (${axis}, lecho inferior)`, direction.bottom.momentKnmPerM, direction.bottom.strengthKnmPerM, 'kN·m/m', refs.footingFlexure,
        `FR ${direction.bottom.resistanceFactor.toFixed(2)}.`), `Franja más cargada en ${axis}`, combinationText),
      tracedAt(capacityCheck(`flexure-top-${direction.axis}`, `Flexión entre columnas (${axis}, lecho superior)`, direction.top.momentKnmPerM, direction.top.strengthKnmPerM, 'kN·m/m', refs.footingFlexure,
        `FR ${direction.top.resistanceFactor.toFixed(2)}.`), `Franja más cargada en ${axis}`, combinationText),
    );
  }
  const layers = [state.x.bottom, state.x.top, state.y.bottom, state.y.top];
  const leastMinimum = layers.reduce((worst, item) => item.providedMm2PerM / item.minimumMm2PerM < worst.providedMm2PerM / worst.minimumMm2PerM ? item : worst);
  checks.push(
    capacityCheck('steel-min', 'Acero mínimo por cara', leastMinimum.minimumMm2PerM, leastMinimum.providedMm2PerM, 'mm²/m', refs.footingMinSteel,
      `${(code.footing.minimumSteelRatio * 100).toFixed(2)} % de b·h en cada cara y dirección.`),
    capacityCheck('spacing', 'Separación del refuerzo', Math.max(...layers.map((item) => item.spacingMm)), code.footing.maximumSpacing(h), 'mm', refs.footingSpacing,
      `Máximo: ${code.footing.maximumSpacingNote}.`),
    { id: 'rigid-method', label: 'Método rígido por franjas', status: 'info', reference: complementary('Método rígido convencional'),
      note: `Cada franja se equilibra promediando reacción y cargas de columna (factor de la reacción ${Math.min(...[...state.x.strips, ...state.y.strips].map((item) => item.soilFactor)).toFixed(2)} a ${Math.max(...[...state.x.strips, ...state.y.strips].map((item) => item.soilFactor)).toFixed(2)}). Válido para losa rígida y claros parecidos.` },
    { id: 'load-factors', label: 'Combinaciones de carga', status: 'info', reference: refs.loadFactors, note: `${combinationText} · Pu = ${state.ultimateLoad.toFixed(0)} kN.` },
  );
  if (!passes(code, state) && input.thicknessMm === null) {
    checks.push({ id: 'section', label: 'Espesor insuficiente', status: 'fail', reference: refs.footingFlexure, note: 'Ni con 3 m de espesor cumple: revisa cargas y claros.' });
  }

  return {
    ok: true,
    input,
    lengthXMm: plan.lengthX,
    lengthYMm: plan.lengthY,
    thicknessMm: h,
    effectiveDepthMm: state.average,
    columns: state.columns,
    service: { loadKn: serviceLoad, pressureKpa: servicePressure },
    ultimate: { loadKn: state.ultimateLoad, pressureKpa: state.qu * 1e3 },
    punching: state.punching,
    directions: { x: state.x, y: state.y },
    checks,
    governingRatio: governingRatio(checks.filter((check) => check.id === 'bearing' || check.id.startsWith('punching') || check.id.startsWith('one-way') || check.id.startsWith('flexure'))),
    status: overallStatus(checks),
  };
}
