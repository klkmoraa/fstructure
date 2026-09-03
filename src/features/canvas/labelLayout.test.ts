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

  it('el identificador de una barra y el valor de su carga dejan de disputarse el punto medio', () => {
    // Los dos rótulos de una viga cargada: el valor de la distribuida ancla en
    // el centro del tramo, y el identificador anclaba ahí también. Uno de los
    // dos tenía que apartarse y salía con guía, cruzándose con la otra sobre la
    // propia barra. Anclando el identificador a un 30% del vano, cada uno cae
    // en su posición preferida y ninguno necesita guía.
    const viga = { izquierda: 300, derecha: 900, y: 200 };
    const medio = (viga.izquierda + viga.derecha) / 2;
    const estacion = viga.izquierda + (viga.derecha - viga.izquierda) * 0.3;

    const disputado = layoutSmartLabels([
      candidate({ id: 'member:M2', text: 'M2', anchor: { x: medio, y: viga.y }, priority: 0, preferredOffset: { x: 0, y: -21 }, forceVisible: true }),
      candidate({ id: 'distributed-load:ML1', text: '14.00 kN/m', anchor: { x: medio, y: viga.y - 54 }, priority: 1, preferredOffset: { x: 0, y: 0 }, forceVisible: true }),
    ], { x: 0, y: 0, width: 1200, height: 600 }, 120);

    const separado = layoutSmartLabels([
      candidate({ id: 'member:M2', text: 'M2', anchor: { x: estacion, y: viga.y }, priority: 0, preferredOffset: { x: 0, y: -21 }, forceVisible: true }),
      candidate({ id: 'distributed-load:ML1', text: '14.00 kN/m', anchor: { x: medio, y: viga.y - 54 }, priority: 1, preferredOffset: { x: 0, y: 0 }, forceVisible: true }),
    ], { x: 0, y: 0, width: 1200, height: 600 }, 120);

    expect(disputado).toHaveLength(2);
    expect(separado).toHaveLength(2);
    expect(separado.every((label) => !label.leader)).toBe(true);
    // Y las dos cajas dejan de tocarse.
    expect(smartLabelRectsOverlap(separado[0].rect, separado[1].rect)).toBe(false);
  });
});
