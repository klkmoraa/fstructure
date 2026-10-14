import { designCode, type DesignCodeId } from '../elements/codes';
import { KGCM2, TON, read, solved } from './common';
import type { ExerciseField, ExerciseProblem } from './types';

/*
 * Cálculo rápido de vigas isostáticas: reacciones, cortante, momento y flecha
 * elástica con carga uniforme más una carga puntual. Fórmulas cerradas de
 * superposición; la flecha usa la sección bruta y el módulo elástico de la norma.
 */

const fields: readonly ExerciseField[] = [
  { id: 'L', symbol: 'L', label: 'Claro', kind: 'span', positive: true },
  { id: 'w', symbol: 'w', label: 'Carga uniforme', kind: 'line', min: 0 },
  { id: 'P', symbol: 'P', label: 'Carga puntual', kind: 'force', min: 0, optional: true },
  { id: 'a', symbol: 'a', label: 'Posición de P desde el apoyo izquierdo', kind: 'span', min: 0, optional: true },
  { id: 'b', symbol: 'b', label: 'Ancho (para la flecha)', kind: 'section', positive: true, optional: true },
  { id: 'h', symbol: 'h', label: 'Peralte (para la flecha)', kind: 'section', positive: true, optional: true },
  { id: 'fc', symbol: 'f′c', label: 'Concreto (para E)', kind: 'stress', positive: true, optional: true },
];

type Support = 'simple' | 'cantilever';

function analyse(support: Support, v: Record<string, number>, code: DesignCodeId) {
  const L = v.L!;
  const w = v.w ?? 0;
  const P = v.P ?? 0;
  const a = Math.min(Math.max(v.a ?? L / 2, 0), L);
  const stations = Array.from(new Set([...Array.from({ length: 81 }, (_, index) => L * index / 80), a])).sort((x, y) => x - y);
  let reactions: { label: string; value: number }[];
  let shear: (x: number, side: 'left' | 'right') => number;
  let moment: (x: number) => number;
  if (support === 'simple') {
    const ra = w * L / 2 + P * (L - a) / L;
    const rb = w * L / 2 + P * a / L;
    reactions = [{ label: 'RA', value: ra }, { label: 'RB', value: rb }];
    shear = (x, side) => ra - w * x - (x > a || (x === a && side === 'right') ? P : 0);
    moment = (x) => ra * x - w * x * x / 2 - (x > a ? P * (x - a) : 0);
  } else {
    const r = w * L + P;
    reactions = [{ label: 'R', value: r }, { label: 'M', value: -(w * L * L / 2 + P * a) }];
    shear = (x, side) => w * (L - x) + (x < a || (x === a && side === 'left') ? P : 0);
    moment = (x) => -w * (L - x) ** 2 / 2 - (x < a ? P * (a - x) : 0);
  }
  // Momento máximo positivo de la viga simple: donde V cambia de signo.
  const extra: number[] = [];
  if (support === 'simple' && w > 0) {
    const zeroLeft = reactions[0]!.value / w;
    const zeroRight = (reactions[0]!.value - P) / w;
    if (zeroLeft > 0 && zeroLeft < a) extra.push(zeroLeft);
    if (zeroRight > a && zeroRight < L) extra.push(zeroRight);
  }
  const points = [...stations, ...extra].sort((x, y) => x - y);
  const table = points.map((x) => ({ x, v: shear(x, 'left'), m: moment(x) }));
  // Saltos de cortante bajo la carga puntual.
  if (P > 0) table.splice(table.findIndex((point) => point.x === a) + 1, 0, { x: a, v: shear(a, 'right'), m: moment(a) });
  const peak = table.reduce((best, point) => Math.abs(point.m) > Math.abs(best.m) ? point : best, table[0]!);
  const vmax = Math.max(...table.map((point) => Math.abs(point.v)));
  let deflection: { value: number; at: number; e: number; i: number } | null = null;
  if (v.b && v.h && v.fc) {
    const e = designCode(code).elasticModulusMpa(v.fc);
    const i = v.b * v.h ** 3 / 12;
    const EI = e * i; // N·mm²
    const Lm = L * 1e3, am = a * 1e3, bm = Lm - am, wN = w, PN = P * 1e3; // mm, N/mm, N
    const y = (xm: number) => {
      if (support === 'simple') {
        const uniform = wN * xm * (Lm ** 3 - 2 * Lm * xm ** 2 + xm ** 3) / (24 * EI);
        const point = PN === 0 ? 0 : xm <= am ? PN * bm * xm * (Lm ** 2 - bm ** 2 - xm ** 2) / (6 * Lm * EI) : PN * am * (Lm - xm) * (2 * Lm * xm - xm ** 2 - am ** 2) / (6 * Lm * EI);
        return uniform + point;
      }
      const uniform = wN * xm ** 2 * (6 * Lm ** 2 - 4 * Lm * xm + xm ** 2) / (24 * EI);
      const point = xm <= am ? PN * xm ** 2 * (3 * am - xm) / (6 * EI) : PN * am ** 2 * (3 * xm - am) / (6 * EI);
      return uniform + point;
    };
    let best = { value: 0, at: 0 };
    for (let index = 0; index <= 400; index += 1) {
      const xm = Lm * index / 400;
      const value = y(xm);
      if (value > best.value) best = { value, at: xm / 1e3 };
    }
    deflection = { ...best, e, i };
  }
  return { L, w, P, a, reactions, table, peak, vmax, deflection };
}

