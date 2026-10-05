import { describe, expect, it } from 'vitest';
import { designSectionStudio, proposeSectionReinforcement, type SectionStudioInput, type SectionStudioSuccess } from './sectionStudio';

const base: SectionStudioInput = {
  shape: 'square', widthMm: 400, heightMm: 400, coverMm: 40,
  fcMpa: 30, fyMpa: 420, barDiameterMm: 20, barCount: 8,
  tieDiameterMm: 10, tieSpacingMm: 150, tieType: 'closed', lengthM: 3,
  axialKn: 400, momentKnm: 50, shearKn: 0, angleDeg: 0,
  philosophy: 'ultimate', phi: 0.65, gammaConcrete: 1.5, gammaSteel: 1.15,
  allowableConcreteRatio: 0.45, allowableSteelRatio: 0.6,
};

function ok(input: Partial<SectionStudioInput> = {}): SectionStudioSuccess {
  const result = designSectionStudio({ ...base, ...input });
  expect(result.status).toBe('ok');
  if (result.status !== 'ok') throw new Error(result.errors.join('\n'));
  return result;
}

// Independent fibre quadrature: intersect each horizontal strip with edges rather than clipping a polygon.
function independentStrengthFibres(result: SectionStudioSuccess) {
  const angle = result.input.angleDeg * Math.PI / 180;
  const sin = Math.sin(angle); const cos = Math.cos(angle);
  const side = result.analysis.curvaturePerMm >= 0 ? 1 : -1;
  const project = (point: { x: number; y: number }) => ({ u: side * (point.x * sin + point.y * cos), t: point.x * cos - point.y * sin });
  const vertices = result.geometry.vertices.map(project);
  const maxU = Math.max(...vertices.map((point) => point.u));
  const beta = Math.max(0.65, result.input.fcMpa <= 28 ? 0.85 : 1.05 - result.input.fcMpa / 140);
  const threshold = maxU - beta * result.analysis.neutralAxisDepthMm!;
  const blockStress = 0.85 * result.effective.fcMpa;
  let n = 0; let m = 0; let orthogonal = 0;
  const integrate = (from: number, to: number, widthAndCenter: (u: number) => [number, number], sign: number) => {
    for (let u = from; u < to; u += 0.025) {
      const increment = Math.min(0.025, to - u);
      const center = u + increment / 2;
      const [width, t] = widthAndCenter(center);
      const force = sign * blockStress * width * increment;
      n += force; m += force * side * center; orthogonal += force * t;
    }
  };
  integrate(threshold, maxU, (u) => {
    const crossings: number[] = [];
    for (let i = 0; i < vertices.length; i += 1) {
      const a = vertices[i]; const b = vertices[(i + 1) % vertices.length];
      if ((a.u < u && b.u >= u) || (b.u < u && a.u >= u)) crossings.push(a.t + (b.t - a.t) * (u - a.u) / (b.u - a.u));
    }
    if (crossings.length < 2) return [0, 0];
    const min = Math.min(...crossings); const max = Math.max(...crossings);
    return [max - min, (min + max) / 2];
  }, 1);
  const radius = result.input.barDiameterMm / 2;
  const area = Math.PI * radius ** 2;
  for (const bar of result.geometry.bars) {
    const { u, t } = project(bar);
    const strain = result.analysis.strainAtCentroid + result.analysis.curvaturePerMm * side * u;
    const force = area * Math.max(-result.effective.fyMpa, Math.min(result.effective.fyMpa, 200_000 * strain));
    n += force; m += force * side * u; orthogonal += force * t;
    integrate(Math.max(threshold, u - radius), u + radius, (center) => [2 * Math.sqrt(Math.max(0, radius ** 2 - (center - u) ** 2)), t], -1);
  }
  const phi = result.effective.resistanceFactor;
  return { axialKn: n * phi / 1000, momentKnm: m * phi / 1e6, orthogonalMomentKnm: orthogonal * phi / 1e6 };
}

