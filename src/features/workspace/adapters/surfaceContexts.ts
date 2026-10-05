import { createContext, type ComponentProps } from 'react';
import type { StructuralCanvas } from '../../canvas/StructuralCanvas';

/** The shell owns canvas state and lifecycle; the adapter never creates a copy. */
export const Model2DSurfaceContext = createContext<ComponentProps<typeof StructuralCanvas> | null>(null);
