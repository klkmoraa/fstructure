import type { ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Box, DraftingCompass, FilePlus2, PenLine, GraduationCap, LayoutTemplate, Play, Upload } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import type { ProjectModel, ThemeMode } from '../../types';
import './solver2dHome.css';

const GitHubIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

interface Solver2DHomeProps {
  language: 'es' | 'en';
  /** Tema del contenedor de bienvenida. */
  theme: ThemeMode;
  project: ProjectModel;
  onContinue: () => void;
  onCreateBlank: () => void;
  onOpenTemplates: () => void;
  onOpenClassroom: () => void;
  onOpenImport: () => void;
  onOpenProjects: () => void;
  /** Abre la mesa en modo Diseño (el mismo proyecto). */
  onOpenDesign?: () => void;
  /** Abre la mesa en modo 3D (el mismo proyecto). */
  onOpenSpace3D?: () => void;
  /** Lista de proyectos guardados. La inyecta la pantalla, no la resuelve aquí. */
  recents: ReactNode;
  /** Se dispara al acercarse a la acción principal para precargar el editor. */
  onPreloadWorkspace?: () => void;
}

const copy = {
  es: {
    open: 'Proyecto abierto',
    continue: 'Continuar',
    create: 'Nuevo modelo',
    nodes: 'nudos',
    members: 'barras',
    loads: 'cargas',
    startTitle: 'Recursos para empezar',
    pathTemplate: 'Plantilla',
    pathTemplateBody: 'Ejemplos 2D.',
    pathClassroom: 'Aula',
    pathClassroomBody: 'Ejercicios guiados.',
    pathImport: 'Importar',
    pathImportBody: 'Expediente, JSON o DXF.',
    recentTitle: 'Proyectos recientes',
    viewAll: 'Ver todos',
    available: 'Disponible',
    experimental: 'Experimental',
    capModel: 'Modelado y edición',
    capModelBody: 'Nudos, barras, apoyos, cargas, casos y combinaciones, con selección, snapping y deshacer.',
    capAnalysis: 'Análisis lineal y P-Delta',
    capAnalysisBody: 'Reacciones, N-V-M, deformada y envolventes; cada resultado abre su método, sus unidades y sus límites.',
    capSpace3D: 'Modelo 3D',
    capSpace3DBody: 'Marcos espaciales con seis grados de libertad por nudo, diafragmas, modal, espectro y derivas.',
    capStudies: 'Estudios avanzados',
    capStudiesBody: 'Pandeo, modos y líneas de influencia. Se calculan y se explican; no sustituyen una revisión independiente.',
    capDocs: 'Memorias e intercambio',
    capDocsBody: 'Memoria PDF, expediente portable, SVG, PNG, CSV, lista de materiales, DXF y versiones locales.',
    capDesign: 'Diseño de concreto',
    capDesignBody: 'Modo Diseño: vigas y columnas del modelo 2D o de un eje del 3D, elementos sueltos y zapatas con tres normas, armado, memoria y PDF.',
    note: 'Experimental. Los resultados requieren revisión profesional.',
    creatorLabel: 'Creador:',
    about: 'Acerca de FStructure',
  },
  en: {
    open: 'Open project',
    continue: 'Continue',
    create: 'New model',
    nodes: 'nodes',
    members: 'members',
    loads: 'loads',
    startTitle: 'Starting resources',
    pathTemplate: 'Template',
    pathTemplateBody: '2D examples.',
    pathClassroom: 'Classroom',
    pathClassroomBody: 'Guided exercises.',
    pathImport: 'Import',
    pathImportBody: 'Record, JSON or DXF.',
    recentTitle: 'Recent projects',
    viewAll: 'View all',
    available: 'Available',
    experimental: 'Experimental',
    capModel: 'Modelling and editing',
    capModelBody: 'Nodes, members, supports, loads, cases, and combinations, with selection, snapping, and undo.',
    capAnalysis: 'Linear and P-Delta analysis',
    capAnalysisBody: 'Reactions, N-V-M, deflected shape, and envelopes; every result opens its method, units, and limits.',
    capSpace3D: '3D model',
    capSpace3DBody: 'Space frames with six degrees of freedom per node, diaphragms, modal, spectrum, and drifts.',
    capStudies: 'Advanced studies',
    capStudiesBody: 'Buckling, modes, and influence lines. They are computed and explained; they do not replace an independent review.',
    capDocs: 'Reports and exchange',
    capDocsBody: 'PDF report, portable record, SVG, PNG, CSV, bill of materials, DXF, and local versions.',
    capDesign: 'Concrete design',
    capDesignBody: 'Design mode: beams and columns of the 2D model or a 3D frame line, single elements and footings with three codes, reinforcement, report, and PDF.',
    note: 'Experimental. Results require professional review.',
    creatorLabel: 'Creator:',
    about: 'About FStructure',
  },
} as const;

