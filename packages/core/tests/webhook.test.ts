import { describe, expect, it, vi } from 'vitest';
import {
  HttpWebhookService,
  InMemoryTraceProvider,
  NoopWebhookService,
  buildWebhookPayload,
  createWebhookSkill,
  sendWebhook,
} from '../src/index.js';

describe('webhook service', () => {
  it('builds payloads with timestamps', () => {
    const payload = buildWebhookPayload({
      event: 'build.completed',
      message: 'Build completed',
      logs: ['ok'],
    });

    expect(payload).toMatchObject({
      event: 'build.completed',
      message: 'Build completed',
      logs: ['ok'],
    });
    expect(payload.timestamp).toEqual(expect.any(String));
  });

  it('sends webhook JSON', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200, statusText: 'OK' }));

    await expect(sendWebhook('https://example.test/hook', {
      event: 'build.completed',
      message: 'Build completed',
    }, 1000, { fetch: fetchMock as typeof fetch })).resolves.toMatchObject({
      delivered: true,
      status: 200,
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.test/hook', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    }));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      event: 'build.completed',
      message: 'Build completed',
      timestamp: expect.any(String),
    });
  });

  it('skips empty URLs without sending', async () => {
    const fetchMock = vi.fn();

    await expect(sendWebhook('', {
      event: 'build.completed',
      message: 'Build completed',
    }, 1000, { fetch: fetchMock as typeof fetch })).resolves.toEqual({ delivered: false });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not throw on HTTP or network failures', async () => {
    const warn = vi.fn();
    const failingStatus = vi.fn(async () => new Response('', { status: 500, statusText: 'Server Error' }));
    await expect(sendWebhook('https://example.test/hook', {
      event: 'build.failed',
      message: 'Build failed',
    }, 1000, { fetch: failingStatus as typeof fetch, warn })).resolves.toMatchObject({
      delivered: false,
      status: 500,
    });

    const networkFailure = vi.fn(async () => {
      throw new Error('network down');
    });
    await expect(sendWebhook('https://example.test/hook', {
      event: 'build.failed',
      message: 'Build failed',
    }, 1000, { fetch: networkFailure as typeof fetch, warn })).resolves.toMatchObject({
      delivered: false,
      error: 'network down',
    });
    expect(warn).toHaveBeenCalled();
  });

  it('records redacted trace events', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }));
    const traces = new InMemoryTraceProvider();
    const trace = traces.start({ input: 'test' }, 'trace_1');
    const service = new HttpWebhookService({
      url: 'https://example.test/hook',
      fetch: fetchMock as typeof fetch,
    });

    await service.notify({
      event: 'directUpload.completed',
      message: 'Upload completed',
      logs: ['sensitive log'],
    }, trace);

    const run = traces.get('trace_1');
    expect(run?.events.map((event) => event.type)).toEqual(['webhook.start', 'webhook.completed']);
    expect(run?.events[0]?.data).toEqual({
      event: 'directUpload.completed',
      message: 'Upload completed',
    });
    expect(JSON.stringify(run?.events)).not.toContain('sensitive log');
  });

  it('creates a webhook skill', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }));
    const skill = createWebhookSkill({
      url: 'https://example.test/hook',
      fetch: fetchMock as typeof fetch,
    });

    const output = await skill.execute({
      event: 'build.completed',
      message: 'Build completed',
    }, {
      traceId: 'trace_1',
      executionId: 'execution_1',
      attempt: 1,
      idempotencyKey: 'idempotency_1',
      signal: new AbortController().signal,
      webhook: new NoopWebhookService(),
      trace: {
        append() {},
        end() {},
      },
    });

    expect(output).toMatchObject({ ok: true, delivered: true, status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
