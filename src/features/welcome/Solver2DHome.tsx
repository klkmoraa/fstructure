import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ArrowUpRight, FilePlus2, GraduationCap, LayoutTemplate, Play, Upload, X } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { SOLVER_2D } from '../../design-system/moduleIdentity';
import type { ProjectModel, ThemeMode } from '../../types';
import { ThreeStructuralImage } from '../structural-assets';
import { ENGINEERING_QUOTES } from './engineeringQuotes';
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
    lead: 'Modela, analiza y comprende estructuras.',
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
    dismissQuote: 'Cerrar reflexión',
    creatorLabel: 'Creador:',
    about: 'Acerca de FStructure',
  },
  en: {
    role: '2D Solver',
    lead: 'Model, analyse, and understand structures.',
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
    dismissQuote: 'Dismiss quote',
    creatorLabel: 'Creator:',
    about: 'About FStructure',
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
  const [activeQuote] = useState(() => {
    const index = Math.floor(Math.random() * ENGINEERING_QUOTES.length);
    return ENGINEERING_QUOTES[index] ?? ENGINEERING_QUOTES[0];
  });
  const [quoteVisible, setQuoteVisible] = useState(true);

  useEffect(() => {
    if (!quoteVisible) return undefined;
    const timer = window.setTimeout(() => {
      setQuoteVisible(false);
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [quoteVisible]);

  const paths = [
    // Una ruta de entrada no es un resultado del solver: lleva el color de la
    // familia del brandbook a la que pertenece lo que abre, no el de una señal
    // de dominio. Con la señal prestada, «Empezar en blanco» compartía color
    // con una carga aplicada y no significaba nada.
    { id: 'blank', icon: FilePlus2, tone: 'var(--sc-color-family-modelo)', label: text.pathBlank, body: text.pathBlankBody, action: onCreateBlank },
    { id: 'template', icon: LayoutTemplate, tone: 'var(--sc-color-family-analisis)', label: text.pathTemplate, body: text.pathTemplateBody, action: onOpenTemplates },
    { id: 'classroom', icon: GraduationCap, tone: 'var(--sc-color-family-aprendizaje)', label: text.pathClassroom, body: text.pathClassroomBody, action: onOpenClassroom },
    { id: 'import', icon: Upload, tone: 'var(--sc-color-family-interop)', label: text.pathImport, body: text.pathImportBody, action: onOpenImport },
  ] as const;

  const capabilities = [
    { id: 'model', state: 'available', label: text.capModel, body: text.capModelBody },
    { id: 'analysis', state: 'available', label: text.capAnalysis, body: text.capAnalysisBody },
    { id: 'studies', state: 'experimental', label: text.capStudies, body: text.capStudiesBody },
    { id: 'docs', state: 'available', label: text.capDocs, body: text.capDocsBody },
    { id: 'interop', state: 'experimental', label: text.capInterop, body: text.capInteropBody },
    { id: 'learning', state: 'available', label: text.capLearning, body: text.capLearningBody },
  ] as const;

  const quoteToast = typeof document !== 'undefined' ? createPortal(
    <AnimatePresence>
      {quoteVisible ? (
        <m.aside
          key={activeQuote.id}
          className="solver2d-quote-toast"
          role="status"
          aria-live="polite"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 32, scale: 0.96 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={
            reducedMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 16, scale: 0.96, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }
          }
          transition={
            reducedMotion
              ? { duration: 0.01 }
              : { type: 'spring', stiffness: 420, damping: 30, mass: 0.8 }
          }
        >
          <div className="solver2d-quote-toast__body">
            <blockquote className="solver2d-quote-toast__text">
              “{activeQuote.text[language]}”
            </blockquote>
            <cite className="solver2d-quote-toast__author">
              — {activeQuote.author}
            </cite>
          </div>
          <button
            type="button"
            className="solver2d-quote-toast__close"
            onClick={() => setQuoteVisible(false)}
            aria-label={text.dismissQuote}
          >
            <X size={14} aria-hidden="true" />
          </button>
          <div className="solver2d-quote-toast__progress" aria-hidden="true">
            <div
              className="solver2d-quote-toast__bar"
              onAnimationEnd={() => setQuoteVisible(false)}
            />
          </div>
        </m.aside>
      ) : null}
    </AnimatePresence>,
    document.body,
  ) : null;

  return <div className={`solver2d-home${reducedMotion ? ' is-static' : ''}`}>
    {quoteToast}

    <section className="solver2d-hero" aria-labelledby="solver2d-hero-name">
      <div className="solver2d-hero__copy">
        <span className="solver2d-hero__eyebrow" style={{ '--reveal-step': 0 } as React.CSSProperties}>{SOLVER_2D.product}<b>·</b>{text.role}</span>
        <h1 id="solver2d-hero-name" className="solver2d-hero__name" style={{ '--reveal-step': 1 } as React.CSSProperties}>{text.leadStrong}</h1>
        <p className="solver2d-hero__lead" style={{ '--reveal-step': 2 } as React.CSSProperties}>{text.lead}</p>

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
        <div className={`solver2d-stage${reducedMotion ? ' is-static' : ''}`} data-theme={theme}>
          <div className="solver2d-stage__object">
            <ThreeStructuralImage assetId="portal:single-bay" theme={theme} alt={text.stageAlt} eager render="three" />
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
