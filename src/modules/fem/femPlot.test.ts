import { describe, expect, it } from 'vitest';
import { analyzeFemDocument, createCantileverPlateFixture, createTri3PatchFixture } from './femEngine';
import { bandFor, buildFemPlot, elementAspectRatio, FEM_PLOT_BANDS } from './femPlot';

describe('FEM plot geometry', () => {
  it('bands values across the range and keeps a flat range in the first band', () => {
    expect(bandFor(0, 0, 1)).toBe(0);
    expect(bandFor(1, 0, 1)).toBe(FEM_PLOT_BANDS - 1);
    expect(bandFor(0.5, 0, 1)).toBe(3);
    expect(bandFor(4, 4, 4)).toBe(0);
    expect(bandFor(1.25 + 2e-16, 1.25, 1.25 + 2e-16)).toBe(0);
  });

  it('measures aspect ratio as longest over shortest edge', () => {
    expect(elementAspectRatio([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 2, y: 0 }, { id: 'c', x: 2, y: 1 }, { id: 'd', x: 0, y: 1 }])).toBe(2);
  });

  it('colours von Mises only with a result of the same document and peaks at the fixed root', () => {
    const document = createCantileverPlateFixture();
    expect(buildFemPlot(document, null, 'vonMises', false).range).toBeNull();
    expect(buildFemPlot(document, analyzeFemDocument(createTri3PatchFixture()), 'vonMises', false).range).toBeNull();

    const plot = buildFemPlot(document, analyzeFemDocument(document), 'vonMises', false);
    expect(plot.elements).toHaveLength(64);
    const peak = plot.elements.reduce((best, element) => (element.value ?? 0) > (best.value ?? 0) ? element : best);
    const peakNodes = document.elements.find((element) => element.id === peak.id)!.nodeIds.map((id) => document.nodes.find((node) => node.id === id)!);
    expect(Math.min(...peakNodes.map((node) => node.x))).toBe(0);
    expect(peak.band).toBe(FEM_PLOT_BANDS - 1);
    expect(plot.restraints).toHaveLength(5);
    expect(plot.loads.every((load) => load.dy > 0)).toBe(true); // carga hacia abajo; el SVG invierte y.
  });

  it('scales the deformed shape to a visible fraction of the model and keeps the ghost', () => {
    const document = createCantileverPlateFixture();
    const plot = buildFemPlot(document, analyzeFemDocument(document), 'displacement', true);
    expect(plot.deformationScale).toBeGreaterThan(1);
    expect(plot.undeformed).toHaveLength(document.elements.length);
    expect(buildFemPlot(document, null, 'quality', true).deformationScale).toBeNull();
  });
});
