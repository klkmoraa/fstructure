import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Blocks,
  Box,
  DraftingCompass,
  GraduationCap,
  Layers3,
  Network,
  Ruler,
  type LucideIcon,
} from 'lucide-react';
import './fusionLanding.css';

interface FusionLandingProps {
  language: 'es' | 'en';
  onOpenSolver2D: () => void;
  onOpenSolver3D?: () => void;
  onOpenClassroom?: () => void;
}

type Localized = { es: string; en: string };
type ToolState = 'available' | 'experimental' | 'planned';
type ToolTone = 'blue' | 'red' | 'green' | 'yellow' | 'purple' | 'pink';

interface ToolDefinition {
  id: string;
  code: string;
  name: Localized;
  summary: Localized;
  state: ToolState;
  tone: ToolTone;
  image: string;
  icon: LucideIcon;
  action?: 'solver2d' | 'solver3d' | 'classroom';
}

const TOOLS: readonly ToolDefinition[] = [
  {
    id: 'solver-2d',
    code: 'FS-A01',
    name: { es: 'Solver 2D', en: '2D Solver' },
    summary: { es: 'Modela, resuelve y documenta sistemas planos.', en: 'Model, solve, and document planar systems.' },
    state: 'available',
    tone: 'blue',
    image: 'solver-2d.webp',
    icon: Ruler,
    action: 'solver2d',
  },
  {
    id: 'solver-3d',
    code: 'FS-A02',
    name: { es: 'Solver 3D', en: '3D Solver' },
    summary: { es: 'Explora modelos espaciales y su respuesta estructural.', en: 'Explore spatial models and their structural response.' },
    state: 'experimental',
    tone: 'red',
    image: 'solver-3d.webp',
    icon: Box,
    action: 'solver3d',
  },
  {
    id: 'finite-elements',
    code: 'FS-A03',
    name: { es: 'Elementos finitos', en: 'Finite elements' },
    summary: { es: 'Superficies, mallas y resultados verificables.', en: 'Surfaces, meshes, and verifiable results.' },
    state: 'planned',
    tone: 'purple',
    image: 'finite-elements.webp',
    icon: Layers3,
  },
  {
    id: 'cad',
    code: 'FS-M01',
    name: { es: 'CAD', en: 'CAD' },
    summary: { es: 'Geometría abierta para intercambio con flujos CAD.', en: 'Open geometry for CAD exchange workflows.' },
    state: 'planned',
    tone: 'blue',
    image: 'cad.webp',
    icon: DraftingCompass,
  },
  {
    id: 'bim',
    code: 'FS-M02',
    name: { es: 'BIM', en: 'BIM' },
    summary: { es: 'Modelo coordinado, propiedades y procedencia.', en: 'Coordinated model, properties, and provenance.' },
    state: 'planned',
    tone: 'green',
    image: 'bim.webp',
    icon: Blocks,
  },
  {
    id: 'quantities',
    code: 'FS-P02',
    name: { es: 'Cantidades y costos', en: 'Quantities and costs' },
    summary: { es: 'Puente futuro hacia presupuestos tipo Neodata.', en: 'A future bridge to Neodata-style estimating.' },
    state: 'planned',
    tone: 'yellow',
    image: 'quantities-costs.webp',
    icon: Network,
  },
  {
    id: 'classroom',
    code: 'FS-L01',
    name: { es: 'Aula estructural', en: 'Structural classroom' },
    summary: { es: 'Ejemplos y explicaciones conectados al modelo.', en: 'Examples and explanations connected to the model.' },
    state: 'available',
    tone: 'pink',
    image: 'classroom.webp',
    icon: GraduationCap,
    action: 'classroom',
  },
];

