// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createBlankProject } from '../../data/defaultProject';
import { setStiffnessDefaults } from '../../data/memberStiffness';
import { analyzeProject } from '../../engine/solver';
import { translate, type TranslationKey } from '../../i18n/catalogs';
import type { AnalysisResult, ProjectModel } from '../../types';
import { useModelDoctorNotification } from './useModel2DShellEffects';
import { onWorkspaceCommand } from './workspaceCommands';

const t = (key: TranslationKey) => translate('es', key);
const beam = () => {
  const p = createBlankProject();
  p.nodes = [{ id: 'N1', x: 0, y: 0, support: { type: 'pin' } }, { id: 'N2', x: 13, y: 0, support: { type: 'roller', angleDeg: 90 } }];
  p.members = [{ id: 'M1', i: 'N1', j: 'N2', type: 'frame', E: 200e6, A: 0.01, I: 8.333e-6 }];
  p.nodalLoads = [{ id: 'P1', nodeId: 'N2', caseId: 'LC1', fx: 0, fy: -10, mz: 0 }];
  return setStiffnessDefaults(p, { mode: 'EI', factor: 1 }, true);
};
const cleanups: Array<() => void> = [];
afterEach(() => { cleanup(); cleanups.splice(0).forEach(fn => fn()); });
const mount = (project: ProjectModel) => {
  const notices: Array<{ message: string; tone?: string; action?: { command: string; label: string } }> = [];
  cleanups.push(onWorkspaceCommand('show-toast', notice => notices.push(notice)));
  const initial = { project, analysis: null as AnalysisResult | null, isAnalyzing: false, t };
  const hook = renderHook(props => useModelDoctorNotification(props), { initialProps: initial });
  const start = () => {
    act(() => hook.result.current.requestNotification(project.id, null));
    hook.rerender({ ...initial, isAnalyzing: true });
  };
  const finish = (analysis: AnalysisResult) => hook.rerender({ ...initial, analysis });
  return { ...hook, notices, start, finish, initial };
};

describe('user-requested analysis feedback', () => {
  it('keeps the computed relative-stiffness beam silent without changing its results', async () => {
    const project = beam();
    const before = structuredClone(project);
    const analysis = analyzeProject(project);
    expect(analysis.success).toBe(true);
    expect(analysis.nodeResults.find(n => n.nodeId === 'N2')!.ry).toBeCloseTo(10, 9);
    expect(analysis.nodeResults.find(n => n.nodeId === 'N1')!.ry).toBeCloseTo(0, 9);
    const member = analysis.memberResults[0];
    for (const value of [member.maxAxial, member.minAxial, member.maxShear, member.minShear, member.maxMoment, member.minMoment]) expect(value).toBeCloseTo(0, 9);
    const h = mount(project); h.start(); h.finish(analysis);
    await act(async () => {});
    expect(h.notices).toEqual([]);
    expect(analysis.issues.some(issue => issue.id === 'relative-stiffness')).toBe(true);
    expect(project).toEqual(before);
  });
  it('reports a genuine missing support as an error with access to the failed result', async () => {
    const project = beam(); project.nodes.forEach(n => { n.support = { type: 'none' }; });
    const result = analyzeProject(project);
    expect(result.success).toBe(false);
    const h = mount(project); h.start(); h.finish(result);
    await waitFor(() => expect(h.notices).toHaveLength(1));
    expect(h.notices[0]).toMatchObject({ tone: 'error', action: { command: 'open-results' } });
  });
  it('does not disguise an unreliable calculation as a relative-stiffness notice', async () => {
    const project = beam(); const result = analyzeProject(project);
    result.reliability = { ...result.reliability!, level: 'unreliable' };
    const h = mount(project); h.start(); h.finish(result);
    await waitFor(() => expect(h.notices).toHaveLength(1));
    expect(h.notices[0].tone).toBe('error');
  });
  it('reports a runtime failure even when the project precheck has no findings', async () => {
    const project = beam(); delete project.settings.stiffnessDefaults; delete project.members[0].stiffnessFactor;
    const result = analyzeProject(project);
    result.success = false;
    result.issues = [{ id: 'runtime-error', severity: 'error', title: 'Worker', message: 'Analysis failed' }];
    const h = mount(project); h.start(); h.finish(result);
    await waitFor(() => expect(h.notices).toHaveLength(1));
    expect(h.notices[0].tone).toBe('error');
  });
  it('keeps ordinary warnings visible and links to the resulting analysis', async () => {
    const project = beam(); const result = analyzeProject(project);
    result.issues.push({ id: 'numeric-warning', severity: 'warning', title: 'Limit', message: 'Review precision' });
    const h = mount(project); h.start(); h.finish(result);
    await waitFor(() => expect(h.notices).toHaveLength(1));
    expect(h.notices[0]).toMatchObject({ tone: 'warning', action: { command: 'open-results' } });
  });
  it('does not treat limited numerical reliability as a simple relative-stiffness note', async () => {
    const project = beam(); const result = analyzeProject(project);
    result.reliability = { ...result.reliability!, level: 'limited' };
    const h = mount(project); h.start(); h.finish(result);
    await waitFor(() => expect(h.notices).toHaveLength(1));
    expect(h.notices[0].tone).toBe('warning');
  });
  it('never announces an old result without a requested run', async () => {
    const project = beam(); const h = mount(project);
    h.finish(analyzeProject(project));
    await act(async () => {});
    expect(h.notices).toEqual([]);
  });
  it('cancels the notification when the person opens another project', async () => {
    const project = beam(); const h = mount(project); h.start();
    h.rerender({ ...h.initial, project: { ...project, id: 'other' }, analysis: analyzeProject(project) });
    await act(async () => {});
    expect(h.notices).toEqual([]);
  });
  it('shows only the newest request and never repeats it on a view rerender', async () => {
    const project = beam(); const h = mount(project); h.start(); h.start();
    const result = analyzeProject(project);
    result.issues.push({ id: 'numeric-warning', severity: 'warning', title: 'Limit', message: 'Review precision' });
    h.finish(result);
    await waitFor(() => expect(h.notices).toHaveLength(1));
    h.rerender({ ...h.initial, project: { ...project }, analysis: result });
    await act(async () => {});
    expect(h.notices).toHaveLength(1);
  });
});
