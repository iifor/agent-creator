import { z } from 'zod';

export const agentOutputSchema = z.object({
  success: z.boolean(),
  intent: z.string().min(1),
  message: z.string().min(1),
  data: z.unknown().optional(),
  warnings: z.array(z.string()).optional(),
  errors: z.array(z.string()).optional(),
  traceId: z.string().optional(),
});
