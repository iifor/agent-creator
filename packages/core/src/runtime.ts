import {
  DefaultExecutor,
  DefaultGuard,
  DefaultPlanner,
  DefaultSkillAuthorizer,
  InMemoryProvider,
  NoopTraceProvider,
} from './defaults.js';
import { createOpenAICompatibleProvider, normalizeModelConfig } from './openAICompatibleProvider.js';
import { createWebhookService, NoopWebhookService, type WebhookService } from './skills/webhook.js';
import { SkillRegistry, toolToSkill } from './skillRegistry.js';
import type {
  Agent,
  AgentContext,
  AgentError,
  AgentInput,
  AgentOutput,
  AgentPlan,
  AgentProgressEvent,
  AgentProgressHandler,
  AgentSkillInvocation,
  CreateAgentOptions,
  Executor,
  Guard,
  MemoryProvider,
  ModelProvider,
  Planner,
  Skill,
  SkillAuthorizer,
  TraceProvider,
} from './types.js';

export class AgentBuilder {
  private readonly skills = new SkillRegistry();
  private memory: MemoryProvider = new InMemoryProvider();
  private planner: Planner = new DefaultPlanner();
  private executor: Executor = new DefaultExecutor();
  private model: ModelProvider;
  private guard: Guard = new DefaultGuard();
  private skillAuthorizer?: SkillAuthorizer;
  private trace: TraceProvider = new NoopTraceProvider();
  private webhook: WebhookService;
  private memoryWasReplaced = false;

  constructor(private readonly options: CreateAgentOptions) {
    const modelConfig = normalizeModelConfig(options.model);
    this.model = createOpenAICompatibleProvider(modelConfig);
    this.webhook = options.webhook ? createWebhookService(options.webhook) : new NoopWebhookService();
    for (const tool of options.tools ?? []) this.skills.register(toolToSkill(tool));
    for (const tool of options.toolRegistry?.listTools() ?? []) {
      this.skills.register('execute' in tool ? tool : toolToSkill(tool));
    }
  }

  useSkill(skill: Skill): this {
    this.skills.register(skill);
    return this;
  }

  useMemory(memory: MemoryProvider): this {
    this.memory = memory;
    this.memoryWasReplaced = true;
    return this;
  }

  usePlanner(planner: Planner): this {
    this.planner = planner;
    return this;
  }

  useExecutor(executor: Executor): this {
    this.executor = executor;
    return this;
  }

  useModel(model: ModelProvider): this {
    this.model = model;
    return this;
  }

  useGuard(guard: Guard): this {
    this.guard = guard;
    return this;
  }

  useSkillAuthorizer(skillAuthorizer: SkillAuthorizer): this {
    this.skillAuthorizer = skillAuthorizer;
    return this;
  }

  useTrace(trace: TraceProvider): this {
    this.trace = trace;
    return this;
  }

  useWebhook(webhook: WebhookService): this {
    this.webhook = webhook;
    return this;
  }

