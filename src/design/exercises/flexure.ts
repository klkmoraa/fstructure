import { betaOne, equivalentBlockStrengthMpa } from '../concrete/ntcConcrete2023';
import { designCode } from '../elements/codes';
import { requiredFlexuralSteelMm2 } from '../elements/shared';
import { ECU, ES, KGCM2, TON, barArea, barField, barName, barOptions, ceilTo, fitsInWidth, invalid, read, solved } from './common';
import type { ExerciseCheck, ExerciseContext, ExerciseField, ExerciseProblem, ExerciseStep } from './types';
import { DIMENSION_STEP_MM } from './units';

/*
 * Flexión simple, como en el capítulo de flexión de un libro de concreto:
 * bloque equivalente con f″c = 0.85 f′c y β1, deformación última 0.003 y el
 * factor de resistencia de la norma elegida según εt. Las fórmulas son las del
 * motor del taller (`shared.ts`, `codes.ts`): un ejercicio y una pieza del
 * proyecto dan el mismo resultado.
 */

const fc: ExerciseField = { id: 'fc', symbol: 'f′c', label: 'Resistencia del concreto', kind: 'stress', positive: true };
const fy: ExerciseField = { id: 'fy', symbol: 'fy', label: 'Fluencia del acero', kind: 'stress', positive: true };
const b: ExerciseField = { id: 'b', symbol: 'b', label: 'Ancho', kind: 'section', positive: true };
const h: ExerciseField = { id: 'h', symbol: 'h', label: 'Peralte total', kind: 'section', positive: true };
const d: ExerciseField = { id: 'd', symbol: 'd', label: 'Peralte efectivo', kind: 'section', positive: true };
const n: ExerciseField = { id: 'n', symbol: 'n', label: 'Número de barras a tensión', kind: 'count', positive: true, integer: true };
const db = barField('db', 'db', 'Barra a tensión');
const mu: ExerciseField = { id: 'mu', symbol: 'Mu', label: 'Momento último', kind: 'moment', positive: true };

const ex = { b: 300, h: 600, d: 550, fc: 250 * KGCM2, fy: 4200 * KGCM2 };

/** Materiales y factores comunes de un ejercicio de flexión. */
function materials(context: ExerciseContext, fcMpa: number, fyMpa: number): { step: ExerciseStep; fpp: number; beta: number; ey: number } {
  const fpp = equivalentBlockStrengthMpa(fcMpa);
  const beta = betaOne(fcMpa);
  const ey = fyMpa / ES;
  return {
    fpp, beta, ey,
    step: {
      title: 'Materiales',
      lines: [
        { formula: 'f″c = 0.85 f′c', substitution: `0.85 × ${context.q(fcMpa, 'stress')}`, result: { symbol: 'f″c', value: fpp, kind: 'stress' } },
        { formula: 'β1', note: fcMpa <= 28 ? 'f′c ≤ 28 MPa (280 kg/cm²): β1 = 0.85.' : 'β1 = 1.05 − f′c/140 ≥ 0.65 (f′c en MPa).', result: { symbol: 'β1', value: beta, kind: 'factor' } },
        { formula: 'εy = fy / Es', substitution: `${context.q(fyMpa, 'stress')} / ${context.q(ES, 'stress')}`, result: { symbol: 'εy', value: ey, kind: 'strain' } },
      ],
    },
  };
}

/** Acero mínimo y máximo de la norma para una sección rectangular. */
function steelLimits(context: ExerciseContext, widthMm: number, depthMm: number, heightMm: number, fcMpa: number, fyMpa: number, areaMm2: number): ExerciseCheck[] {
  const code = designCode(context.code);
  const minimum = code.beam.minimumSteel(widthMm, depthMm, heightMm, fcMpa, fyMpa, depthMm);
  const maximum = code.beam.maximumSteel(widthMm, depthMm, depthMm, fcMpa, fyMpa);
  return [
    { label: 'Acero mínimo', status: areaMm2 >= minimum * (1 - 1e-9) ? 'pass' : 'fail', detail: `As = ${context.q(areaMm2, 'area')} · As,mín = ${context.q(minimum, 'area')}`, reference: code.refs.steelMin.label },
    { label: 'Acero máximo', status: areaMm2 <= maximum * (1 + 1e-9) ? 'pass' : 'fail', detail: `As = ${context.q(areaMm2, 'area')} · As,máx = ${context.q(maximum, 'area')}. ${code.beam.maximumSteelNote}`, reference: code.refs.steelMax.label },
  ];
}

