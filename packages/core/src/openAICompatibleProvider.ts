import type { ModelGenerateInput, ModelGenerateOutput, ModelProvider, OpenAICompatibleModelConfig } from './types.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 1;
export const DEFAULT_MODEL = 'gpt-4o-mini';

export interface OpenAICompatibleProviderOptions {
  fetch?: typeof globalThis.fetch;
}

export function normalizeModelConfig(config: OpenAICompatibleModelConfig): Required<Omit<OpenAICompatibleModelConfig, 'headers'>> & { headers: Record<string, string> } {
  const baseUrl = requireValue(config.baseUrl, 'model.baseUrl').replace(/\/+$/, '');
  const apiKey = requireValue(config.apiKey, 'model.apiKey');
  const model = config.model?.trim() || DEFAULT_MODEL;
  return {
    baseUrl,
    apiKey,
    model,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    headers: { ...(config.headers ?? {}) },
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
            body: JSON.stringify({
              model: config.model,
              messages: [
                ...input.memory.map((message) => ({ role: message.role, content: message.content })),
                { role: 'user', content: stringifyInput(input.input) },
              ],
            }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(`model_request_failed: ${response.status} ${await response.text()}`);
          const payload = await response.json() as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const text = payload.choices?.[0]?.message?.content;
          if (!text) throw new Error('model_response_invalid: choices[0].message.content is missing');
          return { text };
        } catch (error) {
          lastError = error;
          if (attempt === config.maxRetries) break;
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
