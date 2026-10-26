import { describe, expect, it } from 'vitest';
import { createBlankProject, createDefaultProject } from '../../data/defaultProject';
import { normalizeProject } from '../../data/migrate';
import { analyzeProject } from '../../engine/solver';
import { analysisFeedback, defaultAnalysisLayer } from './analysisFeedback';
import example from '../../../public/examples/armadura-fijo-movil.fusionstructure.json';

describe('analysis outcome and first evidence layer', () => {
  it('keeps force-only truss equilibrium explicitly unstable with no success notification', () => {
    const result = analyzeProject(normalizeProject(example));
    expect(result.success).toBe(false);
    expect(result.trussEquilibrium).toBeDefined();
    expect(result.displacements).toEqual([]);
    expect(analysisFeedback(result, 'es', 'Review')).toMatchObject({ tone: 'warning', action: { command: 'open-results' } });
  });
  it('selects moment for a frame even when its current load causes zero bending', () => {
    const project = createDefaultProject();
    project.memberLoads = []; project.nodalLoads = [];
    expect(defaultAnalysisLayer(project)).toBe('moment');
  });
  it('selects axial only for deformable truss members, ignoring rigid offsets', () => {
    const project = normalizeProject(example);
    project.members.push({ ...project.members[0], id: 'R', type: 'rigid' });
    expect(defaultAnalysisLayer(project)).toBe('axial');
    project.members[0].type = 'frame';
    expect(defaultAnalysisLayer(project)).toBe('moment');
    expect(defaultAnalysisLayer(createBlankProject())).toBe('moment');
  });
  it('confirms a clean, numerically reliable solve in both supported languages', () => {
    const result = analyzeProject(createDefaultProject());
    expect(result.success).toBe(true);
    const es = analysisFeedback(result, 'es', 'Revisar');
    const en = analysisFeedback(result, 'en', 'Review');
    expect(es.tone).toBe('success');
    expect(en.tone).toBe('success');
    expect(es.message).not.toBe(en.message);
    expect(es.action?.command).toBe('open-results');
  });
});
