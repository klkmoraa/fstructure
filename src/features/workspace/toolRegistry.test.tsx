// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { es, translate, type TranslationKey } from '../../i18n/catalogs';
import { toolRegistry } from './toolRegistry';

afterEach(cleanup);
describe('public tool registry', () => {
  it('loads the real surfaces and never advertises a certified capability', async () => {
    expect(toolRegistry.map((tool) => tool.id)).toEqual(['model2d']);
    for (const descriptor of toolRegistry) {
      expect(descriptor.maturity).toBe('experimental');
      expect(descriptor.capabilities).not.toContain('certified');
      expect(typeof await descriptor.load()).toBe('function');
    }
    // FStructure modela en 2D y 3D y diseña: los modos son parte de su superficie.
    expect(toolRegistry.find((tool) => tool.id === 'model2d')?.capabilities).toEqual(expect.arrayContaining(['spatial-model-editing', 'concrete-beam-column-footing-design']));
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
