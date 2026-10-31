/**
 * Front matter: the cover and the contents page.
 *
 * The old cover was a green band with four stacked facts and a nine-entry contents list
 * squeezed underneath, capped at nine because that was where it collided with the
 * professional notice. Two problems: the list could not describe a longer document, and the
 * cover said nothing about the analysis it was covering — a reader had to turn the page to
 * learn whether the model had even solved.
 *
 * It is two pages now. The cover is an identity page: what this document is, of what project,
 * under which scenario, produced when, by what version, and the hash that ties it to the
 * attached file. The contents page is a real contents page, with room for every part and for
 * the sections inside it, indented under their part and leadered to a real folio.
 *
 * Both are stamped last, once every part knows the page it landed on — the same reason
 * `stampChrome` waits for the final page to exist.
 */
import { pdfText, wrapText } from './pdfGlyphs';
import { drawFactColumn, drawWordmark } from './pdfChrome';
import { MARGIN, type PdfLayout } from './pdfBuilder';
import { SPACE, TYPE } from './pdfTheme';
import type { ReportContext } from './reportContext';
import { METHOD_LABEL } from './pdfProcedureSection';

const formatStamp = (value: string): string => {
  const stamp = new Date(value);
  if (Number.isNaN(stamp.valueOf())) return value;
  return `${stamp.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
};

/**
 * Draws the cover on `pageIndex`, which the caller reserved before anything else was drawn.
 * `layout.page` is left where it was: this runs after the document is complete.
 */
export const drawCoverPage = (context: ReportContext, pageIndex: number, professionalNote: string): void => {
  const { layout, project, payload, options } = context;
  const { fonts, palette, width, height } = layout;
  const page = layout.pages[pageIndex];
  if (!page) return;
  layout.markBare(pageIndex);

  // Una franja oscura a la izquierda con la marca: el único gesto gráfico fuerte de la
  // portada, y lo que hace encontrable una pila impresa por el lomo.
  const rail = 118;
  page.drawRectangle({ x: 0, y: 0, width: rail, height, color: palette.band });
  page.drawRectangle({ x: rail - 5, y: 0, width: 5, height, color: palette.accentFill });
  drawWordmark(layout, page, 24, height - 64, 12.5, palette.paper);
  page.drawText(pdfText('MEMORIA DE'), { x: 24, y: 96, size: TYPE.micro, font: fonts.bold, color: palette.inkFaint });
  page.drawText(pdfText('CÁLCULO'), { x: 24, y: 85, size: TYPE.micro, font: fonts.bold, color: palette.inkFaint });

  const left = rail + 46;
  const measure = width - left - MARGIN;

  page.drawText(pdfText('MEMORIA DE CÁLCULO ESTRUCTURAL'), {
    x: left, y: height - 104, size: TYPE.micro + 0.6, font: fonts.bold, color: palette.accent,
  });
  const nameSize = project.name.length > 40 ? 22 : TYPE.display;
  const nameLines = wrapText(project.name, fonts.bold, nameSize, measure).slice(0, 2);
  nameLines.forEach((line, index) => page.drawText(line, {
    x: left, y: height - 140 - index * nameSize * 1.15, size: nameSize, font: fonts.bold, color: palette.ink,
  }));
  const afterName = height - 140 - (nameLines.length - 1) * nameSize * 1.15;
  page.drawRectangle({ x: left, y: afterName - 22, width: 46, height: 3, color: palette.accentFill });
  // El procedimiento elegido es lo que distingue esta copia de las demás del mismo proyecto.
  page.drawText(pdfText(`Procedimiento: ${METHOD_LABEL[context.solutionMethod]}`), {
    x: left, y: afterName - 46, size: TYPE.sub + 2, font: fonts.regular, color: palette.inkSoft,
  });

  const facts: [string, string][] = [
    ['Escenario', options.scenarioName ?? 'Análisis activo'],
    ['Modelo', `${project.nodes.length} nodos · ${project.members.length} miembros · ${payload.metadata.loadCount} acciones`],
    ['Generado', formatStamp(payload.provenance.generatedAt)],
    ['Versión de la aplicación', payload.provenance.appVersion],
    ['Integridad SHA-256', payload.checksum.value],
  ];
  drawFactColumn(layout, page, left, afterName - 104, measure, facts, palette.inkFaint, palette.ink);

  page.drawLine({
    start: { x: left, y: 168 },
    end: { x: width - MARGIN, y: 168 },
    thickness: 0.5,
    color: palette.rule,
  });
  page.drawText(pdfText('AVISO PROFESIONAL'), {
    x: left, y: 152, size: TYPE.micro, font: fonts.bold, color: palette.inkFaint,
  });
  wrapText(professionalNote, fonts.regular, TYPE.small, measure).slice(0, 5).forEach((line, index) => page.drawText(line, {
    x: left, y: 136 - index * TYPE.small * 1.45, size: TYPE.small, font: fonts.regular, color: palette.inkSoft,
  }));
};

/**
 * Contents page, drawn on the index the caller reserved, once every part knows its page.
 *
 * Parts are set at full weight with their two-digit numeral; the sections inside them are
 * indented under their part. There is no ceiling: a document with twenty parts lists twenty.
 */
export const drawContentsPage = (layout: PdfLayout, pageIndex: number): void => {
  const page = layout.pages[pageIndex];
  if (!page || !layout.sections.length) return;
  const { fonts, palette, width, height } = layout;
  layout.markBare(pageIndex);

  page.drawText(pdfText('Contenido'), {
    x: MARGIN, y: height - 118, size: TYPE.title, font: fonts.bold, color: palette.ink,
  });
  page.drawLine({
    start: { x: MARGIN, y: height - 132 },
    end: { x: width - MARGIN, y: height - 132 },
    thickness: 1.1,
    color: palette.ink,
  });

  // Two levels when they fit on one sheet, parts alone when they do not. A contents list that
  // stops halfway down a long document is worse than one that only promises the parts.
  const lineFor = (level: 1 | 2) => (level === 1 ? TYPE.body + 0.6 : TYPE.small) * 2.1 + (level === 1 ? SPACE * 2 : 0);
  const available = height - 160 - 90;
  const fullHeight = layout.sections.reduce((sum, section) => sum + lineFor(section.level), 0);
  const entries = fullHeight <= available
    ? layout.sections
    : layout.sections.filter((section) => section.level === 1);

  let y = height - 160;
  for (const section of entries) {
    const isPart = section.level === 1;
    const size = isPart ? TYPE.body + 0.6 : TYPE.small;
    const font = isPart ? fonts.bold : fonts.regular;
    const color = isPart ? palette.ink : palette.inkSoft;
    if (isPart) y -= SPACE * 2;
    if (y < 90) break;

    const numeral = isPart && section.number !== undefined ? String(section.number).padStart(2, '0') : '';
    if (numeral) {
      page.drawText(numeral, { x: MARGIN, y, size, font: fonts.bold, color: palette.accent });
    }
    const titleX = MARGIN + (isPart ? 26 : 40);
    const title = pdfText(section.title);
    page.drawText(title, { x: titleX, y, size, font, color });

    const folio = String(section.pageIndex + 1);
    const folioWidth = fonts.regular.widthOfTextAtSize(folio, size);
    page.drawText(folio, { x: width - MARGIN - folioWidth, y, size, font, color });

    const from = titleX + fonts.regular.widthOfTextAtSize(title, size) + 6;
    const to = width - MARGIN - folioWidth - 6;
    if (to > from) {
      page.drawLine({ start: { x: from, y: y + 2.2 }, end: { x: to, y: y + 2.2 }, thickness: 0.4, color: palette.rule });
    }
    y -= size * 2.1;
  }
};
