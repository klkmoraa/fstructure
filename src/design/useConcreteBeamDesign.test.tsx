// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHibbelerStyleDiagramPractice } from '../data/defaultProject';
import type { ProjectModel, ReinforcedConcreteBeamAssignment } from '../types';
import { concreteBeamDesignSignature, useConcreteBeamDesign } from './useConcreteBeamDesign';

const assignment = (coverMm = 40): ReinforcedConcreteBeamAssignment => ({
  id: 'DESIGN-AB', memberId: 'AB', kind: 'reinforced-concrete-beam', standardId: 'ntc-cdmx-2023-concrete',
  ultimateCombinationId: 'ULS', serviceCombinationId: 'SLS', coverMm, longitudinalSteelYieldMpa: 420, stirrupSteelYieldMpa: 420,
  preferredLongitudinalDiametersMm: [12, 16, 20, 25, 32], preferredStirrupDiametersMm: [8, 10, 12], stirrupLegs: 2,
});

const project = (): ProjectModel => {
  const value = createHibbelerStyleDiagramPractice();
  value.members = value.members.map((member) => member.id === 'AB' ? {
    ...member, materialId: 'concrete-28mpa', materialOrigin: 'catalog', sectionId: 'rect-concrete-300x500', sectionOrigin: 'catalog',
    E: 24_870_062.324, A: 0.15, I: 0.003125,
  } : member);
  value.combinations = [
    { id: 'SLS', name: 'NTC SLS', factors: { LC1: 1 }, stateLimit: 'service', jurisdiction: 'Ciudad de México', edition: '2023', sourceUrl: 'https://example.test/ntc' },
    { id: 'ULS', name: 'NTC ULS', factors: { LC1: 1.4 }, stateLimit: 'ultimate', jurisdiction: 'Ciudad de México', edition: '2023', sourceUrl: 'https://example.test/ntc' },
  ];
  return value;
};

const Probe = ({ value, design }: { value: ProjectModel; design: ReinforcedConcreteBeamAssignment | null }) => {
  const { outcome, busy, error, run, clear } = useConcreteBeamDesign(value, design);
  return <><button onClick={run}>run</button><button onClick={clear}>clear</button><output data-testid="state">{busy ? 'busy' : outcome?.status ?? error ?? 'empty'}</output></>;
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('useConcreteBeamDesign', () => {
  it('uses the worker-handler fallback and invalidates a completed outcome when assignment inputs change', async () => {
    vi.stubGlobal('Worker', undefined);
    const model = project();
    const view = render(<Probe value={model} design={assignment()} />);
    await userEvent.click(screen.getByRole('button', { name: 'run' }));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('available'));
    view.rerender(<Probe value={model} design={assignment(50)} />);
    expect(screen.getByTestId('state').textContent).toBe('empty');
  });

  it('cancels a queued fallback through clear and includes assignment data in invalidation signature', async () => {
    vi.stubGlobal('Worker', undefined);
    const model = project();
    const view = render(<Probe value={model} design={assignment()} />);
    const before = concreteBeamDesignSignature(model, assignment());
    const after = concreteBeamDesignSignature(model, assignment(45));
    expect(after).not.toBe(before);
    await userEvent.click(screen.getByRole('button', { name: 'run' }));
    await userEvent.click(screen.getByRole('button', { name: 'clear' }));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('empty'));
    view.unmount();
  });
});