const copy = {
  es: {
    eyebrow: 'Make complexity legible.',
    title: 'Un proyecto. Todas tus herramientas.',
    body: 'Modela, analiza y conserva el contexto estructural sin convertir cada etapa en un archivo aislado.',
    explore: 'Explorar herramientas',
    flow: 'Ver cómo se conecta',
    heroStatus: 'Plataforma experimental',
    toolsEyebrow: 'Herramientas',
    toolsTitle: 'Elige la superficie que necesitas.',
    toolsBody: '2D y 3D son productos separados dentro del mismo proyecto. Lo futuro se muestra como futuro.',
    activeLabel: 'Trabajar ahora',
    futureLabel: 'Siguiente horizonte',
    available: 'Disponible',
    experimental: 'Experimental',
    planned: 'Planeado',
    open: 'Abrir',
    preparing: 'En preparación',
    flowEyebrow: 'Proyecto común',
    flowTitle: 'La continuidad es la herramienta principal.',
    flowBody: 'Identidad, unidades, modelo, hipótesis y resultados permanecen relacionados mientras cambia la superficie de trabajo.',
    flowSteps: ['Define el proyecto', 'Construye el modelo', 'Analiza con evidencia', 'Entrega con contexto'],
    note: 'FusionStructure está en evolución. No sustituye revisión profesional ni constituye software certificado para obra.',
  },
  en: {
    eyebrow: 'Make complexity legible.',
    title: 'One project. Every tool.',
    body: 'Model, analyse, and preserve structural context without turning every phase into an isolated file.',
    explore: 'Explore tools',
    flow: 'See how it connects',
    heroStatus: 'Experimental platform',
    toolsEyebrow: 'Tools',
    toolsTitle: 'Choose the surface you need.',
    toolsBody: '2D and 3D are separate products inside the same project. Future work is shown as future work.',
    activeLabel: 'Work now',
    futureLabel: 'Next horizon',
    available: 'Available',
    experimental: 'Experimental',
    planned: 'Planned',
    open: 'Open',
    preparing: 'In preparation',
    flowEyebrow: 'Shared project',
    flowTitle: 'Continuity is the primary tool.',
    flowBody: 'Identity, units, model, assumptions, and results stay related as the working surface changes.',
    flowSteps: ['Define the project', 'Build the model', 'Analyse with evidence', 'Deliver with context'],
    note: 'FusionStructure is evolving. It does not replace professional review or constitute certified construction software.',
  },
} as const;

const stateLabel = (state: ToolState, language: 'es' | 'en') => copy[language][state];

