import type {
  AgentContext,
  AgentError,
  AgentOutput,
  AgentPlan,
  Executor,
  ExecutorContext,
  Guard,
  GuardResult,
  MemoryMessage,
  MemoryProvider,
  ModelProvider,
  Planner,
  Skill,
  TraceProvider,
  TraceRun,
  TraceEvent,
} from './types.js';

export interface InMemoryProviderOptions {
  maxMessagesPerSession?: number;
  maxSessions?: number;
  ttlMs?: number;
  now?: () => number;
}

export class InMemoryProvider implements MemoryProvider {
  private readonly sessions = new Map<string, { messages: MemoryMessage[]; touchedAt: number }>();

  constructor(private readonly options: InMemoryProviderOptions = {}) {}

  append(sessionId: string, message: MemoryMessage): void {
    this.pruneExpired();
    const current = this.sessions.get(sessionId)?.messages ?? [];
    const messages = [...current, message];
    const maxMessages = this.options.maxMessagesPerSession;
    const trimmed = maxMessages && maxMessages > 0 ? messages.slice(-maxMessages) : messages;
    this.sessions.delete(sessionId);
    this.sessions.set(sessionId, { messages: trimmed, touchedAt: this.now() });
    this.enforceMaxSessions();
  }

  get(sessionId: string): MemoryMessage[] {
    this.pruneExpired();
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    session.touchedAt = this.now();
    return [...session.messages];
  }

  clear(sessionId?: string): void {
    if (sessionId) this.sessions.delete(sessionId);
    else this.sessions.clear();
  }

  pruneExpired(): void {
    const ttlMs = this.options.ttlMs;
    if (!ttlMs || ttlMs <= 0) return;
    const expiresBefore = this.now() - ttlMs;
    for (const [sessionId, session] of this.sessions) {
      if (session.touchedAt < expiresBefore) this.sessions.delete(sessionId);
    }
  }

  size(): number {
    this.pruneExpired();
    return this.sessions.size;
  }

  private enforceMaxSessions(): void {
    const maxSessions = this.options.maxSessions;
    if (!maxSessions || maxSessions <= 0) return;
    while (this.sessions.size > maxSessions) {
      const oldest = this.sessions.keys().next().value as string | undefined;
      if (!oldest) break;
      this.sessions.delete(oldest);
    }
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }
}

export interface BasicGuardOptions {
  maxInputLength?: number;
  blocklist?: Array<string | RegExp>;
  allowlist?: Array<string | RegExp>;
}

export class BasicGuard implements Guard {
  constructor(private readonly options: BasicGuardOptions = {}) {}

  check(context: AgentContext): GuardResult {
    const input = context.input.input;
    if (this.options.maxInputLength && input.length > this.options.maxInputLength) {
      return { allowed: false, reason: `Input exceeds max length of ${this.options.maxInputLength}.` };
    }
    if (this.options.allowlist?.length && !matchesAny(input, this.options.allowlist)) {
      return { allowed: false, reason: 'Input is not allowed by the configured allowlist.' };
    }
    if (this.options.blocklist?.length && matchesAny(input, this.options.blocklist)) {
      return { allowed: false, reason: 'Input was blocked by the configured blocklist.' };
    }
    return { allowed: true };
  }
}

export class DefaultGuard extends BasicGuard {}

export interface DefaultPlannerOptions {
  model?: ModelProvider;
  modelDrivenSkillSelection?: boolean;
}

export class DefaultPlanner implements Planner {
  constructor(private readonly options: DefaultPlannerOptions = {}) {}

  async plan(context: AgentContext): Promise<AgentPlan> {
    const requestedSkill = findRequestedSkill(context);
    if (requestedSkill) {
      return {
        goal: `Execute ${requestedSkill}`,
        steps: [{ type: 'skill', skill: requestedSkill, input: context.input.metadata?.skillInput ?? context.input.input }],
      };
    }
    if (this.options.modelDrivenSkillSelection && this.options.model && context.availableSkills.length > 0) {
      const selected = await selectSkillWithModel(this.options.model, context);
      if (selected) {
        return {
          goal: `Execute ${selected}`,
          steps: [{ type: 'skill', skill: selected, input: context.input.metadata?.skillInput ?? context.input.input }],
        };
      }
    }
    return {
      goal: 'Generate a response',
      steps: [{ type: 'model', task: 'generate_response', input: context.input.input }],
    };
  }
}

export class ModelSkillPlanner extends DefaultPlanner {
  constructor(model: ModelProvider) {
    super({ model, modelDrivenSkillSelection: true });
  }
}

