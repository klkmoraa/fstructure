// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { translate } from '../../i18n/catalogs';
import { Space3DSelectionHUD } from './Space3DSelectionHUD';
import { generateSpace3DFrame } from '../../space3d/engine/space3dGenerative';

afterEach(cleanup);

it('renders node details and triggers rapid action callbacks in HUD', async () => {
  const user = userEvent.setup();
  const project = generateSpace3DFrame({
    baysX: 1, bayWidthX: 4, storiesY: 1, storyHeightY: 3, baysZ: 1, bayDepthZ: 4, baseSupport: 'fixed',
  });
  const onDeselect = vi.fn();
  const onOpenEditor = vi.fn();
  const onDelete = vi.fn();
  const onStartConnectMember = vi.fn();

  const firstNode = project.nodes[0];
  render(
    <Space3DSelectionHUD
      selection={{ kind: 'node', id: firstNode.id }}
      project={project}
      analysis={null}
      onDeselect={onDeselect}
      onOpenEditor={onOpenEditor}
      onDelete={onDelete}
      onStartConnectMember={onStartConnectMember}
      t={(key, vars) => translate('es', key, vars)}
    />,
  );

  expect(screen.getByText(firstNode.id)).toBeDefined();
  expect(screen.getByRole('button', { name: /conectar/i })).toBeDefined();

  await user.click(screen.getByRole('button', { name: /conectar/i }));
  expect(onStartConnectMember).toHaveBeenCalledWith(firstNode.id);

  await user.click(screen.getByRole('button', { name: /editar/i }));
  expect(onOpenEditor).toHaveBeenCalledTimes(1);
});

it('renders member details and triggers delete callback in HUD', async () => {
  const user = userEvent.setup();
  const project = generateSpace3DFrame({
    baysX: 1, bayWidthX: 4, storiesY: 1, storyHeightY: 3, baysZ: 1, bayDepthZ: 4, baseSupport: 'fixed',
  });
  const onDelete = vi.fn();

  render(
    <Space3DSelectionHUD
      selection={{ kind: 'member', id: project.members[0].id }}
      project={project}
      analysis={null}
      onDeselect={vi.fn()}
      onOpenEditor={vi.fn()}
      onDelete={onDelete}
      t={(key, vars) => translate('es', key, vars)}
    />,
  );

  expect(screen.getByText(project.members[0].id)).toBeDefined();
  await user.click(screen.getByRole('button', { name: /eliminar/i }));
  expect(onDelete).toHaveBeenCalledTimes(1);
});
