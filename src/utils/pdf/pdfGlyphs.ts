/**
 * Text sanitising and wrapping for the report fonts.
 *
 * With the embedded IBM Plex Sans every glyph it carries is drawn as is. Without it (the
 * standard fonts only carry WinAnsi) `pdfText` transliterates every engineering glyph
 * explicitly instead of dropping to a replacement box.
 */
import type { PDFFont } from 'pdf-lib';

/**
 * Unicode super/subscripts, as the `^x`/`_x` markers the fórmula typesetter understands.
 *
 * `ᵢ` (U+1D62) and `ⱼ` (U+2C7C) are Unicode *subscripts*. They were mapped to `^i`/`^j`,
 * which printed the solver's `ΔX = Xⱼ − Xᵢ` — a difference between node indices — as if the
 * indices were exponents.
 */
const SCRIPT_GLYPHS = new Map<string, string>([
  ['²', '^2'], ['³', '^3'], ['⁴', '^4'], ['⁵', '^5'], ['⁶', '^6'], ['⁷', '^7'], ['⁸', '^8'], ['⁹', '^9'], ['⁰', '^0'], ['ᵀ', '^T'],
  ['₀', '_0'], ['₁', '_1'], ['₂', '_2'], ['₃', '_3'], ['₄', '_4'], ['₅', '_5'], ['₆', '_6'], ['₇', '_7'], ['₈', '_8'], ['₉', '_9'],
  ['ₐ', '_a'], ['ₑ', '_e'], ['ₙ', '_n'], ['ₛ', '_s'], ['ₓ', '_x'], ['ᵧ', '_y'], ['ᵢ', '_i'], ['ⱼ', '_j'],
  ['ᵃ', '^a'], ['ᵉ', '^e'], ['ᵍ', '^g'], ['ˡ', '^l'], ['ⁿ', '^n'],
]);


/** `^2`, `_e`… para un índice Unicode que la fuente no dibuja; `undefined` si no es un índice. */
export const scriptMarker = (character: string): string | undefined => SCRIPT_GLYPHS.get(character);

/** Standard PDF fonts use WinAnsi; transliterate engineering glyphs explicitly. */
const PDF_GLYPHS = new Map<string, string>([
  ...SCRIPT_GLYPHS,
  ['−', '-'], ['–', '-'], ['—', '-'],
  // U+00B7 MIDDLE DOT is WinAnsi, so it needs no transliteration at all — it used to be
  // rewritten to ` x `, which turned `kN·m` into `kN x m` and every `A · B` separator in the
  // prose into a multiplication sign. Its non-WinAnsi twin U+22C5 folds onto it.
  ['⋅', '·'],
  ['Σ', 'Sum'], ['∑', 'Sum'], ['Δ', 'Delta'], ['δ', 'delta'], ['θ', 'theta'], ['Θ', 'Theta'], ['ξ', 'xi'], ['Ξ', 'Xi'],
  ['α', 'alpha'], ['β', 'beta'], ['γ', 'gamma'], ['Γ', 'Gamma'], ['ε', 'epsilon'], ['ζ', 'zeta'], ['η', 'eta'],
  ['κ', 'kappa'], ['λ', 'lambda'], ['Λ', 'Lambda'], ['μ', 'mu'], ['ν', 'nu'], ['π', 'pi'], ['Π', 'Pi'],
  ['ρ', 'rho'], ['σ', 'sigma'], ['τ', 'tau'], ['φ', 'phi'], ['Φ', 'Phi'], ['χ', 'chi'], ['ψ', 'psi'], ['ω', 'omega'], ['Ω', 'Omega'],
  ['≤', '<='], ['≥', '>='], ['≈', '~='], ['≠', '!='], ['±', '+/-'], ['×', ' x '], ['÷', '/'],
  ['→', '->'], ['←', '<-'], ['↔', '<->'], ['⇒', '=>'], ['⇐', '<='], ['√', 'sqrt'], ['∫', 'Integral'],
  ['∞', 'inf'], ['∂', 'd'], ['∇', 'grad'], ['∥', '||'], ['⊗', '(x)'], ['⊕', '(+)'],
  ['“', '"'], ['”', '"'], ['‘', "'"], ['’', "'"], ['…', '...'], ['⟨', '<'], ['⟩', '>'],
  // Primas y signos volados de la notación de concreto (f′c, M⁺, M⁻) y marcas de lista.
  ['′', "'"], ['″', '"'], ['⁺', '+'], ['⁻', '-'], ['◇', '*'], ['○', 'o'], ['✓', 'ok'], ['✗', 'x'],
]);

/** WinAnsi covers Latin-1, so `á é í ó ú ñ ü ¿ ¡ °` survive; anything above it does not. */
const isWinAnsi = (character: string): boolean => {
  const code = character.charCodeAt(0);
  return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 255);
};

const transliterate = (value: unknown, keep: (character: string) => boolean): string =>
  Array.from(String(value))
    .map((character) => {
      if (keep(character)) return character;
      const replacement = PDF_GLYPHS.get(character);
      if (replacement !== undefined) return replacement;
      return isWinAnsi(character) ? character : '';
    })
    .join('');

/**
 * Caracteres que la fuente incrustada de esta exportación sabe dibujar. Con IBM Plex Sans
 * (`pdfFonts.ts`) se conservan ξ, ≤, x², Σ…; sin ella (`null`) todo lo que no es WinAnsi se
 * deletrea como antes. `createCalculationReport` la fija al empezar y la retira al terminar.
 */
let coverage: ReadonlySet<number> | null = null;

export const setPdfGlyphCoverage = (codePoints: readonly number[] | null): void => {
  coverage = codePoints ? new Set(codePoints) : null;
};

/** ¿Dibuja la fuente de esta exportación el carácter tal cual? */
export const pdfDrawsGlyph = (character: string): boolean => coverage?.has(character.codePointAt(0) ?? -1) ?? false;

/** Prose for the report faces: Unicode when the embedded font has the glyph, spelled out otherwise. */
export const pdfText = (value: unknown): string => transliterate(value, pdfDrawsGlyph);

export const wrapText = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
  const paragraphs = pdfText(text).split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
        continue;
      }
      let fragment = '';
      for (const character of word) {
        if (fragment && font.widthOfTextAtSize(fragment + character, size) > maxWidth) {
          lines.push(fragment);
          fragment = character;
        } else fragment += character;
      }
      line = fragment;
    }
    if (line) lines.push(line);
  }
  return lines;
};
