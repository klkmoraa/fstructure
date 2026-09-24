import { useMemo, useState } from 'react';
import { Columns3, RectangleHorizontal, Square } from 'lucide-react';
import { ToolHome, type ToolHomeContent } from '../tool-home/ToolHome';
import { setToolIntent } from '../workspace/toolIntent';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import { useSharedToolState } from '../../store/SharedToolState';
import { createBlankProject } from '../../data/defaultProject';
import { DESIGN_CODE_IDS, designCode, isDesignCodeId, type DesignCodeId } from '../../design/elements/codes';
import { parseWorkbenchDocument } from './workbench/workbenchStorage';

type Element = 'beam' | 'column' | 'footing';
const ELEMENT_LABEL: Record<Element, { es: string; en: string }> = {
  beam: { es: 'Viga', en: 'Beam' },
  column: { es: 'Columna', en: 'Column' },
  footing: { es: 'Zapata', en: 'Footing' },
};

const content = (onElement: (element: Element) => void, codeControl: ToolHomeContent['pathsControl']): ToolHomeContent => ({
  title: { es: 'Del esfuerzo al armado.', en: 'From force to reinforcement.' },
  lead: {
    es: 'Diseña vigas, columnas y zapatas de concreto reforzado con la norma que elijas.',
    en: 'Design reinforced concrete beams, columns, and footings with the code you choose.',
  },
  stageAlt: { es: 'Viga de concreto en arcilla con la jaula de armado expuesta', en: 'Clay concrete beam with its reinforcement cage exposed' },
  startBody: { es: 'Elige el elemento; la norma se aplica a los tres.', en: 'Choose the element; the code applies to all three.' },
  pathsControl: codeControl,
  paths: [
    { id: 'beam', icon: RectangleHorizontal, label: { es: 'Viga continua', en: 'Continuous beam' },
      body: { es: 'Claros, cargas muertas y vivas, flexión, cortante y deflexión.', en: 'Spans, dead and live loads, flexure, shear, and deflection.' },
      action: () => onElement('beam') },
    { id: 'column', icon: Columns3, label: { es: 'Columna', en: 'Column' },
      body: { es: 'Carga axial y momentos con su diagrama de interacción.', en: 'Axial load and moments with their interaction diagram.' },
      action: () => onElement('column') },
    { id: 'footing', icon: Square, label: { es: 'Zapata aislada', en: 'Isolated footing' },
      body: { es: 'Presión del suelo, punzonamiento, cortante y flexión.', en: 'Soil pressure, punching, shear, and flexure.' },
      action: () => onElement('footing') },
  ],
  capabilities: [
    { id: 'codes', state: 'experimental', label: { es: 'Tres normas', en: 'Three codes' },
      body: { es: 'NTC-CDMX 2023, NSR-10 y E.060, con sus factores y combinaciones.', en: 'NTC-CDMX 2023, NSR-10, and E.060, with their factors and combinations.' } },
    { id: 'beam', state: 'experimental', label: { es: 'Vigas continuas', en: 'Continuous beams' },
      body: { es: 'Envolventes por carga viva alternada, acero longitudinal, bastones y estribos.', en: 'Pattern live-load envelopes, longitudinal steel, cut-off bars, and stirrups.' } },
    { id: 'column', state: 'experimental', label: { es: 'Columnas', en: 'Columns' },
      body: { es: 'Diagrama de interacción y revisión de la demanda contra la capacidad.', en: 'Interaction diagram and demand-to-capacity check.' } },
    { id: 'footing', state: 'experimental', label: { es: 'Zapatas', en: 'Footings' },
      body: { es: 'Dimensionamiento en planta, punzonamiento y armado en ambas direcciones.', en: 'Plan sizing, punching, and reinforcement in both directions.' } },
    { id: 'memo', state: 'available', label: { es: 'Memoria de cálculo', en: 'Calculation report' },
      body: { es: 'Cada revisión con su artículo, lista para copiar.', en: 'Every check with its clause, ready to copy.' } },
    { id: 'isolated', state: 'available', label: { es: 'Taller propio', en: 'Own workbench' },
      body: { es: 'Los datos del taller se guardan en el proyecto y no dependen del Modelo 2D.', en: 'Workbench data is saved in the project and does not depend on the 2D model.' } },
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
  const storedElement: Element = entries.element === 'column' || entries.element === 'footing' ? entries.element : 'beam';
  const [code, setCode] = useState<DesignCodeId>(storedCode);
  const en = language === 'en';

  const summary = [
    { value: ELEMENT_LABEL[storedElement][language], label: en ? 'last element' : 'último elemento' },
    { value: designCode(code).name, label: en ? 'code' : 'norma' },
  ];
  const openElement = (element: Element) => {
    setToolIntent({ tool: 'design', kind: 'element', element, code });
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