describe('Section Studio: geometría e integración independiente', () => {
  it('reproduce área e inercias analíticas de rectángulo y círculo', () => {
    const rect = ok({ shape: 'rectangle', widthMm: 300, heightMm: 500 });
    expect(rect.geometry.areaMm2).toBeCloseTo(150_000, 7);
    expect(rect.geometry.inertiaXmm4).toBeCloseTo(300 * 500 ** 3 / 12, 3);
    expect(rect.geometry.inertiaYmm4).toBeCloseTo(500 * 300 ** 3 / 12, 3);
    const circle = ok({ shape: 'circle' });
    expect(circle.geometry.areaMm2).toBeCloseTo(Math.PI * 200 ** 2, 7);
    expect(circle.geometry.inertiaXmm4).toBeCloseTo(Math.PI * 200 ** 4 / 4, 3);
  });

  it('reproduce área y centroide triangular con su altura efectiva', () => {
    const result = ok({ shape: 'triangle', widthMm: 500, heightMm: 600, barCount: 6 });
    expect(result.geometry.areaMm2).toBeCloseTo(150_000, 6);
    expect(result.geometry.inertiaXmm4).toBeCloseTo(500 * 600 ** 3 / 36, 3);
    expect(result.geometry.inertiaYmm4).toBeCloseTo(600 * 500 ** 3 / 48, 3);
    expect(result.geometry.vertices.reduce((sum, p) => sum + p.y, 0)).toBeCloseTo(0);
  });

  it('recubre barras y estribos usando distancia normal real a los lados del triángulo', () => {
    const result = ok({ shape: 'triangle', widthMm: 500, heightMm: 600, barCount: 6 });
    const vertices = result.geometry.vertices;
    for (const bar of result.geometry.bars) {
      for (let i = 0; i < vertices.length; i += 1) {
        const a = vertices[i]; const b = vertices[(i + 1) % vertices.length];
        const distance = ((b.x - a.x) * (bar.y - a.y) - (b.y - a.y) * (bar.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y);
        expect(distance).toBeGreaterThanOrEqual(40 + 10 + 10 - 1e-7);
      }
    }
  });

  it('rechaza dimensiones no finitas, estribos solapados y barras fuera del núcleo', () => {
    expect(designSectionStudio({ ...base, widthMm: NaN }).status).toBe('invalid');
    expect(designSectionStudio({ ...base, coverMm: 200 }).status).toBe('invalid');
    expect(designSectionStudio({ ...base, barCount: 120, barDiameterMm: 40 }).status).toBe('invalid');
    expect(designSectionStudio({ ...base, tieType: 'spiral' }).status).toBe('invalid');
    expect(designSectionStudio({ ...base, philosophy: 'limit-state', gammaConcrete: 0.01, gammaSteel: 0.01 }).status).toBe('invalid');
  });
});

describe('Section Studio: resistencia y equilibrio', () => {
  it('reproduce P0 con concreto desplazado, φ configurable y tracción sólo acero', () => {
    const result = ok();
    const as = 8 * Math.PI * 20 ** 2 / 4;
    const p0 = (0.85 * 30 * (400 ** 2 - as) + 420 * as) / 1000;
    expect(result.capacity.axialCompressionKn).toBeCloseTo(0.65 * p0, 5);
    expect(result.capacity.axialTensionKn).toBeCloseTo(-0.65 * 420 * as / 1000, 5);
    expect(ok({ phi: 0.9 }).capacity.axialCompressionKn / result.capacity.axialCompressionKn).toBeCloseTo(0.9 / 0.65, 9);
  });

  it('mantiene los factores parciales separados de φ', () => {
    const result = ok({ philosophy: 'limit-state', phi: 0.1 });
    const as = 8 * Math.PI * 20 ** 2 / 4;
    expect(result.effective.resistanceFactor).toBe(1);
    expect(result.capacity.axialCompressionKn).toBeCloseTo((0.85 * 30 / 1.5 * (400 ** 2 - as) + 420 / 1.15 * as) / 1000, 5);
  });

  it('respeta signo de flexión y simetría de secciones simétricas', () => {
    const pos = ok({ axialKn: 0, momentKnm: 120 });
    const neg = ok({ axialKn: 0, momentKnm: -120 });
    expect(pos.capacity.positiveMomentKnm).toBeCloseTo(-pos.capacity.negativeMomentKnm, 4);
    expect(pos.utilization).toBeCloseTo(neg.utilization, 5);
    expect(pos.capacity.point?.momentKnm).toBeGreaterThan(0);
    expect(neg.capacity.point?.momentKnm).toBeLessThan(0);
    expect(pos.analysis.compressionPolygon.every((p) => p.y > 0)).toBe(true);
    expect(neg.analysis.compressionPolygon.every((p) => p.y < 0)).toBe(true);
  });

  it('conserva asimetría real triangular y lechos superior/inferior', () => {
    const triangle = ok({ shape: 'triangle', widthMm: 500, heightMm: 600, barCount: 6, axialKn: 0 });
    expect(Math.abs(triangle.capacity.positiveMomentKnm + triangle.capacity.negativeMomentKnm)).toBeGreaterThan(1);
    const beam = ok({ shape: 'rectangle', widthMm: 300, heightMm: 550, barLayout: 'layers', topBarCount: 2, bottomBarCount: 5 });
    expect(beam.reinforcement.barCount).toBe(7);
    expect(beam.geometry.bars.filter((p) => p.y < 0)).toHaveLength(5);
    expect(beam.capacity.positiveMomentKnm).toBeGreaterThan(-beam.capacity.negativeMomentKnm);
  });

  it('conserva jaulas simétricas de polígonos en sus ejes principales', () => {
    for (const [shape, barCount] of [['triangle', 6], ['hexagon', 6], ['octagon', 8], ['rectangle', 8]] as const) {
      const result = ok({ shape, widthMm: 500, heightMm: 600, barCount, axialKn: 300, momentKnm: 70, angleDeg: 0 });
      expect(result.directionalOnly).toBe(false);
      expect(result.analysis.orthogonalMomentKnm).toBeCloseTo(0, 6);
      for (const bar of result.geometry.bars) expect(result.geometry.bars.some((other) => Math.abs(bar.x + other.x) < 1e-7 && Math.abs(bar.y - other.y) < 1e-7)).toBe(true);
    }
    const proposal = proposeSectionReinforcement({ ...base, shape: 'triangle', widthMm: 500, heightMm: 600, barCount: 6, axialKn: 300, momentKnm: 70 });
    expect(proposal.status).toBe('proposed');
    if (proposal.status === 'proposed') expect(proposal.result.directionalOnly).toBe(false);
  });

  it('expone momento perpendicular para eje impuesto en sección no simétrica', () => {
    const triangle = ok({ shape: 'triangle', widthMm: 500, heightMm: 600, barCount: 6, angleDeg: 35, axialKn: 300, momentKnm: 70, philosophy: 'allowable' });
    expect(Math.abs(triangle.analysis.orthogonalMomentKnm)).toBeGreaterThan(1);
    expect(triangle.limitations.some((line) => line.includes('momento perpendicular'))).toBe(true);
    expect(triangle.directionalOnly).toBe(true);
    expect(ok({ angleDeg: 0 }).analysis.orthogonalMomentKnm).toBeCloseTo(0, 7);
    const rectangle = ok({ shape: 'rectangle', widthMm: 300, heightMm: 550, barLayout: 'layers', topBarCount: 2, bottomBarCount: 5, angleDeg: 25, philosophy: 'allowable' });
    expect(Math.abs(rectangle.analysis.orthogonalMomentKnm)).toBeGreaterThan(1);
  });

  it('refina el punto gobernante N–M sin inconsistencias entre deformación, bloque y capacidad', () => {
    for (const axialKn of [800, 0]) {
      const result = ok({ shape: 'rectangle', widthMm: 300, heightMm: 550, coverMm: 30, barLayout: 'layers', topBarCount: 2, bottomBarCount: 4, phi: 0.75, axialKn, momentKnm: 80 });
      const fibres = independentStrengthFibres(result);
      expect(result.capacity.point!.axialKn).toBeCloseTo(fibres.axialKn, 1);
      expect(result.capacity.point!.momentKnm).toBeCloseTo(fibres.momentKnm, 2);
      expect(result.analysis.equilibriumAxialKn).toBeCloseTo(fibres.axialKn, 1);
      expect(result.analysis.equilibriumMomentKnm).toBeCloseTo(fibres.momentKnm, 2);
      expect(result.capacity.point!.axialKn * 80 - result.capacity.point!.momentKnm * axialKn).toBeCloseTo(0, 4);
    }
  });

  it('integra fuerza y los dos momentos triangulares contra fibras independientes a 35°', () => {
    const result = ok({ shape: 'triangle', widthMm: 500, heightMm: 600, barCount: 6, angleDeg: 35, axialKn: 300, momentKnm: 70 });
    const fibres = independentStrengthFibres(result);
    expect(result.capacity.point!.axialKn).toBeCloseTo(fibres.axialKn, 1);
    expect(result.capacity.point!.momentKnm).toBeCloseTo(fibres.momentKnm, 2);
    expect(result.capacity.point!.orthogonalMomentKnm).toBeCloseTo(fibres.orthogonalMomentKnm, 2);
    expect(result.directionalOnly).toBe(true);
  });

  it('resuelve cero demanda, tracción axial y puntos fuera de capacidad sin NaN', () => {
    expect(ok({ axialKn: 0, momentKnm: 0 }).utilization).toBe(0);
    const tension = ok({ axialKn: -200, momentKnm: 0 });
    expect(tension.utilization).toBeGreaterThan(0);
    expect(tension.capacity.point?.axialKn).toBeLessThan(0);
    expect(ok({ axialKn: -5000, momentKnm: 0 }).utilization).toBeGreaterThan(1);
  });

  it('integra bloque circular parcial contra cuadratura independiente por fibras', () => {
    const result = ok({ shape: 'circle', phi: 1, axialKn: 0, momentKnm: 100 });
    const sample = result.interaction.find((p) => p.neutralAxisDepthMm !== null && p.neutralAxisDepthMm > 170 && p.neutralAxisDepthMm < 190 && p.momentKnm > 0);
    expect(sample).toBeDefined();
    const c = sample!.neutralAxisDepthMm!; const beta = 0.85 - 0.05 * (30 - 28) / 7;
    const threshold = 200 - beta * c;
    const step = 0.05; let n = 0; let m = 0;
    for (let y = threshold + step / 2; y < 200; y += step) {
      const force = 0.85 * 30 * 2 * Math.sqrt(Math.max(0, 200 ** 2 - y ** 2)) * step;
      n += force; m += force * y;
    }
    for (const bar of result.geometry.bars) {
      const strain = 0.003 * (1 - (200 - bar.y) / c);
      const steelStress = Math.max(-420, Math.min(420, strain * 200_000));
      const as = Math.PI * 20 ** 2 / 4;
      n += steelStress * as; m += steelStress * as * bar.y;
      // Independent midpoint integral over each displaced compression disk.
      for (let y = Math.max(threshold, bar.y - 10) + step / 2; y < bar.y + 10; y += step) {
        const force = 25.5 * 2 * Math.sqrt(Math.max(0, 10 ** 2 - (y - bar.y) ** 2)) * step;
        n -= force; m -= force * y;
      }
    }
    expect(sample!.axialKn).toBeCloseTo(n / 1000, 1);
    expect(sample!.momentKnm).toBeCloseTo(m / 1e6, 2);
  });
});

describe('Section Studio: esfuerzos admisibles y cuantificación', () => {
  it('resuelve compresión uniforme con sección transformada y factor modular', () => {
    const result = ok({ philosophy: 'allowable', axialKn: 500, momentKnm: 0 });
    const ec = 4700 * Math.sqrt(30); const as = result.reinforcement.steelAreaMm2;
    const strain = 500_000 / (ec * (160_000 - as) + 200_000 * as);
    expect(result.analysis.maxConcreteStressMpa).toBeCloseTo(ec * strain, 6);
    expect(result.analysis.maxSteelStressMpa).toBeCloseTo(200_000 * strain, 6);
  });

  it('resuelve flexión fisurada con equilibrio N=0 y M aplicado, sin concreto a tensión', () => {
    const result = ok({ philosophy: 'allowable', axialKn: 0, momentKnm: 80 });
    expect(result.analysis.model).toContain('fisurada');
    expect(result.analysis.equilibriumAxialKn).toBeCloseTo(0, 5);
    expect(result.analysis.equilibriumMomentKnm).toBeCloseTo(80, 5);
    expect(result.analysis.neutralAxisDepthMm).toBeGreaterThan(0);
    expect(result.analysis.neutralAxisDepthMm).toBeLessThan(400);
    expect(result.analysis.minConcreteStressMpa).toBe(0);
  });

  it('resuelve tracción uniforme sin concreto resistente', () => {
    const result = ok({ philosophy: 'allowable', axialKn: -100, momentKnm: 0 });
    expect(result.analysis.maxConcreteStressMpa).toBe(0);
    expect(result.analysis.maxSteelStressMpa).toBeCloseTo(100_000 / result.reinforcement.steelAreaMm2, 5);
  });

  it('cierra cantidades y refleja pitch, ganchos estimados y crossties', () => {
    const result = ok();
    expect(result.quantities.tieCount).toBe(21);
    expect(result.quantities.longitudinalSteelKg).toBeCloseTo(result.reinforcement.steelAreaMm2 * 3 * 0.00785, 6);
    expect(result.quantities.totalSteelKg).toBeCloseTo(result.quantities.longitudinalSteelKg + result.quantities.tieSteelKg, 6);
    expect(result.quantities.concreteM3).toBeCloseTo(0.48, 6);
    expect(result.quantities.netConcreteM3).toBeCloseTo(0.48 - result.quantities.totalSteelKg / 7850, 6);
    expect(ok({ tieType: 'cross-tie' }).quantities.tieSteelKg).toBeGreaterThan(result.quantities.tieSteelKg);
    expect(ok({ tieType: 'cross-tie' }).geometry.tieCrossLines).toHaveLength(2);
    expect(ok({ shape: 'circle', tieType: 'spiral' }).quantities.tieSteelKg).toBeGreaterThan(0);
  });

  it('no propone una verificación escalar para una demanda acoplada fuera del eje', () => {
    const proposal = proposeSectionReinforcement({ ...base, shape: 'rectangle', widthMm: 300, heightMm: 550, coverMm: 30, barLayout: 'layers', topBarCount: 2, bottomBarCount: 4, axialKn: 400, momentKnm: 50, angleDeg: 45, philosophy: 'allowable' });
    expect(proposal.status).toBe('no-solution');
    if (proposal.status === 'no-solution') expect(proposal.reason).toContain('perpendicular');
  });

  it('propone acero en el lecho superior para un momento negativo', () => {
    const proposal = proposeSectionReinforcement({ ...base, shape: 'rectangle', widthMm: 300, heightMm: 550, barLayout: 'layers', topBarCount: 2, bottomBarCount: 2, axialKn: 0, momentKnm: -120 });
    expect(proposal.status).toBe('proposed');
    if (proposal.status === 'proposed') {
      expect(proposal.input.topBarCount).toBeGreaterThan(2);
      expect(proposal.input.bottomBarCount).toBe(2);
      expect(proposal.result.utilization).toBeLessThanOrEqual(1);
    }
  });

  it('propone una distribución válida que cubre la demanda, con búsqueda acotada', () => {
    const proposal = proposeSectionReinforcement({ ...base, axialKn: 0, momentKnm: 90 });
    expect(proposal.status).toBe('proposed');
    if (proposal.status === 'proposed') {
      expect(proposal.result.utilization).toBeLessThanOrEqual(1);
      expect(proposal.result.reinforcement.minClearSpacingMm).toBeGreaterThanOrEqual(proposal.result.reinforcement.requiredClearSpacingMm);
      expect(proposal.checkedCandidates).toBeLessThanOrEqual(24);
    }
  });
});
