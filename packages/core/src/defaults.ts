import type {
  AgentContext,
  AgentOutput,
  AgentPlan,
  Executor,
  ExecutorContext,
  Guard,
  MemoryMessage,
  MemoryProvider,
  Planner,
  TraceProvider,
  TraceRun,
} from './types.js';

export class InMemoryProvider implements MemoryProvider {
  private readonly sessions = new Map<string, MemoryMessage[]>();

  append(sessionId: string, message: MemoryMessage): void {
    const messages = this.sessions.get(sessionId) ?? [];
    messages.push(message);
    this.sessions.set(sessionId, messages);
  }

  get(sessionId: string): MemoryMessage[] {
    return [...(this.sessions.get(sessionId) ?? [])];
  }

  clear(sessionId?: string): void {
    if (sessionId) this.sessions.delete(sessionId);
    else this.sessions.clear();
  }
}

export class DefaultGuard implements Guard {
  check(): { allowed: true } {
    return { allowed: true };
  }
}

export class DefaultPlanner implements Planner {
  plan(context: AgentContext): AgentPlan {
    const requestedSkill = findRequestedSkill(context);
    if (requestedSkill) {
      return {
        goal: `Execute ${requestedSkill}`,
        steps: [{ type: 'skill', skill: requestedSkill, input: context.input.metadata?.skillInput ?? context.input.input }],
      };
    }
    return {
      goal: 'Generate a response',
      steps: [{ type: 'model', task: 'generate_response', input: context.input.input }],
    };
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
        const data = await context.skills.execute(step.skill, step.input, {
          traceId: context.traceId,
          sessionId: context.input.sessionId,
          userId: context.input.userId,
          metadata: context.input.metadata,
        });
        lastOutput = {
          success: true,
          intent: 'skill',
          message: `Skill ${step.skill} executed successfully.`,
          data,
          traceId: context.traceId,
        };
      } else {
        const memory = context.input.sessionId ? await context.memory.get(context.input.sessionId) : [];
        const result = await context.model.generate({ task: step.task, input: step.input, memory });
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
      message: 'The planner returned no executable steps.',
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

function findRequestedSkill(context: AgentContext): string | undefined {
  const explicit = context.input.metadata?.skill;
  if (typeof explicit === 'string' && context.availableSkills.some((skill) => skill.name === explicit)) return explicit;
  if (context.availableSkills.length === 1) return context.availableSkills[0]?.name;
  return context.availableSkills.find((skill) => context.input.input.startsWith(`${skill.name}:`))?.name;
}
