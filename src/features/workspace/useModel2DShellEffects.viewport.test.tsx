// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInspectorDetent, useVisualViewportSync } from './useModel2DShellEffects';

class TestViewport extends EventTarget {
  height = 800;
  offsetTop = 0;
  scale = 1;

  resize(height: number, scale = 1, offsetTop = 0) {
    this.height = height;
    this.scale = scale;
    this.offsetTop = offsetTop;
    this.dispatchEvent(new Event('resize'));
  }
}

let viewport: TestViewport;
let shell: HTMLDivElement;
let field: HTMLInputElement;

beforeEach(() => {
  viewport = new TestViewport();
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 800);
  vi.stubGlobal('innerWidth', 390);
  shell = document.createElement('div');
  field = document.createElement('input');
  shell.append(field);
  document.body.append(shell);
});

afterEach(() => {
  cleanup();
  shell.remove();
  vi.unstubAllGlobals();
});

const mountSync = () => renderHook(() => useVisualViewportSync({ current: shell }));
const value = (name: string) => shell.style.getPropertyValue(`--sc-visual-viewport-${name}`);

describe('useVisualViewportSync', () => {
  it('publica la altura del teclado sólo con un campo editable enfocado', () => {
    mountSync();
    field.focus();
    viewport.resize(470, 1, 20);
    expect(shell.hasAttribute('data-keyboard')).toBe(true);
    expect(value('height')).toBe('470px');
    expect(value('top')).toBe('20px');
    expect(value('bottom')).toBe('310px');
    viewport.resize(800);
    expect(shell.hasAttribute('data-keyboard')).toBe(false);
    expect(value('bottom')).toBe('0px');
  });

  it('no confunde una reducción del viewport sin edición con el teclado', () => {
    mountSync();
    viewport.resize(470);
    expect(shell.hasAttribute('data-keyboard')).toBe(false);
    expect(value('height')).toBe('800px');
    expect(value('bottom')).toBe('0px');
  });

  it('mantiene el dock y la geometría de la mesa durante el zoom de página', () => {
    mountSync();
    field.focus();
    viewport.resize(400, 2, 30);
    expect(shell.hasAttribute('data-keyboard')).toBe(false);
    expect(value('height')).toBe('800px');
    expect(value('top')).toBe('0px');
    expect(value('bottom')).toBe('0px');
    viewport.resize(470);
    expect(shell.hasAttribute('data-keyboard')).toBe(true);
  });

  it('compensa el teclado cuando se abre después de ampliar la página', () => {
    mountSync();
    viewport.resize(400, 2);
    field.focus();
    expect(shell.hasAttribute('data-keyboard')).toBe(false);
    // A 2×, 235 px visibles equivalen a 470 px antes del zoom: el teclado
    // ocupa los otros 330 px de la pantalla de 800 px.
    viewport.resize(235, 2, 40);
    expect(shell.hasAttribute('data-keyboard')).toBe(true);
    expect(value('height')).toBe('235px');
    expect(value('top')).toBe('40px');
    expect(value('bottom')).toBe('525px');
    viewport.resize(400, 2, 40);
    expect(shell.hasAttribute('data-keyboard')).toBe(false);
    expect(value('height')).toBe('800px');
    expect(value('bottom')).toBe('0px');
  });

  it('reconoce los cambios de foco aunque el viewport no emita otro resize', () => {
    mountSync();
    viewport.resize(470);
    field.focus();
    expect(shell.hasAttribute('data-keyboard')).toBe(true);
    field.blur();
    expect(shell.hasAttribute('data-keyboard')).toBe(false);
    expect(value('bottom')).toBe('0px');
  });

  it.each(['readonly', 'checkbox', 'range', 'inputmode-none'])('no interpreta %s como entrada de teclado', (kind) => {
    if (kind === 'readonly') field.readOnly = true;
    else if (kind === 'inputmode-none') field.inputMode = 'none';
    else field.type = kind;
    mountSync();
    field.focus();
    viewport.resize(470);
    expect(shell.hasAttribute('data-keyboard')).toBe(false);
    expect(value('bottom')).toBe('0px');
  });

  it('acepta un área de texto editable', () => {
    const textarea = document.createElement('textarea');
    shell.append(textarea);
    mountSync();
    textarea.focus();
    viewport.resize(470);
    expect(shell.hasAttribute('data-keyboard')).toBe(true);
  });

  it('acepta contenido editable y descarta una reducción pequeña de la barra del navegador', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    editable.tabIndex = 0;
    shell.append(editable);
    mountSync();
    editable.focus();
    viewport.resize(730);
    expect(shell.hasAttribute('data-keyboard')).toBe(false);
    viewport.resize(470);
    expect(shell.hasAttribute('data-keyboard')).toBe(true);
  });

  it('retira listeners y estado del teclado al desmontar', () => {
    const { unmount } = mountSync();
    field.focus();
    viewport.resize(470);
    expect(shell.hasAttribute('data-keyboard')).toBe(true);
    unmount();
    expect(shell.hasAttribute('data-keyboard')).toBe(false);
    expect(value('height')).toBe('');
    viewport.resize(300);
    viewport.dispatchEvent(new Event('scroll'));
    field.blur();
    field.focus();
    window.dispatchEvent(new Event('resize'));
    expect(shell.hasAttribute('data-keyboard')).toBe(false);
    expect(value('height')).toBe('');
  });

  it('conserva el fallback CSS cuando VisualViewport no está disponible', () => {
    vi.stubGlobal('visualViewport', undefined);
    const { unmount } = mountSync();
    field.focus();
    expect(value('height')).toBe('');
    expect(shell.hasAttribute('data-keyboard')).toBe(false);
    unmount();
  });
});

it('conserva la altura del inspector y sus opciones mientras se amplía la página', () => {
  const layout = {
    preferences: { inspectorCollapsed: false, inspectorCompact: false, fullCanvas: false, inspectorWidth: 320, inspectorDetent: 'medium' as const },
    setPreference: vi.fn(),
    togglePreference: vi.fn(),
  };
  const { result } = renderHook(() => useInspectorDetent(layout, 'K0'));
  viewport.resize(400, 2);
  expect(layout.setPreference).not.toHaveBeenCalled();
  result.current.cycleInspectorDetent(1);
  expect(layout.setPreference).toHaveBeenCalledWith('inspectorDetent', 'large');
});
