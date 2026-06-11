import type {
  AgentInput,
  AgentOutput,
  StandardTraceDocument,
  TraceEvent,
  TraceOutputSummary,
} from './types.js';

export const TRACE_FORMAT_VERSION = '0.1' as const;

const sensitiveKeys = new Set([
  'apikey',
  'authorization',
  'content',
  'headers',
  'input',
  'metadata',
  'output',
  'password',
  'prompt',
  'secret',
  'token',
]);

export function createTraceDocument(input: AgentInput, traceId: string): StandardTraceDocument {
  return {
    formatVersion: TRACE_FORMAT_VERSION,
    traceId,
    requestId: input.requestId?.trim() || traceId,
    startedAt: new Date().toISOString(),
    input: {
      inputLength: input.input.length,
      hasSessionId: Boolean(input.sessionId),
      hasUserId: Boolean(input.userId),
    },
    events: [],
  };
}

export function appendTraceEvent(document: StandardTraceDocument, event: Omit<TraceEvent, 'at'>): void {
  document.events.push({
    type: event.type,
    ...(event.data !== undefined ? { data: redactTraceData(event.data) } : {}),
    at: new Date().toISOString(),
  });
}

export function finishTraceDocument(document: StandardTraceDocument, output: AgentOutput): void {
  document.endedAt = new Date().toISOString();
  document.latencyMs = Math.max(0, Date.parse(document.endedAt) - Date.parse(document.startedAt));
  document.finalOutput = summarizeOutput(output);
}

export function summarizeOutput(output: AgentOutput): TraceOutputSummary {
  return {
    success: output.success,
    intent: output.intent,
    errorCodes: output.errorDetails?.map((error) => error.code) ?? [],
  };
}

export function redactTraceData(value: unknown, key?: string): unknown {
  if (key && sensitiveKeys.has(key.toLowerCase())) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => redactTraceData(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([entryKey, entryValue]) => [entryKey, redactTraceData(entryValue, entryKey)]),
    );
  }
  return value;
}