export const Solver2DHome = ({
  language,
  project,
  onContinue,
  onCreateBlank,
  onOpenTemplates,
  onOpenClassroom,
  onOpenImport,
  onOpenProjects,
  onOpenDesign,
  onOpenSpace3D,
  recents,
  onPreloadWorkspace,
}: Solver2DHomeProps) => {
  const text = copy[language];
  const reducedMotion = useReducedMotion() ?? false;
  const loadCount = project.nodalLoads.length + project.memberLoads.length;
  const paths = [
    // Una ruta de entrada no es un resultado del solver: lleva el color de la
    // familia del brandbook a la que pertenece lo que abre, no el de una señal
    // de dominio. Con la señal prestada, «Empezar en blanco» compartía color
    // con una carga aplicada y no significaba nada.
    { id: 'template', icon: LayoutTemplate, tone: 'var(--sc-color-family-analisis)', label: text.pathTemplate, body: text.pathTemplateBody, action: onOpenTemplates },
    { id: 'classroom', icon: GraduationCap, tone: 'var(--sc-color-family-aprendizaje)', label: text.pathClassroom, body: text.pathClassroomBody, action: onOpenClassroom },
    { id: 'import', icon: Upload, tone: 'var(--sc-color-family-interop)', label: text.pathImport, body: text.pathImportBody, action: onOpenImport },
  ];

  const capabilities = [
    { id: 'model', state: 'available', label: text.capModel, body: text.capModelBody },
    { id: 'analysis', state: 'available', label: text.capAnalysis, body: text.capAnalysisBody },
    { id: 'studies', state: 'experimental', label: text.capStudies, body: text.capStudiesBody },
    { id: 'space3d', state: 'experimental', label: text.capSpace3D, body: text.capSpace3DBody },
    { id: 'design', state: 'experimental', label: text.capDesign, body: text.capDesignBody },
    { id: 'docs', state: 'available', label: text.capDocs, body: text.capDocsBody },
  ] as const;

  return <div className={`solver2d-home${reducedMotion ? ' is-static' : ''}`}>

    <section className="solver2d-section solver2d-intents" aria-label={language === 'es' ? 'Elige cómo trabajar' : 'Choose your workflow'}>
      <header className="solver2d-section__head"><div><h1>{language === 'es' ? '¿Qué quieres hacer?' : 'What would you like to do?'}</h1></div></header>
      <div className="solver2d-paths">
        {[
          { label: language === 'es' ? 'Modelar 2D' : 'Model in 2D', body: language === 'es' ? 'Marcos planos.' : 'Plane frames.', Icon: PenLine, action: onContinue },
          ...(onOpenSpace3D ? [{ label: language === 'es' ? 'Modelar 3D' : 'Model in 3D', body: language === 'es' ? 'Marcos y edificios.' : 'Frames and buildings.', Icon: Box, action: onOpenSpace3D }] : []),
          ...(onOpenDesign ? [{ label: language === 'es' ? 'Diseñar un elemento' : 'Design an element', body: language === 'es' ? 'Vigas, columnas, zapatas y pórticos.' : 'Beams, columns, footings and frames.', Icon: DraftingCompass, action: onOpenDesign }] : []),
        ].map(({ label, body, Icon, action }) => <button key={label} type="button" className="solver2d-path" onClick={action}><span className="solver2d-path__icon"><Icon size={18} /></span><strong>{label}</strong><span className="solver2d-path__body">{body}</span><ArrowUpRight className="solver2d-path__go" size={15} /></button>)}
      </div>
    </section>

    <section className="solver2d-current" aria-label={text.open}>
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
    </section>

    <section className="solver2d-section solver2d-resources" aria-labelledby="solver2d-start-title">
      <header className="solver2d-section__head">
        <div><h2 id="solver2d-start-title">{text.startTitle}</h2></div>
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
        <div><h2 id="solver2d-recent-title">{text.recentTitle}</h2></div>
        <button type="button" className="solver2d-section__link" onClick={onOpenProjects}>{text.viewAll}<ArrowRight size={15} /></button>
      </header>
      <div className="solver2d-recents">{recents}</div>
    </section>

    <details className="solver2d-section solver2d-scope">
      <summary>{language === 'es' ? 'Funciones y alcance' : 'Features and scope'}</summary>
      <div className="solver2d-capabilities">
        {capabilities.map(({ id, state, label, body }, index) => (
          <article key={id} className="solver2d-capability" style={{ '--reveal-step': index } as React.CSSProperties}>
            <span className="solver2d-state" data-state={state}>{state === 'available' ? text.available : text.experimental}</span>
            <strong>{label}</strong>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </details>
    <p className="solver2d-note">{text.note}</p>

    <footer className="solver2d-footer" aria-label={text.about}>
      <p className="solver2d-footer__credit">
        <span className="solver2d-footer__label">{text.creatorLabel}</span>
        <strong className="solver2d-footer__name">Cristian Mora</strong>
      </p>
      <a
        href="https://github.com/klkmoraa/fstructure"
        target="_blank"
        rel="noopener noreferrer"
        className="solver2d-footer__github"
      >
        <GitHubIcon size={14} />
        <span>github.com/klkmoraa/fstructure</span>
        <ArrowUpRight size={13} aria-hidden="true" />
      </a>
    </footer>
  </div>;
};
