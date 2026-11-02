/**
 * Tipografía de la memoria: IBM Plex Sans incrustada, en subconjunto.
 *
 * Las fuentes estándar del PDF (Helvetica, Times, Symbol) sólo codifican WinAnsi: cada ξ, ≤,
 * x² o Σ se deletreaba («xi», «<=», «x^2», «Sum») y las ecuaciones se leían como código. Plex
 * Sans trae griego, operadores, superíndices y subíndices, es de la misma familia que la Plex
 * Mono de la marca y se lee bien a 9–10 pt impresa.
 *
 * Las fuentes son archivos del propio sitio (mismo origen; el service worker las guarda al
 * usarse): nada sale del dispositivo. Si no se pueden leer —sin conexión antes de la primera
 * exportación, por ejemplo— la memoria se genera igual con las fuentes estándar.
 */
import regularUrl from '@ibm/plex-sans/fonts/complete/woff/IBMPlexSans-Regular.woff?url';
import semiboldUrl from '@ibm/plex-sans/fonts/complete/woff/IBMPlexSans-SemiBold.woff?url';
import italicUrl from '@ibm/plex-sans/fonts/complete/woff/IBMPlexSans-Italic.woff?url';
// Las fórmulas van en IBM Plex Serif: variables en cursiva, cifras y operadores rectos y el
// resultado en seminegrita, como en una memoria escrita a mano o en LaTeX. El texto sigue en Sans.
import mathRegularUrl from '@ibm/plex-serif/fonts/complete/woff/IBMPlexSerif-Regular.woff?url';
import mathItalicUrl from '@ibm/plex-serif/fonts/complete/woff/IBMPlexSerif-Italic.woff?url';
import mathBoldUrl from '@ibm/plex-serif/fonts/complete/woff/IBMPlexSerif-SemiBold.woff?url';

export interface ReportFontFaces {
  readonly regular: Uint8Array;
  readonly bold: Uint8Array;
  readonly italic: Uint8Array;
  readonly mathRegular: Uint8Array;
  readonly mathItalic: Uint8Array;
  readonly mathBold: Uint8Array;
}

const read = async (url: string): Promise<Uint8Array> => {
  const base = typeof location !== 'undefined' ? location.href : undefined;
  const response = await fetch(base ? new URL(url, base) : url);
  if (!response.ok) throw new Error(`No se pudo leer la fuente ${url} (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
};

let cached: Promise<ReportFontFaces | null> | undefined;

/** Las caras de texto y de fórmulas, o `null` si no se pudieron leer (la memoria usa entonces las estándar). */
export const loadReportFontFaces = (): Promise<ReportFontFaces | null> => {
  cached ??= Promise.all([read(regularUrl), read(semiboldUrl), read(italicUrl), read(mathRegularUrl), read(mathItalicUrl), read(mathBoldUrl)])
    .then(([regular, bold, italic, mathRegular, mathItalic, mathBold]) => ({ regular, bold, italic, mathRegular, mathItalic, mathBold }))
    .catch(() => {
      // Un fallo no se recuerda: la siguiente exportación lo vuelve a intentar.
      cached = undefined;
      return null;
    });
  return cached;
};
