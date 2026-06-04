import type { AgentOutput } from '../types/agent.js';
import type { TraceRecord } from '../types/trace.js';
import type { AgentConfig } from '../types/config.js';
import { writeTrace } from './traceStore.js';

export interface TraceLogger {
  append(patch: Partial<TraceRecord>): void;
  end(output: AgentOutput): void;
}

export function createTraceLogger(config: AgentConfig['trace'], traceId: string, requestId: string, userInput: string): TraceLogger {
  const started = Date.now();
  const record: TraceRecord = {
    traceId,
    requestId,
    startedAt: new Date(started).toISOString(),
    userInput,
  };

  return {
    append(patch) {
      Object.assign(record, patch);
    },
    end(output) {
      const ended = Date.now();
      record.endedAt = new Date(ended).toISOString();
      record.latencyMs = ended - started;
      record.finalOutput = output;
      if (config.enabled && config.writeToFile) {
        void writeTrace(config.directory, record);
      }
    },
  };
}
