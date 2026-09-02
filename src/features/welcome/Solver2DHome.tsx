import type { ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, FilePlus2, GraduationCap, LayoutTemplate, Play, Upload } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { Solver2DMark } from '../../design-system/brand';
import { SOLVER_2D } from '../../design-system/moduleIdentity';
import type { ProjectModel, ThemeMode } from '../../types';
import { ThreeStructuralImage } from '../structural-assets';
import './solver2dHome.css';

export interface Solver2DHomeProps {
  language: 'es' | 'en';
  /** Tema activo. La escena de portada tiene un render por tema, no un filtro. */
  theme: ThemeMode;
  project: ProjectModel;
  onContinue: () => void;
  onCreateBlank: () => void;
  onOpenTemplates: () => void;
  onOpenClassroom: () => void;
  onOpenImport: () => void;
  onOpenProjects: () => void;
  /** Lista de proyectos guardados. La inyecta la pantalla, no la resuelve aquí. */
  recents: ReactNode;
  /** Se dispara al acercarse a la acción principal para precargar el editor. */
  onPreloadWorkspace?: () => void;
}

const copy = {
  es: {
    role: 'Solver 2D',
    lead: 'Modela nudos, barras, apoyos y cargas en un plano; obtén reacciones, N-V-M, deformada y envolventes con las hipótesis a la vista.',
    leadStrong: 'Del trazo al diagrama.',
    open: 'Proyecto abierto',
    continue: 'Continuar',
    create: 'Nuevo modelo',
    stageAlt: 'Pórtico de un vano en tres dimensiones, con sus placas base y sus anclajes',
    nodes: 'nudos',
    members: 'barras',
    loads: 'cargas',
    startTitle: 'Por dónde empezar',
    startBody: 'Cuatro entradas al mismo editor.',
    pathBlank: 'Modelo en blanco',
    pathBlankBody: 'Empieza con la rejilla vacía y coloca el primer nudo.',
    pathTemplate: 'Plantilla',
    pathTemplateBody: 'Abre una estructura preparada y adáptala.',
    pathClassroom: 'Aula',
    pathClassroomBody: 'Un caso guiado que no te quita el control del modelo.',
    pathImport: 'Importar',
    pathImportBody: 'Trae un expediente, un JSON o un DXF y revísalo antes.',
    recentTitle: 'Proyectos recientes',
    recentBody: 'Guardados en este dispositivo.',
    viewAll: 'Ver todos',
    capabilityTitle: 'Qué hace FStructure',
    capabilityBody: 'Cada capacidad lleva su estado declarado.',
    available: 'Disponible',
    experimental: 'Experimental',
    capModel: 'Modelado y edición',
    capModelBody: 'Nudos, barras, apoyos, cargas, casos y combinaciones, con selección, snapping y deshacer.',
    capAnalysis: 'Análisis lineal y P-Delta',
    capAnalysisBody: 'Reacciones, N-V-M, deformada y envolventes con unidades y supuestos a la vista.',
    capStudies: 'Estudios avanzados',
    capStudiesBody: 'Pandeo, modos y líneas de influencia. Se calculan y se explican; no sustituyen una revisión independiente.',
    capDocs: 'Memorias y exportación',
    capDocsBody: 'Memoria PDF, expediente portable, SVG, PNG, CSV y lista de materiales.',
    capInterop: 'Interoperabilidad',
    capInteropBody: 'Importación de un subconjunto DXF, enlaces compartibles y versiones locales.',
    capLearning: 'Trazabilidad educativa',
    capLearningBody: 'Cada resultado puede abrir su método, sus unidades y sus límites.',
    note: 'FStructure es experimental. Un resultado numérico puede ser incorrecto por un modelo, una unidad, una hipótesis o una propiedad mal elegida: no sustituye el criterio de una persona responsable ni una revisión independiente.',
  },
  en: {
    role: '2D Solver',
    lead: 'Model nodes, members, supports, and loads on a plane; get reactions, N-V-M, deflected shape, and envelopes with the assumptions in plain sight.',
    leadStrong: 'From line to diagram.',
    open: 'Open project',
    continue: 'Continue',
    create: 'New model',
    stageAlt: 'Single-bay portal frame in three dimensions, with its base plates and anchors',
    nodes: 'nodes',
    members: 'members',
    loads: 'loads',
    startTitle: 'Where to start',
    startBody: 'Four ways into the same editor.',
    pathBlank: 'Blank model',
    pathBlankBody: 'Start with an empty grid and place the first node.',
    pathTemplate: 'Template',
    pathTemplateBody: 'Open a prepared structure and adapt it.',
    pathClassroom: 'Classroom',
    pathClassroomBody: 'A guided case that keeps you in control of the model.',
    pathImport: 'Import',
    pathImportBody: 'Bring in a record, a JSON, or a DXF and review it first.',
    recentTitle: 'Recent projects',
    recentBody: 'Saved on this device.',
    viewAll: 'View all',
    capabilityTitle: 'What FStructure does',
    capabilityBody: 'Every capability carries its declared state.',
    available: 'Available',
    experimental: 'Experimental',
    capModel: 'Modelling and editing',
    capModelBody: 'Nodes, members, supports, loads, cases, and combinations, with selection, snapping, and undo.',
    capAnalysis: 'Linear and P-Delta analysis',
    capAnalysisBody: 'Reactions, N-V-M, deflected shape, and envelopes with units and assumptions in plain sight.',
    capStudies: 'Advanced studies',
    capStudiesBody: 'Buckling, modes, and influence lines. They are computed and explained; they do not replace an independent review.',
    capDocs: 'Reports and export',
    capDocsBody: 'PDF report, portable record, SVG, PNG, CSV, and bill of materials.',
    capInterop: 'Interoperability',
    capInteropBody: 'Import of a DXF subset, shareable links, and local versions.',
    capLearning: 'Educational traceability',
    capLearningBody: 'Every result can open its method, its units, and its limits.',
    note: 'FStructure is experimental. A numeric result can be wrong because of a model, a unit, an assumption, or a badly chosen property: it does not replace the judgement of a responsible person or an independent review.',
  },
} as const;

