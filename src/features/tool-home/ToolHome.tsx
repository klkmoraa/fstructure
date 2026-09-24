import { useLayoutEffect, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, FilePlus2, Home, Menu, Play, Search, X, type LucideIcon } from 'lucide-react';
import { createBlankProject } from '../../data/defaultProject';
import { useI18n } from '../../i18n/useI18n';
import { useProject, useWorkspaceUI } from '../../store/ProjectContext';
import type { ToolId } from '../../shared/contracts';
import { ProjectHub } from '../project-hub/ProjectHub';
import { toolIdentity } from '../workspace/toolCatalog';
import { ToolGlyph } from '../welcome/toolGlyphs';
import '../welcome/totalHome.css';
import '../welcome/solver2dHome.css';
import './toolHome.css';

type Language = 'es' | 'en';
type Localized = Record<Language, string>;
export type CapabilityState = 'available' | 'experimental' | 'planned';

/** Una entrada de «Por dónde empezar»: una acción o un selector de archivo. */
export type ToolHomePath = {
  id: string;
  icon: LucideIcon;
  label: Localized;
  body: Localized;
} & ({ action: () => void } | { accept: string; onFile: (file: File) => void });

export interface ToolHomeContent {
  title: Localized;
  lead: Localized;
  continueLabel?: Localized;
  stageAlt: Localized;
  startBody: Localized;
  paths: readonly ToolHomePath[];
  /** Encima de las rutas: p. ej. la norma de Diseño. */
  pathsControl?: ReactNode;
  capabilities: readonly { id: string; state: CapabilityState; label: Localized; body: Localized }[];
  note: Localized;
}

interface ToolHomeProps {
  tool: Exclude<ToolId, 'model2d'>;
  content: ToolHomeContent;
  /** Resumen del trabajo de esta herramienta en el proyecto abierto. */
  summary: readonly { value: string | number; label: string }[];
  onOpenWorkspace: () => void;
  onOpenSuite: () => void;
}

const copy = {
  es: {
    home: 'Inicio', suite: 'FusionStructure', suiteHint: 'Volver a FusionStructure', navigation: 'Navegación de la herramienta',
    backToTop: (name: string) => `Volver al inicio de ${name}`,
    menu: 'Abrir navegación', closeMenu: 'Cerrar navegación', search: 'Buscar', searchPlaceholder: 'Buscar proyectos…', clearSearch: 'Borrar búsqueda', language: 'Idioma',
    open: 'Proyecto abierto', continue: 'Continuar', create: 'Proyecto nuevo', startTitle: 'Por dónde empezar',
    recentTitle: 'Proyectos recientes', recentBody: 'Guardados en este dispositivo. Se abren en esta herramienta.',
    capabilityTitle: (name: string) => `Qué hace ${name}`, capabilityBody: 'Cada capacidad lleva su estado declarado.',
    state: { available: 'Disponible', experimental: 'Experimental', planned: 'Planeado' },
    creatorLabel: 'Creador:', about: 'Acerca de',
  },
  en: {
    home: 'Home', suite: 'FusionStructure', suiteHint: 'Back to FusionStructure', navigation: 'Tool navigation',
    backToTop: (name: string) => `Back to the top of ${name}`,
    menu: 'Open navigation', closeMenu: 'Close navigation', search: 'Search', searchPlaceholder: 'Search projects…', clearSearch: 'Clear search', language: 'Language',
    open: 'Open project', continue: 'Continue', create: 'New project', startTitle: 'Where to start',
    recentTitle: 'Recent projects', recentBody: 'Saved on this device. They open in this tool.',
    capabilityTitle: (name: string) => `What ${name} does`, capabilityBody: 'Every capability carries its declared state.',
    state: { available: 'Available', experimental: 'Experimental', planned: 'Planned' },
    creatorLabel: 'Creator:', about: 'About',
  },
} as const;

const stateAttr = { available: 'available', experimental: 'experimental', planned: 'planned' } as const;

/**
 * Bienvenida propia de una herramienta aislada (Solver 3D, Elementos finitos,
 * Diseño).
 *
 * Usa el mismo lenguaje que la bienvenida original de FStructure —consola,
 * portada con la escena en arcilla, rutas de entrada, recientes y capacidades
 * con su estado— para que las cuatro se lean como una familia. Cada
 * herramienta aporta su contenido; ninguna enlaza a otra: la única salida
 * lateral es volver a FusionStructure.
 */
