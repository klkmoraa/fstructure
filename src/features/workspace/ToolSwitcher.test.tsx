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
  return <><ToolSwitcher tool={tool} onChange={setTool} /><output>{tool}</output></>;
}
it('offers all four tools and uses manual arrow/Home/End activation with Enter and Space', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  expect(screen.getAllByRole('tab').map((node) => node.textContent)).toEqual(['2D', 'Diseño', '3D', 'FEM']);
  await user.tab();
  await user.keyboard('{ArrowRight}');
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Diseño' }));
  expect(screen.getByRole('status').textContent).toBe('model2d');
  await user.keyboard('{Enter}');
  expect(screen.getByRole('status').textContent).toBe('design');
  await user.keyboard('{End} ');
  expect(screen.getByRole('status').textContent).toBe('fem');
  await user.keyboard('{Home}{ArrowLeft}{ArrowRight}{Enter}');
  expect(screen.getByRole('status').textContent).toBe('model2d');
});
