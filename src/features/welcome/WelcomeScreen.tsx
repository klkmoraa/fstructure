import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Box, Download, Folder, GraduationCap, Home, Image as ImageIcon, LayoutTemplate, LibraryBig, Menu, Moon, Search, Settings, Sun, Trash2, Upload, X } from 'lucide-react';
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
import { Solver2DHome } from './Solver2DHome';
import { Solver2DMark } from '../../design-system/brand';
import { SOLVER_2D } from '../../design-system/moduleIdentity';
import { IllustrationStudio } from '../structural-assets/studio/IllustrationStudio';
import type { ClassroomExerciseTemplateId } from '../../education/exerciseTemplates';
import { PersonalLibraryView } from '../library/PersonalLibraryView';
import { readCanvasViewSettings } from '../view/canvasViewSettings';
import { shouldResumeDirectly, useWelcomeEntry } from './welcomeEntry';
import type { ThemeMode } from '../../types';
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
    navigation: 'Navegación de FStructure', home: 'Plataforma', solver2d: 'FStructure', projects: 'Proyectos', templates: 'Plantillas', library: 'Biblioteca', classroom: 'Aula', import: 'Importar', space3d: 'Solver 3D',
    backPlatform: 'Volver a la plataforma',
    settings: 'Ajustes', settingsTitle: 'Ajustes', settingsBody: 'Estas preferencias viven en este dispositivo y no viajan con el proyecto.', language: 'Idioma', languageBody: 'Idioma de la interfaz y de las lecturas del solver.', appearance: 'Apariencia', appearanceBody: 'El tema cambia el papel y la tinta; las seis señales del dominio no cambian de significado.', themeLight: 'Día', themeDark: 'Noche', closeSettings: 'Cerrar ajustes', studio: 'Estudio de ilustraciones', menu: 'Abrir navegación', closeMenu: 'Cerrar navegación', current: 'Proyecto abierto', continue: 'Continuar proyecto', create: 'Nuevo proyecto', localMetrics: 'Diagnóstico local', localMetricsBody: 'Opcional. Guarda sólo eventos agregados en este dispositivo; nunca envía geometría, cargas, resultados ni datos personales.', localMetricsOptIn: 'Guardar mediciones locales para mejorar el flujo', localMetricsCount: '{count} observaciones locales', exportDiagnostics: 'Exportar diagnóstico', clearDiagnostics: 'Borrar observaciones', search: 'Buscar', searchPlaceholder: 'Buscar proyectos o accesos…', clearSearch: 'Borrar búsqueda', noQuickMatches: 'No hay accesos rápidos que coincidan.',
    recent: 'Proyectos recientes', viewAll: 'Ver todos', templatesTitle: 'Elige una estructura de partida', templatesBody: 'Abre un modelo preparado y adáptalo a tu caso.',
    projectsTitle: 'Tus proyectos', projectsBody: 'Abre, renombra o duplica el trabajo guardado en este dispositivo.',
    classroomTitle: 'Aprende resolviendo una estructura', classroomBody: 'Elige un caso, ajusta sus datos y avanza con una guía que no te quita el control del modelo.', classroomAction: 'Crear desde cero', classroomCases: 'O empieza con un caso preparado',
    importTitle: 'Trae un modelo', importBody: 'Revisa el archivo antes de modificar el proyecto abierto.', importPortableBody: 'Expediente portable o JSON de proyecto, con vista previa antes de reemplazar nada.',
    spaceTitle: 'Construye en tres dimensiones', spaceBody: 'Trabaja con pórticos espaciales, niveles y cargas en un entorno separado de tu modelo 2D.', spaceAction: 'Abrir Space 3D', spaceExperimental: 'Experimental', spaceNotice: 'Este acceso abre un modelo espacial independiente. Antes de entrar verás qué se mantiene separado y cómo volver al editor 2D.', spaceContinue2D: 'Continuar en editor 2D',
    spacePreview: 'Pórtico espacial de varios vanos', spaceCoordinates: 'Ejes X, Y y Z', spaceModel: 'Geometría espacial', spaceLoads: 'Cargas y apoyos 3D',
    secondary: 'Accesos rápidos', local: 'Guardado local en este dispositivo',
  },
  en: {
    navigation: 'FStructure navigation', home: 'Platform', solver2d: 'FStructure', projects: 'Projects', templates: 'Templates', library: 'Library', classroom: 'Classroom', import: 'Import', space3d: '3D Solver',
    backPlatform: 'Back to platform',
    settings: 'Settings', settingsTitle: 'Settings', settingsBody: 'These preferences live on this device and do not travel with the project.', language: 'Language', languageBody: 'Interface language and the wording of solver readings.', appearance: 'Appearance', appearanceBody: 'The theme changes paper and ink; the six domain signals never change meaning.', themeLight: 'Day', themeDark: 'Night', closeSettings: 'Close settings', studio: 'Illustration Studio', menu: 'Open navigation', closeMenu: 'Close navigation', current: 'Open project', continue: 'Continue project', create: 'New project', localMetrics: 'Local diagnostics', localMetricsBody: 'Optional. Stores aggregate events on this device only; it never sends geometry, loads, results, or personal data.', localMetricsOptIn: 'Store local measurements to improve the flow', localMetricsCount: '{count} local observations', exportDiagnostics: 'Export diagnostics', clearDiagnostics: 'Erase observations', search: 'Search', searchPlaceholder: 'Search projects or shortcuts…', clearSearch: 'Clear search', noQuickMatches: 'No quick access items match.',
    recent: 'Recent projects', viewAll: 'View all', templatesTitle: 'Choose a starting structure', templatesBody: 'Open a prepared model and adapt it to your case.',
    projectsTitle: 'Your projects', projectsBody: 'Open, rename, or duplicate work saved on this device.',
    classroomTitle: 'Learn by solving a structure', classroomBody: 'Choose a case, adjust its data, and move forward with guidance that keeps you in control of the model.', classroomAction: 'Start from scratch', classroomCases: 'Or begin with a prepared case',
    importTitle: 'Bring in a model', importBody: 'Review the file before changing the open project.', importPortableBody: 'Portable record or project JSON, previewed before anything is replaced.',
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
  theme: ThemeMode;
  onLanguageChange: (language: 'es' | 'en') => void;
  onThemeChange: (theme: ThemeMode) => void;
  onClose: () => void;
}

