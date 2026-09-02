import { ThreeStructuralImage } from '../structural-assets';
import { Solver2DHeroDiagram } from './Solver2DHeroDiagram';

/**
 * Escena de portada del solver 2D.
 *
 * La portada anterior había perdido el objeto: quedó sólo un diagrama plano,
 * y con él desapareció lo único que decía que aquí se modela una estructura
 * antes de analizarla. Esta escena devuelve el pórtico tridimensional —el
 * mismo render de `three` que ya sirve al resto del producto, en su versión
 * pre-renderizada por tema— y le pone encima la hoja de análisis.
 *
 * No son dos ilustraciones sueltas: son las dos mitades de una frase. Arriba
 * el objeto que existe, abajo lo que el solver devuelve de él. Entran en ese
 * orden porque ése es el orden del trabajo, y la hoja se apoya sobre el objeto
 * —no a su lado— para que la relación se lea sin leyenda.
 *
 * COSTE. El pórtico es un `<img>` pre-renderizado, no una escena WebGL viva:
 * la portada no arrastra `three` al primer paint, y el fallback de
 * `ThreeStructuralImage` (ilustración SVG) cubre el caso de que el archivo no
 * cargue.
 *
 * MOVIMIENTO. Con `prefers-reduced-motion` la escena aparece completa y quieta:
 * ni entrada escalonada, ni flotación, ni trazo dibujándose. El movimiento aquí
 * es narrativo, nunca es la única forma de leer el contenido.
 */
export interface Solver2DHeroStageProps {
  theme: 'light' | 'dark';
  reducedMotion: boolean;
  /** Rótulo del objeto — «Modelo». */
  objectLabel: string;
  /** Rótulo de la hoja de análisis — «Análisis». */
  sheetLabel: string;
  /** Descripción accesible del pórtico tridimensional. */
  objectAlt: string;
}

export const Solver2DHeroStage = ({
  theme,
  reducedMotion,
  objectLabel,
  sheetLabel,
  objectAlt,
}: Solver2DHeroStageProps) => (
  <div className={`solver2d-stage${reducedMotion ? ' is-static' : ''}`}>
    <div className="solver2d-stage__object">
      <span className="solver2d-stage__tag">{objectLabel}</span>
      <ThreeStructuralImage assetId="portal:single-bay" theme={theme} alt={objectAlt} eager />
    </div>
    <figure className="solver2d-stage__sheet">
      <figcaption className="solver2d-stage__tag">{sheetLabel}</figcaption>
      <Solver2DHeroDiagram reducedMotion={reducedMotion} />
    </figure>
  </div>
);
