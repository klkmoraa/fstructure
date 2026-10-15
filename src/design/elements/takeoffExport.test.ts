import { describe, expect, it } from 'vitest';
import type { FootingDesignResult } from './footing';
import { barMassKgPerM, footingTakeoff, type Takeoff } from './takeoff';
import { csvCell, takeoffCsv, takeoffFileName, takeoffSvg } from './takeoffExport';

/** Zapata aislada 2.45 × 2.45 m, recubrimiento 75 mm, 13 #5 rectas por dirección. */
const direction = (axis: 'x' | 'y') => ({ axis, barCount: 13, anchorage: 'straight' as const });
const footing = {
  input: { barDiameterMm: 15.9, coverMm: 75, pedestal: null },
  sideXMm: 2_450, sideYMm: 2_450, thicknessMm: 500,
  directions: { x: direction('x'), y: direction('y') },
} as unknown as FootingDesignResult;

describe('despiece exportable', () => {
  const takeoff = footingTakeoff(footing);

  it('oráculo: zapata de 2.45 m con 13 #5 por dirección', () => {
    const massPerM = barMassKgPerM(15.9);
    expect(massPerM).toBeGreaterThan(1.552);
    expect(massPerM).toBeLessThan(1.56);
    expect(takeoff.lines).toHaveLength(2);
    for (const line of takeoff.lines) {
      expect(line.count).toBe(13);
      expect(line.pieceLengthM).toBeCloseTo(2.30, 9);
      expect(line.shape).toEqual({ kind: 'straight' });
    }
    expect(takeoff.steelKg).toBeCloseTo(26 * 2.30 * massPerM, 9);
    expect(takeoff.steelKg).toBeGreaterThan(26 * 2.30 * 1.552);
    expect(takeoff.steelKg).toBeLessThan(26 * 2.30 * 1.56);
  });

  it('CSV: BOM, encabezado del PDF, una fila por marca y total', () => {
    const csv = takeoffCsv(takeoff);
    expect(csv.startsWith('﻿')).toBe(true);
    const rows = csv.slice(1).trimEnd().split('\r\n');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toBe('Marca,Varilla,Piezas,Longitud por pieza (m),Masa (kg)');
    expect(rows[1]).toBe(`Parrilla en X #5,#5,13,2.30,${(13 * 2.3 * barMassKgPerM(15.9)).toFixed(1)}`);
    expect(rows[3]).toBe(`Total de acero,,,,${takeoff.steelKg.toFixed(1)}`);
  });

  it('CSV: escapa comas, comillas, saltos y fórmulas (RFC 4180)', () => {
    expect(csvCell('V-1, eje "A"')).toBe('"V-1, eje ""A"""');
    expect(csvCell('Eje 1, B')).toBe('"Eje 1, B"');
    expect(csvCell('dos\nlíneas')).toBe('"dos\nlíneas"');
    expect(csvCell('=SUMA(A1)')).toBe("'=SUMA(A1)");
    const custom: Takeoff = { ...takeoff, lines: [{ ...takeoff.lines[0]!, mark: 'Bastón "a", 1' }] };
    expect(takeoffCsv(custom).split('\r\n')[1]).toMatch(/^"Bastón ""a"", 1",/);
  });

  it('SVG: documento autónomo con una fila por marca', () => {
    const svg = takeoffSvg(takeoff, 'Zapata <Z-1>');
    expect(svg).toMatch(/^<\?xml/);
    expect(svg.match(/<g class="row"/g)).toHaveLength(takeoff.lines.length);
    expect(svg).toContain('data-mark="Parrilla en Y #5"');
    expect(svg).toContain('Zapata &lt;Z-1&gt;');
    expect(svg).toContain('2.30 m');
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(new DOMParserLike(svg).ok).toBe(true);
  });

  it('nombre de archivo sin acentos ni símbolos', () => {
    expect(takeoffFileName('Z-1 · Zapata 2.45 × 2.45 m', 'csv')).toBe('despiece-z-1-zapata-2-45-2-45-m.csv');
  });
});

/** Comprobación mínima de buena formación: etiquetas equilibradas. */
class DOMParserLike {
  readonly ok: boolean;
  constructor(text: string) {
    const stack: string[] = [];
    let ok = true;
    for (const match of text.replace(/<\?xml[^>]*>/, '').matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
      const [, closing, name, selfClosing] = match;
      if (selfClosing) continue;
      if (closing) { if (stack.pop() !== name) ok = false; } else stack.push(name!);
    }
    this.ok = ok && stack.length === 0;
  }
}
