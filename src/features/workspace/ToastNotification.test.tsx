// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LazyMotion, domAnimation } from 'motion/react';
import { ToastNotification } from './ToastNotification';
import { emitWorkspaceCommand, onWorkspaceCommand } from './workspaceCommands';
vi.mock('../../i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
const stops: Array<() => void> = [];
afterEach(() => { cleanup(); stops.splice(0).forEach(stop => stop()); vi.useRealTimers(); });
const mount = () => render(<LazyMotion features={domAnimation}><ToastNotification /></LazyMotion>);
it.each(['open-model-doctor', 'open-results'] as const)('opens %s from a real, independently operable action button', async command => {
  let opened = 0;
  stops.push(onWorkspaceCommand(command, () => { opened += 1; }));
  mount();
  act(() => emitWorkspaceCommand('show-toast', { message: 'Computed', tone: 'info', durationMs: 0, action: { label: 'Review', command } }));
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  expect(opened).toBe(1);
  await waitFor(() => expect(screen.queryByText('Computed')).toBeNull());
});
it('dismisses a notice without opening its review', async () => {
  let opened = 0;
  stops.push(onWorkspaceCommand('open-model-doctor', () => { opened += 1; }));
  mount();
  act(() => emitWorkspaceCommand('show-toast', { message: 'Review pending', durationMs: 0, action: { label: 'Review', command: 'open-model-doctor' } }));
  fireEvent.click(screen.getByRole('button', { name: 'toast.dismiss' }));
  await waitFor(() => expect(screen.queryByText('Review pending')).toBeNull());
  expect(opened).toBe(0);
});
it('replaces an older analysis notice rather than piling banners over the canvas', async () => {
  mount();
  act(() => emitWorkspaceCommand('show-toast', { id: 'analysis-result', message: 'Old result', durationMs: 0 }));
  act(() => emitWorkspaceCommand('show-toast', { id: 'analysis-result', message: 'New result', durationMs: 0 }));
  await waitFor(() => expect(screen.queryByText('Old result')).toBeNull());
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByText('New result')).toBeTruthy();
});
it('keeps a timed notice available while its action has keyboard focus', () => {
  vi.useFakeTimers();
  mount();
  act(() => emitWorkspaceCommand('show-toast', { message: 'Computed', durationMs: 100, action: { label: 'Review', command: 'open-results' } }));
  const action = screen.getByRole('button', { name: 'Review' });
  act(() => action.focus());
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole('button', { name: 'Review' })).toBe(action);
});
it('a reference-stiffness result opens Results, never Model Doctor', async () => {
  const { createDefaultProject } = await import('../../data/defaultProject');
  const { setStiffnessDefaults } = await import('../../data/memberStiffness');
  const { analyzeProject } = await import('../../engine/solver');
  const { analysisFeedback } = await import('./analysisFeedback');
  const result = analyzeProject(setStiffnessDefaults(createDefaultProject(), { mode: 'EI', factor: 1 }, true));
  result.issues = result.issues.filter(issue => issue.id === 'relative-stiffness');
  let results = 0; let doctor = 0;
  stops.push(onWorkspaceCommand('open-results', () => { results += 1; }));
  stops.push(onWorkspaceCommand('open-model-doctor', () => { doctor += 1; }));
  mount();
  const notice = analysisFeedback(result, 'es', 'Doctor');
  act(() => emitWorkspaceCommand('show-toast', notice));
  expect(results).toBe(0); expect(doctor).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: notice.action!.label }));
  expect(results).toBe(1); expect(doctor).toBe(0);
});
