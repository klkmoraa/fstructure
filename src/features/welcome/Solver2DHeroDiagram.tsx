import { useEffect, useRef, useState } from 'react';

/**
 * Diagrama de portada del solver 2D.
 *
 * No es una ilustración: es lo que hace el módulo, dibujado con las señales del
 * sistema. Un pórtico entra como geometría, recibe una carga y devuelve su
 * momento y su deformada. La secuencia se ejecuta una vez al montar, en el
 * orden en que ocurre el trabajo —geometría, apoyos, carga, resultado— porque
 * ése es el orden que hay que aprender.
 *
 * El movimiento respeta `prefers-reduced-motion`: con movimiento reducido el
 * diagrama aparece completo, no a medias.
 */

/** Pasos de la secuencia, en milisegundos desde el montaje. */
const STEPS = [
  { id: 'frame', at: 0 },
  { id: 'supports', at: 260 },
  { id: 'load', at: 520 },
  { id: 'moment', at: 820 },
  { id: 'deformed', at: 1120 },
] as const;

type StepId = (typeof STEPS)[number]['id'];

export const Solver2DHeroDiagram = ({ reducedMotion = false }: { reducedMotion?: boolean }) => {
  const [revealed, setRevealed] = useState<ReadonlySet<StepId>>(() =>
    reducedMotion ? new Set(STEPS.map((step) => step.id)) : new Set());
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (reducedMotion) {
      setRevealed(new Set(STEPS.map((step) => step.id)));
      return undefined;
    }
    timers.current = STEPS.map((step) => window.setTimeout(
      () => setRevealed((current) => new Set([...current, step.id])),
      step.at,
    ));
    const handles = timers.current;
    return () => handles.forEach((handle) => window.clearTimeout(handle));
  }, [reducedMotion]);

  const on = (step: StepId) => (revealed.has(step) ? ' is-on' : '');

  return <svg
    className={`solver2d-diagram${reducedMotion ? ' is-static' : ''}`}
    viewBox="0 0 420 300"
    role="img"
    aria-label="Pórtico de un vano con carga uniforme, su diagrama de momento y su deformada"
  >
    <g className="solver2d-diagram__grid" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <line key={`v${i}`} x1={40 + i * 56} y1="24" x2={40 + i * 56} y2="252" />)}
      {[0, 1, 2, 3, 4].map((i) => <line key={`h${i}`} x1="40" y1={24 + i * 57} x2="376" y2={24 + i * 57} />)}
    </g>

    {/* Geometría: dos columnas y una trabe. */}
    <g className={`solver2d-diagram__frame${on('frame')}`}>
      <path d="M96 220V96h224v124" />
    </g>

    {/* Apoyos: el empotramiento que cierra el modelo. */}
    <g className={`solver2d-diagram__supports${on('supports')}`}>
      <path d="M78 220h36M302 220h36" />
      <path d="M82 220l-8 10M92 220l-8 10M102 220l-8 10M112 220l-8 10" />
      <path d="M306 220l-8 10M316 220l-8 10M326 220l-8 10M336 220l-8 10" />
      <circle cx="96" cy="96" r="4" />
      <circle cx="320" cy="96" r="4" />
    </g>

    {/* Acción: la carga uniforme sobre la trabe. */}
    <g className={`solver2d-diagram__load${on('load')}`}>
      <path d="M96 62h224" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <path key={i} d={`M${96 + i * 32}, 62 V90 m-4-6 4 6 4-6`} />
      ))}
    </g>

    {/* Resultado: momento flector sobre la trabe. */}
    <g className={`solver2d-diagram__moment${on('moment')}`}>
      <path className="solver2d-diagram__moment-fill" d="M96 96c56 0 56 62 112 62s56-62 112-62v-4H96Z" />
      <path className="solver2d-diagram__moment-line" d="M96 96c56 0 56 62 112 62s56-62 112-62" />
    </g>

    {/* Respuesta: la deformada del mismo pórtico. */}
    <g className={`solver2d-diagram__deformed${on('deformed')}`}>
      <path d="M90 220c0-70 4-100 6-126 44-16 180-16 224 0 2 26 6 56 6 126" />
    </g>
  </svg>;
};
