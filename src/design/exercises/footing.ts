import { designCode } from '../elements/codes';
import { sizeFactor } from '../elements/footing';
import { requiredFlexuralSteelMm2 } from '../elements/shared';
import { KGCM2, TON, barArea, barName, ceilTo, floorTo, invalid, read, solved } from './common';
import type { ExerciseProblem, ExerciseStep } from './types';

/*
 * Zapata aislada cuadrada bajo columna cuadrada, carga concéntrica. Cortante
 * por penetración con las expresiones del motor de zapatas del taller
 * (αs = 40, λs si la norma lo pide) y cortante en una dirección a d del paño.
 */

const ALPHA_S = 40;

export const isolatedFooting: ExerciseProblem = {
  id: 'footing-design',
  mode: 'design',
  find: { symbol: 'B, h', label: 'Lado, peralte y acero' },
  fields: [
    { id: 'p', symbol: 'P', label: 'Carga de servicio (CM + CV)', kind: 'force', positive: true },
    { id: 'pu', symbol: 'Pu', label: 'Carga última', kind: 'force', positive: true },
    { id: 'qa', symbol: 'qa', label: 'Capacidad admisible del suelo', kind: 'pressure', positive: true },
    { id: 'w', symbol: 'Wz', label: 'Peso de zapata y relleno', kind: 'percent', min: 0, hint: 'Porcentaje de P; suele tomarse entre 10 y 20 %.' },
    { id: 'c', symbol: 'c', label: 'Lado de la columna', kind: 'section', positive: true },
    { id: 'fc', symbol: 'f′c', label: 'Resistencia del concreto', kind: 'stress', positive: true },
    { id: 'fy', symbol: 'fy', label: 'Fluencia del acero', kind: 'stress', positive: true },
    { id: 'r', symbol: 'r', label: 'Recubrimiento al centroide del acero', kind: 'section', positive: true },
  ],
  examples: [
    { id: 'a', label: 'P = 100 t · qa = 20 t/m²', values: { p: 100 * TON, pu: 140 * TON, qa: 20 * TON, w: 10, c: 400, fc: 250 * KGCM2, fy: 4200 * KGCM2, r: 75 } },
    { id: 'b', label: 'P = 60 t · suelo blando', values: { p: 60 * TON, pu: 85 * TON, qa: 10 * TON, w: 15, c: 350, fc: 250 * KGCM2, fy: 4200 * KGCM2, r: 75 } },
  ],
  statement: (v, c) => `Diseña una zapata aislada cuadrada para una columna de ${c.q(v.c ?? NaN, 'section')} que transmite P = ${c.q(v.p ?? NaN, 'force')} en servicio y Pu = ${c.q(v.pu ?? NaN, 'force')} factorizada. El suelo admite qa = ${c.q(v.qa ?? NaN, 'pressure')}; considera ${v.w ?? '…'} % de P por peso propio y relleno. f′c = ${c.q(v.fc ?? NaN, 'stress')}; fy = ${c.q(v.fy ?? NaN, 'stress')}.`,
  solve(values, context) {
    const input = read(this.fields, values);
    if (!input.ok) return input.outcome;
    const v = input.v;
    const code = designCode(context.code);
    const fc = v.fc!;
    const c = v.c!;
    const pu = v.pu! * 1e3; // N
    const areaM2 = v.p! * (1 + (v.w ?? 0) / 100) / v.qa!;
    const side = Math.max(ceilTo(Math.sqrt(areaM2) * 1e3, 50), c + 200);
    if (side > 8000) return invalid('La zapata resultaría mayor de 8 m: revisa la carga o la capacidad del suelo.');
    const qu = pu / side ** 2; // MPa
    const twoWayPhi = code.twoWayShearFactor(false);
    const phi = code.shearFactor;
    const punching = (d: number) => {
      const b0 = 4 * (c + d);
      const vu = (pu - qu * (c + d) ** 2) / (b0 * d);
      const lambda = code.footing.punchingSizeFactor ? sizeFactor(d) : 1;
      const vc = Math.min(0.33, 0.17 * (1 + 2 / 1), 0.083 * (2 + ALPHA_S * d / b0)) * lambda * Math.sqrt(fc);
      return { b0, vu, vc, lambda, ok: vu <= twoWayPhi * vc };
    };
    const oneWay = (d: number) => {
      const lever = (side - c) / 2 - d;
      const vu = lever > 0 ? qu * side * lever : 0;
      const resistance = phi * 0.17 * Math.sqrt(fc) * side * d;
      return { vu, resistance, ok: vu <= resistance };
    };
    const minimumDepth = Math.max(code.footing.minimumEffectiveDepthMm, 150);
    let d = minimumDepth;
    while (d < 2000 && !(punching(d).ok && oneWay(d).ok)) d += 10;
    if (d >= 2000) return invalid('No se encontró un peralte razonable; revisa los datos.');
    const p = punching(d);
    const one = oneWay(d);
    const governs = d === minimumDepth ? 'el peralte mínimo de la norma' : punching(d - 10).ok ? 'el cortante en una dirección' : 'la penetración';
    const height = ceilTo(d + v.r!, 50);
    const depth = height - v.r!;
    const cantilever = (side - c) / 2;
    const momentKnm = qu * side * cantilever ** 2 / 2 / 1e6;
    const required = requiredFlexuralSteelMm2(momentKnm, side, depth, v.fy!, fc, depth, code.flexureFactor, code.tensionControlledStrain) ?? Number.NaN;
    const minimum = code.footing.minimumSteelRatio * side * height;
    const steel = Math.max(required, minimum);
    const maxSpacing = code.footing.maximumSpacing(height);
    const bars = [12.7, 15.9, 19.1, 22.2].map((diameter) => {
      const spacing = Math.min(floorTo(side * barArea(diameter) / steel, 25), floorTo(maxSpacing, 25));
      return { diameter, spacing, count: Math.ceil(side / spacing) };
    }).filter((option) => option.spacing >= 100);
    const bar = bars.find((option) => option.spacing <= 300) ?? bars[0];
    const steps: ExerciseStep[] = [
      {
        title: 'Área de contacto',
        lines: [
          { formula: 'A = P (1 + Wz) / qa', substitution: `${context.q(v.p!, 'force')} × ${context.n(1 + (v.w ?? 0) / 100, 2)} / ${context.q(v.qa!, 'pressure')}`, note: `A = ${context.n(areaM2, 2)} m²` },
          { formula: 'B = √A, redondeado a 5 cm', result: { symbol: 'B', value: side, kind: 'section' } },
          { formula: 'qnu = Pu / B²', note: 'Presión neta última (el peso propio no produce cortante ni flexión).', result: { symbol: 'qnu', value: qu * 1e3, kind: 'pressure' } },
        ],
      },
      {
        title: 'Peralte por penetración',
        lines: [
          { formula: 'b0 = 4 (c + d)', result: { symbol: 'b0', value: p.b0, kind: 'section' } },
          { formula: 'vu = [Pu − qnu (c + d)²] / (b0 d)', result: { symbol: 'vu', value: p.vu, kind: 'stress' } },
          { formula: `vc = mín(0.33; 0.17(1 + 2/β); 0.083(2 + αs d/b0))${p.lambda < 1 ? ' · λs' : ''} √f′c`, note: context.units === 'kgf' ? 'f′c en MPa en la fórmula; el resultado se muestra en kg/cm². β = 1, αs = 40.' : 'β = 1 (columna cuadrada), αs = 40 (columna interior).', result: { symbol: 'vc', value: p.vc, kind: 'stress' } },
          { formula: `FR vc, FR = ${context.n(twoWayPhi, 2)}`, result: { symbol: 'FR vc', value: twoWayPhi * p.vc, kind: 'stress' } },
          { formula: 'Menor d que cumple penetración y cortante en una dirección (pasos de 1 cm)', note: `Rige ${governs}.`, result: { symbol: 'd', value: d, kind: 'section' } },
        ],
      },
      {
        title: 'Cortante en una dirección',
        lines: [
          { formula: 'Vu = qnu B [(B − c)/2 − d]', result: { symbol: 'Vu', value: one.vu / 1e3, kind: 'force' } },
          { formula: 'FR Vc = FR · 0.17 √f′c B d', result: { symbol: 'FR Vc', value: one.resistance / 1e3, kind: 'force' } },
        ],
      },
      {
        title: 'Peralte total',
        lines: [
          { formula: 'h = d + r, redondeado a 5 cm', result: { symbol: 'h', value: height, kind: 'section' } },
          { formula: 'd = h − r', result: { symbol: 'd', value: depth, kind: 'section' } },
        ],
      },
      {
        title: 'Flexión en el paño de la columna',
        lines: [
          { formula: 'Mu = qnu B (B − c)² / 8', result: { symbol: 'Mu', value: momentKnm, kind: 'moment' } },
          { formula: 'As requerida (ancho B)', result: { symbol: 'As', value: required, kind: 'area' } },
          { formula: `As,mín = ${context.n(code.footing.minimumSteelRatio, 4)} B h`, result: { symbol: 'As,mín', value: minimum, kind: 'area' } },
          ...(bar ? [{ formula: 's = B · Ab / As', note: `${bar.count} ${barName(bar.diameter)} en cada dirección.`, result: { symbol: 's', value: bar.spacing, kind: 'spacing' as const } }] : []),
        ],
      },
    ];
    return solved({
      steps,
      answers: [
        { symbol: 'B', label: 'Lado de la zapata', value: side, kind: 'section', text: `${context.q(side, 'section')} × ${context.q(side, 'section')}` },
        { symbol: 'h', label: 'Peralte total', value: height, kind: 'section' },
        { symbol: 'As', label: 'Acero en cada dirección', value: steel, kind: 'area' },
        ...(bar ? [{ symbol: 'Armado', label: 'Parrilla', value: bar.spacing, kind: 'spacing' as const, text: `${barName(bar.diameter)} @ ${context.q(bar.spacing, 'spacing')} en ambas direcciones` }] : []),
      ],
      checks: [
        { label: 'Presión de contacto', status: 'pass', detail: `P(1 + Wz)/B² = ${context.q(v.p! * (1 + (v.w ?? 0) / 100) / (side / 1e3) ** 2, 'pressure')} ≤ qa` },
        { label: 'Penetración', status: punching(depth).ok ? 'pass' : 'fail', detail: `vu = ${context.q(punching(depth).vu, 'stress')} · FR vc = ${context.q(twoWayPhi * punching(depth).vc, 'stress')}`, reference: code.refs.punching.label },
        { label: 'Cortante en una dirección', status: oneWay(depth).ok ? 'pass' : 'fail', detail: `Vu = ${context.q(oneWay(depth).vu / 1e3, 'force')} · FR Vc = ${context.q(oneWay(depth).resistance / 1e3, 'force')}`, reference: code.refs.oneWay.label },
        { label: 'Separación máxima del acero', status: bar && bar.spacing <= maxSpacing ? 'pass' : 'info', detail: `s máx = ${context.q(maxSpacing, 'spacing')}`, reference: code.refs.footingSpacing.label },
      ],
      notes: ['Carga concéntrica, sin momento; la transmisión de esfuerzos y el anclaje se revisan en la pieza completa (Zapata).'],
      figure: { type: 'footing', sideMm: side, columnMm: c, depthMm: depth, heightMm: height },
    });
  },
};
