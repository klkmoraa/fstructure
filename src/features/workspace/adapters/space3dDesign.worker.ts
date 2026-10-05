/// <reference lib="webworker" />
import { designSpace3DAxes, type Space3DDesignAllRequest } from './space3dDesignTask';

self.onmessage = (event: MessageEvent<Space3DDesignAllRequest>) => {
  designSpace3DAxes(event.data, (message) => self.postMessage(message));
};

export {};
