import { useMemo, useState } from 'react';
import { Columns3, LayoutGrid, RectangleHorizontal, Square, Shapes, Workflow } from 'lucide-react';
import { ToolHome, type ToolHomeContent } from '../tool-home/ToolHome';
import { setToolIntent } from '../workspace/toolIntent';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import { useSharedToolState } from '../../store/SharedToolState';
import { createBlankProject } from '../../data/defaultProject';
import { DESIGN_CODE_IDS, designCode, isDesignCodeId, type DesignCodeId } from '../../design/elements/codes';
import { parseWorkbenchDocument } from './workbench/workbenchStorage';

type Element = 'beam' | 'column' | 'frame' | 'footing' | 'section';
const ELEMENT_LABEL: Record<Element, { es: string; en: string }> = {
  beam: { es: 'Viga', en: 'Beam' },
  column: { es: 'Columna', en: 'Column' },
  frame: { es: 'Estructura', en: 'Structure' },
  footing: { es: 'Zapata', en: 'Footing' },
  section: { es: 'Secciones', en: 'Sections' },
};

const content = (onElement: (element: Element, source?: 'frame' | 'model') => void, codeControl: ToolHomeContent['pathsControl']): ToolHomeContent => ({
  title: { es: 'Del esfuerzo al armado.', en: 'From force to reinforcement.' },
  lead: {
    es: 'Diseña elementos de concreto, edita el armado y explora secciones con tres filosofías de cálculo.',
    en: 'Design concrete elements, edit reinforcement, and explore sections with three design philosophies.',
  },
  stageAlt: { es: 'Viga de concreto en arcilla con la jaula de armado expuesta', en: 'Clay concrete beam with its reinforcement cage exposed' },
  startBody: { es: 'Elige un elemento normativo o explora la calculadora experimental de secciones.', en: 'Choose a code-based element or explore the experimental section calculator.' },
  pathsControl: codeControl,
  paths: [
    { id: 'beam', icon: RectangleHorizontal, label: { es: 'Viga continua', en: 'Continuous beam' },
      body: { es: 'Claros, cargas muertas y vivas, flexión, cortante y deflexión.', en: 'Spans, dead and live loads, flexure, shear, and deflection.' },
      action: () => onElement('beam') },
    { id: 'column', icon: Columns3, label: { es: 'Columna', en: 'Column' },
      body: { es: 'Carga axial y momentos con su diagrama de interacción.', en: 'Axial load and moments with their interaction diagram.' },
      action: () => onElement('column') },
    { id: 'frame', icon: LayoutGrid, label: { es: 'Pórtico: vigas y columnas', en: 'Frame: beams and columns' },
      body: { es: 'Claros y niveles juntos, viva alternada, sismo o viento, y cada miembro diseñado.', en: 'Bays and stories together, pattern live load, lateral load, and every member designed.' },
      action: () => onElement('frame', 'frame') },
    { id: 'model', icon: Workflow, label: { es: 'Diseñar el Modelo 2D', en: 'Design the 2D model' },
      body: { es: 'Las vigas y columnas que dibujaste en FStructure 2D, con sus casos de carga.', en: 'The beams and columns you drew in FStructure 2D, with their load cases.' },
      action: () => onElement('frame', 'model') },
    { id: 'footing', icon: Square, label: { es: 'Zapata aislada', en: 'Isolated footing' },
      body: { es: 'Presión del suelo, punzonamiento, cortante y flexión.', en: 'Soil pressure, punching, shear, and flexure.' },
      action: () => onElement('footing') },
    { id: 'section', icon: Shapes, label: { es: 'Secciones y filosofías', en: 'Sections and philosophies' },
      body: { es: 'Seis geometrías, flexión, columnas cortas, acero, concreto y recubrimiento.', en: 'Six geometries, flexure, short columns, steel, concrete, and cover.' },
      action: () => onElement('section') },
  ],
  capabilities: [
    { id: 'codes', state: 'experimental', label: { es: 'Tres normas', en: 'Three codes' },
      body: { es: 'NTC-CDMX 2023, NSR-10 y E.060, con sus factores y combinaciones.', en: 'NTC-CDMX 2023, NSR-10, and E.060, with their factors and combinations.' } },
    { id: 'beam', state: 'experimental', label: { es: 'Vigas continuas', en: 'Continuous beams' },
      body: { es: 'Envolventes por carga viva alternada, acero longitudinal, bastones y estribos.', en: 'Pattern live-load envelopes, longitudinal steel, cut-off bars, and stirrups.' } },
    { id: 'column', state: 'experimental', label: { es: 'Columnas', en: 'Columns' },
      body: { es: 'Diagrama de interacción y revisión de la demanda contra la capacidad.', en: 'Interaction diagram and demand-to-capacity check.' } },
    { id: 'frame', state: 'experimental', label: { es: 'Estructuras', en: 'Structures' },
      body: { es: 'Un pórtico generado o el Modelo 2D: envolventes, k, índice de estabilidad y diseño de cada miembro.', en: 'A generated frame or the 2D model: envelopes, k, stability index, and every member designed.' } },
    { id: 'footing', state: 'experimental', label: { es: 'Zapatas', en: 'Footings' },
      body: { es: 'Dimensionamiento en planta, punzonamiento y armado en ambas direcciones.', en: 'Plan sizing, punching, and reinforcement in both directions.' } },
    { id: 'memo', state: 'available', label: { es: 'Memoria de cálculo', en: 'Calculation report' },
      body: { es: 'Revisión, diagramas y cantidades; guarda elementos y exporta el proyecto en PDF.', en: 'Checks, diagrams, and quantities; save elements and export the project as PDF.' } },
    { id: 'isolated', state: 'available', label: { es: 'Taller propio', en: 'Own workbench' },
      body: { es: 'Los datos del taller se guardan en el proyecto. Del Modelo 2D sólo se lee la estructura, y nunca se modifica.', en: 'Workbench data is saved in the project. The 2D model is only read, never modified.' } },
  ],
  note: {
    es: 'Diseño es experimental. Propone un armado, no firma un plano: la revisión de una persona responsable sigue siendo obligatoria.',
    en: 'Design is experimental. It proposes reinforcement; it does not sign a drawing. Review by a responsible person is still required.',
  },
});

