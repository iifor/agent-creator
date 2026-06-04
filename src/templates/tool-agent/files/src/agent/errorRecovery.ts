import type { AgentOutput } from '../types/agent.js';

export interface RecoveryResult {
  recovered: boolean;
  output?: AgentOutput;
  retry?: boolean;
  fallback?: boolean;
  reason: string;
}

export function recoverError(error: unknown): RecoveryResult {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('tool_not_found')) return { recovered: true, reason: message, fallback: true };
  if (message.startsWith('tool_input_invalid')) return { recovered: true, reason: message, fallback: true };
  if (message.startsWith('tool_output_invalid')) return { recovered: true, reason: message, fallback: true };
  return { recovered: true, reason: `unknown_error: ${message}`, fallback: true };
}
