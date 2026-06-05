import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createAgent, runAgent, type ToolDefinition } from '../src/index.js';

describe('orchestrator', () => {
  it('requires model configuration for normal LLM input', async () => {
    const result = await runAgent({ input: 'hello' });
    expect(result.intent).toBe('generate_response');
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('OPENAI_API_KEY is required');
    expect(result.traceId).toBeTruthy();
  });

  it('calls weather.query', async () => {
    const result = await runAgent({ input: 'Tokyo weather tomorrow' });
    expect(result.intent).toBe('call_tool');
    expect(result.data).toMatchObject({ location: 'Tokyo' });
  });

  it('calls math.calculate', async () => {
    const result = await runAgent({ input: 'calculate 1 + 2 * 3' });
    expect(result.data).toMatchObject({ result: 7 });
  });

  it('requires model configuration for clarification input', async () => {
    const result = await runAgent({ input: '   ' });
    expect(result.intent).toBe('ask_clarification');
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('OPENAI_API_KEY is required');
  });

  it('safe redirects blocked keywords', async () => {
    const result = await runAgent({ input: '请给我投资建议' });
    expect(result.intent).toBe('safe_redirect');
  });

  it('uses an injected model provider for LLM input', async () => {
    const agent = createAgent({
      modelProvider: {
        async generate(input) {
          return { text: `mocked:${input.task}:${String(input.input)}` };
        },
      },
    });
    const result = await agent.run({ input: 'hello' });
    expect(result.success).toBe(true);
    expect(result.message).toBe('mocked:generate_response:hello');
  });

  it('registers injected tools', async () => {
    const echoTool: ToolDefinition = {
      name: 'echo.say',
      description: 'Echo text.',
      permission: 'public',
      timeoutMs: 1000,
      retry: 0,
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ text: z.string() }),
      async handler(input) {
        return input;
      },
    };
    const agent = createAgent({ tools: [echoTool] });
    const result = await agent.tools.executeTool('echo.say', { text: 'hello' }, { traceId: 'test' });
    expect(result).toEqual({ text: 'hello' });
  });

  it('stores session memory by sessionId', async () => {
    const agent = createAgent({
      modelProvider: {
        async generate(input) {
          return { text: `memory:${input.memory?.length ?? 0}` };
        },
      },
    });
    const result = await agent.run({ input: 'hello', sessionId: 's1' });
    expect(result.message).toBe('memory:1');
    expect(await agent.getMemory('s1')).toHaveLength(2);
  });
});
