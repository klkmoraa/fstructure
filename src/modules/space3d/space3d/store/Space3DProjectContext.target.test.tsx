// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { generateSpace3DFrame, generateSpace3DIndustrialShed } from '../engine/space3dGenerative';
import { Space3DProjectProvider, useSpace3DProject } from './Space3DProjectContext';

const frame = generateSpace3DFrame({ baysX: 1, bayWidthX: 4, storiesY: 1, storyHeightY: 3, baysZ: 1, bayDepthZ: 4 });
const shed = generateSpace3DIndustrialShed({ spanX: 12, eaveHeightY: 5, ridgeHeightY: 7, baysZ: 2, baySpacingZ: 5 });

const wrapper = ({ children }: { children: ReactNode }) => (
  <Space3DProjectProvider storage={null} initialProject={frame}>{children}</Space3DProjectProvider>
);

/**
 * El historial guarda proyectos, no el caso objetivo. Sustituir un pórtico
 * (LC1) por una nave (ROOF) y deshacer devolvía el pórtico con objetivo ROOF,
 * que no existe en él: el siguiente análisis fallaba con `unknown-target`.
 */
describe('Space3DProjectProvider · objetivo de análisis en el historial', () => {
  it('never points the analysis at a case the present project lacks', () => {
    const { result } = renderHook(() => useSpace3DProject(), { wrapper });
    const frameCase = frame.loadCases[0]!.id;
    const shedCase = shed.loadCases[0]!.id;
    expect(frameCase).not.toBe(shedCase);
    expect(result.current.analysisTargetId).toBe(frameCase);

    act(() => result.current.replaceProject(shed));
    expect(result.current.analysisTargetId).toBe(shedCase);

    act(() => result.current.undo());
    expect(result.current.project.id).toBe(frame.id);
    expect(result.current.analysisTargetId).toBe(frameCase);

    // Rehacer recupera el objetivo guardado en cuanto vuelve a existir.
    act(() => result.current.redo());
    expect(result.current.analysisTargetId).toBe(shedCase);
  });
});
