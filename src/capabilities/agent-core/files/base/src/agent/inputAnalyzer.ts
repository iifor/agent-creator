import config from '../../agent.config.js';
import type { AgentInput, AnalyzedInput } from '../types/agent.js';

export function analyzeInput(input: AgentInput): AnalyzedInput {
  const normalizedInput = input.input.trim();
  const detectedEntities: Record<string, unknown> = {};
  const missingFields: string[] = [];
  const riskFlags: string[] = [];

  if (!normalizedInput) missingFields.push('input');
  if (/天气|weather/i.test(normalizedInput)) detectedEntities.possibleTool = 'weather.query';
  if (/计算|calculate|[+\-*/()]/i.test(normalizedInput)) detectedEntities.possibleTool = 'math.calculate';

  for (const keyword of config.constraints.blockedKeywords) {
    if (normalizedInput.includes(keyword)) riskFlags.push(keyword);
  }

  return { rawInput: input.input, normalizedInput, detectedEntities, missingFields, riskFlags };
}