export class DefaultExecutor implements Executor {
  async execute(plan: AgentPlan, context: ExecutorContext): Promise<AgentOutput> {
    let lastOutput: AgentOutput | undefined;

    for (const step of plan.steps) {
      if (step.type === 'response') {
        lastOutput = { success: true, intent: 'response', message: step.message, data: step.data, traceId: context.traceId };
      } else if (step.type === 'skill') {
        await context.trace.append({ type: 'skill.start', data: { name: step.skill } });
        await context.emitProgress({ type: 'skill.started', message: `Executing ${step.skill}.`, data: { skill: step.skill } });
        const skill = context.skills.get(step.skill);
        const data = await executeSkillWithPolicy(skill, step.input, context);
        await context.emitProgress({ type: 'skill.completed', message: `Finished ${step.skill}.`, data: { skill: step.skill } });
        await context.trace.append({ type: 'skill.end', data: { name: step.skill } });
        lastOutput = {
          success: true,
          intent: 'skill',
          message: `${step.skill} completed.`,
          data,
          traceId: context.traceId,
        };
      } else {
        const memory = context.input.sessionId ? await context.memory.get(context.input.sessionId) : [];
        await context.emitProgress({ type: 'model.started', message: 'Calling model.', data: { task: step.task } });
        const result = await context.model.generate({ task: step.task, input: step.input, memory });
        await context.emitProgress({ type: 'model.completed', message: 'Model call completed.', data: { task: step.task } });
        lastOutput = {
          success: true,
          intent: step.task,
          message: result.text,
          data: result.data,
          traceId: context.traceId,
        };
      }
    }

    return lastOutput ?? {
      success: false,
      intent: 'empty_plan',
      message: 'No executable plan steps.',
      errorDetails: [{ code: 'empty_plan', message: 'No executable plan steps.' }],
      traceId: context.traceId,
    };
  }
}

export class NoopTraceProvider implements TraceProvider {
  start(): TraceRun {
    return {
      append() {},
      end() {},
    };
  }
}

export class ConsoleTraceProvider implements TraceProvider {
  constructor(private readonly logger: Pick<Console, 'log' | 'error'> = console) {}

  start(input: { input: string }, traceId: string): TraceRun {
    this.logger.log(`[${traceId}] trace.start`, { input: input.input });
    return {
      append: (event) => {
        this.logger.log(`[${traceId}] ${event.type}`, event.data);
      },
      end: (output) => {
        const log = output.success ? this.logger.log : this.logger.error;
        log.call(this.logger, `[${traceId}] trace.end`, output);
      },
    };
  }
}

export interface StoredTraceRun {
  traceId: string;
  input: unknown;
  events: TraceEvent[];
  output?: AgentOutput;
  startedAt: string;
  endedAt?: string;
}

export class InMemoryTraceProvider implements TraceProvider {
  private readonly runs = new Map<string, StoredTraceRun>();

  start(input: unknown, traceId: string): TraceRun {
    const run: StoredTraceRun = {
      traceId,
      input,
      events: [],
      startedAt: new Date().toISOString(),
    };
    this.runs.set(traceId, run);
    return {
      append: (event) => {
        run.events.push({ ...event, at: new Date().toISOString() });
      },
      end: (output) => {
        run.output = output;
        run.endedAt = new Date().toISOString();
      },
    };
  }

  get(traceId: string): StoredTraceRun | undefined {
    return this.runs.get(traceId);
  }

  list(): StoredTraceRun[] {
    return [...this.runs.values()];
  }

  clear(traceId?: string): void {
    if (traceId) this.runs.delete(traceId);
    else this.runs.clear();
  }
}

function findRequestedSkill(context: AgentContext): string | undefined {
  const explicit = context.input.metadata?.skill;
  if (typeof explicit === 'string' && context.availableSkills.some((skill) => skill.name === explicit)) return explicit;
  if (context.availableSkills.length === 1) return context.availableSkills[0]?.name;
  return context.availableSkills.find((skill) => context.input.input.startsWith(`${skill.name}:`))?.name;
}

async function selectSkillWithModel(model: ModelProvider, context: AgentContext): Promise<string | undefined> {
  const skills = context.availableSkills.map((skill) => ({
    name: skill.name,
    description: skill.description,
  }));
  const result = await model.generate({
    task: 'select_skill',
    input: {
      instruction: 'Choose the best skill for the user input. Return only a skill name, or "none".',
      userInput: context.input.input,
      skills,
    },
    memory: context.memory,
  });
  const selected = result.text.trim().replace(/^["']|["']$/g, '');
  if (!selected || selected.toLowerCase() === 'none') return undefined;
  return context.availableSkills.some((skill) => skill.name === selected) ? selected : undefined;
}

async function executeSkillWithPolicy(skill: Skill, input: unknown, context: ExecutorContext): Promise<unknown> {
  const maxAttempts = Math.max(1, (skill.retry ?? 0) + 1);
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await withTimeout(
        context.skills.execute(skill.name, input, {
          traceId: context.traceId,
          sessionId: context.input.sessionId,
          userId: context.input.userId,
          metadata: context.input.metadata,
          webhook: context.webhook,
          trace: context.trace,
          emitProgress: context.emitProgress,
        }),
        skill.timeoutMs,
        `skill_timeout: ${skill.name}`,
      );
    } catch (error) {
      lastError = error;
      await context.trace.append({
        type: 'skill.error',
        data: { name: skill.name, attempt, error: errorToAgentError(error) },
      });
      if (attempt === maxAttempts) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number | undefined, message: string): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function matchesAny(input: string, patterns: Array<string | RegExp>): boolean {
  return patterns.some((pattern) => typeof pattern === 'string' ? input.includes(pattern) : pattern.test(input));
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
  return 'skill_execution_failed';
}
