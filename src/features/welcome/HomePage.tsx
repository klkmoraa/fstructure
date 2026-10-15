import { Suspense, lazy, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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
import { createBlankProject, createSingleWork, exampleProjects } from '../../data/defaultProject';
import type { MesaMode } from '../../shared/navigation/projectUrl';
import { SINGLE_WORK_LABEL, singleWorkMode, singleWorkTool } from '../../shared/project/workScope';
import type { SingleWorkTool } from '../../types';
import { FStructureMark } from '../../design-system/brand';
import { useI18n } from '../../i18n/useI18n';
import { useProject, useWorkspaceUI } from '../../store/ProjectContext';
import { exportProjectJson } from '../../utils/export';
import { ProjectHub } from '../project-hub/ProjectHub';
import { ProjectSaveButton } from '../project-hub/ProjectSaveButton';
import { ThreeStructuralImage, type ThreeStructuralAssetId } from '../structural-assets';
import { readCanvasViewSettings } from '../view/canvasViewSettings';
import { SceneImage } from '../../design-system/components/SceneImage';
import { presentExample } from './examplePresentation';
import './home.css';

// Lo que sólo se abre a pedido (biblioteca, importar, ejercicio nuevo) llega al abrirlo.
const DxfImportDialog = lazy(() => import('../../import/dxf/DxfImportDialog').then((module) => ({ default: module.DxfImportDialog })));
const PortableImportCenter = lazy(() => import('../import-export/PortableImportCenter').then((module) => ({ default: module.PortableImportCenter })));
const PersonalLibraryView = lazy(() => import('../library/PersonalLibraryView').then((module) => ({ default: module.PersonalLibraryView })));
const NewExerciseDialog = lazy(() => import('./NewExerciseDialog').then((module) => ({ default: module.NewExerciseDialog })));

type HomeView = 'home' | 'projects' | 'templates' | 'library' | 'classroom' | 'import';

interface HomePageProps {
  /** Abre la mesa (por omisión en el modo 2D). */
  onOpenWorkspace: (mode?: MesaMode) => void;
  /** Abre la mesa del proyecto en el modo 3D. */
  onOpenSpace3D: () => void;
  /** Abre el modo Diseño del proyecto con su selector de inicios. */
  onOpenDesign: (category?: 'project' | 'piece') => void;
}

/* Trazos de cada pantalla: los modelos y las piezas del dock de Diseño. */
const PIECE_ICON: Record<SingleWorkTool, ReactNode> = {
  model2d: <><path d="M3 20.5h18" /><path d="M5 20.5V7.5h14v13M5 7.5l7 5.5 7-5.5" /><path d="M4 22l1-1.5 1 1.5M18 22l1-1.5 1 1.5" /></>,
  space3d: <><path d="M12 2.5l8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5z" /><path d="M3.5 7.25L12 12l8.5-4.75M12 12v9.5" /></>,
  frame: <><path d="M5 21.5V4.5M19 21.5V4.5M3 5h18M5 12.5h14" /><path d="M2.5 21.5h5M16.5 21.5h5" /></>,
  beam: <><rect x="2" y="8" width="20" height="5" rx="1" /><path d="M4 13l-2 4h4zM20 13l-2 4h4z" /></>,
  column: <><rect x="8.5" y="2" width="7" height="17" rx="1" /><path d="M4 21.5h16" /></>,
  footing: <><rect x="9.5" y="3" width="5" height="9" rx="1" /><rect x="3" y="12" width="18" height="6" rx="1" /></>,
  flexure: <><path d="M4 5h16v14H4z" /><path d="M7 16h10" /><circle cx="9" cy="16" r="1" /><circle cx="15" cy="16" r="1" /></>,
  section: <><path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z" /><path d="M8 8h8v8H8z" /></>,
};

const copy = {
  es: {
    title: 'Modela, analiza y diseña estructuras.',
    lead: 'Calcula cada cosa por separado o lleva un proyecto completo, con el 2D, el 3D y el diseño enlazados.',
    open: 'Proyecto abierto', openSingle: 'Cálculo individual abierto', continue: 'Continuar', create: 'Nuevo',
    nodes: 'nudos', members: 'barras', loads: 'cargas',
    single: 'Calcular por separado',
    singleLead: 'Cada pantalla sola, con tus datos: se guarda aparte y no se enlaza con nada.',
    pieces: [
      { id: 'model2d', title: 'Modelo 2D', role: 'Vigas, marcos y armaduras' },
      { id: 'space3d', title: 'Modelo 3D', role: 'Marcos espaciales' },
      { id: 'beam', title: 'Viga', role: 'Claros, cargas y armado' },
      { id: 'column', title: 'Columna', role: 'Flexocompresión y estribos' },
      { id: 'footing', title: 'Zapata', role: 'Aislada, corrida, combinada' },
      { id: 'flexure', title: 'Sección a flexión', role: 'As, revisión o dimensiones' },
      { id: 'section', title: 'Estudio de sección', role: 'Seis formas y N–M' },
      { id: 'frame', title: 'Pórtico', role: 'Vigas y columnas juntas' },
    ],
    project: 'Proyecto completo',
    projectLead: 'Todo enlazado: el 3D trae el pórtico del 2D y Diseño toma las acciones del modelo.',
    newProject: 'Nuevo proyecto',
    modes: [
      { id: 'model', title: 'Modelo 2D', role: 'Marcos planos, vigas y armaduras', scene: 'model2d' },
      { id: '3d', title: 'Modelo 3D', role: 'Edificios y marcos espaciales', scene: 'space3d' },
      { id: 'design', title: 'Diseño', role: 'Vigas, columnas y zapatas del modelo', scene: 'design' },
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
    lead: 'Calculate each thing on its own or run a complete project, with 2D, 3D and design linked.',
    open: 'Open project', openSingle: 'Open single calculation', continue: 'Continue', create: 'New',
    nodes: 'nodes', members: 'members', loads: 'loads',
    single: 'Calculate on its own',
    singleLead: 'Each screen alone, with your data: saved apart and linked to nothing.',
    pieces: [
      { id: 'model2d', title: '2D model', role: 'Beams, frames and trusses' },
      { id: 'space3d', title: '3D model', role: 'Space frames' },
      { id: 'beam', title: 'Beam', role: 'Spans, loads and bars' },
      { id: 'column', title: 'Column', role: 'Axial–flexure and ties' },
      { id: 'footing', title: 'Footing', role: 'Isolated, strip, combined' },
      { id: 'flexure', title: 'Flexural section', role: 'As, check or size' },
      { id: 'section', title: 'Section study', role: 'Six shapes and N–M' },
      { id: 'frame', title: 'Frame', role: 'Beams and columns together' },
    ],
    project: 'Complete project',
    projectLead: 'Everything linked: 3D brings the 2D frame and Design takes the model’s actions.',
    newProject: 'New project',
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
 * Arriba lo que se hace a diario —continuar lo abierto—. Luego las dos formas
 * de trabajar con las mismas pantallas: **por separado** (Modelo 2D, Modelo 3D
 * o una pieza de Diseño, cada una en su propio archivo sin enlaces) y el
 * **proyecto completo** (2D, 3D y Diseño enlazados). Debajo, los recientes y
 * los accesos (plantillas, aula, importar, biblioteca), que se abren como
 * páginas de la misma Home con una flecha para volver.
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

  /* Un archivo individual abre su única pantalla; un proyecto, el 2D. */
  const modeOf = (next: Pick<typeof project, 'settings'>) => { const tool = singleWorkTool(next); return tool ? singleWorkMode(tool) : 'model'; };
  const openProject = (next: typeof project, restoredAnalysis?: Parameters<typeof replaceProject>[1], revision?: number) => {
    replaceProject({ ...next, settings: { ...next.settings, language } }, restoredAnalysis, revision);
    onOpenWorkspace(modeOf(next));
  };
  const openSingle = (tool: SingleWorkTool) => openProject(createSingleWork(tool, SINGLE_WORK_LABEL[tool][language]));
  /* Los modos del proyecto enlazan el archivo abierto; si es individual, empiezan uno nuevo. */
  const openProjectMode = (id: 'model' | '3d' | 'design') => {
    if (singleWorkTool(project)) replaceProject({ ...createBlankProject(), settings: { ...createBlankProject().settings, language } });
    if (id === 'model') onOpenWorkspace(); else if (id === '3d') onOpenSpace3D(); else onOpenDesign('project');
  };
  const currentSingle = singleWorkTool(project);
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
        <div className="fh-current" aria-label={currentSingle ? text.openSingle : text.open}>
          <div className="fh-current__info">
            <span className="fh-current__label">{currentSingle ? `${text.openSingle} · ${SINGLE_WORK_LABEL[currentSingle][language]}` : text.open}</span>
            <strong className="fh-current__name" title={project.name}>{project.name}</strong>
            <span className="fh-current__counts"><b>{project.nodes.length}</b> {text.nodes} · <b>{project.members.length}</b> {text.members} · <b>{loadCount}</b> {text.loads}</span>
          </div>
          <div className="fh-current__actions">
            <button type="button" className="fh-button fh-button--primary" onClick={() => onOpenWorkspace(modeOf(project))}><Play size={16} fill="currentColor" aria-hidden="true" />{text.continue}</button>
            <button type="button" className="fh-button" onClick={() => openProject(createBlankProject())}><FilePlus2 size={16} aria-hidden="true" />{text.create}</button>
            <ProjectSaveButton />
          </div>
        </div>
      </div>
      <figure className="fh-hero__stage" aria-hidden="true">
        <SceneImage src={scene('portal', mode)} alt="" decoding="async" />
      </figure>
    </section>

    <section className="fh-section" aria-labelledby="fh-single">
      <header className="fh-section__intro">
        <h2 id="fh-single" className="fh-section__title">{text.single}</h2>
        <p className="fh-section__lead">{text.singleLead}</p>
      </header>
      <div className="fh-pieces">
        {text.pieces.map((item, index) => <button key={item.id} type="button" className="fh-piece" style={{ '--i': index } as CSSProperties} onClick={() => openSingle(item.id)}>
          <span className="fh-piece__icon" aria-hidden="true"><svg viewBox="0 0 24 24">{PIECE_ICON[item.id]}</svg></span>
          <span className="fh-piece__copy"><strong>{item.title}</strong><span>{item.role}</span></span>
        </button>)}
      </div>
    </section>

    <section className="fh-section" aria-labelledby="fh-project">
      <header className="fh-section__intro fh-section__intro--action">
        <div>
          <h2 id="fh-project" className="fh-section__title">{text.project}</h2>
          <p className="fh-section__lead">{text.projectLead}</p>
        </div>
        <button type="button" className="fh-button" onClick={() => openProject(createBlankProject())}><FilePlus2 size={16} aria-hidden="true" />{text.newProject}</button>
      </header>
      <div className="fh-modes">
        {text.modes.map((item, index) => <button key={item.id} type="button" className="fh-mode" style={{ '--i': index } as CSSProperties} onClick={() => openProjectMode(item.id)}>
          <span className="fh-mode__scene"><SceneImage src={scene(item.scene, mode)} alt="" decoding="async" loading="lazy" /></span>
          <span className="fh-mode__copy"><small>{index + 1}</small><strong>{item.title}</strong><span>{item.role}</span></span>
          <ArrowRight className="fh-mode__go" size={18} aria-hidden="true" />
        </button>)}
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
  const page = view === 'projects' ? <ProjectHub filter={query} onClearFilter={() => setQuery('')} onOpen={(record) => openProject(record.project, undefined, record.revision)} />
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
        <button type="button" className="fh-card fh-card--accent" onClick={() => openSingle('flexure')}>
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

