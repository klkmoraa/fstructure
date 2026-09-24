import { useState, type CSSProperties } from 'react';
import { ArrowRight, ArrowUpRight, Moon, Sun } from 'lucide-react';
import type { ToolId } from '../../shared/contracts';
import type { ProjectModel, ThemeMode } from '../../types';
import { TOOL_CATALOG, toolIdentity } from '../workspace/toolCatalog';
import { ENGINEERING_QUOTES } from './engineeringQuotes';
import { BrandMark, ToolGlyph } from './toolGlyphs';
import './suite.css';

type Language = 'es' | 'en';

export interface SuiteHomeProps {
  language: Language;
  theme: ThemeMode;
  project: ProjectModel;
  /** Herramienta usada por última vez: «Continuar» vuelve a su mesa. */
  lastTool: ToolId;
  /** Abre la bienvenida de una herramienta. */
  onOpenTool: (tool: ToolId) => void;
  /** Continúa el proyecto abierto en la mesa de una herramienta. */
  onResume: (tool: ToolId) => void;
  onLanguageChange: (language: Language) => void;
  onThemeChange: (theme: ThemeMode) => void;
}

const copy = {
  es: {
    kicker: 'FusionStructure · Análisis',
    lead: 'Cuatro herramientas de cálculo estructural. Cada una abre sola, en su propia mesa.',
    tools: 'Herramientas',
    open: (name: string) => `Abrir ${name}`,
    status: { disponible: 'Disponible', experimental: 'Experimental' },
    resume: 'Continuar',
    resumeIn: (tool: string) => `en ${tool}`,
    theme: { light: 'Día', dark: 'Noche' },
    themeLabel: 'Cambiar tema',
    languageLabel: 'Idioma',
    note: 'Experimental. Un resultado no sustituye la revisión de una persona responsable.',
    stage: 'Pórtico de un vano en arcilla, con placas base y anclajes',
    stageCaption: 'FS · Pórtico de un vano',
  },
  en: {
    kicker: 'FusionStructure · Analysis',
    lead: 'Four structural calculation tools. Each one opens on its own workbench.',
    tools: 'Tools',
    open: (name: string) => `Open ${name}`,
    status: { disponible: 'Available', experimental: 'Experimental' },
    resume: 'Continue',
    resumeIn: (tool: string) => `in ${tool}`,
    theme: { light: 'Day', dark: 'Night' },
    themeLabel: 'Change theme',
    languageLabel: 'Language',
    note: 'Experimental. A result does not replace review by a responsible person.',
    stage: 'Single-bay clay portal frame, with base plates and anchors',
    stageCaption: 'FS · Single-bay portal',
  },
} as const;

const PORTAL = { day: './assets/suite/portal-day.png', night: './assets/suite/portal-night.png' };

/**
 * Inicio de FusionStructure.
 *
 * Un índice de cuatro herramientas y el pórtico. Pasar por una herramienta
 * pone su escena en el escenario; elegirla la abre aislada. Nada compite con
 * eso: sin barra de navegación, sin tarjetas y sin avisos flotantes.
 */
export const SuiteHome = ({ language, theme, project, lastTool, onOpenTool, onResume, onLanguageChange, onThemeChange }: SuiteHomeProps) => {
  const text = copy[language];
  const mode = theme === 'dark' ? 'night' : 'day';
  const [preview, setPreview] = useState<ToolId | null>(null);
  const [quote] = useState(() => ENGINEERING_QUOTES[Math.floor(Math.random() * ENGINEERING_QUOTES.length)] ?? ENGINEERING_QUOTES[0]);
  const last = toolIdentity(lastTool);
  const scenes = [{ id: 'portal', src: PORTAL[mode] }, ...TOOL_CATALOG.map((tool) => ({ id: tool.id, src: tool.scene[mode] }))];
  const shown = preview ?? 'portal';
  const caption = preview ? toolIdentity(preview) : null;

  return <main className="fs-suite" data-testid="suite-welcome">
    <header className="fs-suite__bar">
      <span className="fs-suite__brand"><BrandMark /><strong>FusionStructure</strong></span>
      <div className="fs-suite__prefs">
        <div className="fs-suite__segmented" role="group" aria-label={text.languageLabel}>
          {(['es', 'en'] as const).map((item) => <button key={item} type="button" aria-pressed={language === item} onClick={() => onLanguageChange(item)}>{item.toUpperCase()}</button>)}
        </div>
        <button type="button" className="fs-suite__chip" aria-label={text.themeLabel} onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Moon size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}
          {theme === 'dark' ? text.theme.dark : text.theme.light}
        </button>
      </div>
    </header>

    <div className="fs-suite__body">
      <section className="fs-suite__index" aria-labelledby="fs-suite-title">
        <p className="fs-suite__kicker">{text.kicker}</p>
        <h1 id="fs-suite-title" className="fs-suite__title">Make complexity legible.</h1>
        <p className="fs-suite__lead">{text.lead}</p>

        <nav className="fs-suite__tools" aria-label={text.tools} onMouseLeave={() => setPreview(null)}>
          {TOOL_CATALOG.map((tool) => <button
            key={tool.id}
            type="button"
            className="fs-tool"
            aria-label={`${text.open(tool.name[language])} · ${tool.code} · ${text.status[tool.status]}`}
            onClick={() => onOpenTool(tool.id)}
            onMouseEnter={() => setPreview(tool.id)}
            onFocus={() => setPreview(tool.id)}
            onBlur={() => setPreview(null)}
          >
            <span className="fs-tool__tile"><ToolGlyph tool={tool.id} /></span>
            <span className="fs-tool__copy">
              <span className="fs-tool__meta"><span className="fs-tool__code">{tool.code}</span><span className="fs-status" data-status={tool.status}><span aria-hidden="true" />{text.status[tool.status]}</span></span>
              <strong>{tool.name[language]}</strong>
              <span className="fs-tool__role">{tool.role[language]}</span>
            </span>
            <ArrowRight className="fs-tool__go" size={18} aria-hidden="true" />
          </button>)}
        </nav>

        <button type="button" className="fs-suite__resume" onClick={() => onResume(lastTool)}>
          <span>{text.resume}</span>
          <strong title={project.name}>{project.name}</strong>
          <span>{text.resumeIn(last.name[language])}</span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </section>

      <figure className="fs-suite__stage" data-preview={shown}>
        {scenes.map((scene) => <img
          key={scene.id}
          src={scene.src}
          alt={scene.id === 'portal' ? text.stage : ''}
          aria-hidden={scene.id === 'portal' ? undefined : true}
          className={scene.id === shown ? 'is-shown' : undefined}
          style={{ '--scene-scale': scene.id === 'portal' ? 1 : 0.86 } as CSSProperties}
          decoding="async"
        />)}
        <figcaption aria-live="polite">{caption ? `${caption.code} · ${caption.name[language]}` : text.stageCaption}</figcaption>
      </figure>
    </div>

    <footer className="fs-suite__foot">
      <blockquote className="fs-suite__quote">“{quote.text[language]}” <cite>{quote.author}</cite></blockquote>
      <p className="fs-suite__note">{text.note} · Cristian Mora · <a href="https://github.com/klkmoraa/fstructure" target="_blank" rel="noopener noreferrer">GitHub<ArrowUpRight size={12} aria-hidden="true" /></a></p>
    </footer>
  </main>;
};
