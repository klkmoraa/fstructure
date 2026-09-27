import type { DesignCodeId } from './codes';
import { complementary, type ElementCheck } from './shared';

/**
 * Alcance declarado del taller por elemento: lo que la norma pide revisar y el
 * taller todavía no calcula. Se muestra junto a las comprobaciones para que un
 * resultado favorable nunca se lea como revisión completa (véase
 * `docs/research/concrete-design`, «Warnings y resultado agregado»).
 *
 * Las secciones citadas en la nota orientan al lector; no son cláusulas con
 * evidencia en el registro normativo, por eso la referencia es complementaria.
 */
type ElementKind = 'beam' | 'column' | 'footing';

interface ScopeItem {
  readonly id: string;
  readonly label: string;
  /** Qué falta y dónde lo trata cada norma. */
  readonly note: Readonly<Record<DesignCodeId, string>>;
}

const same = (text: string): Readonly<Record<DesignCodeId, string>> => ({ 'ntc-2023': text, 'nsr-10': text, e060: text });

const DUCTILITY: ScopeItem = {
  id: 'ductility',
  label: 'Detallado sísmico por ductilidad',
  note: {
    'ntc-2023': 'Confinamiento, jerarquía de resistencias y detalles de ductilidad media o alta (NTC-C caps. 7 y 8). Un cociente menor que 1 por gravedad no prueba el detalle sísmico.',
    'nsr-10': 'Requisitos DMO/DES del capítulo C.21. Un cociente menor que 1 por gravedad no prueba el detalle sísmico.',
    e060: 'Disposiciones sísmicas del capítulo 21. Un cociente menor que 1 por gravedad no prueba el detalle sísmico.',
  },
};

const DEVELOPMENT_BRANCHES: ScopeItem = {
  id: 'development-branches',
  label: 'Desarrollo con barra epóxica o concreto ligero',
  note: same('Las longitudes de desarrollo y traslape suponen barra sin recubrimiento epóxico y concreto de peso normal (ψe = 1, λ = 1).'),
};

const SCOPE: Readonly<Record<ElementKind, readonly ScopeItem[]>> = {
  beam: [
    { id: 'torsion', label: 'Torsión', note: { 'ntc-2023': 'No se revisa la torsión ni su interacción con cortante y flexión (NTC-C 5.8).', 'nsr-10': 'No se revisa la torsión (C.11.5).', e060: 'No se revisa la torsión (11.5).' } },
    { id: 'accidental-combinations', label: 'Combinaciones accidentales', note: { 'ntc-2023': 'Sólo se generan combinaciones gravitacionales; las de sismo o viento (NTC-CyA 3.4.1 b) quedan fuera.', 'nsr-10': 'Sólo se generan combinaciones gravitacionales; las de sismo o viento (B.2.4) quedan fuera.', e060: 'Sólo se generan combinaciones gravitacionales; las de sismo (9.2) quedan fuera.' } },
    { id: 'axial-and-flanges', label: 'Carga axial, secciones T/L y acero de compresión', note: same('La sección es rectangular, sin patín, sin axial concurrente y sin contar el acero de compresión en la resistencia.') },
    DUCTILITY,
    DEVELOPMENT_BRANCHES,
  ],
  column: [
    { id: 'concurrent-demand', label: 'Concurrencia de Pu, Mux y Muy', note: same('Las solicitaciones capturadas deben venir de la misma combinación. Máximos de casos distintos no forman un vector concurrente y pueden quedar del lado inseguro.') },
    { id: 'second-order', label: 'Análisis de segundo orden explícito', note: same('La esbeltez se trata con amplificación de momentos; no hay análisis P-Δ del marco.') },
    { id: 'shape', label: 'Columnas circulares o zunchadas', note: same('Sólo sección rectangular con estribos.') },
    DUCTILITY,
    DEVELOPMENT_BRANCHES,
  ],
  footing: [
    { id: 'geotechnics', label: 'Capacidad y asentamiento del suelo', note: { 'ntc-2023': 'La presión admisible es un dato del estudio geotécnico (NTC-Cimentaciones); el taller no calcula capacidad de carga ni asentamientos.', 'nsr-10': 'La presión admisible es un dato del estudio geotécnico (Título H); el taller no calcula capacidad de carga ni asentamientos.', e060: 'La presión admisible es un dato del estudio de mecánica de suelos (E.050); el taller no calcula capacidad de carga ni asentamientos.' } },
    { id: 'stability', label: 'Volteo y deslizamiento', note: same('No se revisa la estabilidad de la zapata como cuerpo rígido.') },
    { id: 'seismic', label: 'Diseño sísmico de la cimentación', note: same('Marcar la combinación con sismo sólo cambia el factor de resistencia en penetración; no genera ni revisa las combinaciones sísmicas.') },
    { id: 'other-footings', label: 'Zapatas corridas, combinadas y dados', note: same('Sólo zapata aislada rectangular con columna centrada; el dado o pedestal no se diseña.') },
    DEVELOPMENT_BRANCHES,
  ],
};

/** Comprobaciones fuera de alcance del elemento, listas para mostrarse junto a las demás. */
export function outOfScopeChecks(element: ElementKind, code: DesignCodeId): ElementCheck[] {
  return SCOPE[element].map((item) => ({
    id: `scope-${item.id}`,
    label: item.label,
    status: 'out-of-scope',
    reference: complementary('Fuera del alcance del taller'),
    note: item.note[code],
  }));
}

type ReviewState = 'fail' | 'warning' | 'incomplete' | 'pass';

/**
 * Estado de la revisión del elemento. «incomplete» significa que todo lo
 * evaluado cumple pero hay verificaciones sin evaluar: no se llama «Cumple».
 */
export function reviewState(status: 'pass' | 'fail' | 'warning', outOfScope: readonly ElementCheck[]): ReviewState {
  if (status !== 'pass') return status;
  return outOfScope.length ? 'incomplete' : 'pass';
}
