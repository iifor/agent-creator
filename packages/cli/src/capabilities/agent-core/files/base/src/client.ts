import type { AgentOutput, AgentProgressEvent } from '@agent-creator/core';

export interface AgentHttpOptions {
  baseUrl: string;
  input: string;
  sessionId?: string;
  requestId?: string;
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
}

export type AgentStreamEvent =
  | { type: 'progress'; event: AgentProgressEvent }
  | { type: 'final'; output: AgentOutput };

export async function runAgentHttp(options: AgentHttpOptions): Promise<AgentOutput> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) throw new Error('Global fetch is unavailable. Node.js 18 or newer is required.');
  const response = await fetchImpl(`${normalizeBaseUrl(options.baseUrl)}/api/agent`, {
    method: 'POST',
    headers: requestHeaders(options.apiKey, options.requestId),
    body: JSON.stringify({ input: options.input, sessionId: options.sessionId }),
  });
  if (!response.ok) throw new Error(`agent_request_failed: ${response.status} ${await response.text()}`);
  return await response.json() as AgentOutput;
}

export async function* streamAgentHttp(options: AgentHttpOptions): AsyncGenerator<AgentStreamEvent> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) throw new Error('Global fetch is unavailable. Node.js 18 or newer is required.');
  const response = await fetchImpl(`${normalizeBaseUrl(options.baseUrl)}/api/agent/stream`, {
    method: 'POST',
    headers: requestHeaders(options.apiKey, options.requestId),
    body: JSON.stringify({ input: options.input, sessionId: options.sessionId }),
  });
  if (!response.ok) throw new Error(`agent_stream_failed: ${response.status} ${await response.text()}`);
  if (!response.body) throw new Error('agent_stream_unavailable: response body is missing');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const event = parseStreamLine(line);
      if (event) yield event;
    }
  }

  const finalEvent = parseStreamLine(buffer);
  if (finalEvent) yield finalEvent;
}

function requestHeaders(apiKey?: string, requestId?: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    ...(requestId ? { 'x-request-id': requestId } : {}),
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) throw new Error('baseUrl is required.');
  return normalized;
}

function parseStreamLine(line: string): AgentStreamEvent | undefined {
  if (!line.trim()) return undefined;
  const event = JSON.parse(line) as { type?: unknown };
  if (event.type !== 'progress' && event.type !== 'final') {
    throw new Error(`agent_stream_invalid_event: ${String(event.type)}`);
  }
  return event as AgentStreamEvent;
}
