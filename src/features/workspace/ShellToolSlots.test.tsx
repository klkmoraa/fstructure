// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
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
