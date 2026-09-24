import { createContext, type ComponentProps } from 'react';
import type { StructuralCanvas } from '../../canvas/StructuralCanvas';

/** The shell owns canvas state and lifecycle; the adapter never creates a copy. */
export const Model2DSurfaceContext = createContext<ComponentProps<typeof StructuralCanvas> | null>(null);
/** Diseño sólo necesita saber cómo cerrarse: su shell lo devuelve al Inicio. */
type DesignSurfaceShell = { onOpenChange: (open: boolean) => void };
export const DesignSurfaceContext = createContext<DesignSurfaceShell | null>(null);
