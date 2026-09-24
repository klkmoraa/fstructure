import { describe, expect, it } from 'vitest';
import { axialCantilever } from '../engine/fixtures';
import { parseSpace3DDraft, parseSpace3DProject, serializeSpace3DProject, Space3DCodecError } from '../data/codec';
import { createSpace3DGrid, deriveAutomaticSpace3DGrid, resolveSpace3DGrid, space3DLetterLabel } from './grid';
import { validateSpace3DProject } from './validation';

describe('Space3D grid and stories', () => {
  it('labels grid lines like ETABS: A…Z, AA…', () => {
    expect([0, 1, 25, 26, 27].map(space3DLetterLabel)).toEqual(['A', 'B', 'Z', 'AA', 'AB']);
  });

  it('builds a regular grid from spacings', () => {
    const grid = createSpace3DGrid({ xSpacings: [6, 6], zSpacings: [5], storyHeights: [3.5, 3] });
    expect(grid.xLines).toEqual([{ id: 'A', coordinate: 0 }, { id: 'B', coordinate: 6 }, { id: 'C', coordinate: 12 }]);
    expect(grid.zLines.map((line) => line.coordinate)).toEqual([0, 5]);
    expect(grid.stories.map((story) => [story.name, story.elevation])).toEqual([['Base', 0], ['Piso 1', 3.5], ['Piso 2', 6.5]]);
  });

  it('derives an automatic grid from node coordinates when the project has none', () => {
    const project = axialCantilever();
    const grid = resolveSpace3DGrid(project);
    expect(grid.automatic).toBe(true);
    expect(grid.xLines.map((line) => line.coordinate)).toEqual([0, 2]);
    expect(grid.stories).toHaveLength(1);
    expect(deriveAutomaticSpace3DGrid({ nodes: [] }).xLines).toEqual([]);
  });
});

describe('Space3D schema v3 migration', () => {
  it('opens a v2 file, keeps every entity and saves it as v3 without inventing a grid', () => {
    const v3 = axialCantilever();
    const raw = JSON.parse(serializeSpace3DProject(v3)) as Record<string, unknown>;
    raw.schemaVersion = 2;
    const migrated = parseSpace3DProject(JSON.stringify(raw));

    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.grid).toBeUndefined();
    expect(migrated.nodes).toEqual(v3.nodes);
    expect(migrated.members).toEqual(v3.members);
    expect(migrated.nodalLoads).toEqual(v3.nodalLoads);
  });

  it('rejects a grid inside a v2 file: v2 never had one', () => {
    const raw = JSON.parse(serializeSpace3DProject(axialCantilever())) as Record<string, unknown>;
    raw.schemaVersion = 2;
    raw.grid = { xLines: [], zLines: [], stories: [] };
    expect(() => parseSpace3DProject(JSON.stringify(raw))).toThrowError(Space3DCodecError);
  });

  it('round-trips a grid through save → reopen', () => {
    const project = { ...axialCantilever(), grid: createSpace3DGrid({ xSpacings: [2], zSpacings: [], storyHeights: [] }) };
    expect(validateSpace3DProject(project)).toEqual([]);
    const reopened = parseSpace3DDraft(serializeSpace3DProject(project));
    expect(reopened).toEqual(project);
  });

  it('rejects an invalid grid file instead of dropping the bad line', () => {
    const project = { ...axialCantilever(), grid: createSpace3DGrid({ xSpacings: [2], zSpacings: [], storyHeights: [] }) };
    const raw = JSON.parse(serializeSpace3DProject(project)) as { grid: { xLines: Record<string, unknown>[] } };
    raw.grid.xLines[1].coordinate = 'far';
    expect(() => parseSpace3DDraft(JSON.stringify(raw))).toThrowError(Space3DCodecError);
    raw.grid.xLines[1] = { id: 'A', coordinate: 3 };
    expect(() => parseSpace3DDraft(JSON.stringify(raw))).toThrow('duplicado');
  });
});
