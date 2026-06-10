import type { z } from 'zod';
import type { WebhookConfig, WebhookService } from './skills/webhook.js';

export interface OpenAICompatibleModelConfig {
  baseUrl: string;
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  headers?: Record<string, string>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object' | Record<string, unknown>;
}

export interface CreateAgentOptions {
  model: OpenAICompatibleModelConfig;
  webhook?: WebhookConfig;
  /** @deprecated Register skills with builder.useSkill(). */
  tools?: ToolDefinition[];
  /** @deprecated Register skills with builder.useSkill(). */
  toolRegistry?: ToolRegistryLike;
}

export interface AgentInput {
  input: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentProgressEvent {
  type: string;
  message: string;
  data?: unknown;
  traceId: string;
  at: string;
}

export type AgentProgressHandler = (event: AgentProgressEvent) => void | Promise<void>;

export interface AgentOutput {
  success: boolean;
  intent: string;
  message: string;
  data?: unknown;
  warnings?: string[];
  errors?: string[];
  errorDetails?: AgentError[];
  traceId?: string;
}

export type AgentErrorCode =
  | 'guard_blocked'
  | 'runtime_error'
  | 'skill_not_found'
  | 'skill_input_invalid'
  | 'skill_output_invalid'
  | 'skill_timeout'
  | 'skill_execution_failed'
  | 'model_request_failed'
  | 'model_response_invalid'
  | 'empty_plan';

export interface AgentError {
  code: AgentErrorCode | string;
  message: string;
  details?: unknown;
}

export interface SkillContext {
  traceId: string;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  webhook: WebhookService;
  trace: TraceRun;
  emitProgress?(event: Omit<AgentProgressEvent, 'traceId' | 'at'>): Promise<void>;
}

export interface Skill<I = unknown, O = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  outputSchema: z.ZodType<O>;
  permission?: 'public' | 'external_api' | 'user_private';
  timeoutMs?: number;
  retry?: number;
  tags?: string[];
  execute(input: I, context: SkillContext): Promise<O>;
}

export interface MemoryMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  data?: unknown;
  at: string;
}

export interface MemoryProvider {
  append(sessionId: string, message: MemoryMessage): void | Promise<void>;
  get(sessionId: string): MemoryMessage[] | Promise<MemoryMessage[]>;
  clear(sessionId?: string): void | Promise<void>;
}

export interface ModelGenerateInput {
  task: string;
  input: unknown;
  memory: MemoryMessage[];
}

export interface ModelGenerateOutput {
  text: string;
  data?: unknown;
  usage?: ModelUsage;
}

export interface ModelUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  raw?: unknown;
}

export interface ModelProvider {
  generate(input: ModelGenerateInput): Promise<ModelGenerateOutput>;
}

export interface AgentContext {
  input: AgentInput;
  memory: MemoryMessage[];
  availableSkills: ReadonlyArray<Pick<Skill, 'name' | 'description' | 'inputSchema' | 'permission' | 'tags'>>;
  webhook: WebhookService;
  trace: TraceRun;
}

export interface AgentPlan {
  goal: string;
  steps: AgentPlanStep[];
}

export type AgentPlanStep =
  | { type: 'model'; task: string; input: unknown }
  | { type: 'skill'; skill: string; input: unknown }
  | { type: 'response'; message: string; data?: unknown };

export interface Planner {
  plan(context: AgentContext): AgentPlan | Promise<AgentPlan>;
}

export interface ExecutorContext {
  input: AgentInput;
  traceId: string;
  memory: MemoryProvider;
  model: ModelProvider;
  skills: SkillRegistryLike;
  trace: TraceRun;
  webhook: WebhookService;
  emitProgress(event: Omit<AgentProgressEvent, 'traceId' | 'at'>): Promise<void>;
}

export interface Executor {
  execute(plan: AgentPlan, context: ExecutorContext): Promise<AgentOutput>;
}

export interface GuardResult {
  allowed: boolean;
  reason?: string;
}

export interface Guard {
  check(context: AgentContext): GuardResult | Promise<GuardResult>;
}

export interface TraceEvent {
  type: string;
  data?: unknown;
  at: string;
}

export interface TraceRun {
  append(event: Omit<TraceEvent, 'at'>): void | Promise<void>;
  end(output: AgentOutput): void | Promise<void>;
}

export interface TraceProvider {
  start(input: AgentInput, traceId: string): TraceRun;
}

export interface Agent {
  run(input: AgentInput): Promise<AgentOutput>;
}

export interface SkillRegistryLike {
  register(skill: Skill): void;
  has(name: string): boolean;
  get(name: string): Skill;
  list(): Skill[];
  execute(name: string, input: unknown, context: SkillContext): Promise<unknown>;
}

/** @deprecated Use Skill. */
export interface ToolDefinition<I = unknown, O = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  outputSchema: z.ZodType<O>;
  permission?: 'public' | 'external_api' | 'user_private';
  timeoutMs?: number;
  retry?: number;
  handler(input: I, context: SkillContext): Promise<O>;
}

/** @deprecated Use SkillRegistry. */
export interface ToolRegistryLike {
  listTools(): Array<ToolDefinition | Skill>;
}