/** Profundidad del eje neutro de una sección simplemente armada, con o sin fluencia. */
function singlyReinforced(areaMm2: number, widthMm: number, depthMm: number, fyMpa: number, fpp: number, beta: number) {
  const yieldBlock = areaMm2 * fyMpa / (fpp * widthMm);
  const yieldC = yieldBlock / beta;
  const strainAtYield = ECU * (depthMm - yieldC) / yieldC;
  if (strainAtYield >= fyMpa / ES) return { yields: true, c: yieldC, a: yieldBlock, fs: fyMpa, et: strainAtYield };
  // Compatibilidad: f″c b β1 c² + As Es εcu c − As Es εcu d = 0.
  const A = fpp * widthMm * beta;
  const B = areaMm2 * ES * ECU;
  const C = areaMm2 * ES * ECU * depthMm;
  const c = (-B + Math.sqrt(B * B + 4 * A * C)) / (2 * A);
  const et = ECU * (depthMm - c) / c;
  return { yields: false, c, a: beta * c, fs: ES * et, et };
}

export const rectangularCheck: ExerciseProblem = {
  id: 'rect-check',
  mode: 'check',
  find: { symbol: 'MR', label: 'Momento resistente' },
  fields: [b, h, d, n, db, fc, fy],
  examples: [
    { id: 'a', label: 'Viga 30 × 60 · 3 #8', values: { ...ex, n: 3, db: 25.4 } },
    { id: 'b', label: 'Viga 25 × 50 · 4 #6', values: { b: 250, h: 500, d: 450, n: 4, db: 19.1, fc: 200 * KGCM2, fy: 4200 * KGCM2 } },
  ],
  statement: (v, c) => `Determina el momento resistente de diseño de una viga rectangular de ${c.q(v.b ?? NaN, 'section')} × ${c.q(v.h ?? NaN, 'section')}, con peralte efectivo d = ${c.q(v.d ?? NaN, 'section')}, armada a tensión con ${v.n ?? '…'} barras ${v.db ? barName(v.db) : '…'}. Concreto f′c = ${c.q(v.fc ?? NaN, 'stress')}; acero fy = ${c.q(v.fy ?? NaN, 'stress')}.`,
  solve(values, context) {
    const input = read(this.fields, values);
    if (!input.ok) return input.outcome;
    const { b: width, h: height, d: depth, n: count, db: diameter, fc: fcMpa, fy: fyMpa } = input.v as Record<string, number>;
    if (depth >= height) return invalid('d debe ser menor que h.');
    const code = designCode(context.code);
    const mat = materials(context, fcMpa, fyMpa);
    const As = count * barArea(diameter);
    const section = singlyReinforced(As, width, depth, fyMpa, mat.fpp, mat.beta);
    const nominal = As * section.fs * (depth - section.a / 2) / 1e6;
    const factor = code.flexureFactor(section.et, mat.ey);
    const resistance = factor * nominal;
    const steps: ExerciseStep[] = [
      mat.step,
      {
        title: 'Acero de tensión',
        lines: [
          { formula: 'As = n · π db² / 4', substitution: `${count} × π × (${context.n(diameter, 1)} mm)² / 4`, result: { symbol: 'As', value: As, kind: 'area' } },
          { formula: 'ρ = As / (b d)', substitution: `${context.q(As, 'area')} / (${context.q(width, 'section')} × ${context.q(depth, 'section')})`, result: { symbol: 'ρ', value: As / (width * depth), kind: 'ratio' } },
        ],
      },
      {
        title: 'Equilibrio: C = T',
        lines: section.yields ? [
          { formula: 'Suponiendo que el acero fluye: a = As fy / (f″c b)', substitution: `${context.q(As, 'area')} × ${context.q(fyMpa, 'stress')} / (${context.q(mat.fpp, 'stress')} × ${context.q(width, 'section')})`, result: { symbol: 'a', value: section.a, kind: 'section' } },
          { formula: 'c = a / β1', substitution: `${context.q(section.a, 'section')} / ${context.n(mat.beta, 3)}`, result: { symbol: 'c', value: section.c, kind: 'section' } },
          { formula: 'εs = 0.003 (d − c) / c', substitution: `0.003 × (${context.q(depth, 'section')} − ${context.q(section.c, 'section')}) / ${context.q(section.c, 'section')}`, result: { symbol: 'εs', value: section.et, kind: 'strain' } },
          { note: `εs = ${context.n(section.et, 5)} ≥ εy = ${context.n(mat.ey, 5)}: el acero fluye y fs = fy.` },
        ] : [
          { note: `Con fs = fy resultaría εs < εy: el acero no fluye. Se resuelve por compatibilidad: f″c b β1 c² + As Es 0.003 c − As Es 0.003 d = 0.` },
          { formula: 'c (raíz positiva)', result: { symbol: 'c', value: section.c, kind: 'section' } },
          { formula: 'fs = Es · 0.003 (d − c) / c', result: { symbol: 'fs', value: section.fs, kind: 'stress' } },
          { formula: 'a = β1 c', result: { symbol: 'a', value: section.a, kind: 'section' } },
        ],
      },
      {
        title: 'Momento resistente',
        lines: [
          { formula: 'Mn = As fs (d − a/2)', substitution: `${context.q(As, 'area')} × ${context.q(section.fs, 'stress')} × (${context.q(depth, 'section')} − ${context.q(section.a / 2, 'section')})`, result: { symbol: 'Mn', value: nominal, kind: 'moment' } },
          { formula: `FR (${code.name}) con εt = ${context.n(section.et, 5)}`, note: section.et >= mat.ey + 0.003 ? 'Sección controlada por tensión.' : section.et <= mat.ey ? 'Sección controlada por compresión.' : 'Sección en transición.', result: { symbol: 'FR', value: factor, kind: 'factor' } },
          { formula: 'MR = FR · Mn', substitution: `${context.n(factor, 3)} × ${context.q(nominal, 'moment')}`, result: { symbol: 'MR', value: resistance, kind: 'moment' } },
        ],
      },
    ];
    return solved({
      steps,
      answers: [
        { symbol: 'MR', label: 'Momento resistente de diseño', value: resistance, kind: 'moment' },
        { symbol: 'Mn', label: 'Momento nominal', value: nominal, kind: 'moment' },
        { symbol: 'c', label: 'Profundidad del eje neutro', value: section.c, kind: 'section' },
      ],
      checks: [
        { label: 'Fluencia del acero', status: section.yields ? 'pass' : 'fail', detail: section.yields ? 'El acero fluye antes de que el concreto alcance 0.003.' : 'El acero no fluye: falla frágil por compresión.' },
        ...steelLimits(context, width, depth, height, fcMpa, fyMpa, As),
      ],
      figure: { type: 'section', widthMm: width, heightMm: height, layers: [{ fromTopMm: depth, count, diameterMm: diameter }], blockDepthMm: section.a, neutralAxisMm: section.c },
    });
  },
};

