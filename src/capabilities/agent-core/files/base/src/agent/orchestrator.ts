import type { AgentInput, AgentOutput, AgentContext, AgentRuntime } from '../types/agent.js';
import { analyzeInput } from './inputAnalyzer.js';
import { routeIntent } from './intentRouter.js';
import { runGuard } from './guard.js';
import { createPlan } from './planner.js';
import { executePlan } from './executor.js';
import { validateOutput } from './outputValidator.js';
import { createId } from '../utils/id.js';
import { runAgent as runDefaultAgent } from './runtime.js';

export async function runAgent(input: AgentInput): Promise<AgentOutput> {
  return runDefaultAgent(input);
}

export async function runAgentWithRuntime(input: AgentInput, runtime: AgentRuntime): Promise<AgentOutput> {
  const traceId = createId('trace');
  const requestId = createId('req');
  const trace = runtime.createTraceLogger(runtime.config.trace, traceId, requestId, input.input);

  try {
    if (input.sessionId) {
      await runtime.memoryStore.appendMessage(input.sessionId, { role: 'user', content: input.input, at: new Date().toISOString() });
    }
    const analyzedInput = analyzeInput(input);
    const intent = routeIntent(analyzedInput);
    trace.append({ detectedIntent: intent });

    const guard = runGuard(analyzedInput, intent);
    const effectiveIntent = guard.allowed ? intent : { name: 'safe_redirect' as const, confidence: 1, reason: guard.reason };

    const context: AgentContext = {
      input,
      analyzedInput,
      intent: effectiveIntent,
      availableTools: runtime.toolRegistry.listTools().map((tool) => tool.name),
    };

    const plan = createPlan(context);
    trace.append({ plan });
    const output = await executePlan(plan, traceId, input.sessionId, trace, runtime);
    const validated = validateOutput(output, traceId);
    if (input.sessionId) {
      await runtime.memoryStore.appendMessage(input.sessionId, { role: 'agent', content: validated.message, output: validated, at: new Date().toISOString() });
    }
    await trace.end(validated);
    return validated;
  } catch (error) {
    const errorOutput = validateOutput({
      success: false,
      intent: 'unknown_error',
      message: 'Agent recovered from an unexpected error.',
      errors: [error instanceof Error ? error.message : String(error)],
      traceId,
    }, traceId);
    trace.append({ errors: [errorOutput.errors] });
    await trace.end(errorOutput);
    return errorOutput;
  }
}
