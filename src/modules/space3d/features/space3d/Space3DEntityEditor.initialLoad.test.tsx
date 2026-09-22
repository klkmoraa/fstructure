// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { translate } from '../../i18n/catalogs';
import { generateSpace3DFrame } from '../../space3d/engine/space3dGenerative';
import { Space3DEntityEditor } from './Space3DEntityEditor';

afterEach(cleanup);

it('preselects the HUD node for a newly created nodal load', () => {
  const project = generateSpace3DFrame({
    baysX: 1, bayWidthX: 4, storiesY: 1, storyHeightY: 3, baysZ: 1, bayDepthZ: 4,
  });
  const targetNode = project.nodes.at(-1)!;

  render(
    <Space3DEntityEditor
      project={project}
      target={{ kind: 'load', id: null, initialNodeId: targetNode.id }}
      t={(key, vars) => translate('es', key, vars)}
      onSubmit={vi.fn(() => true)}
      onCancel={vi.fn()}
    />,
  );

  const select = screen.getByLabelText(translate('es', 'space3d.node')) as HTMLSelectElement;
  expect(select.value).toBe(targetNode.id);
});
