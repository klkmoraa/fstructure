import { useState } from 'react';
import type { ToolId } from '../../shared/contracts';
import { useI18n } from '../../i18n/useI18n';
import { useProject, useWorkspaceUI } from '../../store/ProjectContext';
import { SuiteHome } from './SuiteHome';
import { readLastTool } from './lastTool';

interface WelcomeScreenProps {
  /** Abre la bienvenida propia de una herramienta. */
  onOpenToolHome: (tool: ToolId) => void;
  /** Continúa el proyecto abierto directamente en la mesa de una herramienta. */
  onResume: (tool: ToolId) => void;
}

/**
 * Inicio de FusionStructure: el único lugar donde se elige herramienta. Cada
 * herramienta tiene después su propia bienvenida (proyectos, plantillas,
 * entradas y capacidades) antes de su mesa de trabajo.
 */
export const WelcomeScreen = ({ onOpenToolHome, onResume }: WelcomeScreenProps) => {
  const { project, updateProjectView } = useProject();
  const { language } = useI18n();
  const { theme, setTheme } = useWorkspaceUI();
  const [lastTool] = useState<ToolId>(readLastTool);
  return <SuiteHome
    language={language}
    theme={theme}
    project={project}
    lastTool={lastTool}
    onOpenTool={onOpenToolHome}
    onResume={onResume}
    onLanguageChange={(next) => updateProjectView((current) => ({ ...current, settings: { ...current.settings, language: next } }))}
    onThemeChange={setTheme}
  />;
};
