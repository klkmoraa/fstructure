// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { ShellInspectorHost, ShellSlotHost, ShellToolSlotsProvider } from '../../../../features/workspace/ShellToolSlots';
import { createSpace3DPortalExample } from '../../space3d/model/defaultProject';
import type { Space3DViewportFactory } from '../../space3d/view/Space3DCanvas';
import Space3DWorkspace from './Space3DWorkspace';

afterEach(cleanup);
beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

const MobileHost = ({ children }: { children: ReactNode }) => <ShellToolSlotsProvider mobile>
  <ShellSlotHost slot="controls" /><ShellSlotHost slot="action" /><ShellSlotHost slot="status" />
  {children}
  <ShellSlotHost slot="mobile" /><ShellInspectorHost />
  <ShellSlotHost slot="statusbar" /><ShellSlotHost slot="dock" />
</ShellToolSlotsProvider>;

it('returns to the selected node after cancelling an edit, without moving its camera', async () => {
  const user = userEvent.setup();
  const setView = vi.fn();
  const createViewport: Space3DViewportFactory = () => ({
    scene: new Scene(), camera: new PerspectiveCamera(), controlsTarget: new Vector3(),
    setModel: () => undefined, setLayers: () => undefined, setView,
    zoomBy: () => undefined, resize: () => undefined, render: () => undefined,
    requestRender: () => undefined, dispose: () => undefined,
    pickAt: () => ({ kind: 'node', id: 'N4' }),
  });
  render(<Space3DWorkspace language="es" storage={null} createViewport={createViewport} canonicalProject={createSpace3DPortalExample()} />, { wrapper: MobileHost });
  const canvas = document.querySelector('canvas')!;
  fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: 'touch', button: 0 });
  fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: 'touch', button: 0 });
  setView.mockClear();

  const hud = () => screen.getByRole('region', { name: 'Nudo N4' });
  await user.click(within(hud()).getByRole('button', { name: 'Editar' }));
  const x = screen.getByRole('textbox', { name: 'X' });
  await user.clear(x);
  await user.type(x, '12.5');
  await user.click(within(screen.getByRole('dialog', { name: 'Inspector de herramienta' })).getByRole('button', { name: 'Cancelar' }));

  expect(document.querySelector('.shell-mobile-sheet')?.hasAttribute('open')).toBe(false);
  expect(hud()).toBeTruthy();
  await user.click(within(hud()).getByRole('button', { name: 'Editar' }));
  expect(screen.getByRole('textbox', { name: 'X' })).toHaveProperty('value', '2.5');
  expect(setView).not.toHaveBeenCalled();
});