/**
 * Ajustes de Inicio.
 *
 * Antes era un recuadro flotante anclado a la esquina inferior izquierda, sin
 * velo, que se montaba encima del contenido y sólo ofrecía el idioma y el
 * diagnóstico local. Tenía dos defectos que no eran de estilo:
 *
 * 1. **No decía dónde estabas.** Un diálogo modal sin velo deja la pantalla de
 *    detrás igual de viva que la de delante, y el foco atrapado dentro se lee
 *    como un fallo en vez de como una decisión.
 * 2. **Le faltaba el ajuste que la gente busca primero.** El tema Día/Noche
 *    existía en la consola del editor y en la paleta de comandos, pero no en
 *    Ajustes, que es el único sitio donde alguien lo busca sin saber que el
 *    editor existe.
 *
 * Ahora es una hoja centrada sobre velo, con tres bloques que declaran qué
 * cambian y dónde vive lo que cambian. El velo cierra al pulsarlo, `Escape`
 * cierra y el foco vuelve a quien abrió — eso último ya lo daba `useModalFocus`
 * y sigue siendo suyo.
 */
const WelcomePreferences = ({ language, theme, onLanguageChange, onThemeChange, onClose }: WelcomePreferencesProps) => {
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

  const themes: ReadonlyArray<{ id: ThemeMode; label: string; icon: typeof Sun }> = [
    { id: 'light', label: text.themeLight, icon: Sun },
    { id: 'dark', label: text.themeDark, icon: Moon },
  ];
  const languages: ReadonlyArray<{ id: 'es' | 'en'; label: string }> = [
    { id: 'es', label: 'Español · ES' },
    { id: 'en', label: 'English · EN' },
  ];

  return <div className="sc-home-settings-scrim" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="sc-home-settings-panel" role="dialog" aria-modal="true" aria-labelledby="sc-home-settings-title" tabIndex={-1}>
      <header className="sc-home-settings-panel__head">
        <div>
          <h2 id="sc-home-settings-title">{text.settingsTitle}</h2>
          <p>{text.settingsBody}</p>
        </div>
        <button ref={closeRef} type="button" className="sc-home-settings-close" aria-label={text.closeSettings} onClick={onClose}><X size={18} /></button>
      </header>

      <section className="sc-home-settings-group" aria-labelledby="sc-home-settings-appearance">
        <h3 id="sc-home-settings-appearance">{text.appearance}</h3>
        <p>{text.appearanceBody}</p>
        <div className="sc-home-settings-choice" role="group" aria-labelledby="sc-home-settings-appearance">
          {themes.map(({ id, label, icon: Icon }) => <button
            key={id}
            type="button"
            aria-pressed={theme === id}
            onClick={() => onThemeChange(id)}
          ><Icon size={15} aria-hidden="true" />{label}</button>)}
        </div>
      </section>

      <section className="sc-home-settings-group" aria-labelledby="sc-home-settings-language">
        <h3 id="sc-home-settings-language">{text.language}</h3>
        <p>{text.languageBody}</p>
        <div className="sc-home-settings-choice" role="group" aria-labelledby="sc-home-settings-language">
          {languages.map(({ id, label }) => <button
            key={id}
            type="button"
            aria-pressed={language === id}
            onClick={() => onLanguageChange(id)}
          >{label}</button>)}
        </div>
      </section>

      <section className="sc-home-settings-group sc-home-settings-metrics" aria-labelledby="local-metrics-title">
        <h3 id="local-metrics-title">{text.localMetrics}</h3>
        <p>{text.localMetricsBody}</p>
        <label className="sc-home-settings-switch">
          <input type="checkbox" checked={metrics.optIn} onChange={(event) => setMetrics(setLocalMetricsOptIn(window.localStorage, event.currentTarget.checked))} />
          <span>{text.localMetricsOptIn}</span>
        </label>
        <p className="sc-home-settings-count">{text.localMetricsCount.replace('{count}', String(metrics.events.length))}</p>
        <div className="sc-home-settings-actions">
          <button type="button" onClick={downloadDiagnostics}><Download size={14} aria-hidden="true" />{text.exportDiagnostics}</button>
          <button type="button" onClick={() => setMetrics(clearLocalMetrics(window.localStorage))} disabled={metrics.events.length === 0}><Trash2 size={14} aria-hidden="true" />{text.clearDiagnostics}</button>
        </div>
      </section>
    </section>
  </div>;
};

