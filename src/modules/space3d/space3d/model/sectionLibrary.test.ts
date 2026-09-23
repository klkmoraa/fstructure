import { describe, expect, it } from 'vitest';
import {
  SPACE3D_MATERIALS,
  SPACE3D_SECTION_CATALOG,
  calculateBoxSection,
  calculateCircularSection,
  calculateCircularTubeSection,
  calculateRectangularSection,
  getSectionsByCategory,
} from './sectionLibrary';

describe('sectionLibrary', () => {
  it('has valid materials and catalog presets', () => {
    expect(SPACE3D_MATERIALS.length).toBeGreaterThan(3);
    for (const mat of SPACE3D_MATERIALS) {
      expect(mat.E).toBeGreaterThan(0);
      expect(mat.G).toBeGreaterThan(0);
      expect(mat.massDensityKgPerM3).toBeGreaterThan(100);
      expect(mat.massDensityKgPerM3).toBeLessThan(10_000);
    }

    expect(SPACE3D_SECTION_CATALOG.length).toBeGreaterThan(10);
    for (const sec of SPACE3D_SECTION_CATALOG) {
      expect(sec.A).toBeGreaterThan(0);
      expect(sec.Iy).toBeGreaterThan(0);
      expect(sec.Iz).toBeGreaterThan(0);
      expect(sec.J).toBeGreaterThan(0);
    }
  });

  it('calculates rectangular solid section properties correctly', () => {
    const { A, Iy, Iz, J } = calculateRectangularSection(0.3, 0.5);
    expect(A).toBeCloseTo(0.15, 4);
    // Iz = b * h^3 / 12 = 0.3 * 0.125 / 12 = 0.003125
    expect(Iz).toBeCloseTo(0.003125, 6);
    // Iy = h * b^3 / 12 = 0.5 * 0.027 / 12 = 0.001125
    expect(Iy).toBeCloseTo(0.001125, 6);
    expect(J).toBeGreaterThan(0);
    expect(J).toBeLessThan(Iz + Iy);
  });

  it('calculates circular solid and hollow section properties', () => {
    const solid = calculateCircularSection(0.2);
    expect(solid.A).toBeCloseTo((Math.PI * 0.04) / 4, 5);
    expect(solid.Iy).toBeCloseTo(solid.Iz, 6);
    expect(solid.J).toBeCloseTo(solid.Iy * 2, 6);

    const tube = calculateCircularTubeSection(0.2, 0.01);
    expect(tube.A).toBeLessThan(solid.A);
    expect(tube.J).toBeCloseTo(tube.Iy * 2, 6);
  });

  it('calculates hollow box section properties', () => {
    const box = calculateBoxSection(0.2, 0.3, 0.01);
    expect(box.A).toBeGreaterThan(0);
    expect(box.Iz).toBeGreaterThan(box.Iy);
    expect(box.J).toBeGreaterThan(0);
  });

  it('filters catalog by category', () => {
    const steel = getSectionsByCategory('steel');
    expect(steel.length).toBeGreaterThan(0);
    expect(steel.every((s) => s.materialId.startsWith('steel'))).toBe(true);

    const concrete = getSectionsByCategory('concrete');
    expect(concrete.length).toBeGreaterThan(0);
    expect(concrete.every((s) => s.materialId.startsWith('concrete'))).toBe(true);

    const all = getSectionsByCategory('all');
    expect(all.length).toBe(SPACE3D_SECTION_CATALOG.length);
  });
});
