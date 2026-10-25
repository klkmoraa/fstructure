// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { usePageZoomGuard } from './usePageZoomGuard';

let surface: HTMLDivElement;

beforeEach(() => {
  surface = document.createElement('div');
  surface.innerHTML = '<header><button>Proyecto</button></header><input aria-label="Valor" /><svg class="structural-canvas"><g><circle /></g></svg><div class="space3d-canvas"><canvas class="space3d-canvas-surface"></canvas><button>Capas</button></div>';
  document.body.append(surface);
});

afterEach(() => {
  cleanup();
  surface.remove();
});

function gesture(target: Element, type = 'gesturestart') {
  const event = new Event(type, { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe('usePageZoomGuard', () => {
  it('permite ampliar campos, la barra y controles superpuestos al canvas', () => {
    renderHook(usePageZoomGuard);
    for (const target of surface.querySelectorAll('input, button')) {
      expect(gesture(target).defaultPrevented).toBe(false);
      expect(gesture(target, 'gesturechange').defaultPrevented).toBe(false);
    }
  });

  it('deja que los dos lienzos gestionen sus propios gestos de Safari', () => {
    renderHook(usePageZoomGuard);
    for (const target of surface.querySelectorAll('circle, canvas')) {
      expect(gesture(target).defaultPrevented).toBe(true);
      expect(gesture(target, 'gesturechange').defaultPrevented).toBe(true);
    }
  });

  it('no cancela los movimientos de dos dedos del resto de la página', () => {
    renderHook(usePageZoomGuard);
    const event = new Event('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: [{}, {}] });
    surface.querySelector('input')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('retira la protección cuando se desmonta la mesa', () => {
    const { unmount } = renderHook(usePageZoomGuard);
    const canvas = surface.querySelector('canvas')!;
    expect(gesture(canvas).defaultPrevented).toBe(true);
    unmount();
    expect(gesture(canvas).defaultPrevented).toBe(false);
    expect(gesture(canvas, 'gesturechange').defaultPrevented).toBe(false);
  });
});
