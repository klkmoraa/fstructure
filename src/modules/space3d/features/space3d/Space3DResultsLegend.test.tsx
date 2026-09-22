// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { translate } from '../../i18n/catalogs';
import { generateSpace3DFrame } from '../../space3d/engine/space3dGenerative';
import { analyzeSpace3DStatic } from '../../space3d/engine/solver';
import { Space3DResultsLegend } from './Space3DResultsLegend';

afterEach(cleanup);

it('shows maximum displacement and navigates to its critical node', async () => {
  const user = userEvent.setup();
  const project = generateSpace3DFrame({
    baysX: 1,
    bayWidthX: 4,
    storiesY: 1,
    storyHeightY: 3,
    baysZ: 1,
    bayDepthZ: 4,
    baseSupport: 'fixed',
    gravityLoadPerNode: 20,
  });
  const analysis = analyzeSpace3DStatic(project, 'LC1');
  expect(analysis.success).toBe(true);

  const onSelectCritical = vi.fn();
  render(
    <Space3DResultsLegend
      resultMode="deformed"
      analysis={analysis}
      project={project}
      onSelectCritical={onSelectCritical}
      t={(key, vars) => translate('es', key, vars)}
    />,
  );

  expect(screen.getByText(/desplazamiento resultante/i)).toBeDefined();
  expect(screen.getByText(/mm$/i)).toBeDefined();

  const critical = screen.getByRole('button', { name: /crítico/i });
  await user.click(critical);
  expect(onSelectCritical).toHaveBeenCalledTimes(1);
  expect(onSelectCritical.mock.calls[0][0]).toBe('node');
});
