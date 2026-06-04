import type { AgentContext, AgentPlan } from '../types/agent.js';
import { createId } from '../utils/id.js';

export function createPlan(context: AgentContext): AgentPlan {
  if (context.intent.name === 'safe_redirect') {
    return { goal: 'Return safe redirect', steps: [{ id: createId('step'), type: 'guard', name: 'safe_redirect', input: {} }] };
  }
  if (context.intent.name === 'ask_clarification') {
    return { goal: 'Ask clarification', steps: [{ id: createId('step'), type: 'llm', name: 'ask_clarification', input: context.input.input }] };
  }
  if (context.intent.name === 'call_tool') {
    const toolName = String(context.analyzedInput.detectedEntities.possibleTool);
    const input = toolName === 'math.calculate'
      ? { expression: extractExpression(context.analyzedInput.normalizedInput) }
      : { location: extractLocation(context.analyzedInput.normalizedInput), date: 'tomorrow' };
    return { goal: `Call ${toolName} tool`, steps: [{ id: createId('step'), type: 'tool', name: toolName, input }] };
  }
  return { goal: 'Generate response', steps: [{ id: createId('step'), type: 'llm', name: 'generate_response', input: context.input.input }] };
}

function extractExpression(input: string): string {
  const match = input.match(/[0-9\s+\-*/().]+/);
  return match?.[0]?.trim() || '1 + 1';
}

function extractLocation(input: string): string {
  const words = input.split(/\s+/).filter(Boolean);
  return words.find((word) => !/天气|weather|明天|tomorrow/i.test(word)) || 'Tokyo';
}
