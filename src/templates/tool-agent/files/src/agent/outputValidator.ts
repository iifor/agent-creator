import type { AgentOutput } from '../types/agent.js';
import { agentOutputSchema } from '../schemas/output.schema.js';

export function validateOutput(output: AgentOutput, traceId: string): AgentOutput {
  const parsed = agentOutputSchema.safeParse(output);
  if (parsed.success) return parsed.data;
  return {
    success: false,
    intent: output.intent || 'output_invalid',
    message: output.message || 'Output validation failed.',
    errors: [parsed.error.message],
    traceId,
  };
}
