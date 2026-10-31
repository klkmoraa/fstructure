/**
 * A worked relation: the rule in symbols, the same rule with this project's numbers, and the
 * result with its unit — one aligned block, one equation number.
 *
 * The report used to swing between two failures. Before 0.8.4 it printed the identity and
 * stopped (`EI y″ = M`, `Δ = Σ nNL/AE`), which says nothing about the structure being analysed;
 * the fix was to print only the substituted arithmetic, which closes but leaves the reader to
 * infer *which* rule was applied. A memoir needs both, and needs them stacked on the same `=`
 * so the eye can walk down the column: this is the rule, this is the rule with your numbers,
 * this is what came out.
 *
 * The repository's standing constraint is unchanged and load-bearing: a symbolic line is only
 * ever printed *accompanied* by its substitution. `symbolic` alone renders nothing — there is
 * no path through this module that puts an unsubstituted identity on the page — and the callers
 * still gate every block on `agrees(...)`, so a relation whose own numbers do not close is not
 * drawn at all.
 */
import { ALL_UNIT_LABELS } from '../../engine/units';
import { translateExpression } from './mathLatex';
import { drawMathBlock, hasFraction, mathWidth } from './pdfMath';
import { drawRuns, mathRuns, measureRuns } from './pdfInlineMath';
import { pdfText } from './pdfGlyphs';
import type { PdfLayout } from './pdfBuilder';
import type { PdfColor } from './reportContext';

export interface WorkedEquation {
  /** Left-hand side, written once: `M(x)`, `ΣF_y`, `D(AB)`. */
  readonly lhs: string;
  /** The relation in symbols. Never drawn on its own — see the module note. */
  readonly symbolic?: string;
  /** The same relation with this project's numbers. */
  readonly substituted?: string;
  /** What came out. */
  readonly result?: string;
  /** Unit of the result, set upright so it cannot be read as a product of variables. */
  readonly unit?: string;
}

/** A relation already assembled as one string, for the call sites that build their own. */
export type EquationInput = WorkedEquation | string;

/**
 * Every unit label the product can print, across standard and custom unit profiles.
 *
 * Closed and computed once from `engine/units`, which is the single source of these strings —
 * not a hand-written list that could drift from it. It exists so a pre-built relation ending
 * in `… = 17.5 kN` can have its unit set upright without a shape heuristic deciding that some
 * trailing word "looks like" a unit and italicising a variable by mistake.
 */
const UNIT_LABELS = ALL_UNIT_LABELS;

/**
 * Index of the first `=` that is the relation's own, i.e. outside every bracket.
 *
 * `dθ/dx (x = 0) = M/EI` states a derivative *at* x = 0; its first `=` belongs to that
 * argument, not to the relation. Splitting there produced an lhs of `dθ/dx (x` and a
 * substituted side beginning with a stray `)`, which then defeated every later reading of the
 * row — the fraction scanner sees unbalanced brackets and gives up on the whole line.
 */
const topLevelEquals = (text: string): number => {
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') depth -= 1;
    else if (character === '=' && depth === 0) return index;
  }
  return -1;
};

export const asWorkedEquation = (input: EquationInput): WorkedEquation => {
  if (typeof input !== 'string') return input;
  // A pre-built `lhs = rest` string keeps its own shape: splitting it further would guess at
  // which `=` was the relation and which was a step of the arithmetic.
  const at = topLevelEquals(input);
  if (at <= 0) return { lhs: input };
  const lhs = input.slice(0, at).trim();
  const rest = input.slice(at + 1).trim();
  // A trailing unit is peeled off so it can be set upright. Only a word this product actually
  // prints as a unit qualifies, so `= 0 en A` keeps its `A` as the node it names.
  const lastSpace = rest.lastIndexOf(' ');
  const tail = lastSpace === -1 ? '' : rest.slice(lastSpace + 1);
  return UNIT_LABELS.has(tail)
    ? { lhs, substituted: rest.slice(0, lastSpace).trim(), unit: tail }
    : { lhs, substituted: rest };
};

/**
 * Units, upright.
 *
 * `kN·m` set as maths is the product of a `k`, an `N` and an `m`, in italic, which is exactly
 * what it is not. `\mathrm` is TeX's own answer, and the interpunct has to be braced so it
 * keeps its spacing inside the upright run.
 */