export const rectangularDesign: ExerciseProblem = {
  id: 'rect-design',
  mode: 'design',
  find: { symbol: 'As', label: 'Acero de tensión' },
  fields: [mu, b, h, d, fc, fy],
  examples: [
    { id: 'a', label: 'Mu = 25 t·m · 30 × 60', values: { mu: 25 * TON, ...ex } },
    { id: 'b', label: 'Mu = 12 t·m · 25 × 45', values: { mu: 12 * TON, b: 250, h: 450, d: 400, fc: 250 * KGCM2, fy: 4200 * KGCM2 } },
  ],
  statement: (v, c) => `Calcula el área de acero de tensión que necesita una viga rectangular de ${c.q(v.b ?? NaN, 'section')} × ${c.q(v.h ?? NaN, 'section')} (d = ${c.q(v.d ?? NaN, 'section')}) para resistir un momento último Mu = ${c.q(v.mu ?? NaN, 'moment')}. Concreto f′c = ${c.q(v.fc ?? NaN, 'stress')}; acero fy = ${c.q(v.fy ?? NaN, 'stress')}. Propón el armado.`,
  solve(values, context) {
    const input = read(this.fields, values);
    if (!input.ok) return input.outcome;
    const { mu: moment, b: width, h: height, d: depth, fc: fcMpa, fy: fyMpa } = input.v as Record<string, number>;
    if (depth >= height) return invalid('d debe ser menor que h.');
    const code = designCode(context.code);
    const mat = materials(context, fcMpa, fyMpa);
    const factor = code.flexureFactor(Number.POSITIVE_INFINITY, mat.ey);
    const k = moment * 1e6 / (factor * mat.fpp * width * depth ** 2);
    const steps: ExerciseStep[] = [mat.step];
    const quadratic: ExerciseStep = {
      title: 'Índice de refuerzo',
      lines: [
        { formula: 'Mu = FR f″c b d² q (1 − 0.5 q)', note: `Se supone sección controlada por tensión, FR = ${context.n(factor, 2)}.` },
        { formula: 'q = 1 − √(1 − 2 Mu / (FR f″c b d²))', substitution: `1 − √(1 − 2 × ${context.n(k, 4)})`, ...(k <= 0.5 ? { result: { symbol: 'q', value: 1 - Math.sqrt(1 - 2 * k), kind: 'ratio' as const } } : {}) },
      ],
    };
    steps.push(quadratic);
    const maximum = code.beam.maximumSteel(width, depth, depth, fcMpa, fyMpa);
    const minimum = code.beam.minimumSteel(width, depth, height, fcMpa, fyMpa, depth);
    if (k > 0.5) {
      return solved({
        steps,
        answers: [],
        checks: [{ label: 'Sección suficiente', status: 'fail', detail: '2 Mu / (FR f″c b d²) > 1: ninguna cantidad de acero simple alcanza. Aumenta b o d, o usa acero de compresión.' }],
        figure: { type: 'section', widthMm: width, heightMm: height, layers: [] },
      });
    }
    const q = 1 - Math.sqrt(1 - 2 * k);
    const rho = q * mat.fpp / fyMpa;
    let required = rho * width * depth;
    const exact = requiredFlexuralSteelMm2(moment, width, depth, fyMpa, fcMpa, depth, code.flexureFactor, code.tensionControlledStrain);
    const transition = exact !== undefined && exact > required * (1 + 1e-6);
    steps.push({
      title: 'Acero requerido',
      lines: [
        { formula: 'ρ = q f″c / fy', substitution: `${context.n(q, 4)} × ${context.q(mat.fpp, 'stress')} / ${context.q(fyMpa, 'stress')}`, result: { symbol: 'ρ', value: rho, kind: 'ratio' } },
        { formula: 'As = ρ b d', substitution: `${context.n(rho, 5)} × ${context.q(width, 'section')} × ${context.q(depth, 'section')}`, result: { symbol: 'As', value: required, kind: 'area' } },
        ...(transition && exact !== undefined ? [{ note: `Con esa cuantía εt cae en la zona de transición y FR baja; resolviendo con FR variable se requiere más acero.`, result: { symbol: 'As', value: exact, kind: 'area' as const } }] : []),
      ],
    });
    if (exact !== undefined) required = Math.max(required, exact);
    const design = Math.max(required, minimum);
    steps.push({
      title: 'Límites de la norma',
      lines: [
        { formula: 'As,mín', result: { symbol: 'As,mín', value: minimum, kind: 'area' }, note: code.refs.steelMin.label },
        { formula: 'As,máx', result: { symbol: 'As,máx', value: maximum, kind: 'area' }, note: code.beam.maximumSteelNote },
        { formula: 'As,diseño = máx(As, As,mín)', result: { symbol: 'As', value: design, kind: 'area' } },
      ],
    });
    const fits = fitsInWidth(width, (diameterMm) => code.beam.minimumClearSpacing(diameterMm, 19));
    const options = barOptions(design, fits);
    const best = options[0];
    return solved({
      steps,
      answers: [
        { symbol: 'As', label: 'Acero de tensión de diseño', value: design, kind: 'area' },
        ...(best ? [{ symbol: 'Armado', label: 'Propuesta con menor exceso', value: best.areaMm2, kind: 'area' as const, text: `${best.count} ${barName(best.diameterMm)}` }] : []),
      ],
      checks: [
        { label: 'Acero máximo', status: design <= maximum * (1 + 1e-9) && exact !== undefined ? 'pass' : 'fail', detail: exact === undefined || design > maximum ? 'La cuantía requerida rebasa el máximo: aumenta la sección o usa acero de compresión.' : `As = ${context.q(design, 'area')} ≤ As,máx = ${context.q(maximum, 'area')}`, reference: code.refs.steelMax.label },
        { label: 'Acero mínimo', status: 'info', detail: required < minimum ? 'Rige el acero mínimo.' : 'El acero requerido supera el mínimo.', reference: code.refs.steelMin.label },
      ],
      notes: [
        `Alternativas: ${options.map((option) => `${option.count} ${barName(option.diameterMm)} = ${context.q(option.areaMm2, 'area')}${option.fits ? '' : ' (dos lechos)'}`).join(' · ')}.`,
        best && !best.fits ? 'Ninguna opción cabe en un lecho: usa dos lechos (d baja) o una sección más ancha.' : 'Acomodo en un lecho con recubrimiento libre de 4 cm, estribo #3 y agregado de 19 mm; el detalle completo se revisa en la pieza.',
      ],
      figure: best ? { type: 'section', widthMm: width, heightMm: height, layers: [{ fromTopMm: depth, count: best.count, diameterMm: best.diameterMm }] } : { type: 'section', widthMm: width, heightMm: height, layers: [] },
    });
  },
};

