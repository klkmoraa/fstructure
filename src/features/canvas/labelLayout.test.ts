import { describe, expect, it } from 'vitest';
import { layoutSmartLabels, smartLabelRectsOverlap, type SmartLabelCandidate } from './labelLayout';

const BOUNDS = { x: 0, y: 0, width: 900, height: 600 };

const candidate = (overrides: Partial<SmartLabelCandidate> & Pick<SmartLabelCandidate, 'id' | 'text' | 'anchor'>): SmartLabelCandidate => ({
  priority: 2,
  ...overrides,
});

describe('colocación de etiquetas del lienzo', () => {
  it('descarta el mismo valor pedido dos veces desde el mismo punto', () => {
    // El nudo de un pórtico pertenece a dos barras: las dos piden el momento
    // del extremo, con el mismo texto y el mismo ancla.
    const placed = layoutSmartLabels([
      candidate({ id: 'result:M1:moment:end:0', text: 'M = -31.15 kN·m', anchor: { x: 300, y: 200 }, forceVisible: true }),
      candidate({ id: 'result:M2:moment:end:0', text: 'M = -31.15 kN·m', anchor: { x: 304, y: 203 }, forceVisible: true }),
    ], BOUNDS, 120);

    expect(placed).toHaveLength(1);
    expect(placed[0].id).toBe('result:M1:moment:end:0');
  });

  it('conserva el mismo valor cuando ocurre en dos puntos distintos', () => {
    const placed = layoutSmartLabels([
      candidate({ id: 'a', text: 'M = -31.15 kN·m', anchor: { x: 120, y: 200 }, forceVisible: true }),
      candidate({ id: 'b', text: 'M = -31.15 kN·m', anchor: { x: 700, y: 200 }, forceVisible: true }),
    ], BOUNDS, 120);

    expect(placed).toHaveLength(2);
  });

  it('una etiqueta obligatoria se aparta a la posición menos ocupada', () => {
    // Tres cifras distintas ancladas en el mismo sitio: ninguna puede ceder,
    // así que lo que se mide es que no acaben una encima de otra.
    const placed = layoutSmartLabels([
      candidate({ id: 'a', text: 'M = 10.00 kN·m', anchor: { x: 400, y: 300 }, priority: 1 }),
      candidate({ id: 'b', text: 'M = 20.00 kN·m', anchor: { x: 400, y: 300 }, priority: 1 }),
      candidate({ id: 'c', text: 'M = 30.00 kN·m', anchor: { x: 400, y: 300 }, priority: 1 }),
    ], BOUNDS, 120);

    expect(placed).toHaveLength(3);
    for (const [index, label] of placed.entries()) {
      for (const other of placed.slice(index + 1)) {
        expect(smartLabelRectsOverlap(label.rect, other.rect), `${label.id} tapa a ${other.id}`).toBe(false);
      }
    }
  });

  it('las etiquetas se quedan dentro del área segura del lienzo', () => {
    const placed = layoutSmartLabels([
      candidate({ id: 'a', text: 'Ry = 65.000 kN', anchor: { x: -80, y: 620 }, priority: 1 }),
    ], BOUNDS, 120);

    expect(placed[0].rect.x).toBeGreaterThanOrEqual(BOUNDS.x);
    expect(placed[0].rect.y).toBeGreaterThanOrEqual(BOUNDS.y);
    expect(placed[0].rect.x + placed[0].rect.width).toBeLessThanOrEqual(BOUNDS.x + BOUNDS.width);
    expect(placed[0].rect.y + placed[0].rect.height).toBeLessThanOrEqual(BOUNDS.y + BOUNDS.height);
  });
});