const romanUnit = (unit: string): string => {
  const body = unit
    .replaceAll('·', '{\\cdot}')
    .replaceAll('²', '^{2}')
    .replaceAll('³', '^{3}')
    .replaceAll('⁴', '^{4}')
    .replaceAll('/', '/');
  return `\\,\\mathrm{${body}}`;
};

/** The lines of the block, in reading order, each already LaTeX. */
const bodyLines = (equation: WorkedEquation): string[] => {
  const lines: string[] = [];
  // The symbolic form is only worth a line when a substitution follows it; on its own it is
  // the empty identity this whole redesign removed.
  if (equation.symbolic && equation.substituted) lines.push(translateExpression(equation.symbolic));
  if (equation.substituted) {
    // With no separate result row the unit belongs to the substituted line, which is then the
    // last thing the relation says.
    const trailing = equation.result === undefined && equation.unit ? romanUnit(equation.unit) : '';
    lines.push(translateExpression(equation.substituted) + trailing);
  }
  if (equation.result !== undefined) {
    lines.push(translateExpression(equation.result) + (equation.unit ? romanUnit(equation.unit) : ''));
  }
  return lines;
};

/**
 * The whole block as one `aligned` environment, or `undefined` when there is nothing to align.
 *
 * One environment rather than several separately-drawn lines because TeX is what puts the `=`
 * of every row on the same vertical rule; measuring and stacking them here would reimplement
 * that badly.
 */
const buildAlignedLatex = (equation: WorkedEquation): string | undefined => {
  const lines = bodyLines(equation);
  if (!lines.length) return undefined;
  const lhs = translateExpression(equation.lhs);
  const rows = lines.map((line, index) => index === 0 ? `${lhs} &= ${line}` : `&= ${line}`);
  return `\\begin{aligned}${rows.join(' \\\\ ')}\\end{aligned}`;
};

/**
 * Single-line fallback: `lhs = substituted = result unit`.
 *
 * `drawMathBlock` can wrap this across the measure, which an `aligned` environment cannot — it
 * is one indivisible box. So a block too wide for the column, or one MathJax cannot parse, is
 * drawn this way instead of overflowing the margin.
 */
const inlineExpression = (equation: WorkedEquation): string => {
  const parts = [equation.substituted, equation.result].filter((part): part is string => part !== undefined);
  const tail = parts.join(' = ');
  const unit = equation.unit ? ` ${equation.unit}` : '';
  return tail ? `${equation.lhs} = ${tail}${unit}` : equation.lhs;
};

/**
 * Las filas del bloque sin motor TeX: la regla, la regla con los números y el resultado, en
 * notación del solver. Es la versión nativa de `bodyLines`: se dibuja con la fuente del
 * documento y los «=» en columna.
 */
const nativeRows = (equation: WorkedEquation): string[] => {
  const unit = equation.unit ? ` ${equation.unit}` : '';
  const rows: string[] = [];
  if (equation.symbolic && equation.substituted) rows.push(equation.symbolic);
  if (equation.substituted) rows.push(equation.substituted + (equation.result === undefined ? unit : ''));
  if (equation.result !== undefined) rows.push(equation.result + unit);
  return rows;
};

const NATIVE_LEADING = 1.55;

/** `lhs = regla = sustitución = resultado unidad` en un renglón, la forma de una nota de cálculo. */
const nativeInline = (equation: WorkedEquation): string => {
  const rows = nativeRows(equation);
  return rows.length ? `${equation.lhs} = ${rows.join(' = ')}` : equation.lhs;
};

/**
 * Una relación corta cabe en un renglón y se lee mejor así; partirla en tres filas sólo tiene
 * sentido cuando no cabe. Antes `ΔX = Xⱼ − Xᵢ = 0 − 0 = 0 m` ocupaba tres renglones y la
 * geometría de un pórtico llenaba páginas.
 */
const fitsInline = (layout: PdfLayout, equation: WorkedEquation, size: number, available: number): boolean =>
  measureRuns(mathRuns(nativeInline(equation)), layout.fonts.mathRegular, size) + size * 3 <= available * 0.94;

