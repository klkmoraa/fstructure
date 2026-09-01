// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lazy, type ReactNode } from 'react';
import { LazySurface } from './LazySurface';
import { ProjectProvider } from '../../store/ProjectContext';

const BrokenSurface = lazy(() => Promise.reject(new Error('chunk 404')));
const WorkingSurface = lazy(() => Promise.resolve({ default: () => <p>panel vivo</p> }));
const PendingSurface = lazy(() => new Promise<never>(() => {}));

const withProject = (children: ReactNode) => <ProjectProvider>{children}</ProjectProvider>;

describe('LazySurface', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('deja pasar la superficie cuando su chunk llega', async () => {
    render(withProject(<LazySurface><WorkingSurface /></LazySurface>));
    expect(await screen.findByText('panel vivo')).toBeTruthy();
  });

  it('acota el fallo a su hueco en vez de tumbar lo que tiene al lado', async () => {
    render(withProject(<>
      <p>el modelo sigue aqui</p>
      <LazySurface><BrokenSurface /></LazySurface>
    </>));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('el modelo sigue aqui')).toBeTruthy();
  });

  it('ofrece recargar cuando un modulo diferido no esta disponible', async () => {
    render(withProject(<LazySurface><BrokenSurface /></LazySurface>));
    await screen.findByRole('alert');
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('pinta lo pendiente mientras el chunk viaja', () => {
    render(withProject(<LazySurface pending={<span>cargando</span>}><PendingSurface /></LazySurface>));
    expect(screen.getByText('cargando')).toBeTruthy();
  });
});
