// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useProjectNavigation } from './useProjectNavigation';

afterEach(cleanup);

function Navigation({ projectId = 'active' }: { projectId?: string }) {
  const { route, navigate } = useProjectNavigation(projectId);
  return <>
    <output aria-label="route">{route.surface}/{route.projectId}/{route.tool}</output>
    <button onClick={() => navigate({ surface: 'workspace', projectId, tool: 'design' })}>Design</button>
    <button onClick={() => navigate({ surface: 'workspace', projectId, tool: 'fem' })}>FEM</button>
  </>;
}

it('restores real browser back/forward entries and the same route after a reload', async () => {
  window.history.replaceState(null, '', '/app/?surface=workspace2d');
  const view = render(<Navigation />);
  expect(screen.getByLabelText('route').textContent).toBe('workspace/active/model2d');
  fireEvent.click(screen.getByText('Design'));
  fireEvent.click(screen.getByText('FEM'));
  window.history.back();
  await waitFor(() => expect(screen.getByLabelText('route').textContent).toBe('workspace/active/design'));
  window.history.forward();
  await waitFor(() => expect(screen.getByLabelText('route').textContent).toBe('workspace/active/fem'));
  view.unmount();
  render(<Navigation />);
  expect(screen.getByLabelText('route').textContent).toBe('workspace/active/fem');
});

it('updates the URL when the active project changes without adding a history entry or losing the tool', () => {
  window.history.replaceState(null, '', '/app/?project=active&tool=design');
  const view = render(<Navigation />);
  const length = window.history.length;
  view.rerender(<Navigation projectId="new project" />);
  expect(window.location.search).toBe('?project=new+project&tool=design');
  expect(screen.getByLabelText('route').textContent).toBe('workspace/new project/design');
  expect(window.history.length).toBe(length);
});
