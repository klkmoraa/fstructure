import { designCode } from '../elements/codes';
import { KGCM2, TON, barArea, barField, barName, floorTo, invalid, read, solved } from './common';
import type { ExerciseContext, ExerciseField, ExerciseProblem } from './types';

/*
 * Cortante en vigas con estribos verticales. Mismas expresiones que el motor
 * de vigas del taller (`designSpanStirrups`): Vc = 0.17 √f′c b d (MPa),
 * Vs ≤ 0.66 √f′c b d, separación máxima d/2 (d/4 si Vs > 0.33 √f′c b d) y
 * Av,mín = máx(0.062 √f′c, 0.35) b s / fyt. En kg/cm² equivalen a 0.53 √f′c,
 * 2.1 √f′c y 1.06 √f′c.
 */

const fields: readonly ExerciseField[] = [
  { id: 'vu', symbol: 'Vu', label: 'Cortante último', kind: 'force', positive: true },
  { id: 'b', symbol: 'b', label: 'Ancho del alma', kind: 'section', positive: true },
  { id: 'd', symbol: 'd', label: 'Peralte efectivo', kind: 'section', positive: true },
  { id: 'fc', symbol: 'f′c', label: 'Resistencia del concreto', kind: 'stress', positive: true },
  { id: 'fy', symbol: 'fyt', label: 'Fluencia de los estribos', kind: 'stress', positive: true },
  barField('ds', 'de', 'Estribo', 'transverse'),
  { id: 'legs', symbol: 'ramas', label: 'Ramas del estribo', kind: 'count', positive: true, integer: true },
];
const spacing: ExerciseField = { id: 's', symbol: 's', label: 'Separación de estribos', kind: 'spacing', positive: true };

const example = { vu: 20 * TON, b: 300, d: 550, fc: 250 * KGCM2, fy: 4200 * KGCM2, ds: 9.5, legs: 2 };

function base(context: ExerciseContext, v: Record<string, number>) {
  const code = designCode(context.code);
  const root = Math.sqrt(v.fc!);
  const vc = 0.17 * root * v.b! * v.d! / 1e3;
  const phi = code.shearFactor;
  const vsMax = 0.66 * root * v.b! * v.d! / 1e3;
  const av = v.legs! * barArea(v.ds!);
  const highShearLimit = 0.33 * root * v.b! * v.d! / 1e3;
  const minRatio = Math.max(0.062 * root, 0.35) * v.b! / v.fy!;
  return { code, root, vc, phi, vsMax, av, highShearLimit, minRatio };
}

