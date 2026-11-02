/**
 * Piezas comunes de una memoria de cálculo. Cada procedimiento se escribe con el mismo
 * esquema, el de una memoria de oficina:
 *
 *   Datos → Planteamiento (la ecuación que gobierna, con «donde:») → Desarrollo (la sustitución
 *   numerada, paso a paso) → Resultados (recuadro) → Comprobación (una línea contra el análisis
 *   matricial).
 *
 * El texto es breve e impersonal («Se aplica…», «Se obtiene…»); las cifras van en las fórmulas
 * y en las tablas, no en párrafos. Las fórmulas se escriben en la notación del solver
 * (`R_y(N2)`, `x^2`, `ΣM_A`, `√(…)`, `a/b`); `pdfInlineMath` las dibuja con índices reales,
 * variables en cursiva y el resultado en seminegrita.
 */
import { drawWorkedEquation, measureWorkedEquation, type EquationInput, asWorkedEquation } from './pdfEquation';
import { mathFaces } from './pdfMath';
import { drawRuns, mathRuns, measureRuns } from './pdfInlineMath';
import type { PdfTableColumn } from './pdfBuilder';
import { SPACE, TYPE } from './pdfTheme';
import type { ReportContext } from './reportContext';

const FORMULA_INDENT = 18;

/** Parte un texto con índices en renglones de `width` como máximo, midiendo como `drawRich`. */
const wrapRich = (context: ReportContext, text: string, font: import('pdf-lib').PDFFont, size: number, width: number): string[] => {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.layout.richWidth(candidate, font, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
};

/** Título numerado de un paso del procedimiento («3.2 Reacciones»). */
export const memoirStep = (context: ReportContext, title: string): void => {
  context.layout.heading(title, 2);
};

/** Un párrafo corto. Si pasa de dos renglones, probablemente sobra. */
export const memoirNote = (context: ReportContext, text: string): void => {
  context.layout.text(text, TYPE.body, context.layout.fonts.regular, context.layout.palette.ink, 0);
};

/**
 * Datos del paso, en tabla: magnitud, símbolo, valor y unidad. Es lo primero que lee quien
 * revisa una memoria, antes de cualquier fórmula.
 */
export const memoirData = (
  context: ReportContext,
  rows: ReadonlyArray<readonly [magnitude: string, symbol: string, value: string, unit: string]>,
): void => {
  if (!rows.length) return;
  const columns: PdfTableColumn[] = [
    { header: 'Dato' },
    { header: 'Símbolo', width: 90, math: true },
    { header: 'Valor', width: 100, align: 'right' },
    { header: 'Unidad', width: 70 },
  ];
  context.layout.table(columns, rows.map((row) => [...row]));
};

/**
 * La ecuación que gobierna el paso, sola y destacada, y debajo «donde:» con el significado de
 * cada símbolo. Es la única fórmula que se escribe sin números: los números vienen después,
 * en el desarrollo.
 */
export const memoirFormula = (
  context: ReportContext,
  formula: string,
  where: ReadonlyArray<readonly [symbol: string, meaning: string]> = [],
): void => {
  const { layout } = context;
  const size = TYPE.math + 1;
  const faces = mathFaces(layout);
  const runs = mathRuns(formula);
  const width = measureRuns(runs, faces, size);
  layout.ensure(size * 2.4 + where.length * TYPE.small * 1.6);
  layout.gap(1);
  const x = layout.margin + Math.max(FORMULA_INDENT, (layout.contentWidth - width) / 2);
  drawRuns(layout.page, runs, Math.min(x, layout.margin + layout.contentWidth - width), layout.y - size, size, faces, layout.palette.ink);
  layout.y -= size * 1.9;
  if (where.length) {
    layout.text('donde:', TYPE.small, layout.fonts.regular, layout.palette.inkSoft, FORMULA_INDENT);
    for (const [symbol, meaning] of where) {
      const symbolWidth = measureRuns(mathRuns(symbol), faces, TYPE.small + 0.6);
      const textX = layout.margin + FORMULA_INDENT + 16 + Math.max(symbolWidth, 34);
      // Un significado largo sigue en el renglón de abajo, alineado con su primera palabra.
      const lines = wrapRich(context, `— ${meaning}`, layout.fonts.regular, TYPE.small, layout.margin + layout.contentWidth - textX);
      layout.ensure(TYPE.small * 1.55 * lines.length + TYPE.small * 0.2);
      const baseline = layout.y - TYPE.small;
      drawRuns(layout.page, mathRuns(symbol), layout.margin + FORMULA_INDENT + 10, baseline, TYPE.small + 0.6, faces, layout.palette.ink);
      lines.forEach((line, index) => {
        layout.drawRich(index ? `  ${line}` : line, { x: textX, y: baseline - index * TYPE.small * 1.45, size: TYPE.small, font: layout.fonts.regular, color: layout.palette.inkSoft });
      });
      layout.y -= TYPE.small * 1.45 * (lines.length - 1) + TYPE.small * 1.55;
    }
  }
  layout.gap(1);
};

/** Desarrollo: relaciones numeradas, cada una `lhs = regla = sustitución = resultado`. */
export const memoirWork = (context: ReportContext, equations: readonly EquationInput[], caption?: string): void => {
  const { layout } = context;
  if (caption) layout.text(caption, TYPE.small, layout.fonts.bold, layout.palette.inkSoft, FORMULA_INDENT - 6);
  for (const input of equations) {
    const equation = asWorkedEquation(input);
    layout.ensure(measureWorkedEquation(layout, equation, TYPE.math, FORMULA_INDENT));
    layout.y -= drawWorkedEquation(layout, equation, TYPE.math, FORMULA_INDENT, layout.palette.ink, `(${layout.nextEquationNumber()})`);
  }
};

/**
 * Recuadro de resultados del paso: lo que se lleva al siguiente paso o a la conclusión. Fondo
 * suave, filete a la izquierda en el color del acento, cifras en seminegrita.
 */
export const memoirResults = (
  context: ReportContext,
  title: string,
  rows: ReadonlyArray<readonly [symbol: string, value: string]>,
): void => {
  const { layout } = context;
  const { palette, fonts } = layout;
  if (!rows.length) return;
  const size = TYPE.math;
  const line = size * 1.6;
  const columns = rows.length > 4 ? 2 : 1;
  const perColumn = Math.ceil(rows.length / columns);
  const height = TYPE.micro + 10 + perColumn * line + 8;
  layout.ensure(height + SPACE * 2);
  const top = layout.y;
  layout.page.drawRectangle({ x: layout.margin, y: top - height, width: layout.contentWidth, height, color: palette.tint });
  layout.page.drawRectangle({ x: layout.margin, y: top - height, width: 3, height, color: palette.accentFill });
  layout.page.drawText(title.toUpperCase(), { x: layout.margin + 12, y: top - TYPE.micro - 6, size: TYPE.micro, font: fonts.bold, color: palette.inkSoft });
  const faces = mathFaces(layout);
  const bold = { upright: fonts.mathBold ?? fonts.bold, italic: fonts.mathBold ?? fonts.bold };
  const columnWidth = (layout.contentWidth - 24) / columns;
  rows.forEach(([symbol, value], index) => {
    const column = Math.floor(index / perColumn);
    const row = index % perColumn;
    const x = layout.margin + 12 + column * columnWidth;
    const baseline = top - TYPE.micro - 12 - size - row * line;
    const used = drawRuns(layout.page, mathRuns(`${symbol} = `), x, baseline, size, faces, palette.ink);
    drawRuns(layout.page, mathRuns(value), x + used, baseline, size, bold, palette.ink);
  });
  layout.y = top - height - SPACE * 2;
};

/**
 * Comprobación en una línea: el valor del procedimiento, el del análisis matricial y la
 * diferencia. Verde si coinciden dentro de la tolerancia del método, ámbar si no.
 */
export const memoirCheck = (context: ReportContext, text: string, ok: boolean): void => {
  const { layout } = context;
  const lines = wrapRich(context, `${ok ? 'Comprobación' : 'Comprobación (revisar)'}: ${text}`, layout.fonts.bold, TYPE.body, layout.contentWidth);
  layout.ensure(TYPE.body * (1.4 * lines.length + 1));
  lines.forEach((line, index) => {
    layout.drawRich(line, {
      x: layout.margin, y: layout.y - TYPE.body - index * TYPE.body * 1.4, size: TYPE.body, font: layout.fonts.bold, color: ok ? layout.palette.ok : layout.palette.warn,
    });
  });
  layout.y -= TYPE.body * 1.4 * (lines.length - 1) + TYPE.body * 1.9;
};
