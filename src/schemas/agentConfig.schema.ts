import { z } from 'zod';

export const agentConfigSchema = z.object({
  name: z.string().min(1),
  capability: z.literal('agent-core'),
  version: z.string().min(1),
  configVersion: z.string().min(1),
  capabilityVersion: z.string().min(1),
  generatedBy: z.object({
    name: z.literal('agent-creator'),
    version: z.string().min(1),
  }),
  service: z.object({
    enabled: z.boolean(),
    framework: z.literal('next').optional(),
  }),
  model: z.object({
    provider: z.literal('openai-compatible'),
    defaultModel: z.string().min(1),
    timeoutMs: z.number().positive(),
    maxRetries: z.number().int().nonnegative(),
  }),
  tools: z.object({
    enabled: z.array(z.string().min(1)),
    defaultTimeoutMs: z.number().positive(),
    defaultRetry: z.number().int().nonnegative(),
  }),
  constraints: z.object({
    blockedKeywords: z.array(z.string()),
  }),
  trace: z.object({
    enabled: z.boolean(),
    writeToFile: z.boolean(),
    directory: z.string().min(1),
  }),
});

export type AgentConfigShape = z.infer<typeof agentConfigSchema>;
