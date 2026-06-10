import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import {
  createAgent,
  BasicGuard,
  InMemoryProvider,
  InMemoryTraceProvider,
  ModelSkillPlanner,
  type AgentContext,
  type AgentProgressEvent,
  type Executor,
  type MemoryProvider,
  type Planner,
  type Skill,
} from '../src/index.js';

const modelConfig = {
  baseUrl: 'https://example.test/v1/',
  apiKey: 'test-key',
  model: 'test-model',
};

describe('agent builder', () => {
  it('requires explicit model configuration', () => {
    expect(() => createAgent(undefined as never)).toThrow('model configuration is required');
    expect(() => createAgent({ model: { ...modelConfig, baseUrl: ' ' } })).toThrow('model.baseUrl is required');
    expect(() => createAgent({ model: { ...modelConfig, apiKey: '' } })).toThrow('model.apiKey is required');
    expect(() => createAgent({ model: { ...modelConfig, model: '' } })).not.toThrow();
  });

  it('runs with baseUrl and apiKey only when a model provider is supplied', async () => {
    const agent = createAgent({
      model: {
        baseUrl: 'https://example.test/v1/',
        apiKey: 'test-key',
      },
    })
      .useModel({
        async generate() {
          return { text: 'minimal config works' };
        },
      })
      .build();

    await expect(agent.run({ input: 'hello' })).resolves.toMatchObject({
      success: true,
      message: 'minimal config works',
    });
  });

  it('runs with an overridden model provider', async () => {
    const agent = createAgent({ model: modelConfig })
      .useModel({
        async generate() {
          return { text: 'custom model' };
        },
      })
      .build();

    await expect(agent.run({ input: 'hello' })).resolves.toMatchObject({
      success: true,
      message: 'custom model',
    });
  });

  it('registers and executes a skill', async () => {
    const skill: Skill<{ value: string }, { value: string }> = {
      name: 'echo',
      description: 'Echo a value',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      async execute(input) {
        return input;
      },
    };
    const planner: Planner = {
      plan() {
        return { goal: 'echo', steps: [{ type: 'skill', skill: 'echo', input: { value: 'hello' } }] };
      },
    };
    const agent = createAgent({ model: modelConfig }).useSkill(skill).usePlanner(planner).build();

    await expect(agent.run({ input: 'echo' })).resolves.toMatchObject({
      success: true,
      intent: 'skill',
      data: { value: 'hello' },
    });
  });

  it('emits progress events for model execution when a listener is provided', async () => {
    const events: AgentProgressEvent[] = [];
    const agent = createAgent({ model: modelConfig })
      .useModel({
        async generate() {
          return { text: 'progress model' };
        },
      })
      .build();

    await expect(agent.run({
      input: 'hello',
      metadata: {
        onProgress(event: AgentProgressEvent) {
          events.push(event);
        },
      },
    })).resolves.toMatchObject({
      success: true,
      message: 'progress model',
    });

    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining([
      'agent.started',
      'guard.started',
      'plan.created',
      'model.started',
      'model.completed',
      'agent.completed',
    ]));
    expect(events.every((event) => event.traceId && event.at && event.message)).toBe(true);
    expect(events.map((event) => event.message)).toContain('Agent started.');
    expect(events.map((event) => event.message)).toContain('Plan created.');
  });

  it('lets skills emit custom progress events', async () => {
    const events: AgentProgressEvent[] = [];
    const skill: Skill<string, string> = {
      name: 'progress.echo',
      description: 'Echo with progress',
      inputSchema: z.string(),
      outputSchema: z.string(),
      async execute(input, context) {
        await context.emitProgress?.({
          type: 'custom.step',
          message: 'Custom skill step.',
          data: { input },
        });
        return input;
      },
    };
    const agent = createAgent({ model: modelConfig }).useSkill(skill).build();

    await expect(agent.run({
      input: 'hello',
      metadata: {
        onProgress(event: AgentProgressEvent) {
          events.push(event);
        },
      },
    })).resolves.toMatchObject({
      success: true,
      data: 'hello',
    });

    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining([
      'skill.started',
      'custom.step',
      'skill.completed',
    ]));
    expect(events.find((event) => event.type === 'custom.step')?.data).toEqual({ input: 'hello' });
  });

  it('rejects duplicate skill names', () => {
    const skill = {
      name: 'duplicate',
      description: 'Duplicate',
      inputSchema: z.unknown(),
      outputSchema: z.unknown(),
      async execute(input: unknown) {
        return input;
      },
    };
    const builder = createAgent({ model: modelConfig }).useSkill(skill);
    expect(() => builder.useSkill(skill)).toThrow('skill_already_registered');
  });

  it('uses the last registered singleton modules', async () => {
    const memoryCalls: string[] = [];
    const memory: MemoryProvider = {
      append(_sessionId, message) {
        memoryCalls.push(message.role);
      },
      get() {
        return [];
      },
      clear() {},
    };
    const executor: Executor = {
      async execute(_plan, context) {
        return { success: true, intent: 'custom', message: context.input.input, traceId: context.traceId };
      },
    };
    const agent = createAgent({ model: modelConfig })
      .useMemory(memory)
      .usePlanner({ plan: () => ({ goal: 'custom', steps: [] }) })
      .useExecutor(executor)
      .build();

    await expect(agent.run({ input: 'last wins', sessionId: 's1' })).resolves.toMatchObject({
      intent: 'custom',
      message: 'last wins',
    });
    expect(memoryCalls).toEqual(['user', 'agent']);
  });

  it('uses custom guard and trace modules', async () => {
    const events: string[] = [];
    const agent = createAgent({ model: modelConfig })
      .useGuard({
        check() {
          return { allowed: false, reason: 'blocked by custom guard' };
        },
      })
      .useTrace({
        start() {
          events.push('start');
          return {
            append() {
              events.push('append');
            },
            end() {
              events.push('end');
            },
          };
        },
      })
      .build();

    await expect(agent.run({ input: 'blocked' })).resolves.toMatchObject({
      success: false,
      message: 'blocked by custom guard',
    });
    expect(events).toEqual(['start', 'end']);
  });

  it('validates runtime modules at build time', () => {
    const builder = createAgent({ model: modelConfig }).usePlanner({} as Planner);
    expect(() => builder.build()).toThrow('planner.plan must be a function');
  });

  it('supports model-driven skill selection through ModelSkillPlanner', async () => {
    const skill: Skill<string, string> = {
      name: 'calendar.search',
      description: 'Search calendar events',
      inputSchema: z.string(),
      outputSchema: z.string(),
      async execute(input) {
        return `searched: ${input}`;
      },
    };
    const selectorModel = {
      async generate() {
        return { text: 'calendar.search' };
      },
    };
    const agent = createAgent({ model: modelConfig })
      .useSkill(skill)
      .usePlanner(new ModelSkillPlanner(selectorModel))
      .build();

    await expect(agent.run({ input: 'find meetings' })).resolves.toMatchObject({
      success: true,
      data: 'searched: find meetings',
    });
  });

  it('falls back to model responses when model-driven skill selection returns none', async () => {
    const selectorModel = {
      async generate(input: { task: string }) {
        return { text: input.task === 'select_skill' ? 'none' : 'fallback response' };
      },
    };
    const agent = createAgent({ model: modelConfig })
      .useSkill({
        name: 'calendar.search',
        description: 'Search calendar events',
        inputSchema: z.string(),
        outputSchema: z.string(),
        async execute(input) {
          return input;
        },
      })
      .useSkill({
        name: 'mail.search',
        description: 'Search mail',
        inputSchema: z.string(),
        outputSchema: z.string(),
        async execute(input) {
          return input;
        },
      })
      .useModel(selectorModel)
      .usePlanner(new ModelSkillPlanner(selectorModel))
      .build();

    await expect(agent.run({ input: 'just chat' })).resolves.toMatchObject({
      success: true,
      message: 'fallback response',
    });
  });

  it('blocks input with BasicGuard rules', async () => {
    const agent = createAgent({ model: modelConfig })
      .useGuard(new BasicGuard({ maxInputLength: 5, blocklist: ['bad'] }))
      .build();

    await expect(agent.run({ input: 'too long' })).resolves.toMatchObject({
      success: false,
      errorDetails: [{ code: 'guard_blocked' }],
    });

    const blocklistAgent = createAgent({ model: modelConfig })
      .useGuard(new BasicGuard({ blocklist: [/secret/i] }))
      .build();
    await expect(blocklistAgent.run({ input: 'contains secret' })).resolves.toMatchObject({
      success: false,
      errorDetails: [{ code: 'guard_blocked' }],
    });
  });

  it('bounds in-memory sessions and messages', () => {
    let now = 1000;
    const memory = new InMemoryProvider({
      maxMessagesPerSession: 2,
      maxSessions: 2,
      ttlMs: 100,
      now: () => now,
    });

    memory.append('s1', { role: 'user', content: '1', at: '1' });
    memory.append('s1', { role: 'agent', content: '2', at: '2' });
    memory.append('s1', { role: 'user', content: '3', at: '3' });
    expect(memory.get('s1').map((message) => message.content)).toEqual(['2', '3']);

    memory.append('s2', { role: 'user', content: 's2', at: '4' });
    memory.append('s3', { role: 'user', content: 's3', at: '5' });
    expect(memory.get('s1')).toEqual([]);
    expect(memory.size()).toBe(2);

    now = 1201;
    expect(memory.get('s2')).toEqual([]);
    expect(memory.size()).toBe(0);
  });

  it('records traces in memory', async () => {
    const trace = new InMemoryTraceProvider();
    const agent = createAgent({ model: modelConfig })
      .useTrace(trace)
      .useModel({
        async generate() {
          return { text: 'traced' };
        },
      })
      .build();

    const output = await agent.run({ input: 'trace me' });
    const run = trace.get(output.traceId ?? '');
    expect(run?.events.map((event) => event.type)).toContain('plan.created');
    expect(run?.output?.message).toBe('traced');
    expect(trace.list()).toHaveLength(1);
  });

  it('applies skill retry and timeout policies with structured errors', async () => {
    let attempts = 0;
    const retrySkill: Skill<string, string> = {
      name: 'retry.echo',
      description: 'Retry echo',
      inputSchema: z.string(),
      outputSchema: z.string(),
      retry: 1,
      async execute(input) {
        attempts += 1;
        if (attempts === 1) throw new Error('temporary failure');
        return input;
      },
    };
    const retryAgent = createAgent({ model: modelConfig }).useSkill(retrySkill).build();
    await expect(retryAgent.run({ input: 'ok' })).resolves.toMatchObject({ data: 'ok' });
    expect(attempts).toBe(2);

    const timeoutSkill: Skill<string, string> = {
      name: 'timeout.echo',
      description: 'Timeout echo',
      inputSchema: z.string(),
      outputSchema: z.string(),
      timeoutMs: 1,
      async execute() {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return 'late';
      },
    };
    const timeoutAgent = createAgent({ model: modelConfig }).useSkill(timeoutSkill).build();
    await expect(timeoutAgent.run({ input: 'slow' })).resolves.toMatchObject({
      success: false,
      errorDetails: [{ code: 'skill_timeout' }],
    });
  });

  it('lets skills call the configured webhook service', async () => {
    const calls: unknown[] = [];
    const skill: Skill<string, { ok: boolean }> = {
      name: 'notify.skill',
      description: 'Notify from skill',
      inputSchema: z.string(),
      outputSchema: z.object({ ok: z.boolean() }),
      async execute(input, context) {
        const result = await context.webhook?.notify({
          event: 'build.completed',
          message: input,
        });
        calls.push(result);
        return { ok: true };
      },
    };

    const agent = createAgent({ model: modelConfig })
      .useWebhook({
        async notify(payload) {
          calls.push(payload);
          return { delivered: true };
        },
      })
      .useSkill(skill)
      .build();

    await expect(agent.run({ input: 'build done' })).resolves.toMatchObject({ success: true });
    expect(calls).toEqual([
      { event: 'build.completed', message: 'build done' },
      { delivered: true },
    ]);
  });

  it('lets planners call the configured webhook service', async () => {
    const calls: unknown[] = [];
    const planner: Planner = {
      async plan(context: AgentContext) {
        await context.webhook.notify({
          event: 'build.completed',
          message: 'Planner selected build workflow',
        });
        return { goal: 'reply', steps: [{ type: 'response', message: 'planned' }] };
      },
    };

    const agent = createAgent({ model: modelConfig })
      .useWebhook({
        async notify(payload) {
          calls.push(payload);
          return { delivered: true };
        },
      })
      .usePlanner(planner)
      .build();

    await expect(agent.run({ input: 'plan' })).resolves.toMatchObject({ message: 'planned' });
    expect(calls).toEqual([{ event: 'build.completed', message: 'Planner selected build workflow' }]);
  });

  it('runs normally with the default no-op webhook service', async () => {
    const skill: Skill<string, { delivered: boolean }> = {
      name: 'noop.webhook',
      description: 'Use default webhook',
      inputSchema: z.string(),
      outputSchema: z.object({ delivered: z.boolean() }),
      async execute(_input, context) {
        const result = await context.webhook?.notify({
          event: 'build.completed',
          message: 'No-op delivery',
        });
        return { delivered: Boolean(result?.delivered) };
      },
    };

    const agent = createAgent({ model: modelConfig }).useSkill(skill).build();
    await expect(agent.run({ input: 'noop' })).resolves.toMatchObject({
      success: true,
      data: { delivered: false },
    });
  });
});