export const Solver2DHome = ({
  language,
  theme,
  project,
  onContinue,
  onCreateBlank,
  onOpenTemplates,
  onOpenClassroom,
  onOpenImport,
  onOpenProjects,
  recents,
  onPreloadWorkspace,
}: Solver2DHomeProps) => {
  const text = copy[language];
  const reducedMotion = useReducedMotion() ?? false;
  const loadCount = project.nodalLoads.length + project.memberLoads.length;

  const paths = [
    { id: 'blank', icon: FilePlus2, tone: 'var(--fs-signal-action)', label: text.pathBlank, body: text.pathBlankBody, action: onCreateBlank },
    { id: 'template', icon: LayoutTemplate, tone: 'var(--fs-signal-axial)', label: text.pathTemplate, body: text.pathTemplateBody, action: onOpenTemplates },
    { id: 'classroom', icon: GraduationCap, tone: 'var(--fs-signal-shear)', label: text.pathClassroom, body: text.pathClassroomBody, action: onOpenClassroom },
    { id: 'import', icon: Upload, tone: 'var(--fs-signal-deformed)', label: text.pathImport, body: text.pathImportBody, action: onOpenImport },
  ] as const;

  const capabilities = [
    { id: 'model', state: 'available', label: text.capModel, body: text.capModelBody },
    { id: 'analysis', state: 'available', label: text.capAnalysis, body: text.capAnalysisBody },
    { id: 'studies', state: 'experimental', label: text.capStudies, body: text.capStudiesBody },
    { id: 'docs', state: 'available', label: text.capDocs, body: text.capDocsBody },
    { id: 'interop', state: 'experimental', label: text.capInterop, body: text.capInteropBody },
    { id: 'learning', state: 'available', label: text.capLearning, body: text.capLearningBody },
  ] as const;

  return <div className={`solver2d-home${reducedMotion ? ' is-static' : ''}`}>
    <section className="solver2d-hero" aria-labelledby="solver2d-hero-name">
      <div className="solver2d-hero__copy">
        <span className="solver2d-hero__eyebrow" style={{ '--reveal-step': 0 } as React.CSSProperties}>{SOLVER_2D.product}<b>·</b>{text.role}</span>
        <h1 id="solver2d-hero-name" className="solver2d-hero__name" style={{ '--reveal-step': 1 } as React.CSSProperties}><Solver2DMark size={48} />{SOLVER_2D.name}</h1>
        <p className="solver2d-hero__lead" style={{ '--reveal-step': 2 } as React.CSSProperties}><strong>{text.leadStrong}</strong> {text.lead}</p>

        <div className="solver2d-open" style={{ '--reveal-step': 3 } as React.CSSProperties} onPointerEnter={onPreloadWorkspace} onFocusCapture={onPreloadWorkspace}>
          <div className="solver2d-open__head">
            <span className="solver2d-open__label">{text.open}</span>
            <h2 className="solver2d-open__name" title={project.name}>{project.name}</h2>
            <p className="solver2d-open__counts">
              <span><b>{project.nodes.length}</b> {text.nodes}</span>
              <span><b>{project.members.length}</b> {text.members}</span>
              <span><b>{loadCount}</b> {text.loads}</span>
            </p>
          </div>
          <div className="solver2d-open__actions">
            <button type="button" className="solver2d-action solver2d-action--primary" onClick={onContinue}>
              <Play size={16} fill="currentColor" />{text.continue}
            </button>
            <button type="button" className="solver2d-action" onClick={onCreateBlank}>
              <FilePlus2 size={16} />{text.create}
            </button>
          </div>
        </div>
      </div>
      {/* La escena es el objeto y nada más. La hoja de análisis que se apoyaba
          sobre él tapaba media estructura: dos lecturas compitiendo por el
          mismo sitio, y la que perdía era justamente la que da la escala. */}
      <div className="solver2d-hero__stage" style={{ '--reveal-step': 2 } as React.CSSProperties}>
        <div className={`solver2d-stage${reducedMotion ? ' is-static' : ''}`}>
          <div className="solver2d-stage__object">
            <ThreeStructuralImage assetId="portal:single-bay" theme={theme} alt={text.stageAlt} eager />
          </div>
        </div>
      </div>
    </section>

    <section className="solver2d-section" aria-labelledby="solver2d-start-title">
      <header className="solver2d-section__head">
        <div><h2 id="solver2d-start-title">{text.startTitle}</h2><p>{text.startBody}</p></div>
      </header>
      <div className="solver2d-paths">
        {paths.map(({ id, icon: Icon, tone, label, body, action }, index) => (
          <button
            key={id}
            type="button"
            className="solver2d-path"
            style={{ '--path-tone': tone, '--reveal-step': index } as React.CSSProperties}
            onClick={action}
          >
            <span className="solver2d-path__icon" aria-hidden="true"><Icon size={17} /></span>
            <strong>{label}</strong>
            <span className="solver2d-path__body">{body}</span>
            <ArrowUpRight className="solver2d-path__go" size={15} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>

    <section className="solver2d-section" aria-labelledby="solver2d-recent-title">
      <header className="solver2d-section__head">
        <div><h2 id="solver2d-recent-title">{text.recentTitle}</h2><p>{text.recentBody}</p></div>
        <button type="button" className="solver2d-section__link" onClick={onOpenProjects}>{text.viewAll}<ArrowRight size={15} /></button>
      </header>
      <div className="solver2d-recents">{recents}</div>
    </section>

    <section className="solver2d-section" aria-labelledby="solver2d-capability-title">
      <header className="solver2d-section__head">
        <div><h2 id="solver2d-capability-title">{text.capabilityTitle}</h2><p>{text.capabilityBody}</p></div>
      </header>
      <div className="solver2d-capabilities">
        {capabilities.map(({ id, state, label, body }, index) => (
          <article key={id} className="solver2d-capability" style={{ '--reveal-step': index } as React.CSSProperties}>
            <span className="solver2d-state" data-state={state}>{state === 'available' ? text.available : text.experimental}</span>
            <strong>{label}</strong>
            <p>{body}</p>
          </article>
        ))}
      </div>
      <p className="solver2d-note">{text.note}</p>
    </section>
  </div>;
};
