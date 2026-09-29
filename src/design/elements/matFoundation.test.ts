import { describe, expect, it } from 'vitest';
import { designCode } from './codes';
import { designMatFoundation, type MatFoundationInput } from './matFoundation';

const base: MatFoundationInput = {
  code: 'ntc-2023', spansX: { count: 2, lengthMm: 6000 }, spansY: { count: 2, lengthMm: 5000 }, overhangMm: 600,
  columnWidthMm: 500, columnDepthMm: 500,
  loads: { corner: { deadKn: 300, liveKn: 150 }, edge: { deadKn: 600, liveKn: 300 }, interior: { deadKn: 1200, liveKn: 600 } },
  combinations: designCode('ntc-2023').loadCombinations('B'), allowablePressureKpa: 100, fcMpa: 25, fyMpa: 420, coverMm: 75, barDiameterMm: 19.1, thicknessMm: null,
};

const ok = (result: ReturnType<typeof designMatFoundation>) => {
  if (!result.ok) throw new Error(result.errors.join('; '));
  return result;
};

describe('losa de cimentación (método rígido)', () => {
  const result = ok(designMatFoundation(base));

  it('reparte la carga de servicio uniforme en el área de desplante', () => {
    expect(result.lengthXMm).toBe(13_200);
    expect(result.lengthYMm).toBe(11_200);
    expect(result.columns.filter((column) => column.kind === 'corner')).toHaveLength(4);
    expect(result.columns.filter((column) => column.kind === 'edge')).toHaveLength(4);
    expect(result.service.pressureKpa).toBeCloseTo(7200 / (13.2 * 11.2), 9);
  });

  it('equilibra cada franja: el momento se anula en el borde opuesto', () => {
    for (const strip of [...result.directions.x.strips, ...result.directions.y.strips]) {
      expect(strip.momentKnm.at(-1)).toBeCloseTo(0, 6);
    }
  });

  it('da los momentos de una franja simétrica a mano', () => {
    const pu = 1.3 * 1000 + 1.5 * 500;
    const square = ok(designMatFoundation({ ...base, spansX: { count: 1, lengthMm: 6000 }, spansY: { count: 1, lengthMm: 6000 }, overhangMm: 500,
      loads: { corner: { deadKn: 1000, liveKn: 500 }, edge: { deadKn: 0, liveKn: 0 }, interior: { deadKn: 0, liveKn: 0 } } }));
    const [strip] = square.directions.x.strips;
    expect(strip!.widthMm).toBe(3500);
    expect(strip!.soilFactor).toBeCloseTo(1, 12);
    // w = 2Pu/7000 kN/mm: M(3500) = w·3500²/2 − Pu·3000 = −1250·Pu kN·mm; M(500) = w·500²/2.
    expect(strip!.negativeKnmPerM).toBeCloseTo(1.25 * pu / 3.5, 6);
    expect(Math.max(...strip!.momentKnm)).toBeCloseTo(2 * pu / 7000 * 500 ** 2 / 2 / 1e3, 6);
    const corner = square.punching.find((item) => item.kind === 'corner')!;
    const d = square.effectiveDepthMm;
    if (250 < d / 2) {
      expect(corner.sides).toBe(2);
      expect(corner.alphaS).toBe(20);
      expect(corner.perimeterMm).toBeCloseTo(2 * (500 + 250 + d / 2), 6);
    }
  });

  it('busca el espesor que cumple penetración y cortante', () => {
    for (const check of result.checks.filter((item) => item.id.startsWith('punching') || item.id.startsWith('one-way') || item.id.startsWith('flexure'))) {
      expect(check.status).toBe('pass');
    }
    const thinner = ok(designMatFoundation({ ...base, thicknessMm: result.thicknessMm - 50 }));
    expect(thinner.checks.some((item) => item.status === 'fail')).toBe(true);
  });
});
