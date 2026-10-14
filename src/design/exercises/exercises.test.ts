import { describe, expect, it } from 'vitest';
import { designCode } from '../elements/codes';
import { requiredFlexuralSteelMm2 } from '../elements/shared';
import { EXERCISE_TOPICS } from './catalog';
import { context } from './common';
import { developmentLength } from './anchorage';
import { cantileverBeam, simpleBeam } from './beams';
import { columnAxial, columnInteraction } from './column';
import { doublyReinforcedCheck, rectangularCheck, rectangularDesign, rectangularSizing, tBeamCheck } from './flexure';
import { isolatedFooting } from './footing';
import { shearCheck, shearDesign } from './shear';
import type { ExerciseOutcome, ExerciseProblem, ExerciseValues } from './types';
import { formatQuantity, fromDisplay, toDisplay } from './units';

const ntc = context('ntc-2023', 'si');
const solve = (problem: ExerciseProblem, values: ExerciseValues) => {
  const outcome = problem.solve(values, ntc);
  if (outcome.status !== 'solved') throw new Error(JSON.stringify(outcome));
  return outcome.solution;
};
const answer = (problem: ExerciseProblem, values: ExerciseValues, symbol: string) => {
  const found = solve(problem, values).answers.find((item) => item.symbol === symbol);
  if (!found) throw new Error(`Sin respuesta ${symbol}`);
  return found.value;
};

describe('unidades de los ejercicios', () => {
  it('convierte kg/cm², t y t·m ida y vuelta', () => {
    expect(toDisplay('kgf', 'stress', 24.516625)).toBeCloseTo(250, 6);
    expect(fromDisplay('kgf', 'moment', 25)).toBeCloseTo(245.16625, 6);
    expect(formatQuantity('kgf', 'section', 300)).toBe('30 cm');
    expect(formatQuantity('si', 'area', 1520.5)).toBe('1,521 mm²');
  });
});

