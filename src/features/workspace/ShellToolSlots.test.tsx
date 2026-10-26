// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { ShellToolSlotsProvider, ShellSlotHost, ShellContribution, ShellInspectorHost, ShellInspectorTrigger } from './ShellToolSlots';
afterEach(cleanup);
it('mounts adapter controls in shell slots and has one mobile dialog with focus return', async () => {
  const user = userEvent.setup();
  render(<ShellToolSlotsProvider mobile>
    <ShellSlotHost slot="controls" /><ShellSlotHost slot="action" />
    <ShellSlotHost slot="mobile" />
    <ShellInspectorTrigger /><ShellInspectorHost />
    <ShellContribution slot="controls"><button>Contextual</button></ShellContribution>
    <ShellContribution slot="action"><button>Calcular herramienta</button></ShellContribution>
    <ShellContribution slot="inspector"><input aria-label="Propiedad" /></ShellContribution>
  </ShellToolSlotsProvider>);
  expect(screen.getByRole('button', { name: 'Contextual' }).closest('[data-shell-slot]')?.getAttribute('data-shell-slot')).toBe('controls');
  expect(screen.queryByRole('dialog')).toBeNull();
  const trigger = screen.getByRole('button', { name: 'Inspector de herramienta' });
  await user.click(trigger);
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog').className).toContain('shell-mobile-sheet');
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
it('folds the desktop inspector with its topbar toggle instead of opening a sheet', async () => {
  const user = userEvent.setup();
  const { container } = render(<ShellToolSlotsProvider mobile={false}>
    <ShellInspectorTrigger label="Panel" /><ShellInspectorHost />
    <ShellContribution slot="inspector"><input aria-label="Propiedad" /></ShellContribution>
  </ShellToolSlotsProvider>);
  const toggle = screen.getByRole('button', { name: 'Inspector de herramienta' });
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  await user.click(toggle);
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
  expect(container.querySelector('.shell-tool-inspector')?.hasAttribute('data-collapsed')).toBe(true);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('amplía la edición sin remontar sus campos y vuelve al modelo al cerrar la hoja nativa', async () => {
  const user = userEvent.setup();
  render(<ShellToolSlotsProvider mobile>
    <ShellSlotHost slot="mobile" />
    <ShellInspectorTrigger /><ShellInspectorHost />
    <ShellContribution slot="inspector"><input aria-label="Coordenada" defaultValue="3" /></ShellContribution>
  </ShellToolSlotsProvider>);
  const trigger = screen.getByRole('button', { name: 'Inspector de herramienta' });
  await user.click(trigger);
  const field = screen.getByRole('textbox', { name: 'Coordenada' });
  await user.clear(field);
  await user.type(field, '4.5');
  await user.click(screen.getByRole('button', { name: 'Ampliar panel' }));
  expect(screen.getByRole('button', { name: 'Reducir panel' }).getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('textbox', { name: 'Coordenada' })).toBe(field);
  expect((field as HTMLInputElement).value).toBe('4.5');
  fireEvent(screen.getByRole('dialog'), new Event('close'));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  await user.click(trigger);
  expect(screen.getByRole('button', { name: 'Ampliar panel' }).getAttribute('aria-expanded')).toBe('false');
  expect((screen.getByRole('textbox', { name: 'Coordenada' }) as HTMLInputElement).value).toBe('4.5');
});
