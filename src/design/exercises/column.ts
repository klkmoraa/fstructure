import { betaOne, equivalentBlockStrengthMpa } from '../concrete/ntcConcrete2023';
import { designCode } from '../elements/codes';
import { interactionCurve, momentCapacityAt, rayCapacity, rectangularBlock } from '../elements/column';
import { ECU, ES, KGCM2, TON, barArea, barField, barName, invalid, read, solved } from './common';
import type { ExerciseField, ExerciseProblem } from './types';

/*
 * Columnas cortas de concreto: carga axial pura y flexocompresión en un plano
 * con barras en las dos caras paralelas al eje de flexión. El diagrama de
 * interacción es el mismo del motor de columnas del taller (compatibilidad de
 * deformaciones, bloque equivalente y FR según εt de la norma elegida).
 */

const b: ExerciseField = { id: 'b', symbol: 'b', label: 'Ancho (perpendicular a la flexión)', kind: 'section', positive: true };
const h: ExerciseField = { id: 'h', symbol: 'h', label: 'Peralte (en la dirección de la flexión)', kind: 'section', positive: true };
const fc: ExerciseField = { id: 'fc', symbol: 'f′c', label: 'Resistencia del concreto', kind: 'stress', positive: true };
const fy: ExerciseField = { id: 'fy', symbol: 'fy', label: 'Fluencia del acero', kind: 'stress', positive: true };

export const columnAxial: ExerciseProblem = {
  id: 'column-axial',
  mode: 'check',
  find: { symbol: 'PR', label: 'Carga axial resistente' },
  fields: [
    { id: 'b', symbol: 'b', label: 'Ancho', kind: 'section', positive: true },
    { id: 'h', symbol: 'h', label: 'Peralte', kind: 'section', positive: true },
    { id: 'n', symbol: 'n', label: 'Número total de barras', kind: 'count', positive: true, integer: true },
    barField('db', 'db', 'Barra longitudinal'),
    fc, fy,
  ],
  examples: [
    { id: 'a', label: 'Columna 40 × 40 · 8 #8', values: { b: 400, h: 400, n: 8, db: 25.4, fc: 250 * KGCM2, fy: 4200 * KGCM2 } },
    { id: 'b', label: 'Columna 30 × 50 · 6 #6', values: { b: 300, h: 500, n: 6, db: 19.1, fc: 300 * KGCM2, fy: 4200 * KGCM2 } },
  ],
  statement: (v, c) => `Calcula la carga axial resistente de diseño de una columna corta de ${c.q(v.b ?? NaN, 'section')} × ${c.q(v.h ?? NaN, 'section')}, con ${v.n ?? '…'} barras ${v.db ? barName(v.db) : '…'}, f′c = ${c.q(v.fc ?? NaN, 'stress')} y fy = ${c.q(v.fy ?? NaN, 'stress')}.`,
  solve(values, context) {
    const input = read(this.fields, values);
    if (!input.ok) return input.outcome;
    const v = input.v;
    const code = designCode(context.code);
    const gross = v.b! * v.h!;
    const As = v.n! * barArea(v.db!);
    if (As >= gross) return invalid('El acero no puede ocupar toda la sección.');
    const fpp = equivalentBlockStrengthMpa(v.fc!);
    const squash = (fpp * (gross - As) + v.fy! * As) / 1e3;
    const cap = code.maximumAxialCoefficient * code.compressionFactor * squash;
    const ratio = As / gross;
    return solved({
      steps: [
        {
          title: 'Áreas',
          lines: [
            { formula: 'Ag = b h', result: { symbol: 'Ag', value: gross, kind: 'area' } },
            { formula: 'As = n · π db² / 4', result: { symbol: 'As', value: As, kind: 'area' } },
            { formula: 'ρ = As / Ag', result: { symbol: 'ρ', value: ratio, kind: 'ratio' } },
          ],
        },
        {
          title: 'Resistencia a carga axial',
          lines: [
            { formula: 'f″c = 0.85 f′c', result: { symbol: 'f″c', value: fpp, kind: 'stress' } },
            { formula: 'P0 = f″c (Ag − As) + As fy', substitution: `${context.q(fpp, 'stress')} × (${context.q(gross, 'area')} − ${context.q(As, 'area')}) + ${context.q(As, 'area')} × ${context.q(v.fy!, 'stress')}`, result: { symbol: 'P0', value: squash, kind: 'force' } },
            { formula: `PR = ${code.maximumAxialCoefficient === 1 ? '' : `${context.n(code.maximumAxialCoefficient, 2)} · `}FR · P0, FR = ${context.n(code.compressionFactor, 2)}`, note: code.maximumAxialCoefficient === 1 ? 'La NTC no reduce P0 por excentricidad accidental en este paso; se revisa con la excentricidad mínima.' : 'El coeficiente cubre la excentricidad accidental.', result: { symbol: 'PR', value: cap, kind: 'force' } },
          ],
        },
      ],
      answers: [
        { symbol: 'PR', label: 'Carga axial resistente de diseño', value: cap, kind: 'force' },
        { symbol: 'P0', label: 'Resistencia nominal a compresión pura', value: squash, kind: 'force' },
      ],
      checks: [
        { label: 'Cuantía mínima', status: ratio >= code.column.ratioMin - 1e-9 ? 'pass' : 'fail', detail: `ρ = ${context.n(ratio * 100, 2)} % · mín = ${context.n(code.column.ratioMin * 100, 1)} %`, reference: code.refs.columnRatio.label },
        { label: 'Cuantía máxima', status: ratio <= code.column.ratioMax + 1e-9 ? 'pass' : 'fail', detail: `ρ = ${context.n(ratio * 100, 2)} % · máx = ${context.n(code.column.ratioMax * 100, 1)} %`, reference: code.refs.columnRatio.label },
      ],
      notes: ['Columna corta: no se revisan esbeltez, estribos ni excentricidad mínima.'],
    });
  },
};

