// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { NewExerciseDialog } from './NewExerciseDialog';

afterEach(cleanup);

describe('NewExerciseDialog', () => {
  it('abre el modelo en blanco sin ofrecer un selector de casos', () => {
    render(<ProjectProvider><NewExerciseDialog open onClose={vi.fn()} onCreate={vi.fn()} /></ProjectProvider>);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