export const rectangularSizing: ExerciseProblem = {
  id: 'rect-size',
  mode: 'design',
  find: { symbol: 'b, h', label: 'Dimensiones de la sección' },
  fields: [
    mu, fc, fy,
    { id: 'k', symbol: 'ρ/ρb', label: 'Cuantía propuesta (fracción de la balanceada)', kind: 'ratio', positive: true, hint: 'Entre 0.3 y 0.5 da secciones dúctiles y económicas.' },
    { id: 'lambda', symbol: 'b/d', label: 'Relación ancho / peralte efectivo', kind: 'ratio', positive: true, hint: 'Usual entre 0.4 y 0.6.' },
    { id: 'r', symbol: 'r', label: 'Recubrimiento al centroide del acero', kind: 'section', positive: true },
  ],
  examples: [
    { id: 'a', label: 'Mu = 25 t·m · ρ = 0.4 ρb', values: { mu: 25 * TON, fc: 250 * KGCM2, fy: 4200 * KGCM2, k: 0.4, lambda: 0.5, r: 50 } },
  ],
  statement: (v, c) => `Dimensiona una viga rectangular para Mu = ${c.q(v.mu ?? NaN, 'moment')}, con f′c = ${c.q(v.fc ?? NaN, 'stress')} y fy = ${c.q(v.fy ?? NaN, 'stress')}. Usa una cuantía ρ = ${v.k ?? '…'} ρb, una relación b/d = ${v.lambda ?? '…'} y r = ${c.q(v.r ?? NaN, 'section')}.`,
  solve(values, context) {
    const input = read(this.fields, values);
    if (!input.ok) return input.outcome;
    const { mu: moment, fc: fcMpa, fy: fyMpa, k: fraction, lambda, r: cover } = input.v as Record<string, number>;
    if (fraction > 1) return invalid('ρ/ρb debe ser menor que 1.');
    const code = designCode(context.code);
    const mat = materials(context, fcMpa, fyMpa);
    const factor = code.flexureFactor(Number.POSITIVE_INFINITY, mat.ey);
    const balanced = mat.fpp / fyMpa * (600 * mat.beta / (fyMpa + 600));
    const rho = fraction * balanced;
    const q = rho * fyMpa / mat.fpp;
    const bd2 = moment * 1e6 / (factor * mat.fpp * q * (1 - 0.5 * q));
    const dTheory = Math.cbrt(bd2 / lambda);
    const height = Math.max(ceilTo(dTheory + cover, DIMENSION_STEP_MM), 250);
    const depth = height - cover;
    const width = Math.max(ceilTo(lambda * depth, DIMENSION_STEP_MM), 150);
    const area = requiredFlexuralSteelMm2(moment, width, depth, fyMpa, fcMpa, depth, code.flexureFactor, code.tensionControlledStrain) ?? Number.NaN;
    const minimum = code.beam.minimumSteel(width, depth, height, fcMpa, fyMpa, depth);
    const design = Math.max(area, minimum);
    const best = barOptions(design, fitsInWidth(width, (diameterMm) => code.beam.minimumClearSpacing(diameterMm, 19)))[0];
    return solved({
      steps: [
        mat.step,
        {
          title: 'Cuantía propuesta',
          lines: [
            { formula: 'ρb = (f″c / fy) · 600 β1 / (fy + 600)', note: 'fy en MPa; 600 = Es · 0.003.', result: { symbol: 'ρb', value: balanced, kind: 'ratio' } },
            { formula: 'ρ = (ρ/ρb) · ρb', substitution: `${context.n(fraction, 2)} × ${context.n(balanced, 5)}`, result: { symbol: 'ρ', value: rho, kind: 'ratio' } },
            { formula: 'q = ρ fy / f″c', result: { symbol: 'q', value: q, kind: 'ratio' } },
          ],
        },
        {
          title: 'Dimensiones',
          lines: [
            { formula: 'b d² = Mu / (FR f″c q (1 − 0.5 q))', substitution: `${context.q(moment, 'moment')} / (${context.n(factor, 2)} × ${context.q(mat.fpp, 'stress')} × ${context.n(q, 4)} × ${context.n(1 - 0.5 * q, 4)})` },
            { formula: `d = ∛(b d² / (b/d)) con b/d = ${context.n(lambda, 2)}`, result: { symbol: 'd teórico', value: dTheory, kind: 'section' } },
            { formula: 'h = d + r, redondeado hacia arriba', result: { symbol: 'h', value: height, kind: 'section' } },
            { formula: 'd = h − r', result: { symbol: 'd', value: depth, kind: 'section' } },
            { formula: 'b = (b/d) · d, redondeado hacia arriba', result: { symbol: 'b', value: width, kind: 'section' } },
          ],
        },
        {
          title: 'Acero para la sección elegida',
          lines: [
            { formula: 'As requerida con b y d redondeados', result: { symbol: 'As', value: area, kind: 'area' } },
            { formula: 'As,mín', result: { symbol: 'As,mín', value: minimum, kind: 'area' } },
          ],
        },
      ],
      answers: [
        { symbol: 'b', label: 'Ancho', value: width, kind: 'section' },
        { symbol: 'h', label: 'Peralte total', value: height, kind: 'section' },
        { symbol: 'As', label: 'Acero de tensión', value: design, kind: 'area' },
        ...(best ? [{ symbol: 'Armado', label: 'Propuesta', value: best.areaMm2, kind: 'area' as const, text: `${best.count} ${barName(best.diameterMm)}` }] : []),
      ],
      checks: steelLimits(context, width, depth, height, fcMpa, fyMpa, design),
      notes: ['Las dimensiones se redondean a múltiplos de 5 cm; el acero se recalcula con la sección redondeada.'],
      figure: { type: 'section', widthMm: width, heightMm: height, layers: best ? [{ fromTopMm: depth, count: best.count, diameterMm: best.diameterMm }] : [] },
    });
  },
};

