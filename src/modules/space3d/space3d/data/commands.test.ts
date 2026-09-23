import { describe, expect, it } from 'vitest';
import { applySpace3DCommand, Space3DCommandError } from './commands';
import { createBlankSpace3DProject } from '../model/defaultProject';
import { freeSpace3DRestraints } from '../model/types';

const node = (id: string, x: number) => ({ id, x, y: 0, z: 0, restraints: freeSpace3DRestraints() });

describe('comando batch', () => {
  it('applies every command in order as one snapshot', () => {
    const blank = createBlankSpace3DProject();
    const next = applySpace3DCommand(blank, {
      kind: 'batch',
      commands: [{ kind: 'add-node', node: node('N1', 0) }, { kind: 'add-node', node: node('N2', 3) }],
    });
    expect(next.nodes.map((item) => item.id)).toEqual(['N1', 'N2']);
    expect(blank.nodes).toHaveLength(0);
  });

  it('rejects the whole batch when one command fails', () => {
    const blank = createBlankSpace3DProject();
    expect(() => applySpace3DCommand(blank, {
      kind: 'batch',
      commands: [{ kind: 'add-node', node: node('N1', 0) }, { kind: 'add-node', node: node('N1', 5) }],
    })).toThrow(Space3DCommandError);
    expect(blank.nodes).toHaveLength(0);
  });

  it('refuses an empty batch instead of recording a no-op step', () => {
    expect(() => applySpace3DCommand(createBlankSpace3DProject(), { kind: 'batch', commands: [] })).toThrow(/vacío/);
  });
});
