// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MemberModel, NodeModel, ProjectModel } from '../../types';
import type { AnalysisResult } from '../../types';
import { CanvasDiagramStack, stackBottomReserve } from './CanvasDiagramStack';
import { canvasSafeInsetsFor } from './canvasChromeGeometry';

type MemberResult = AnalysisResult['memberResults'][number];

const nodes = [
  { id: 'A', x: 0, y: 0 }, { id: 'B', x: 0, y: 3 },
  { id: 'C', x: 5, y: 3 }, { id: 'D', x: 5, y: 0 },
].map((node) => ({ ...node, support: { type: 'none' } } as NodeModel));

const members = [
  ['AB', 'A', 'B'], ['BC', 'B', 'C'], ['CD', 'C', 'D'],
].map(([id, i, j]) => ({ id, i, j, type: 'frame', E: 2e8, A: 0.02, I: 8e-5 } as MemberModel));

const result = (memberId: string): MemberResult => ({
  memberId,
  length: memberId === 'BC' ? 5 : 3,
  startOffset: 0,
  localDisplacements: [],
  localEndForces: [],
  diagramJumps: [],
  criticalPoints: [],
  diagramSegments: [{
    x0: 0,
    x1: memberId === 'BC' ? 5 : 3,
    axial: [4, 0, 0],
    shear: [8, -2, 0],
    moment: [0, 8, -2, 0],
    distributedAxial: [0, 0],
    distributedTransverse: [0, 0],
  }],
  diagram: [],
  deformation: [],
  deformationSegments: [],
  deformationCriticalPoints: [],
  maxAxial: 4,
  minAxial: -4,
  maxShear: 8,
  minShear: -3,
  maxMoment: 10,
  minMoment: -6,
} as unknown as MemberResult);

const project = { id: 'portal', name: 'Pórtico', nodes, members, settings: { units: 'kN-m' } } as unknown as ProjectModel;
const props = {
  project,
  results: members.map((member) => result(member.id)),
  quantities: ['axial', 'shear', 'moment'] as const,
  nodeMap: new Map(nodes.map((node) => [node.id, node])),
  t: ((key: string) => key) as never,
};

describe('CanvasDiagramStack', () => {
  it('draws the compact sheet below the model without masking the canvas', () => {
    const size = { width: 390, height: 520 };
    const { container } = render(<svg><CanvasDiagramStack {...props} size={size} /></svg>);
    const layer = container.querySelector('[data-canvas-layer="diagram-stack"]');

    expect(layer?.classList.contains('diagram-stack-layer--sheet')).toBe(true);
    expect(layer?.classList.contains('is-compact')).toBe(true);
    // Ni máscara opaca ni tarjetas: ACM no puede apagar el modelo del lienzo.
    expect(layer?.querySelector('.diagram-stack-canvas-mask')).toBeNull();
    expect(layer?.querySelector('.diagram-stack-panel-surface')).toBeNull();
    expect(layer?.querySelectorAll('[data-stack-panel]')).toHaveLength(3);

    const reserve = stackBottomReserve(project, size, 3);
    expect(reserve).toBeGreaterThan(0);
    // El modelo conserva una banda propia arriba: la lámina va DEBAJO de él.
    expect(reserve).toBeLessThan(size.height * 0.75);
  });

  it('keeps every compact lane inside the canvas and above the model band', () => {
    const size = { width: 390, height: 520 };
    const { container } = render(<svg><CanvasDiagramStack {...props} size={size} /></svg>);
    const titles = Array.from(container.querySelectorAll<SVGTextElement>('.diagram-stack-panel-title'));
    const modelBandBottom = size.height - stackBottomReserve(project, size, 3);

    expect(titles).toHaveLength(3);
    for (const title of titles) {
      const y = Number(title.getAttribute('y'));
      expect(y).toBeGreaterThanOrEqual(modelBandBottom);
      expect(y).toBeLessThanOrEqual(size.height);
    }
  });

  /**
   * El defecto que esta prueba guarda: con altos de carril fijos, un teléfono
   * EN HORIZONTAL (844x390) pedía 273px de reserva y, con los 116px de inset
   * superior, al modelo le quedaban 0.8px. `cameraToFitBounds` recorta ese
   * rectángulo a 1px conservando su escala mínima, así que el modelo acababa
   * dibujado encima de la lámina: la ventana que ACM venía a eliminar.
   */
  it('deja siempre banda al modelo, también en un lienzo bajo y ancho', () => {
    for (const size of [{ width: 844, height: 390 }, { width: 390, height: 520 }, { width: 700, height: 300 }]) {
      const band = size.height - canvasSafeInsetsFor(size).top - stackBottomReserve(project, size, 3);
      expect(band, `${size.width}x${size.height}`).toBeGreaterThanOrEqual(24);
    }
  });

  it('keeps the wide exterior replica for desktop reading space', () => {
    const { container } = render(<svg><CanvasDiagramStack {...props} size={{ width: 1280, height: 900 }} /></svg>);
    const layer = container.querySelector('[data-canvas-layer="diagram-stack"]');

    expect(layer?.classList.contains('diagram-stack-layer--sheet')).toBe(true);
    expect(layer?.classList.contains('is-compact')).toBe(false);
    expect(layer?.querySelectorAll('.diagram-stack-member-label')).toHaveLength(9);
    expect(stackBottomReserve(project, { width: 1280, height: 900 }, 3)).toBeGreaterThan(0);
  });
});
