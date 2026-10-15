/**
 * Despiece exportable de una pieza: CSV para hojas de cálculo y una lámina SVG
 * autónoma. Ambos salen de la misma cuantificación que la mesa y el PDF
 * (`Takeoff`), sin recalcular nada; aquí sólo se da formato.
 */
import { rebarLabel } from './shared';
import { takeoffBarUsage, type Takeoff, type TakeoffLine, type TakeoffShape } from './takeoff';

/** Las mismas columnas que la tabla «Cuantificación» del PDF. */
export const TAKEOFF_CSV_COLUMNS = ['Marca', 'Varilla', 'Piezas', 'Longitud por pieza (m)', 'Masa (kg)'] as const;
export const TAKEOFF_TOTAL_LABEL = 'Total de acero';

const BOM = '﻿';

/** Celda RFC 4180: entre comillas si lleva coma, comillas o salto de línea. */
export const csvCell = (value: string): string => {
  // Un texto que empieza como fórmula se neutraliza para que la hoja no lo evalúe.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const takeoffBarText = (item: Pick<TakeoffLine, 'mark' | 'diameterMm'>) => rebarLabel(item.diameterMm, takeoffBarUsage(item.mark));

/**
 * CSV del despiece: una fila por marca y la del total. Separador «,», decimales
 * con punto, fin de línea CRLF y BOM UTF-8 para que las hojas de cálculo lean
 * bien los acentos.
 */
export function takeoffCsv(takeoff: Pick<Takeoff, 'lines' | 'steelKg'>): string {
  const rows: (readonly string[])[] = [
    TAKEOFF_CSV_COLUMNS,
    ...takeoff.lines.map((item) => [item.mark, takeoffBarText(item), String(item.count), item.pieceLengthM.toFixed(2), item.massKg.toFixed(1)]),
    [TAKEOFF_TOTAL_LABEL, '', '', '', takeoff.steelKg.toFixed(1)],
  ];
  return BOM + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const xml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fixed = (value: number, digits: number) => value.toLocaleString('es-MX', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const m = (value: number) => `${fixed(value, 2)} m`;
const cm = (mm: number) => `${fixed(mm / 10, 1).replace(/\.0$/, '')} cm`;
const n = (value: number) => Number(value.toFixed(1));

const WIDTH = 820;
const HEADER = 92;
const ROW = 108;
const SHAPE_LEFT = 40;
const SHAPE_WIDTH = 380;
const TEXT_LEFT = 480;

const wrap = (text: string, max: number): string[] => {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    if (current && `${current} ${word}`.length > max) { lines.push(current); current = word; } else current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(current);
  return lines;
};

/** Cota horizontal con marcas en los extremos y su texto debajo. */
const hDimension = (x0: number, x1: number, y: number, label: string) =>
  `<g class="dim"><line x1="${n(x0)}" y1="${n(y)}" x2="${n(x1)}" y2="${n(y)}"/><line x1="${n(x0)}" y1="${n(y - 4)}" x2="${n(x0)}" y2="${n(y + 4)}"/><line x1="${n(x1)}" y1="${n(y - 4)}" x2="${n(x1)}" y2="${n(y + 4)}"/><text x="${n((x0 + x1) / 2)}" y="${n(y + 15)}" text-anchor="middle">${xml(label)}</text></g>`;

/** Dibujo esquemático de una pieza dentro de su fila (origen arriba a la izquierda de la fila). */
function shapeSvg(item: TakeoffLine, shape: TakeoffShape, longestM: number): string {
  // Escala esquemática: la longitud de cada pieza contra la más larga del despiece, sin bajar de un mínimo legible.
  const span = (meters: number) => Math.max(72, Math.min(SHAPE_WIDTH, meters / Math.max(longestM, 1e-9) * SHAPE_WIDTH));
  const barY = 34;
  switch (shape.kind) {
    case 'hooked': {
      const straightM = Math.max(0, item.pieceLengthM - shape.hooks * shape.hookMm / 1e3);
      const width = span(straightM);
      const leg = Math.max(12, Math.min(30, shape.hookMm / 1e3 / Math.max(longestM, 1e-9) * SHAPE_WIDTH));
      const x0 = SHAPE_LEFT, x1 = SHAPE_LEFT + width;
      const path = shape.hooks === 2
        ? `M${n(x0)},${n(barY - leg)} V${barY} H${n(x1)} V${n(barY - leg)}`
        : `M${n(x0)},${barY} H${n(x1)} V${n(barY - leg)}`;
      return `<path class="bar" d="${path}"/>`
        + hDimension(x0, x1, barY + 16, m(straightM))
        + `<text class="hook" x="${x0}" y="${barY + 50}">${xml(`${shape.hooks === 2 ? '2 ganchos' : 'gancho'} 90° de ${cm(shape.hookMm)}`)}</text>`;
    }
    case 'stirrup': {
      const scale = Math.min(60 / Math.max(shape.heightMm, 1), 150 / Math.max(shape.widthMm, 1));
      const w = Math.max(24, shape.widthMm * scale), h = Math.max(18, shape.heightMm * scale);
      const x0 = SHAPE_LEFT, y0 = 4;
      const hook = 9;
      return `<rect class="bar" x="${x0}" y="${y0}" width="${n(w)}" height="${n(h)}" rx="2"/>`
        + `<path class="bar" d="M${n(x0)},${n(y0 + 4)} l${hook},${hook} M${n(x0 + 4)},${n(y0)} l${hook},${hook}"/>`
        + `<text class="hook" x="${n(x0 + w + 14)}" y="${n(y0 + h / 2 - 3)}">${xml(`Lados ${cm(shape.widthMm)} × ${cm(shape.heightMm)}`)}</text>`
        + `<text class="hook" x="${n(x0 + w + 14)}" y="${n(y0 + h / 2 + 13)}">${xml(`2 ganchos 135° de ${cm(shape.hookMm)}`)}</text>`;
    }
    case 'tie': {
      const straightM = Math.max(0, item.pieceLengthM - 2 * shape.hookMm / 1e3);
      const width = Math.min(span(straightM), 220);
      const x0 = SHAPE_LEFT, x1 = SHAPE_LEFT + width;
      return `<path class="bar" d="M${n(x0 + 10)},${n(barY - 10)} L${n(x0)},${barY} H${n(x1)} L${n(x1 - 10)},${n(barY - 10)}"/>`
        + hDimension(x0, x1, barY + 16, m(straightM))
        + `<text class="hook" x="${x0}" y="${barY + 50}">${xml(`2 ganchos 135° de ${cm(shape.hookMm)}`)}</text>`;
    }
    case 'hoop': {
      const r = 24;
      const cx = SHAPE_LEFT + r, cy = 32;
      return `<circle class="bar" cx="${cx}" cy="${cy}" r="${r}"/>`
        + `<path class="bar" d="M${cx},${cy - r} l9,9 M${cx + 5},${cy - r - 1} l9,9"/>`
        + `<text class="hook" x="${cx + r + 12}" y="${cy + 4}">${xml(`Ø eje ${cm(shape.diameterMm)} · 2 ganchos 135°`)}</text>`;
    }
    case 'spiral': {
      const turns = 6, width = 150, rise = width / turns;
      let d = `M${SHAPE_LEFT},${barY}`;
      for (let index = 0; index < turns; index++) {
        const x = SHAPE_LEFT + index * rise;
        d += ` C${n(x + rise * 0.15)},${barY - 26} ${n(x + rise * 0.85)},${barY - 26} ${n(x + rise)},${barY} C${n(x + rise * 0.85)},${barY + 26} ${n(x + rise * 0.15)},${barY + 26} ${n(x)},${barY}`;
        if (index < turns - 1) d += ` M${n(x + rise)},${barY}`;
      }
      return `<path class="bar thin" d="${d}"/>`
        + `<text class="hook" x="${SHAPE_LEFT + width + 12}" y="${barY + 4}">${xml(`Ø ${cm(shape.diameterMm)} · paso ${cm(shape.pitchMm)}`)}</text>`;
    }
    case 'straight':
    default: {
      const width = span(item.pieceLengthM);
      return `<path class="bar" d="M${SHAPE_LEFT},${barY} H${n(SHAPE_LEFT + width)}"/>` + hDimension(SHAPE_LEFT, SHAPE_LEFT + width, barY + 16, m(item.pieceLengthM));
    }
  }
}

/** Forma de la línea; las que no la traen (estudio de sección) se dibujan rectas. */
const shapeOf = (item: TakeoffLine): TakeoffShape => item.shape ?? { kind: 'straight' };

/**
 * Lámina SVG del despiece: una fila por marca con la forma esquemática, sus
 * cotas, la cantidad y el diámetro. Documento autónomo (estilos incrustados,
 * fuentes del sistema) sobre fondo claro.
 */
export function takeoffSvg(takeoff: Takeoff, title: string): string {
  const longestM = takeoff.lines.reduce((max, item) => Math.max(max, item.pieceLengthM), 0);
  const notes = wrap(takeoff.basis, 118);
  const footerTop = HEADER + takeoff.lines.length * ROW + 12;
  const height = footerTop + 48 + notes.length * 15 + 16;
  const rows = takeoff.lines.map((item, index) => {
    const y = HEADER + index * ROW;
    return `<g class="row" data-mark="${xml(item.mark)}" transform="translate(0 ${y})">`
      + (index % 2 ? `<rect class="band" x="16" y="0" width="${WIDTH - 32}" height="${ROW}"/>` : '')
      + `<g transform="translate(0 14)">${shapeSvg(item, shapeOf(item), longestM)}</g>`
      + `<text class="mark" x="${TEXT_LEFT}" y="30">${xml(item.mark)}</text>`
      + `<text class="meta" x="${TEXT_LEFT}" y="52">${xml(`${item.count} ${item.count === 1 ? 'pieza' : 'piezas'} · ${takeoffBarText(item)} (Ø ${fixed(item.diameterMm, 1)} mm)`)}</text>`
      + `<text class="meta" x="${TEXT_LEFT}" y="72">${xml(`${m(item.pieceLengthM)} por pieza · ${fixed(item.massKg, 1)} kg`)}</text>`
      + `<line class="rule" x1="16" y1="${ROW}" x2="${WIDTH - 16}" y2="${ROW}"/>`
      + '</g>';
  }).join('');
  const totals = `Total de acero ${fixed(takeoff.steelKg, 1)} kg · concreto ${fixed(takeoff.concreteM3, 3)} m³ · ${fixed(takeoff.steelRatioKgM3, 0)} kg/m³`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${n(height)}" viewBox="0 0 ${WIDTH} ${n(height)}" role="img" aria-label="${xml(`Despiece: ${title}`)}">
<title>${xml(`Despiece · ${title}`)}</title>
<style>
text{font-family:Inter,"Segoe UI",Helvetica,Arial,sans-serif;fill:#14171A}
.title{font-size:20px;font-weight:600}
.subtitle,.meta{font-size:13px;fill:#4A5157}
.mark{font-size:14px;font-weight:600}
.hook,.dim text{font-size:12px;fill:#4A5157}
.bar{fill:none;stroke:#14171A;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
.bar.thin{stroke-width:2}
.dim line{stroke:#6B737A;stroke-width:1}
.rule{stroke:#D9DDE0;stroke-width:1}
.band{fill:#F4F5F6}
.total{font-size:14px;font-weight:600}
.note{font-size:11px;fill:#6B737A}
</style>
<rect width="100%" height="100%" fill="#FFFFFF"/>
<text class="title" x="16" y="36">${xml(`Despiece · ${title}`)}</text>
<text class="subtitle" x="16" y="60">${xml(`${takeoff.lines.length} ${takeoff.lines.length === 1 ? 'marca' : 'marcas'} · forma esquemática, longitudes de cálculo · Experimental · FStructure`)}</text>
<line class="rule" x1="16" y1="${HEADER - 1}" x2="${WIDTH - 16}" y2="${HEADER - 1}"/>
${rows}
<text class="total" x="16" y="${footerTop + 22}">${xml(totals)}</text>
${notes.map((line, index) => `<text class="note" x="16" y="${footerTop + 46 + index * 15}">${xml(line)}</text>`).join('')}
</svg>
`;
}

/** Nombre de archivo seguro a partir del rótulo de la pieza. */
export const takeoffFileName = (title: string, extension: 'csv' | 'svg') => {
  const base = title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60);
  return `despiece-${base || 'pieza'}.${extension}`;
};
