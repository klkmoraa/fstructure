import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Box, Folder, GraduationCap, Home, Image as ImageIcon, LayoutTemplate, LibraryBig, Menu, Search, Settings, Upload, X } from 'lucide-react';
import { createBlankProject, exampleProjects } from '../../data/defaultProject';
import { useProject, useWorkspaceUI } from '../../store/ProjectContext';
import { exportProjectJson } from '../../utils/export';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/catalogs';
import { NewExerciseDialog } from './NewExerciseDialog';
import { presentExample } from './examplePresentation';
import { ThreeStructuralImage } from '../structural-assets';
import type { ThreeStructuralAssetId } from '../structural-assets/threeStructuralRender';
import { FusionLanding } from './FusionLanding';
import { PlanoHome } from './PlanoHome';
import { PlanoMark } from '../../design-system/brand';
import { PLANO } from '../../design-system/moduleIdentity';
import { IllustrationStudio } from '../structural-assets/studio/IllustrationStudio';
import type { ClassroomExerciseTemplateId } from '../../education/exerciseTemplates';
import { PersonalLibraryView } from '../library/PersonalLibraryView';
import { readCanvasViewSettings } from '../view/canvasViewSettings';
import { useModalFocus } from '../../design-system/components/modalFocus';
import { clearLocalMetrics, exportLocalMetrics, getLocalMetrics, setLocalMetricsOptIn, type LocalMetricsStore } from '../../analytics/localMetrics';
import './totalHome.css';

const PortableImportCenter = lazy(() => import('../import-export/PortableImportCenter').then((module) => ({ default: module.PortableImportCenter })));
const Phase2ProjectHub = lazy(() => import('./Phase2ProjectHub').then((module) => ({ default: module.Phase2ProjectHub })));
const Phase2DxfAction = lazy(() => import('./Phase2DxfAction').then((module) => ({ default: module.Phase2DxfAction })));

interface WelcomeScreenProps {
  onOpenWorkspace: () => void;
  onOpenSpace3D?: () => void;
  onPreloadWorkspace?: () => void;
  onViewChange?: (view: HomeView) => void;
  initialView?: HomeView;
}

export type HomeView = 'home' | 'solver2d' | 'projects' | 'templates' | 'library' | 'classroom' | 'import' | 'space3d';
type NavigationDestination = HomeView | 'studio';

