/**
 * Fórmulas con la fuente del documento, sin motor TeX.
 *
 * El tipografiado vectorial (MathJax) quedó fuera de la exportación web porque rompía en el
 * navegador, y el respaldo pintaba la traducción LaTeX como texto: `N(\xi)`, `x^2`,
 * `\dfrac{…}{…}`. Aquí la notación del solver —Unicode, marcas `^`/`_`, `√(…)` y algunas órdenes
 * LaTeX que se cuelan— se convierte en tramos de texto a tres alturas (normal, superíndice,
 * subíndice) que se miden y dibujan con la fuente incrustada.
 */
import type { PDFFont, PDFPage } from 'pdf-lib';
import { pdfDrawsGlyph, pdfText, scriptMarker } from './pdfGlyphs';
import type { PdfColor } from './reportContext';

/** 0 = línea base, 1 = superíndice, −1 = subíndice. */
export interface MathRun {
  readonly text: string;
  readonly level: 0 | 1 | -1;
}

const SCRIPT_SCALE = 0.72;
const RISE = 0.36;
const DROP = 0.2;

const COMMANDS: ReadonlyMap<string, string> = new Map([
  ['alpha', 'α'], ['beta', 'β'], ['gamma', 'γ'], ['Gamma', 'Γ'], ['delta', 'δ'], ['Delta', 'Δ'], ['epsilon', 'ε'],
  ['varepsilon', 'ε'], ['zeta', 'ζ'], ['eta', 'η'], ['theta', 'θ'], ['Theta', 'Θ'], ['vartheta', 'θ'], ['kappa', 'κ'],
  ['lambda', 'λ'], ['Lambda', 'Λ'], ['mu', 'μ'], ['nu', 'ν'], ['xi', 'ξ'], ['Xi', 'Ξ'], ['pi', 'π'], ['Pi', 'Π'],
  ['rho', 'ρ'], ['sigma', 'σ'], ['Sigma', 'Σ'], ['tau', 'τ'], ['phi', 'φ'], ['varphi', 'φ'], ['Phi', 'Φ'], ['chi', 'χ'],
  ['psi', 'ψ'], ['Psi', 'Ψ'], ['omega', 'ω'], ['Omega', 'Ω'],
  ['sum', 'Σ'], ['int', '∫'], ['partial', '∂'], ['infty', '∞'], ['cdot', '·'], ['times', '×'], ['div', '÷'],
  ['le', '≤'], ['leq', '≤'], ['ge', '≥'], ['geq', '≥'], ['ne', '≠'], ['neq', '≠'], ['approx', '≈'], ['pm', '±'],
  ['mp', '∓'], ['to', '→'], ['rightarrow', '→'], ['leftarrow', '←'], ['Rightarrow', '⇒'], ['circ', '°'],
  ['prime', '′'], ['surd', '√'], ['quad', '  '], ['qquad', '    '], ['ldots', '…'], ['cdots', '⋯'],
  ['circlearrowleft', '↺'], ['circlearrowright', '↻'],
]);
/** Órdenes que sólo envuelven su argumento: se queda el contenido. */
const WRAPPERS = new Set(['text', 'mathrm', 'operatorname', 'mathbf', 'boldsymbol', 'mathit', 'textrm', 'mathsf']);

/** Índice de la llave que cierra la que abre en `open`, o −1. */
const closing = (text: string, open: number, left = '{', right = '}'): number => {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === left) depth += 1;
    else if (text[index] === right) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
};

/** Un argumento de `\frac` cabe sin paréntesis si es un solo término. */
const operand = (value: string) => /^[\p{L}\p{N}.′″*]+$/u.test(value) ? value : `(${value})`;

