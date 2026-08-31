import type { CSSProperties, ReactNode, Ref } from 'react';
import { isToolRailCompact, type ShellClass } from './shellComposition';

export interface AppShellLayoutProps {
  projectId: string;
  skipLabel: string;
  console: ReactNode;
  workspace: ReactNode;
  inspector: ReactNode;
  instrument?: ReactNode;
  backdrop?: ReactNode;
  floatingActions?: ReactNode;
  /**
   * Clase de composición resuelta (CRI-89). El shell la RECIBE y la PUBLICA; no
   * la calcula, no la guarda y no la corrige. Todo lo que dependa de la clase
   * —densidad de fila, compacidad del riel— se deriva de este único atributo.
   */
  shellClass?: ShellClass;
  inspectorCollapsed?: boolean;
  inspectorCompact?: boolean;
  fullCanvas?: boolean;
  inspectorWidth?: number;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Visual composition boundary for the editor. Domain state and commands stay in
 * WorkspaceShell and are injected through slots so this component can only
 * arrange existing surfaces.
 */
export function AppShellLayout({
  projectId,
  skipLabel,
  console,
  workspace,
  inspector,
  instrument,
  backdrop,
  floatingActions,
  shellClass = 'X2',
  inspectorCollapsed = false,
  inspectorCompact = false,
  fullCanvas = false,
  inspectorWidth,
  ref,
}: AppShellLayoutProps) {
  return <div
    ref={ref}
    className="app-shell workspace-screen"
    data-project-id={projectId}
    data-shell-class={shellClass}
    data-inspector-collapsed={inspectorCollapsed || undefined}
    data-inspector-compact={inspectorCompact || undefined}
    data-full-canvas={fullCanvas || undefined}
    data-tool-rail-compact={isToolRailCompact(shellClass) || undefined}
    style={inspectorWidth === undefined ? undefined : { '--inspector-w': `${inspectorWidth}px` } as CSSProperties}
  >
    <a className="app-shell-skip-link" href="#workspace-canvas">{skipLabel}</a>
    {console}
    <div className="workspace">
      <main id="workspace-canvas" className="center-stage" tabIndex={-1}>
        {workspace}
      </main>
      {backdrop}
      {inspector}
      {floatingActions}
    </div>
    {instrument}
  </div>;
}
