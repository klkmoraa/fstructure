import { useMemo } from 'react';
import { Box, FilePlus2, Sparkles, Spline } from 'lucide-react';
import { ToolHome, type ToolHomeContent } from '../../features/tool-home/ToolHome';
import { setToolIntent } from '../../features/workspace/toolIntent';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import { useSharedToolState } from '../../store/SharedToolState';
import { createBlankProject } from '../../data/defaultProject';
import { parseSpace3DDraft } from './space3d/data/codec';

const content = (onIntent: (kind: 'generate' | 'example' | 'first-node') => void, onNewProject: () => void): ToolHomeContent => ({
  title: { es: 'Del nudo al espacio.', en: 'From node to space.' },
  lead: {
    es: 'Modela marcos espaciales y resuélvelos con seis grados de libertad por nudo.',
    en: 'Model space frames and solve them with six degrees of freedom per node.',
  },
  stageAlt: { es: 'Marco espacial de dos niveles en arcilla, con arriostramiento en cruz', en: 'Two-storey clay space frame with cross bracing' },
  startBody: { es: 'Cuatro entradas a la mesa 3D.', en: 'Four ways into the 3D workbench.' },
  paths: [
    { id: 'first-node', icon: Spline, label: { es: 'Colocar un nudo', en: 'Place a node' },
      body: { es: 'Escribe sus coordenadas X, Y, Z en el modelo abierto.', en: 'Type its X, Y, Z coordinates in the open model.' },
      action: () => onIntent('first-node') },
    { id: 'example', icon: Box, label: { es: 'Abrir el ejemplo', en: 'Open the example' },
      body: { es: 'Un pórtico espacial con apoyos y cargas, listo para analizar.', en: 'A space portal with supports and loads, ready to analyse.' },
      action: () => onIntent('example') },
    { id: 'generate', icon: Sparkles, label: { es: 'Generar una estructura', en: 'Generate a structure' },
      body: { es: 'Describe un edificio, una nave o una torre y ajusta el generador.', en: 'Describe a building, a shed, or a tower and tune the generator.' },
      action: () => onIntent('generate') },
    { id: 'new', icon: FilePlus2, label: { es: 'Proyecto nuevo', en: 'New project' },
      body: { es: 'Un proyecto aparte, con su propio modelo 3D en blanco.', en: 'A separate project with its own blank 3D model.' },
      action: onNewProject },
  ],
  capabilities: [
    { id: 'model', state: 'experimental', label: { es: 'Modelado espacial', en: 'Spatial modelling' },
      body: { es: 'Nudos, barras, apoyos y cargas en X, Y, Z, con deshacer y planos de trabajo.', en: 'Nodes, members, supports, and loads in X, Y, Z, with undo and work planes.' } },
    { id: 'generator', state: 'experimental', label: { es: 'Generador de estructuras', en: 'Structure generator' },
      body: { es: 'Edificios de marcos, naves industriales y torres a partir de una descripción.', en: 'Frame buildings, industrial sheds, and towers from a description.' } },
    { id: 'linear', state: 'experimental', label: { es: 'Lineal y P-Delta', en: 'Linear and P-Delta' },
      body: { es: 'Respuesta elástica y efecto de las cargas axiales sobre la geometría deformada.', en: 'Elastic response and the effect of axial loads on the deformed geometry.' } },
    { id: 'modal', state: 'experimental', label: { es: 'Modal y pandeo', en: 'Modal and buckling' },
      body: { es: 'Frecuencias, modos y factor de carga crítico. Se explican; no sustituyen una revisión.', en: 'Frequencies, modes, and critical load factor. Explained, not a substitute for review.' } },
    { id: 'results', state: 'experimental', label: { es: 'Resultados en el espacio', en: 'Results in space' },
      body: { es: 'Deformada, axial, cortante, momento y reacciones, con el nudo crítico señalado.', en: 'Deflected shape, axial, shear, moment, and reactions, with the critical node marked.' } },
    { id: 'isolated', state: 'available', label: { es: 'Modelo propio', en: 'Own model' },
      body: { es: 'El modelo 3D se guarda en el proyecto y no depende del Modelo 2D.', en: 'The 3D model is saved in the project and does not depend on the 2D model.' } },
  ],
  note: {
    es: 'El Solver 3D es experimental. Un resultado puede ser incorrecto por el modelo, una unidad o una hipótesis: no sustituye el criterio de una persona responsable.',
    en: 'The 3D solver is experimental. A result can be wrong because of the model, a unit, or an assumption: it does not replace the judgement of a responsible person.',
  },
});

/** Bienvenida del Solver 3D (FS-A02). */
export default function Space3DHome({ onOpenWorkspace, onOpenSuite }: { onOpenWorkspace: () => void; onOpenSuite: () => void }) {
  const { project, replaceProject } = useProject();
  const { language } = useI18n();
  const session = useSharedToolState()?.session;
  const branch = session?.currentBundle(project.id)?.space3d;
  const model = useMemo(() => {
    try { return branch ? parseSpace3DDraft(JSON.stringify(branch.model)) : null; } catch { return null; }
  }, [branch]);
  const labels = language === 'en' ? ['nodes', 'members', 'loads'] : ['nudos', 'barras', 'cargas'];
  const summary = [
    { value: model?.nodes.length ?? 0, label: labels[0]! },
    { value: model?.members.length ?? 0, label: labels[1]! },
    { value: (model?.nodalLoads.length ?? 0) + (model?.memberLoads.length ?? 0), label: labels[2]! },
  ];
  const open = (kind: 'generate' | 'example' | 'first-node') => {
    setToolIntent({ tool: 'space3d', kind });
    onOpenWorkspace();
  };
  const newProject = () => {
    const blank = createBlankProject();
    replaceProject({ ...blank, settings: { ...blank.settings, language } });
    onOpenWorkspace();
  };
  return <ToolHome tool="space3d" content={content(open, newProject)} summary={summary} onOpenWorkspace={onOpenWorkspace} onOpenSuite={onOpenSuite} />;
}
