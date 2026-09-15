import {
  type AnalysisWorkerRunRequest,
} from './analysisRuntime';
import {
  handleNumericWorkerRequest,
  type SparseLinearAnalysisPayload,
} from './numericWorker';

self.addEventListener('message', (event: MessageEvent<AnalysisWorkerRunRequest<SparseLinearAnalysisPayload>>) => {
  void handleNumericWorkerRequest(event.data, (response) => self.postMessage(response));
});
