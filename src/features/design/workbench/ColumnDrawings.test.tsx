// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { designColumn, type ColumnDesignInput } from '../../../design/elements/column';
import { columnTakeoff } from '../../../design/elements/takeoff';
import { ColumnElevation, ColumnSection, InteractionChart, columnTiePositionsMm } from './ColumnDrawings';

const base: ColumnDesignInput = {
  code: 'ntc-2023', widthMm: 400, depthMm: 400, coverMm: 40, fcMpa: 28, fyMpa: 420,
  barDiameterMm: 25.4, barsAlongWidth: 3, barsAlongDepth: 3, tieDiameterMm: 9.5, maxAggregateMm: 19,
  axialKn: 1000, momentXKnm: 100, momentYKnm: 0, shearXKn: 0, shearYKn: 0,
  unbracedLengthM: 3, effectiveLengthFactor: 1, curvature: 'single', endMomentRatio: 1, sustainedRatio: 0.6,
  braced: true, swayMomentXKnm: 0, swayMomentYKnm: 0, stabilityIndex: 0, group: 'B2', groundFloor: false,
};
const ok = (input: ColumnDesignInput) => {
  const result = designColumn(input);
  if (!result.ok) throw new Error(result.errors.join('; '));
  return result;
};
const svg = (markup: string) => new DOMParser().parseFromString(markup, 'image/svg+xml');

describe('diagramas de columna reflejan el cálculo', () => {
  it('representa cada vuelta del zuncho con el paso completo y cubre toda la altura', () => {
    const result = ok({ ...base, shape: 'circular', widthMm: 500, depthMm: 500, barCount: 8, transverse: 'spiral', tieSpacingMm: 150 });
    const drawing = svg(renderToStaticMarkup(<ColumnElevation result={result} />));
    const path = drawing.querySelector('.dw-stirrup path')?.getAttribute('d') ?? '';
    const points = [...path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
    expect(points).toHaveLength(321); // 20 vueltas × 16 muestras + extremo final.
    expect(points[16]!.x).toBeCloseTo(points[0]!.x, 8);
    expect(points[8]!.x).not.toBeCloseTo(points[0]!.x, 1);
    expect(points[0]!.y - points[16]!.y).toBeCloseTo(265 * 150 / 3000, 8);
    expect(points.at(-1)!.y).toBeCloseTo(32, 8);
  });

  it('dibuja las grapas necesarias para apoyar las barras y ninguna grapa circular', () => {
    const rectangular = ok(base);
    const section = svg(renderToStaticMarkup(<ColumnSection result={rectangular} />));
    expect(section.querySelectorAll('.dw-stirrup path')).toHaveLength(rectangular.ties.crossTiesParallelToX + rectangular.ties.crossTiesParallelToY);
    const circular = ok({ ...base, shape: 'circular', barCount: 8 });
    expect(svg(renderToStaticMarkup(<ColumnSection result={circular} />)).querySelectorAll('.dw-stirrup path')).toHaveLength(0);
  });

  it('la elevación y la cantidad de estribos coinciden en zonas con intervalos de cierre', () => {
    const result = ok({ ...base, tieSpacingMm: 123, endTieSpacingMm: 75 });
    const positions = columnTiePositionsMm(result);
    const hoops = columnTakeoff(result).lines.find((line) => line.mark.startsWith('Estribos'))!;
    expect(positions).toHaveLength(hoops.count);
    expect(positions.at(0)).toBe(0);
    expect(positions.at(-1)).toBe(3000);
    for (let index = 1; index < positions.length; index += 1) {
      const gap = positions[index]! - positions[index - 1]!;
      const maxGap = positions[index]! <= 600 || positions[index - 1]! >= 2400 ? 75 : 123;
      expect(gap).toBeLessThanOrEqual(maxGap + 1e-8);
    }
  });

  it('ubica la falla balanceada con el φ de la norma elegida', () => {
    const result = ok({ ...base, code: 'e060' });
    const chart = svg(renderToStaticMarkup(<InteractionChart result={result} />));
    const balanced = result.aboutX.balanced;
    const maxM = Math.max(...[result.aboutX.nominal, result.aboutY.nominal].flat().map((p) => p.momentKnm), result.magnification.x.designMomentKnm, result.magnification.y.designMomentKnm, Math.hypot(result.magnification.x.designMomentKnm, result.magnification.y.designMomentKnm)) * 1.08;
    expect(Number(chart.querySelector('.dw-chart__balanced')?.getAttribute('cx'))).toBeCloseTo(62 + balanced.momentKnm * balanced.phi / maxM * (480 - 62 - 20), 8);
  });

  it('representa el momento circular utilizado y distingue las dos orientaciones', () => {
    const result = ok({ ...base, shape: 'circular', widthMm: 500, depthMm: 500, barCount: 8, unbracedLengthM: 2.4 });
    const chart = svg(renderToStaticMarkup(<InteractionChart result={result} />));
    // My no se aplica: su mínimo no se suma al Mu resultante usado por el motor.
    expect(chart.querySelector('.dw-demand text')?.textContent).toContain('100.0');
    expect(chart.querySelectorAll('.dw-curve--x')).toHaveLength(1);
    expect(chart.querySelectorAll('.dw-curve--y')).toHaveLength(1);
  });
});
