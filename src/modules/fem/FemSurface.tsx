import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Download, Grid3X3, Layers3, Play, Sigma, Upload, Waypoints } from 'lucide-react';
import './femSurface.css';
import { ShellContribution } from '../../features/workspace/ShellToolSlots';
import { useProjectModel } from '../../store/ProjectModelContext';
import { useSharedToolState } from '../../store/SharedToolState';
import type { JsonValue } from '../../shared/project/unifiedProjectBundle';
import {
  analyzeFemDocument,
  createTri3PatchFixture,
  exportFemVtk,
  parseGmsh41,
  serializeFemBundle,
  validateFemDocument,
  type FemAnalysisResult,
  type FemDocumentV1,
} from './femEngine';

const roadmap = [
  { label: 'Modelo', description: 'Geometría, materiales y condiciones de borde', Icon: Waypoints },
  { label: 'Malla', description: 'Discretización y control de calidad', Icon: Grid3X3 },
  { label: 'Solver', description: 'Ensamble, solución y diagnóstico', Icon: Sigma },
  { label: 'Resultados', description: 'Campos, contornos y evidencia', Icon: Layers3 },
] as const;

type StoredFemStudy = { document: FemDocumentV1; analysis: FemAnalysisResult | null };

const record = (value: JsonValue): Record<string, JsonValue> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null;

/** Reads only FEM snapshots that pass the same document validator as analysis. */
const readStoredFemStudy = (studies: readonly JsonValue[] | undefined): StoredFemStudy | null => {
  if (!studies) return null;
  for (let index = studies.length - 1; index >= 0; index -= 1) {
    const candidate = record(studies[index]);
    const document = candidate ? record(candidate.document) : null;
    if (!candidate || !document || document.kind !== 'fem-document' || document.schemaVersion !== 1) continue;
    const typedDocument = document as unknown as FemDocumentV1;
    try {
      if (validateFemDocument(typedDocument).length > 0) continue;
      const storedAnalysis = record(candidate.analysis ?? null);
      const analysis = storedAnalysis && typeof storedAnalysis.success === 'boolean'
        ? storedAnalysis as unknown as FemAnalysisResult
        : null;
      return { document: typedDocument, analysis };
    } catch {
      // A foreign/old FEM study must not prevent the project shell from opening.
    }
  }
  return null;
};

const downloadFemText = (text: string, filename: string, mimeType: string): boolean => {
  if (typeof URL.createObjectURL !== 'function') return false;
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => { if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url); }, 30_000);
  return true;
};

const persistedStudy = (document: FemDocumentV1, analysis: FemAnalysisResult | null): JsonValue =>
  JSON.parse(serializeFemBundle(document, analysis ?? undefined)) as JsonValue;

