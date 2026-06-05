import { describe, expect, it, vi } from 'vitest';
import { createOpenAICompatibleProvider, normalizeModelConfig } from '../src/index.js';

describe('OpenAI-compatible provider', () => {
  it('normalizes defaults and trailing slashes', () => {
    expect(normalizeModelConfig({
      baseUrl: 'https://example.test/v1///',
      apiKey: 'key',
      model: 'model',
    })).toMatchObject({
      baseUrl: 'https://example.test/v1',
      timeoutMs: 30000,
      maxRetries: 1,
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