export const WelcomeScreen = ({ onOpenWorkspace, onOpenSpace3D, onPreloadWorkspace, onViewChange, initialView = 'home' }: WelcomeScreenProps) => {
  const { project, replaceProject, updateProjectView } = useProject();
  const { language, t } = useI18n();
  const { theme, setTheme } = useWorkspaceUI();
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
  /** Quién está abriendo el producto, leído del repositorio real (CRI-104). */
  const welcomeEntry = useWelcomeEntry();
  /**
   * Cuál es la última petición de ruta del usuario.
   *
   * `openSolver2D` espera una lectura de IndexedDB antes de enrutar, y la
   * portada sigue viva mientras espera: si en ese hueco el usuario elige Aula o
   * el Solver 3D, la continuación de la espera anterior llegaría después y le
   * pisaría su elección más nueva. El contador dice qué petición manda.
   */
  const routeRequestRef = useRef(0);
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
    // Cualquier navegación invalida un enrutado pendiente: ver `openSolver2D`.
    routeRequestRef.current += 1;
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

  /**
   * Una sola acción desde la portada hasta un lienzo utilizable.
   *
   * «Abrir Solver 2D» dejaba siempre al usuario en la bienvenida del módulo y
   * le pedía un segundo clic en «Continuar» para llegar al editor, incluso a
   * quien ya tenía proyectos guardados y sólo quería seguir. `welcomeEntry` ya
   * respondía a esa pregunta —y no la usaba nadie: el módulo estaba escrito y
   * sin cablear—, así que la decisión se toma con él: si hay trabajo guardado y
   * ninguna copia de recuperación pendiente, el CTA entra directo al proyecto;
   * si no, entra a la bienvenida, que es donde viven la creación, la selección
   * y la recuperación en un mismo paso.
   */
  const openSolver2D = async () => {
    // Se lee en el momento de decidir, no al montar: la biblioteca puede
    // llenarse después del primer pintado (migración de la copia compatible), y
    // decidir con un valor congelado —o con `unknown`— sería contestar «usuario
    // nuevo» a quien no se ha preguntado todavía.
    const request = ++routeRequestRef.current;
    const entry = await welcomeEntry.read();
    // Mientras se leía, el usuario pudo elegir otra cosa. Manda su elección.
    if (request !== routeRequestRef.current) return;
    if (shouldResumeDirectly(entry, project.id)) {
      onOpenWorkspace();
      return;
    }
    navigate('solver2d');
  };

  const platformLanding = <FusionLanding
    language={language}
    onOpenSolver2D={() => { void openSolver2D(); }}
    onOpenSolver3D={() => navigate('space3d')}
    onOpenClassroom={() => navigate('classroom')}
  />;

  const solver2dDashboard = <Solver2DHome
    language={language}
    theme={theme}
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
            : view === 'import' ? <section className="sc-home-view" aria-label={text.import}>{viewHeading(text.importTitle, text.importBody)}<div className="sc-home-import-grid"><button type="button" className="welcome-import-card" onClick={() => setImportCenterOpen(true)}><span className="welcome-import-icon"><Upload size={20} /></span><span className="welcome-import-text"><strong>{t('welcome.import')}</strong><small>{text.importPortableBody}</small></span><ArrowRight size={16} className="welcome-launcher-arrow" /></button><Suspense fallback={null}><Phase2DxfAction open={dxfImportOpen} onOpenChange={setDxfImportOpen} onOpenWorkspace={onOpenWorkspace} /></Suspense></div></section>
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
        <header className="sc-home-console"><button type="button" className="sc-home-wordmark" onClick={() => navigate('home')} aria-label={text.backPlatform}><Solver2DMark size={22} /><strong>{SOLVER_2D.name}</strong><span>{SOLVER_2D.product}</span></button>{renderNavigation()}<button ref={mobileMenuButtonRef} className="sc-home-console__menu" type="button" aria-label={mobileNavOpen ? text.closeMenu : text.menu} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}><Menu size={20} /></button></header>
        {mobileNavOpen ? renderNavigation(true) : null}
        <div className="sc-home-main"><header className="sc-home-topline"><span>{text[view]}</span><div className="sc-home-search" role="search"><Search size={16} aria-hidden="true" /><input ref={searchInputRef} type="search" value={searchQuery} aria-label={text.search} placeholder={text.searchPlaceholder} onChange={(event) => { setSearchQuery(event.currentTarget.value); if (event.currentTarget.value && view !== 'solver2d' && view !== 'projects') setView('solver2d'); }} />{searchQuery ? <button type="button" aria-label={text.clearSearch} onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}><X size={15} /></button> : <kbd aria-hidden="true">/</kbd>}</div><div className="sc-home-topline-actions"><label><span className="sr-only">{t('language.label')}</span><select value={language} onChange={(event) => updateLanguage(event.target.value as 'es' | 'en')}><option value="es">ES</option><option value="en">EN</option></select></label></div></header><div className="sc-home-content">{solver2dContent}</div></div>
      </main>;

  return <>{screen}
    {importCenterOpen ? <Suspense fallback={null}><PortableImportCenter open currentProjectName={project.name} onClose={() => setImportCenterOpen(false)} onSaveCurrent={() => exportProjectJson(project)} onImported={(outcome) => { replaceProject({ ...outcome.project, settings: { ...outcome.project.settings, language } }, outcome.restoredAnalysis); setImportCenterOpen(false); onOpenWorkspace(); }} /></Suspense> : null}
    <NewExerciseDialog open={exerciseDialogOpen} initialTemplateId={exerciseTemplateId} onClose={() => setExerciseDialogOpen(false)} onCreate={(next) => { replaceProject({ ...next, settings: { ...next.settings, language } }); setExerciseDialogOpen(false); onOpenWorkspace(); }} />
    {preferencesOpen ? <WelcomePreferences language={language} theme={theme} onLanguageChange={updateLanguage} onThemeChange={setTheme} onClose={closePreferences} /> : null}{studioOpen ? <IllustrationStudio language={language} initialTheme={theme} onClose={closeStudio} /> : null}</>;
};
