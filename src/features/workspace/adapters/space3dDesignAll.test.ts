import { afterEach, describe, expect, it, vi } from 'vitest';
import { designCode } from '../../../design/elements/codes';
import { summarizeExternalStructure, type StructureAxisSummary, type StructureDesignOptions } from '../../../design/elements/structure';
import { space3dDesignAxes } from '../../../integrations/space3dDesign';
import { generateSpace3DBuilding } from '../../../modules/space3d/space3d/engine/buildingTemplate';
import { space3dDesignAxesWithWorker } from './space3dDesignAll';
import { designSpace3DAxes, type Space3DDesignAllMessage } from './space3dDesignTask';

const code = 'nsr-10' as const;
const options: StructureDesignOptions = {
  code, coverMm: 40, fcMpa: 25, fyMpa: 420, fyStirrupMpa: 420, maxAggregateMm: 19, includeSelfWeight: true,
  combinations: designCode(code).loadCombinations('B'),
  lateralCombinations: designCode(code).lateralCombinations('B').combinations,
  lateralReference: designCode(code).lateralCombinations('B').reference!,
  sustainedLiveRatio: 0.4, longTermXi: 2, damagesNonstructural: false, beamBarDiameterMm: null, stirrupDiameterMm: null,
  columnReinforcement: { barDiameterMm: 19.1, barsAlongWidth: 3, barsAlongDepth: 3, tieDiameterMm: 9.5 }, group: 'B2', effectiveLengthFactor: null,
};

const building = () => generateSpace3DBuilding({
  xSpacings: [6], zSpacings: [5], storyHeights: [3.5], columnSection: 'Concreto 40x40 cm', beamSection: 'Concreto 30x50 cm',
  superDeadLoad: 4, liveLoad: 2, lateralCoefficient: 0.1,
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('todos los ejes del Modelo 3D fuera del hilo principal', () => {
  it('el trabajo del worker entrega cada eje con el mismo resumen que la mesa y termina', () => {
    const model = building();
    const axes = space3dDesignAxes(model);
    const messages: Space3DDesignAllMessage[] = [];
    // El worker recibe el modelo serializado: una copia JSON, sin funciones.
    designSpace3DAxes({ requestId: 7, model: JSON.parse(JSON.stringify(model)), axisIds: axes.axes.map((axis) => axis.id), options, braced: false }, (message) => messages.push(message));
    expect(messages.at(-1)).toEqual({ requestId: 7, type: 'done' });
    const delivered = messages.filter((message) => message.type === 'axis');
    expect(delivered.map((message) => message.axisId)).toEqual(axes.axes.map((axis) => axis.id));
    for (const message of delivered) {
      expect(message.summary).toEqual(summarizeExternalStructure(axes.source(message.axisId), options, false));
      expect(message.summary.ok).toBe(true);
    }
  });

  it('sin Worker diseña eje por eje en el hilo principal y se puede cancelar', async () => {
    vi.stubGlobal('Worker', undefined);
    const axes = space3dDesignAxesWithWorker(building());
    const received = new Map<string, StructureAxisSummary>();
    await new Promise<void>((resolve) => {
      axes.designAll!({ options, braced: false }, (axisId, summary) => {
        received.set(axisId, summary);
        if (received.size === axes.axes.length) resolve();
      });
    });
    expect([...received.keys()].sort()).toEqual(axes.axes.map((axis) => axis.id).sort());

    const partial: string[] = [];
    const cancel = axes.designAll!({ options, braced: false }, (axisId) => { partial.push(axisId); cancel(); });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(partial).toHaveLength(1);
  });

  it('si el worker falla, los ejes que faltan se diseñan en el hilo principal', async () => {
    class BrokenWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: { preventDefault?: () => void }) => void) | null = null;
      postMessage() { setTimeout(() => this.onerror?.({}), 0); }
      terminate() { /* nada */ }
    }
    vi.stubGlobal('Worker', BrokenWorker);
    const axes = space3dDesignAxesWithWorker(building());
    const received = new Set<string>();
    await new Promise<void>((resolve) => {
      axes.designAll!({ options, braced: false }, (axisId) => {
        received.add(axisId);
        if (received.size === axes.axes.length) resolve();
      });
    });
    expect(received.size).toBe(axes.axes.length);
  });
});
