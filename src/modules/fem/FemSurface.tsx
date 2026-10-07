import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Box, FileJson, Play, Upload } from 'lucide-react';
import { FemStudyView } from './FemStudyView';
import './femSurface.css';
import { ShellContribution, ShellStatusChip } from '../../features/workspace/ShellToolSlots';
import { peekToolIntent, takeToolIntent } from '../../features/workspace/toolIntent';
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
} from './public';

type StoredFemStudy = { document: FemDocumentV1; analysis: FemAnalysisResult | null };

const record = (value: JsonValue): Record<string, JsonValue> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null;

/** Un resultado derivado incompleto no debe impedir consultar su documento. */
const readStoredAnalysis = (value: JsonValue, document: FemDocumentV1): FemAnalysisResult | null => {
  const result = record(value);
  if (!result || typeof result.success !== 'boolean' || result.documentId !== document.id || typeof result.reason !== 'string') return null;
  const finite = (number: JsonValue | undefined) => typeof number === 'number' && Number.isFinite(number);
  const nullable = (number: JsonValue | undefined) => number === null || finite(number);
  const numbers = (values: JsonValue | undefined, length: number) => Array.isArray(values) && values.length === length && values.every(finite);
  const records = (values: JsonValue | undefined, valid: (row: Record<string, JsonValue>) => boolean) => Array.isArray(values) && values.every((value) => {
    const row = record(value);
    return row !== null && valid(row);
  });
  const nodeIds = new Set(document.nodes.map((node) => node.id));
  const elementIds = new Set(document.elements.map((element) => element.id));
  const displacement = (row: Record<string, JsonValue>) => typeof row.nodeId === 'string' && nodeIds.has(row.nodeId) && finite(row.ux) && finite(row.uy) && finite(row.uz);
  const quality = record(result.meshQuality ?? null);
  const equilibrium = record(result.equilibrium ?? null);
  if (!records(result.displacements, displacement) || !records(result.reactions, displacement)
    || !records(result.stresses, (row) => typeof row.elementId === 'string' && elementIds.has(row.elementId)
      && (row.type === 'TRI3' || row.type === 'QUAD4') && numbers(row.stress, 3) && numbers(row.strain, 3)
      && numbers(row.principal, 2) && finite(row.vonMises) && (row.outOfPlaneStress === undefined || finite(row.outOfPlaneStress)))
    || !quality || typeof quality.valid !== 'boolean' || !finite(quality.minArea) || !finite(quality.maxAspectRatio)
    || !Array.isArray(quality.degenerateElementIds) || !quality.degenerateElementIds.every((id) => typeof id === 'string')
    || !equilibrium || !numbers(equilibrium.force, 3) || !nullable(equilibrium.normalized)
    || !nullable(result.relativeResidual) || !nullable(result.conditionEstimate)
    || !records(result.issues, (row) => ['code', 'entity', 'id', 'field'].every((key) => typeof row[key] === 'string'))) return null;
  return result as unknown as FemAnalysisResult;
};

