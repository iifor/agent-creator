import type { AgentContext } from './types.js';
import type { StructuredSkillPlanner, StructuredPlannerAction } from './structuredSkillPlanner.js';

export interface StructuredPlannerEvaluationCase {
  name: string;
  context: AgentContext;
  expectedAction: StructuredPlannerAction['action'];
  expectedSkill?: string;
}

export interface StructuredPlannerEvaluationMetrics {
  total: number;
  correct: number;
  accuracy: number;
  refused: number;
  refusalRate: number;
  averageLatencyMs: number;
}

export async function evaluateStructuredSkillPlanner(
  planner: StructuredSkillPlanner,
  cases: StructuredPlannerEvaluationCase[],
): Promise<StructuredPlannerEvaluationMetrics> {
  let correct = 0;
  let refused = 0;
  let totalLatencyMs = 0;
  for (const evaluationCase of cases) {
    const decision = await planner.decide(evaluationCase.context);
    totalLatencyMs += decision.latencyMs;
    if (!decision.accepted || decision.action.action === 'none') refused += 1;
    const actionMatches = decision.action.action === evaluationCase.expectedAction;
    const skillMatches = evaluationCase.expectedSkill === undefined
      || (decision.action.action === 'skill' && decision.action.skill === evaluationCase.expectedSkill);
    if (actionMatches && skillMatches) correct += 1;
  }
  const total = cases.length;
  return {
    total,
    correct,
    accuracy: total === 0 ? 0 : correct / total,
    refused,
    refusalRate: total === 0 ? 0 : refused / total,
    averageLatencyMs: total === 0 ? 0 : totalLatencyMs / total,
  };
}
