// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { useState } from 'react';
import type { ToolId } from '../../shared/contracts';
import { ToolSwitcher } from './ToolSwitcher';

afterEach(cleanup);
function Harness() {
  const [tool, setTool] = useState<ToolId>('model2d');
  return <><ToolSwitcher tool={tool} homeLabel="Inicio" onHome={() => undefined} onChange={setTool} /><output>{tool}</output></>;
}
it('offers Inicio and the three other surfaces with menu keyboard navigation', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  expect(screen.getAllByRole('menuitem').map((node) => node.textContent)).toEqual(['Inicio', 'Diseño', '3D', 'FEM']);
  await user.tab();
  await user.keyboard('{ArrowDown}');
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Diseño' }));
  expect(screen.getByRole('status').textContent).toBe('model2d');
  await user.keyboard('{End}');
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'FEM' }));
  await user.keyboard('{Home}{ArrowDown}{Enter}');
  expect(screen.getByRole('status').textContent).toBe('design');
});
