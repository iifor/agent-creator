import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import {
  createAgent,
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
    expect(() => createAgent({ model: { ...modelConfig, model: '' } })).toThrow('model.model is required');
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
});
