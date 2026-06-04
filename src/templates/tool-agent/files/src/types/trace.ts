import type { AgentIntent, AgentOutput, AgentPlan } from './agent.js';

export interface TraceRecord {
  traceId: string;
  requestId: string;
  startedAt: string;
  endedAt?: string;
  latencyMs?: number;
  userInput: string;
  detectedIntent?: AgentIntent;
  plan?: AgentPlan;
  toolCalls?: unknown[];
  toolResults?: unknown[];
  finalOutput?: AgentOutput;
  errors?: unknown[];
}
