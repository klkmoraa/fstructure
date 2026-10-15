import type { ReactNode } from 'react';
import { ShellInspectorHost, ShellSlotHost, ShellToolSlotsProvider } from '../../../../features/workspace/ShellToolSlots';

/**
 * Host mínimo de ranuras para las pruebas: el 3D sólo se monta dentro del
 * shell de la mesa, así que sus barras, inspector y franja de estado necesitan
 * dónde caer.
 */
export function Space3DShellHost({ children }: { children: ReactNode }) {
  return <ShellToolSlotsProvider mobile={false}>
    <ShellSlotHost slot="controls" /><ShellSlotHost slot="action" /><ShellSlotHost slot="status" />
    {children}
    <ShellInspectorHost />
    <ShellSlotHost slot="statusbar" /><ShellSlotHost slot="dock" />
  </ShellToolSlotsProvider>;
}
