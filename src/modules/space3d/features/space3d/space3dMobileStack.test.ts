/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * jsdom no calcula layout, así que el solape no se puede observar renderizando.
 * Lo que sí se puede fijar es la condición que lo producía: dos hermanos
 * posicionados con el mismo inset inferior, el mismo ancho y el mismo
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

describe('space3d · pila de selección y leyenda', () => {
  const narrow = parseRules(mediaBody('@media (max-width: 700px)'));
  const base = parseRules(css);

  it('anchors the HUD and the legend through a single stack container', () => {
    const stack = base.get('.space3d-bottom-stack');
    expect(stack).toMatch(/position:\s*absolute/);
    expect(stack).toMatch(/display:\s*flex/);
    // En un teléfono baja al pulgar y el HUD queda pegado al pie.
    expect(narrow.get('.space3d-bottom-stack')).toMatch(/flex-direction:\s*column-reverse/);
  });

  it('never positions the HUD or the legend on their own', () => {
    // Si vuelven a posicionarse por su cuenta recuperan el inset compartido y el solape.
    for (const selector of ['.space3d-hud-card', '.space3d-results-legend']) {
      for (const rules of [base, narrow]) expect(rules.get(selector) ?? '', selector).not.toMatch(/position:\s*(fixed|absolute)/);
    }
  });

  it('hides the stack for an expanded sheet only in the compact layout', () => {
    const compact = parseRules(mediaBody('@media (max-width: 1023px)'));
    expect(compact.get('.space3d-bottom-stack[data-sheet-expanded]')).toMatch(/display:\s*none/);
    // Fuera de la media query el atributo no oculta nada: en escritorio la hoja
    // es una columna propia y HUD y leyenda deben seguir a la vista.
    expect(base.get('.space3d-bottom-stack[data-sheet-expanded]')).toBeUndefined();
  });
});