describe('flexión', () => {
  const base = { b: 300, h: 600, d: 550, fc: 25, fy: 420 };

  it('revisa una viga simplemente armada (3 Ø25.4, f′c 25, fy 420)', () => {
    // As = 1520.1; a = 1520.1·420/(21.25·300) = 100.15; Mn = As fy (d − a/2) = 319.17 kN·m; FR = 0.9.
    const mr = answer(rectangularCheck, { ...base, n: 3, db: 25.4 }, 'MR');
    expect(mr).toBeCloseTo(0.9 * 1520.1 * 420 * (550 - 100.15 / 2) / 1e6, 0);
  });

  it('usa compatibilidad cuando el acero no fluye', () => {
    const solution = solve(rectangularCheck, { b: 200, h: 400, d: 350, n: 6, db: 25.4, fc: 20, fy: 420 });
    expect(solution.checks.find((check) => check.label === 'Fluencia del acero')?.status).toBe('fail');
    const c = solution.answers.find((item) => item.symbol === 'c')!.value;
    const As = 6 * Math.PI * 25.4 ** 2 / 4;
    // Equilibrio: f″c b β1 c = As Es 0.003 (d − c)/c.
    expect(0.85 * 20 * 200 * 0.85 * c).toBeCloseTo(As * 200_000 * 0.003 * (350 - c) / c, 0);
  });

  it('calcula As para Mu como el motor del taller', () => {
    const as = answer(rectangularDesign, { mu: 250, ...base }, 'As');
    // Forma cerrada: q = 1 − √(1 − 2·0.14405) = 0.15626; As = q f″c/fy · b d = 1304.5 mm².
    expect(as).toBeCloseTo(1304.5, 0);
    expect(as).toBeCloseTo(requiredFlexuralSteelMm2(250, 300, 550, 420, 25)!, 0);
  });

  it('propone barras que caben en un lecho', () => {
    const solution = solve(rectangularDesign, { mu: 250, ...base });
    const proposal = solution.answers.find((item) => item.symbol === 'Armado')!;
    const count = Number(proposal.text!.split(' ')[0]);
    const diameter = Number(/Ø ([\d.]+)/.exec(proposal.text!)![1]);
    expect(2 * 49.5 + count * diameter + (count - 1) * Math.max(25, diameter, 28.5)).toBeLessThanOrEqual(300);
  });

  it('avisa cuando la sección no alcanza', () => {
    const solution = solve(rectangularDesign, { mu: 2000, ...base });
    expect(solution.checks[0]?.status).toBe('fail');
    expect(solution.answers).toHaveLength(0);
  });

  it('dimensiona b y h y la sección resultante resiste Mu', () => {
    const values = { mu: 245, fc: 24.5, fy: 412, k: 0.4, lambda: 0.5, r: 50 };
    const solution = solve(rectangularSizing, values);
    const b = solution.answers.find((item) => item.symbol === 'b')!.value;
    const h = solution.answers.find((item) => item.symbol === 'h')!.value;
    expect(b % 50).toBe(0);
    expect(h % 50).toBe(0);
    expect(requiredFlexuralSteelMm2(245, b, h - 50, 412, 24.5)).toBeDefined();
  });

  it('doblemente armada: con acero de compresión el momento crece', () => {
    const values = { b: 300, h: 600, d: 530, dp: 50, n: 6, db: 25.4, np: 2, dbp: 19.1, fc: 25, fy: 420 };
    const solution = solve(doublyReinforcedCheck, values);
    const mr = solution.answers.find((item) => item.symbol === 'MR')!.value;
    // Equilibrio de fuerzas en la solución.
    const fsp = solution.answers.find((item) => item.symbol === 'f′s')!.value;
    expect(Math.abs(fsp)).toBeLessThanOrEqual(420 + 1e-9);
    expect(mr).toBeGreaterThan(0);
    expect(mr).toBeLessThan(0.9 * 6 * Math.PI * 25.4 ** 2 / 4 * 420 * 530 / 1e6);
  });

  it('viga T: dentro del patín coincide con la rectangular de ancho b', () => {
    const t = answer(tBeamCheck, { bf: 1000, hf: 120, bw: 300, h: 600, d: 540, n: 4, db: 22.2, fc: 25, fy: 420 }, 'MR');
    const rect = answer(rectangularCheck, { b: 1000, h: 600, d: 540, n: 4, db: 22.2, fc: 25, fy: 420 }, 'MR');
    expect(t).toBeCloseTo(rect, 6);
  });

  it('viga T: con el bloque en el alma usa Cf + Cw', () => {
    const v = { bf: 750, hf: 100, bw: 250, h: 600, d: 530, n: 6, db: 25.4, fc: 20, fy: 420 };
    const As = 6 * Math.PI * 25.4 ** 2 / 4;
    const Cf = 17 * (750 - 250) * 100;
    const a = (As * 420 - Cf) / (17 * 250);
    const mn = (Cf * (530 - 50) + (As * 420 - Cf) * (530 - a / 2)) / 1e6;
    const solution = solve(tBeamCheck, v);
    const factor = 0.9;
    expect(solution.answers[0]!.value).toBeCloseTo(factor * mn, 0);
  });
});

describe('cortante', () => {
  const values = { vu: 200, b: 300, d: 550, fc: 25, fy: 420, ds: 9.5, legs: 2 };
  it('calcula la separación (Vs = 126.4 kN → s = 259 mm → 250 mm)', () => {
    expect(answer(shearDesign, values, 's')).toBe(250);
  });
  it('la resistencia con esa separación cubre Vu', () => {
    expect(answer(shearCheck, { ...values, s: 250 }, 'VR')).toBeGreaterThanOrEqual(200);
    // VR = 0.75 (0.17·5·300·550 + 2·70.88·420·550/250) = 0.75 (140250 + 130,987) N.
    expect(answer(shearCheck, { ...values, s: 250 }, 'VR')).toBeCloseTo(0.75 * (140_250 + 2 * Math.PI * 9.5 ** 2 / 4 * 420 * 550 / 250) / 1e3, 3);
  });
  it('rechaza un cortante mayor que el de la sección', () => {
    const solution = solve(shearDesign, { ...values, vu: 900 });
    expect(solution.checks[0]?.status).toBe('fail');
  });
});

