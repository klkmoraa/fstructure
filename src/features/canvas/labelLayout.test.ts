import { describe, expect, it } from 'vitest';
import {
  layoutSmartLabels,
  smartLabelOffsetToward,
  smartLabelRectHitsObstacle,
  smartLabelRectSegmentDistance,
  smartLabelRectsOverlap,
  type SmartLabelCandidate,
} from './labelLayout';

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

describe('zonas de exclusión: barras y curvas de diagrama', () => {
  type Rect = { x: number; y: number; width: number; height: number };
  type Point = { x: number; y: number };
  /** Separación mínima entre la caja y la polilínea, en px. */
  const clearanceTo = (rect: Rect, points: readonly Point[]) =>
    Math.min(...points.slice(1).map((point, index) => smartLabelRectSegmentDistance(rect, points[index], point)));

  it('mide la distancia entre una caja y un segmento: cero si lo cruza', () => {
    const rect = { x: 100, y: 100, width: 80, height: 20 };
    // Diagonal que atraviesa la caja sin dejar ningún extremo dentro.
    expect(smartLabelRectSegmentDistance(rect, { x: 80, y: 90 }, { x: 200, y: 130 })).toBe(0);
    // Horizontal 10 px por encima y vertical a 15 px del borde derecho.
    expect(smartLabelRectSegmentDistance(rect, { x: 50, y: 90 }, { x: 250, y: 90 })).toBeCloseTo(10, 9);
    expect(smartLabelRectSegmentDistance(rect, { x: 195, y: 0 }, { x: 195, y: 300 })).toBeCloseTo(15, 9);
    // Una diagonal que pasa de lado: gobierna la esquina (180, 120) frente a x + y = 320.
    expect(smartLabelRectSegmentDistance(rect, { x: 320, y: 0 }, { x: 0, y: 320 })).toBeCloseTo(20 / Math.SQRT2, 9);
    // Un segmento corto lejos de la caja: gobierna su extremo.
    expect(smartLabelRectSegmentDistance(rect, { x: 190, y: 130 }, { x: 260, y: 200 })).toBeCloseTo(Math.hypot(10, 10), 9);
  });

  it('una polilínea invade la caja sólo si se acerca más que su margen', () => {
    const rect = { x: 0, y: 0, width: 100, height: 22 };
    const curve = [{ x: -50, y: 30 }, { x: 50, y: 28 }, { x: 150, y: 30 }];
    expect(smartLabelRectHitsObstacle(rect, { points: curve, clearance: 5 })).toBe(false);
    expect(smartLabelRectHitsObstacle(rect, { points: curve, clearance: 7 })).toBe(true);
  });

  /**
   * Viga de 600 px entre x = 200 y x = 800 sobre y = 300, apoyada en x = 200,
   * con la flecha de su reacción debajo del apoyo. `side` dice de qué lado de
   * la viga se dibuja el diagrama (+1 arriba, −1 abajo, donde está la
   * reacción) y `extreme` dónde cae el extremo: en el apoyo (voladizo) o a
   * media luz. La polilínea incluye los cierres a la línea base, que el lienzo
   * también dibuja.
   */
  const beamDiagram = (side: 1 | -1, extreme: 'support' | 'span'): Point[] => {
    const ordinate = (t: number) => (extreme === 'support' ? (1 - t) ** 2 : 4 * t * (1 - t)) * 80;
    const curve = Array.from({ length: 41 }, (_, index) => ({ x: 200 + index * 15, y: 300 - side * ordinate(index / 40) }));
    return [{ x: 200, y: 300 }, ...curve, { x: 800, y: 300 }];
  };
  const beam = [{ x: 200, y: 300 }, { x: 800, y: 300 }];
  const arrow = [{ x: 200, y: 325 }, { x: 200, y: 373 }];

  for (const side of [1, -1] as const) {
    for (const extreme of ['support', 'span'] as const) {
      it(`la reacción no cae sobre el diagrama (${side > 0 ? 'arriba' : 'abajo'}, extremo ${extreme === 'support' ? 'en el apoyo' : 'en el vano'})`, () => {
        const curve = beamDiagram(side, extreme);
        const obstacles = [
          { points: curve, clearance: 6 },
          { points: beam, clearance: 6.5 },
          { points: arrow, clearance: 8 },
        ];
        const text = 'Ry = 165.81 kN';
        // A la derecha de la flecha, a media altura: donde la pone el lienzo.
        const label = candidate({ id: 'reaction:N1:ry', text, anchor: { x: 200, y: 349 }, priority: 1, preferredOffset: smartLabelOffsetToward(text, { x: 1, y: 0 }, 10) });
        const [preferred] = layoutSmartLabels([label], BOUNDS, 120);
        const [placed] = layoutSmartLabels([label], BOUNDS, 120, [], obstacles);

        // Con el diagrama del lado de la reacción, la posición preferida lo cruza.
        if (side < 0) expect(smartLabelRectHitsObstacle(preferred.rect, obstacles[0])).toBe(true);
        expect(clearanceTo(placed.rect, curve)).toBeGreaterThanOrEqual(4);
        for (const obstacle of obstacles) expect(smartLabelRectHitsObstacle(placed.rect, obstacle)).toBe(false);
        // Libre, se queda junto a su flecha, sin guía.
        expect(placed.leader).toBe(false);
      });
    }
  }

  it('el extremo de un diagrama se coloca fuera de la curva, junto a su pico y sin guía', () => {
    for (const side of [1, -1] as const) {
      const curve = beamDiagram(side, 'span');
      const peak = curve[21];
      const text = side > 0 ? 'M máx 119.39 kN·m' : 'M mín -119.39 kN·m';
      const [placed] = layoutSmartLabels([candidate({
        id: 'result:V1:moment:maximum', text, anchor: peak, forceVisible: true,
        preferredOffset: smartLabelOffsetToward(text, { x: 0, y: -side }, 8),
      })], BOUNDS, 120, [], [{ points: curve, clearance: 6 }]);
      expect(clearanceTo(placed.rect, curve)).toBeGreaterThanOrEqual(4);
      expect(placed.leader).toBe(false);
      if (side > 0) expect(placed.rect.y + placed.rect.height).toBeLessThanOrEqual(peak.y);
      else expect(placed.rect.y).toBeGreaterThanOrEqual(peak.y);
    }
  });

  it('el N máx de una diagonal de armadura no cruza ninguna barra, en tracción y en compresión', () => {
    // Dos tableros Pratt de 280 px: cordones, montantes y diagonales.
    const n = { a: { x: 200, y: 400 }, b: { x: 480, y: 400 }, e: { x: 760, y: 400 }, c: { x: 200, y: 120 }, d: { x: 480, y: 120 }, f: { x: 760, y: 120 } };
    const bars = [[n.a, n.b], [n.b, n.e], [n.c, n.d], [n.d, n.f], [n.a, n.c], [n.b, n.d], [n.e, n.f], [n.c, n.b], [n.f, n.b]];
    const obstacles = bars.map((points) => ({ points, clearance: 6.5 }));
    for (const value of [33.94, -33.94]) {
      for (const side of [1, -1]) {
        // Ancla a media diagonal c–b, sobre su banda; hacia fuera de la banda
        // la caja de 115 px cruza la propia diagonal o una barra vecina.
        const normal = { x: Math.SQRT1_2 * side * Math.sign(value), y: -Math.SQRT1_2 * side * Math.sign(value) };
        const anchor = { x: 340 + normal.x * 20, y: 260 + normal.y * 20 };
        const text = `N máx ${value.toFixed(2)} kN`;
        const label = candidate({ id: 'result:D1:axial:maximum', text, anchor, forceVisible: true, preferredOffset: smartLabelOffsetToward(text, normal, 8) });
        const [preferred] = layoutSmartLabels([label], BOUNDS, 120);
        const placed = layoutSmartLabels([label], BOUNDS, 120, [], obstacles);
        expect(obstacles.some((obstacle) => smartLabelRectHitsObstacle(preferred.rect, obstacle))).toBe(true);
        expect(placed).toHaveLength(1);
        expect(placed[0].text).toMatch(/ kN$/);
        expect(obstacles.filter((obstacle) => smartLabelRectHitsObstacle(placed[0].rect, obstacle))).toHaveLength(0);
      }
    }
  });

  it('una etiqueta que puede ceder desaparece antes que tapar una barra', () => {
    // Barras cada 15 px: no queda hueco para una caja de 22 px de alto.
    const obstacles = Array.from({ length: 41 }, (_, index) => ({ points: [{ x: 0, y: index * 15 }, { x: 900, y: index * 15 }], clearance: 6.5 }));
    const placed = layoutSmartLabels([candidate({ id: 'member:M1', text: 'M1', anchor: { x: 450, y: 300 }, priority: 2 })], BOUNDS, 120, [], obstacles);
    expect(placed).toHaveLength(0);
  });
});
