import { describe, expect, it, vi } from 'vitest';
import { createOpenAICompatibleProvider, normalizeModelConfig } from '../src/index.js';

describe('OpenAI-compatible provider', () => {
  it('normalizes defaults and trailing slashes', () => {
    expect(normalizeModelConfig({
      baseUrl: 'https://example.test/v1///',
      apiKey: 'key',
    })).toMatchObject({
      baseUrl: 'https://example.test/v1',
      model: 'gpt-4o-mini',
      timeoutMs: 30000,
      maxRetries: 1,
      retryBackoffMs: 250,
    });
  });

  it('lets an explicit model override the default', () => {
    expect(normalizeModelConfig({
      baseUrl: 'https://example.test/v1',
      apiKey: 'key',
      model: 'custom-model',
    })).toMatchObject({
      model: 'custom-model',
    });
  });

  it('sends chat completions requests with auth and custom headers', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'hello' } }],
    }), { status: 200 }));
    const provider = createOpenAICompatibleProvider({
      baseUrl: 'https://example.test/v1/',
      apiKey: 'secret',
      model: 'test-model',
      headers: { 'x-tenant': 'tenant-1' },
      maxRetries: 0,
    }, { fetch: fetchMock as typeof fetch });

    await expect(provider.generate({ task: 'reply', input: 'hi', memory: [] })).resolves.toEqual({ text: 'hello' });
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        authorization: 'Bearer secret',
        'x-tenant': 'tenant-1',
      }),
    }));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
    });
  });

  it('sends optional generation parameters and returns usage', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: {
        prompt_tokens: 3,
        completion_tokens: 4,
        total_tokens: 7,
      },
    }), { status: 200 }));
    const provider = createOpenAICompatibleProvider({
      baseUrl: 'https://example.test/v1/',
      apiKey: 'secret',
      model: 'test-model',
      systemPrompt: 'You are a helpful agent.',
      temperature: 0.2,
      maxTokens: 128,
      responseFormat: 'json_object',
      maxRetries: 0,
    }, { fetch: fetchMock as typeof fetch });

    await expect(provider.generate({ task: 'reply', input: { query: 'hi' }, memory: [] })).resolves.toMatchObject({
      text: '{"ok":true}',
      usage: {
        promptTokens: 3,
        completionTokens: 4,
        totalTokens: 7,
      },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'test-model',
      temperature: 0.2,
      max_tokens: 128,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a helpful agent.' },
        { role: 'user', content: '{"query":"hi"}' },
      ],
    });
  });

  it('sends the default model when model is omitted', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'hello' } }],
    }), { status: 200 }));
    const provider = createOpenAICompatibleProvider({
      baseUrl: 'https://example.test/v1/',
      apiKey: 'secret',
      maxRetries: 0,
    }, { fetch: fetchMock as typeof fetch });

    await provider.generate({ task: 'reply', input: 'hi', memory: [] });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'gpt-4o-mini',
    });
  });

  it('retries failed requests', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('failed', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: 'recovered' } }],
      }), { status: 200 }));
    const provider = createOpenAICompatibleProvider({
      baseUrl: 'https://example.test/v1',
      apiKey: 'secret',
      model: 'test-model',
      maxRetries: 1,
    }, { fetch: fetchMock as typeof fetch });

    await expect(provider.generate({ task: 'reply', input: 'hi', memory: [] })).resolves.toEqual({ text: 'recovered' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable model request failures', async () => {
    const fetchMock = vi.fn(async () => new Response('bad request', { status: 400 }));
    const provider = createOpenAICompatibleProvider({
      baseUrl: 'https://example.test/v1',
      apiKey: 'secret',
      model: 'test-model',
      maxRetries: 2,
      retryBackoffMs: 0,
    }, { fetch: fetchMock as typeof fetch });

    await expect(provider.generate({ task: 'reply', input: 'hi', memory: [] })).rejects.toThrow('model_request_failed: 400 bad request');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries retryable status codes with backoff', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: 'recovered' } }],
      }), { status: 200 }));
    const provider = createOpenAICompatibleProvider({
      baseUrl: 'https://example.test/v1',
      apiKey: 'secret',
      model: 'test-model',
      maxRetries: 1,
      retryBackoffMs: 0,
    }, { fetch: fetchMock as typeof fetch });

    await expect(provider.generate({ task: 'reply', input: 'hi', memory: [] })).resolves.toEqual({ text: 'recovered' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('aborts requests after the configured timeout', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const provider = createOpenAICompatibleProvider({
      baseUrl: 'https://example.test/v1',
      apiKey: 'secret',
      model: 'test-model',
      timeoutMs: 1,
      maxRetries: 0,
    }, { fetch: fetchMock as typeof fetch });

    await expect(provider.generate({ task: 'reply', input: 'hi', memory: [] })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