describe('columnas', () => {
  it('P0 = f″c (Ag − As) + As fy', () => {
    const As = 8 * Math.PI * 25.4 ** 2 / 4;
    const p0 = answer(columnAxial, { b: 400, h: 400, n: 8, db: 25.4, fc: 25, fy: 420 }, 'P0');
    expect(p0).toBeCloseTo((21.25 * (160_000 - As) + 420 * As) / 1e3, 6);
    expect(answer(columnAxial, { b: 400, h: 400, n: 8, db: 25.4, fc: 25, fy: 420 }, 'PR')).toBeCloseTo(designCode('ntc-2023').compressionFactor * p0, 6);
  });
  it('un punto pequeño queda dentro del diagrama y uno grande fuera', () => {
    const base = { b: 400, h: 500, r: 60, n: 3, db: 25.4, fc: 25, fy: 420 };
    expect(solve(columnInteraction, { ...base, pu: 500, mu: 100 }).checks[0]?.status).toBe('pass');
    expect(solve(columnInteraction, { ...base, pu: 3000, mu: 500 }).checks[0]?.status).toBe('fail');
  });
});

describe('zapata aislada', () => {
  it('el lado da la presión admisible y el peralte cumple penetración con el mínimo', () => {
    const values = { p: 1000, pu: 1400, qa: 200, w: 10, c: 400, fc: 25, fy: 420, r: 75 };
    const solution = solve(isolatedFooting, values);
    const side = solution.answers.find((item) => item.symbol === 'B')!.value;
    expect(side).toBe(2350);
    expect(solution.checks.every((check) => check.status !== 'fail')).toBe(true);
  });
});

describe('anclaje', () => {
  it('devuelve ld ≥ 30 cm, gancho y traslape clase B', () => {
    const values = { db: 19.1, fc: 25, fy: 420, spacing: 50, cover: 40, top: 0, stirrups: 1 };
    const ld = answer(developmentLength, values, 'ld');
    expect(ld).toBeGreaterThanOrEqual(300);
    expect(answer(developmentLength, values, 'lt')).toBeGreaterThanOrEqual(300);
    expect(answer(developmentLength, values, 'ldh')).toBeGreaterThanOrEqual(150);
  });
});

describe('vigas isostáticas', () => {
  it('viga simple con w: R = wL/2, M = wL²/8, Δ = 5wL⁴/384EI', () => {
    const solution = solve(simpleBeam, { L: 6, w: 10, b: 300, h: 600, fc: 25 });
    expect(solution.answers.find((item) => item.symbol === 'RA')!.value).toBeCloseTo(30, 9);
    expect(solution.answers.find((item) => item.symbol === 'Mmáx')!.value).toBeCloseTo(45, 6);
    const e = designCode('ntc-2023').elasticModulusMpa(25);
    const i = 300 * 600 ** 3 / 12;
    expect(solution.answers.find((item) => item.symbol === 'Δmáx')!.value).toBeCloseTo(5 * 10 * 6000 ** 4 / (384 * e * i), 3);
  });
  it('viga simple con P en el centro: M = PL/4', () => {
    expect(answer(simpleBeam, { L: 4, w: 0, P: 20, a: 2 }, 'Mmáx')).toBeCloseTo(20, 9);
  });
  it('voladizo: M = −(wL²/2 + Pa) y Δ = wL⁴/8EI + PL³/3EI', () => {
    const solution = solve(cantileverBeam, { L: 2, w: 10, P: 5, a: 2, b: 250, h: 500, fc: 25 });
    expect(solution.answers.find((item) => item.symbol === 'M')!.value).toBeCloseTo(-30, 9);
    const e = designCode('ntc-2023').elasticModulusMpa(25);
    const ei = e * 250 * 500 ** 3 / 12;
    expect(solution.answers.find((item) => item.symbol === 'Δmáx')!.value).toBeCloseTo(10 * 2000 ** 4 / (8 * ei) + 5000 * 2000 ** 3 / (3 * ei), 3);
  });
});

describe('catálogo', () => {
  it('cada ejemplo de cada tema se resuelve en las tres normas y en ambos sistemas', () => {
    for (const topic of EXERCISE_TOPICS) {
      for (const problem of topic.problems) {
        for (const example of problem.examples) {
          for (const code of ['ntc-2023', 'nsr-10', 'e060'] as const) {
            for (const units of ['kgf', 'si'] as const) {
              const outcome: ExerciseOutcome = problem.solve(example.values, context(code, units));
              expect(outcome.status, `${problem.id}/${example.id}/${code}`).toBe('solved');
              expect(problem.statement(example.values, context(code, units))).not.toContain('NaN');
            }
          }
        }
      }
    }
  });
  it('pide los datos que faltan', () => {
    expect(rectangularCheck.solve({}, ntc)).toMatchObject({ status: 'missing' });
  });
});