export function FemSurface() {
  const { project } = useProjectModel();
  const session = useSharedToolState()?.session;
  const [document, setDocument] = useState<FemDocumentV1>(createTri3PatchFixture);
  const [analysis, setAnalysis] = useState<FemAnalysisResult | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStoredFemStudy(session?.currentBundle(project.id)?.fem);
    setDocument(stored?.document ?? createTri3PatchFixture());
    setAnalysis(stored?.analysis ?? null);
    setFeedback(null);
  }, [project.id, session]);

  const persistStudy = useCallback(async (nextDocument: FemDocumentV1, nextAnalysis: FemAnalysisResult | null) => {
    if (!session) return false;
    try {
      await session.saveFem(project, persistedStudy(nextDocument, nextAnalysis));
      return true;
    } catch (error) {
      setFeedback(`Estudio FEM sólo en memoria: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }, [project, session]);

  const runAnalysis = useCallback(() => {
    const next = analyzeFemDocument(document);
    setAnalysis(next);
    void persistStudy(document, next).then((saved) => {
      if (saved) setFeedback(next.success ? 'Resultado FEM guardado en el proyecto local.' : 'Diagnóstico FEM guardado en el proyecto local.');
    });
  }, [document, persistStudy]);

  const importGmsh = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const imported = parseGmsh41(await file.text());
      setDocument(imported);
      setAnalysis(null);
      const saved = await persistStudy(imported, null);
      setFeedback(saved ? `Gmsh 4.1 importado: ${imported.nodes.length} nodos · ${imported.elements.length} elementos.` : 'Gmsh 4.1 cargado; queda sólo en memoria.');
    } catch (error) {
      setFeedback(`No se pudo importar Gmsh 4.1: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [persistStudy]);

  const exportJson = useCallback(() => {
    const downloaded = downloadFemText(serializeFemBundle(document, analysis ?? undefined), `${document.id}.fem.json`, 'application/json');
    setFeedback(downloaded ? 'Bundle FEM JSON descargado.' : 'Este navegador no permite descargas locales.');
  }, [analysis, document]);

  const exportVtk = useCallback(() => {
    const downloaded = downloadFemText(exportFemVtk(document, analysis ?? undefined), `${document.id}.vtk`, 'text/plain');
    setFeedback(downloaded ? 'Resultados VTK descargados.' : 'Este navegador no permite descargas locales.');
  }, [analysis, document]);

  const status = analysis === null ? 'Experimental · Listo' : analysis.success ? 'Experimental · Resuelto' : 'Experimental · Revisar';

  return <section className="fusion-fem" aria-labelledby="fem-title">
    <ShellContribution slot="action"><button type="button" className="workspace-topbar__action-button is-primary" onClick={runAnalysis}>
      <Play size={16} aria-hidden="true" /> Analizar FEM
    </button></ShellContribution>
    <ShellContribution slot="status"><span role="status">{feedback ?? status}</span></ShellContribution>
    <ShellContribution slot="inspector">
      <div className="fusion-fem__inspector">
        <strong>Modelo local</strong>
        <span>{document.nodes.length} nodos · {document.elements.length} elementos</span>
        <span>{document.name}</span>
        {analysis ? <>
          <span>{analysis.success ? 'Análisis completado' : analysis.reason}</span>
          {analysis.success && analysis.equilibrium.normalized !== null ? <span>Equilibrio {analysis.equilibrium.normalized.toExponential(2)}</span> : null}
        </> : <span>TRI3/QUAD4 · elasticidad lineal</span>}
      </div>
    </ShellContribution>
    <header className="fusion-fem__intro">
      <span className="fusion-fem__status">Experimental · local-first</span>
      <h1 id="fem-title">Elementos finitos</h1>
      <p>Modelo, malla y resultados FEM en el mismo shell. Esta primera entrega resuelve elasticidad lineal 2D con TRI3 y QUAD4, sin servicios remotos.</p>
    </header>
    <div className="fusion-fem__actions" aria-label="Intercambio FEM">
      <label className="fusion-fem__file-action">
        <Upload size={15} aria-hidden="true" />
        <span>Importar Gmsh 4.1</span>
        <input type="file" accept=".msh,text/plain" aria-label="Importar Gmsh 4.1" onChange={(event) => void importGmsh(event)} />
      </label>
      <button type="button" className="fusion-fem__secondary-action" onClick={exportJson}><Download size={15} aria-hidden="true" /> Exportar FEM JSON</button>
      <button type="button" className="fusion-fem__secondary-action" onClick={exportVtk}><Download size={15} aria-hidden="true" /> Exportar VTK</button>
    </div>
    {feedback ? <p className="fusion-fem__feedback" role="status">{feedback}</p> : null}
    {analysis ? <div className={`fusion-fem__result ${analysis.success ? 'is-success' : 'is-failure'}`} role="status" data-testid="fem-analysis-result">
      <strong>{analysis.success ? 'Análisis completado' : 'Análisis detenido'}</strong>
      <span>{analysis.success && analysis.relativeResidual !== null ? `${analysis.stresses.length} campos de tensión · residuo ${analysis.relativeResidual.toExponential(2)}` : analysis.reason}</span>
    </div> : null}
    <ol className="fusion-fem__roadmap" aria-label="Camino del módulo FEM">
      {roadmap.map(({ label, description, Icon }) => <li key={label}>
        <span><Icon size={18} aria-hidden="true" /></span>
        <div><strong>{label}</strong><small>{description}</small></div>
      </li>)}
    </ol>
  </section>;
}