  build(): Agent {
    assertFunction(this.memory, 'get', 'memory');
    assertFunction(this.memory, 'append', 'memory');
    assertFunction(this.planner, 'plan', 'planner');
    assertFunction(this.executor, 'execute', 'executor');
    assertFunction(this.model, 'generate', 'model');
    assertFunction(this.guard, 'check', 'guard');
    if (this.skillAuthorizer) assertFunction(this.skillAuthorizer, 'authorize', 'skillAuthorizer');
    assertFunction(this.trace, 'start', 'trace');
    assertFunction(this.webhook, 'notify', 'webhook');
    if (this.options.runtimeMode === 'production' && !this.memoryWasReplaced) {
      throw new Error('production_memory_required: register a persistent MemoryProvider with builder.useMemory().');
    }

    const runtime = {
      skills: this.skills,
      memory: this.memory,
      planner: this.planner,
      executor: this.executor,
      model: this.model,
      guard: this.guard,
      skillAuthorizer: new DefaultSkillAuthorizer(this.skillAuthorizer),
      trace: this.trace,
      webhook: this.webhook,
    };

    async function executeRun(
      input: AgentInput,
      directPlan?: AgentPlan,
      idempotencyKey?: string,
    ): Promise<AgentOutput> {
        if (!input.input?.trim()) throw new Error('input is required.');
        const traceId = createId('trace');
        const requestId = input.requestId?.trim() || createId('request');
        const normalizedInput = { ...input, requestId };
        const traceRun = runtime.trace.start(normalizedInput, traceId);
        const progress = progressEmitter(normalizedInput, traceId, requestId);
        try {
          await progress({ type: 'agent.started', message: 'Agent started.', data: { input: input.input } });
          const memory = input.sessionId ? await runtime.memory.get(input.sessionId) : [];
          const context: AgentContext = {
            input: normalizedInput,
            memory,
            availableSkills: runtime.skills.list().map(({ name, description, inputSchema, permission, tags }) => ({
              name,
              description,
              inputSchema,
              permission,
              tags,
            })),
            webhook: runtime.webhook,
            trace: traceRun,
          };
          const guardStartedAt = Date.now();
          await progress({ type: 'guard.started', message: 'Checking guard.' });
          const guardResult = await runtime.guard.check(context);
          await traceRun.append({
            type: 'guard.completed',
            data: {
              allowed: guardResult.allowed,
              durationMs: Date.now() - guardStartedAt,
              ...(guardResult.reason ? { reason: guardResult.reason } : {}),
            },
          });
          if (!guardResult.allowed) {
            const output = {
              success: false,
              intent: 'safe_redirect',
              message: guardResult.reason ?? 'The request was blocked by the guard.',
              errorDetails: [{ code: 'guard_blocked', message: guardResult.reason ?? 'The request was blocked by the guard.' }],
              traceId,
              requestId,
            };
            await progress({ type: 'guard.blocked', message: output.message });
            await traceRun.end(output);
            await progress({ type: 'agent.completed', message: 'Agent completed.', data: output });
            return output;
          }
          await progress({ type: 'guard.completed', message: 'Guard passed.' });
          if (input.sessionId) {
            await runtime.memory.append(input.sessionId, { role: 'user', content: input.input, at: new Date().toISOString() });
          }
          const plannerStartedAt = Date.now();
          await progress({ type: 'planner.started', message: 'Planning next steps.' });
          const plan = directPlan ?? await runtime.planner.plan(context);
          await traceRun.append({
            type: 'plan.created',
            data: {
              goal: plan.goal,
              durationMs: Date.now() - plannerStartedAt,
              steps: plan.steps.map((step) => ({
                type: step.type,
                ...(step.type === 'skill' ? { skill: step.skill } : {}),
                ...(step.type === 'model' ? { task: step.task } : {}),
              })),
            },
          });
          await progress({ type: 'plan.created', message: 'Plan created.', data: plan });
          const output = await runtime.executor.execute(plan, {
            input: normalizedInput,
            traceId,
            memory: runtime.memory,
            model: runtime.model,
            skills: runtime.skills,
            trace: traceRun,
            webhook: runtime.webhook,
            skillAuthorizer: runtime.skillAuthorizer,
            idempotencyKey,
            emitProgress: progress,
          });
          output.traceId = traceId;
          output.requestId = requestId;
          if (input.sessionId) {
            await runtime.memory.append(input.sessionId, {
              role: 'assistant',
              content: output.message,
              data: output.data,
              at: new Date().toISOString(),
            });
          }
          await traceRun.end(output);
          await progress({ type: 'agent.completed', message: 'Agent completed.', data: output });
          return output;
        } catch (error) {
          const errorDetail = errorToAgentError(error);
          const output = {
            success: false,
            intent: 'runtime_error',
            message: 'Agent execution failed.',
            errors: [errorDetail.message],
            errorDetails: [errorDetail],
            traceId,
            requestId,
          };
          await traceRun.append({ type: 'agent.error', data: errorDetail });
          await traceRun.end(output);
          await progress({ type: 'agent.failed', message: 'Agent execution failed.', data: output });
          return output;
        }
    }

    return {
      run(input: AgentInput): Promise<AgentOutput> {
        return executeRun(input);
      },
      invokeSkill(invocation: AgentSkillInvocation): Promise<AgentOutput> {
        const agentInput: AgentInput = {
          input: stringifyInvocationInput(invocation.input),
          requestId: invocation.requestId,
          userId: invocation.userId,
          sessionId: invocation.sessionId,
          metadata: invocation.metadata,
        };
        return executeRun(agentInput, {
          goal: `Execute ${invocation.skill}`,
          steps: [{ type: 'skill', skill: invocation.skill, input: invocation.input }],
        }, invocation.idempotencyKey);
      },
    };
  }

}

function stringifyInvocationInput(input: unknown): string {
  if (typeof input === 'string') return input;
  const serialized = JSON.stringify(input);
  return serialized ?? String(input);
}

export function createAgent(options: CreateAgentOptions): AgentBuilder {
  if (!options?.model) throw new Error('model configuration is required.');
  return new AgentBuilder(options);
}

function assertFunction(value: object, key: string, moduleName: string): void {
  if (typeof (value as Record<string, unknown>)[key] !== 'function') {
    throw new Error(`${moduleName}.${key} must be a function.`);
  }
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function errorToAgentError(error: unknown): AgentError {
  const message = error instanceof Error ? error.message : String(error);
  return { code: inferErrorCode(message), message };
}

function inferErrorCode(message: string): string {
  if (message.startsWith('skill_timeout')) return 'skill_timeout';
  if (message.startsWith('skill_not_found')) return 'skill_not_found';
  if (message.startsWith('skill_forbidden')) return 'skill_forbidden';
  if (message.startsWith('skill_input_invalid')) return 'skill_input_invalid';
  if (message.startsWith('skill_output_invalid')) return 'skill_output_invalid';
  if (message.startsWith('model_request_failed')) return 'model_request_failed';
  if (message.startsWith('model_response_invalid')) return 'model_response_invalid';
  return 'runtime_error';
}

function progressEmitter(input: AgentInput, traceId: string, requestId: string) {
  const handler = input.metadata?.onProgress;
  return async (event: Omit<AgentProgressEvent, 'traceId' | 'requestId' | 'at'>) => {
    if (typeof handler !== 'function') return;
    await (handler as AgentProgressHandler)({
      ...event,
      traceId,
      requestId,
      at: new Date().toISOString(),
    });
  };
}
