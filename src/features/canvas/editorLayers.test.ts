import { describe, expect, it } from 'vitest';
import {
  activeEditorLayerPreset,
  EDITOR_LAYER_PRESETS,
  type EditorLayerState,
} from './editorLayers';

describe('editor layer presets', () => {
  it('el preset Todas activa cada capa del editor', () => {
    const expected: EditorLayerState = {
      model: true,
      loads: true,
      dimensions: true,
      ids: true,
      results: true,
      labels: true,
      help: true,
      diagnostics: true,
      heatmap: true,
    };

    expect(EDITOR_LAYER_PRESETS.all).toEqual(expected);
    expect(activeEditorLayerPreset(expected)).toBe('all');
  });
});