const copy = {
  es: {
    navigation: 'Navegación de Plano', home: 'Plataforma', solver2d: 'Plano', projects: 'Proyectos', templates: 'Plantillas', library: 'Biblioteca', classroom: 'Aula', import: 'Importar', space3d: 'Solver 3D',
    backPlatform: 'Volver a la plataforma',
    settings: 'Ajustes', settingsTitle: 'Ajustes', settingsBody: 'Personaliza cómo se presenta FusionStructure en este dispositivo.', language: 'Idioma', closeSettings: 'Cerrar ajustes', studio: 'Estudio de ilustraciones', menu: 'Abrir navegación', closeMenu: 'Cerrar navegación', current: 'Proyecto abierto', continue: 'Continuar proyecto', create: 'Nuevo proyecto', localMetrics: 'Diagnóstico local', localMetricsBody: 'Opcional. Guarda sólo eventos agregados en este dispositivo; nunca envía geometría, cargas, resultados ni datos personales.', localMetricsOptIn: 'Guardar mediciones locales para mejorar el flujo', localMetricsCount: '{count} observaciones locales', exportDiagnostics: 'Exportar diagnóstico', clearDiagnostics: 'Borrar observaciones', search: 'Buscar', searchPlaceholder: 'Buscar proyectos o accesos…', clearSearch: 'Borrar búsqueda', noQuickMatches: 'No hay accesos rápidos que coincidan.',
    recent: 'Proyectos recientes', viewAll: 'Ver todos', templatesTitle: 'Elige una estructura de partida', templatesBody: 'Abre un modelo preparado y adáptalo a tu caso.',
    projectsTitle: 'Tus proyectos', projectsBody: 'Abre, renombra o duplica el trabajo guardado en este dispositivo.',
    classroomTitle: 'Aprende resolviendo una estructura', classroomBody: 'Elige un caso, ajusta sus datos y avanza con una guía que no te quita el control del modelo.', classroomAction: 'Crear desde cero', classroomCases: 'O empieza con un caso preparado',
    importTitle: 'Trae un modelo', importBody: 'Revisa el archivo antes de modificar el proyecto abierto.',
    spaceTitle: 'Construye en tres dimensiones', spaceBody: 'Trabaja con pórticos espaciales, niveles y cargas en un entorno separado de tu modelo 2D.', spaceAction: 'Abrir Space 3D', spaceExperimental: 'Experimental', spaceNotice: 'Este acceso abre un modelo espacial independiente. Antes de entrar verás qué se mantiene separado y cómo volver al editor 2D.', spaceContinue2D: 'Continuar en editor 2D',
    spacePreview: 'Pórtico espacial de varios vanos', spaceCoordinates: 'Ejes X, Y y Z', spaceModel: 'Geometría espacial', spaceLoads: 'Cargas y apoyos 3D',
    secondary: 'Accesos rápidos', local: 'Guardado local en este dispositivo',
  },
  en: {
    navigation: 'Plano navigation', home: 'Platform', solver2d: 'Plano', projects: 'Projects', templates: 'Templates', library: 'Library', classroom: 'Classroom', import: 'Import', space3d: '3D Solver',
    backPlatform: 'Back to platform',
    settings: 'Settings', settingsTitle: 'Settings', settingsBody: 'Personalize how FusionStructure is presented on this device.', language: 'Language', closeSettings: 'Close settings', studio: 'Illustration Studio', menu: 'Open navigation', closeMenu: 'Close navigation', current: 'Open project', continue: 'Continue project', create: 'New project', localMetrics: 'Local diagnostics', localMetricsBody: 'Optional. Stores aggregate events on this device only; it never sends geometry, loads, results, or personal data.', localMetricsOptIn: 'Store local measurements to improve the flow', localMetricsCount: '{count} local observations', exportDiagnostics: 'Export diagnostics', clearDiagnostics: 'Erase observations', search: 'Search', searchPlaceholder: 'Search projects or shortcuts…', clearSearch: 'Clear search', noQuickMatches: 'No quick access items match.',
    recent: 'Recent projects', viewAll: 'View all', templatesTitle: 'Choose a starting structure', templatesBody: 'Open a prepared model and adapt it to your case.',
    projectsTitle: 'Your projects', projectsBody: 'Open, rename, or duplicate work saved on this device.',
    classroomTitle: 'Learn by solving a structure', classroomBody: 'Choose a case, adjust its data, and move forward with guidance that keeps you in control of the model.', classroomAction: 'Start from scratch', classroomCases: 'Or begin with a prepared case',
    importTitle: 'Bring in a model', importBody: 'Review the file before changing the open project.',
    spaceTitle: 'Build in three dimensions', spaceBody: 'Work with spatial frames, levels, and loads in an environment separate from your 2D model.', spaceAction: 'Open Space 3D', spaceExperimental: 'Experimental', spaceNotice: 'This entry opens an independent spatial model. Before entering, you will see what remains separate and how to return to the 2D editor.', spaceContinue2D: 'Continue in 2D editor',
    spacePreview: 'Multi-bay spatial frame', spaceCoordinates: 'X, Y, and Z axes', spaceModel: 'Spatial geometry', spaceLoads: '3D loads and supports',
    secondary: 'Quick access', local: 'Saved locally on this device',
  },
} as const;

const NAV_ITEMS: ReadonlyArray<{ id: NavigationDestination; icon: typeof Home }> = [
  { id: 'solver2d', icon: Home }, { id: 'projects', icon: Folder }, { id: 'templates', icon: LayoutTemplate },
  { id: 'library', icon: LibraryBig }, { id: 'studio', icon: ImageIcon }, { id: 'classroom', icon: GraduationCap }, { id: 'import', icon: Upload }, { id: 'space3d', icon: Box },
];

