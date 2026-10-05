import { describe, expect, it } from 'vitest';
import { BETA_ONE_PLATEAU_LIMIT_MPA, betaOne, equivalentBlockStrengthMpa } from './ntcConcrete2023';

describe('beta1 del bloque equivalente', () => {
  it('vale 0.85 en la meseta y hasta su límite inclusive', () => {
    expect(betaOne(20)).toBeCloseTo(0.85, 12);
    expect(betaOne(BETA_ONE_PLATEAU_LIMIT_MPA)).toBeCloseTo(0.85, 12);
  });

  it('es continua en el cambio de régimen', () => {
    // Única comprobación que fija el umbral: la rama decreciente vale
    // exactamente 0.85 en 28 MPa, así que cualquier otro corte introduce un
    // salto. Un umbral en 30 dejaba una meseta insegura en 28 < f'c <= 30.
    const limit = BETA_ONE_PLATEAU_LIMIT_MPA;
    expect(1.05 - limit / 140).toBeCloseTo(0.85, 12);
    expect(betaOne(limit + 1e-9)).toBeCloseTo(betaOne(limit), 9);
  });

  it('decrece de forma monótona sobre la meseta y respeta el piso de 0.65', () => {
    expect(betaOne(30)).toBeCloseTo(1.05 - 30 / 140, 12);
    expect(betaOne(30)).toBeLessThan(0.85);
    expect(betaOne(35)).toBeLessThan(betaOne(30));
    expect(betaOne(60)).toBeCloseTo(0.65, 12);
    expect(betaOne(100)).toBeCloseTo(0.65, 12);
  });

  it('mantiene la intensidad del bloque proporcional a la resistencia', () => {
    expect(equivalentBlockStrengthMpa(30)).toBeCloseTo(25.5, 12);
  });
});
