import {
  ANALYSIS_WORKER_PROTOCOL_VERSION,
  type AnalysisWorkerRunRequest,
} from './analysisRuntime';
import {
  handleNumericWorkerRequest,
  type SparseLinearAnalysisPayload,
} from './numericWorker';

self.addEventListener('message', (event: MessageEvent<AnalysisWorkerRunRequest<SparseLinearAnalysisPayload>>) => {
  const envelope = event.data;
  if (envelope?.protocolVersion !== ANALYSIS_WORKER_PROTOCOL_VERSION || envelope.type !== 'run') return;
  void handleNumericWorkerRequest(envelope, (response) => self.postMessage(response));
});
