// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { designCode } from '../../../design/elements/codes';
import { designMatFoundation, type MatFoundationInput } from '../../../design/elements/matFoundation';
import { designStrapFooting, type StrapFootingInput } from '../../../design/elements/strapFooting';
import { MatStripDiagram, StrapDiagrams, freeBodyBalance, matStripFreeBody, strapFreeBody } from './FoundationDrawings';

afterEach(cleanup);

const ok = <T,>(result: T | { ok: false; errors: readonly string[] }): T => {
  if ((result as { ok: boolean }).ok === false) throw new Error((result as { errors: readonly string[] }).errors.join('; '));
  return result as T;
};

describe('DCL de la zapata de lindero', () => {
  // Caso de referencia: P1 = 640 kN, P2 = 1 160 kN, L = 5 m y e = B1/2 − c1/2 = 1.2 − 0.2 = 1 m:
  // R1 = P1·L/(L − e) = 640·5/4 = 800 kN y R2 = P2 − P1·e/(L − e) = 1 160 − 160 = 1 000 kN.
  const input: StrapFootingInput = {
    code: 'ntc-2023',
    exterior: { widthMm: 400, depthMm: 400, deadKn: 640, liveKn: 0 },
    interior: { widthMm: 400, depthMm: 400, deadKn: 1160, liveKn: 0 },
    spacingMm: 5000, combinations: designCode('ntc-2023').loadCombinations('B'), allowablePressureKpa: 150, fcMpa: 25, fyMpa: 420,
    coverMm: 75, exteriorLengthMm: 2400, thicknessMm: null, barDiameterMm: 15.9,
    strap: { widthMm: null, heightMm: null, barDiameterMm: 15.9, stirrupDiameterMm: 9.5 },
  };
  const result = ok(designStrapFooting(input));

  it('da R1 = 800 kN y R2 = 1 000 kN de servicio', () => {
    expect(result.eccentricityMm).toBe(1000);
    expect(result.reactions.service.exteriorKn).toBeCloseTo(800, 9);
    expect(result.reactions.service.interiorKn).toBeCloseTo(1000, 9);
  });

  it('el DCL último está en equilibrio de fuerzas y de momentos', () => {
    const body = strapFreeBody(result);
    const { downKn, upKn } = freeBodyBalance(body);
    expect(upKn).toBeCloseTo(downKn, 9);
    // Momentos respecto al eje de la columna 2: la reacción repartida R1u actúa en B1/2.
    const p1 = body.loads[0]!;
    const r1u = body.soil.knPerM * (body.soil.toM - body.soil.fromM);
    const centroid = (body.soil.fromM + body.soil.toM) / 2;
    expect(r1u * (body.lengthM - centroid)).toBeCloseTo(p1.kn * (body.lengthM - p1.xM), 9);
    // Con sólo carga muerta, la combinación factoriza igual a P1 y a P2: R1u/R2u = 800/1 000.
    expect(r1u / body.reactions[0]!.kn).toBeCloseTo(0.8, 9);
  });

  it('dibuja cargas, reacciones y el balance', () => {
    render(<StrapDiagrams result={result} />);
    const body = strapFreeBody(result);
    expect(screen.getByText(`P1u = ${Math.round(body.loads[0]!.kn).toLocaleString('es-MX')} kN`)).toBeTruthy();
    expect(screen.getByText(/^R2u = /)).toBeTruthy();
    expect(screen.getByText(/^R1u = .* kN\/m$/)).toBeTruthy();
    expect(screen.getByText(/^ΣFy = 0/)).toBeTruthy();
  });
});

describe('DCL de la franja de la losa de cimentación', () => {
  const base: MatFoundationInput = {
    code: 'ntc-2023', spansX: { count: 2, lengthMm: 6000 }, spansY: { count: 2, lengthMm: 5000 }, overhangMm: 600,
    columnWidthMm: 500, columnDepthMm: 500,
    loads: { corner: { deadKn: 300, liveKn: 150 }, edge: { deadKn: 600, liveKn: 300 }, interior: { deadKn: 1200, liveKn: 600 } },
    combinations: designCode('ntc-2023').loadCombinations('B'), allowablePressureKpa: 100, fcMpa: 25, fyMpa: 420, coverMm: 75, barDiameterMm: 19.1, thicknessMm: null,
  };
  const result = ok(designMatFoundation(base));

  it('con 2 × 2 claros lleva tres columnas a la franja y queda en equilibrio', () => {
    const body = matStripFreeBody(result);
    expect(body.loads).toHaveLength(3);
    const { downKn, upKn } = freeBodyBalance(body);
    expect(upKn).toBeCloseTo(downKn, 9);
    // Es el mismo cuerpo libre que da los momentos: el momento se anula en el borde opuesto.
    const strip = result.directions.x.strips.find((item) => item.momentKnm.length && Math.max(item.positiveKnmPerM, item.negativeKnmPerM) === Math.max(...result.directions.x.strips.map((each) => Math.max(each.positiveKnmPerM, each.negativeKnmPerM))))!;
    const momentAtEnd = body.soil.knPerM * body.lengthM ** 2 / 2 - body.loads.reduce((sum, load) => sum + load.kn * (body.lengthM - load.xM), 0);
    expect(momentAtEnd).toBeCloseTo(0, 6);
    expect(strip.momentKnm.at(-1)).toBeCloseTo(0, 6);
  });

  it('dibuja la reacción por metro y el balance', () => {
    render(<MatStripDiagram result={result} />);
    expect(screen.getAllByText(/^P\du = /)).toHaveLength(3);
    expect(screen.getByText(/^q = .* kN\/m$/)).toBeTruthy();
    expect(screen.getByText(/^ΣFy = 0/)).toBeTruthy();
  });
});
