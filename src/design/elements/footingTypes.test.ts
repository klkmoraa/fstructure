import { describe, expect, it } from 'vitest';
import { designCode } from './codes';
import { designCombinedFooting, type CombinedFootingInput } from './combinedFooting';
import { designStripFooting, type StripFootingInput } from './stripFooting';

const combos = designCode('ntc-2023').loadCombinations('B');

describe('zapata corrida', () => {
  const base: StripFootingInput = {
    code: 'ntc-2023', wallWidthMm: 200, wallMaterial: 'concrete', deadKnPerM: 60, liveKnPerM: 30, combinations: combos,
    allowablePressureKpa: 150, fcMpa: 25, fyMpa: 420, widthMm: null, thicknessMm: 250, coverMm: 75, barDiameterMm: 12.7, distributionBarDiameterMm: 9.5,
  };
  const ok = (result: ReturnType<typeof designStripFooting>) => { if (!result.ok) throw new Error(result.errors.join('; ')); return result; };

  it('dimensiona el ancho con la presión admisible y calcula el voladizo desde el paño', () => {
    const result = ok(designStripFooting(base));
    expect(result.widthMm).toBe(600);
    expect(result.ultimatePressureKpa).toBeCloseTo((1.3 * 60 + 1.5 * 30) / 0.6, 9);
    expect(result.cantileverMm).toBe(200);
    expect(result.momentKnmPerM).toBeCloseTo(result.ultimatePressureKpa * 0.2 ** 2 / 2, 9);
    expect(result.servicePressureKpa).toBeCloseTo(150, 9);
  });

  it('en muro de mampostería lleva la sección crítica a la mitad entre eje y paño', () => {
    const result = ok(designStripFooting({ ...base, wallMaterial: 'masonry' }));
    expect(result.cantileverMm).toBe(250);
  });

  it('busca el peralte que cumple cortante', () => {
    const result = ok(designStripFooting({ ...base, thicknessMm: null, deadKnPerM: 200, liveKnPerM: 100, allowablePressureKpa: 100 }));
    expect(result.checks.find((check) => check.id === 'one-way')!.status).toBe('pass');
    expect(result.effectiveDepthMm).toBeGreaterThanOrEqual(150);
  });
});

describe('zapata combinada', () => {
  const base: CombinedFootingInput = {
    code: 'ntc-2023',
    columns: [{ widthMm: 400, depthMm: 400, deadKn: 500, liveKn: 200 }, { widthMm: 400, depthMm: 400, deadKn: 800, liveKn: 300 }],
    spacingMm: 4000, leftOverhangMm: null, combinations: combos, allowablePressureKpa: 150, fcMpa: 25, fyMpa: 420,
    widthMm: null, thicknessMm: null, coverMm: 75, longitudinalBarMm: 19.1, transverseBarMm: 15.9,
  };
  const ok = (result: ReturnType<typeof designCombinedFooting>) => { if (!result.ok) throw new Error(result.errors.join('; ')); return result; };
  const result = ok(designCombinedFooting(base));

  it('centra la resultante de servicio con el borde al paño de la columna 1', () => {
    const resultant = (700 * 200 + 1100 * 4200) / 1800;
    expect(result.columnAtMm).toEqual([200, 4200]);
    expect(result.lengthMm).toBe(Math.ceil(2 * resultant / 50) * 50);
    expect(Math.abs(result.service.eccentricityMm)).toBeLessThan(25);
    expect(result.service.maximumKpa).toBeLessThanOrEqual(150 + 1e-9);
  });

  it('cumple el equilibrio: cortante y momento nulos en los extremos', () => {
    const last = result.diagram.xMm.length - 1;
    for (const values of [result.diagram.shearMaxKn, result.diagram.shearMinKn]) {
      expect(Math.abs(values[0]!)).toBeLessThan(1e-6);
      expect(Math.abs(values[last]!)).toBeLessThan(1e-6);
    }
    for (const values of [result.diagram.momentMaxKnm, result.diagram.momentMinKnm]) {
      expect(Math.abs(values[last]!)).toBeLessThan(1e-6);
    }
  });

  it('el momento negativo entre columnas coincide con la estática de la viga invertida', () => {
    const pu = [1.3 * 500 + 1.5 * 200, 1.3 * 800 + 1.5 * 300];
    const length = result.lengthMm;
    const center = (pu[0]! * 200 + pu[1]! * 4200) / (pu[0]! + pu[1]!);
    const a = (pu[0]! + pu[1]!) / length;
    const b = 12 * a * (center - length / 2) / length ** 2;
    const moment = (x: number) => (a * x ** 2 / 2 + b * (x ** 3 / 6 - length * x ** 2 / 4) - pu[0]! * Math.max(0, x - 200) - pu[1]! * Math.max(0, x - 4200)) / 1e3;
    let minimum = 0;
    for (let x = 400; x <= 4000; x += 1) minimum = Math.min(minimum, moment(x));
    expect(result.top!.momentKnm).toBeCloseTo(-minimum, 0);
  });

  it('trata la columna 1 al lindero como columna de borde en penetración', () => {
    expect(result.punching[0].sides).toBe(3);
    expect(result.punching[0].alphaS).toBe(30);
    expect(result.punching[1].sides).toBe(4);
  });

  it('con voladizo amplio la columna 1 es interior y la zapata cumple', () => {
    const wide = ok(designCombinedFooting({ ...base, leftOverhangMm: 1000 }));
    expect(wide.punching[0].sides).toBe(4);
    expect(wide.status).not.toBe('fail');
  });

  it('rechaza columnas traslapadas o un voladizo que no cubre la columna', () => {
    expect(designCombinedFooting({ ...base, spacingMm: 300 }).ok).toBe(false);
    expect(designCombinedFooting({ ...base, leftOverhangMm: 100 }).ok).toBe(false);
  });
});
