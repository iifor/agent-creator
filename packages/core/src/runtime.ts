import { DefaultExecutor, DefaultGuard, DefaultPlanner, InMemoryProvider, NoopTraceProvider } from './defaults.js';
import { createOpenAICompatibleProvider, normalizeModelConfig } from './openAICompatibleProvider.js';
import { SkillRegistry, toolToSkill } from './skillRegistry.js';
import type {
  Agent,
  AgentContext,
  AgentInput,
  AgentOutput,
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

  constructor(options: CreateAgentOptions) {
    const modelConfig = normalizeModelConfig(options.model);
    this.model = createOpenAICompatibleProvider(modelConfig);
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

  build(): Agent {
    assertFunction(this.memory, 'get', 'memory');
    assertFunction(this.memory, 'append', 'memory');
    assertFunction(this.planner, 'plan', 'planner');
    assertFunction(this.executor, 'execute', 'executor');
    assertFunction(this.model, 'generate', 'model');
    assertFunction(this.guard, 'check', 'guard');
    assertFunction(this.trace, 'start', 'trace');

    const runtime = {
      skills: this.skills,
      memory: this.memory,
      planner: this.planner,
      executor: this.executor,
      model: this.model,
      guard: this.guard,
      trace: this.trace,
    };

    return {
      async run(input: AgentInput): Promise<AgentOutput> {
        if (!input.input?.trim()) throw new Error('input is required.');
        const traceId = createId('trace');
        const traceRun = runtime.trace.start(input, traceId);
        try {
          const memory = input.sessionId ? await runtime.memory.get(input.sessionId) : [];
          const context: AgentContext = {
            input,
            memory,
            availableSkills: runtime.skills.list().map(({ name, description }) => ({ name, description })),
          };
          const guardResult = await runtime.guard.check(context);
          if (!guardResult.allowed) {
            const output = {
              success: false,
              intent: 'safe_redirect',
              message: guardResult.reason ?? 'The request was blocked by the guard.',
              traceId,
            };
            await traceRun.end(output);
            return output;
          }
          if (input.sessionId) {
            await runtime.memory.append(input.sessionId, { role: 'user', content: input.input, at: new Date().toISOString() });
          }
          const plan = await runtime.planner.plan(context);
          await traceRun.append({ type: 'plan.created', data: plan });
          const output = await runtime.executor.execute(plan, {
            input,
            traceId,
            memory: runtime.memory,
            model: runtime.model,
            skills: runtime.skills,
            trace: traceRun,
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
          return output;
        } catch (error) {
          const output = {
            success: false,
            intent: 'runtime_error',
            message: 'Agent execution failed.',
            errors: [error instanceof Error ? error.message : String(error)],
            traceId,
          };
          await traceRun.end(output);
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
