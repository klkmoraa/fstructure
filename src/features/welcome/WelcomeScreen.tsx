import { useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Folder,
  GraduationCap,
  Home,
  LayoutTemplate,
  Menu,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { createBlankProject, exampleProjects } from '../../data/defaultProject';
import { FStructureMark } from '../../design-system/brand';
import { SOLVER_2D } from '../../design-system/moduleIdentity';
import { classroomExerciseTemplates, type ClassroomExerciseTemplateId } from '../../education/exerciseTemplates';
import { useI18n } from '../../i18n/useI18n';
import { useProject, useWorkspaceUI } from '../../store/ProjectContext';
import { exportProjectJson } from '../../utils/export';
import { DxfImportDialog } from '../../import/dxf/DxfImportDialog';
import { PortableImportCenter } from '../import-export/PortableImportCenter';
import { PersonalLibraryView } from '../library/PersonalLibraryView';
import { ProjectHub } from '../project-hub/ProjectHub';
import { ThreeStructuralImage, type ThreeStructuralAssetId } from '../structural-assets';
import { readCanvasViewSettings } from '../view/canvasViewSettings';
import { NewExerciseDialog } from './NewExerciseDialog';
import { presentExample } from './examplePresentation';
import { Solver2DHome } from './Solver2DHome';
import './totalHome.css';

type WelcomeView = 'home' | 'projects' | 'templates' | 'library' | 'classroom' | 'import';

interface WelcomeScreenProps {
  onOpenWorkspace: () => void;
}

const copy = {
  es: {
    navigation: 'Navegación de FStructure', home: 'Inicio', projects: 'Proyectos', templates: 'Plantillas', library: 'Biblioteca', classroom: 'Aula', import: 'Importar',
    backHome: 'Volver a la bienvenida', menu: 'Abrir navegación', closeMenu: 'Cerrar navegación', search: 'Buscar', searchPlaceholder: 'Buscar proyectos o accesos…', clearSearch: 'Borrar búsqueda', language: 'Idioma',
    projectsTitle: 'Tus proyectos', projectsBody: 'Abre, renombra, duplica o recupera el trabajo guardado en este dispositivo.',
    templatesTitle: 'Elige una estructura de partida', templatesBody: 'Abre un modelo preparado y adáptalo a tu caso.', openTemplate: 'Abrir plantilla',
    classroomTitle: 'Aprende resolviendo una estructura', classroomBody: 'Elige un caso y entra al mismo editor con una guía activa.', classroomAction: 'Crear desde cero', classroomCases: 'Casos preparados',
    libraryTitle: 'Biblioteca personal', libraryBody: 'Secciones, miembros y vistas que guardaste para reutilizar.',
    importTitle: 'Trae un modelo', importBody: 'Revisa el archivo antes de modificar el proyecto abierto.', importPortable: 'Expediente o proyecto JSON', importPortableBody: 'Inspecciona el contenido antes de reemplazar el proyecto.', importDxf: 'Geometría DXF', importDxfBody: 'Vista previa de LINE y LWPOLYLINE 2D antes de agregarlas.',
  },
  en: {
    navigation: 'FStructure navigation', home: 'Home', projects: 'Projects', templates: 'Templates', library: 'Library', classroom: 'Classroom', import: 'Import',
    backHome: 'Back to welcome', menu: 'Open navigation', closeMenu: 'Close navigation', search: 'Search', searchPlaceholder: 'Search projects or shortcuts…', clearSearch: 'Clear search', language: 'Language',
    projectsTitle: 'Your projects', projectsBody: 'Open, rename, duplicate, or recover work saved on this device.',
    templatesTitle: 'Choose a starting structure', templatesBody: 'Open a prepared model and adapt it to your case.', openTemplate: 'Open template',
    classroomTitle: 'Learn by solving a structure', classroomBody: 'Choose a case and enter the same editor with guidance active.', classroomAction: 'Start from scratch', classroomCases: 'Prepared cases',
    libraryTitle: 'Personal library', libraryBody: 'Sections, members, and views saved for reuse.',
    importTitle: 'Bring in a model', importBody: 'Review the file before changing the open project.', importPortable: 'Record or JSON project', importPortableBody: 'Inspect its content before replacing the project.', importDxf: 'DXF geometry', importDxfBody: 'Preview 2D LINE and LWPOLYLINE before adding them.',
  },
} as const;

const exampleAssets: Record<string, ThreeStructuralAssetId> = {
  'Hibbeler · carga tributaria Fig. 2–11': 'beam:simply-supported',
  'Práctica tipo Hibbeler · diagramas': 'beam:simply-supported',
  'Práctica tipo Hibbeler · armadura': 'truss:warren',
  'Pórtico de ejemplo': 'portal:single-bay',
  'Viga simplemente apoyada': 'beam:simply-supported',
  'Armadura triangular': 'truss:warren',
};

const assetForExample = (name: string): ThreeStructuralAssetId => {
  if (exampleAssets[name]) return exampleAssets[name];
  if (/armadura|truss/i.test(name)) return 'truss:warren';
  if (/viga|beam|tributaria|diagrama/i.test(name)) return 'beam:simply-supported';
  return 'portal:single-bay';
};

const assetForExercise: Record<ClassroomExerciseTemplateId, ThreeStructuralAssetId> = {
  blank: 'portal:single-bay',
  'simple-beam': 'beam:simply-supported',
  cantilever: 'cantilever:wall',
  'portal-frame': 'portal:two-bay',
  'triangular-truss': 'truss:pratt',
};

const readInitialWelcomeView = (): WelcomeView => {
  if (typeof window === 'undefined') return 'home';
  const param = new URLSearchParams(window.location.search).get('view');
  if (param === 'projects' || param === 'templates' || param === 'library' || param === 'classroom' || param === 'import') {
    return param;
  }
  return 'home';
};

export const WelcomeScreen = ({ onOpenWorkspace }: WelcomeScreenProps) => {
  const { project, replaceProject, updateProjectView } = useProject();
  const { language, t } = useI18n();
  const { theme } = useWorkspaceUI();
  const text = copy[language];
  const [view, setView] = useState<WelcomeView>(readInitialWelcomeView);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dxfOpen, setDxfOpen] = useState(false);
  const [exerciseOpen, setExerciseOpen] = useState(false);
  const [exerciseTemplate, setExerciseTemplate] = useState<ClassroomExerciseTemplateId>('blank');
  const homeRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /* Algunos webviews de Safari ignoran el ancho visual para las media queries
     durante el primer layout y renderizan la portada como si tuviera 980px.
     El tamaño físico de `screen` sigue siendo correcto. Marcamos sólo esta
     pantalla antes de pintar para que el contrato táctil del CSS no dependa de
     esa lectura errónea de WebKit. */
  useLayoutEffect(() => {
    const syncCompactViewport = () => {
      const visualWidth = window.visualViewport?.width ?? window.innerWidth;
      const screenWidth = window.screen?.width ?? window.innerWidth;
      const compactMedia = window.matchMedia?.('(max-width: 760px), (max-device-width: 760px)').matches ?? false;
      const compactMobilePlatform = /Android.*Mobile|iPhone|iPod/i.test(navigator.userAgent);
      const compact = compactMedia || compactMobilePlatform || Math.min(window.innerWidth, visualWidth, screenWidth) <= 760;
      homeRef.current?.toggleAttribute('data-compact-viewport', compact);
    };
    syncCompactViewport();
    window.addEventListener('resize', syncCompactViewport);
    window.visualViewport?.addEventListener('resize', syncCompactViewport);
    return () => {
      window.removeEventListener('resize', syncCompactViewport);
      window.visualViewport?.removeEventListener('resize', syncCompactViewport);
    };
  }, []);

  const navigate = (next: WelcomeView) => {
    setView(next);
    setSearchQuery('');
    setMobileNavOpen(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (next === 'home') {
        url.searchParams.delete('view');
      } else {
        url.searchParams.set('view', next);
      }
      window.history.replaceState(null, '', url);
    }
  };

  const openProject = (next: typeof project, restoredAnalysis?: Parameters<typeof replaceProject>[1], revision?: number) => {
    replaceProject({ ...next, settings: { ...next.settings, language } }, restoredAnalysis, revision);
    onOpenWorkspace();
  };

  const openBlank = () => openProject(createBlankProject());
  const openExercise = (template: ClassroomExerciseTemplateId = 'blank') => {
    setExerciseTemplate(template);
    setExerciseOpen(true);
  };

  const navItems: Array<{ id: WelcomeView; label: string; icon: typeof Home }> = [
    { id: 'home', label: text.home, icon: Home },
    { id: 'projects', label: text.projects, icon: Folder },
    { id: 'templates', label: text.templates, icon: LayoutTemplate },
    { id: 'library', label: text.library, icon: BookOpen },
    { id: 'classroom', label: text.classroom, icon: GraduationCap },
    { id: 'import', label: text.import, icon: Upload },
  ];

  const renderNavigation = (menu = false) => <nav className={menu ? 'sc-home-nav sc-home-nav--menu' : 'sc-home-nav sc-home-nav--console'} aria-label={text.navigation}>
    {navItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-label={label} title={label} className={view === id ? 'is-active' : undefined} aria-current={view === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={19} /><span>{label}</span></button>)}
  </nav>;

  const dashboard = <Solver2DHome
    language={language}
    theme={theme}
    project={project}
    onContinue={onOpenWorkspace}
    onCreateBlank={openBlank}
    onOpenTemplates={() => navigate('templates')}
    onOpenClassroom={() => navigate('classroom')}
    onOpenImport={() => setImportOpen(true)}
    onOpenProjects={() => navigate('projects')}
    recents={<ProjectHub variant="recent" limit={3} filter={searchQuery} onOpen={(record) => openProject(record.project, undefined, record.revision)} />}
  />;

  const heading = (title: string, body: string) => <header><h2>{title}</h2><span>{body}</span></header>;
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase(language);
  const visibleExamples = exampleProjects.filter((example) => `${example.name} ${example.description}`.toLocaleLowerCase(language).includes(normalizedSearch));

  const content = view === 'home' ? dashboard
    : view === 'projects' ? <section className="sc-home-view" aria-label={text.projects}>{heading(text.projectsTitle, text.projectsBody)}<ProjectHub filter={searchQuery} onOpen={(record) => openProject(record.project, undefined, record.revision)} /></section>
      : view === 'templates' ? <section className="sc-home-view" aria-label={text.templates}>{heading(text.templatesTitle, text.templatesBody)}<div className="sc-home-template-grid">{visibleExamples.map((example) => {
        const presented = presentExample(example.name, example.description, t);
        return <button key={example.name} type="button" onClick={() => openProject(example.build())}><ThreeStructuralImage assetId={assetForExample(example.name)} theme={theme} render="three" eager /><strong>{presented.name}</strong><span>{presented.description}</span><span className="sc-home-template-card__action">{text.openTemplate}<ArrowRight size={14} aria-hidden="true" /></span></button>;
      })}</div></section>
        : view === 'library' ? <section className="sc-home-view" aria-label={text.library}>{heading(text.libraryTitle, text.libraryBody)}<PersonalLibraryView language={language} units={project.settings.units} theme={theme} view={readCanvasViewSettings(project)} /></section>
          : view === 'classroom' ? <section className="sc-home-classroom" aria-label={text.classroom}>
            <div className="sc-home-classroom-hero"><div><h2>{text.classroomTitle}</h2><span>{text.classroomBody}</span><button type="button" className="sc-home-continue" onClick={() => openExercise()}>{text.classroomAction}<ArrowRight size={16} /></button></div><ThreeStructuralImage assetId="portal:two-story" theme={theme} alt={text.classroomTitle} eager render="three" /></div>
            <div className="sc-home-classroom-cases"><h3>{text.classroomCases}</h3><div>{classroomExerciseTemplates.filter((item) => item.id !== 'blank').map((item) => <button key={item.id} type="button" onClick={() => openExercise(item.id)}><ThreeStructuralImage assetId={assetForExercise[item.id]} theme={theme} alt={item.name} render="three" /><strong>{item.name}</strong><span>{item.description}</span><ArrowRight size={16} /></button>)}</div></div>
          </section>
            : <section className="sc-home-view" aria-label={text.import}>{heading(text.importTitle, text.importBody)}<div className="sc-home-import-grid">
              <button type="button" className="welcome-import-card" onClick={() => setImportOpen(true)}><span className="welcome-import-icon"><Upload size={20} /></span><span className="welcome-import-text"><strong>{text.importPortable}</strong><small>{text.importPortableBody}</small></span><ArrowRight size={16} className="welcome-launcher-arrow" /></button>
              <button type="button" className="welcome-import-card" onClick={() => setDxfOpen(true)}><span className="welcome-import-icon"><Upload size={20} /></span><span className="welcome-import-text"><strong>{text.importDxf}</strong><small>{text.importDxfBody}</small></span><ArrowRight size={16} className="welcome-launcher-arrow" /></button>
            </div></section>;

  return <>
    <main ref={homeRef} className="sc-home" data-testid="solver2d-welcome">
      <header className="sc-home-console">
        <button type="button" className="sc-home-wordmark" onClick={() => navigate('home')} aria-label={text.backHome}><FStructureMark size={24} /><strong>{SOLVER_2D.name}</strong><span>{SOLVER_2D.product}</span></button>
        {renderNavigation()}
        <button type="button" className="sc-home-console__menu" aria-label={mobileNavOpen ? text.closeMenu : text.menu} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}><Menu size={20} /></button>
      </header>
      {mobileNavOpen ? renderNavigation(true) : null}
      <div className="sc-home-main">
        <header className="sc-home-topline">
          <span>{text[view]}</span>
          <div className="sc-home-search" role="search"><Search size={16} aria-hidden="true" /><input ref={searchRef} type="search" value={searchQuery} aria-label={text.search} placeholder={text.searchPlaceholder} onChange={(event) => setSearchQuery(event.currentTarget.value)} />{searchQuery ? <button type="button" aria-label={text.clearSearch} onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}><X size={15} /></button> : <kbd aria-hidden="true">/</kbd>}</div>
          <div className="sc-home-topline-actions"><label><span className="sr-only">{text.language}</span><select value={language} aria-label={text.language} onChange={(event) => updateProjectView((current) => ({ ...current, settings: { ...current.settings, language: event.currentTarget.value as 'es' | 'en' } }))}><option value="es">ES</option><option value="en">EN</option></select></label></div>
        </header>
        <div className="sc-home-content">{content}</div>
      </div>
    </main>

    {importOpen ? <PortableImportCenter open currentProjectName={project.name} onClose={() => setImportOpen(false)} onSaveCurrent={() => exportProjectJson(project)} onImported={(outcome) => { setImportOpen(false); openProject(outcome.project, outcome.restoredAnalysis); }} /> : null}
    <DxfImportDialog open={dxfOpen} onOpenChange={setDxfOpen} onImported={() => { setDxfOpen(false); onOpenWorkspace(); }} />
    <NewExerciseDialog open={exerciseOpen} initialTemplateId={exerciseTemplate} onClose={() => setExerciseOpen(false)} onCreate={(next) => { setExerciseOpen(false); openProject(next); }} />
  </>;
};
