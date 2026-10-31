/**
 * The report's design system: one palette, one type scale, one spacing unit.
 *
 * Until 0.8.3 the document invented its own look — a forest-green masthead, green section
 * bands, bordered panels — that appears nowhere in the product, and its diagrams used a third
 * set of colours again: axial drawn blue on paper and teal on screen, moment red on paper and
 * orange on screen. A reader who moves between the app and the signed memoir was being asked
 * to learn the same structure twice.
 *
 * So the palette is no longer invented here. Every value below is lifted from
 * `src/design-system/tokens.css`, the product's single source of colour, in its light
 * appearance — the one that is correct on white paper. The hexes are duplicated rather than
 * parsed because this module runs in a worker-free, DOM-free path (`pdf-lib` only) where no
 * stylesheet exists to read; the comment beside each one names the token it mirrors, so the
 * two can be diffed by eye and by `pdfTheme.test.ts`.
 */
import type { PdfColor, RgbFactory } from './reportContext';

/** `#1d1d1f` -> the three 0..1 components `pdf-lib`'s `rgb()` wants. */
const fromHex = (hex: string): [number, number, number] => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [
    Number.parseInt(full.slice(0, 2), 16) / 255,
    Number.parseInt(full.slice(2, 4), 16) / 255,
    Number.parseInt(full.slice(4, 6), 16) / 255,
  ];
};

/**
 * Token name -> hex, mirroring `tokens.css` light appearance.
 *
 * Grouped the way the document reads them: the achromatic ramp carries every surface and
 * every rule, the accent is the single brand colour, and the technical hues are reserved for
 * the one thing that needs colour to be understood — which quantity a curve represents.
 */
const REPORT_TOKENS = {
  /** Papel de impresión: blanco puro (el `--fs-paper-0` de pantalla tiñe la impresión). */
  paper: '#ffffff',
  /** `--fs-paper-50`: fondo de una fila alterna o de un bloque tranquilo. */
  tint: '#f7f6f1',
  /** `--fs-paper-100` */
  tintDeep: '#edefe9',
  /** `--fs-paper-300`: cada filete del documento; impreso, el 200 desaparece. */
  rule: '#c6cdc6',
  /** `--fs-paper-500` */
  inkFaint: '#7e8a84',
  /** `--fs-paper-600` = `--sc-color-text-tertiary` */
  inkSoft: '#5c6a6f',
  /** `--fs-paper-900` = `--sc-color-text-primary` */
  ink: '#14171a',
  /** `--fs-paper-950`: fondo de la portada y los numerales de parte. */
  band: '#14171a',
  /** `--sc-color-action-ink`: el acento de FStructure (familia Análisis) como texto sobre papel. */
  accent: '#c23a33',
  /** `--fs-family-analisis`: el acento en relleno (la franja de la marca). */
  accentFill: '#ed4b46',
  /** `--fs-signal-axial` */
  axial: '#0f95d1',
  /** `--fs-signal-shear` */
  shear: '#468c09',
  /** `--fs-signal-moment` */
  moment: '#ed4b46',
  /** `--sc-color-technical-reaction` = `--fs-green` */
  reaction: '#468c09',
  /** `--fs-load-point` */
  load: '#1a4fe0',
  /** `--fs-load-distributed` */
  loadDistributed: '#ee5116',
  /** `--fs-signal-deformed` */
  deformed: '#8b5cf6',
  /** `--fs-status-disponible` */
  ok: '#2f7d32',
  /** `--fs-signal-attention`, oscurecido para texto impreso */
  warn: '#b35c00',
  /** `--sc-color-action-ink` */
  danger: '#c23a33',
} as const;

type ReportTokenName = keyof typeof REPORT_TOKENS;

/**
 * Type scale.
 *
 * Six steps, each a role rather than a size, so a heading never gets picked by eye. The
 * ratio is roughly 1.2 between neighbours at the small end and opens up at the display end,
 * where the jump has to survive being read across a room rather than at arm's length.
 */
export const TYPE = {
  /** Cover title. */
  display: 30,
  /** Project name on the cover, part titles. */
  title: 20,
  /** Section heading inside a part. */
  section: 13,
  /** Sub-heading. */
  sub: 10.5,
  /** Running body copy: 10 pt de Plex Sans se lee impreso sin esfuerzo. */
  body: 10,
  /** Ecuaciones desarrolladas. */
  math: 10,
  /** Captions, table cells, the running head. */
  small: 8.8,
  /** Labels in small caps, the footer. */
  micro: 7.4,
} as const;

/** Vertical rhythm. Every gap in the document is a multiple of this. */
export const SPACE = 4;

export interface ReportPalette {
  readonly paper: PdfColor;
  readonly tint: PdfColor;
  readonly tintDeep: PdfColor;
  readonly rule: PdfColor;
  readonly inkFaint: PdfColor;
  readonly inkSoft: PdfColor;
  readonly ink: PdfColor;
  readonly band: PdfColor;
  readonly accent: PdfColor;
  readonly accentFill: PdfColor;
  readonly loadDistributed: PdfColor;
  readonly reaction: PdfColor;
  readonly load: PdfColor;
  readonly deformed: PdfColor;
  readonly ok: PdfColor;
  readonly warn: PdfColor;
  readonly danger: PdfColor;
  /** The three response quantities, in the product's own hues. */
  readonly quantity: Readonly<Record<'axial' | 'shear' | 'moment', PdfColor>>;
}

export const createPalette = (rgb: RgbFactory): ReportPalette => {
  const of = (name: ReportTokenName): PdfColor => rgb(...fromHex(REPORT_TOKENS[name]));
  return {
    paper: of('paper'),
    tint: of('tint'),
    tintDeep: of('tintDeep'),
    rule: of('rule'),
    inkFaint: of('inkFaint'),
    inkSoft: of('inkSoft'),
    ink: of('ink'),
    band: of('band'),
    accent: of('accent'),
    accentFill: of('accentFill'),
    loadDistributed: of('loadDistributed'),
    reaction: of('reaction'),
    load: of('load'),
    deformed: of('deformed'),
    ok: of('ok'),
    warn: of('warn'),
    danger: of('danger'),
    quantity: { axial: of('axial'), shear: of('shear'), moment: of('moment') },
  };
};
