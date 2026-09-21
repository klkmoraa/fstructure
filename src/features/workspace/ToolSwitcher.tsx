import { Box, DraftingCompass, Grid2X2, Home, Network } from 'lucide-react';
import type { ToolId } from '../../shared/contracts';
import { toolRegistry } from './toolRegistry';

const labels: Record<ToolId, string> = { model2d: '2D', design: 'Diseño', space3d: '3D', fem: 'FEM' };
const icons = { model2d: Grid2X2, design: DraftingCompass, space3d: Box, fem: Network } satisfies Record<ToolId, typeof Grid2X2>;

export interface ToolSwitcherProps {
  tool: ToolId;
  homeLabel?: string;
  menuLabel?: string;
  onChange: (tool: ToolId) => void;
  onHome?: () => void;
  onRequestClose?: () => void;
}

export function ToolSwitcher({ tool, homeLabel = 'Inicio', menuLabel = 'Navegación del proyecto', onChange, onHome, onRequestClose }: ToolSwitcherProps) {
  const items = [
    { id: 'home' as const, label: homeLabel, Icon: Home, onSelect: onHome ?? (() => undefined) },
    ...toolRegistry
      .filter(({ id }) => id !== tool)
      .map(({ id }) => ({ id, label: labels[id], Icon: icons[id], onSelect: () => onChange(id) })),
  ];

  return <div id="workspace-surface-menu" className="workspace-topbar__surface-menu" role="menu" aria-label={menuLabel}>
    {items.map(({ id, label, Icon, onSelect }, index) => <button key={id} type="button" role="menuitem"
      className="workspace-topbar__surface-menu-item"
      tabIndex={index === 0 ? 0 : -1}
      onClick={() => { onSelect(); onRequestClose?.(); }}
      onKeyDown={(event) => {
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
          : event.key === 'ArrowDown' || event.key === 'ArrowRight' ? (index + 1) % items.length
          : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? (index + items.length - 1) % items.length : null;
        if (next === null) return;
        event.preventDefault();
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[next]?.focus();
      }}>
      <Icon className="workspace-topbar__surface-menu-icon" size={17} strokeWidth={2.1} aria-hidden="true" />
      <span>{label}</span>
    </button>)}
  </div>;
}
