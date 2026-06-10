import type { ModelGenerateInput, ModelGenerateOutput, ModelProvider, OpenAICompatibleModelConfig } from './types.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_RETRY_BACKOFF_MS = 250;
export const DEFAULT_MODEL = 'gpt-4o-mini';

export interface OpenAICompatibleProviderOptions {
  fetch?: typeof globalThis.fetch;
}

export function normalizeModelConfig(config: OpenAICompatibleModelConfig): Required<Omit<OpenAICompatibleModelConfig, 'headers' | 'systemPrompt' | 'temperature' | 'maxTokens' | 'responseFormat'>> & {
  headers: Record<string, string>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object' | Record<string, unknown>;
} {
  const baseUrl = requireValue(config.baseUrl, 'model.baseUrl').replace(/\/+$/, '');
  const apiKey = requireValue(config.apiKey, 'model.apiKey');
  const model = config.model?.trim() || DEFAULT_MODEL;
  return {
    baseUrl,
    apiKey,
    model,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    retryBackoffMs: config.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS,
    headers: { ...(config.headers ?? {}) },
    ...(config.systemPrompt ? { systemPrompt: config.systemPrompt } : {}),
    ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
    ...(config.maxTokens !== undefined ? { maxTokens: config.maxTokens } : {}),
    ...(config.responseFormat !== undefined ? { responseFormat: config.responseFormat } : {}),
  };
}

export function createOpenAICompatibleProvider(
  modelConfig: OpenAICompatibleModelConfig,
  options: OpenAICompatibleProviderOptions = {},
): ModelProvider {
  const config = normalizeModelConfig(modelConfig);
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) throw new Error('Global fetch is unavailable. Node.js 18 or newer is required.');

  return {
    async generate(input: ModelGenerateInput): Promise<ModelGenerateOutput> {
      let lastError: unknown;
      for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), config.timeoutMs);
        try {
          const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${config.apiKey}`,
              ...config.headers,
            },
            body: JSON.stringify(buildRequestBody(config, input)),
            signal: controller.signal,
          });
          if (!response.ok) {
            const message = `model_request_failed: ${response.status} ${await response.text()}`;
            throw new ModelRequestError(message, response.status, isRetryableStatus(response.status));
          }
          const payload = await response.json() as {
            choices?: Array<{ message?: { content?: string } }>;
            usage?: {
              prompt_tokens?: number;
              completion_tokens?: number;
              total_tokens?: number;
            };
          };
          const text = payload.choices?.[0]?.message?.content;
          if (!text) throw new Error('model_response_invalid: choices[0].message.content is missing');
          return {
            text,
            ...(payload.usage ? {
              usage: {
                promptTokens: payload.usage.prompt_tokens,
                completionTokens: payload.usage.completion_tokens,
                totalTokens: payload.usage.total_tokens,
                raw: payload.usage,
              },
            } : {}),
          };
        } catch (error) {
          lastError = error;
          if (attempt === config.maxRetries) break;
          if (!isRetryableError(error)) break;
          await sleep(config.retryBackoffMs * 2 ** attempt);
        } finally {
          clearTimeout(timer);
        }
      }
      throw lastError instanceof Error ? lastError : new Error(String(lastError));
    },
  };
}

function requireValue(value: string, field: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${field} is required.`);
  return normalized;
}

function stringifyInput(input: unknown): string {
  return typeof input === 'string' ? input : JSON.stringify(input);
}

function buildRequestBody(
  config: ReturnType<typeof normalizeModelConfig>,
  input: ModelGenerateInput,
): Record<string, unknown> {
  return {
    model: config.model,
    messages: [
      ...(config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }] : []),
      ...input.memory.map((message) => ({ role: message.role, content: message.content })),
      { role: 'user', content: stringifyInput(input.input) },
    ],
    ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
    ...(config.maxTokens !== undefined ? { max_tokens: config.maxTokens } : {}),
    ...(config.responseFormat !== undefined ? { response_format: normalizeResponseFormat(config.responseFormat) } : {}),
  };
}

function normalizeResponseFormat(responseFormat: 'text' | 'json_object' | Record<string, unknown>): unknown {
  if (responseFormat === 'text') return { type: 'text' };
  if (responseFormat === 'json_object') return { type: 'json_object' };
  return responseFormat;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof ModelRequestError) return error.retryable;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return !(error instanceof Error) || !error.message.startsWith('model_response_invalid');
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ModelRequestError extends Error {
  constructor(message: string, readonly status: number, readonly retryable: boolean) {
    super(message);
  }
}
