import { Grid3X3, Layers3, Sigma, Waypoints } from 'lucide-react';
import './femSurface.css';

const roadmap = [
  { label: 'Modelo', description: 'Geometría, materiales y condiciones de borde', Icon: Waypoints },
  { label: 'Malla', description: 'Discretización y control de calidad', Icon: Grid3X3 },
  { label: 'Solver', description: 'Ensamble, solución y diagnóstico', Icon: Sigma },
  { label: 'Resultados', description: 'Campos, contornos y evidencia', Icon: Layers3 },
] as const;

/** Punto de entrada del futuro módulo FEM. No ejecuta análisis. */
export function FemSurface() {
  return <section className="fusion-fem" aria-labelledby="fem-title">
    <header className="fusion-fem__intro">
      <span className="fusion-fem__status">Planeado</span>
      <h1 id="fem-title">Elementos finitos</h1>
      <p>El siguiente entorno del proyecto reunirá modelo, malla y resultados FEM.
        El motor todavía no está implementado y esta vista no produce cálculos.</p>
    </header>
    <ol className="fusion-fem__roadmap" aria-label="Camino del módulo FEM">
      {roadmap.map(({ label, description, Icon }) => <li key={label}>
        <span><Icon size={18} aria-hidden="true" /></span>
        <div><strong>{label}</strong><small>{description}</small></div>
      </li>)}
    </ol>
  </section>;
}
