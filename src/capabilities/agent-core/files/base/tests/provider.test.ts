import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '../agent.config.js';
import { createOpenAICompatibleProvider } from '../src/index.js';

describe('openAICompatibleProvider', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('requires OPENAI_API_KEY', async () => {
    delete process.env.OPENAI_API_KEY;
    const provider = createOpenAICompatibleProvider(config);
    await expect(provider.generate({ task: 'generate_response', input: 'hello' })).rejects.toThrow('OPENAI_API_KEY is required');
  });

  it('uses default base URL and config default model', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_MODEL;
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'ok' } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = createOpenAICompatibleProvider(config);
    const result = await provider.generate({ task: 'generate_response', input: 'hello' });

    expect(result.text).toBe('ok');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions');
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({ model: config.model.defaultModel });
  });

  it('uses LLM_BASE_URL and LLM_MODEL from env', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.LLM_BASE_URL = 'https://llm.example/v1/';
    process.env.LLM_MODEL = 'custom-model';
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'ok' } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = createOpenAICompatibleProvider(config);
    await provider.generate({ task: 'generate_response', input: 'hello' });

    expect(fetchMock.mock.calls[0][0]).toBe('https://llm.example/v1/chat/completions');
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({ model: 'custom-model' });
  });
});
