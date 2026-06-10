import { z } from 'zod';
import type { Skill, TraceRun } from '../types.js';

export interface WebhookConfig {
  url: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
  warn?: (message: string) => void;
}

export type WebhookEvent =
  | 'build.completed'
  | 'build.failed'
  | 'directUpload.completed'
  | 'directUpload.failed';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp?: string;
  message: string;
  logs?: string[];
  error?: string;
}

export interface WebhookDeliveryResult {
  delivered: boolean;
  status?: number;
  statusText?: string;
  error?: string;
}

export interface WebhookService {
  notify(payload: WebhookPayload, trace?: TraceRun): Promise<WebhookDeliveryResult>;
}

/** 构造 webhook 推送的 payload。 */
export function buildWebhookPayload(params: {
  event: WebhookEvent;
  message: string;
  logs?: string[];
  error?: string;
}): WebhookPayload {
  return {
    event: params.event,
    timestamp: new Date().toISOString(),
    message: params.message,
    logs: params.logs,
    error: params.error,
  };
}

export async function sendWebhook(
  url: string,
  payload: WebhookPayload,
  timeoutMs = 10_000,
  options: {
    headers?: Record<string, string>;
    fetch?: typeof globalThis.fetch;
    warn?: (message: string) => void;
  } = {},
): Promise<WebhookDeliveryResult> {
  if (!url) return { delivered: false };
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    return warnAndReturn(options.warn, 'Global fetch is unavailable. Node.js 18 or newer is required.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
      body: JSON.stringify(normalizeWebhookPayload(payload)),
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = `[webhook] delivery failed: HTTP ${response.status} ${response.statusText}`;
      options.warn?.(message) ?? console.warn(message);
      return { delivered: false, status: response.status, statusText: response.statusText };
    }
    return { delivered: true, status: response.status, statusText: response.statusText };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return warnAndReturn(options.warn, `[webhook] delivery error: ${reason}`, reason);
  } finally {
    clearTimeout(timer);
  }
}

export async function notifyWebhook(
  config: WebhookConfig | undefined,
  payload: WebhookPayload,
): Promise<WebhookDeliveryResult> {
  if (!config?.url) return { delivered: false };
  return await sendWebhook(config.url, payload, config.timeoutMs, config);
}

export class NoopWebhookService implements WebhookService {
  async notify(): Promise<WebhookDeliveryResult> {
    return { delivered: false };
  }
}

export class HttpWebhookService implements WebhookService {
  constructor(private readonly config: WebhookConfig) {}

  async notify(payload: WebhookPayload, trace?: TraceRun): Promise<WebhookDeliveryResult> {
    const startedAt = Date.now();
    const safe = safeWebhookTracePayload(payload);
    await trace?.append({ type: 'webhook.start', data: safe });
    const result = await notifyWebhook(this.config, normalizeWebhookPayload(payload));
    await trace?.append({
      type: result.delivered ? 'webhook.completed' : 'webhook.failed',
      data: {
        ...safe,
        delivered: result.delivered,
        status: result.status,
        statusText: result.statusText,
        error: result.error,
        durationMs: Date.now() - startedAt,
      },
    });
    return result;
  }
}

const webhookInputSchema = z.object({
  event: z.enum(['build.completed', 'build.failed', 'directUpload.completed', 'directUpload.failed']),
  message: z.string().min(1),
  logs: z.array(z.string()).optional(),
  error: z.string().optional(),
});

const webhookOutputSchema = z.object({
  ok: z.boolean(),
  delivered: z.boolean(),
  status: z.number().optional(),
  statusText: z.string().optional(),
  error: z.string().optional(),
});

export function createWebhookSkill(configOrService: WebhookConfig | WebhookService): Skill<
  z.infer<typeof webhookInputSchema>,
  z.infer<typeof webhookOutputSchema>
> {
  const service = isWebhookService(configOrService) ? configOrService : new HttpWebhookService(configOrService);
  return {
    name: 'webhook',
    description: 'Send a configured webhook notification.',
    inputSchema: webhookInputSchema,
    outputSchema: webhookOutputSchema,
    permission: 'external_api',
    tags: ['webhook', 'notification'],
    async execute(input, context) {
      const result = await service.notify(buildWebhookPayload(input), context.trace);
      return {
        ok: true,
        delivered: result.delivered,
        status: result.status,
        statusText: result.statusText,
        error: result.error,
      };
    },
  };
}

export function createWebhookService(config?: WebhookConfig): WebhookService {
  return config?.url ? new HttpWebhookService(config) : new NoopWebhookService();
}

function normalizeWebhookPayload(payload: WebhookPayload): Required<Pick<WebhookPayload, 'event' | 'timestamp' | 'message'>> & Omit<WebhookPayload, 'event' | 'timestamp' | 'message'> {
  return {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  };
}

function safeWebhookTracePayload(payload: WebhookPayload): Pick<WebhookPayload, 'event' | 'message'> {
  return {
    event: payload.event,
    message: payload.message,
  };
}

function warnAndReturn(warn: ((message: string) => void) | undefined, message: string, error?: string): WebhookDeliveryResult {
  warn?.(message) ?? console.warn(message);
  return { delivered: false, error: error ?? message };
}

function isWebhookService(value: WebhookConfig | WebhookService): value is WebhookService {
  return typeof (value as WebhookService).notify === 'function';
}
