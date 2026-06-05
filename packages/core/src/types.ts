import type { z } from 'zod';

export interface OpenAICompatibleModelConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

export interface CreateAgentOptions {
  model: OpenAICompatibleModelConfig;
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

export interface AgentOutput {
  success: boolean;
  intent: string;
  message: string;
  data?: unknown;
  warnings?: string[];
  errors?: string[];
  traceId?: string;
}

export interface SkillContext {
  traceId: string;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface Skill<I = unknown, O = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  outputSchema: z.ZodType<O>;
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
}

export interface ModelProvider {
  generate(input: ModelGenerateInput): Promise<ModelGenerateOutput>;
}

export interface AgentContext {
  input: AgentInput;
  memory: MemoryMessage[];
  availableSkills: ReadonlyArray<Pick<Skill, 'name' | 'description'>>;
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
