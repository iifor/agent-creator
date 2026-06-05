import type { AgentOutput, AgentPlan, AgentRuntime } from '../types/agent.js';
import type { TraceLogger } from '../traces/traceLogger.js';
import { recoverError } from './errorRecovery.js';

export async function executePlan(plan: AgentPlan, traceId: string, sessionId: string | undefined, trace: TraceLogger, runtime: AgentRuntime): Promise<AgentOutput> {
  for (const step of plan.steps) {
    try {
      if (step.type === 'guard') {
        return { success: false, intent: 'safe_redirect', message: 'Sorry, I cannot complete that request safely.', traceId };
      }
      if (step.type === 'tool') {
        trace.append({ toolCalls: [{ name: step.name, input: step.input }] });
        const data = await runtime.toolRegistry.executeTool(step.name, step.input, { traceId, sessionId });
        trace.append({ toolResults: [{ name: step.name, data }] });
        return { success: true, intent: 'call_tool', message: `Tool ${step.name} executed successfully.`, data, traceId };
      }
      if (step.type === 'llm') {
        const memory = sessionId ? await runtime.memoryStore.getMessages(sessionId) : [];
        const result = await runtime.modelProvider.generate({ task: step.name, input: step.input, memory });
        return { success: true, intent: step.name, message: result.text, data: result.data, traceId };
      }
    } catch (error) {
      const recovered = recoverError(error);
      return { success: false, intent: step.name, message: recovered.reason, errors: [recovered.reason], traceId };
    }
  }
  return { success: false, intent: 'unknown', message: 'No executable plan steps found.', traceId };
}