export const ToolHome = ({ tool, content, summary, onOpenWorkspace, onOpenSuite }: ToolHomeProps) => {
  const { project, replaceProject, updateProjectView } = useProject();
  const { language } = useI18n();
  const { theme } = useWorkspaceUI();
  const text = copy[language];
  const identity = toolIdentity(tool);
  const name = identity.name[language];
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const homeRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Mismo contrato táctil que la bienvenida de FStructure (ver Model2DWelcome).
  useLayoutEffect(() => {
    const sync = () => {
      const visualWidth = window.visualViewport?.width ?? window.innerWidth;
      const screenWidth = window.screen?.width ?? window.innerWidth;
      const compactMedia = window.matchMedia?.('(max-width: 760px), (max-device-width: 760px)').matches ?? false;
      const compact = compactMedia || /Android.*Mobile|iPhone|iPod/i.test(navigator.userAgent) || Math.min(window.innerWidth, visualWidth, screenWidth) <= 760;
      homeRef.current?.toggleAttribute('data-compact-viewport', compact);
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  const createProject = () => {
    const blank = createBlankProject();
    replaceProject({ ...blank, settings: { ...blank.settings, language } });
    onOpenWorkspace();
  };

  const onPathFile = (event: ChangeEvent<HTMLInputElement>, onFile: (file: File) => void) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) onFile(file);
  };

  const renderNavigation = (menu = false) => <nav className={menu ? 'sc-home-nav sc-home-nav--menu' : 'sc-home-nav sc-home-nav--console'} aria-label={text.navigation}>
    <button type="button" aria-label={text.suiteHint} title={text.suiteHint} onClick={onOpenSuite}><ArrowLeft size={19} /><span>{text.suite}</span></button>
    <button type="button" aria-label={text.home} title={text.home} className="is-active" aria-current="page"><Home size={19} /><span>{text.home}</span></button>
  </nav>;

  return <main ref={homeRef} className="sc-home tool-home" data-testid={`${tool}-welcome`} data-tool={tool}>
    <header className="sc-home-console">
      <button type="button" className="sc-home-wordmark" onClick={() => contentRef.current?.scrollTo({ top: 0 })} aria-label={text.backToTop(name)}>
        <ToolGlyph tool={tool} size={28} /><strong>{name}</strong><span>{identity.code}</span>
      </button>
      {renderNavigation()}
      <button type="button" className="sc-home-console__menu" aria-label={mobileNavOpen ? text.closeMenu : text.menu} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}><Menu size={20} /></button>
    </header>
    {mobileNavOpen ? renderNavigation(true) : null}
    <div className="sc-home-main">
      <header className="sc-home-topline">
        <span>{text.home}</span>
        <div className="sc-home-search" role="search"><Search size={16} aria-hidden="true" /><input ref={searchRef} type="search" value={searchQuery} aria-label={text.search} placeholder={text.searchPlaceholder} onChange={(event) => setSearchQuery(event.currentTarget.value)} />{searchQuery ? <button type="button" aria-label={text.clearSearch} onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}><X size={15} /></button> : <kbd aria-hidden="true">/</kbd>}</div>
        <div className="sc-home-topline-actions"><label><span className="sr-only">{text.language}</span><select value={language} aria-label={text.language} onChange={(event) => updateProjectView((current) => ({ ...current, settings: { ...current.settings, language: event.currentTarget.value as Language } }))}><option value="es">ES</option><option value="en">EN</option></select></label></div>
      </header>
      <div ref={contentRef} className="sc-home-content">
        <div className="solver2d-home">
          <section className="solver2d-hero" aria-labelledby={`${tool}-hero-name`}>
            <div className="solver2d-hero__copy">
              <span className="solver2d-hero__eyebrow tool-home__eyebrow" style={{ '--reveal-step': 0 } as CSSProperties}>
                {identity.code}<span className="tool-home__status" data-status={identity.status}>{identity.status === 'experimental' ? text.state.experimental : text.state.available}</span>
              </span>
              <h1 id={`${tool}-hero-name`} className="solver2d-hero__name" style={{ '--reveal-step': 1 } as CSSProperties}>{content.title[language]}</h1>
              <p className="solver2d-hero__lead" style={{ '--reveal-step': 2 } as CSSProperties}>{content.lead[language]}</p>
              <div className="solver2d-open" style={{ '--reveal-step': 3 } as CSSProperties}>
                <div className="solver2d-open__head">
                  <span className="solver2d-open__label">{text.open}</span>
                  <h2 className="solver2d-open__name" title={project.name}>{project.name}</h2>
                  <p className="solver2d-open__counts">{summary.map((item) => <span key={item.label}><b>{item.value}</b> {item.label}</span>)}</p>
                </div>
                <div className="solver2d-open__actions">
                  <button type="button" className="solver2d-action solver2d-action--primary" onClick={onOpenWorkspace}><Play size={16} fill="currentColor" />{content.continueLabel?.[language] ?? text.continue}</button>
                  <button type="button" className="solver2d-action" onClick={createProject}><FilePlus2 size={16} />{text.create}</button>
                </div>
              </div>
            </div>
            <div className="solver2d-hero__stage" style={{ '--reveal-step': 2 } as CSSProperties}>
              <div className="solver2d-stage" data-theme={theme} data-caption={`${identity.code} · ${name}`}>
                <div className="solver2d-stage__object">
                  <img className="three-structural-image tool-home__scene" src={theme === 'dark' ? identity.scene.night : identity.scene.day} alt={content.stageAlt[language]} width={960} height={640} decoding="async" />
                </div>
              </div>
            </div>
          </section>

          <section className="solver2d-section" aria-labelledby={`${tool}-start-title`}>
            <header className="solver2d-section__head">
              <div><h2 id={`${tool}-start-title`}>{text.startTitle}</h2><p>{content.startBody[language]}</p></div>
              {content.pathsControl}
            </header>
            <div className="solver2d-paths tool-home__paths" style={{ '--path-count': content.paths.length } as CSSProperties}>
              {content.paths.map((path, index) => {
                const Icon = path.icon;
                const inner = <>
                  <span className="solver2d-path__icon" aria-hidden="true"><Icon size={17} /></span>
                  <strong>{path.label[language]}</strong>
                  <span className="solver2d-path__body">{path.body[language]}</span>
                  <ArrowUpRight className="solver2d-path__go" size={15} aria-hidden="true" />
                </>;
                const style = { '--path-tone': 'var(--sc-color-family-analisis)', '--reveal-step': index } as CSSProperties;
                return 'action' in path
                  ? <button key={path.id} type="button" className="solver2d-path" style={style} onClick={path.action}>{inner}</button>
                  : <label key={path.id} className="solver2d-path tool-home__file" style={style}>
                    {inner}
                    <input type="file" accept={path.accept} aria-label={path.label[language]} onChange={(event) => onPathFile(event, path.onFile)} />
                  </label>;
              })}
            </div>
          </section>

          <section className="solver2d-section" aria-labelledby={`${tool}-recent-title`}>
            <header className="solver2d-section__head">
              <div><h2 id={`${tool}-recent-title`}>{text.recentTitle}</h2><p>{text.recentBody}</p></div>
            </header>
            <div className="solver2d-recents"><ProjectHub variant="recent" limit={3} filter={searchQuery} onOpen={(record) => {
              replaceProject({ ...record.project, settings: { ...record.project.settings, language } }, undefined, record.revision);
              onOpenWorkspace();
            }} /></div>
          </section>

          <section className="solver2d-section" aria-labelledby={`${tool}-capability-title`}>
            <header className="solver2d-section__head">
              <div><h2 id={`${tool}-capability-title`}>{text.capabilityTitle(name)}</h2><p>{text.capabilityBody}</p></div>
            </header>
            <div className="solver2d-capabilities">
              {content.capabilities.map(({ id, state, label, body }, index) => <article key={id} className="solver2d-capability" style={{ '--reveal-step': index } as CSSProperties}>
                <span className="solver2d-state" data-state={stateAttr[state]}>{text.state[state]}</span>
                <strong>{label[language]}</strong>
                <p>{body[language]}</p>
              </article>)}
            </div>
            <p className="solver2d-note">{content.note[language]}</p>
          </section>

          <footer className="solver2d-footer" aria-label={`${text.about} ${name}`}>
            <p className="solver2d-footer__credit"><span className="solver2d-footer__label">{text.creatorLabel}</span><strong className="solver2d-footer__name">Cristian Mora</strong></p>
            <a href="https://github.com/klkmoraa/fstructure" target="_blank" rel="noopener noreferrer" className="solver2d-footer__github"><span>github.com/klkmoraa/fstructure</span><ArrowUpRight size={13} aria-hidden="true" /></a>
          </footer>
        </div>
      </div>
    </div>
  </main>;
};