export const columnInteraction: ExerciseProblem = {
  id: 'column-interaction',
  mode: 'check',
  find: { symbol: 'P–M', label: 'Diagrama de interacción y revisión' },
  fields: [
    b, h,
    { id: 'r', symbol: 'r', label: 'Recubrimiento al centro de las barras', kind: 'section', positive: true },
    { id: 'n', symbol: 'n', label: 'Barras en cada cara', kind: 'count', positive: true, integer: true },
    barField('db', 'db', 'Barra longitudinal'),
    fc, fy,
    { id: 'pu', symbol: 'Pu', label: 'Carga axial última', kind: 'force', min: 0 },
    { id: 'mu', symbol: 'Mu', label: 'Momento último', kind: 'moment', min: 0 },
  ],
  examples: [
    { id: 'a', label: '40 × 50 · 3 #8 por cara', values: { b: 400, h: 500, r: 60, n: 3, db: 25.4, fc: 250 * KGCM2, fy: 4200 * KGCM2, pu: 120 * TON, mu: 18 * TON } },
    { id: 'b', label: 'Gran excentricidad', values: { b: 300, h: 600, r: 60, n: 3, db: 22.2, fc: 250 * KGCM2, fy: 4200 * KGCM2, pu: 30 * TON, mu: 25 * TON } },
  ],
  statement: (v, c) => `Construye el diagrama de interacción de una columna de ${c.q(v.b ?? NaN, 'section')} × ${c.q(v.h ?? NaN, 'section')} con ${v.n ?? '…'} barras ${v.db ? barName(v.db) : '…'} en cada cara (r = ${c.q(v.r ?? NaN, 'section')}), f′c = ${c.q(v.fc ?? NaN, 'stress')} y fy = ${c.q(v.fy ?? NaN, 'stress')}, y revisa si resiste Pu = ${c.q(v.pu ?? NaN, 'force')} con Mu = ${c.q(v.mu ?? NaN, 'moment')}.`,
  solve(values, context) {
    const input = read(this.fields, values);
    if (!input.ok) return input.outcome;
    const v = input.v;
    if (2 * v.r! >= v.h!) return invalid('El recubrimiento deja las barras fuera de la sección.');
    const code = designCode(context.code);
    const gross = v.b! * v.h!;
    const area = barArea(v.db!);
    const half = v.h! / 2 - v.r!;
    const positions = [...Array.from({ length: v.n! }, () => half), ...Array.from({ length: v.n! }, () => -half)];
    const As = positions.length * area;
    const fpp = equivalentBlockStrengthMpa(v.fc!);
    const squashN = fpp * (gross - As) + v.fy! * As;
    const cap = code.maximumAxialCoefficient * code.compressionFactor * squashN;
    const curve = interactionCurve(code, v.h!, rectangularBlock(v.b!), gross, positions, area, v.fc!, v.fy!, cap);
    const dt = v.h! - v.r!;
    const ey = v.fy! / ES;
    const cb = ECU * dt / (ECU + ey);
    const pure = momentCapacityAt(curve.design, 0);
    const demand = Math.hypot(v.mu!, v.pu!);
    const capacity = demand > 0 ? rayCapacity(curve.design, v.mu!, v.pu!) : undefined;
    const ratio = capacity ? demand / Math.hypot(capacity.momentKnm, capacity.axialKn) : 0;
    const ok = v.pu! <= cap / 1e3 + 1e-9 && ratio <= 1 + 1e-9;
    return solved({
      steps: [
        {
          title: 'Datos de la sección',
          lines: [
            { formula: 'As total = 2 n · π db² / 4', result: { symbol: 'As', value: As, kind: 'area' } },
            { formula: 'ρ = As / (b h)', result: { symbol: 'ρ', value: As / gross, kind: 'ratio' } },
            { formula: 'd = h − r', result: { symbol: 'd', value: dt, kind: 'section' } },
            { formula: 'f″c = 0.85 f′c; β1', result: { symbol: 'β1', value: betaOne(v.fc!), kind: 'factor' } },
          ],
        },
        {
          title: 'Compresión pura',
          lines: [
            { formula: 'P0 = f″c (Ag − As) + As fy', result: { symbol: 'P0', value: squashN / 1e3, kind: 'force' } },
            { formula: `PR,máx = ${code.maximumAxialCoefficient === 1 ? '' : `${context.n(code.maximumAxialCoefficient, 2)} · `}FR P0`, result: { symbol: 'PR,máx', value: cap / 1e3, kind: 'force' } },
          ],
        },
        {
          title: 'Falla balanceada',
          lines: [
            { formula: 'cb = 0.003 d / (0.003 + εy)', substitution: `0.003 × ${context.q(dt, 'section')} / (0.003 + ${context.n(ey, 5)})`, result: { symbol: 'cb', value: cb, kind: 'section' } },
            { formula: 'Pb = Cc + C′s − T', note: 'Cc = f″c b β1 cb; C′s con f′s = Es ε′s ≤ fy (descontando el concreto desplazado); T = As fy.', result: { symbol: 'Pb', value: curve.balanced.axialKn, kind: 'force' } },
            { formula: 'Mb = Σ fuerzas × brazo al centroide', result: { symbol: 'Mb', value: curve.balanced.momentKnm, kind: 'moment' } },
            { formula: `FR en la balanceada`, result: { symbol: 'FR', value: curve.balanced.phi, kind: 'factor' } },
          ],
        },
        {
          title: 'Flexión pura y tensión',
          lines: [
            { formula: 'MR con P = 0 (curva de diseño)', result: { symbol: 'MR0', value: pure, kind: 'moment' } },
            { formula: 'Tensión pura: PT = − As fy', result: { symbol: 'PT', value: -v.fy! * As / 1e3, kind: 'force' } },
            { note: 'Los demás puntos se obtienen variando c entre 0 y h con compatibilidad de deformaciones.' },
          ],
        },
        {
          title: 'Revisión del punto (Mu, Pu)',
          lines: [
            { formula: 'Resistencia sobre el radio que va del origen a (Mu, Pu)', ...(capacity ? { result: { symbol: 'PR', value: capacity.axialKn, kind: 'force' as const } } : {}) },
            ...(capacity ? [{ formula: 'MR en el mismo radio', result: { symbol: 'MR', value: capacity.momentKnm, kind: 'moment' as const } }] : []),
            { formula: 'Demanda / capacidad', result: { symbol: 'D/C', value: ratio, kind: 'factor' } },
          ],
        },
      ],
      answers: [
        { symbol: 'D/C', label: ok ? 'La columna resiste' : 'La columna no resiste', value: ratio, kind: 'factor' },
        { symbol: 'PR,máx', label: 'Carga axial máxima de diseño', value: cap / 1e3, kind: 'force' },
        { symbol: 'MR0', label: 'Momento resistente en flexión pura', value: pure, kind: 'moment' },
      ],
      checks: [
        { label: 'Punto dentro del diagrama', status: ok ? 'pass' : 'fail', detail: `D/C = ${context.n(ratio, 3)}`, reference: code.refs.columnStrength.label },
        { label: 'Cuantía', status: As / gross >= code.column.ratioMin - 1e-9 && As / gross <= code.column.ratioMax + 1e-9 ? 'pass' : 'fail', detail: `ρ = ${context.n(As / gross * 100, 2)} % · límites ${context.n(code.column.ratioMin * 100, 1)}–${context.n(code.column.ratioMax * 100, 1)} %`, reference: code.refs.columnRatio.label },
      ],
      notes: ['Columna corta, flexión en un plano. La esbeltez, la excentricidad mínima y la flexión biaxial se revisan en la pieza completa (Columna).'],
      figure: {
        type: 'interaction',
        nominal: curve.nominal.map((point) => ({ p: point.axialKn, m: point.momentKnm })),
        design: curve.design.map((point) => ({ p: point.axialKn, m: point.momentKnm })),
        point: { p: v.pu!, m: v.mu! },
        ok,
      },
    });
  },
};
