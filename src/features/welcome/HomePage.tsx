import { Suspense, lazy, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FilePlus2,
  FileUp,
  GraduationCap,
  LayoutTemplate,
  Moon,
  Play,
  Search,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import { createBlankProject, exampleProjects } from '../../data/defaultProject';
import { FStructureMark } from '../../design-system/brand';
import { useI18n } from '../../i18n/useI18n';
import { useProject, useWorkspaceUI } from '../../store/ProjectContext';
import { exportProjectJson } from '../../utils/export';
import { ProjectHub } from '../project-hub/ProjectHub';
import { ThreeStructuralImage, type ThreeStructuralAssetId } from '../structural-assets';
import { readCanvasViewSettings } from '../view/canvasViewSettings';
import { presentExample } from './examplePresentation';
import './home.css';

// Lo que sólo se abre a pedido (biblioteca, importar, ejercicio nuevo) llega al abrirlo.
const DxfImportDialog = lazy(() => import('../../import/dxf/DxfImportDialog').then((module) => ({ default: module.DxfImportDialog })));
const PortableImportCenter = lazy(() => import('../import-export/PortableImportCenter').then((module) => ({ default: module.PortableImportCenter })));
const PersonalLibraryView = lazy(() => import('../library/PersonalLibraryView').then((module) => ({ default: module.PersonalLibraryView })));
const NewExerciseDialog = lazy(() => import('./NewExerciseDialog').then((module) => ({ default: module.NewExerciseDialog })));

type HomeView = 'home' | 'projects' | 'templates' | 'library' | 'classroom' | 'import';

interface HomePageProps {
  /** Abre la mesa en el modo 2D. */
  onOpenWorkspace: () => void;
  /** Abre la mesa en el modo 3D. */
  onOpenSpace3D: () => void;
  /** Abre la mesa en el modo Diseño. */
  onOpenDesign: (category?: 'project' | 'piece' | 'exercise') => void;
}

const copy = {
  es: {
    title: 'Modela, analiza y diseña estructuras.',
    lead: 'Pórticos en 2D y edificios en 3D, con diseño de concreto en la misma mesa.',
    open: 'Proyecto abierto', continue: 'Continuar', create: 'Nuevo',
    nodes: 'nudos', members: 'barras', loads: 'cargas',
    start: 'Empezar',
    modes: [
      { id: 'model', title: 'Modelo 2D', role: 'Marcos planos, vigas y armaduras', scene: 'model2d' },
      { id: '3d', title: 'Modelo 3D', role: 'Edificios y marcos espaciales', scene: 'space3d' },
      { id: 'design', title: 'Diseño', role: 'Vigas, columnas y zapatas de concreto', scene: 'design' },
    ],
    recent: 'Proyectos recientes', all: 'Ver todos', more: 'Más',
    home: 'Inicio', projects: 'Proyectos', templates: 'Plantillas', library: 'Biblioteca', classroom: 'Aula', import: 'Importar',
    language: 'Idioma', theme: 'Cambiar tema', search: 'Buscar', clear: 'Borrar búsqueda',
    openTemplate: 'Abrir',
    classroomStart: 'Resolver sección y acero',
    blankExercise: 'Ejercicio en blanco',
    importPortable: 'Proyecto o expediente', importPortableBody: 'JSON de FStructure',
    importDxf: 'Geometría DXF', importDxfBody: 'Líneas 2D',
    note: 'Experimental: los resultados requieren revisión profesional.',
    by: 'Hecho por Cristian Mora',
  },
  en: {
    title: 'Model, analyse and design structures.',
    lead: '2D frames and 3D buildings, with concrete design on the same workbench.',
    open: 'Open project', continue: 'Continue', create: 'New',
    nodes: 'nodes', members: 'members', loads: 'loads',
    start: 'Start',
    modes: [
      { id: 'model', title: '2D model', role: 'Plane frames, beams and trusses', scene: 'model2d' },
      { id: '3d', title: '3D model', role: 'Buildings and space frames', scene: 'space3d' },
      { id: 'design', title: 'Design', role: 'Concrete beams, columns and footings', scene: 'design' },
    ],
    recent: 'Recent projects', all: 'View all', more: 'More',
    home: 'Home', projects: 'Projects', templates: 'Templates', library: 'Library', classroom: 'Classroom', import: 'Import',
    language: 'Language', theme: 'Change theme', search: 'Search', clear: 'Clear search',
    openTemplate: 'Open',
    classroomStart: 'Design section and reinforcement',
    blankExercise: 'Blank model exercise',
    importPortable: 'Project or record', importPortableBody: 'FStructure JSON',
    importDxf: 'DXF geometry', importDxfBody: '2D lines',
    note: 'Experimental: results require professional review.',
    by: 'Made by Cristian Mora',
  },
} as const;

const exampleAssets: Record<string, ThreeStructuralAssetId> = {
  'Hibbeler · carga tributaria Fig. 2–11': 'beam:simply-supported',
  'Práctica tipo Hibbeler · diagramas': 'beam:simply-supported',
  'Práctica tipo Hibbeler · armadura': 'truss:warren',
  'Pórtico de ejemplo': 'portal:single-bay',
  'Pórtico de concreto': 'portal:two-story',
  'Viga simplemente apoyada': 'beam:simply-supported',
  'Armadura triangular': 'truss:warren',
};

const assetForExample = (name: string): ThreeStructuralAssetId => {
  if (exampleAssets[name]) return exampleAssets[name];
  if (/armadura|truss/i.test(name)) return 'truss:warren';
  if (/viga|beam|tributaria|diagrama/i.test(name)) return 'beam:simply-supported';
  return 'portal:single-bay';
};

const VIEWS: readonly HomeView[] = ['projects', 'templates', 'library', 'classroom', 'import'];

/** La sección abierta vive en la URL (`view=`): recargar o compartir la conserva. */
const readView = (): HomeView => {
  if (typeof window === 'undefined') return 'home';
  const view = new URLSearchParams(window.location.search).get('view');
  return VIEWS.includes(view as HomeView) ? view as HomeView : 'home';
};

const scene = (id: string, mode: 'day' | 'night') => `./assets/suite/${id}-${mode}.png`;

/**
 * Home de FStructure: la única portada de la app.
 *
 * Arriba lo que se hace a diario —continuar el proyecto abierto o empezar en
 * uno de los tres modos de la mesa—; debajo los proyectos recientes y los
 * accesos (plantillas, aula, importar, biblioteca), que se abren como páginas
 * de la misma Home con una flecha para volver.
 */
export const HomePage = ({ onOpenWorkspace, onOpenSpace3D, onOpenDesign }: HomePageProps) => {
  const { project, replaceProject, updateProjectView } = useProject();
  const { language, t } = useI18n();
  const { theme, setTheme } = useWorkspaceUI();
  const text = copy[language];
  const mode = theme === 'dark' ? 'night' : 'day';
  const [view, setView] = useState<HomeView>(readView);
  const mainRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [dxfOpen, setDxfOpen] = useState(false);
  const [exerciseOpen, setExerciseOpen] = useState(false);

  const navigate = (next: HomeView) => {
    setView(next);
    setQuery('');
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (next === 'home') url.searchParams.delete('view');
    else url.searchParams.set('view', next);
    window.history.replaceState(window.history.state, '', url);
    if (mainRef.current) mainRef.current.scrollTop = 0;
  };

  const openProject = (next: typeof project, restoredAnalysis?: Parameters<typeof replaceProject>[1], revision?: number) => {
    replaceProject({ ...next, settings: { ...next.settings, language } }, restoredAnalysis, revision);
    onOpenWorkspace();
  };
  const openMode = { model: onOpenWorkspace, '3d': onOpenSpace3D, design: onOpenDesign } as const;
  const loadCount = project.nodalLoads.length + project.memberLoads.length;
  const normalized = query.trim().toLocaleLowerCase(language);
  const examples = exampleProjects.filter((example) => `${example.name} ${example.description}`.toLocaleLowerCase(language).includes(normalized));

  const links = [
    { id: 'templates' as const, label: text.templates, Icon: LayoutTemplate },
    { id: 'classroom' as const, label: text.classroom, Icon: GraduationCap },
    { id: 'import' as const, label: text.import, Icon: Upload },
    { id: 'library' as const, label: text.library, Icon: BookOpen },
  ];

  const home = <>
    <section className="fh-hero" aria-labelledby="fh-title">
      <div className="fh-hero__copy">
        <h1 id="fh-title" className="fh-hero__title">{text.title}</h1>
        <p className="fh-hero__lead">{text.lead}</p>
        <div className="fh-current" aria-label={text.open}>
          <div className="fh-current__info">
            <span className="fh-current__label">{text.open}</span>
            <strong className="fh-current__name" title={project.name}>{project.name}</strong>
            <span className="fh-current__counts"><b>{project.nodes.length}</b> {text.nodes} · <b>{project.members.length}</b> {text.members} · <b>{loadCount}</b> {text.loads}</span>
          </div>
          <div className="fh-current__actions">
            <button type="button" className="fh-button fh-button--primary" onClick={onOpenWorkspace}><Play size={16} fill="currentColor" aria-hidden="true" />{text.continue}</button>
            <button type="button" className="fh-button" onClick={() => openProject(createBlankProject())}><FilePlus2 size={16} aria-hidden="true" />{text.create}</button>
          </div>
        </div>
      </div>
      <figure className="fh-hero__stage" aria-hidden="true">
        <img src={scene('portal', mode)} alt="" decoding="async" />
      </figure>
    </section>

    <section className="fh-section" aria-labelledby="fh-start">
      <h2 id="fh-start" className="fh-section__title">{text.start}</h2>
      <div className="fh-modes">
        {text.modes.map((item, index) => {
          return <button key={item.id} type="button" className="fh-mode" style={{ '--i': index } as CSSProperties} onClick={() => openMode[item.id]()}>
            <span className="fh-mode__scene"><img src={scene(item.scene, mode)} alt="" decoding="async" loading="lazy" /></span>
            <span className="fh-mode__copy">
              <strong>{item.title}</strong>
              <span>{item.role}</span>
            </span>
            <ArrowRight className="fh-mode__go" size={18} aria-hidden="true" />
          </button>;
        })}
      </div>
    </section>

    <div className="fh-split">
      <section className="fh-section" aria-labelledby="fh-recent">
        <header className="fh-section__head">
          <h2 id="fh-recent" className="fh-section__title">{text.recent}</h2>
          <button type="button" className="fh-link" onClick={() => navigate('projects')}>{text.all}<ArrowRight size={15} aria-hidden="true" /></button>
        </header>
        <div className="fh-recents"><ProjectHub variant="recent" limit={4} onOpen={(record) => openProject(record.project, undefined, record.revision)} /></div>
      </section>
      <section className="fh-section" aria-labelledby="fh-more">
        <h2 id="fh-more" className="fh-section__title">{text.more}</h2>
        <nav className="fh-links" aria-labelledby="fh-more">
          {links.map(({ id, label, Icon }) => <button key={id} type="button" className="fh-links__item" onClick={() => navigate(id)}>
            <span className="fh-links__icon" aria-hidden="true"><Icon size={18} /></span>{label}<ArrowRight className="fh-links__go" size={16} aria-hidden="true" />
          </button>)}
        </nav>
      </section>
    </div>
  </>;

  const searchable = view === 'projects' || view === 'templates';
  const page = view === 'projects' ? <ProjectHub filter={query} onOpen={(record) => openProject(record.project, undefined, record.revision)} />
    : view === 'templates' ? <div className="fh-grid">{examples.map((example) => {
      const presented = presentExample(example.name, example.description, t);
      return <button key={example.name} type="button" className="fh-card" onClick={() => openProject(example.build())}>
        <span className="fh-card__scene"><ThreeStructuralImage assetId={assetForExample(example.name)} theme={theme} render="three" eager /></span>
        <strong>{presented.name}</strong>
        <span>{presented.description}</span>
        <span className="fh-card__action">{text.openTemplate}<ArrowRight size={14} aria-hidden="true" /></span>
      </button>;
    })}</div>
      : view === 'classroom' ? <div className="fh-grid">
        <button type="button" className="fh-card" onClick={() => setExerciseOpen(true)}>
          <span className="fh-card__scene"><ThreeStructuralImage assetId="portal:single-bay" theme={theme} render="three" eager /></span>
          <strong>{text.blankExercise}</strong>
          <span className="fh-card__action">{text.openTemplate}<ArrowRight size={14} aria-hidden="true" /></span>
        </button>
        <button type="button" className="fh-card fh-card--accent" onClick={() => onOpenDesign('exercise')}>
          <span className="fh-card__scene"><ThreeStructuralImage assetId="portal:two-story" theme={theme} render="three" eager /></span>
          <strong>{text.classroomStart}</strong>
          <span className="fh-card__action">{text.classroomStart}<ArrowRight size={14} aria-hidden="true" /></span>
        </button>
      </div>
        : view === 'library' ? <Suspense fallback={null}><PersonalLibraryView language={language} units={project.settings.units} theme={theme} view={readCanvasViewSettings(project)} /></Suspense>
          : <div className="fh-links fh-links--wide">
            <button type="button" className="fh-links__item" onClick={() => setImportOpen(true)}><span className="fh-links__icon" aria-hidden="true"><FileUp size={18} /></span><span className="fh-links__text"><strong>{text.importPortable}</strong><small>{text.importPortableBody}</small></span><ArrowRight className="fh-links__go" size={16} aria-hidden="true" /></button>
            <button type="button" className="fh-links__item" onClick={() => setDxfOpen(true)}><span className="fh-links__icon" aria-hidden="true"><Upload size={18} /></span><span className="fh-links__text"><strong>{text.importDxf}</strong><small>{text.importDxfBody}</small></span><ArrowRight className="fh-links__go" size={16} aria-hidden="true" /></button>
          </div>;

  return <>
    <main ref={mainRef} className="fh" data-testid="home">
      <header className="fh-bar">
        <button type="button" className="fh-brand" onClick={() => navigate('home')} aria-label={`FStructure · ${text.home}`}>
          <FStructureMark size={26} /><strong>FStructure</strong>
        </button>
        <div className="fh-prefs">
          <div className="fh-segmented" role="group" aria-label={text.language}>
            {(['es', 'en'] as const).map((item) => <button key={item} type="button" aria-pressed={language === item}
              onClick={() => updateProjectView((current) => ({ ...current, settings: { ...current.settings, language: item } }))}>{item.toUpperCase()}</button>)}
          </div>
          <button type="button" className="fh-icon-button" aria-label={text.theme} title={text.theme} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <div className="fh-body">
        {view === 'home' ? home : <section className="fh-page" aria-labelledby="fh-page-title">
          <header className="fh-page__head">
            <button type="button" className="fh-back" onClick={() => navigate('home')}><ArrowLeft size={18} aria-hidden="true" />{text.home}</button>
            <h1 id="fh-page-title" className="fh-page__title">{text[view]}</h1>
            {searchable ? <label className="fh-search">
              <Search size={16} aria-hidden="true" />
              <input type="search" value={query} aria-label={text.search} placeholder={text.search} onChange={(event) => setQuery(event.currentTarget.value)} />
              {query ? <button type="button" aria-label={text.clear} onClick={() => setQuery('')}><X size={15} aria-hidden="true" /></button> : null}
            </label> : null}
          </header>
          {page}
        </section>}
      </div>

      <footer className="fh-foot">
        <span>{text.note}</span>
        <span className="fh-foot__credit">{text.by} · <a href="https://github.com/klkmoraa/fstructure" target="_blank" rel="noopener noreferrer">GitHub<ArrowUpRight size={12} aria-hidden="true" /></a></span>
      </footer>
    </main>

    <Suspense fallback={null}>
    {importOpen ? <PortableImportCenter open currentProjectName={project.name} onClose={() => setImportOpen(false)} onSaveCurrent={() => exportProjectJson(project)} onImported={(outcome) => { setImportOpen(false); openProject(outcome.project, outcome.restoredAnalysis); }} /> : null}
    {dxfOpen ? <DxfImportDialog open onOpenChange={setDxfOpen} onImported={() => { setDxfOpen(false); onOpenWorkspace(); }} /> : null}
    {exerciseOpen ? <NewExerciseDialog open onClose={() => setExerciseOpen(false)} onCreate={(next) => { setExerciseOpen(false); openProject(next); }} /> : null}
    </Suspense>
  </>;
};