/** Reads only FEM snapshots that pass the same document validator as analysis. */
export const readStoredFemStudy = (studies: readonly JsonValue[] | undefined): StoredFemStudy | null => {
  if (!studies) return null;
  for (let index = studies.length - 1; index >= 0; index -= 1) {
    const candidate = record(studies[index]);
    const document = candidate ? record(candidate.document) : null;
    if (!candidate || !document || document.kind !== 'fem-document' || document.schemaVersion !== 1) continue;
    const typedDocument = document as unknown as FemDocumentV1;
    try {
      if (validateFemDocument(typedDocument).length > 0) continue;
      const analysis = readStoredAnalysis(candidate.analysis ?? null, typedDocument);
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

  // Entrada elegida en la bienvenida de FEM. Se lee sin consumir durante el
  // render y se aplica sólo al proyecto con el que se abrió la mesa; aplicarla
  // es idempotente, así que el doble montaje de StrictMode no la pierde.
  const [intent] = useState(() => peekToolIntent('fem'));
  const intentProjectId = useRef(project.id);
  useEffect(() => { takeToolIntent('fem'); }, []);

  useEffect(() => {
    const stored = readStoredFemStudy(session?.currentBundle(project.id)?.fem);
    const base = stored?.document ?? createTri3PatchFixture();
    setFeedback(null);
    if (intent && project.id === intentProjectId.current) {
      if (intent.kind === 'analyze') {
        const next = analyzeFemDocument(base);
        setDocument(base);
        setAnalysis(next);
        if (session) void session.saveFem(project, persistedStudy(base, next)).then(
          () => setFeedback(next.success ? 'Resultado FEM guardado en el proyecto local.' : 'Diagnóstico FEM guardado en el proyecto local.'),
          (error: unknown) => setFeedback(`Estudio FEM sólo en memoria: ${error instanceof Error ? error.message : String(error)}`),
        );
        return;
      }
      try {
        const imported = parseGmsh41(intent.text);
        setDocument(imported);
        setAnalysis(null);
        if (session) void session.saveFem(project, persistedStudy(imported, null)).then(
          () => setFeedback(`Gmsh 4.1 importado: ${imported.nodes.length} nodos · ${imported.elements.length} elementos.`),
          () => setFeedback('Gmsh 4.1 cargado; queda sólo en memoria.'),
        );
        return;
      } catch (error) {
        setDocument(base);
        setAnalysis(stored?.analysis ?? null);
        setFeedback(`No se pudo importar ${intent.fileName}: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
    }
    setDocument(base);
    setAnalysis(stored?.analysis ?? null);
    // `project` completo no entra: la mesa se recarga por identidad, no por cada edición.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, session, intent]);

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

  const status = analysis === null
    ? { tone: 'neutral' as const, label: 'Listo' }
    : analysis.success ? { tone: 'ok' as const, label: 'Resuelto' } : { tone: 'error' as const, label: 'Revisar' };

  const fileInput = useRef<HTMLInputElement>(null);
  return <section className="fusion-fem" aria-labelledby="fem-title">
    <h1 id="fem-title" className="sr-only">Elementos finitos</h1>
    {/* La acción primaria dice el verbo, como en 2D y 3D; el nombre accesible conserva el dominio. */}
    <ShellContribution slot="action"><button type="button" className="workspace-topbar__action-button is-primary" onClick={runAnalysis} aria-label="Analizar FEM">
      <Play size={16} fill="currentColor" aria-hidden="true" /> <span>Analizar</span>
    </button></ShellContribution>
    {/* Importar y exportar viven en la barra, como los controles de las otras mesas. */}
    <ShellContribution slot="controls">
      <button type="button" className="workspace-topbar__action-button" data-wide-label onClick={() => fileInput.current?.click()} title="Importar malla Gmsh 4.1">
        <Upload size={17} aria-hidden="true" /><span>Importar Gmsh 4.1</span>
      </button>
      <input ref={fileInput} type="file" accept=".msh,text/plain" aria-label="Importar Gmsh 4.1" className="sr-only" tabIndex={-1} onChange={(event) => void importGmsh(event)} />
      <button type="button" className="workspace-topbar__action-button" onClick={exportJson} aria-label="Exportar FEM JSON" title="Descargar el estudio y su análisis en JSON"><FileJson size={17} aria-hidden="true" /><span>JSON</span></button>
      <button type="button" className="workspace-topbar__action-button" onClick={exportVtk} aria-label="Exportar VTK" title="Descargar la malla y sus campos en VTK"><Box size={17} aria-hidden="true" /><span>VTK</span></button>
    </ShellContribution>
    <ShellContribution slot="statusbar"><footer className="fusion-fem__statusbar" aria-label="Estado de Elementos finitos">
      <span><b>{document.nodes.length}</b> nudos <b>{document.elements.length}</b> elementos</span>
      <span>{document.name}</span>
      <span className="fusion-fem__statusbar-help">TRI3/QUAD4 · elasticidad lineal 2D</span>
      <span>{analysis === null ? 'SIN ANALIZAR' : analysis.success ? 'RESUELTO' : 'REVISAR'}</span>
      <span>Local</span>
    </footer></ShellContribution>
    <ShellContribution slot="status"><ShellStatusChip tone={status.tone} label={status.label} badge="Experimental" detail={feedback ?? undefined} /></ShellContribution>
    {feedback ? <p className="fusion-fem__feedback" role="status">{feedback}</p> : null}
    {analysis ? <div className={`fusion-fem__result ${analysis.success ? 'is-success' : 'is-failure'}`} role="status" data-testid="fem-analysis-result">
      <strong>{analysis.success ? 'Análisis completado' : 'Análisis detenido'}</strong>
      <span>{analysis.success && analysis.relativeResidual !== null ? `${analysis.stresses.length} campos de tensión · residuo ${analysis.relativeResidual.toExponential(2)}` : analysis.reason}</span>
    </div> : null}
    <FemStudyView document={document} analysis={analysis} onAnalyze={runAnalysis} />
  </section>;
}
