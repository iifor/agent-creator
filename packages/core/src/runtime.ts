import { DefaultExecutor, DefaultGuard, DefaultPlanner, InMemoryProvider, NoopTraceProvider } from './defaults.js';
import { createOpenAICompatibleProvider, normalizeModelConfig } from './openAICompatibleProvider.js';
import { createWebhookService, NoopWebhookService, type WebhookService } from './skills/webhook.js';
import { SkillRegistry, toolToSkill } from './skillRegistry.js';
import type {
  Agent,
  AgentContext,
  AgentError,
  AgentInput,
  AgentOutput,
  AgentProgressEvent,
  AgentProgressHandler,
  CreateAgentOptions,
  Executor,
  Guard,
  MemoryProvider,
  ModelProvider,
  Planner,
  Skill,
  TraceProvider,
} from './types.js';

export class AgentBuilder {
  private readonly skills = new SkillRegistry();
  private memory: MemoryProvider = new InMemoryProvider();
  private planner: Planner = new DefaultPlanner();
  private executor: Executor = new DefaultExecutor();
  private model: ModelProvider;
  private guard: Guard = new DefaultGuard();
  private trace: TraceProvider = new NoopTraceProvider();
  private webhook: WebhookService;

  constructor(options: CreateAgentOptions) {
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
    assertFunction(this.trace, 'start', 'trace');
    assertFunction(this.webhook, 'notify', 'webhook');

    const runtime = {
      skills: this.skills,
      memory: this.memory,
      planner: this.planner,
      executor: this.executor,
      model: this.model,
      guard: this.guard,
      trace: this.trace,
      webhook: this.webhook,
    };

    return {
      async run(input: AgentInput): Promise<AgentOutput> {
        if (!input.input?.trim()) throw new Error('input is required.');
        const traceId = createId('trace');
        const traceRun = runtime.trace.start(input, traceId);
        const progress = progressEmitter(input, traceId);
        try {
          await progress({ type: 'agent.started', message: 'Agent started.', data: { input: input.input } });
          const memory = input.sessionId ? await runtime.memory.get(input.sessionId) : [];
          const context: AgentContext = {
            input,
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
          await progress({ type: 'guard.started', message: 'Checking guard.' });
          const guardResult = await runtime.guard.check(context);
          if (!guardResult.allowed) {
            const output = {
              success: false,
              intent: 'safe_redirect',
              message: guardResult.reason ?? 'The request was blocked by the guard.',
              errorDetails: [{ code: 'guard_blocked', message: guardResult.reason ?? 'The request was blocked by the guard.' }],
              traceId,
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
          await progress({ type: 'planner.started', message: 'Planning next steps.' });
          const plan = await runtime.planner.plan(context);
          await traceRun.append({ type: 'plan.created', data: plan });
          await progress({ type: 'plan.created', message: 'Plan created.', data: plan });
          const output = await runtime.executor.execute(plan, {
            input,
            traceId,
            memory: runtime.memory,
            model: runtime.model,
            skills: runtime.skills,
            trace: traceRun,
            webhook: runtime.webhook,
            emitProgress: progress,
          });
          if (input.sessionId) {
            await runtime.memory.append(input.sessionId, {
              role: 'agent',
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
          };
          await traceRun.append({ type: 'agent.error', data: errorDetail });
          await traceRun.end(output);
          await progress({ type: 'agent.failed', message: 'Agent execution failed.', data: output });
          return output;
        }
      },
    };
  }
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
  if (message.startsWith('skill_input_invalid')) return 'skill_input_invalid';
  if (message.startsWith('skill_output_invalid')) return 'skill_output_invalid';
  if (message.startsWith('model_request_failed')) return 'model_request_failed';
  if (message.startsWith('model_response_invalid')) return 'model_response_invalid';
  return 'runtime_error';
}

function progressEmitter(input: AgentInput, traceId: string) {
  const handler = input.metadata?.onProgress;
  return async (event: Omit<AgentProgressEvent, 'traceId' | 'at'>) => {
    if (typeof handler !== 'function') return;
    await (handler as AgentProgressHandler)({
      ...event,
      traceId,
      at: new Date().toISOString(),
    });
  };
}
