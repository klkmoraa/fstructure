// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { es, translate, type TranslationKey } from '../../i18n/catalogs';
import { toolRegistry } from './toolRegistry';

afterEach(cleanup);
describe('public tool registry', () => {
  it('loads the three real surfaces and never advertises a certified capability', async () => {
    expect(toolRegistry.map((tool) => tool.id)).toEqual(['model2d', 'space3d', 'fem']);
    for (const descriptor of toolRegistry) {
      expect(descriptor.maturity).toBe('experimental');
      expect(descriptor.capabilities).not.toContain('certified');
      expect(typeof await descriptor.load()).toBe('function');
    }
    expect(toolRegistry.find((tool) => tool.id === 'fem')?.capabilities).toEqual([
      'fem-linear-elasticity', 'fem-tri3-quad4', 'fem-gmsh41-import', 'fem-quality-fields',
    ]);
    // FStructure modela y diseña: el modo Diseño es parte de su superficie.
    expect(toolRegistry.find((tool) => tool.id === 'model2d')?.capabilities).toContain('concrete-beam-column-footing-design');
    const Fem = await toolRegistry[2].load();
    render(<ProjectProvider><Fem /></ProjectProvider>);
    expect(screen.getByRole('heading', { name: 'Elementos finitos' })).toBeTruthy();
    cleanup();
    const { default: Design } = await import('./adapters/DesignSurface');
    render(<ProjectProvider><Design /></ProjectProvider>);
    expect(screen.getByRole('radiogroup', { name: 'Elemento a diseñar' })).toBeTruthy();
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
