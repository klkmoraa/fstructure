// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import { ClassroomSessionProvider } from '../../store/ClassroomSessionContext';
import { Inspector } from './Inspector';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(cleanup);

describe('detalle móvil sin selección', () => {
  it('muestra una instrucción breve antes de montar el resumen completo', () => {
    render(<ProjectProvider><ClassroomSessionProvider projectId="project-1"><Inspector surface="detail" presentation="sheet" status="active" /></ClassroomSessionProvider></ProjectProvider>);

    expect(screen.getByRole('heading', { name: 'Selecciona un elemento' })).toBeTruthy();
    expect(screen.queryByLabelText('Resumen del modelo')).toBeNull();
  });
});
