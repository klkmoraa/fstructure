export type CalcPiece = 'beam' | 'column' | 'footing' | 'flexure' | 'section';

/** Piezas completas que Cálculo abre sueltas (sin Estructura: ésa es del Proyecto). */
export const CALC_PIECES: readonly CalcPiece[] = ['beam', 'column', 'footing', 'flexure', 'section'];
