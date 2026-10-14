import { designCode } from '../elements/codes';
import { KGCM2, barField, barName, read, solved } from './common';
import type { ExerciseProblem } from './types';

/** Longitud de desarrollo, gancho y traslape con las reglas de la norma elegida (`codes.ts`). */
export const developmentLength: ExerciseProblem = {
  id: 'development',
  mode: 'design',
  find: { symbol: 'ld', label: 'Longitud de desarrollo' },
  fields: [
    barField('db', 'db', 'Barra'),
    { id: 'fc', symbol: 'f′c', label: 'Resistencia del concreto', kind: 'stress', positive: true },
    { id: 'fy', symbol: 'fy', label: 'Fluencia del acero', kind: 'stress', positive: true },
    { id: 'spacing', symbol: 'sl', label: 'Separación libre entre barras', kind: 'section', positive: true },
    { id: 'cover', symbol: 'rl', label: 'Recubrimiento libre', kind: 'section', positive: true },
    { id: 'top', symbol: 'superior', label: 'Barra superior (más de 30 cm de concreto debajo)', kind: 'flag' },
    { id: 'stirrups', symbol: 'estribos', label: 'Estribos mínimos a lo largo de ld', kind: 'flag' },
  ],
  examples: [
    { id: 'a', label: 'Barra #6 inferior', values: { db: 19.1, fc: 250 * KGCM2, fy: 4200 * KGCM2, spacing: 50, cover: 40, top: 0, stirrups: 1 } },
    { id: 'b', label: 'Barra #8 superior', values: { db: 25.4, fc: 250 * KGCM2, fy: 4200 * KGCM2, spacing: 30, cover: 40, top: 1, stirrups: 0 } },
  ],
  statement: (v, c) => `Calcula la longitud de desarrollo de una barra ${v.db ? barName(v.db) : '…'}${v.top ? ' superior' : ''} en concreto f′c = ${c.q(v.fc ?? NaN, 'stress')} con fy = ${c.q(v.fy ?? NaN, 'stress')}, separación libre ${c.q(v.spacing ?? NaN, 'section')} y recubrimiento libre ${c.q(v.cover ?? NaN, 'section')}. Obtén también la longitud con gancho estándar y la de traslape.`,
  solve(values, context) {
    const input = read(this.fields, values);
    if (!input.ok) return input.outcome;
    const v = input.v;
    const code = designCode(context.code);
    const development = code.developmentLength({
      diameterMm: v.db!, fyMpa: v.fy!, fcMpa: v.fc!, topBar: Boolean(v.top), clearSpacingMm: v.spacing!, clearCoverMm: v.cover!, minimumStirrups: Boolean(v.stirrups),
    });
    const hooked = code.hookedDevelopmentMm(v.db!, v.fy!, v.fc!);
    const splice = code.spliceLengthMm(development);
    return solved({
      steps: [
        {
          title: 'Condición de la barra',
          lines: [
            { note: development.favorable ? 'Separación y recubrimiento cumplen el renglón favorable de la tabla (rl ≥ db y sl ≥ 2db, o sl ≥ db con estribos mínimos).' : 'No se cumple el renglón favorable: se usa el de «otros casos».' },
            { note: v.top ? 'Barra superior: factor por posición 1.3.' : 'Barra inferior: factor por posición 1.0.' },
          ],
        },
        {
          title: `Longitudes según ${code.name}`,
          lines: [
            { formula: 'ld calculada', result: { symbol: 'ld', value: development.computedMm, kind: 'section' } },
            { formula: 'ld ≥ 30 cm', result: { symbol: 'ld', value: development.lengthMm, kind: 'section' } },
            { formula: 'ldh = 0.24 fy / √f′c · db ≥ 8 db y 15 cm', result: { symbol: 'ldh', value: hooked, kind: 'section' } },
            { formula: 'Traslape clase B = 1.3 ld ≥ 30 cm', result: { symbol: 'lt', value: splice, kind: 'section' } },
          ],
        },
      ],
      answers: [
        { symbol: 'ld', label: 'Desarrollo en recto', value: development.lengthMm, kind: 'section' },
        { symbol: 'ldh', label: 'Con gancho estándar', value: hooked, kind: 'section' },
        { symbol: 'lt', label: 'Traslape', value: splice, kind: 'section' },
      ],
      checks: [{ label: 'Referencia', status: 'info', detail: 'Expresiones registradas de la norma.', reference: code.refs.development.label }],
      notes: ['Barras sin recubrimiento epóxico y concreto de peso normal.'],
    });
  },
};
