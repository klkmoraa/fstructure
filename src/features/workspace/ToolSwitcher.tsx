import type { ToolId } from '../../shared/contracts';
import { toolRegistry } from './toolRegistry';

const labels: Record<ToolId, string> = { model2d: '2D', design: 'Diseño', space3d: '3D', fem: 'FEM' };

export function ToolSwitcher({ tool, onChange }: { tool: ToolId; onChange: (tool: ToolId) => void }) {
  return <div className="workspace-topbar__tool-switcher workspace-topbar__model-group" role="tablist" aria-label="2D / Diseño / 3D / FEM">
    {toolRegistry.map(({ id }, index) => <button key={id} type="button" role="tab"
      className={'workspace-topbar__action-button' + (id === tool ? ' is-active' : '')}
      aria-selected={id === tool} tabIndex={id === tool ? 0 : -1}
      onClick={() => onChange(id)}
      onKeyDown={(event) => {
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? toolRegistry.length - 1
          : event.key === 'ArrowRight' ? (index + 1) % toolRegistry.length
          : event.key === 'ArrowLeft' ? (index + toolRegistry.length - 1) % toolRegistry.length : null;
        if (next === null) return;
        event.preventDefault();
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
      }}><span>{labels[id]}</span></button>)}
  </div>;
}
