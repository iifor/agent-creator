import config from '../../agent.config.js';
import type { AgentInput, AgentOutput, AgentContext } from '../types/agent.js';
import { analyzeInput } from './inputAnalyzer.js';
import { routeIntent } from './intentRouter.js';
import { runGuard } from './guard.js';
import { createPlan } from './planner.js';
import { executePlan } from './executor.js';
import { validateOutput } from './outputValidator.js';
import { createTraceLogger } from '../traces/traceLogger.js';
import { createId } from '../utils/id.js';
import { getToolRegistry } from './toolRegistry.js';

export async function runAgent(input: AgentInput): Promise<AgentOutput> {
  const traceId = createId('trace');
  const requestId = createId('req');
  const trace = createTraceLogger(config.trace, traceId, requestId, input.input);

  try {
    const analyzedInput = analyzeInput(input);
    const intent = routeIntent(analyzedInput);
    trace.append({ detectedIntent: intent });

    const guard = runGuard(analyzedInput, intent);
    const effectiveIntent = guard.allowed ? intent : { name: 'safe_redirect' as const, confidence: 1, reason: guard.reason };

    const context: AgentContext = {
      input,
      analyzedInput,
      intent: effectiveIntent,
      availableTools: getToolRegistry().listTools().map((tool) => tool.name),
    };

    const plan = createPlan(context);
    trace.append({ plan });
    const output = await executePlan(plan, traceId, input.sessionId, trace);
    const validated = validateOutput(output, traceId);
    trace.end(validated);
    return validated;
  } catch (error) {
    const fallback = validateOutput({
      success: false,
      intent: 'unknown_error',
      message: 'Agent recovered from an unexpected error.',
      errors: [error instanceof Error ? error.message : String(error)],
      traceId,
    }, traceId);
    trace.append({ errors: [fallback.errors] });
    trace.end(fallback);
    return fallback;
  }
}
