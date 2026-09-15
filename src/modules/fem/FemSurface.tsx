import { useState } from 'react';
import { Grid3X3, Layers3, Play, Sigma, Waypoints } from 'lucide-react';
import './femSurface.css';
import { ShellContribution } from '../../features/workspace/ShellToolSlots';
import { analyzeFemDocument, createTri3PatchFixture, type FemAnalysisResult, type FemDocumentV1 } from './femEngine';

const roadmap = [
  { label: 'Modelo', description: 'Geometría, materiales y condiciones de borde', Icon: Waypoints },
  { label: 'Malla', description: 'Discretización y control de calidad', Icon: Grid3X3 },
  { label: 'Solver', description: 'Ensamble, solución y diagnóstico', Icon: Sigma },
  { label: 'Resultados', description: 'Campos, contornos y evidencia', Icon: Layers3 },
] as const;

export function FemSurface() {
  const [document] = useState<FemDocumentV1>(createTri3PatchFixture);
  const [analysis, setAnalysis] = useState<FemAnalysisResult | null>(null);
  const runAnalysis = () => setAnalysis(analyzeFemDocument(document));
  const status = analysis === null ? 'Experimental · Listo' : analysis.success ? 'Experimental · Resuelto' : 'Experimental · Revisar';

  return <section className="fusion-fem" aria-labelledby="fem-title">
    <ShellContribution slot="action"><button type="button" className="workspace-topbar__action-button is-primary" onClick={runAnalysis}>
      <Play size={16} aria-hidden="true" /> Analizar FEM
    </button></ShellContribution>
    <ShellContribution slot="status"><span role="status">{status}</span></ShellContribution>
    <ShellContribution slot="inspector">
      <div className="fusion-fem__inspector">
        <strong>Modelo local</strong>
        <span>{document.nodes.length} nodos · {document.elements.length} elementos</span>
        {analysis ? <>
          <span>{analysis.success ? 'Análisis completado' : analysis.reason}</span>
          {analysis.success ? <span>Equilibrio {analysis.equilibrium.normalized.toExponential(2)}</span> : null}
        </> : <span>TRI3/QUAD4 · elasticidad lineal</span>}
      </div>
    </ShellContribution>
    <header className="fusion-fem__intro">
      <span className="fusion-fem__status">Experimental · local-first</span>
      <h1 id="fem-title">Elementos finitos</h1>
      <p>Modelo, malla y resultados FEM en el mismo shell. Esta primera entrega resuelve elasticidad lineal 2D con TRI3 y QUAD4, sin servicios remotos.</p>
    </header>
    {analysis ? <div className={`fusion-fem__result ${analysis.success ? 'is-success' : 'is-failure'}`} role="status" data-testid="fem-analysis-result">
      <strong>{analysis.success ? 'Análisis completado' : 'Análisis detenido'}</strong>
      <span>{analysis.success ? `${analysis.stresses.length} campos de tensión · residuo ${analysis.relativeResidual.toExponential(2)}` : analysis.reason}</span>
    </div> : null}
    <ol className="fusion-fem__roadmap" aria-label="Camino del módulo FEM">
      {roadmap.map(({ label, description, Icon }) => <li key={label}>
        <span><Icon size={18} aria-hidden="true" /></span>
        <div><strong>{label}</strong><small>{description}</small></div>
      </li>)}
    </ol>
  </section>;
}