/** Bienvenida de Diseño (FS-A04). */
export default function DesignHome({ onOpenWorkspace, onOpenSuite }: { onOpenWorkspace: () => void; onOpenSuite: () => void }) {
  const { project, replaceProject } = useProject();
  const { language } = useI18n();
  const session = useSharedToolState()?.session;
  const draft = session?.currentBundle(project.id)?.design;
  const entries = useMemo(() => parseWorkbenchDocument(draft), [draft]);
  const storedCode = isDesignCodeId(entries.code) ? entries.code : 'ntc-2023';
  const storedElement: Element = entries.element === 'column' || entries.element === 'frame' || entries.element === 'footing' || entries.element === 'section' ? entries.element : 'beam';
  const [code, setCode] = useState<DesignCodeId>(storedCode);
  const en = language === 'en';

  const summary = [
    { value: ELEMENT_LABEL[storedElement][language], label: en ? 'last element' : 'último elemento' },
    { value: storedElement === 'section' ? 'Experimental' : designCode(code).name, label: storedElement === 'section' ? (en ? 'model' : 'modelo') : (en ? 'code' : 'norma') },
  ];
  const openElement = (element: Element, source?: 'frame' | 'model') => {
    setToolIntent({ tool: 'design', kind: 'element', element, code, ...(source ? { source } : {}) });
    onOpenWorkspace();
  };
  const continueDesign = () => openElement(storedElement);
  const newProject = () => {
    const blank = createBlankProject();
    replaceProject({ ...blank, settings: { ...blank.settings, language } });
    setToolIntent({ tool: 'design', kind: 'element', element: 'beam', code });
    onOpenWorkspace();
  };
  const codeControl = <div className="tool-home__segmented" role="group" aria-label={en ? 'Design code' : 'Norma de diseño'}>
    {DESIGN_CODE_IDS.map((id) => <button key={id} type="button" aria-pressed={code === id} onClick={() => setCode(id)}>{designCode(id).name}</button>)}
  </div>;
  return <ToolHome tool="design" content={content(openElement, codeControl)} summary={summary} onOpenWorkspace={continueDesign} onOpenSuite={onOpenSuite} onCreateProject={newProject} />;
}
