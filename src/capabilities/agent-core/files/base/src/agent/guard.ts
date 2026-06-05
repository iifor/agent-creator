import type { AgentIntent, AnalyzedInput } from '../types/agent.js';

export interface GuardResult {
  allowed: boolean;
  reason?: string;
  action: 'continue' | 'safe_redirect';
  warnings?: string[];
}

const allowedIntents = ['generate_response', 'call_tool', 'ask_clarification', 'safe_redirect'];

export function runGuard(analyzedInput: AnalyzedInput, intent: AgentIntent): GuardResult {
  if (!allowedIntents.includes(intent.name)) {
    return { allowed: false, reason: 'Intent is not allowed.', action: 'safe_redirect' };
  }
  if (analyzedInput.riskFlags.length > 0) {
    return {
      allowed: false,
      reason: `Blocked keyword matched: ${analyzedInput.riskFlags.join(', ')}`,
      action: 'safe_redirect',
      warnings: analyzedInput.riskFlags,
    };
  }
  return { allowed: true, action: 'continue' };
}
