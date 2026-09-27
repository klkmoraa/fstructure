/**
 * Láminas de la memoria: el mismo componente SVG que se ve en la mesa, con los
 * estilos del taller en tema Día incrustados, rasterizado a PNG para el PDF.
 * Sólo corre en un navegador; sin lienzo (pruebas, servidor) devuelve `null` y
 * la memoria sale sin figuras en lugar de fallar.
 */
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import tokensCss from '../../../design-system/tokens.css?raw';
import workbenchCss from './designWorkbench.css?raw';

export interface RasterFigure {
  readonly png: Uint8Array;
  /** Tamaño del dibujo en unidades del viewBox (px CSS). */
  readonly width: number;
  readonly height: number;
}

/** Tokens de Día (el primer `:root`) y las variables del taller aplicadas a la raíz del SVG. */
function printStyles(): string {
  const root = /:root\s*\{[\s\S]*?\n\}/.exec(tokensCss)?.[0] ?? '';
  const workbench = /\.design-workbench\s*\{([\s\S]*?)\}/.exec(workbenchCss)?.[1] ?? '';
  const variables = workbench.split('\n').filter((line) => line.trim().startsWith('--')).join('\n');
  return `${root}\nsvg {\n${variables}\n}\n${workbenchCss}`;
}

let cachedStyles: string | undefined;
const FIGURE_MARGIN = 40;

/** SVG autónomo con estilos incrustados, o `null` si el nodo no es un `<svg>` con viewBox. */
function standaloneSvg(node: ReactElement): { markup: string; width: number; height: number } | null {
  const markup = renderToStaticMarkup(node);
  const open = /^<svg\b[^>]*>/.exec(markup);
  const viewBox = open ? /viewBox="([\d.\s-]+)"/.exec(open[0]) : null;
  if (!open || !viewBox) return null;
  const [minX = 0, minY = 0, innerWidth, innerHeight] = viewBox[1]!.trim().split(/\s+/).map(Number);
  if (!innerWidth || !innerHeight) return null;
  cachedStyles ??= printStyles();
  // En pantalla el dibujo desborda su viewBox (cotas giradas, rótulos); como imagen se recortaría: se le da margen.
  const width = innerWidth + 2 * FIGURE_MARGIN;
  const height = innerHeight + 2 * FIGURE_MARGIN;
  const namespace = open[0].includes('xmlns=') ? '' : ' xmlns="http://www.w3.org/2000/svg"';
  const head = open[0]
    .replace(viewBox[0], `viewBox="${minX - FIGURE_MARGIN} ${minY - FIGURE_MARGIN} ${width} ${height}"`)
    .replace('<svg', `<svg${namespace} width="${width}" height="${height}"`);
  // En pantalla el dibujo llena su lámina (width: 100%); como imagen, su tamaño es el del viewBox.
  const size = `svg.dw-drawing { width: ${width}px !important; height: ${height}px !important; max-width: none !important; margin: 0 !important; }`;
  const style = `<style><![CDATA[${cachedStyles.replaceAll("]]>", "]] >")}\n${size}]]></style>`;
  return { markup: `${head}${style}${markup.slice(open[0].length)}`, width, height };
}

const LOAD_TIMEOUT_MS = 4_000;

export async function rasterizeFigure(node: ReactElement, scale = 3): Promise<RasterFigure | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
  const svg = standaloneSvg(node);
  if (!svg) return null;
  const canvas = document.createElement('canvas');
  let context: CanvasRenderingContext2D | null = null;
  try { context = canvas.getContext('2d'); } catch { return null; }
  if (!context) return null;
  const url = URL.createObjectURL(new Blob([svg.markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    const loaded = new Promise<boolean>((resolve) => {
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      setTimeout(() => resolve(false), LOAD_TIMEOUT_MS);
    });
    image.src = url;
    if (!await loaded) return null;
    canvas.width = Math.round(svg.width * scale);
    canvas.height = Math.round(svg.height * scale);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return null;
    return { png: new Uint8Array(await blob.arrayBuffer()), width: svg.width, height: svg.height };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