export const doublyReinforcedCheck: ExerciseProblem = {
  id: 'double-check',
  mode: 'check',
  find: { symbol: 'MR', label: 'Momento resistente' },
  fields: [b, h, d,
    { id: 'dp', symbol: 'd′', label: 'Recubrimiento al acero de compresión', kind: 'section', positive: true },
    n, db,
    { id: 'np', symbol: 'n′', label: 'Número de barras a compresión', kind: 'count', positive: true, integer: true },
    barField('dbp', 'db′', 'Barra a compresión'),
    fc, fy],
  examples: [
    { id: 'a', label: 'Viga 30 × 60 · 6 #8 y 2 #6', values: { ...ex, d: 530, dp: 50, n: 6, db: 25.4, np: 2, dbp: 19.1 } },
  ],
  statement: (v, c) => `Determina el momento resistente de una viga doblemente armada de ${c.q(v.b ?? NaN, 'section')} × ${c.q(v.h ?? NaN, 'section')} (d = ${c.q(v.d ?? NaN, 'section')}, d′ = ${c.q(v.dp ?? NaN, 'section')}), con ${v.n ?? '…'} barras ${v.db ? barName(v.db) : '…'} a tensión y ${v.np ?? '…'} barras ${v.dbp ? barName(v.dbp) : '…'} a compresión. f′c = ${c.q(v.fc ?? NaN, 'stress')}; fy = ${c.q(v.fy ?? NaN, 'stress')}.`,
  solve(values, context) {
    const input = read(this.fields, values);
    if (!input.ok) return input.outcome;
    const { b: width, h: height, d: depth, dp: top, n: count, db: diameter, np: countTop, dbp: diameterTop, fc: fcMpa, fy: fyMpa } = input.v as Record<string, number>;
    if (depth >= height || top >= depth) return invalid('Debe cumplirse d′ < d < h.');
    const code = designCode(context.code);
    const mat = materials(context, fcMpa, fyMpa);
    const As = count * barArea(diameter);
    const Asp = countTop * barArea(diameterTop);
    // Suposición del libro: ambos aceros fluyen; se desprecia el concreto desplazado por A′s.
    const aYield = (As - Asp) * fyMpa / (mat.fpp * width);
    const cYield = aYield / mat.beta;
    const esp = cYield > 0 ? ECU * (cYield - top) / cYield : -Infinity;
    const compressionYields = aYield > 0 && esp >= mat.ey;
    // Equilibrio general por bisección: f″c b β1 c + A′s f′s = As fs.
    const forces = (c: number) => {
      const fs = Math.max(-fyMpa, Math.min(fyMpa, ES * ECU * (depth - c) / c));
      const fsp = Math.max(-fyMpa, Math.min(fyMpa, ES * ECU * (c - top) / c));
      return { fs, fsp, net: mat.fpp * width * mat.beta * c + Asp * fsp - As * fs };
    };
    let low = 1e-6, high = height;
    for (let index = 0; index < 100; index += 1) {
      const middle = (low + high) / 2;
      if (forces(middle).net > 0) high = middle; else low = middle;
    }
    const c = (low + high) / 2;
    const { fs, fsp } = forces(c);
    const a = mat.beta * c;
    const Cc = mat.fpp * width * a;
    const Cs = Asp * fsp;
    const nominal = (Cc * (depth - a / 2) + Cs * (depth - top)) / 1e6;
    const et = ECU * (depth - c) / c;
    const factor = code.flexureFactor(et, mat.ey);
    const resistance = factor * nominal;
    const effective = As - Asp * fsp / fyMpa;
    const maximum = code.beam.maximumSteel(width, depth, depth, fcMpa, fyMpa);
    const minimum = code.beam.minimumSteel(width, depth, height, fcMpa, fyMpa, depth);
    return solved({
      steps: [
        mat.step,
        {
          title: 'Áreas de acero',
          lines: [
            { formula: 'As = n · π db² / 4', result: { symbol: 'As', value: As, kind: 'area' } },
            { formula: 'A′s = n′ · π db′² / 4', result: { symbol: 'A′s', value: Asp, kind: 'area' } },
          ],
        },
        {
          title: 'Suposición: ambos aceros fluyen',
          lines: [
            { formula: 'a = (As − A′s) fy / (f″c b)', substitution: `(${context.q(As, 'area')} − ${context.q(Asp, 'area')}) × ${context.q(fyMpa, 'stress')} / (${context.q(mat.fpp, 'stress')} × ${context.q(width, 'section')})`, result: { symbol: 'a', value: aYield, kind: 'section' } },
            { formula: 'c = a / β1', result: { symbol: 'c', value: cYield, kind: 'section' } },
            { formula: 'ε′s = 0.003 (c − d′) / c', result: { symbol: 'ε′s', value: esp, kind: 'strain' } },
            { note: compressionYields ? `ε′s ≥ εy = ${context.n(mat.ey, 5)}: la suposición es correcta.` : `ε′s < εy = ${context.n(mat.ey, 5)}: el acero de compresión no fluye; se busca c por equilibrio con f′s = Es ε′s.` },
          ],
        },
        ...(compressionYields ? [] : [{
          title: 'Equilibrio por compatibilidad',
          lines: [
            { formula: 'f″c b β1 c + A′s f′s = As fs', result: { symbol: 'c', value: c, kind: 'section' as const } },
            { formula: 'f′s = Es · 0.003 (c − d′) / c', result: { symbol: 'f′s', value: fsp, kind: 'stress' as const } },
            { formula: 'fs = Es · 0.003 (d − c) / c ≤ fy', result: { symbol: 'fs', value: fs, kind: 'stress' as const } },
            { formula: 'a = β1 c', result: { symbol: 'a', value: a, kind: 'section' as const } },
          ],
        }]),
        {
          title: 'Momento resistente',
          lines: [
            { formula: 'Cc = f″c a b', result: { symbol: 'Cc', value: Cc / 1e3, kind: 'force' } },
            { formula: 'Cs = A′s f′s', result: { symbol: 'Cs', value: Cs / 1e3, kind: 'force' } },
            { formula: 'Mn = Cc (d − a/2) + Cs (d − d′)', result: { symbol: 'Mn', value: nominal, kind: 'moment' } },
            { formula: `FR con εt = ${context.n(et, 5)}`, result: { symbol: 'FR', value: factor, kind: 'factor' } },
            { formula: 'MR = FR · Mn', result: { symbol: 'MR', value: resistance, kind: 'moment' } },
          ],
        },
      ],
      answers: [
        { symbol: 'MR', label: 'Momento resistente de diseño', value: resistance, kind: 'moment' },
        { symbol: 'f′s', label: 'Esfuerzo en el acero de compresión', value: fsp, kind: 'stress' },
      ],
      checks: [
        { label: 'Fluencia del acero de tensión', status: fs >= fyMpa * (1 - 1e-6) ? 'pass' : 'fail', detail: `fs = ${context.q(fs, 'stress')}` },
        { label: 'Acero mínimo', status: As >= minimum ? 'pass' : 'fail', detail: `As = ${context.q(As, 'area')} · As,mín = ${context.q(minimum, 'area')}`, reference: code.refs.steelMin.label },
        { label: 'Acero máximo (As − A′s f′s/fy)', status: effective <= maximum * (1 + 1e-9) ? 'pass' : 'fail', detail: `${context.q(effective, 'area')} · máx = ${context.q(maximum, 'area')}`, reference: code.refs.steelMax.label },
      ],
      notes: ['Se desprecia el concreto desplazado por el acero de compresión, como en el planteamiento clásico.'],
      figure: { type: 'section', widthMm: width, heightMm: height, layers: [{ fromTopMm: top, count: countTop, diameterMm: diameterTop }, { fromTopMm: depth, count, diameterMm: diameter }], blockDepthMm: a, neutralAxisMm: c },
    });
  },
};

