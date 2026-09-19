import { createContext, type ComponentProps } from 'react';
import type { StructuralCanvas } from '../../canvas/StructuralCanvas';
import type { ConcreteBeamDesignSurfaceProps } from '../../design/ConcreteBeamDesignSurface';

/** The shell owns canvas state and lifecycle; the adapter never creates a copy. */
export const Model2DSurfaceContext = createContext<ComponentProps<typeof StructuralCanvas> | null>(null);
export const DesignSurfaceContext = createContext<ConcreteBeamDesignSurfaceProps | null>(null);
