// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { es, translate, type TranslationKey } from '../../i18n/catalogs';
import { toolRegistry } from './toolRegistry';

afterEach(cleanup);
describe('public tool registry', () => {
  it('loads all four real surfaces and never advertises a certified capability', async () => {
    expect(toolRegistry.map((tool) => tool.id)).toEqual(['model2d', 'design', 'space3d', 'fem']);
    for (const descriptor of toolRegistry) {
      expect(descriptor.maturity).toBe('experimental');
      expect(descriptor.capabilities).not.toContain('certified');
      expect(typeof await descriptor.load()).toBe('function');
    }
    expect(toolRegistry.find((tool) => tool.id === 'fem')?.capabilities).toEqual([
      'fem-linear-elasticity', 'fem-tri3-quad4', 'fem-gmsh41-import', 'fem-quality-fields',
    ]);
    const Fem = await toolRegistry[3].load();
    render(<ProjectProvider><Fem /></ProjectProvider>);
    expect(screen.getByRole('heading', { name: 'Elementos finitos' })).toBeTruthy();
    cleanup();
    const Design = await toolRegistry[1].load();
    render(<ProjectProvider><Design /></ProjectProvider>);
    expect(screen.getByLabelText('Cerrar Diseño')).toBeTruthy();
  });
  it('provides translated labels for the selector in both languages', () => {
    for (const descriptor of toolRegistry) {
      expect(descriptor.labelKey in es).toBe(true);
      for (const language of ['es', 'en'] as const) {
        expect(translate(language, descriptor.labelKey as TranslationKey)).not.toBe(descriptor.labelKey);
      }
    }
  });
});
