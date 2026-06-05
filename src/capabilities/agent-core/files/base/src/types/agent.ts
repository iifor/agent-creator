import type { AgentConfig } from './config.js';
import type { ToolDefinition } from './tool.js';
import type { ModelProvider } from '../model/modelProvider.js';
import type { MemoryStore } from '../memory/memoryManager.js';
import type { ToolRegistry } from '../agent/toolRegistry.js';
import type { TraceLogger } from '../traces/traceLogger.js';

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

export interface Agent {
  run(input: AgentInput): Promise<AgentOutput>;
  clearMemory(sessionId?: string): void | Promise<void>;
  getMemory(sessionId: string): Promise<unknown[]> | unknown[];
  tools: ToolRegistry;
}

export interface AgentOptions {
  config?: AgentConfig;
  tools?: ToolDefinition[];
  toolRegistry?: ToolRegistry;
  modelProvider?: ModelProvider;
  memoryStore?: MemoryStore;
  createTraceLogger?: TraceLoggerFactory;
}

export interface AgentRuntime {
  config: AgentConfig;
  toolRegistry: ToolRegistry;
  modelProvider: ModelProvider;
  memoryStore: MemoryStore;
  createTraceLogger: TraceLoggerFactory;
}

export type TraceLoggerFactory = (
  config: AgentConfig['trace'],
  traceId: string,
  requestId: string,
  userInput: string,
) => TraceLogger;
