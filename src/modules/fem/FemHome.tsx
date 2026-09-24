import { useMemo, useState } from 'react';
import { FlaskConical, Upload } from 'lucide-react';
import { ToolHome, type ToolHomeContent } from '../../features/tool-home/ToolHome';
import { setToolIntent } from '../../features/workspace/toolIntent';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import { useSharedToolState } from '../../store/SharedToolState';
import { readStoredFemStudy } from './FemSurface';

/** Tope de lectura en la bienvenida; la validación de la malla ocurre en la mesa. */
const MAX_GMSH_BYTES = 16 * 1024 * 1024;

const content = (hasStudy: boolean, onAnalyze: () => void, onImport: (file: File) => void): ToolHomeContent => ({
  title: { es: 'De la malla al resultado.', en: 'From mesh to result.' },
  lead: {
    es: 'Importa una malla 2D de Gmsh o prueba el parche TRI3. Revisa desplazamientos, tensiones, calidad y equilibrio.',
    en: 'Import a 2D Gmsh mesh or try the TRI3 patch. Review displacements, stresses, quality, and equilibrium.',
  },
  continueLabel: hasStudy ? { es: 'Continuar estudio', en: 'Continue study' } : { es: 'Abrir ejemplo', en: 'Open example' },
  stageAlt: { es: 'Placa perforada en arcilla con su malla triangular, empotrada y cargada', en: 'Perforated clay plate with its triangular mesh, fixed and loaded' },
  startBody: { es: 'Prueba el análisis o trae tu propia malla.', en: 'Try the analysis or bring your own mesh.' },
  paths: [
    { id: 'analyze', icon: FlaskConical, label: hasStudy ? { es: 'Analizar el estudio actual', en: 'Analyse the current study' } : { es: 'Analizar el caso de prueba', en: 'Analyse the test case' },
      body: hasStudy ? { es: 'Ejecuta el análisis sobre la malla guardada en este proyecto.', en: 'Run the analysis on the mesh saved in this project.' } : { es: 'Ejecuta un parche TRI3 de tres nudos con solución conocida.', en: 'Run a three-node TRI3 patch with a known solution.' },
      action: onAnalyze },
    { id: 'gmsh', icon: Upload, label: { es: 'Importar malla Gmsh 4.1', en: 'Import a Gmsh 4.1 mesh' },
      body: { es: 'Trae un .msh ASCII; se valida antes de guardarse en el proyecto.', en: 'Bring an ASCII .msh; it is validated before it is saved.' },
      accept: '.msh,text/plain', onFile: onImport },
  ],
  capabilities: [
    { id: 'elasticity', state: 'experimental', label: { es: 'Elasticidad lineal 2D', en: 'Linear 2D elasticity' },
      body: { es: 'Esfuerzo plano y deformación plana, con material isótropo.', en: 'Plane stress and plane strain with an isotropic material.' } },
    { id: 'elements', state: 'experimental', label: { es: 'TRI3 y QUAD4', en: 'TRI3 and QUAD4' },
      body: { es: 'Triángulos de deformación constante y cuadriláteros bilineales.', en: 'Constant-strain triangles and bilinear quadrilaterals.' } },
    { id: 'fields', state: 'experimental', label: { es: 'Tensiones y von Mises', en: 'Stresses and von Mises' },
      body: { es: 'Desplazamientos, reacciones, tensiones principales y von Mises por elemento.', en: 'Displacements, reactions, principal stresses, and von Mises per element.' } },
    { id: 'quality', state: 'experimental', label: { es: 'Calidad y equilibrio', en: 'Quality and equilibrium' },
      body: { es: 'Cada corrida publica la calidad de la malla y el residuo de equilibrio.', en: 'Every run reports mesh quality and the equilibrium residual.' } },
    { id: 'exchange', state: 'available', label: { es: 'Gmsh, JSON y VTK', en: 'Gmsh, JSON, and VTK' },
      body: { es: 'Importa Gmsh 4.1 ASCII y exporta el estudio a JSON o a VTK para ParaView.', en: 'Imports Gmsh 4.1 ASCII and exports the study to JSON or to VTK for ParaView.' } },
    { id: 'shells', state: 'planned', label: { es: 'MITC4 y TET4', en: 'MITC4 and TET4' },
      body: { es: 'El formato los admite; el solver los rechaza hasta tener su formulación física.', en: 'The format accepts them; the solver rejects them until their physics is formulated.' } },
  ],
  note: {
    es: 'FEM es experimental. La malla, el material y las condiciones de borde son tuyos: un campo de tensiones no sustituye una revisión independiente.',
    en: 'FEM is experimental. The mesh, the material, and the boundary conditions are yours: a stress field does not replace an independent review.',
  },
});

/** Bienvenida de Elementos finitos (FS-A03). */
export default function FemHome({ onOpenWorkspace, onOpenSuite }: { onOpenWorkspace: () => void; onOpenSuite: () => void }) {
  const { project } = useProject();
  const { language } = useI18n();
  const session = useSharedToolState()?.session;
  const studies = session?.currentBundle(project.id)?.fem;
  const study = useMemo(() => readStoredFemStudy(studies), [studies]);
  const [importError, setImportError] = useState<string | null>(null);
  const en = language === 'en';
  const summary = [
    { value: study?.document.nodes.length ?? 0, label: en ? 'nodes' : 'nodos' },
    { value: study?.document.elements.length ?? 0, label: en ? 'elements' : 'elementos' },
    { value: study?.analysis ? (study.analysis.success ? (en ? 'solved' : 'resuelto') : (en ? 'review' : 'revisar')) : (en ? 'not run' : 'sin correr'), label: en ? 'study' : 'estudio' },
  ];
  const analyze = () => {
    setToolIntent({ tool: 'fem', kind: 'analyze' });
    onOpenWorkspace();
  };
  const importGmsh = (file: File) => {
    if (file.size > MAX_GMSH_BYTES) {
      setImportError(en ? `${file.name} is larger than 16 MB.` : `${file.name} supera 16 MB.`);
      return;
    }
    void file.text().then((text) => {
      setToolIntent({ tool: 'fem', kind: 'import-gmsh', fileName: file.name, text });
      onOpenWorkspace();
    }, () => setImportError(en ? `Could not read ${file.name}.` : `No se pudo leer ${file.name}.`));
  };
  return <>
    <ToolHome tool="fem" content={content(Boolean(study), analyze, importGmsh)} summary={summary} onOpenWorkspace={onOpenWorkspace} onOpenSuite={onOpenSuite} />
    {importError ? <p className="tool-home__toast" role="alert">{importError}</p> : null}
  </>;
}
