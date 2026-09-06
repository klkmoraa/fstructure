/**
 * Contrato de la superficie `dense` de Results (CRI-101).
 *
 * `dense` es **invocada, nunca residente**: reacciones y «Entender» dejan de
 * ocupar el panel y se piden cuando hacen falta. Influencia es una lectura
 * directa del panel de Resultados, junto con N/V/M y la deformada. Este
 * módulo es deliberadamente diminuto —un tipo y dos precargas— para que el
 * lanzador pueda anunciarla sin arrastrar el chunk que la dibuja.
 */
export const DENSE_RESULT_VIEWS = ['reactions', 'learn'] as const;

export type DenseResultView = (typeof DENSE_RESULT_VIEWS)[number];

/**
 * Compatibilidad para lanzadores ya publicados: pedir influencia ahora abre
 * Resultados en esa pestaña, nunca el drawer de resultados densos.
 */
export type DenseResultRequest = DenseResultView | 'influence';

/**
 * La línea de influencia se conserva diferida: el panel la carga sólo al
 * elegir su pestaña, sin abrir otra superficie ni ralentizar el resumen.
 */
export const preloadInfluenceLineView = () => import('./InfluenceLineView')
  .then((module) => ({ default: module.InfluenceLineView }));

/** Precarga el chunk de la propia superficie invocada, no sólo su contenido. */
export const preloadDenseResultsSurface = () => import('./DenseResultsSurface')
  .then((module) => ({ default: module.DenseResultsSurface }));
