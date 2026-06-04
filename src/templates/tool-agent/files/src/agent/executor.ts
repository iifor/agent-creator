import type { AgentOutput, AgentPlan } from '../types/agent.js';
import type { TraceLogger } from '../traces/traceLogger.js';
import { getToolRegistry } from './toolRegistry.js';
import { recoverError } from './errorRecovery.js';
import { mockLLM } from '../model/mockLLM.js';

export async function executePlan(plan: AgentPlan, traceId: string, sessionId: string | undefined, trace: TraceLogger): Promise<AgentOutput> {
  for (const step of plan.steps) {
    try {
      if (step.type === 'guard') {
        return { success: false, intent: 'safe_redirect', message: 'Sorry, I cannot complete that request safely.', traceId };
      }
      if (step.type === 'tool') {
        trace.append({ toolCalls: [{ name: step.name, input: step.input }] });
        const data = await getToolRegistry().executeTool(step.name, step.input, { traceId, sessionId });
        trace.append({ toolResults: [{ name: step.name, data }] });
        return { success: true, intent: 'call_tool', message: `Tool ${step.name} executed successfully.`, data, traceId };
      }
      if (step.type === 'llm') {
        const result = await mockLLM.generate({ task: step.name, input: step.input });
        return { success: true, intent: step.name, message: result.text, data: result.data, traceId };
      }
    } catch (error) {
      const recovered = recoverError(error);
      if (recovered.output) return { ...recovered.output, traceId };
      return { success: false, intent: step.name, message: recovered.reason, errors: [recovered.reason], traceId };
    }
  }
  return { success: false, intent: 'unknown', message: 'No executable plan steps found.', traceId };
}
