import type { AnalyzedInput, AgentIntent } from '../types/agent.js';

export function routeIntent(input: AnalyzedInput): AgentIntent {
  if (input.missingFields.includes('input')) {
    return { name: 'ask_clarification', confidence: 1, reason: 'Input is empty.' };
  }
  if (input.riskFlags.length > 0) {
    return { name: 'safe_redirect', confidence: 1, reason: 'Input matched blocked keywords.' };
  }
  if (typeof input.detectedEntities.possibleTool === 'string') {
    return { name: 'call_tool', confidence: 0.86, reason: 'Input indicates a tool call.' };
  }
  return { name: 'generate_response', confidence: 0.7, reason: 'Default response intent.' };
}