export const shearDesign: ExerciseProblem = {
  id: 'shear-design',
  mode: 'design',
  find: { symbol: 's', label: 'Separación de estribos' },
  fields,
  examples: [
    { id: 'a', label: 'Vu = 20 t · 30 × 60 · E#3', values: example },
    { id: 'b', label: 'Vu = 35 t · cortante alto', values: { ...example, vu: 35 * TON } },
  ],
  statement: (v, c) => `Una viga de ${c.q(v.b ?? NaN, 'section')} de ancho y d = ${c.q(v.d ?? NaN, 'section')} recibe un cortante último Vu = ${c.q(v.vu ?? NaN, 'force')}. Con f′c = ${c.q(v.fc ?? NaN, 'stress')}, estribos ${v.ds ? barName(v.ds, 'transverse') : '…'} de ${v.legs ?? '…'} ramas y fyt = ${c.q(v.fy ?? NaN, 'stress')}, determina la separación de los estribos.`,
  solve(values, context) {
    const input = read(this.fields, values);
    if (!input.ok) return input.outcome;
    const v = input.v;
    const k = base(context, v);
    const sectionStrength = k.phi * (k.vc + k.vsMax);
    const vs = Math.max(0, v.vu! / k.phi - k.vc);
    if (v.vu! > sectionStrength) {
      return solved({
        steps: [{ title: 'Límite de la sección', lines: [{ formula: 'Vu ≤ FR (Vc + 0.66 √f′c b d)', result: { symbol: 'FR(Vc + Vs,máx)', value: sectionStrength, kind: 'force' } }] }],
        answers: [],
        checks: [{ label: 'Sección suficiente', status: 'fail', detail: 'Vu excede el máximo que admite la sección con cualquier estribo: aumenta b o d.', reference: k.code.refs.shearSection.label }],
      });
    }
    const required = vs > 0 ? k.av * v.fy! * v.d! / (vs * 1e3) : Number.POSITIVE_INFINITY;
    const maximum = floorTo(vs > k.highShearLimit ? Math.min(v.d! / 4, 300) : Math.min(v.d! / 2, 600), 5);
    const byMinimum = k.av / k.minRatio;
    const chosen = floorTo(Math.min(required, maximum, byMinimum), 25);
    const governs = chosen === floorTo(required, 25) ? 'la resistencia' : chosen === floorTo(maximum, 25) ? 'la separación máxima' : 'el acero mínimo';
    const resistance = k.phi * (k.vc + k.av * v.fy! * v.d! / chosen / 1e3);
    return solved({
      steps: [
        {
          title: 'Resistencia del concreto',
          lines: [
            { formula: 'Vc = 0.17 √f′c b d', note: context.units === 'kgf' ? 'En kg/cm²: Vc = 0.53 √f′c b d.' : 'f′c en MPa.', result: { symbol: 'Vc', value: k.vc, kind: 'force' } },
            { formula: `FR = ${context.n(k.phi, 2)} (${k.code.name})`, result: { symbol: 'FR Vc', value: k.phi * k.vc, kind: 'force' } },
            { note: v.vu! <= 0.5 * k.phi * k.vc ? 'Vu ≤ FR Vc / 2: teóricamente no se requieren estribos; se colocan por separación máxima.' : 'Vu > FR Vc / 2: se requieren estribos.' },
          ],
        },
        {
          title: 'Acero de cortante',
          lines: [
            { formula: 'Vs = Vu / FR − Vc', substitution: `${context.q(v.vu!, 'force')} / ${context.n(k.phi, 2)} − ${context.q(k.vc, 'force')}`, result: { symbol: 'Vs', value: vs, kind: 'force' } },
            { formula: 'Av = ramas · π de² / 4', result: { symbol: 'Av', value: k.av, kind: 'area' } },
            { formula: 's = Av fyt d / Vs', result: { symbol: 's req', value: required, kind: 'spacing' } },
          ],
        },
        {
          title: 'Límites',
          lines: [
            { formula: vs > k.highShearLimit ? 'Vs > 0.33 √f′c b d → s ≤ d/4 ≤ 30 cm' : 'Vs ≤ 0.33 √f′c b d → s ≤ d/2 ≤ 60 cm', result: { symbol: 's máx', value: maximum, kind: 'spacing' } },
            { formula: 'Av,mín → s ≤ Av fyt / (máx(0.062 √f′c, 0.35) b)', result: { symbol: 's (Av,mín)', value: byMinimum, kind: 'spacing' } },
            { formula: 'Separación elegida (múltiplo de 2.5 cm hacia abajo)', note: `Rige ${governs}.`, result: { symbol: 's', value: chosen, kind: 'spacing' } },
          ],
        },
      ],
      answers: [
        { symbol: 's', label: 'Separación de estribos', value: chosen, kind: 'spacing', text: `${v.ds ? barName(v.ds, 'transverse') : 'Estribo'} de ${v.legs} ramas @ ${context.q(chosen, 'spacing')}` },
        { symbol: 'VR', label: 'Resistencia con esa separación', value: resistance, kind: 'force' },
      ],
      checks: [
        { label: 'Cortante máximo de la sección', status: 'pass', detail: `Vu = ${context.q(v.vu!, 'force')} ≤ ${context.q(sectionStrength, 'force')}`, reference: k.code.refs.shearSection.label },
        { label: 'Resistencia', status: resistance >= v.vu! * (1 - 1e-9) ? 'pass' : 'fail', detail: `VR = ${context.q(resistance, 'force')} ≥ Vu`, reference: k.code.refs.shear.label },
        ...(chosen < 50 ? [{ label: 'Separación práctica', status: 'fail' as const, detail: 'La separación resulta menor de 5 cm: usa un estribo mayor o más ramas.' }] : []),
      ],
      notes: ['Estribos verticales; la demanda Vu se toma como dato (en vigas suele tomarse a d del paño del apoyo).'],
    });
  },
};