export const tBeamCheck: ExerciseProblem = {
  id: 't-check',
  mode: 'check',
  find: { symbol: 'MR', label: 'Momento resistente' },
  fields: [
    { id: 'bf', symbol: 'b', label: 'Ancho efectivo del patín', kind: 'section', positive: true },
    { id: 'hf', symbol: 'hf', label: 'Espesor del patín (losa)', kind: 'section', positive: true },
    { id: 'bw', symbol: 'b′', label: 'Ancho del alma', kind: 'section', positive: true },
    h, d, n, db, fc, fy,
  ],
  examples: [
    { id: 'a', label: 'Patín 75 cm · losa 10 cm · 6 #8', values: { bf: 750, hf: 100, bw: 250, h: 600, d: 530, n: 6, db: 25.4, fc: 200 * KGCM2, fy: 4200 * KGCM2 } },
    { id: 'b', label: 'Bloque dentro del patín', values: { bf: 1000, hf: 120, bw: 300, h: 600, d: 540, n: 4, db: 22.2, fc: 250 * KGCM2, fy: 4200 * KGCM2 } },
  ],
  statement: (v, c) => `Determina el momento resistente de una viga T con patín de ${c.q(v.bf ?? NaN, 'section')} × ${c.q(v.hf ?? NaN, 'section')}, alma de ${c.q(v.bw ?? NaN, 'section')}, peralte h = ${c.q(v.h ?? NaN, 'section')} y d = ${c.q(v.d ?? NaN, 'section')}, armada con ${v.n ?? '…'} barras ${v.db ? barName(v.db) : '…'}. f′c = ${c.q(v.fc ?? NaN, 'stress')}; fy = ${c.q(v.fy ?? NaN, 'stress')}.`,
  solve(values, context) {
    const input = read(this.fields, values);
    if (!input.ok) return input.outcome;
    const { bf, hf, bw, h: height, d: depth, n: count, db: diameter, fc: fcMpa, fy: fyMpa } = input.v as Record<string, number>;
    if (bw > bf) return invalid('El alma no puede ser más ancha que el patín.');
    if (depth >= height || hf >= height) return invalid('Debe cumplirse hf < h y d < h.');
    const code = designCode(context.code);
    const mat = materials(context, fcMpa, fyMpa);
    const As = count * barArea(diameter);
    const aRect = As * fyMpa / (mat.fpp * bf);
    const rectangular = aRect <= hf;
    const Cf = rectangular ? 0 : mat.fpp * (bf - bw) * hf;
    const Cw = As * fyMpa - Cf;
    const a = rectangular ? aRect : Cw / (mat.fpp * bw);
    const c = a / mat.beta;
    const nominal = rectangular ? As * fyMpa * (depth - a / 2) / 1e6 : (Cf * (depth - hf / 2) + Cw * (depth - a / 2)) / 1e6;
    const et = ECU * (depth - c) / c;
    const factor = code.flexureFactor(et, mat.ey);
    const resistance = factor * nominal;
    const block = (depthMm: number) => depthMm <= hf ? depthMm * bf : hf * bf + (depthMm - hf) * bw;
    const maximum = code.beam.maximumSteelForBlock(block, depth, depth, fcMpa, fyMpa);
    const minimum = code.beam.minimumSteel(bw, depth, height, fcMpa, fyMpa, depth);
    return solved({
      steps: [
        mat.step,
        { title: 'Acero de tensión', lines: [{ formula: 'As = n · π db² / 4', result: { symbol: 'As', value: As, kind: 'area' } }] },
        {
          title: '¿Dónde cae el bloque de compresión?',
          lines: [
            { formula: 'a = As fy / (f″c b) con todo el patín', substitution: `${context.q(As, 'area')} × ${context.q(fyMpa, 'stress')} / (${context.q(mat.fpp, 'stress')} × ${context.q(bf, 'section')})`, result: { symbol: 'a', value: aRect, kind: 'section' } },
            { note: rectangular ? `a ≤ hf = ${context.q(hf, 'section')}: la viga trabaja como rectangular de ancho b.` : `a > hf = ${context.q(hf, 'section')}: el bloque entra al alma y la viga trabaja como T.` },
          ],
        },
        ...(rectangular ? [] : [{
          title: 'Sección T',
          lines: [
            { formula: 'Cf = f″c (b − b′) hf', result: { symbol: 'Cf', value: Cf / 1e3, kind: 'force' as const } },
            { formula: 'Cw = As fy − Cf', result: { symbol: 'Cw', value: Cw / 1e3, kind: 'force' as const } },
            { formula: 'a = Cw / (f″c b′)', result: { symbol: 'a', value: a, kind: 'section' as const } },
          ],
        }]),
        {
          title: 'Momento resistente',
          lines: [
            { formula: 'c = a / β1', result: { symbol: 'c', value: c, kind: 'section' } },
            { formula: rectangular ? 'Mn = As fy (d − a/2)' : 'Mn = Cf (d − hf/2) + Cw (d − a/2)', result: { symbol: 'Mn', value: nominal, kind: 'moment' } },
            { formula: `FR con εt = ${context.n(et, 5)}`, result: { symbol: 'FR', value: factor, kind: 'factor' } },
            { formula: 'MR = FR · Mn', result: { symbol: 'MR', value: resistance, kind: 'moment' } },
          ],
        },
      ],
      answers: [
        { symbol: 'MR', label: 'Momento resistente de diseño', value: resistance, kind: 'moment' },
        { symbol: 'a', label: rectangular ? 'Bloque dentro del patín' : 'Bloque en el alma', value: a, kind: 'section' },
      ],
      checks: [
        { label: 'Fluencia del acero', status: et >= mat.ey ? 'pass' : 'fail', detail: et >= mat.ey ? `εt = ${context.n(et, 5)} ≥ εy` : 'El acero no fluye; aumenta la sección.' },
        { label: 'Acero mínimo (con b′)', status: As >= minimum ? 'pass' : 'fail', detail: `As = ${context.q(As, 'area')} · As,mín = ${context.q(minimum, 'area')}`, reference: code.refs.steelMin.label },
        { label: 'Acero máximo (bloque T)', status: As <= maximum * (1 + 1e-9) ? 'pass' : 'fail', detail: `As = ${context.q(As, 'area')} · As,máx = ${context.q(maximum, 'area')}`, reference: code.refs.steelMax.label },
      ],
      notes: ['El ancho efectivo b se toma como dato; revisa su límite normativo en la pieza completa (Viga T).'],
      figure: { type: 'section', widthMm: bw, heightMm: height, flange: { widthMm: bf, thicknessMm: hf }, layers: [{ fromTopMm: depth, count, diameterMm: diameter }], blockDepthMm: a, neutralAxisMm: c },
    });
  },
};
