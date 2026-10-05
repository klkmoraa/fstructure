// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readProjectUrl, writeProjectUrl } from './projectUrl';

describe('canonical project navigation', () => {
  it.each([
    ['workspace2d', 'model2d'], ['design', 'design'], ['workspace3d', 'space3d'], ['fem', 'fem'],
  ])('migrates legacy %s preserving project identity', (surface, tool) => {
    expect(readProjectUrl(`https://example.test/app/?surface=${surface}&project=old`, 'active')).toEqual({ surface: 'workspace', projectId: 'old', tool });
  });
  it.each(['', 'unknown', 'MODEL2D'])('defaults invalid tool %s to model2d', (tool) => {
    expect(readProjectUrl(`https://example.test/?project=p&tool=${tool}`, 'active')).toEqual({ surface: 'workspace', projectId: 'p', tool: 'model2d' });
  });
  it('preserves opaque project IDs and gives canonical tool precedence over legacy surface', () => {
    expect(readProjectUrl('https://example.test/?project=A%2FB+%26+%C3%B1&tool=fem&surface=design', 'active')).toEqual({ surface: 'workspace', projectId: 'A/B & ñ', tool: 'fem' });
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
    const route = { surface: 'workspace', projectId: 'A/B & ñ', tool: 'design' } as const;
    writeProjectUrl(window, route, 'replace');
    expect(window.location.pathname).toBe('/app/');
    expect(window.location.search).toBe('?x=1&project=A%2FB+%26+%C3%B1&tool=design');
    expect(window.location.hash).toBe('');
    expect(window.history.length).toBe(start);
    expect(window.history.state).toEqual({ retained: true });
    writeProjectUrl(window, { ...route, tool: 'fem' }, 'push');
    expect(window.history.length).toBe(start + 1);
    writeProjectUrl(window, { ...route, tool: 'fem' }, 'push');
    expect(window.history.length).toBe(start + 1);
  });
});