export const FusionLanding = ({ language, onOpenSolver2D, onOpenSolver3D, onOpenClassroom }: FusionLandingProps) => {
  const text = copy[language];
  const primaryTools = TOOLS.slice(0, 2);
  const futureTools = TOOLS.slice(2);

  const openTool = (action: ToolDefinition['action']) => {
    if (action === 'solver2d') onOpenSolver2D();
    if (action === 'solver3d') onOpenSolver3D?.();
    if (action === 'classroom') onOpenClassroom?.();
  };

  const renderTool = (tool: ToolDefinition, featured = false) => {
    const Icon = tool.icon;
    const canOpen = Boolean(tool.action);
    const toolName = tool.name[language];

    return (
      <article className={`fs-tool-card${featured ? ' fs-tool-card--featured' : ''}`} data-tone={tool.tone} key={tool.id}>
        <div className="fs-tool-card__media" aria-hidden="true">
          <span className="fs-tool-card__datum fs-tool-card__datum--x" />
          <span className="fs-tool-card__datum fs-tool-card__datum--y" />
          <img
            src={`./assets/landing/clay-tools/${tool.image}`}
            width={featured ? 720 : 560}
            height={featured ? 540 : 420}
            alt=""
            loading={featured ? 'eager' : 'lazy'}
            decoding="async"
          />
        </div>
        <div className="fs-tool-card__content">
          <div className="fs-tool-card__meta">
            <span className="fs-tool-card__code">{tool.code}</span>
            <span className="fs-tool-state" data-state={tool.state}>{stateLabel(tool.state, language)}</span>
          </div>
          <div className="fs-tool-card__title">
            <Icon size={featured ? 20 : 18} aria-hidden="true" />
            <h3>{toolName}</h3>
          </div>
          <p>{tool.summary[language]}</p>
          <button
            type="button"
            className="fs-tool-card__action"
            disabled={!canOpen}
            onClick={() => openTool(tool.action)}
            aria-label={canOpen ? `${text.open} ${toolName}` : `${toolName}: ${text.preparing}`}
          >
            {canOpen ? text.open : text.preparing}
            {canOpen ? <ArrowUpRight size={16} aria-hidden="true" /> : null}
          </button>
        </div>
      </article>
    );
  };

  return (
    <main className="fs-landing">
      <nav className="fs-landing-nav" aria-label={language === 'es' ? 'Navegación de plataforma' : 'Platform navigation'}>
        <a className="fs-landing-nav__brand" href="#fusion-top" aria-label="FusionStructure">
          <span className="fs-brandmark" aria-hidden="true">
            <img className="fs-brandmark__light" src="./assets/brand/fusionstructure-mark.svg" alt="" />
            <img className="fs-brandmark__dark" src="./assets/brand/fusionstructure-mark-inverse.svg" alt="" />
          </span>
          <span>FusionStructure</span>
        </a>
        <div className="fs-landing-nav__links">
          <a href="#fusion-tools">{text.toolsEyebrow}</a>
          <a href="#fusion-flow">{text.flowEyebrow}</a>
        </div>
        <span className="fs-landing-nav__state"><span aria-hidden="true" />{text.heroStatus}</span>
      </nav>

      <section className="fs-landing-hero" id="fusion-top" aria-labelledby="fusion-landing-title">
        <div className="fs-landing-hero__copy">
          <span className="fs-landing-eyebrow">{text.eyebrow}</span>
          <h1 id="fusion-landing-title">{text.title}</h1>
          <p>{text.body}</p>
          <div className="fs-landing-hero__actions">
            <a className="fs-action fs-action--primary" href="#fusion-tools">
              {text.explore}<ArrowDown size={16} aria-hidden="true" />
            </a>
            <a className="fs-action" href="#fusion-flow">
              {text.flow}<ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="fs-landing-hero__visual" aria-hidden="true">
          <span className="fs-landing-hero__datum fs-landing-hero__datum--x" />
          <span className="fs-landing-hero__datum fs-landing-hero__datum--y" />
          <video className="fs-hero-motion" autoPlay loop muted playsInline preload="metadata" poster="./assets/landing/clay-tools/hero-structure.webp" tabIndex={-1}>
            <source src="./assets/landing/clay-tools/hero-loop.webm" type="video/webm" />
          </video>
          <img className="fs-hero-still" src="./assets/landing/clay-tools/hero-structure.webp" width="1280" height="853" alt="" />
          <span className="fs-landing-hero__axis fs-landing-hero__axis--x">X</span>
          <span className="fs-landing-hero__axis fs-landing-hero__axis--y">Y</span>
        </div>
      </section>

      <section className="fs-tools" id="fusion-tools" aria-labelledby="fusion-tools-title">
        <header className="fs-section-heading">
          <span>{text.toolsEyebrow}</span>
          <div>
            <h2 id="fusion-tools-title">{text.toolsTitle}</h2>
            <p>{text.toolsBody}</p>
          </div>
        </header>

        <div className="fs-tools-subhead"><span>{text.activeLabel}</span><span>02</span></div>
        <div className="fs-tools-featured">{primaryTools.map((tool) => renderTool(tool, true))}</div>

        <div className="fs-tools-subhead fs-tools-subhead--future"><span>{text.futureLabel}</span><span>05</span></div>
        <div className="fs-tools-grid">{futureTools.map((tool) => renderTool(tool))}</div>
      </section>

      <section className="fs-flow" id="fusion-flow" aria-labelledby="fusion-flow-title">
        <div className="fs-flow__copy">
          <span className="fs-landing-eyebrow">{text.flowEyebrow}</span>
          <h2 id="fusion-flow-title">{text.flowTitle}</h2>
          <p>{text.flowBody}</p>
          <ol className="fs-flow__steps">
            {text.flowSteps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
        <div className="fs-flow__object" aria-hidden="true">
          <img src="./assets/landing/clay-tools/hero-structure.webp" width="1280" height="853" alt="" loading="lazy" />
          <span className="fs-flow__orbit fs-flow__orbit--one" />
          <span className="fs-flow__orbit fs-flow__orbit--two" />
        </div>
      </section>

      <footer className="fs-landing-footer">
        <a href="#fusion-top" aria-label={language === 'es' ? 'Volver al inicio' : 'Back to top'}>
          <span className="fs-brandmark fs-brandmark--small" aria-hidden="true">
            <img className="fs-brandmark__light" src="./assets/brand/fusionstructure-mark.svg" alt="" />
            <img className="fs-brandmark__dark" src="./assets/brand/fusionstructure-mark-inverse.svg" alt="" />
          </span>
          FusionStructure
        </a>
        <p>{text.note}</p>
      </footer>
    </main>
  );
};
