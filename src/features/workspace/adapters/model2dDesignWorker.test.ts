import { afterEach, expect, it, vi } from 'vitest';
import { createConcreteFrameProject } from '../../../data/defaultProject';
import { model2dDesignSource } from '../../../design/elements/model2dSource';
import { analyzeModel2dCases, hydrateModel2dCases, type Model2dAnalysisRequest } from '../../../design/elements/model2dAnalysis';
import { designStructure } from '../../../design/elements/structure';
import { FRAME_DEFAULTS, structureOptions } from '../../design/workbench/frameModel';
import { model2dDesignSourceWithWorker } from './model2dDesignWorker';
const requests: Model2dAnalysisRequest[] = [];
class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  postMessage(payload: { requestId: number; analysis: Model2dAnalysisRequest }) {
    requests.push(structuredClone(payload.analysis));
    setTimeout(() => {
      if (!this.terminated)
        this.onmessage?.({
          data: { requestId: payload.requestId, packet: structuredClone(analyzeModel2dCases(payload.analysis)) },
        } as MessageEvent);
    }, 0);
  }
  terminate() {
    this.terminated = true;
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  requests.length = 0;
});
it('analiza base y secciones agrietadas con mensajes serializables; rehidrata diagramas iguales al solver', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const project = createConcreteFrameProject(),
    options = structureOptions('ntc-2023', { ...FRAME_DEFAULTS, proposalBars: 'yes' }, 28);
  const reference = designStructure(model2dDesignSource(project).create({ braced: false })!, options);
  const actual = await model2dDesignSourceWithWorker(project).designAsync(options, false, new AbortController().signal);
  expect(actual.ok).toBe(true);
  expect(reference.ok).toBe(true);
  if (!actual.ok || !reference.ok) throw new Error('diseño');
  expect(actual.governingRatio).toBeCloseTo(reference.governingRatio, 10);
  expect(actual.beams.map((b) => b.result.spans.map((s) => s.checkedDeflectionMm))).toEqual(
    reference.beams.map((b) => b.result.spans.map((s) => s.checkedDeflectionMm)),
  );
  expect(requests.length).toBeGreaterThan(1);
  expect(requests.some((r) => r.model.members.some((m, i) => m.I !== project.members[i]!.I))).toBe(true);
  const packet = structuredClone(analyzeModel2dCases(requests[0]!));
  const hydrated = hydrateModel2dCases(packet),
    source = model2dDesignSource(project).create({ braced: false })!.analyze();
  expect(packet.ok).toBe(true);
  if (!hydrated.ok || !source.ok) throw new Error('análisis');
  expect(hydrated.cases.map((c) => c.nodeDisplacements)).toEqual(source.cases.map((c) => c.nodeDisplacements));
  for (let c = 0; c < source.cases.length; c++)
    for (let m = 0; m < project.members.length; m++)
      for (const x of [0, 0.7, 2]) expect(hydrated.cases[c]!.at(m, x)).toEqual(source.cases[c]!.at(m, x));
});
it('cancelar impide entregar un diseño caducado y termina el worker', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const controller = new AbortController();
  const pending = model2dDesignSourceWithWorker(createConcreteFrameProject()).designAsync(
    structureOptions('ntc-2023', FRAME_DEFAULTS, 28),
    false,
    controller.signal,
  );
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
});
it('conserva el error del solver en el paquete para modelos inestables', () => {
  const project = createConcreteFrameProject();
  const broken = { ...project, nodes: project.nodes.map((n) => ({ ...n, support: { type: 'none' as const } })) };
  let request: Model2dAnalysisRequest | undefined;
  model2dDesignSource(broken, (r) => {
    request = r;
    return { ok: false, error: 'capturado' };
  })
    .create({ braced: false })!
    .analyze();
  const packet = analyzeModel2dCases(request!);
  expect(packet.ok).toBe(false);
  expect(structuredClone(packet)).toEqual(packet);
});
it('un fallo del worker se explica y no se convierte en resultado anterior', async () => {
  class BrokenWorker extends FakeWorker {
    override postMessage() {
      setTimeout(() => this.onerror?.({ preventDefault() {} } as ErrorEvent), 0);
    }
  }
  vi.stubGlobal('Worker', BrokenWorker);
  await expect(
    model2dDesignSourceWithWorker(createConcreteFrameProject()).designAsync(
      structureOptions('ntc-2023', FRAME_DEFAULTS, 28),
      false,
      new AbortController().signal,
    ),
  ).rejects.toThrow(/worker/);
});

it('el Modelo 2D de 4 claros y 4 niveles conserva sus envolventes en el camino del worker', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const { withConcreteFrame } = await import('../../../data/concreteFrame');
  const project = withConcreteFrame(createConcreteFrameProject(), {
    bays: [5, 5, 5, 5], stories: Array.from({length:4}, () => ({heightM:3,deadKnPerM:12,liveKnPerM:5,lateralKn:30})),
    base:'fixed', beam:{widthMm:300,heightMm:500}, column:{widthMm:500,heightMm:500}, fcMpa:28, elasticModulusKpa:25e6, includeSelfWeight:true,
  });
  const options=structureOptions('ntc-2023',{...FRAME_DEFAULTS,proposalBars:'yes'},28);
  const reference=designStructure(model2dDesignSource(project).create({braced:false})!,options);
  const actual=await model2dDesignSourceWithWorker(project).designAsync(options,false,new AbortController().signal);
  expect(actual.ok).toBe(true);expect(reference.ok).toBe(true);
  if(!actual.ok || !reference.ok)throw new Error('4×4');
  expect(actual.governingRatio).toBeCloseTo(reference.governingRatio,10);
  expect(actual.beams.map((b)=>b.result.diagram.momentMaxKnm)).toEqual(reference.beams.map((b)=>b.result.diagram.momentMaxKnm));
  expect(actual.stories.map((s)=>s.driftRatio)).toEqual(reference.stories.map((s)=>s.driftRatio));
  expect(requests[0]!.cases.length).toBeGreaterThan(16);
}, 30000);
