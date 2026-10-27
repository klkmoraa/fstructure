// @vitest-environment jsdom
import { act, cleanup, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LazyMotion, domAnimation } from 'motion/react';
import type { ReactNode } from 'react';
import { createDefaultProject } from '../../data/defaultProject';
import { setStiffnessDefaults } from '../../data/memberStiffness';
import { analyzeProject } from '../../engine/solver';
import type { AnalysisResult } from '../../types';
import { useModelDoctorNotification } from './useModel2DShellEffects';
import { ToastNotification } from './ToastNotification';
import { emitWorkspaceCommand, onWorkspaceCommand } from './workspaceCommands';
vi.mock('../../i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
const stops: Array<() => void> = [];
afterEach(() => { cleanup(); stops.splice(0).forEach(stop => stop()); });
const Wrapper = ({ children }: { children: ReactNode }) => <LazyMotion features={domAnimation}>{children}<ToastNotification /></LazyMotion>;
function mount(project = createDefaultProject()) {
  const notices: unknown[] = [];
  stops.push(onWorkspaceCommand('show-toast', notice => notices.push(notice)));
  const initial = { project, analysis: null as AnalysisResult | null, isAnalyzing: false, t: (key: string) => key };
  const hook = renderHook(props => useModelDoctorNotification(props), { initialProps: initial, wrapper: Wrapper });
  const run = (result: AnalysisResult, analysisAtRequest: AnalysisResult | null = null) => {
    act(() => hook.result.current.requestNotification(project.id, analysisAtRequest));
    hook.rerender({ ...initial, analysis: analysisAtRequest, isAnalyzing: true });
    hook.rerender({ ...initial, analysis: result });
  };
  return { ...hook, initial, notices, run };
}
it.each(['physical', 'relative'] as const)('no genera aviso al resolver correctamente (%s), ni al repetir', async mode => {
  const base = createDefaultProject();
  const project = mode === 'relative' ? setStiffnessDefaults(base, { mode: 'EI', factor: 1 }, true) : base;
  const h = mount(project);
  let last: AnalysisResult | null = null;
  for (let i = 0; i < 3; i++) {
    const result = analyzeProject(project); expect(result.success).toBe(true);
    h.run(result, last); last = result;
  }
  await act(async () => {});
  expect(h.notices).toEqual([]);
  expect(document.querySelector('.sc-toast-card')).toBeNull();
});
it('mantiene un error real y los avisos ajenos al análisis', async () => {
  const project = createDefaultProject();
  project.nodes.forEach(node => { node.support = { type: 'none' }; });
  const h = mount(project);
  act(() => emitWorkspaceCommand('show-toast', { id: 'storage-error', message: 'Error de guardado', tone: 'error', durationMs: 0 }));
  const failure = analyzeProject(project); expect(failure.success).toBe(false);
  h.run(failure);
  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
  act(() => h.result.current.requestNotification(project.id, failure));
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  expect(screen.getByText('Error de guardado')).toBeTruthy();
});
it.each(['limited', 'unreliable'] as const)('no silencia calidad numérica %s', async level => {
  const project = createDefaultProject(); const result = analyzeProject(project);
  result.reliability = { ...result.reliability!, level };
  const h = mount(project); h.run(result);
  await waitFor(() => expect(h.notices).toHaveLength(1));
  expect(document.querySelector(level === 'limited' ? '.sc-toast-card--warning' : '.sc-toast-card--error')).not.toBeNull();
});
it('no silencia advertencias físicas aunque el cálculo termine', async () => {
  const project = createDefaultProject(); const result = analyzeProject(project);
  result.issues.push({ id: 'small-displacement-assumption', severity: 'warning', title: 'Deformación excesiva', message: 'Revisar la hipótesis de primer orden.' });
  const h = mount(project); h.run(result);
  await waitFor(() => expect(h.notices).toHaveLength(1));
  expect(document.querySelector('.sc-toast-card--warning')).not.toBeNull();
});
