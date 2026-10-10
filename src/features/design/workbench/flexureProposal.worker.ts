/// <reference lib="webworker" />
import { proposeFlexureDimensions } from '../../../design/elements/flexureExercise';
import type { FlexureExerciseInput, FlexureDimensionBounds } from '../../../design/elements/flexureExercise';
self.onmessage = (event: MessageEvent<{ requestId: number; input: FlexureExerciseInput; bounds: FlexureDimensionBounds }>) => {
  const { requestId, input, bounds } = event.data;
  try { self.postMessage({ requestId, proposal: proposeFlexureDimensions(input, bounds) }); }
  catch (error) { self.postMessage({ requestId, error: error instanceof Error ? error.message : 'No se pudo dimensionar.' }); }
};
export {};