export const shearCheck: ExerciseProblem = {
  id: 'shear-check',
  mode: 'check',
  find: { symbol: 'VR', label: 'Cortante resistente' },
  fields: [...fields.filter((field) => field.id !== 'vu'), spacing, { ...fields[0]!, optional: true, hint: 'Opcional: para comparar con la resistencia.' }],
  examples: [
    { id: 'a', label: 'E#3 @ 20 cm · 30 × 60', values: { ...example, s: 200 } },
  ],
  statement: (v, c) => `Calcula la resistencia a cortante de una viga de ${c.q(v.b ?? NaN, 'section')} de ancho y d = ${c.q(v.d ?? NaN, 'section')}, con estribos ${v.ds ? barName(v.ds, 'transverse') : '…'} de ${v.legs ?? '…'} ramas @ ${c.q(v.s ?? NaN, 'spacing')}. f′c = ${c.q(v.fc ?? NaN, 'stress')}; fyt = ${c.q(v.fy ?? NaN, 'stress')}.${v.vu ? ` Compárala con Vu = ${c.q(v.vu, 'force')}.` : ''}`,
  solve(values, context) {
    const input = read(this.fields, values);
    if (!input.ok) return input.outcome;
    const v = input.v;
    if (v.s! > v.d!) return invalid('La separación no puede exceder el peralte efectivo.');
    const k = base(context, v);
    const vsRaw = k.av * v.fy! * v.d! / v.s! / 1e3;
    const vs = Math.min(vsRaw, k.vsMax);
    const resistance = k.phi * (k.vc + vs);
    const maximum = floorTo(vsRaw > k.highShearLimit ? Math.min(v.d! / 4, 300) : Math.min(v.d! / 2, 600), 5);
    const minimumOk = k.av >= k.minRatio * v.s! * (1 - 1e-9);
    return solved({
      steps: [
        { title: 'Concreto', lines: [{ formula: 'Vc = 0.17 √f′c b d', note: context.units === 'kgf' ? 'En kg/cm²: 0.53 √f′c b d.' : undefined, result: { symbol: 'Vc', value: k.vc, kind: 'force' } }] },
        {
          title: 'Estribos',
          lines: [
            { formula: 'Av = ramas · π de² / 4', result: { symbol: 'Av', value: k.av, kind: 'area' } },
            { formula: 'Vs = Av fyt d / s', substitution: `${context.q(k.av, 'area')} × ${context.q(v.fy!, 'stress')} × ${context.q(v.d!, 'section')} / ${context.q(v.s!, 'spacing')}`, result: { symbol: 'Vs', value: vsRaw, kind: 'force' } },
            ...(vsRaw > k.vsMax ? [{ note: 'Vs excede 0.66 √f′c b d; se limita a ese valor.', result: { symbol: 'Vs', value: vs, kind: 'force' as const } }] : []),
          ],
        },
        { title: 'Resistencia', lines: [{ formula: `VR = FR (Vc + Vs), FR = ${context.n(k.phi, 2)}`, result: { symbol: 'VR', value: resistance, kind: 'force' } }] },
      ],
      answers: [{ symbol: 'VR', label: 'Cortante resistente de diseño', value: resistance, kind: 'force' }],
      checks: [
        ...(v.vu ? [{ label: 'Resistencia', status: resistance >= v.vu * (1 - 1e-9) ? 'pass' as const : 'fail' as const, detail: `Vu = ${context.q(v.vu, 'force')} · VR = ${context.q(resistance, 'force')}`, reference: k.code.refs.shear.label }] : []),
        { label: 'Separación máxima', status: v.s! <= maximum + 1e-9 ? 'pass' : 'fail', detail: `s = ${context.q(v.s!, 'spacing')} · s máx = ${context.q(maximum, 'spacing')}`, reference: k.code.refs.stirrupSpacing.label },
        { label: 'Acero mínimo de cortante', status: minimumOk ? 'pass' : 'fail', detail: `Av = ${context.q(k.av, 'area')} · Av,mín = ${context.q(k.minRatio * v.s!, 'area')}` },
      ],
    });
  },
};
