import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { NoopWebhookService, createAgent, ToolRegistry, type SkillContext, type ToolDefinition } from '../src/index.js';

const testSkillContext: SkillContext = {
  traceId: 'trace',
  webhook: new NoopWebhookService(),
  trace: {
    append() {},
    end() {},
  },
};

describe('tool compatibility', () => {
  it('adapts legacy tools to skills', async () => {
    const tool: ToolDefinition<{ value: string }, { value: string }> = {
      name: 'legacy.echo',
      description: 'Legacy echo tool',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      async handler(input) {
        return input;
      },
    };
    const agent = createAgent({
      model: { baseUrl: 'https://example.test/v1', apiKey: 'key', model: 'model' },
      tools: [tool],
    })
      .usePlanner({
        plan: () => ({ goal: 'legacy', steps: [{ type: 'skill', skill: 'legacy.echo', input: { value: 'ok' } }] }),
      })
      .build();

    await expect(agent.run({ input: 'legacy' })).resolves.toMatchObject({ data: { value: 'ok' } });
  });

  it('keeps the deprecated ToolRegistry operational', async () => {
    const registry = new ToolRegistry();
    registry.registerTool({
      name: 'legacy.echo',
      description: 'Legacy echo tool',
      inputSchema: z.string(),
      outputSchema: z.string(),
      async handler(input) {
        return input;
      },
    });

    await expect(registry.executeTool('legacy.echo', 'ok', testSkillContext)).resolves.toBe('ok');

    const agent = createAgent({
      model: { baseUrl: 'https://example.test/v1', apiKey: 'key', model: 'model' },
      toolRegistry: registry,
    })
      .usePlanner({
        plan: () => ({ goal: 'legacy', steps: [{ type: 'skill', skill: 'legacy.echo', input: 'from registry' }] }),
      })
      .build();
    await expect(agent.run({ input: 'legacy registry' })).resolves.toMatchObject({ data: 'from registry' });
  });
});