const CLASSROOM_FEATURES: ReadonlyArray<{ id: ClassroomExerciseTemplateId; assetId: ThreeStructuralAssetId; name: TranslationKey; description: TranslationKey }> = [
  { id: 'simple-beam', assetId: 'beam:simply-supported', name: 'newExercise.template.simpleBeamName', description: 'newExercise.template.simpleBeamDescription' },
  { id: 'triangular-truss', assetId: 'truss:pratt', name: 'newExercise.template.triangularTrussName', description: 'newExercise.template.triangularTrussDescription' },
  { id: 'portal-frame', assetId: 'portal:two-bay', name: 'newExercise.template.portalFrameName', description: 'newExercise.template.portalFrameDescription' },
];

const templateAssetId = (name: string): ThreeStructuralAssetId => {
  if (/armadura|truss/i.test(name)) return 'truss:warren';
  if (/viga|beam/i.test(name)) return 'beam:simply-supported';
  return 'portal:single-bay';
};

interface WelcomePreferencesProps {
  language: 'es' | 'en';
  onLanguageChange: (language: 'es' | 'en') => void;
  onClose: () => void;
}

const WelcomePreferences = ({ language, onLanguageChange, onClose }: WelcomePreferencesProps) => {
  const text = copy[language];
  const [metrics, setMetrics] = useState<LocalMetricsStore>(() => getLocalMetrics(window.localStorage));
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalFocus({ open: true, containerRef: dialogRef, onEscape: onClose, initialFocus: () => closeRef.current, restoreFocus: false });

  const downloadDiagnostics = () => {
    const blob = new Blob([exportLocalMetrics(window.localStorage)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'fusionstructure-local-diagnostics.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return <section ref={dialogRef} className="sc-home-settings-panel" role="dialog" aria-modal="true" aria-label={text.settingsTitle} tabIndex={-1}>
    <button ref={closeRef} type="button" aria-label={text.closeSettings} onClick={onClose}><X size={19} /></button>
    <h2>{text.settingsTitle}</h2>
    <p>{text.settingsBody}</p>
    <label className="sc-home-settings-field"><span>{text.language}</span><select aria-label={text.language} value={language} onChange={(event) => onLanguageChange(event.target.value as 'es' | 'en')}><option value="es">ES</option><option value="en">EN</option></select></label>
    <section className="sc-home-settings-metrics" aria-labelledby="local-metrics-title">
      <h3 id="local-metrics-title">{text.localMetrics}</h3>
      <p>{text.localMetricsBody}</p>
      <label><input type="checkbox" checked={metrics.optIn} onChange={(event) => setMetrics(setLocalMetricsOptIn(window.localStorage, event.currentTarget.checked))} />{text.localMetricsOptIn}</label>
      <small>{text.localMetricsCount.replace('{count}', String(metrics.events.length))}</small>
      <div><button type="button" onClick={downloadDiagnostics}>{text.exportDiagnostics}</button><button type="button" onClick={() => setMetrics(clearLocalMetrics(window.localStorage))} disabled={metrics.events.length === 0}>{text.clearDiagnostics}</button></div>
    </section>
  </section>;
};

export const WelcomeScreen = ({ onOpenWorkspace, onOpenSpace3D, onPreloadWorkspace, onViewChange, initialView = 'home' }: WelcomeScreenProps) => {
  const { project, replaceProject, updateProjectView } = useProject();
  const { language, t } = useI18n();
  const { theme } = useWorkspaceUI();
  const text = copy[language];
  const [view, setView] = useState<HomeView>(initialView);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [exerciseTemplateId, setExerciseTemplateId] = useState<ClassroomExerciseTemplateId>('blank');
  const [importCenterOpen, setImportCenterOpen] = useState(false);
  const [dxfImportOpen, setDxfImportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const homeRef = useRef<HTMLElement>(null);
  const preferencesLauncherRef = useRef<HTMLButtonElement | null>(null);
  const studioLauncherRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const closeMobileNavigation = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setMobileNavOpen(false);
      mobileMenuButtonRef.current?.focus();
    };
    window.addEventListener('keydown', closeMobileNavigation);
    return () => window.removeEventListener('keydown', closeMobileNavigation);
  }, [mobileNavOpen]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches('input, textarea, select, [contenteditable="true"]');
      const shortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if ((!shortcut && event.key !== '/') || (typing && !shortcut) || preferencesOpen || studioOpen || exerciseDialogOpen || importCenterOpen || dxfImportOpen) return;
      event.preventDefault();
      if (view !== 'solver2d' && view !== 'projects') setView('solver2d');
      window.requestAnimationFrame(() => searchInputRef.current?.focus());
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, [dxfImportOpen, exerciseDialogOpen, importCenterOpen, preferencesOpen, studioOpen, view]);

  useEffect(() => {
    if ((!preferencesOpen && !studioOpen) || !homeRef.current) return undefined;
    const home = homeRef.current;
    const previousInert = home.inert;
    const previousAriaHidden = home.getAttribute('aria-hidden');
    home.inert = true;
    home.setAttribute('aria-hidden', 'true');
    return () => {
      home.inert = previousInert;
      if (previousAriaHidden === null) home.removeAttribute('aria-hidden');
      else home.setAttribute('aria-hidden', previousAriaHidden);
    };
  }, [preferencesOpen, studioOpen]);

  const openBlankProject = () => {
    const next = createBlankProject();
    replaceProject({ ...next, settings: { ...next.settings, language } });
    onOpenWorkspace();
  };
  const openExample = (build: () => typeof project) => {
    const next = build();
    replaceProject({ ...next, settings: { ...next.settings, language } });
    onOpenWorkspace();
  };
  const navigate = (next: HomeView) => {
    setView(next);
    onViewChange?.(next);
    setSearchQuery('');
    setMobileNavOpen(false);
  };
  const updateLanguage = (nextLanguage: 'es' | 'en') => updateProjectView((draft) => ({ ...draft, settings: { ...draft.settings, language: nextLanguage } }));
  const openPreferences = (launcher: HTMLButtonElement) => {
    preferencesLauncherRef.current = launcher.closest('.sc-home-nav--menu') ? mobileMenuButtonRef.current : launcher;
    setMobileNavOpen(false);
    setPreferencesOpen(true);
  };
  const closePreferences = () => {
    setPreferencesOpen(false);
    window.setTimeout(() => preferencesLauncherRef.current?.focus(), 0);
  };
  const openStudio = (launcher: HTMLButtonElement) => {
    studioLauncherRef.current = launcher.closest('.sc-home-nav--mobile') ? mobileMenuButtonRef.current : launcher;
    setMobileNavOpen(false);
    setStudioOpen(true);
  };
  const closeStudio = () => {
    setStudioOpen(false);
    window.setTimeout(() => studioLauncherRef.current?.focus(), 0);
  };
  const openExercise = (templateId: ClassroomExerciseTemplateId = 'blank') => {
    setExerciseTemplateId(templateId);
    setExerciseDialogOpen(true);
  };
  const renderNavigation = (menu = false) => <nav className={menu ? 'sc-home-nav sc-home-nav--menu' : 'sc-home-nav sc-home-nav--console'} aria-label={text.navigation}>
    {NAV_ITEMS.map(({ id, icon: Icon }) => <button key={id} type="button" aria-label={text[id]} title={text[id]} className={id !== 'studio' && view === id ? 'is-active' : undefined} aria-current={id !== 'studio' && view === id ? 'page' : undefined} onClick={(event) => id === 'studio' ? openStudio(event.currentTarget) : navigate(id)}><Icon size={19} /><span>{text[id]}</span></button>)}
    <button type="button" aria-label={text.settings} title={text.settings} onClick={(event) => openPreferences(event.currentTarget)}><Settings size={19} /><span>{text.settings}</span></button>
  </nav>;

  const platformLanding = <FusionLanding
    language={language}
    onOpenSolver2D={() => navigate('solver2d')}
    onOpenSolver3D={() => navigate('space3d')}
    onOpenClassroom={() => navigate('classroom')}
    onOpenImport={() => navigate('import')}
  />;

  const solver2dDashboard = <PlanoHome
    language={language}
    project={project}
    onContinue={onOpenWorkspace}
    onCreateBlank={openBlankProject}
    onOpenTemplates={() => navigate('templates')}
    onOpenClassroom={() => navigate('classroom')}
    onOpenImport={() => setImportCenterOpen(true)}
    onOpenProjects={() => navigate('projects')}
    onPreloadWorkspace={onPreloadWorkspace}
    recents={<Suspense fallback={<p role="status">{t('hub.loading')}</p>}><Phase2ProjectHub onOpenWorkspace={onOpenWorkspace} variant="recent" limit={3} filter={searchQuery} /></Suspense>}
  />;

  /** Encabezado común de las vistas secundarias: qué es la vista y qué hace.
      Usa el `header > h2 + span` que la hoja ya trata como título de pantalla,
      en vez de introducir una tercera escala tipográfica. */
  const viewHeading = (title: string, body: string) => <header><h2>{title}</h2><span>{body}</span></header>;

  const templates = <section className="sc-home-view" aria-label={text.templates}>
    {viewHeading(text.templatesTitle, text.templatesBody)}
    <div className="sc-home-template-grid">{exampleProjects.map((example) => {
      const presented = presentExample(example.name, example.description, t);
      return <button key={example.name} type="button" onClick={() => openExample(example.build)}><ThreeStructuralImage assetId={templateAssetId(example.name)} theme={theme} /><strong>{presented.name}</strong><span>{presented.description}</span></button>;
    })}</div>
  </section>;

  const classroomLanding = <section className="sc-home-classroom" aria-label={text.classroom}>
    <div className="sc-home-classroom-hero">
      <div>
        <h2>{text.classroomTitle}</h2>
        <span>{text.classroomBody}</span>
        <button type="button" className="sc-home-continue" onClick={() => openExercise()}>{text.classroomAction}<ArrowRight size={16} /></button>
      </div>
      <ThreeStructuralImage assetId="portal:two-story" theme={theme} eager />
    </div>
    <div className="sc-home-classroom-cases">
      <h3>{text.classroomCases}</h3>
      <div>
        {CLASSROOM_FEATURES.map((item) => <button key={item.id} type="button" onClick={() => openExercise(item.id)}>
          <ThreeStructuralImage assetId={item.assetId} theme={theme} />
          <strong>{t(item.name)}</strong>
          <span>{t(item.description)}</span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>)}
      </div>
    </div>
  </section>;

  const solver2dContent = view === 'solver2d' ? solver2dDashboard
    : view === 'projects' ? <section className="sc-home-view" aria-label={text.projects}>{viewHeading(text.projectsTitle, text.projectsBody)}<Suspense fallback={<p role="status">{t('hub.loading')}</p>}><Phase2ProjectHub onOpenWorkspace={onOpenWorkspace} filter={searchQuery} /></Suspense></section>
      : view === 'templates' ? templates
        : view === 'library' ? <PersonalLibraryView language={language} units={project.settings.units} theme={theme} view={readCanvasViewSettings(project)} />
          : view === 'classroom' ? classroomLanding
            : view === 'import' ? <section className="sc-home-view" aria-label={text.import}>{viewHeading(text.importTitle, text.importBody)}<div className="sc-home-import-grid"><button type="button" className="welcome-import-card" onClick={() => setImportCenterOpen(true)}><Upload size={20} /><strong>{t('welcome.import')}</strong></button><Suspense fallback={null}><Phase2DxfAction open={dxfImportOpen} onOpenChange={setDxfImportOpen} onOpenWorkspace={onOpenWorkspace} /></Suspense></div></section>
              : null;

  const space3dWelcome = <section className="sc-home-space" aria-label={text.space3d}>
    <div className="sc-home-space__copy">
      <button type="button" className="sc-tool-welcome__back" onClick={() => navigate('home')}><ArrowLeft size={15} />{text.backPlatform}</button>
      <p>FS-A02 · {text.spaceExperimental}</p>
      <h2>{text.spaceTitle}</h2>
      <span>{text.spaceBody}</span>
      <div className="sc-home-space__orientation"><strong>{text.spaceExperimental}</strong><span>{text.spaceNotice}</span></div>
      <div className="sc-home-space__actions"><button type="button" className="sc-home-continue" onClick={onOpenSpace3D}>{text.spaceAction}<ArrowRight size={16} /></button><button type="button" className="sc-home-space__return" onClick={() => navigate('solver2d')}>{text.spaceContinue2D}</button></div>
      <div className="sc-home-space__capabilities"><span><strong>XYZ</strong>{text.spaceCoordinates}</span><span><strong>6 GDL</strong>{text.spaceModel}</span><span><strong>N / M</strong>{text.spaceLoads}</span></div>
    </div>
    <div className="sc-home-space__asset">
      <ThreeStructuralImage assetId="space-frame:multi-bay" theme={theme} alt={text.spacePreview} eager />
    </div>
  </section>;

  const screen = view === 'home'
    ? <main ref={homeRef} className="sc-home fs-platform-landing" data-testid="platform-landing">{platformLanding}</main>
    : view === 'space3d'
      ? <main ref={homeRef} className="sc-home sc-tool-welcome sc-tool-welcome--3d" data-testid="solver3d-welcome">{space3dWelcome}</main>
      : <main ref={homeRef} className="sc-home" data-testid="solver2d-welcome">
        <header className="sc-home-console"><button type="button" className="sc-home-wordmark" onClick={() => navigate('home')} aria-label={text.backPlatform}><PlanoMark size={22} /><strong>{PLANO.name}</strong><span>{PLANO.product}</span></button>{renderNavigation()}<button ref={mobileMenuButtonRef} className="sc-home-console__menu" type="button" aria-label={mobileNavOpen ? text.closeMenu : text.menu} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}><Menu size={20} /></button></header>
        {mobileNavOpen ? renderNavigation(true) : null}
        <div className="sc-home-main"><header className="sc-home-topline"><span>{text[view]}</span><div className="sc-home-search" role="search"><Search size={16} aria-hidden="true" /><input ref={searchInputRef} type="search" value={searchQuery} aria-label={text.search} placeholder={text.searchPlaceholder} onChange={(event) => { setSearchQuery(event.currentTarget.value); if (event.currentTarget.value && view !== 'solver2d' && view !== 'projects') setView('solver2d'); }} />{searchQuery ? <button type="button" aria-label={text.clearSearch} onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}><X size={15} /></button> : <kbd aria-hidden="true">/</kbd>}</div><div className="sc-home-topline-actions"><label><span className="sr-only">{t('language.label')}</span><select value={language} onChange={(event) => updateLanguage(event.target.value as 'es' | 'en')}><option value="es">ES</option><option value="en">EN</option></select></label></div></header><div className="sc-home-content">{solver2dContent}</div></div>
      </main>;

  return <>{screen}
    {importCenterOpen ? <Suspense fallback={null}><PortableImportCenter open currentProjectName={project.name} onClose={() => setImportCenterOpen(false)} onSaveCurrent={() => exportProjectJson(project)} onImported={(outcome) => { replaceProject({ ...outcome.project, settings: { ...outcome.project.settings, language } }, outcome.restoredAnalysis); setImportCenterOpen(false); onOpenWorkspace(); }} /></Suspense> : null}
    <NewExerciseDialog open={exerciseDialogOpen} initialTemplateId={exerciseTemplateId} onClose={() => setExerciseDialogOpen(false)} onCreate={(next) => { replaceProject({ ...next, settings: { ...next.settings, language } }); setExerciseDialogOpen(false); onOpenWorkspace(); }} />
    {preferencesOpen ? <WelcomePreferences language={language} onLanguageChange={updateLanguage} onClose={closePreferences} /> : null}{studioOpen ? <IllustrationStudio language={language} initialTheme={theme} onClose={closeStudio} /> : null}</>;
};
