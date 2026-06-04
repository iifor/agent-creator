export interface AgentInput {
  input: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface AnalyzedInput {
  rawInput: string;
  normalizedInput: string;
  detectedEntities: Record<string, unknown>;
  missingFields: string[];
  riskFlags: string[];
}

export interface AgentIntent {
  name: 'generate_response' | 'call_tool' | 'ask_clarification' | 'safe_redirect';
  confidence: number;
  reason?: string;
}

export interface AgentPlan {
  goal: string;
  steps: AgentPlanStep[];
}

export interface AgentPlanStep {
  id: string;
  type: 'llm' | 'tool' | 'memory' | 'guard';
  name: string;
  input: unknown;
  retry?: number;
  timeoutMs?: number;
}

export interface AgentOutput {
  success: boolean;
  intent: string;
  message: string;
  data?: unknown;
  warnings?: string[];
  errors?: string[];
  traceId?: string;
}

export interface AgentContext {
  input: AgentInput;
  analyzedInput: AnalyzedInput;
  intent: AgentIntent;
  availableTools: string[];
}
