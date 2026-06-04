import { z } from 'zod';

export const templateNameSchema = z.literal('tool-agent');

export const templateFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

export const templateDefinitionSchema = z.object({
  name: templateNameSchema,
  description: z.string().min(1),
  files: z.function(),
});
