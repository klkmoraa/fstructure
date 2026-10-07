// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readProjectUrl, writeProjectUrl } from './projectUrl';

describe('canonical project navigation', () => {
  it('migrates legacy workspace2d preserving project identity', () => {
    expect(readProjectUrl('https://example.test/app/?surface=workspace2d&project=old', 'active')).toEqual({ surface: 'workspace', projectId: 'old', tool: 'model2d' });
  });
  it('sends retired FEM links to the Home without losing the project', () => {
    expect(readProjectUrl('https://example.test/app/?surface=fem&project=old', 'active')).toEqual({ surface: 'welcome', projectId: 'old', tool: 'model2d' });
    expect(readProjectUrl('https://example.test/app/?project=old&tool=fem&mode=design', 'active')).toEqual({ surface: 'welcome', projectId: 'old', tool: 'model2d' });
  });
  it('opens old 3D links in the 3D mode of FStructure', () => {
    expect(readProjectUrl('https://example.test/app/?surface=workspace3d&project=old', 'active')).toEqual({ surface: 'workspace', projectId: 'old', tool: 'model2d', mode: '3d' });
    expect(readProjectUrl('https://example.test/app/?project=old&tool=space3d', 'active')).toEqual({ surface: 'workspace', projectId: 'old', tool: 'model2d', mode: '3d' });
    expect(readProjectUrl('https://example.test/app/?surface=home&project=old&tool=space3d', 'active')).toEqual({ surface: 'welcome', projectId: 'old', tool: 'model2d' });
    expect(readProjectUrl('https://example.test/app/?project=old&tool=model2d&mode=3d', 'active')).toEqual({ surface: 'workspace', projectId: 'old', tool: 'model2d', mode: '3d' });
    expect(readProjectUrl('https://example.test/app/?project=old&tool=model2d&mode=nope', 'active')).toEqual({ surface: 'workspace', projectId: 'old', tool: 'model2d' });
  });
  it('opens old Design links in the Design mode of FStructure', () => {
    expect(readProjectUrl('https://example.test/app/?surface=design&project=old', 'active')).toEqual({ surface: 'workspace', projectId: 'old', tool: 'model2d', mode: 'design' });
    expect(readProjectUrl('https://example.test/app/?project=old&tool=design', 'active')).toEqual({ surface: 'workspace', projectId: 'old', tool: 'model2d', mode: 'design' });
    expect(readProjectUrl('https://example.test/app/?surface=home&project=old&tool=design', 'active')).toEqual({ surface: 'welcome', projectId: 'old', tool: 'model2d' });
    expect(readProjectUrl('https://example.test/app/?project=old&tool=model2d&mode=design', 'active')).toEqual({ surface: 'workspace', projectId: 'old', tool: 'model2d', mode: 'design' });
  });
  it.each(['', 'unknown', 'MODEL2D'])('defaults invalid tool %s to model2d', (tool) => {
    expect(readProjectUrl(`https://example.test/?project=p&tool=${tool}`, 'active')).toEqual({ surface: 'workspace', projectId: 'p', tool: 'model2d' });
  });
  it('preserves opaque project IDs and gives canonical tool precedence over legacy surface', () => {
    expect(readProjectUrl('https://example.test/?project=A%2FB+%26+%C3%B1&tool=model2d&surface=design', 'active')).toEqual({ surface: 'workspace', projectId: 'A/B & ñ', tool: 'model2d' });
    expect(readProjectUrl('https://example.test/?project=%20%20&tool=design', 'active').projectId).toBe('active');
  });
  it('keeps welcome compatible and uses the active project for legacy URLs', () => {
    expect(readProjectUrl('https://example.test/', 'active')).toEqual({ surface: 'welcome', projectId: 'active', tool: 'model2d' });
    expect(readProjectUrl('https://example.test/?surface=fem', 'active').projectId).toBe('active');
  });
  it.each(['__proto__', 'constructor', 'toString', 'unknown'])('ignores invalid legacy surface %s', (surface) => {
    expect(readProjectUrl(`https://example.test/?surface=${surface}`, 'active')).toEqual({ surface: 'welcome', projectId: 'active', tool: 'model2d' });
  });
  it('replaces for canonicalization, pushes navigation once, and preserves deployment path and unrelated params', () => {
    window.history.replaceState({ retained: true }, '', '/app/?surface=design&x=1#old');
    const start = window.history.length;
    const route = { surface: 'workspace', projectId: 'A/B & ñ', tool: 'model2d', mode: 'design' } as const;
    writeProjectUrl(window, route, 'replace');
    expect(window.location.pathname).toBe('/app/');
    expect(window.location.search).toBe('?x=1&project=A%2FB+%26+%C3%B1&tool=model2d&mode=design');
    expect(window.location.hash).toBe('');
    expect(window.history.length).toBe(start);
    expect(window.history.state).toEqual({ retained: true });
    writeProjectUrl(window, { surface: 'workspace', projectId: 'A/B & ñ', tool: 'model2d' }, 'push');
    expect(window.history.length).toBe(start + 1);
    expect(window.location.search).not.toContain('mode=');
    writeProjectUrl(window, { surface: 'workspace', projectId: 'A/B & ñ', tool: 'model2d' }, 'push');
    expect(window.history.length).toBe(start + 1);
  });
});