/** Las órdenes LaTeX que se cuelan en la notación del solver, a Unicode plano. */
export const flattenLatex = (expression: string): string => {
  let result = '';
  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];
    if (character !== '\\') {
      result += character;
      continue;
    }
    const next = expression[index + 1];
    if (next === undefined) break;
    if (!/[A-Za-z]/.test(next)) {
      // `\,` `\;` `\ ` `\!` son espacios; `\{` `\}` `\%` el propio carácter.
      result += /[,;: !]/.test(next) ? (next === '!' ? '' : ' ') : next;
      index += 1;
      continue;
    }
    let end = index + 1;
    while (end < expression.length && /[A-Za-z]/.test(expression[end])) end += 1;
    const name = expression.slice(index + 1, end);
    index = end - 1;
    if (name === 'left' || name === 'right' || name === 'displaystyle') continue;
    if ((name === 'frac' || name === 'dfrac' || name === 'tfrac') && expression[end] === '{') {
      const numeratorEnd = closing(expression, end);
      const denominatorStart = numeratorEnd + 1;
      if (numeratorEnd > 0 && expression[denominatorStart] === '{') {
        const denominatorEnd = closing(expression, denominatorStart);
        if (denominatorEnd > 0) {
          const numerator = flattenLatex(expression.slice(end + 1, numeratorEnd)).trim();
          const denominator = flattenLatex(expression.slice(denominatorStart + 1, denominatorEnd)).trim();
          result += `${operand(numerator)}/${operand(denominator)}`;
          index = denominatorEnd;
          continue;
        }
      }
    }
    if ((name === 'sqrt' || WRAPPERS.has(name)) && expression[end] === '{') {
      const groupEnd = closing(expression, end);
      if (groupEnd > 0) {
        const inner = flattenLatex(expression.slice(end + 1, groupEnd));
        result += name === 'sqrt' ? `√(${inner})` : inner;
        index = groupEnd;
        continue;
      }
    }
    result += COMMANDS.get(name) ?? name;
  }
  return result;
};

/** Tipografía de los signos: menos verdadero y espacios finos alrededor de los operadores. */
const polish = (text: string) => text
  .replace(/(^|[\s(=,[])-(?=[\d.\p{L}(√])/gu, '$1−')
  .replace(/ - /g, ' − ')
  .replace(/\*\*/g, '^');

/** Lee el argumento de `^`/`_` que empieza en `start`; devuelve el texto y dónde sigue. */
const scriptArgument = (text: string, start: number): { value: string; next: number } => {
  if (text[start] === '{') {
    const end = closing(text, start);
    if (end > 0) return { value: text.slice(start + 1, end), next: end + 1 };
  }
  if (text[start] === '(') {
    const end = closing(text, start, '(', ')');
    if (end > 0) return { value: text.slice(start + 1, end), next: end + 1 };
  }
  let end = start;
  if (text[end] === '−' || text[end] === '-' || text[end] === '+') end += 1;
  while (end < text.length && /[\p{L}\p{N}.′*]/u.test(text[end])) end += 1;
  return end > start ? { value: text.slice(start, end), next: end } : { value: '', next: start };
};

/** La expresión en tramos a tres alturas. */
export const mathRuns = (expression: string): MathRun[] => {
  // Un índice Unicode que la fuente no tiene (ₑ, ˡ…) pasa a marca `_`/`^` ANTES de leer las
  // alturas: transliterado después salía como texto («f_e^l»).
  const text = Array.from(polish(flattenLatex(expression)))
    .map((character) => pdfDrawsGlyph(character) ? character : scriptMarker(character) ?? character)
    .join('');
  const runs: MathRun[] = [];
  const push = (value: string, level: MathRun['level']) => {
    if (!value) return;
    const last = runs[runs.length - 1];
    if (last && last.level === level) runs[runs.length - 1] = { text: last.text + value, level };
    else runs.push({ text: value, level });
  };
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if ((character === '^' || character === '_') && index > 0) {
      const { value, next } = scriptArgument(text, index + 1);
      if (value) {
        push(polish(value), character === '^' ? 1 : -1);
        index = next;
        continue;
      }
    }
    push(character, 0);
    index += 1;
  }
  return runs;
};

const runSize = (run: MathRun, size: number) => run.level === 0 ? size : size * SCRIPT_SCALE;

/** Ancho dibujado de los tramos. */
export const measureRuns = (runs: readonly MathRun[], font: PDFFont, size: number): number =>
  runs.reduce((total, run) => total + font.widthOfTextAtSize(pdfText(run.text), runSize(run, size)), 0);

/** Dibuja los tramos con la línea base en `baseline`; devuelve el ancho usado. */
export const drawRuns = (
  page: PDFPage,
  runs: readonly MathRun[],
  x: number,
  baseline: number,
  size: number,
  font: PDFFont,
  color: PdfColor,
): number => {
  let cursor = x;
  for (const run of runs) {
    const shown = pdfText(run.text);
    const scaled = runSize(run, size);
    const y = baseline + (run.level === 1 ? size * RISE : run.level === -1 ? -size * DROP : 0);
    page.drawText(shown, { x: cursor, y, size: scaled, font, color });
    cursor += font.widthOfTextAtSize(shown, scaled);
  }
  return cursor - x;
};