/** Geometría del bloque alineado nativo, o `null` si no cabe en la medida. */
const nativeAligned = (layout: PdfLayout, equation: WorkedEquation, size: number, available: number) => {
  const rows = nativeRows(equation);
  if (!rows.length) return null;
  const font = layout.fonts.mathRegular;
  const lhsWidth = measureRuns(mathRuns(equation.lhs), font, size);
  const equals = font.widthOfTextAtSize(' = ', size);
  // Reserva para el número de la ecuación, que va a la derecha.
  const tagRoom = size * 3;
  const widest = Math.max(...rows.map((row) => measureRuns(mathRuns(row), font, size)));
  if (lhsWidth + equals + widest + tagRoom > available) return null;
  return { rows, lhsWidth, equals };
};

/** Height `drawWorkedEquation` will consume, so a caller can break the page first. */
export const measureWorkedEquation = (
  layout: PdfLayout,
  equation: WorkedEquation,
  size: number,
  indent: number,
): number => {
  const latex = buildAlignedLatex(equation);
  const available = layout.contentWidth - indent;
  if (latex && layout.rawMathWidth(latex, size) <= available) {
    // One line of leading per row, plus the extra a stacked fraction needs on any of them.
    const rows = bodyLines(equation).length;
    return rows * size * (hasFraction(inlineExpression(equation)) ? 2.05 : 1.5) + size * 0.4;
  }
  if (!latex || layout.rawMathWidth(latex, size) === Number.POSITIVE_INFINITY) {
    if (fitsInline(layout, equation, size, available)) return size * NATIVE_LEADING + size * 0.35;
  }
  const native = nativeAligned(layout, equation, size, available);
  if (native) return native.rows.length * size * NATIVE_LEADING + size * 0.5;
  const inline = inlineExpression(equation);
  const lines = Math.max(1, Math.ceil(mathWidth(layout, inline, size) / Math.max(1, available)));
  return lines * size * (hasFraction(inline) ? 2.05 : 1.45);
};

/**
 * Draws the block at the layout's cursor and returns the height it consumed.
 *
 * The equation number tags the block as a whole, not its last row: the three rows are one
 * relation, and numbering them separately would invite a cross-reference to half of it.
 */
export const drawWorkedEquation = (
  layout: PdfLayout,
  equation: WorkedEquation,
  size: number,
  indent: number,
  color: PdfColor,
  tag?: string,
): number => {
  const latex = buildAlignedLatex(equation);
  const available = layout.contentWidth - indent;
  if (latex && layout.rawMathWidth(latex, size) <= available) {
    return layout.drawRawMathAt(latex, size, indent, color, tag);
  }
  if (fitsInline(layout, equation, size, available)) {
    const font = layout.fonts.mathRegular;
    const baseline = layout.y - size;
    drawRuns(layout.page, mathRuns(nativeInline(equation)), layout.margin + indent, baseline, size, font, color);
    if (tag) {
      const shown = pdfText(tag);
      const tagSize = size * 0.9;
      layout.page.drawText(shown, {
        x: layout.margin + layout.contentWidth - font.widthOfTextAtSize(shown, tagSize), y: baseline, size: tagSize, font, color: layout.palette.inkFaint,
      });
    }
    return size * NATIVE_LEADING + size * 0.35;
  }
  const native = nativeAligned(layout, equation, size, available);
  if (native) {
    const font = layout.fonts.mathRegular;
    const x = layout.margin + indent;
    const column = x + native.lhsWidth;
    native.rows.forEach((row, index) => {
      const baseline = layout.y - size - index * size * NATIVE_LEADING;
      if (index === 0) drawRuns(layout.page, mathRuns(equation.lhs), x, baseline, size, font, color);
      layout.page.drawText(pdfText(' = '), { x: column, y: baseline, size, font, color });
      drawRuns(layout.page, mathRuns(row), column + native.equals, baseline, size, font, color);
    });
    if (tag) {
      // Junto al centro del bloque: numera la relación entera, no su última fila.
      const shown = pdfText(tag);
      const tagSize = size * 0.9;
      const middle = layout.y - size - ((native.rows.length - 1) * size * NATIVE_LEADING) / 2;
      layout.page.drawText(shown, {
        x: layout.margin + layout.contentWidth - font.widthOfTextAtSize(shown, tagSize), y: middle, size: tagSize, font, color: layout.palette.inkFaint,
      });
    }
    return native.rows.length * size * NATIVE_LEADING + size * 0.5;
  }
  return drawMathBlock(layout, inlineExpression(equation), layout.margin + indent, layout.y, available, size, color, { tag });
};
