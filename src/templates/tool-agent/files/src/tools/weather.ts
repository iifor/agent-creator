import { z } from 'zod';
import type { ToolDefinition } from '../types/tool.js';

const inputSchema = z.object({
  location: z.string().min(1),
  date: z.string().min(1),
});

const outputSchema = z.object({
  location: z.string(),
  date: z.string(),
  condition: z.string(),
  temperature: z.number(),
});

export const weatherTool: ToolDefinition = {
  name: 'weather.query',
  description: 'Return mock weather for a location and date.',
  inputSchema,
  outputSchema,
  permission: 'public',
  timeoutMs: 5000,
  retry: 1,
  async handler(input) {
    const value = inputSchema.parse(input);
    return {
      location: value.location,
      date: value.date,
      condition: 'rainy',
      temperature: 22,
    };
  },
};
