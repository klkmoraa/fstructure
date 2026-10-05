import type { ReactNode } from 'react';
import './mesaJourney.css';

/** Contexto permanente, independiente de los paneles que se puedan cerrar. */
export function MesaJourney({ mode, source, hint, children }: { mode: string; source: string; hint?: string; children?: ReactNode }) {
  return <section className="mesa-journey" aria-label="Modo, origen y siguiente paso">
    <div className="mesa-journey__context"><strong>{mode}</strong><span>{source}</span></div>
    {hint ? <p>{hint}</p> : null}<div className="mesa-journey__actions">{children}</div>
  </section>;
}
