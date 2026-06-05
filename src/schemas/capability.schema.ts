import { z } from 'zod';

export const capabilityNameSchema = z.literal('agent-core');

export const capabilityFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

export const capabilityDefinitionSchema = z.object({
  name: capabilityNameSchema,
  description: z.string().min(1),
  files: z.function(),
});
