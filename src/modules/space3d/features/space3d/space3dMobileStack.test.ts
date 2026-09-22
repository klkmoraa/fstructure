/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * jsdom no calcula layout, así que el solape no se puede observar renderizando.
 * Lo que sí se puede fijar es la condición que lo producía: dos hermanos
 * `position: fixed` con el mismo inset inferior, el mismo ancho y el mismo
 * `z-index`, donde el posterior en el DOM tapaba las acciones del anterior.
 */
const css = readFileSync(
  fileURLToPath(new URL('./space3d.css', import.meta.url)),
  'utf8',
)
  .replace(/\r\n/g, '\n')
  // Un comentario delante de una regla acabaría dentro de su selector.
  .replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Reglas del nivel superior de un texto CSS, indexadas por selector.
 * Se escanean las llaves en vez de usar una expresión regular: las hojas del
 * producto anidan `@media` y `@keyframes`, y un emparejador ingenuo los parte.
 */
const parseRules = (text: string): Map<string, string> => {
  const rules = new Map<string, string>();
  let depth = 0;
  let selectorStart = 0;
  let bodyStart = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') {
      depth += 1;
      if (depth === 1) bodyStart = index + 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        const selector = text.slice(selectorStart, bodyStart - 1).trim();
        for (const one of selector.split(',')) {
          const key = one.trim();
          if (key) rules.set(key, (rules.get(key) ?? '') + text.slice(bodyStart, index));
        }
        selectorStart = index + 1;
      }
    }
  }
  return rules;
};

/**
 * Contenido de TODAS las media queries con ese encabezado, concatenado: la hoja
 * declara varias y la cascada las aplica todas, así que mirar sólo la primera
 * dejaría fuera la que importa.
 */
const mediaBody = (query: string): string => {
  const bodies: string[] = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(query, from);
    if (start === -1) break;
    const open = css.indexOf('{', start);
    let depth = 0;
    for (let index = open; index < css.length; index += 1) {
      if (css[index] === '{') depth += 1;
      else if (css[index] === '}') {
        depth -= 1;
        if (depth === 0) {
          bodies.push(css.slice(open + 1, index));
          from = index + 1;
          break;
        }
      }
    }
    if (from <= start) break;
  }
  expect(bodies.length, `no existe la media query ${query}`).toBeGreaterThan(0);
  return bodies.join('\n');
};

describe('space3d · pila inferior en pantalla estrecha', () => {
  const narrow = parseRules(mediaBody('@media (max-width: 599px)'));
  const base = parseRules(css);

  it('anchors the bottom panels through a single stack container', () => {
    const stack = narrow.get('.space3d-bottom-stack');
    expect(stack, 'la pila debe existir en la media query estrecha').not.toBeNull();
    expect(stack).toMatch(/position:\s*fixed/);
    expect(stack).toMatch(/flex-direction:\s*column-reverse/);
  });

  it('keeps the HUD and the legend out of the fixed layer', () => {
    for (const selector of ['.space3d-hud-card', '.space3d-results-legend']) {
      const declarations = narrow.get(selector);
      expect(declarations, `${selector} debe declararse en la media query`).not.toBeNull();
      // Si vuelven a ser `fixed` recuperan el inset compartido y el solape.
      expect(declarations, selector).not.toMatch(/position:\s*fixed/);
      expect(declarations, selector).toMatch(/position:\s*static/);
    }
  });

  it('declares the stack as a non-box wrapper outside the narrow layout', () => {
    // Fuera de la media query los paneles conservan su posición propia, así que
    // el contenedor no debe crear caja ni desplazarlos.
    expect(base.get('.space3d-bottom-stack')).toMatch(/display:\s*contents/);
  });
});