const problem = (support: Support): ExerciseProblem => ({
  id: support === 'simple' ? 'beam-simple' : 'beam-cantilever',
  mode: 'analysis',
  find: { symbol: 'V, M, Δ', label: 'Reacciones, diagramas y flecha' },
  fields: support === 'simple' ? fields : fields.map((field) => field.id === 'a' ? { ...field, label: 'Posición de P desde el empotramiento' } : field),
  examples: support === 'simple' ? [
    { id: 'a', label: 'L = 6 m · w = 2 t/m', values: { L: 6, w: 2 * TON, P: 0, a: 3, b: 300, h: 600, fc: 250 * KGCM2 } },
    { id: 'b', label: 'w = 1.5 t/m + P = 4 t a 2 m', values: { L: 6, w: 1.5 * TON, P: 4 * TON, a: 2, b: 250, h: 500, fc: 250 * KGCM2 } },
  ] : [
    { id: 'a', label: 'Voladizo 2 m · w = 1.5 t/m + P = 1 t', values: { L: 2, w: 1.5 * TON, P: 1 * TON, a: 2, b: 250, h: 500, fc: 250 * KGCM2 } },
  ],
  statement: (v, c) => `${support === 'simple' ? 'Una viga simplemente apoyada' : 'Un voladizo'} de ${c.q(v.L ?? NaN, 'span')} soporta una carga uniforme w = ${c.q(v.w ?? NaN, 'line')}${v.P ? ` y una carga puntual P = ${c.q(v.P, 'force')} a ${c.q(v.a ?? NaN, 'span')} ${support === 'simple' ? 'del apoyo izquierdo' : 'del empotramiento'}` : ''}. Obtén las reacciones, los diagramas de cortante y momento${v.b && v.h ? ` y la flecha máxima con una sección de ${c.q(v.b, 'section')} × ${c.q(v.h, 'section')}` : ''}.`,
  solve(values, context) {
    const input = read(fields, values);
    if (!input.ok) return input.outcome;
    const result = analyse(support, input.v, context.code);
    const { L, w, P, a, reactions, peak, vmax, deflection } = result;
    const limit = support === 'simple' ? L * 1e3 / 240 : L * 1e3 / 120;
    return solved({
      steps: [
        {
          title: 'Reacciones',
          lines: support === 'simple' ? [
            { formula: 'RA = wL/2 + P (L − a)/L', substitution: `${context.q(w, 'line')} × ${context.q(L, 'span')} / 2 + ${context.q(P, 'force')} × ${context.q(L - a, 'span')} / ${context.q(L, 'span')}`, result: { symbol: 'RA', value: reactions[0]!.value, kind: 'force' } },
            { formula: 'RB = wL/2 + P a/L', result: { symbol: 'RB', value: reactions[1]!.value, kind: 'force' } },
          ] : [
            { formula: 'R = wL + P', result: { symbol: 'R', value: reactions[0]!.value, kind: 'force' } },
            { formula: 'M = −(wL²/2 + P a)', result: { symbol: 'M', value: reactions[1]!.value, kind: 'moment' } },
          ],
        },
        {
          title: 'Cortante y momento máximos',
          lines: [
            { formula: support === 'simple' ? 'Vmáx en un apoyo' : 'Vmáx en el empotramiento', result: { symbol: 'Vmáx', value: vmax, kind: 'force' } },
            { formula: support === 'simple' ? 'Mmáx donde V = 0' : 'Mmáx en el empotramiento', note: `x = ${context.q(peak.x, 'span')}`, result: { symbol: 'Mmáx', value: peak.m, kind: 'moment' } },
          ],
        },
        ...(deflection ? [{
          title: 'Flecha elástica',
          lines: [
            { formula: 'E (norma) con f′c', result: { symbol: 'E', value: deflection.e, kind: 'stress' as const } },
            { formula: 'I = b h³ / 12 (sección bruta)', note: `I = ${context.n(deflection.i / (context.units === 'kgf' ? 1e4 : 1), 0)} ${context.units === 'kgf' ? 'cm⁴' : 'mm⁴'}` },
            { formula: support === 'simple' ? 'Δ = 5wL⁴/(384EI) + flecha de P (superposición)' : 'Δ = wL⁴/(8EI) + flecha de P (superposición)', note: `x = ${context.q(deflection.at, 'span')}`, result: { symbol: 'Δmáx', value: deflection.value, kind: 'deflection' as const } },
          ],
        }] : []),
      ],
      answers: [
        { symbol: 'Mmáx', label: 'Momento máximo', value: peak.m, kind: 'moment' },
        { symbol: 'Vmáx', label: 'Cortante máximo', value: vmax, kind: 'force' },
        ...reactions.map((reaction) => ({ symbol: reaction.label, label: reaction.label === 'M' ? 'Momento en el empotramiento' : 'Reacción', value: reaction.value, kind: reaction.label === 'M' ? 'moment' as const : 'force' as const })),
        ...(deflection ? [{ symbol: 'Δmáx', label: 'Flecha elástica máxima', value: deflection.value, kind: 'deflection' as const }] : []),
      ],
      checks: deflection ? [{ label: support === 'simple' ? 'Flecha ≤ L/240' : 'Flecha ≤ L/120', status: deflection.value <= limit ? 'pass' : 'fail', detail: `Δ = ${context.q(deflection.value, 'deflection')} · límite = ${context.q(limit, 'deflection')}. Referencia rápida con sección bruta: la flecha de servicio con sección agrietada y diferida es mayor.` }] : [],
      notes: deflection ? [] : ['Captura b, h y f′c para obtener la flecha.'],
      figure: { type: 'beam', support, lengthM: L, line: w, point: P, pointAtM: a, stations: result.table },
    });
  },
});

export const simpleBeam = problem('simple');
export const cantileverBeam = problem('cantilever');
